// Bot executor logic for managing nanobot instances
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { decryptSensitiveFields, decrypt } from './crypto.js';
import { deductCredits } from './usage-tracker.js';

const prisma = new PrismaClient();
// Process cache keyed by BOT CONFIG ID
const processes: Record<string, { bot: ChildProcess, bridge?: ChildProcess }> = {};

// --- Auto-restart tracking for paid bots ---
interface RestartState { count: number; firstAttemptAt: number; }
const restartState: Record<string, RestartState> = {};
const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RESTART_DELAY_MS = 5000; // 5 seconds before restart

async function autoRestartBot(configId: string, botName: string): Promise<void> {
    const now = Date.now();
    let state = restartState[configId];

    // Reset window if expired
    if (state && (now - state.firstAttemptAt) > RESTART_WINDOW_MS) {
        delete restartState[configId];
        state = undefined as any;
    }

    // Initialize tracking
    if (!state) {
        restartState[configId] = { count: 0, firstAttemptAt: now };
        state = restartState[configId];
    }

    state.count++;

    if (state.count > MAX_RESTARTS) {
        console.error(`[AutoRestart] Bot "${botName}" (${configId}) exceeded ${MAX_RESTARTS} restarts in ${RESTART_WINDOW_MS / 60000}min — giving up.`);
        await prisma.botConfig.update({
            where: { id: configId },
            data: { status: 'stopped' }
        }).catch(() => { });
        return;
    }

    console.log(`[AutoRestart] Bot "${botName}" crashed, restarting in ${RESTART_DELAY_MS / 1000}s (attempt ${state.count}/${MAX_RESTARTS})...`);

    await new Promise(resolve => setTimeout(resolve, RESTART_DELAY_MS));

    try {
        await startBot(configId);
        console.log(`[AutoRestart] Bot "${botName}" restarted successfully.`);
    } catch (err: any) {
        console.error(`[AutoRestart] Failed to restart bot "${botName}":`, err.message);
        await prisma.botConfig.update({
            where: { id: configId },
            data: { status: 'stopped' }
        }).catch(() => { });
    }
}

// --- OpenRouter model pricing cache ---
interface ModelPricing { prompt: number; completion: number; }
let pricingCache: Record<string, ModelPricing> = {};
let pricingCacheTime = 0;
const PRICING_CACHE_TTL = 3600_000; // 1 hour

async function fetchOpenRouterPricing(): Promise<void> {
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        const json = await res.json() as any;
        const newCache: Record<string, ModelPricing> = {};
        for (const model of json.data || []) {
            if (model.id && model.pricing) {
                newCache[model.id] = {
                    prompt: parseFloat(model.pricing.prompt) || 0,
                    completion: parseFloat(model.pricing.completion) || 0,
                };
            }
        }
        pricingCache = newCache;
        pricingCacheTime = Date.now();
        console.log(`[Pricing] Cached pricing for ${Object.keys(newCache).length} models`);
    } catch (err: any) {
        console.error('[Pricing] Failed to fetch OpenRouter pricing:', err.message);
    }
}

async function getModelPricing(modelId: string): Promise<ModelPricing> {
    // Refresh cache if stale or empty
    if (Date.now() - pricingCacheTime > PRICING_CACHE_TTL || Object.keys(pricingCache).length === 0) {
        await fetchOpenRouterPricing();
    }
    if (pricingCache[modelId]) {
        return pricingCache[modelId];
    }
    // Fallback: very conservative rates if model not found
    console.warn(`[Pricing] Model "${modelId}" not found in cache, using fallback rates`);
    return { prompt: 0.000001, completion: 0.000002 }; // $1/$2 per 1M
}

