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
            const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(String(value).trim()) : String(value);
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
                    configs: {
                        select: {
                            id: true, name: true, model: true, apiKeyMode: true, status: true,
                            telegramEnabled: true, discordEnabled: true, whatsappEnabled: true,
                            slackEnabled: true, feishuEnabled: true,
                        }
                    },
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

/**
 * GET /api/admin/credit-usage
 * Per-user credit usage summary with sorting, pagination, date filtering, and search
 * Query params: sort, order, page, limit, from, to, search
 */
router.get('/credit-usage', async (req, res) => {
    try {
        const sort = (req.query.sort as string) || 'total_used';
        const order = (req.query.order as string) || 'desc';
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const from = req.query.from ? new Date(req.query.from as string) : undefined;
        const to = req.query.to ? new Date(req.query.to as string) : undefined;
        const search = (req.query.search as string) || '';

        // Build date filter for transactions
        const txDateFilter: any = {};
        if (from) txDateFilter.gte = from;
        if (to) {
            const toEnd = new Date(to);
            toEnd.setHours(23, 59, 59, 999);
            txDateFilter.lte = toEnd;
        }
        const txWhere: any = { amount: { lt: 0 } };
        if (from || to) txWhere.createdAt = txDateFilter;

        // Build user search filter
        const userWhere: any = {};
        if (search) {
            userWhere.OR = [
                { email: { contains: search } },
                { full_name: { contains: search } },
            ];
        }

        // Get users with subscription info
        const allUsers = await prisma.user.findMany({
            where: userWhere,
            select: {
                id: true, email: true, full_name: true, createdAt: true,
                subscription: { select: { plan: true, creditBalance: true } }
            }
        });

        // Get per-user usage aggregates (filtered by date)
        const usageAgg = await prisma.creditTransaction.groupBy({
            by: ['userId'],
            where: txWhere,
            _sum: { amount: true },
            _count: { _all: true }
        });

        const usageMap = new Map(
            usageAgg.map((u: any) => [u.userId, {
                totalUsed: Math.abs(u._sum.amount || 0),
                txCount: u._count._all
            }])
        );

        let result = allUsers.map(u => ({
            userId: u.id,
            email: u.email,
            name: u.full_name,
            plan: u.subscription?.plan || 'Free',
            currentBalance: u.subscription?.creditBalance ?? 0,
            totalUsed: usageMap.get(u.id)?.totalUsed ?? 0,
            transactionCount: usageMap.get(u.id)?.txCount ?? 0,
            createdAt: u.createdAt
        }));

        // Sort
        result.sort((a, b) => {
            const field = sort === 'balance' ? 'currentBalance' : 'totalUsed';
            return order === 'asc'
                ? (a as any)[field] - (b as any)[field]
                : (b as any)[field] - (a as any)[field];
        });

        // Summary totals (before pagination)
        const totalUsedAll = result.reduce((s, u) => s + u.totalUsed, 0);
        const totalBalanceAll = result.reduce((s, u) => s + u.currentBalance, 0);
        const totalFiltered = result.length;

        // Paginate
        const paged = result.slice(skip, skip + limit);

        res.json({
            users: paged,
            summary: {
                totalUsers: totalFiltered,
                totalUsed: totalUsedAll,
                totalBalance: totalBalanceAll
            },
            page,
            totalPages: Math.ceil(totalFiltered / limit)
        });
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
                include: { user: { select: { email: true, full_name: true, acquisition_source: true } } },
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

// ========================
// Email Drip Campaign — Bulk Enroll
// ========================

/**
 * POST /api/admin/drip/enroll-all
 * Enroll ALL existing users into the drip campaign.
 * Idempotent — skips users already enrolled.
 */
router.post('/drip/enroll-all', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, full_name: true }
        });

        const { enrollUser } = await import('../lib/drip-engine.js');

        let enrolled = 0;
        let skipped = 0;

        for (const user of users) {
            try {
                await enrollUser(user.id, user.email);
                enrolled++;
            } catch (err: any) {
                if (err.message?.includes('already enrolled')) {
                    skipped++;
                } else {
                    console.error(`[Drip] Failed to enroll ${user.email}:`, err.message);
                    skipped++;
                }
            }
        }

        res.json({
            success: true,
            total: users.length,
            enrolled,
            skipped,
            message: `Enrolled ${enrolled} users, skipped ${skipped} (already enrolled or error)`
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/admin/drip/stats
 * Get drip campaign statistics with per-step breakdown
 */
router.get('/drip/stats', async (req, res) => {
    try {
        const [total, sent, pending, failed, skipped] = await Promise.all([
            prisma.emailDrip.count(),
            prisma.emailDrip.count({ where: { status: 'sent' } }),
            prisma.emailDrip.count({ where: { status: 'pending' } }),
            prisma.emailDrip.count({ where: { status: 'failed' } }),
            prisma.emailDrip.count({ where: { status: 'skipped' } }),
        ]);

        // Per-step breakdown
        const stepNames = [
            'Welcome', 'Setup Nudge', 'Help Offer', 'Multi-Agent',
            'Upgrade CTA', 'Price Rising', 'Last Chance', 'Inactive Warning'
        ];

        const steps = [];
        for (let i = 0; i < 8; i++) {
            const [stepSent, stepPending, stepFailed, stepSkipped] = await Promise.all([
                prisma.emailDrip.count({ where: { step: i, status: 'sent' } }),
                prisma.emailDrip.count({ where: { step: i, status: 'pending' } }),
                prisma.emailDrip.count({ where: { step: i, status: 'failed' } }),
                prisma.emailDrip.count({ where: { step: i, status: 'skipped' } }),
            ]);
            steps.push({
                step: i,
                name: stepNames[i],
                sent: stepSent,
                pending: stepPending,
                failed: stepFailed,
                skipped: stepSkipped,
                total: stepSent + stepPending + stepFailed + stepSkipped,
            });
        }

        // Recent activity (last 20 sent/failed)
        const recent = await prisma.emailDrip.findMany({
            where: { status: { in: ['sent', 'failed'] } },
            orderBy: { sentAt: 'desc' },
            take: 20,
            select: { email: true, step: true, status: true, sentAt: true },
        });

        // Enrolled users count
        const enrolledUsers = await prisma.emailDrip.groupBy({
            by: ['userId'],
        });

        res.json({
            overview: { total, sent, pending, failed, skipped, enrolledUsers: enrolledUsers.length },
            steps,
            recent: recent.map(r => ({
                ...r,
                stepName: stepNames[r.step] || `Step ${r.step}`,
            })),
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
