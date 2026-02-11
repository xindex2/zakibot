import express from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../lib/crypto.js';

const router = express.Router();
const prisma = new PrismaClient();

// Authorization middleware already handled in server.ts for /api/admin

/**
 * GET /api/admin/events
 * List Whop Webhook Events
 */
router.get('/events', async (req, res) => {
    try {
        const events = await prisma.whopEvent.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(events);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/admin/plans
 * List Whop Plan Mappings
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await prisma.whopPlan.findMany({
            orderBy: { maxInstances: 'asc' }
        });
        res.json(plans);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/plans
 * Create or Update Plan Mapping
 */
router.post('/plans', async (req, res) => {
    const { whopPlanId, planName, maxInstances, checkoutUrl } = req.body;
    try {
        const plan = await prisma.whopPlan.upsert({
            where: { whopPlanId },
            update: { planName, maxInstances: Number(maxInstances), checkoutUrl },
            create: { whopPlanId, planName, maxInstances: Number(maxInstances), checkoutUrl }
        });
        res.json(plan);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/admin/plans/:id
 * Delete a Whop Plan
 */
router.delete('/plans/:id', async (req, res) => {
    try {
        await prisma.whopPlan.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/admin/stats (Extended)
 */
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, totalAgents, activeAgents] = await Promise.all([
            prisma.user.count(),
            prisma.botConfig.count(),
            prisma.botConfig.count({ where: { status: 'running' } })
        ]);

        // Growth (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const growth = await prisma.user.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true }
        });

        // Group by day
        const growthMap: any = {};
        growth.forEach((u: any) => {
            const date = u.createdAt.toISOString().split('T')[0];
            growthMap[date] = (growthMap[date] || 0) + 1;
        });

        const formattedGrowth = Object.entries(growthMap).map(([date, count]) => ({ date, count: count as number }));

        res.json({
            summary: { totalUsers, totalAgents, activeAgents },
            growth: formattedGrowth,
            system: {
                cpu: { usage: 12, cores: 8, load: '1.2, 1.5, 1.4' },
                ram: { percent: 45, used: '3.6GB', total: '8GB' },
                disk: { percent: 22, used: '44GB', total: '200GB' }
            },
            agentUsage: [] // Handled by separate endpoint or refined later
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/admin/config
 * Get system configuration keys
 */
router.get('/config', async (req, res) => {
    try {
        const configs = await prisma.systemConfig.findMany();
        // Decrypt sensitive config values before returning
        const SENSITIVE_KEYS = ['OPENROUTER_API_KEY', 'WHOP_API_KEY', 'CREEM_API_KEY'];
        const configMap = configs.reduce((acc: any, curr: any) => {
            acc[curr.key] = SENSITIVE_KEYS.includes(curr.key) ? decrypt(curr.value) : curr.value;
            return acc;
        }, {});
        res.json(configMap);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/config
 * Update system configuration keys
 */
router.post('/config', async (req, res) => {
    const data = req.body;
    try {
        // Encrypt sensitive keys before storing
        const SENSITIVE_KEYS = ['OPENROUTER_API_KEY', 'WHOP_API_KEY', 'CREEM_API_KEY'];
        const operations = Object.entries(data).map(([key, value]) => {
            const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(String(value)) : String(value);
            return prisma.systemConfig.upsert({
                where: { key },
                update: { value: storedValue },
                create: { key, value: storedValue }
            });
        });
        await Promise.all(operations);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/admin/users
 * List all users with subscription info, pagination, and search
 */
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string || '';
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search } }, // email is unique, often case-insensitive depending on DB
                { full_name: { contains: search } },
                { id: { contains: search } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    subscription: true,
                    _count: {
                        select: { configs: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.user.count({ where })
        ]);

        res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/admin/users/:id
 * Update user details (Plan, Role)
 */
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { role, plan, maxInstances } = req.body;

    try {
        // Update User Role
        const user = await prisma.user.update({
            where: { id },
            data: { role }
        });

        // Update or Create Subscription
        if (plan) {
            await prisma.subscription.upsert({
                where: { userId: id },
                update: {
                    plan,
                    maxInstances: Number(maxInstances || 1),
                    status: 'active'
                },
                create: {
                    userId: id,
                    plan,
                    maxInstances: Number(maxInstances || 1),
                    status: 'active'
                }
            });
        }

        res.json({ success: true, user });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user and their associated data
 */
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Transaction to ensure clean cleanup
        await prisma.$transaction([
            prisma.botConfig.deleteMany({ where: { userId: id } }),
            prisma.subscription.deleteMany({ where: { userId: id } }),
            prisma.user.delete({ where: { id } })
        ]);
        res.json({ success: true });
    } catch (e: any) {
        console.error("Delete error:", e);
        res.status(500).json({ error: e.message });
    }
});

// ========================
// Creem Plans CRUD
// ========================

/**
 * GET /api/admin/creem-plans
 * List Creem Plan Mappings
 */
router.get('/creem-plans', async (req, res) => {
    try {
        const plans = await prisma.creemPlan.findMany({
            orderBy: { maxInstances: 'asc' }
        });
        res.json(plans);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/creem-plans
 * Create or Update Creem Plan Mapping
 */
router.post('/creem-plans', async (req, res) => {
    let { creemProductId, planName, maxInstances, checkoutUrl } = req.body;
    try {
        // Auto-extract product ID from checkout URL if not provided or empty
        if (!creemProductId && checkoutUrl) {
            const prodMatch = checkoutUrl.match(/prod_[A-Za-z0-9]+/);
            if (prodMatch) {
                creemProductId = prodMatch[0];
            }
        }
        if (!creemProductId) {
            return res.status(400).json({ error: 'Product ID is required. Paste a Creem payment link or enter the product ID manually (prod_...).' });
        }

        const plan = await prisma.creemPlan.upsert({
            where: { creemProductId },
            update: { planName, maxInstances: Number(maxInstances), checkoutUrl },
            create: { creemProductId, planName, maxInstances: Number(maxInstances), checkoutUrl }
        });
        res.json(plan);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/admin/creem-plans/:id
 * Delete a Creem Plan
 */
router.delete('/creem-plans/:id', async (req, res) => {
    try {
        await prisma.creemPlan.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ========================
// Credits Management
// ========================

/**
 * POST /api/admin/credits/add
 * Grant credits to a user
 */
router.post('/credits/add', async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'userId and positive amount required' });
    }

    try {
        const sub = await prisma.subscription.findUnique({ where: { userId } });
        if (!sub) {
            return res.status(404).json({ error: 'User subscription not found' });
        }

        await prisma.subscription.update({
            where: { userId },
            data: { creditBalance: (sub.creditBalance || 0) + Number(amount) }
        });

        await prisma.creditTransaction.create({
            data: {
                userId,
                amount: Number(amount),
                type: 'subscription_grant',
                description: `Admin grant of $${amount}`
            }
        });

        res.json({ success: true, newBalance: (sub.creditBalance || 0) + Number(amount) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ========================
// Orders
// ========================

/**
 * GET /api/admin/orders
 * List orders with pagination, filtering by status/type, and search by email
 */
router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const type = req.query.type as string;
        const search = req.query.search as string;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (type) where.type = type;
        if (search) {
            where.user = { email: { contains: search } };
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: { user: { select: { email: true, full_name: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.order.count({ where }),
        ]);

        res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ========================
// Admin Bot Control
// ========================

/**
 * POST /api/admin/bot/control
 * Admin start/stop/restart any bot (bypasses plan check)
 */
router.post('/bot/control', async (req, res) => {
    try {
        const { action, configId } = req.body;
        if (!configId) return res.status(400).json({ error: 'configId required' });

        // Dynamic import to avoid circular deps
        const { startBot, stopBot, getBotStatus } = await import('../lib/bot-executor.js');

        if (action === 'start') {
            await startBot(configId);
            res.json({ success: true, status: 'running' });
        } else if (action === 'stop') {
            await stopBot(configId);
            res.json({ success: true, status: 'stopped' });
        } else if (action === 'restart') {
            await stopBot(configId);
            await new Promise(r => setTimeout(r, 2000));
            await startBot(configId);
            res.json({ success: true, status: 'running' });
        } else if (action === 'status') {
            res.json({ status: getBotStatus(configId) });
        } else {
            res.status(400).json({ error: 'Invalid action. Use start, stop, restart, or status.' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/bots/restart-paid
 * Restart ALL stopped bots for paid users (bulk recovery)
 */
router.post('/bots/restart-paid', async (req, res) => {
    try {
        const { startBot } = await import('../lib/bot-executor.js');

        // Find all bot configs belonging to paid users that are currently stopped
        const paidBotConfigs = await prisma.botConfig.findMany({
            where: {
                status: 'stopped',
                user: {
                    subscription: {
                        plan: { not: 'Free' }
                    }
                }
            },
            include: { user: { include: { subscription: true } } }
        });

        const results: { id: string; name: string; status: string; error?: string }[] = [];

        for (const bot of paidBotConfigs) {
            try {
                await startBot(bot.id);
                results.push({ id: bot.id, name: bot.name, status: 'started' });
                // Stagger starts by 3 seconds
                await new Promise(r => setTimeout(r, 3000));
            } catch (err: any) {
                results.push({ id: bot.id, name: bot.name, status: 'failed', error: err.message });
            }
        }

        res.json({ success: true, total: paidBotConfigs.length, results });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
