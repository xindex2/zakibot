import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import os from 'os';
import { startBot, stopBot, getBotStatus, killAllUserProcesses } from './src/lib/bot-executor.js';
import whopRoutes from './src/routes/webhooks/whop.js';
import creemRoutes from './src/routes/webhooks/creem.js';
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/admin.js';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { encryptSensitiveFields, decryptSensitiveFields, encrypt, decrypt } from './src/lib/crypto.js';
import { getUsageHistory } from './src/lib/usage-tracker.js';

// Fix for ESM/CJS interop (getting jwt.sign)
const jwtSign = (jwt as any).default?.sign || (jwt as any).sign || jwt.sign;
const jwtVerify = (jwt as any).default?.verify || (jwt as any).verify || jwt.verify;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Middleware ---

const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token missing' });

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';

        // Handle both simple userId (legacy) and real JWT
        let userId;
        try {
            const decoded: any = jwtVerify(token, JWT_SECRET);
            userId = decoded.userId;
        } catch (e) {
            // Fallback for demo-token or direct userId if not a valid JWT
            userId = token;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(401).json({ error: 'Invalid user' });

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Requires admin role' });
    }
    next();
};

// --- Public Config (expose Google Client ID to frontend) ---
app.get('/api/auth/config', (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// --- Auth Routes ---

app.post('/api/register', async (req, res) => {
    try {
        const { email, password, full_name, acquisition_source } = req.body;
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        // Hash password with bcrypt (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        let user;
        try {
            user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    full_name: full_name || 'User',
                    acquisition_source: acquisition_source || 'Direct',
                    subscription: {
                        create: {
                            plan: 'Free',
                            maxInstances: 1,
                            creditBalance: 10
                        }
                    }
                },
                include: { subscription: true }
            });
        } catch (createErr: any) {
            if (createErr.message?.includes('creditBalance')) {
                user = await prisma.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        full_name: full_name || 'User',
                        acquisition_source: acquisition_source || 'Direct',
                        subscription: {
                            create: { plan: 'Free', maxInstances: 1 }
                        }
                    },
                    include: { subscription: true }
                });
            } else {
                throw createErr;
            }
        }

        // Auto-login: generate JWT
        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';
        const token = jwtSign(
            { userId: user.id, full_name: user.full_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                avatar_url: (user as any).avatar_url
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Login Route ---

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        // Compare password with bcrypt hash
        // Also support legacy plain-text passwords (auto-migrate on login)
        let passwordMatch = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            // Already hashed
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // Legacy plain-text comparison — migrate to hash
            passwordMatch = (password === user.password);
            if (passwordMatch) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await prisma.user.update({
                    where: { id: user.id },
                    data: { password: hashedPassword }
                });
            }
        }

        if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });

        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';
        const token = jwtSign(
            { userId: user.id, full_name: user.full_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                avatar_url: (user as any).avatar_url
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Bot Config Routes (Multi-Agent) ---

app.get('/api/config', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const configs = await prisma.botConfig.findMany({
            where: { userId: String(userId) }
        });
        // Decrypt sensitive fields before returning to frontend
        const decryptedConfigs = configs.map((c: any) => decryptSensitiveFields(c));
        res.json(decryptedConfigs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/config', async (req, res) => {
    const { userId, id, ...configData } = req.body;
    if (!userId) return res.status(401).json({ error: 'userId is required' });

    try {
        // Allow everyone to save configs (creation is free)
        // Plan limits are enforced when starting/deploying the bot

        // Ensure user exists (demo-user fallback for dev)
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user && userId === 'demo-user') {
            user = await prisma.user.create({
                data: {
                    id: 'demo-user',
                    email: 'demo@openclaw.ai',
                    password: 'demo_password_hash',
                    subscription: { create: { plan: 'Free', maxInstances: 1, creditBalance: 10 } }
                }
            });
        }

        // Whitelist only known BotConfig fields to prevent Prisma unknown-argument errors
        const KNOWN_FIELDS = [
            'name', 'description', 'provider', 'apiKey', 'apiKeyMode', 'apiBase', 'model',
            'telegramEnabled', 'telegramToken', 'telegramAllowFrom',
            'discordEnabled', 'discordToken', 'discordAllowFrom',
            'whatsappEnabled', 'whatsappBridgeUrl', 'whatsappAllowFrom',
            'feishuEnabled', 'feishuAppId', 'feishuAppSecret', 'feishuEncryptKey', 'feishuVerificationToken', 'feishuAllowFrom',
            'slackEnabled', 'slackBotToken', 'slackAppToken', 'slackAllowFrom',
            'webSearchApiKey',
            'githubEnabled', 'githubToken',
            'browserEnabled', 'captchaProvider', 'captchaApiKey',
            'shellEnabled', 'tmuxEnabled', 'restrictToWorkspace',
            'weatherEnabled',
            'summarizeEnabled', 'firecrawlApiKey', 'apifyApiToken',
            'cronEnabled', 'skillCreatorEnabled',
            'gatewayHost', 'gatewayPort', 'maxToolIterations',
            'status'
        ];

        const data: any = { userId };
        for (const key of KNOWN_FIELDS) {
            if (key in configData) {
                data[key] = configData[key];
            }
        }
        // Parse numeric fields
        if (data.gatewayPort) data.gatewayPort = parseInt(data.gatewayPort);
        if (data.maxToolIterations) data.maxToolIterations = parseInt(data.maxToolIterations);

        // Encrypt sensitive fields before saving to database
        const encryptedData = encryptSensitiveFields(data);

        const config = await prisma.botConfig.upsert({
            where: { id: (id && !id.startsWith('temp-')) ? id : 'new-' + Date.now() },
            update: encryptedData,
            create: encryptedData
        });

        // Return decrypted version to frontend
        res.json(decryptSensitiveFields(config as any));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/config/:id', async (req, res) => {
    try {
        await stopBot(req.params.id);
        await prisma.botConfig.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Admin Routes ---

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req: any, res: any) => {
    try {
        const totalUsers = await prisma.user.count();
        const totalAgents = await prisma.botConfig.count();
        const activeAgents = await prisma.botConfig.count({ where: { status: 'running' } });

        const growth = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            growth.push({ date: date.toISOString().split('T')[0], count: Math.floor(Math.random() * 5) + (i === 0 ? 1 : 0) });
        }

        const plans = [
            { plan: 'Free', count: await prisma.subscription.count({ where: { plan: 'Free' } }) },
            { plan: 'Starter', count: await prisma.subscription.count({ where: { plan: 'Starter' } }) },
            { plan: 'Pro', count: await prisma.subscription.count({ where: { plan: 'Pro' } }) },
            { plan: 'Elite', count: await prisma.subscription.count({ where: { plan: 'Elite' } }) },
        ];

        const runningConfigs = await prisma.botConfig.findMany({
            where: { status: 'running' },
            take: 5
        });

        const agentUsage = runningConfigs.map((c: any) => ({
            id: c.id,
            name: c.name,
            subdomain: `${c.id.slice(0, 8)}.bot.local`,
            status: 'running',
            cpu: Math.floor(Math.random() * 15) + 2,
            memory: { percent: Math.floor(Math.random() * 40) + 10, usage: `${Math.floor(Math.random() * 200) + 50}MB` }
        }));

        res.json({
            summary: { totalUsers, totalAgents, activeAgents },
            system: {
                cpu: { usage: Math.floor(os.loadavg()[0] * 10), cores: os.cpus().length, load: os.loadavg().map(l => l.toFixed(2)).join(', ') },
                ram: {
                    percent: Math.floor((1 - os.freemem() / os.totalmem()) * 100),
                    used: `${((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1)}GB`,
                    total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`
                },
                disk: { percent: 45, used: '22GB', total: '50GB' }
            },
            growth,
            plans,
            agentUsage
        });
    } catch (error) {
        console.error('Admin Stats Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req: any, res: any) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                subscription: true as any,
                _count: { select: { configs: true } },
                configs: {
                    select: {
                        id: true,
                        name: true,
                        model: true,
                        telegramEnabled: true,
                        discordEnabled: true,
                        whatsappEnabled: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Bulk bot status check for admin dashboard
app.get('/api/admin/bot-statuses', authenticateToken, isAdmin, async (_req: any, res: any) => {
    try {
        const configs = await prisma.botConfig.findMany({ select: { id: true } });
        const statuses: Record<string, string> = {};
        for (const c of configs) {
            statuses[c.id] = getBotStatus(c.id);
        }
        res.json(statuses);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.use('/api/admin', authenticateToken, isAdmin, adminRoutes);

// --- Bot Control Routes ---

app.use('/api/webhooks/whop', whopRoutes);
app.use('/api/webhooks/creem', creemRoutes);
app.use('/api', authRoutes); // This handles /api/auth/google

// --- Payment Provider ---
app.get('/api/payment-provider', async (req: any, res: any) => {
    try {
        const config = await prisma.systemConfig.findUnique({ where: { key: 'PAYMENT_PROVIDER' } });
        res.json({ provider: config?.value || 'whop' });
    } catch (e: any) {
        res.json({ provider: 'whop' });
    }
});

// --- Creem Plans (public, for billing page) ---
app.get('/api/creem-plans', async (req: any, res: any) => {
    try {
        const plans = await prisma.creemPlan.findMany({ orderBy: { maxInstances: 'asc' } });
        res.json(plans);
    } catch (e: any) {
        res.json([]);
    }
});

app.post('/api/bot/control', authenticateToken, async (req: any, res: any) => {
    const { action, configId } = req.body;
    if (!configId) return res.status(400).json({ error: 'configId is required' });

    try {
        let result;
        if (action === 'start') {
            // Enforce plan limits: free users must upgrade to deploy
            const config = await prisma.botConfig.findUnique({ where: { id: configId }, include: { user: { include: { subscription: true } } } });
            const plan = (config as any)?.user?.subscription?.plan || 'Free';
            if (plan === 'Free') {
                return res.status(403).json({ error: 'UPGRADE_REQUIRED|Upgrade your plan to deploy and run agents.' });
            }
            result = await startBot(configId);
        } else if (action === 'stop') {
            result = await stopBot(configId);
        } else if (action === 'status') {
            result = { status: getBotStatus(configId) };
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/bot/qr/:configId', authenticateToken, async (req: any, res: any) => {
    try {
        const configId = req.params.configId;
        const config = await prisma.botConfig.findUnique({ where: { id: configId } });
        if (!config) return res.status(404).json({ error: 'Config not found' });
        if (config.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const workspacePath = path.join(process.cwd(), 'workspaces', config.userId, config.id);
        const qrPath = path.join(workspacePath, 'whatsapp_qr.txt');

        const authPath = path.join(workspacePath, 'whatsapp-auth', 'creds.json');
        const isLinked = fs.existsSync(authPath);

        // Debug logging to diagnose QR issues
        const bridgeDir = path.join(process.cwd(), '..', 'bridge');
        const bridgeDist = path.join(bridgeDir, 'dist', 'index.js');
        console.log(`[QR Debug] cwd=${process.cwd()}`);
        console.log(`[QR Debug] qrPath=${qrPath} exists=${fs.existsSync(qrPath)}`);
        console.log(`[QR Debug] workspace=${workspacePath} exists=${fs.existsSync(workspacePath)}`);
        console.log(`[QR Debug] bridgeDist=${bridgeDist} exists=${fs.existsSync(bridgeDist)}`);
        if (fs.existsSync(workspacePath)) {
            console.log(`[QR Debug] workspace files: ${fs.readdirSync(workspacePath).join(', ')}`);
        }

        if (fs.existsSync(qrPath)) {
            const qr = fs.readFileSync(qrPath, 'utf-8');
            console.log(`[QR Debug] QR found, length=${qr.length}`);
            res.json({ qr, linked: isLinked });
        } else {
            console.log(`[QR Debug] NO QR FILE - bridge may not be running`);
            res.json({ qr: null, linked: isLinked });
        }
    } catch (error) {
        console.error('[QR Debug] Error:', error);
        res.status(500).json({ error: 'Failed to fetch QR' });
    }
});

// Force-refresh WhatsApp QR by deleting the stale QR file
app.post('/api/bot/qr-refresh/:configId', authenticateToken, async (req: any, res: any) => {
    try {
        const configId = req.params.configId;
        const config = await prisma.botConfig.findUnique({ where: { id: configId } });
        if (!config) return res.status(404).json({ error: 'Config not found' });
        if (config.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const workspacePath = path.join(process.cwd(), 'workspaces', config.userId, config.id);
        const qrPath = path.join(workspacePath, 'whatsapp_qr.txt');
        // Also delete auth session so a fresh QR is generated
        const authDir = path.join(workspacePath, 'whatsapp-auth');

        // Delete old QR file
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath);
        }
        // Delete auth session to force re-scan
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
        }

        // Restart the bot to regenerate QR
        try {
            await stopBot(configId);
            await new Promise(r => setTimeout(r, 1500));
            await startBot(configId);
        } catch (e) { }

        res.json({ success: true, message: 'QR refresh initiated. Please wait a moment for new QR.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh QR' });
    }
});

// Dynamic model fetching — proxy to provider APIs using user's API key
app.post('/api/models/fetch', authenticateToken, async (req: any, res: any) => {
    try {
        let { provider, apiKey, apiKeyMode } = req.body;

        // If platform credits mode, use the admin's OpenRouter API key
        if (apiKeyMode === 'platform_credits' || (!apiKey && !provider)) {
            const platformKeyConfig = await prisma.systemConfig.findUnique({
                where: { key: 'OPENROUTER_API_KEY' }
            });
            if (platformKeyConfig?.value) {
                apiKey = decrypt(platformKeyConfig.value);
                provider = 'openrouter';
            } else {
                return res.status(400).json({ error: 'Platform credits not configured. Contact admin.' });
            }
        }

        if (!apiKey) return res.status(400).json({ error: 'API key required' });

        // Map provider to their models endpoint
        const providerEndpoints: Record<string, string> = {
            openrouter: 'https://openrouter.ai/api/v1/models',
            openai: 'https://api.openai.com/v1/models',
            anthropic: 'https://api.anthropic.com/v1/models',
            deepseek: 'https://api.deepseek.com/v1/models',
            groq: 'https://api.groq.com/openai/v1/models',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
            google: 'https://generativelanguage.googleapis.com/v1beta/models',
            xai: 'https://api.x.ai/v1/models',
            mistral: 'https://api.mistral.ai/v1/models',
        };

        const endpoint = providerEndpoints[provider];
        if (!endpoint) {
            return res.json({ models: [], error: `No model endpoint known for provider: ${provider}. Use a custom model ID.` });
        }

        // Build headers — Anthropic uses a different auth format
        const headers: Record<string, string> = {};
        if (provider === 'anthropic') {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
        } else if (provider === 'gemini' || provider === 'google') {
            // Google uses query param, handled below
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const url = (provider === 'gemini' || provider === 'google')
            ? `${endpoint}?key=${apiKey}`
            : endpoint;

        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            return res.json({ models: [], error: `Provider returned ${response.status}: ${errText.substring(0, 200)}` });
        }

        const body = await response.json();

        // Normalize response — each provider returns data differently
        let models: { id: string; name: string; promptPrice?: number; completionPrice?: number }[] = [];
        if (provider === 'gemini' || provider === 'google') {
            models = (body.models || []).map((m: any) => ({
                id: m.name?.replace('models/', '') || m.name,
                name: m.displayName || m.name,
            }));
        } else if (provider === 'anthropic') {
            models = (body.data || []).map((m: any) => ({
                id: m.id,
                name: m.display_name || m.id,
            }));
        } else if (provider === 'openrouter') {
            // OpenRouter includes pricing data
            models = (body.data || []).map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
                promptPrice: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : undefined,
                completionPrice: m.pricing?.completion ? parseFloat(m.pricing.completion) : undefined,
            }));
        } else {
            // OpenAI-compatible format (OpenAI, DeepSeek, Groq, xAI, Mistral)
            models = (body.data || []).map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
            }));
        }

        models.sort((a, b) => a.name.localeCompare(b.name));
        res.json({ models });
    } catch (error: any) {
        res.json({ models: [], error: error.message || 'Failed to fetch models' });
    }
});

// Credit usage history
app.get('/api/credits/usage', authenticateToken, async (req: any, res: any) => {
    try {
        const history = await getUsageHistory(req.user.id, 100);
        res.json({ transactions: history });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/subscription', authenticateToken, async (req: any, res: any) => {
    try {
        const sub = await prisma.subscription.findUnique({
            where: { userId: req.user.id }
        });
        const count = await prisma.botConfig.count({
            where: { userId: req.user.id }
        });
        // Check if any bot uses platform_credits
        const creditsBots = await prisma.botConfig.count({
            where: { userId: req.user.id, apiKeyMode: 'platform_credits' }
        });
        res.json({
            ...sub,
            currentCount: count,
            creditBalance: sub?.creditBalance ?? 0,
            hasCreditsBots: creditsBots > 0
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Credits System ---

// User tops up their own credits ($10 increments)
app.post('/api/credits/topup', authenticateToken, async (req: any, res: any) => {
    try {
        const amount = 10; // Fixed $10 top-up
        const sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
        if (!sub) return res.status(400).json({ error: 'No subscription found' });

        await prisma.subscription.update({
            where: { userId: req.user.id },
            data: { creditBalance: (sub.creditBalance || 0) + amount }
        });

        await prisma.creditTransaction.create({
            data: {
                userId: req.user.id,
                amount,
                type: 'topup',
                description: `Self-service top-up of $${amount}`
            }
        });

        res.json({ success: true, newBalance: (sub.creditBalance || 0) + amount });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Credit balance
app.get('/api/credits/balance', authenticateToken, async (req: any, res: any) => {
    try {
        const sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
        res.json({ balance: sub?.creditBalance ?? 0 });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Credit history
app.get('/api/credits/history', authenticateToken, async (req: any, res: any) => {
    try {
        const transactions = await prisma.creditTransaction.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(transactions);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Dynamic Model Catalog (inspired by OpenClaw's model-scan.ts) ---

let modelCache: { data: any[]; fetchedAt: number } | null = null;
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

app.get('/api/models', async (req: any, res: any) => {
    try {
        // Return cached data if still fresh
        if (modelCache && Date.now() - modelCache.fetchedAt < MODEL_CACHE_TTL) {
            return res.json({ models: modelCache.data, cached: true });
        }

        // Fetch from OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'HTTP-Referer': 'https://openclaw.ai' }
        });

        if (!response.ok) {
            return res.json({ models: [], cached: false, error: 'OpenRouter API unavailable' });
        }

        const { data } = await response.json() as { data: any[] };
        const models = (data || [])
            .filter((m: any) => m.id && m.name)
            .map((m: any) => ({
                id: m.id,
                name: m.name,
                provider: m.id.split('/')[0] || 'unknown',
                ctx: m.context_length ? `${Math.round(m.context_length / 1000)}K` : '?',
                contextLength: m.context_length || 0,
                pricing: m.pricing ? {
                    prompt: m.pricing.prompt,
                    completion: m.pricing.completion,
                } : null,
            }))
            .sort((a: any, b: any) => (b.contextLength || 0) - (a.contextLength || 0));

        modelCache = { data: models, fetchedAt: Date.now() };
        res.json({ models, cached: false });
    } catch (error) {
        console.error('Model fetch error:', error);
        // Return cached data even if stale, or empty array
        if (modelCache) {
            return res.json({ models: modelCache.data, cached: true, stale: true });
        }
        res.json({ models: [], cached: false, error: 'Failed to fetch models' });
    }
});

// --- Workspace File Manager API ---
import multer from 'multer';
const upload = multer({ dest: '/tmp/workspace-uploads', limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// Helper: resolve workspace path safely
function resolveWorkspace(userId: string, configId: string, filePath?: string) {
    const workspaceRoot = path.resolve(path.join(process.cwd(), 'workspaces'));
    const base = path.join(workspaceRoot, userId, configId);
    if (filePath) {
        const full = path.resolve(path.join(base, filePath));
        if (!full.startsWith(workspaceRoot)) return null; // path traversal blocked
        return { base, full };
    }
    return { base, full: base };
}

// List files in workspace
app.get('/api/workspace/:configId', authenticateToken, async (req: any, res: any) => {
    try {
        const config = await prisma.botConfig.findUnique({ where: { id: req.params.configId } });
        if (!config || config.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const ws = resolveWorkspace(config.userId, config.id);
        if (!ws) return res.status(403).json({ error: 'Forbidden' });

        if (!fs.existsSync(ws.base)) {
            fs.mkdirSync(ws.base, { recursive: true });
            return res.json({ files: [], path: '/' });
        }

        const subPath = (req.query.path as string) || '';
        const targetDir = subPath ? path.resolve(path.join(ws.base, subPath)) : ws.base;
        if (!targetDir.startsWith(ws.base)) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const files = entries.map(entry => {
            const fullPath = path.join(targetDir, entry.name);
            const stat = fs.statSync(fullPath);
            const relPath = path.relative(ws.base, fullPath);
            return {
                name: entry.name,
                path: relPath,
                isDirectory: entry.isDirectory(),
                size: stat.size,
                modified: stat.mtime.toISOString(),
                extension: entry.isFile() ? path.extname(entry.name).toLowerCase().slice(1) : null,
            };
        }).sort((a, b) => {
            // Directories first, then alphabetical
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        res.json({ files, path: subPath || '/' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list workspace' });
    }
});

// Upload files to workspace
app.post('/api/workspace/:configId/upload', authenticateToken, upload.array('files', 20), async (req: any, res: any) => {
    try {
        const config = await prisma.botConfig.findUnique({ where: { id: req.params.configId } });
        if (!config || config.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const subPath = req.body.path || '';
        const ws = resolveWorkspace(config.userId, config.id, subPath);
        if (!ws) return res.status(403).json({ error: 'Forbidden' });

        const targetDir = subPath ? ws.full : ws.base;
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const uploaded: string[] = [];
        for (const file of (req.files || [])) {
            const dest = path.join(targetDir, file.originalname);
            // Security check
            if (!path.resolve(dest).startsWith(ws.base)) continue;
            fs.renameSync(file.path, dest);
            uploaded.push(file.originalname);
        }

        res.json({ success: true, uploaded });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// Create a text file in workspace
app.post('/api/workspace/:configId/create', authenticateToken, async (req: any, res: any) => {
    try {
        const config = await prisma.botConfig.findUnique({ where: { id: req.params.configId } });
        if (!config || config.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const { filename, content, directory } = req.body;
        if (!filename) return res.status(400).json({ error: 'Filename required' });

        const subPath = directory ? path.join(directory, filename) : filename;
        const ws = resolveWorkspace(config.userId, config.id, subPath);
        if (!ws) return res.status(403).json({ error: 'Forbidden' });

        // Create parent directory if needed
        const dir = path.dirname(ws.full);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(ws.full, content || '');
        res.json({ success: true, path: subPath });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create file' });
    }
});

// Delete a file/folder from workspace
app.delete('/api/workspace/:configId/*', authenticateToken, async (req: any, res: any) => {
    try {
        const config = await prisma.botConfig.findUnique({ where: { id: req.params.configId } });
        if (!config || config.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const filePath = req.params[0];
        if (!filePath) return res.status(400).json({ error: 'File path required' });

        const ws = resolveWorkspace(config.userId, config.id, filePath);
        if (!ws) return res.status(403).json({ error: 'Forbidden' });

        if (!fs.existsSync(ws.full)) return res.status(404).json({ error: 'File not found' });

        const stat = fs.statSync(ws.full);
        if (stat.isDirectory()) {
            fs.rmSync(ws.full, { recursive: true, force: true });
        } else {
            fs.unlinkSync(ws.full);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});
// --- Serve workspace files (screenshots, etc.) ---
app.get('/api/files/:userId/:configId/*', async (req: any, res: any) => {
    try {
        const { userId, configId } = req.params;
        const filePath = req.params[0]; // everything after configId/
        const fullPath = path.join(process.cwd(), 'workspaces', userId, configId, filePath);

        // Security: prevent path traversal
        const normalizedPath = path.resolve(fullPath);
        const workspaceRoot = path.resolve(path.join(process.cwd(), 'workspaces'));
        if (!normalizedPath.startsWith(workspaceRoot)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (!fs.existsSync(normalizedPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.sendFile(normalizedPath);
    } catch (error) {
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

// --- Serve Frontend ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For all other routes, serve index.html (SPA routing)
app.get('*', (req, res, next) => {
    // Skip if it's an API route
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 OpenClaw Host Backend running on http://localhost:${PORT}`);
    console.log(`📂 Serving static files from: ${distPath}`);
});
