import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import os from 'os';
import { startBot, stopBot, getBotStatus, killAllUserProcesses } from './src/lib/bot-executor.js';
import whopRoutes from './src/routes/webhooks/whop.js';
import creemRoutes from './src/routes/webhooks/creem.js';
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/admin.js';
import { processPendingDrips, enrollUser as dripEnrollUser } from './src/lib/drip-engine.js';
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
                            creditBalance: 0
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

        // Enroll in drip campaign
        try {
            await dripEnrollUser(user.id, user.email);
        } catch (dripErr: any) {
            console.error('[Drip] Enrollment failed:', dripErr.message);
        }

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Register With First Bot (Onboarding Wizard) ---

app.post('/api/register-with-bot', async (req, res) => {
    try {
        const {
            email, password, full_name, acquisition_source,
            botName, model, provider: botProvider, apiKeyMode, apiKey,
            telegramEnabled, telegramToken,
            discordEnabled, discordToken,
            whatsappEnabled,
        } = req.body;

        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user + subscription
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
                            creditBalance: 0
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

        // Create first bot config
        const botData: any = {
            userId: user.id,
            name: botName || `${full_name || 'My'}'s Agent`,
            description: 'AI assistant created during signup.',
            provider: botProvider || 'openrouter',
            model: model || 'google/gemini-3-flash-preview',
            apiKeyMode: apiKeyMode || 'platform_credits',
            apiKey: apiKey || '',
            telegramEnabled: !!telegramEnabled,
            telegramToken: telegramToken || null,
            discordEnabled: !!discordEnabled,
            discordToken: discordToken || null,
            whatsappEnabled: !!whatsappEnabled,
            whatsappBridgeUrl: whatsappEnabled ? 'ws://localhost:3001' : null,
            browserEnabled: true,
            shellEnabled: true,
            tmuxEnabled: true,
            weatherEnabled: true,
            summarizeEnabled: true,
            cronEnabled: true,
            skillCreatorEnabled: true,
            restrictToWorkspace: true,
            gatewayHost: '0.0.0.0',
            gatewayPort: 18790,
            maxToolIterations: 30,
        };

        // Encrypt sensitive fields before saving
        const encryptedBotData = encryptSensitiveFields(botData);
        const botConfig = await prisma.botConfig.create({ data: encryptedBotData });

        // Auto-start the bot
        try {
            await startBot(botConfig.id);
            await prisma.botConfig.update({ where: { id: botConfig.id }, data: { status: 'running' } });
        } catch (startErr: any) {
            console.error('[Onboarding] Bot auto-start failed:', startErr.message);
        }

        // Generate JWT
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
            },
            bot: {
                id: botConfig.id,
                name: botData.name,
                channel: telegramEnabled ? 'telegram' : discordEnabled ? 'discord' : whatsappEnabled ? 'whatsapp' : null
            }
        });

        // Enroll in drip campaign
        try {
            await dripEnrollUser(user.id, user.email);
        } catch (dripErr: any) {
            console.error('[Drip] Enrollment failed:', dripErr.message);
        }

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

