/**
 * WebSocket server for Python-Node.js bridge communication.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { WhatsAppClient, InboundMessage } from './whatsapp.js';
import fs from 'fs';

interface SendCommand {
  type: 'send' | 'send_image' | 'send_document' | 'send_audio' | 'send_video';
  to: string;
  text?: string;
  image?: string;
  data?: string;
  caption?: string;
  mimetype?: string;
  filename?: string;
}

interface BridgeMessage {
  type: 'message' | 'status' | 'qr' | 'error';
  [key: string]: unknown;
}

export class BridgeServer {
  private wss: WebSocketServer | null = null;
  private wa: WhatsAppClient | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(private port: number, private authDir: string, private qrFilePath: string = '') { }

  async start(): Promise<void> {
    // Create WebSocket server
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`🌉 Bridge server listening on ws://localhost:${this.port}`);

    // Initialize WhatsApp client
    this.wa = new WhatsAppClient({
      authDir: this.authDir,
      onMessage: (msg) => this.broadcast({ type: 'message', ...msg }),
      onQR: (qr) => {
        this.broadcast({ type: 'qr', qr });
        // Write QR to file for platform to read
        if (this.qrFilePath) {
          try {
            fs.writeFileSync(this.qrFilePath, qr, 'utf-8');
            console.log(`📝 QR written to ${this.qrFilePath}`);
          } catch (e) {
            console.error('Failed to write QR file:', e);
          }
        }
      },
      onStatus: (status) => {
        this.broadcast({ type: 'status', status });
        // Clear QR file when connected (no longer needed)
        if (status === 'connected' && this.qrFilePath) {
          try {
            if (fs.existsSync(this.qrFilePath)) {
              fs.unlinkSync(this.qrFilePath);
              console.log(`🗑️ QR file cleared (connected)`);
            }
          } catch (e) { }
        }
      },
    });

    // Handle WebSocket connections
    this.wss.on('connection', (ws) => {
      console.log('🔗 Python client connected');
      this.clients.add(ws);

      // Immediately send current status and QR if available
      if (this.wa) {
        ws.send(JSON.stringify({ type: 'status', status: this.wa.getStatus() }));
        const currentQR = this.wa.getQR();
        if (currentQR) {
          ws.send(JSON.stringify({ type: 'qr', qr: currentQR }));
        }
      }

      ws.on('message', async (data) => {
        try {
          const cmd = JSON.parse(data.toString()) as SendCommand;
          await this.handleCommand(cmd);
          ws.send(JSON.stringify({ type: 'sent', to: cmd.to }));
        } catch (error) {
          console.error('Error handling command:', error);
          ws.send(JSON.stringify({ type: 'error', error: String(error) }));
        }
      });

      ws.on('close', () => {
        console.log('🔌 Python client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    // Connect to WhatsApp
    await this.wa.connect();
  }

  private async handleCommand(cmd: SendCommand): Promise<void> {
    if (!this.wa) return;

    if (cmd.type === 'send' && cmd.text) {
      await this.wa.sendMessage(cmd.to, cmd.text);
    } else if (cmd.type === 'send_image' && cmd.image) {
      await this.wa.sendImage(cmd.to, cmd.image, cmd.caption || '', cmd.mimetype || 'image/png');
    } else if (cmd.type === 'send_document' && cmd.data) {
      await this.wa.sendDocument(cmd.to, cmd.data, cmd.filename || 'file', cmd.mimetype || 'application/octet-stream', cmd.caption || '');
    } else if (cmd.type === 'send_audio' && cmd.data) {
      await this.wa.sendAudio(cmd.to, cmd.data, cmd.mimetype || 'audio/mpeg');
    } else if (cmd.type === 'send_video' && cmd.data) {
      await this.wa.sendVideo(cmd.to, cmd.data, cmd.mimetype || 'video/mp4', cmd.caption || '');
    }
  }

  private broadcast(msg: BridgeMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  async stop(): Promise<void> {
    // Clean up QR file on stop
    if (this.qrFilePath) {
      try { fs.unlinkSync(this.qrFilePath); } catch (e) { }
    }

    // Close all client connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Disconnect WhatsApp
    if (this.wa) {
      await this.wa.disconnect();
      this.wa = null;
    }
  }
}

