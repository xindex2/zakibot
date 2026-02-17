"""WhatsApp channel implementation using Node.js bridge."""

import asyncio
import json
from pathlib import Path
from typing import Any

from loguru import logger

from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import WhatsAppConfig


class WhatsAppChannel(BaseChannel):
    """
    WhatsApp channel that connects to a Node.js bridge.
    
    The bridge uses @whiskeysockets/baileys to handle the WhatsApp Web protocol.
    Communication between Python and Node.js is via WebSocket.
    """
    
    name = "whatsapp"
    
    def __init__(self, config: WhatsAppConfig, bus: MessageBus, workspace: Any = None):
        super().__init__(config, bus, workspace=workspace)
        self.config: WhatsAppConfig = config
        self._ws = None
        self._connected = False
        self._typing_tasks: dict[str, asyncio.Task] = {}  # chat_id -> typing task
    
    async def start(self) -> None:
        """Start the WhatsApp channel by connecting to the bridge."""
        import websockets
        
        bridge_url = self.config.bridge_url
        
        logger.info(f"Connecting to WhatsApp bridge at {bridge_url}...")
        
        self._running = True
        
        while self._running:
            try:
                async with websockets.connect(bridge_url) as ws:
                    self._ws = ws
                    self._connected = True
                    logger.info("Connected to WhatsApp bridge")
                    
                    # Listen for messages
                    async for message in ws:
                        try:
                            await self._handle_bridge_message(message)
                        except Exception as e:
                            logger.error(f"Error handling bridge message: {e}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._connected = False
                self._ws = None
                logger.warning(f"WhatsApp bridge connection error: {e}")
                
                if self._running:
                    logger.info("Reconnecting in 5 seconds...")
                    await asyncio.sleep(5)
    
    async def stop(self) -> None:
        """Stop the WhatsApp channel."""
        self._running = False
        self._connected = False
        
        if self._ws:
            await self._ws.close()
            self._ws = None
    
    async def send(self, msg: OutboundMessage) -> None:
        """Send a message through WhatsApp."""
        if not self._ws or not self._connected:
            logger.warning("WhatsApp bridge not connected")
            return
        
        try:
            import re
            import os
            import base64
            from pathlib import Path as P

            IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
            AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'}
            VIDEO_EXTS = {'.mp4', '.mov', '.webm', '.avi', '.mkv'}
            
            MIME_MAP = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
                '.pdf': 'application/pdf', '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                '.csv': 'text/csv', '.txt': 'text/plain',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.aac': 'audio/aac',
                '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
            }
            
            text_content = msg.content
            
            # 1) Detect [image: path] tags (legacy)
            image_pattern = re.compile(r'\[image:\s*([^\]]+)\]')
            image_matches = image_pattern.findall(text_content)
            text_content = image_pattern.sub('', text_content)
            
            # 1b) Detect markdown image syntax ![caption](path)
            md_image_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
            md_image_matches = []
            unresolved_images = []
            for m in md_image_pattern.finditer(text_content):
                caption = m.group(1).strip()
                raw_path = m.group(2).strip()
                resolved = False
                candidate_paths = [P(raw_path)]
                if self.workspace:
                    candidate_paths.append(P(self.workspace) / raw_path)
                if raw_path.startswith(('http://', 'https://')) and '/screenshots/' in raw_path:
                    filename = raw_path.split('/screenshots/')[-1].split('?')[0]
                    if self.workspace:
                        candidate_paths.append(P(self.workspace) / 'screenshots' / filename)
                for p in candidate_paths:
                    try:
                        if p.is_file():
                            md_image_matches.append((m.group(0), str(p)))
                            resolved = True
                            break
                    except (OSError, ValueError):
                        continue
                if not resolved:
                    unresolved_images.append((m.group(0), caption, raw_path))
            for (match_text, _) in md_image_matches:
                text_content = text_content.replace(match_text, '')
            for (match_text, caption, url) in unresolved_images:
                if url.startswith(('http://', 'https://')):
                    text_content = text_content.replace(match_text, f"{caption}: {url}" if caption else url)
                else:
                    text_content = text_content.replace(match_text, f"📸 {caption}" if caption else '')
            
            # 2) Detect general file paths in message text
            file_pattern = re.compile(
                r'(?:`([^`]+\.\w{1,5})`'
                r'|(/[\w./ -]+\.\w{1,5})'
                r'|((?:screenshots|media|files|documents|output|generated)/[\w./ -]+\.\w{1,5}))'
            )
            
            general_files = []
            for m in file_pattern.finditer(text_content):
                raw_path = m.group(1) or m.group(2) or m.group(3)
                raw_path = raw_path.strip()
                
                candidate_paths = [P(raw_path)]
                if self.workspace:
                    candidate_paths.append(P(self.workspace) / raw_path)
                    
                for p in candidate_paths:
                    if p.is_file():
                        general_files.append((m.group(0), str(p)))
                        break
            
            # Remove matched file references from text
            for (match_text, _) in general_files:
                text_content = text_content.replace(match_text, '')
            
            # Collect all files
            all_files = []
            for img_path in image_matches:
                img_path = img_path.strip()
                if os.path.isfile(img_path):
                    all_files.append(img_path)
                elif self.workspace and (P(self.workspace) / img_path).is_file():
                    all_files.append(str(P(self.workspace) / img_path))
            
            for (_, file_path) in md_image_matches:
                if file_path not in all_files:
                    all_files.append(file_path)
                    
            for (_, file_path) in general_files:
                if file_path not in all_files:
                    all_files.append(file_path)
            
            # Send each file via the bridge
            for file_path in all_files:
                ext = P(file_path).suffix.lower()
                filename = P(file_path).name
                mimetype = MIME_MAP.get(ext, 'application/octet-stream')
                
                try:
                    with open(file_path, 'rb') as f:
                        file_data = base64.b64encode(f.read()).decode('utf-8')
                    
                    if ext in IMAGE_EXTS:
                        payload = {
                            "type": "send_image",
                            "to": msg.chat_id,
                            "image": file_data,
                            "caption": f"📸 {filename}",
                            "mimetype": mimetype
                        }
                    elif ext in AUDIO_EXTS:
                        payload = {
                            "type": "send_audio",
                            "to": msg.chat_id,
                            "data": file_data,
                            "mimetype": mimetype,
                            "filename": filename
                        }
                    elif ext in VIDEO_EXTS:
                        payload = {
                            "type": "send_video",
                            "to": msg.chat_id,
                            "data": file_data,
                            "mimetype": mimetype,
                            "caption": f"🎬 {filename}"
                        }
                    else:
                        # PDF, DOCX, TXT, CSV, etc. -> document
                        payload = {
                            "type": "send_document",
                            "to": msg.chat_id,
                            "data": file_data,
                            "mimetype": mimetype,
                            "filename": filename,
                            "caption": f"📄 {filename}"
                        }
                    
                    await self._ws.send(json.dumps(payload))
                except Exception as e:
                    logger.warning(f"Failed to send WhatsApp file {file_path}: {e}")

            # Clean up text
            import re as re2
            text_content = re2.sub(r'\n{3,}', '\n\n', text_content).strip()

            # Send remaining text if any
            if text_content:
                payload = {
                    "type": "send",
                    "to": msg.chat_id,
                    "text": text_content
                }
                await self._ws.send(json.dumps(payload))
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
        finally:
            await self._stop_typing(msg.chat_id)
    
    async def _start_typing(self, chat_id: str) -> None:
        """Start periodic typing indicator for a chat."""
        await self._stop_typing(chat_id)

        async def typing_loop() -> None:
            while self._running and self._ws and self._connected:
                try:
                    payload = json.dumps({
                        "type": "typing",
                        "to": chat_id,
                        "state": "composing"
                    })
                    await self._ws.send(payload)
                except Exception:
                    pass
                await asyncio.sleep(4)

        self._typing_tasks[chat_id] = asyncio.create_task(typing_loop())

    async def _stop_typing(self, chat_id: str) -> None:
        """Stop typing indicator for a chat."""
        task = self._typing_tasks.pop(chat_id, None)
        if task:
            task.cancel()
        # Send paused state
        if self._ws and self._connected:
            try:
                await self._ws.send(json.dumps({
                    "type": "typing",
                    "to": chat_id,
                    "state": "paused"
                }))
            except Exception:
                pass
    
    async def _handle_bridge_message(self, raw: str) -> None:
        """Handle a message from the bridge."""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from bridge: {raw[:100]}")
            return
        
        msg_type = data.get("type")
        
        if msg_type == "message":
            # Incoming message from WhatsApp
            sender = data.get("sender", "")
            content = data.get("content", "")
            
            # sender is typically: <phone>@s.whatsapp.net
            # Extract just the phone number as chat_id
            chat_id = sender.split("@")[0] if "@" in sender else sender
            
            # Handle voice transcription if it's a voice message
            if content == "[Voice Message]":
                logger.info(f"Voice message received from {chat_id}, but direct download from bridge is not yet supported.")
                content = "[Voice Message: Transcription not available for WhatsApp yet]"
            
            await self._handle_message(
                sender_id=chat_id,
                chat_id=sender,  # Use full JID for replies
                content=content,
                metadata={
                    "message_id": data.get("id"),
                    "timestamp": data.get("timestamp"),
                    "is_group": data.get("isGroup", False)
                }
            )
            
            # Start typing indicator while agent processes
            await self._start_typing(sender)
        
        elif msg_type == "status":
            # Connection status update
            status = data.get("status")
            logger.info(f"WhatsApp status: {status}")
            
            if status == "connected":
                self._connected = True
                if self.workspace:
                    qr_path = Path(self.workspace) / "whatsapp_qr.txt"
                    if qr_path.exists():
                        qr_path.unlink()
                        logger.info("WhatsApp QR code file removed")
            elif status == "disconnected":
                self._connected = False
        
        elif msg_type == "qr":
            # QR code for authentication
            qr_string = data.get("qr")
            if qr_string and self.workspace:
                qr_path = Path(self.workspace) / "whatsapp_qr.txt"
                try:
                    qr_path.write_text(qr_string)
                    logger.info(f"WhatsApp QR code written to {qr_path}")
                except Exception as e:
                    logger.error(f"Failed to write WhatsApp QR code: {e}")
            logger.info("Scan QR code in the bridge terminal to connect WhatsApp")
        
        elif msg_type == "error":
            logger.error(f"WhatsApp bridge error: {data.get('error')}")