export async function startBot(configId: string) {
    try {
        // Cleanup existing processes with this config ID in command line
        const killCmd = `pkill -f "nanobot.*${configId}.json" > /dev/null 2>&1 || true`;
        execSync(killCmd, { stdio: 'ignore' });
        // Wait for old process (and its Telegram polling) to fully release
        await new Promise(resolve => setTimeout(resolve, 3000));
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

    // Decrypt all sensitive fields from database
    const decryptedConfig = decryptSensitiveFields(config as any) as typeof config;

    // Determine which API key to use based on apiKeyMode
    const apiKeyMode = (decryptedConfig as any).apiKeyMode || 'own_key';
    let effectiveProvider = decryptedConfig.provider;
    let effectiveApiKey = decryptedConfig.apiKey;

    // Normalize provider names to match Python ProvidersConfig field names
    // Dashboard may store "google" but Python schema expects "gemini"
    const PROVIDER_ALIAS_MAP: Record<string, string> = { google: 'gemini' };
    effectiveProvider = PROVIDER_ALIAS_MAP[effectiveProvider] || effectiveProvider;

    if (apiKeyMode === 'platform_credits') {
        // Fetch the admin's OpenRouter API key from SystemConfig
        const platformKeyConfig = await prisma.systemConfig.findUnique({
            where: { key: 'OPENROUTER_API_KEY' }
        });
        if (!platformKeyConfig?.value) {
            throw new Error('Platform credits mode is enabled but no OpenRouter API key is configured by the admin.');
        }
        effectiveProvider = 'openrouter';
        effectiveApiKey = decrypt(platformKeyConfig.value);
    }

    // Create temporary config file
    const configsDir = path.join(process.cwd(), 'configs');
    if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });

    const configPath = path.join(configsDir, `${decryptedConfig.id}.json`);
    const workspacePath = path.join(process.cwd(), 'workspaces', decryptedConfig.userId, decryptedConfig.id);
    if (!fs.existsSync(workspacePath)) fs.mkdirSync(workspacePath, { recursive: true });

    // Assign bridge port based on gateway port
    const gatewayPort = decryptedConfig.gatewayPort || 18790;
    const bridgePort = gatewayPort + 1;
    const bridgeUrl = `ws://localhost:${bridgePort}`;

    // Build Nanobot configuration object
    const nanobotConfig: any = {
        providers: {
            [effectiveProvider]: {
                api_key: effectiveApiKey,
                api_base: config.apiBase
            }
        },
        agents: {
            defaults: {
                model: decryptedConfig.model,
                workspace: workspacePath,
                max_tool_iterations: decryptedConfig.maxToolIterations || 20,
                plan: (decryptedConfig as any).user?.subscription?.plan?.toLowerCase() || "free"
            }
        },
        channels: {
            telegram: {
                enabled: decryptedConfig.telegramEnabled,
                token: decryptedConfig.telegramToken || "",
                allow_from: (decryptedConfig as any).telegramAllowFrom ? (decryptedConfig as any).telegramAllowFrom.split(',').map((s: string) => s.trim()) : []
            },
            discord: {
                enabled: decryptedConfig.discordEnabled,
                token: decryptedConfig.discordToken || "",
                allow_from: (decryptedConfig as any).discordAllowFrom ? (decryptedConfig as any).discordAllowFrom.split(',').map((s: string) => s.trim()) : [],
                gateway_url: "wss://gateway.discord.gg/?v=10&encoding=json",
                intents: 37377
            },
            whatsapp: {
                enabled: decryptedConfig.whatsappEnabled,
                bridge_url: bridgeUrl,
                allow_from: (decryptedConfig as any).whatsappAllowFrom ? (decryptedConfig as any).whatsappAllowFrom.split(',').map((s: string) => s.trim()) : []
            },
            feishu: {
                enabled: decryptedConfig.feishuEnabled,
                app_id: decryptedConfig.feishuAppId || "",
                app_secret: decryptedConfig.feishuAppSecret || "",
                encrypt_key: decryptedConfig.feishuEncryptKey || "",
                verification_token: decryptedConfig.feishuVerificationToken || "",
                allow_from: (decryptedConfig as any).feishuAllowFrom ? (decryptedConfig as any).feishuAllowFrom.split(',').map((s: string) => s.trim()) : []
            },
            slack: {
                enabled: (decryptedConfig as any).slackEnabled || false,
                bot_token: (decryptedConfig as any).slackBotToken || "",
                app_token: (decryptedConfig as any).slackAppToken || "",
                allow_from: (decryptedConfig as any).slackAllowFrom ? (decryptedConfig as any).slackAllowFrom.split(',').map((s: string) => s.trim()) : []
            }
        },
        tools: {
            web: {
                search: {
                    api_key: decryptedConfig.webSearchApiKey || process.env.BRAVE_API_KEY || ""
                }
            },
            browser: {
                enabled: decryptedConfig.browserEnabled,
                max_tool_retries: 3,
                captcha_provider: (decryptedConfig as any).captchaProvider || "",
                captcha_api_key: (decryptedConfig as any).captchaApiKey || "",
                proxy_url: (decryptedConfig as any).proxyUrl || ""
            },
            exec: {
                enabled: decryptedConfig.shellEnabled
            },
            restrict_to_workspace: decryptedConfig.restrictToWorkspace || false
        },
        gateway: {
            host: decryptedConfig.gatewayHost || "0.0.0.0",
            port: gatewayPort
        }
    };

    // ── Channel validation: auto-disable channels with missing credentials ──
    const ch = nanobotConfig.channels;
    if (ch.telegram.enabled && !ch.telegram.token) {
        ch.telegram.enabled = false;
        console.log(`   ⚠️  [${config.name}] Telegram auto-disabled (no token)`);
    }
    if (ch.discord.enabled && !ch.discord.token) {
        ch.discord.enabled = false;
        console.log(`   ⚠️  [${config.name}] Discord auto-disabled (no token)`);
    }
    if (ch.feishu.enabled && (!ch.feishu.app_id || !ch.feishu.app_secret)) {
        ch.feishu.enabled = false;
        console.log(`   ⚠️  [${config.name}] Feishu auto-disabled (missing app_id or app_secret)`);
    }
    if (ch.slack.enabled && !ch.slack.bot_token) {
        ch.slack.enabled = false;
        console.log(`   ⚠️  [${config.name}] Slack auto-disabled (no bot_token)`);
    }

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



        // Auto-install bridge dependencies if node_modules missing
        const bridgeNodeModules = path.join(bridgeDir, 'node_modules');
        if (!fs.existsSync(bridgeNodeModules)) {

            try {
                execSync('npm install', { cwd: bridgeDir, stdio: 'pipe', timeout: 120000 });

            } catch (installErr: any) {
                console.error(`[Bridge ${config.name}]: npm install failed:`, installErr.stderr?.toString() || installErr.message);
            }
        }

        // Always rebuild bridge to ensure compiled code matches source
        const bridgeDistEntry = path.join(bridgeDir, 'dist', 'index.js');

        try {
            execSync('npx tsc', { cwd: bridgeDir, stdio: 'pipe', timeout: 30000 });

        } catch (buildErr: any) {
            console.error(`[Bridge ${config.name}]: Failed to build bridge:`, buildErr.stderr?.toString() || buildErr.message);
        }

        // Verify dist exists before spawning
        if (!fs.existsSync(bridgeDistEntry)) {
            console.error(`[Bridge ${config.name}]: FATAL - dist/index.js still missing after build attempt. Bridge will NOT start.`);
        } else {


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


            bridge.stderr?.on('data', (data: any) => console.error(`[Bridge error ${config.name}]: ${data}`));

            bridge.on('error', (err) => {
                console.error(`[Bridge ${config.name}]: SPAWN ERROR:`, err.message);
            });

            bridge.on('close', (code) => {

                if (code !== 0) {
                    console.error(`[Bridge ${config.name}]: Bridge crashed! Check bridge dependencies with: cd ${bridgeDir} && npm install`);
                }
            });

            processes[configId].bridge = bridge;
        }
    }

    // Capture current bridge reference so close handler doesn't kill a NEW bridge on restart
    const currentBridge = processes[configId].bridge;

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
            ENABLE_TMUX: config.tmuxEnabled ? "true" : "false",
            ENABLE_CRON: (config as any).cronEnabled ? "true" : "false",
            ENABLE_SKILL_CREATOR: (config as any).skillCreatorEnabled ? "true" : "false",
            // Credit pre-check: bot will call back to platform to verify credits
            ...(apiKeyMode === 'platform_credits' && config.userId ? {
                PLATFORM_URL: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
                CREDIT_USER_ID: config.userId,
            } : {}),
        }
    });


    // Parse stdout for [USAGE] lines to track platform credit consumption
    child.stdout?.on('data', (data: any) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            if (line.startsWith('[USAGE]')) {
                try {
                    const usageJson = JSON.parse(line.substring(8));
                    if (apiKeyMode === 'platform_credits' && config.userId) {
                        // Get real pricing for this model and deduct
                        getModelPricing(usageJson.model).then(pricing => {
                            const cost = (usageJson.prompt_tokens * pricing.prompt) + (usageJson.completion_tokens * pricing.completion);
                            if (cost > 0) {
                                console.log(`[Credits ${config.name}]: ${usageJson.model} - ${usageJson.prompt_tokens} in / ${usageJson.completion_tokens} out = $${cost.toFixed(6)}`);
                                deductCredits(
                                    config.userId!,
                                    cost,
                                    `${usageJson.model}: ${usageJson.prompt_tokens} in / ${usageJson.completion_tokens} out ($${cost.toFixed(6)})`
                                ).catch((err: any) => {
                                    console.error(`[Credits ${config.name}]: Deduction failed:`, err.message);
                                });
                            }
                        }).catch((err: any) => {
                            console.error(`[Credits ${config.name}]: Pricing lookup failed:`, err.message);
                        });
                    }
                } catch (e) { /* skip malformed usage lines */ }
            }
        }
    });

    child.stderr?.on('data', (data: any) => console.log(`[Bot log ${config.name}]: ${data}`));

    child.on('close', async (code: any) => {
        const botName = config.name || configId;

        // Only kill the bridge that was spawned WITH this bot, not a newer one
        if (currentBridge && processes[configId]?.bridge === currentBridge) {
            currentBridge.kill('SIGTERM');
            delete processes[configId];
        }

        // Check if user has a paid plan — auto-restart if so
        try {
            const freshConfig = await prisma.botConfig.findUnique({
                where: { id: configId },
                include: { user: { include: { subscription: true } } }
            });
            const plan = (freshConfig as any)?.user?.subscription?.plan || 'Free';

            if (plan !== 'Free' && code !== 0) {
                // Paid user and abnormal exit — auto-restart
                await prisma.botConfig.update({
                    where: { id: configId },
                    data: { status: 'restarting' }
                }).catch(() => { });
                autoRestartBot(configId, botName).catch(console.error);
                return;
            }
        } catch (e) {
            // DB lookup failed, fall through to normal stopped
        }

        await prisma.botConfig.update({
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
        delete processes[configId];
        // Wait for processes to fully exit before allowing restart
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            p.bot.kill('SIGKILL');
            p.bridge?.kill('SIGKILL');
        } catch (e) { }
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
