// Bot executor logic for managing nanobot instances
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// Process cache keyed by BOT CONFIG ID
const processes: Record<string, { bot: ChildProcess, bridge?: ChildProcess }> = {};

export async function startBot(configId: string) {
    try {
        // Cleanup existing processes with this config ID in command line
        const killCmd = `pkill -f "nanobot.*${configId}.json" > /dev/null 2>&1 || true`;
        execSync(killCmd, { stdio: 'ignore' });
    } catch (e) { }

    if (processes[configId]) {
        try {
            processes[configId].bot.kill('SIGKILL');
            processes[configId].bridge?.kill('SIGKILL');
            delete processes[configId];
        } catch (e) { }
    }

    const config = await prisma.botConfig.findUnique({
        where: { id: configId },
        include: { user: { include: { subscription: true } } }
    });
    if (!config) throw new Error('Bot configuration not found.');

    // Create temporary config file
    const configsDir = path.join(process.cwd(), 'configs');
    if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });

    const configPath = path.join(configsDir, `${config.id}.json`);
    const workspacePath = path.join(process.cwd(), 'workspaces', config.userId, config.id);
    if (!fs.existsSync(workspacePath)) fs.mkdirSync(workspacePath, { recursive: true });

    // Assign bridge port based on gateway port
    const gatewayPort = config.gatewayPort || 18790;
    const bridgePort = gatewayPort + 1;
    const bridgeUrl = `ws://localhost:${bridgePort}`;

    // Build Nanobot configuration object
    const nanobotConfig: any = {
        providers: {
            [config.provider]: {
                api_key: config.apiKey,
                api_base: config.apiBase
            }
        },
        agents: {
            defaults: {
                model: config.model,
                workspace: workspacePath,
                max_tool_iterations: config.maxToolIterations || 20,
                plan: (config as any).user?.subscription?.plan?.toLowerCase() || "free"
            }
        },
        channels: {
            telegram: {
                enabled: config.telegramEnabled,
                token: config.telegramToken || "",
                allow_from: (config as any).telegramAllowFrom ? (config as any).telegramAllowFrom.split(',').map((s: string) => s.trim()) : []
            },
            discord: {
                enabled: config.discordEnabled,
                token: config.discordToken || "",
                allow_from: (config as any).discordAllowFrom ? (config as any).discordAllowFrom.split(',').map((s: string) => s.trim()) : [],
                gateway_url: "wss://gateway.discord.gg/?v=10&encoding=json",
                intents: 37377
            },
            whatsapp: {
                enabled: config.whatsappEnabled,
                bridge_url: bridgeUrl,
                allow_from: (config as any).whatsappAllowFrom ? (config as any).whatsappAllowFrom.split(',').map((s: string) => s.trim()) : []
            },
            feishu: {
                enabled: config.feishuEnabled,
                app_id: config.feishuAppId || "",
                app_secret: config.feishuAppSecret || "",
                encrypt_key: config.feishuEncryptKey || "",
                verification_token: config.feishuVerificationToken || "",
                allow_from: (config as any).feishuAllowFrom ? (config as any).feishuAllowFrom.split(',').map((s: string) => s.trim()) : []
            }
        },
        tools: {
            web: {
                search: {
                    api_key: config.webSearchApiKey || process.env.BRAVE_API_KEY || ""
                }
            },
            browser: {
                enabled: config.browserEnabled,
                max_tool_retries: 3
            },
            exec: {
                enabled: config.shellEnabled
            },
            restrict_to_workspace: config.restrictToWorkspace || false
        },
        gateway: {
            host: config.gatewayHost || "0.0.0.0",
            port: gatewayPort
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(nanobotConfig, null, 2));

    const nanobotRoot = path.join(process.cwd(), '..');
    const env = { ...process.env };

    // Detect python binary (prefer venv if exists)
    let pythonPath = 'python3';
    const venvBin = path.join(nanobotRoot, 'venv', 'bin');
    const venvPython = path.join(venvBin, 'python3');

    if (fs.existsSync(venvPython)) {
        pythonPath = venvPython;
        env.PATH = `${venvBin}:${process.env.PATH}`;
    }

    // Initialize process record
    processes[configId] = { bot: null as any };

    // Start WhatsApp Bridge if enabled
    if (config.whatsappEnabled) {
        const bridgeDir = path.join(nanobotRoot, 'bridge');
        const authDir = path.join(workspacePath, 'whatsapp-auth');
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const qrFilePath = path.join(workspacePath, 'whatsapp_qr.txt');

        console.log(`[Bridge ${config.name}]: bridgeDir=${bridgeDir}`);
        console.log(`[Bridge ${config.name}]: bridgePort=${bridgePort}`);
        console.log(`[Bridge ${config.name}]: authDir=${authDir}`);
        console.log(`[Bridge ${config.name}]: qrFilePath=${qrFilePath}`);

        // Auto-install bridge dependencies if node_modules missing
        const bridgeNodeModules = path.join(bridgeDir, 'node_modules');
        if (!fs.existsSync(bridgeNodeModules)) {
            console.log(`[Bridge ${config.name}]: node_modules not found, running npm install...`);
            try {
                execSync('npm install', { cwd: bridgeDir, stdio: 'pipe', timeout: 120000 });
                console.log(`[Bridge ${config.name}]: npm install completed`);
            } catch (installErr: any) {
                console.error(`[Bridge ${config.name}]: npm install failed:`, installErr.stderr?.toString() || installErr.message);
            }
        }

        // Auto-build bridge if dist doesn't exist
        const bridgeDistEntry = path.join(bridgeDir, 'dist', 'index.js');
        if (!fs.existsSync(bridgeDistEntry)) {
            console.log(`[Bridge ${config.name}]: dist/index.js not found, building bridge...`);
            try {
                execSync('npx tsc', { cwd: bridgeDir, stdio: 'pipe', timeout: 30000 });
                console.log(`[Bridge ${config.name}]: Bridge built successfully`);
            } catch (buildErr: any) {
                console.error(`[Bridge ${config.name}]: Failed to build bridge:`, buildErr.stderr?.toString() || buildErr.message);
            }
        }

        // Verify dist exists before spawning
        if (!fs.existsSync(bridgeDistEntry)) {
            console.error(`[Bridge ${config.name}]: FATAL - dist/index.js still missing after build attempt. Bridge will NOT start.`);
        } else {
            console.log(`[Bridge ${config.name}]: Starting bridge on port ${bridgePort}...`);

            // Start bridge
            const bridge = spawn('node', ['dist/index.js'], {
                cwd: bridgeDir,
                env: {
                    ...process.env,
                    BRIDGE_PORT: bridgePort.toString(),
                    AUTH_DIR: authDir,
                    QR_FILE_PATH: qrFilePath
                }
            });

            bridge.stdout?.on('data', (data: any) => console.log(`[Bridge ${config.name}]: ${data}`));
            bridge.stderr?.on('data', (data: any) => console.error(`[Bridge error ${config.name}]: ${data}`));

            bridge.on('error', (err) => {
                console.error(`[Bridge ${config.name}]: SPAWN ERROR:`, err.message);
            });

            bridge.on('close', (code) => {
                console.log(`[Bridge ${config.name}]: Process exited with code ${code}`);
                if (code !== 0) {
                    console.error(`[Bridge ${config.name}]: Bridge crashed! Check bridge dependencies with: cd ${bridgeDir} && npm install`);
                }
            });

            processes[configId].bridge = bridge;
        }
    }

    // Spawn nanobot
    const child = spawn(pythonPath, ['-m', 'nanobot', 'gateway'], {
        cwd: nanobotRoot,
        env: {
            ...env,
            NANOBOT_CONFIG: configPath,
            NANOBOT_WORKSPACE: workspacePath,
            GITHUB_TOKEN: config.githubToken || env.GITHUB_TOKEN,
            FIRECRAWL_API_KEY: config.firecrawlApiKey || env.FIRECRAWL_API_KEY,
            APIFY_API_TOKEN: config.apifyApiToken || env.APIFY_API_TOKEN,
            ENABLE_WEATHER: config.weatherEnabled ? "true" : "false",
            ENABLE_SUMMARIZE: config.summarizeEnabled ? "true" : "false",
            ENABLE_TMUX: config.tmuxEnabled ? "true" : "false"
        }
    });

    child.stdout?.on('data', (data) => console.log(`[Bot ${config.name}]: ${data}`));
    child.stderr?.on('data', (data) => console.error(`[Bot error ${config.name}]: ${data}`));

    child.on('close', (code) => {
        console.log(`[Bot ${config.name}] stopped with code ${code}`);
        processes[configId]?.bridge?.kill('SIGTERM');
        delete processes[configId];
        prisma.botConfig.update({
            where: { id: configId },
            data: { status: 'stopped' }
        }).catch(console.error);
    });

    processes[configId].bot = child;

    await prisma.botConfig.update({
        where: { id: configId },
        data: { status: 'running' }
    });

    return { success: true };
}

export async function stopBot(configId: string) {
    try {
        execSync(`pkill -f "nanobot.*${configId}.json" > /dev/null 2>&1 || true`, { stdio: 'ignore' });
    } catch (e) { }

    const p = processes[configId];
    if (p) {
        p.bot.kill('SIGTERM');
        p.bridge?.kill('SIGTERM');
        setTimeout(() => {
            try {
                p.bot.kill('SIGKILL');
                p.bridge?.kill('SIGKILL');
            } catch (e) { }
        }, 1000);
        delete processes[configId];
    }

    await prisma.botConfig.update({
        where: { id: configId },
        data: { status: 'stopped' }
    });

    return { success: true };
}

export function getBotStatus(configId: string) {
    return processes[configId] ? 'running' : 'stopped';
}

export async function killAllUserProcesses(userId: string) {
    const configs = await prisma.botConfig.findMany({ where: { userId } });
    for (const config of configs) {
        await stopBot(config.id);
    }
}