// --- Forgot Password ---

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await prisma.user.findUnique({ where: { email } });

        // Always return success (don't reveal if email exists)
        if (!user) return res.json({ message: 'If an account exists, a reset link has been sent.' });

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await (prisma as any).passwordReset.create({
            data: { userId: user.id, token, expiresAt }
        });

        // Send reset email
        const FRONTEND_URL = process.env.FRONTEND_URL || 'https://openclaw-host.com';
        const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

        try {
            const { sendEmail } = await import('./src/lib/email-service.js');
            const { passwordResetEmail } = await import('./src/lib/email-templates.js');
            const template = passwordResetEmail(user.full_name || 'there', resetUrl);
            await sendEmail(user.email, template.subject, template.html);
        } catch (emailErr: any) {
            console.error('[ForgotPwd] Email send failed:', emailErr.message);
        }

        res.json({ message: 'If an account exists, a reset link has been sent.' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const resetRecord = await (prisma as any).passwordReset.findUnique({ where: { token } });
        if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
        }

        // Hash and update
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: resetRecord.userId },
            data: { password: hashedPassword }
        });

        // Mark token as used
        await (prisma as any).passwordReset.update({
            where: { id: resetRecord.id },
            data: { used: true }
        });

        res.json({ message: 'Password updated successfully.' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Sync Acquisition Source ---
app.post('/api/users/source', async (req: any, res: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';
        const decoded: any = jwtVerify(authHeader.split(' ')[1], JWT_SECRET);

        const { source } = req.body;
        if (!source || !decoded.userId) return res.status(400).json({ error: 'source required' });

        // Only update if current source is generic (don't overwrite meaningful sources)
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (user && (!user.acquisition_source || user.acquisition_source === 'Direct' || user.acquisition_source === 'Google Auth' || user.acquisition_source === 'Apple Auth')) {
            await prisma.user.update({
                where: { id: decoded.userId },
                data: { acquisition_source: source }
            });
        }

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/checkout', async (req: any, res: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';
        const decoded: any = jwtVerify(authHeader.split(' ')[1], JWT_SECRET);
        if (!decoded.userId) return res.status(401).json({ error: 'Invalid token' });

        const { checkoutUrl, planName, type, amount, productId } = req.body;
        if (!checkoutUrl && !productId) return res.status(400).json({ error: 'checkoutUrl or productId required' });

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Create pending order
        const order = await prisma.order.create({
            data: {
                userId: user.id,
                type: type || 'subscription',
                status: 'pending',
                amount: Number(amount) || 0,
                planName: planName || null,
                productId: productId || null,
                provider: 'creem',
                source: user.acquisition_source || null,
            }
        });

        // Get Creem API key
        const { getSystemConfig } = await import('./src/lib/config-helper.js');
        const apiKey = await getSystemConfig('CREEM_API_KEY');

        // Extract product ID from checkout URL if not provided directly
        let effectiveProductId = productId;
        if (!effectiveProductId && checkoutUrl) {
            const prodMatch = checkoutUrl.match(/prod_[A-Za-z0-9]+/);
            if (prodMatch) effectiveProductId = prodMatch[0];
        }

        console.log(`[Checkout] User: ${user.email}, ProductId: ${effectiveProductId || 'NONE'}, ApiKey: ${apiKey ? 'SET(' + apiKey.substring(0, 8) + '...)' : 'MISSING'}`);

        if (apiKey && effectiveProductId) {
            // Detect test vs production mode
            // Creem keys: creem_xxx (prod) or creem_test_xxx / test_xxx (test)
            const isTestMode = apiKey.includes('test');
            const creemBase = isTestMode ? 'https://test-api.creem.io' : 'https://api.creem.io';

            // Build success URL — use the host header (respects reverse proxy)
            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
            const host = req.headers['x-forwarded-host'] || req.get('host');
            const successUrl = `${protocol}://${host}/billing`;

            const requestBody: any = {
                product_id: effectiveProductId,
                request_id: order.id,
                success_url: successUrl,
                customer: { email: user.email },
            };

            console.log(`[Checkout] Calling Creem API: POST ${creemBase}/v1/checkouts`, JSON.stringify(requestBody));

            try {
                const creemRes = await fetch(`${creemBase}/v1/checkouts`, {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                const creemText = await creemRes.text();
                console.log(`[Checkout] Creem API response (${creemRes.status}):`, creemText);

                if (creemRes.ok) {
                    const creemData = JSON.parse(creemText);
                    if (creemData.checkout_url) {
                        // Update order with Creem checkout ID
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { checkoutId: creemData.id || null }
                        });
                        return res.json({ url: creemData.checkout_url, orderId: order.id });
                    }
                    console.warn('[Checkout] Creem API success but no checkout_url in response');
                } else {
                    console.error(`[Checkout] Creem API error ${creemRes.status}: ${creemText}`);
                    // Return error to frontend with details so user knows what's wrong
                    return res.status(502).json({
                        error: `Creem API returned ${creemRes.status}`,
                        details: creemText,
                        fallbackUrl: checkoutUrl || null,
                        orderId: order.id,
                    });
                }
            } catch (creemErr: any) {
                console.error('[Checkout] Creem API call failed:', creemErr.message);
                return res.status(502).json({
                    error: `Creem API call failed: ${creemErr.message}`,
                    fallbackUrl: checkoutUrl || null,
                    orderId: order.id,
                });
            }
        } else {
            console.warn(`[Checkout] Cannot use Creem API: apiKey=${apiKey ? 'SET' : 'MISSING'}, productId=${effectiveProductId || 'MISSING'}`);
        }

        // Last resort fallback — only if API key is missing
        if (checkoutUrl) {
            console.warn('[Checkout] Using direct URL fallback (email will NOT be prefilled)');
            return res.json({ url: checkoutUrl, orderId: order.id });
        }

        res.status(400).json({ error: 'No checkout URL or product ID available' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Customer Billing Portal ---
app.post('/api/billing/portal', async (req: any, res: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';
        const decoded: any = jwtVerify(authHeader.split(' ')[1], JWT_SECRET);
        if (!decoded.userId) return res.status(401).json({ error: 'Invalid token' });

        const { getSystemConfig } = await import('./src/lib/config-helper.js');
        const apiKey = await getSystemConfig('CREEM_API_KEY');
        if (!apiKey) return res.status(500).json({ error: 'Creem API key not configured' });

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
        const customerId = req.body.customerId || sub?.creemSubscriptionId;

        const isTestKey = apiKey.startsWith('test_') || apiKey.includes('test');
        const creemBase = isTestKey ? 'https://test-api.creem.io' : 'https://api.creem.io';

        // Try to get customer by email first, then create portal
        const searchRes = await fetch(`${creemBase}/v1/customers/search?email=${encodeURIComponent(user.email)}`, {
            headers: { 'x-api-key': apiKey },
        });
        const searchData = await searchRes.json();
        const creemCustomerId = searchData?.items?.[0]?.id || searchData?.id || customerId;

        if (!creemCustomerId) {
            return res.status(404).json({ error: 'No Creem customer found for this account' });
        }

        const portalRes = await fetch(`${creemBase}/v1/customers/billing`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ customer_id: creemCustomerId }),
        });
        const portalData = await portalRes.json();

        if (portalData.customer_portal_link) {
            return res.json({ url: portalData.customer_portal_link });
        }

        res.status(500).json({ error: 'Could not generate portal link', details: portalData });
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
        // Enforce bot name length
        if (configData.name && configData.name.length > 50) {
            configData.name = configData.name.substring(0, 50);
        }

        // --- Agent creation limit enforcement ---
        const isNewAgent = !id || id.startsWith('temp-');
        if (isNewAgent) {
            const userSub = await prisma.subscription.findUnique({ where: { userId } });
            const plan = userSub?.plan || 'Free';
            const maxAgents = plan === 'Free' ? 1 : (userSub?.maxInstances || 1);
            const currentCount = await prisma.botConfig.count({ where: { userId } });
            if (currentCount >= maxAgents) {
                return res.status(403).json({
                    error: `Agent limit reached. Your ${plan} plan allows ${maxAgents} agent(s). Upgrade to create more.`
                });
            }
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
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
        const search = (req.query.search as string || '').trim();
        const skip = (page - 1) * limit;

        // Build where clause for search
        const where: any = search ? {
            OR: [
                { email: { contains: search } },
                { full_name: { contains: search } },
                { id: { contains: search } },
            ]
        } : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
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
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.user.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);
        res.json({ users, total, totalPages, page });
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
        res.json({ provider: config?.value || 'creem' });
    } catch (e: any) {
        res.json({ provider: 'creem' });
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
            result = await startBot(configId);
            // Persist running status to DB so dashboard shows correct state
            await prisma.botConfig.update({ where: { id: configId }, data: { status: 'running' } });
        } else if (action === 'stop') {
            result = await stopBot(configId);
            await prisma.botConfig.update({ where: { id: configId }, data: { status: 'stopped' } });
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
    // Credit top-ups must go through the payment provider (Creem/Whop)
    // This endpoint is disabled — use /topup page to purchase credits
    res.status(400).json({ error: 'Credit top-ups require payment. Please visit the Top Up page to purchase credits.' });
});

// Get available credit packs (for TopUp page)
app.get('/api/credits/packs', async (req: any, res: any) => {
    try {
        // Fetch credit packs from CreemPlan where planName starts with "Credits_"
        const packs = await prisma.creemPlan.findMany({
            where: { planName: { startsWith: 'Credits_' } },
            orderBy: { maxInstances: 'asc' }
        });

        const formatted = packs.map((p: any) => {
            const amount = parseFloat(p.planName.replace('Credits_', ''));
            return {
                amount,
                price: `$${amount}`,
                checkoutUrl: p.checkoutUrl || '',
                productId: p.creemProductId
            };
        });

        res.json(formatted);
    } catch (e: any) {
        res.json([]); // Return empty if table doesn't exist yet
    }
});

// Internal credit check for bot processes (no auth needed, called by nanobot agent loop)
app.get('/api/internal/credit-check/:userId', async (req: any, res: any) => {
    try {
        const sub = await prisma.subscription.findUnique({
            where: { userId: req.params.userId },
            select: { creditBalance: true, plan: true }
        });
        // Free users must not use platform credits at all
        if (!sub || sub.plan === 'Free') {
            return res.json({ ok: false, balance: 0, reason: 'free_plan' });
        }
        const balance = sub.creditBalance ?? 0;
        res.json({ ok: balance > 0.001, balance });
    } catch (e: any) {
        // If check fails, DENY the message (fail-closed to protect credits)
        res.json({ ok: false, balance: 0, reason: 'check_failed' });
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

app.listen(PORT, async () => {
    console.log(`🚀 MyClaw.Host Backend running on http://localhost:${PORT}`);
    console.log(`📂 Serving static files from: ${distPath}`);

    // Auto-seed Creem plans and credit packs on startup
    try {
        const CREEM_SUBSCRIPTION_PLANS = [
            { creemProductId: 'prod_2ZADi9Jg8uzIhtYCYMfe16', planName: 'Starter', maxInstances: 1, checkoutUrl: 'https://www.creem.io/payment/prod_2ZADi9Jg8uzIhtYCYMfe16' },
            { creemProductId: 'prod_17vXhoHAhzrUuW72E8yoMo', planName: 'Pro', maxInstances: 5, checkoutUrl: 'https://www.creem.io/payment/prod_17vXhoHAhzrUuW72E8yoMo' },
            { creemProductId: 'prod_7cEmSdPrcpXkARBp8vNHCt', planName: 'Elite', maxInstances: 10, checkoutUrl: 'https://www.creem.io/payment/prod_7cEmSdPrcpXkARBp8vNHCt' },
        ];

        const CREEM_CREDIT_PACKS = [
            { creemProductId: 'prod_mmW39x3i3R1wiikmWBLD0', planName: 'Credits_5', maxInstances: 0, checkoutUrl: 'https://www.creem.io/payment/prod_mmW39x3i3R1wiikmWBLD0' },
            { creemProductId: 'prod_3hLkXNNcRpBj6VFjdObgRk', planName: 'Credits_10', maxInstances: 0, checkoutUrl: 'https://www.creem.io/payment/prod_3hLkXNNcRpBj6VFjdObgRk' },
            { creemProductId: 'prod_11ynDoFCSWJUNNDwAC1s6y', planName: 'Credits_25', maxInstances: 0, checkoutUrl: 'https://www.creem.io/payment/prod_11ynDoFCSWJUNNDwAC1s6y' },
            { creemProductId: 'prod_4Sa3c1FRHxpJypefUZYYqK', planName: 'Credits_50', maxInstances: 0, checkoutUrl: 'https://www.creem.io/payment/prod_4Sa3c1FRHxpJypefUZYYqK' },
            { creemProductId: 'prod_5SlwKAMQXbA8Qjj5tvoQpc', planName: 'Credits_100', maxInstances: 0, checkoutUrl: 'https://www.creem.io/payment/prod_5SlwKAMQXbA8Qjj5tvoQpc' },
        ];

        for (const plan of [...CREEM_SUBSCRIPTION_PLANS, ...CREEM_CREDIT_PACKS]) {
            await prisma.creemPlan.upsert({
                where: { creemProductId: plan.creemProductId },
                update: { checkoutUrl: plan.checkoutUrl, planName: plan.planName, maxInstances: plan.maxInstances },
                create: plan,
            });
        }

        // Set default payment provider to creem if not set
        await prisma.systemConfig.upsert({
            where: { key: 'PAYMENT_PROVIDER' },
            update: {},
            create: { key: 'PAYMENT_PROVIDER', value: 'creem' },
        });

        console.log('✅ Creem plans & credit packs seeded');
    } catch (e: any) {
        console.warn('⚠️  Creem plan seeding skipped:', e.message);
    }

    // ─── Auto-restart bots that were running before server restart (paid users only) ───
    try {
        const staleBots = await prisma.botConfig.findMany({
            where: { status: 'running' },
            include: { user: { include: { subscription: true } } }
        });

        if (staleBots.length > 0) {
            console.log(`🔄 Found ${staleBots.length} bot(s) marked as running — checking for paid users...`);
        }

        let restartedCount = 0;
        for (const bot of staleBots) {
            const plan = (bot as any).user?.subscription?.plan || 'Free';

            if (plan === 'Free') {
                // Free users don't get auto-restart — mark as stopped
                await prisma.botConfig.update({
                    where: { id: bot.id },
                    data: { status: 'stopped' }
                });
                console.log(`   ⏭  Skipped "${bot.name}" (Free user ${(bot as any).user?.email}) — marked stopped`);
                continue;
            }

            // Paid user — restart the bot
            try {
                console.log(`   🚀 Restarting "${bot.name}" for ${plan} user ${(bot as any).user?.email}...`);
                await startBot(bot.id);
                restartedCount++;
                // Small delay between bot starts to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (err: any) {
                console.error(`   ❌ Failed to restart "${bot.name}":`, err.message);
                await prisma.botConfig.update({
                    where: { id: bot.id },
                    data: { status: 'stopped' }
                });
            }
        }

        if (restartedCount > 0) {
            console.log(`✅ Auto-restarted ${restartedCount} bot(s) for paid users`);
        }
    } catch (e: any) {
        console.warn('⚠️  Bot auto-restart check failed:', e.message);
    }

    // ─── Watchdog: periodically check for paid bots that silently died ───
    const WATCHDOG_INTERVAL_MS = 60_000; // 60 seconds
    setInterval(async () => {
        try {
            // Find bots the DB thinks are running (or restarting)
            const runningBots = await prisma.botConfig.findMany({
                where: { status: { in: ['running', 'restarting'] } },
                include: { user: { include: { subscription: true } } }
            });

            for (const bot of runningBots) {
                const plan = (bot as any).user?.subscription?.plan || 'Free';
                const actualStatus = getBotStatus(bot.id);

                if (actualStatus === 'stopped' && plan !== 'Free') {
                    console.log(`[Watchdog] Bot "${bot.name}" (${bot.id}) is dead but DB says running — restarting...`);
                    try {
                        await startBot(bot.id);
                        console.log(`[Watchdog] Bot "${bot.name}" restarted successfully.`);
                    } catch (err: any) {
                        console.error(`[Watchdog] Failed to restart "${bot.name}":`, err.message);
                        await prisma.botConfig.update({
                            where: { id: bot.id },
                            data: { status: 'stopped' }
                        }).catch(() => { });
                    }
                    // Brief delay between restarts
                    await new Promise(r => setTimeout(r, 3000));
                } else if (actualStatus === 'stopped' && plan === 'Free') {
                    // Free user bot silently died — just correct the DB status
                    await prisma.botConfig.update({
                        where: { id: bot.id },
                        data: { status: 'stopped' }
                    }).catch(() => { });
                }
            }
        } catch (e: any) {
            console.error('[Watchdog] Health-check error:', e.message);
        }
    }, WATCHDOG_INTERVAL_MS);
    console.log(`🐕 Watchdog started (checking every ${WATCHDOG_INTERVAL_MS / 1000}s)`);

    // ─── Email Drip Campaign Scheduler ──────────────────────────────────────
    const DRIP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    setInterval(async () => {
        try {
            await processPendingDrips();
        } catch (e: any) {
            console.error('[Drip Scheduler] Error:', e.message);
        }
    }, DRIP_INTERVAL_MS);
    console.log(`📧 Drip scheduler started (checking every ${DRIP_INTERVAL_MS / 60000}min)`);

    // Run immediately on startup too (don't wait 15 min for first batch)
    processPendingDrips().catch((e: any) => console.error('[Drip] Initial run failed:', e.message));

    // ─── Orphan Process Reaper ──────────────────────────────────────────────
    // Kill Chrome headless processes that have been running too long (orphans)
    const REAPER_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
    const MAX_CHROME_AGE_MIN = 10; // kill Chrome processes older than 10 minutes

    const { exec } = await import('child_process');

    setInterval(() => {
        // Find and kill orphan chromium/chrome-headless processes older than MAX_CHROME_AGE_MIN
        const cmd = `ps -eo pid,etimes,comm --no-headers | awk '$3 ~ /chrom/ && $2 > ${MAX_CHROME_AGE_MIN * 60} { print $1 }'`;

        exec(cmd, (err: any, stdout: string) => {
            if (err || !stdout.trim()) return;

            const pids = stdout.trim().split('\n').filter(Boolean);
            if (pids.length === 0) return;

            console.log(`🧹 [Reaper] Found ${pids.length} orphan Chrome processes (>${MAX_CHROME_AGE_MIN}min old), killing...`);

            for (const pid of pids) {
                exec(`kill -9 ${pid.trim()}`, (killErr: any) => {
                    if (!killErr) {
                        console.log(`🧹 [Reaper] Killed Chrome PID ${pid.trim()}`);
                    }
                });
            }
        });
    }, REAPER_INTERVAL_MS);
    console.log(`🧹 Orphan reaper started (killing Chrome processes >${MAX_CHROME_AGE_MIN}min every ${REAPER_INTERVAL_MS / 60000}min)`);
});
