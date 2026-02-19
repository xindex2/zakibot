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

/**
 * GET /api/admin/api-activity
 * Recent individual API credit transactions (live log)
 * Query params: page, limit, search
 */
router.get('/api-activity', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;
        const search = (req.query.search as string) || '';

        // Build where clause
        const where: any = { type: 'usage', amount: { lt: 0 } };

        // If searching, find matching user IDs first
        let userMap = new Map<string, { email: string; name: string; plan: string }>();
        if (search) {
            const matchingUsers = await prisma.user.findMany({
                where: {
                    OR: [
                        { email: { contains: search } },
                        { full_name: { contains: search } },
                    ]
                },
                select: { id: true, email: true, full_name: true, subscription: { select: { plan: true } } }
            });
            const userIds = matchingUsers.map(u => u.id);
            if (userIds.length === 0) {
                return res.json({ transactions: [], total: 0, page, totalPages: 0, todayCost: 0 });
            }
            where.userId = { in: userIds };
            matchingUsers.forEach(u => userMap.set(u.id, {
                email: u.email,
                name: u.full_name || '',
                plan: u.subscription?.plan || 'Free'
            }));
        }

        const [transactions, total] = await Promise.all([
            prisma.creditTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip
            }),
            prisma.creditTransaction.count({ where })
        ]);

        // Get today's total cost
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayAgg = await prisma.creditTransaction.aggregate({
            where: { type: 'usage', amount: { lt: 0 }, createdAt: { gte: todayStart } },
            _sum: { amount: true }
        });
        const todayCost = Math.abs(todayAgg._sum.amount || 0);

        // Fetch user info for all unique userIds if not already loaded
        if (!search) {
            const uniqueIds = [...new Set(transactions.map((t: any) => t.userId))];
            const users = await prisma.user.findMany({
                where: { id: { in: uniqueIds } },
                select: { id: true, email: true, full_name: true, subscription: { select: { plan: true } } }
            });
            users.forEach(u => userMap.set(u.id, {
                email: u.email,
                name: u.full_name || '',
                plan: u.subscription?.plan || 'Free'
            }));
        }

        // Also try to find bot names for each user
        const uniqueUserIds = [...new Set(transactions.map((t: any) => t.userId))];
        const botConfigs = await prisma.botConfig.findMany({
            where: { userId: { in: uniqueUserIds } },
            select: { userId: true, name: true }
        });
        const botNameMap = new Map<string, string>();
        botConfigs.forEach((b: any) => botNameMap.set(b.userId, b.name));

        // Parse description to extract model name
        const enriched = transactions.map((tx: any) => {
            const user = userMap.get(tx.userId);
            let model = '';
            if (tx.description) {
                const modelMatch = tx.description.match(/^([^:]+):/);
                if (modelMatch) model = modelMatch[1].trim();
            }
            return {
                id: tx.id,
                userId: tx.userId,
                email: user?.email || 'Unknown',
                userName: user?.name || '',
                plan: user?.plan || 'Free',
                botName: botNameMap.get(tx.userId) || '',
                model,
                amount: Math.abs(tx.amount),
                description: tx.description,
                createdAt: tx.createdAt
            };
        });

        res.json({
            transactions: enriched,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            todayCost
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

// ========================
// Outreach CRM
// ========================

import { sendEmail } from '../lib/email-service.js';

/**
 * GET /api/admin/outreach/leads
 * List leads with pagination, search, status/tag filter
 */
router.get('/outreach/leads', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;
        const search = (req.query.search as string) || '';
        const status = req.query.status as string;
        const tag = req.query.tag as string;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search } },
                { name: { contains: search } },
                { notes: { contains: search } },
            ];
        }
        if (status) where.status = status;
        if (tag) where.tags = { contains: tag };

        const [leads, total] = await Promise.all([
            prisma.outreachLead.findMany({
                where,
                include: { _count: { select: { emails: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.outreachLead.count({ where }),
        ]);

        res.json({ leads, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/outreach/leads
 * Create lead(s) — single or bulk
 * Body: { email, name?, notes?, tags? } OR { bulk: "email1,name1\nemail2,name2" }
 */
router.post('/outreach/leads', async (req, res) => {
    try {
        const { email, name, notes, tags, bulk } = req.body;

        if (bulk) {
            // Bulk import: one lead per line, format: email or email,name
            const lines = (bulk as string).split('\n').map(l => l.trim()).filter(Boolean);
            let created = 0;
            let skipped = 0;
            for (const line of lines) {
                const parts = line.split(',').map(p => p.trim());
                const leadEmail = parts[0];
                const leadName = parts[1] || null;
                if (!leadEmail || !leadEmail.includes('@')) { skipped++; continue; }
                try {
                    await prisma.outreachLead.create({
                        data: { email: leadEmail, name: leadName, tags }
                    });
                    created++;
                } catch {
                    skipped++; // duplicate
                }
            }
            return res.json({ success: true, created, skipped });
        }

        if (!email) return res.status(400).json({ error: 'Email is required' });

        const lead = await prisma.outreachLead.create({
            data: { email, name, notes, tags }
        });
        res.json(lead);
    } catch (e: any) {
        if (e.code === 'P2002') return res.status(400).json({ error: 'Lead with this email already exists' });
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/admin/outreach/leads/:id
 */
router.put('/outreach/leads/:id', async (req, res) => {
    try {
        const { name, email, notes, tags, status } = req.body;
        const lead = await prisma.outreachLead.update({
            where: { id: req.params.id },
            data: { name, email, notes, tags, status }
        });
        res.json(lead);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/admin/outreach/leads/:id
 */
router.delete('/outreach/leads/:id', async (req, res) => {
    try {
        await prisma.outreachLead.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Templates ---

/**
 * GET /api/admin/outreach/templates
 */
router.get('/outreach/templates', async (req, res) => {
    try {
        const templates = await prisma.outreachTemplate.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(templates);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/outreach/templates
 * Create or update (if id provided)
 */
router.post('/outreach/templates', async (req, res) => {
    try {
        const { id, name, fromName, fromEmail, subject, body } = req.body;
        if (!name || !subject || !body) return res.status(400).json({ error: 'name, subject, and body are required' });

        if (id) {
            const tpl = await prisma.outreachTemplate.update({
                where: { id },
                data: { name, fromName, fromEmail, subject, body }
            });
            return res.json(tpl);
        }

        const tpl = await prisma.outreachTemplate.create({
            data: { name, fromName, fromEmail, subject, body }
        });
        res.json(tpl);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/admin/outreach/templates/:id
 */
router.delete('/outreach/templates/:id', async (req, res) => {
    try {
        await prisma.outreachTemplate.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Send ---

/**
 * POST /api/admin/outreach/send
 * Send email(s) to selected leads
 * Body: { leadIds: string[], templateId?: string, subject?: string, body?: string, fromName?: string, fromEmail?: string }
 */
router.post('/outreach/send', async (req, res) => {
    try {
        const { leadIds, templateId, subject, body, fromName, fromEmail } = req.body;
        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'leadIds array is required' });
        }

        let tpl: any = null;
        if (templateId) {
            tpl = await prisma.outreachTemplate.findUnique({ where: { id: templateId } });
            if (!tpl) return res.status(404).json({ error: 'Template not found' });
        }

        const finalSubject = subject || tpl?.subject;
        const finalBody = body || tpl?.body;
        const finalFromName = fromName || tpl?.fromName || 'Ezzaky @ MyClaw';
        const finalFromEmail = fromEmail || tpl?.fromEmail || 'ezzaky@myclaw.host';

        if (!finalSubject || !finalBody) {
            return res.status(400).json({ error: 'Subject and body are required (provide directly or via templateId)' });
        }

        const leads = await prisma.outreachLead.findMany({
            where: { id: { in: leadIds } }
        });

        const results: { email: string; status: string; error?: string }[] = [];
        const HOST = process.env.APP_URL || 'https://openclaw-host.com';

        // Resend rate limit: 2 requests/sec — throttle to ~1.7/sec
        const SEND_DELAY_MS = 600;

        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];

            // Throttle: wait between sends (skip delay on first)
            if (i > 0) await new Promise(r => setTimeout(r, SEND_DELAY_MS));

            // Replace {{name}} placeholder
            let personalBody = finalBody.replace(/\{\{name\}\}/gi, lead.name || 'there');
            let personalSubject = finalSubject.replace(/\{\{name\}\}/gi, lead.name || 'there');

            // Create outreach email record first to get the ID for tracking
            const outreachEmail = await prisma.outreachEmail.create({
                data: {
                    leadId: lead.id,
                    templateId: templateId || null,
                    subject: personalSubject,
                    fromName: finalFromName,
                    fromEmail: finalFromEmail,
                    status: 'pending',
                }
            });

            // Inject tracking pixel
            const trackingPixel = `<img src="${HOST}/t/${outreachEmail.id}.png" width="1" height="1" style="display:none" alt="" />`;
            personalBody += trackingPixel;

            // Send via Resend
            const fromAddress = `${finalFromName} <${finalFromEmail}>`;
            const result = await sendEmail(lead.email, personalSubject, personalBody, { from: fromAddress, replyTo: finalFromEmail });

            if (result.success) {
                await prisma.outreachEmail.update({
                    where: { id: outreachEmail.id },
                    data: { status: 'sent', resendId: result.id, sentAt: new Date() }
                });
                // Update lead status if still "new"
                if (lead.status === 'new') {
                    await prisma.outreachLead.update({
                        where: { id: lead.id },
                        data: { status: 'contacted' }
                    });
                }
                results.push({ email: lead.email, status: 'sent' });
            } else {
                await prisma.outreachEmail.update({
                    where: { id: outreachEmail.id },
                    data: { status: 'failed' }
                });
                results.push({ email: lead.email, status: 'failed', error: result.error });
            }
        }

        res.json({ success: true, total: leads.length, results });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Stats ---

/**
 * GET /api/admin/outreach/stats
 * Outreach campaign statistics
 */
router.get('/outreach/stats', async (req, res) => {
    try {
        const [totalLeads, totalSent, totalOpened, totalFailed] = await Promise.all([
            prisma.outreachLead.count(),
            prisma.outreachEmail.count({ where: { status: 'sent' } }),
            prisma.outreachEmail.count({ where: { openedAt: { not: null } } }),
            prisma.outreachEmail.count({ where: { status: 'failed' } }),
        ]);

        // Lead status breakdown
        const statusBreakdown = await prisma.outreachLead.groupBy({
            by: ['status'],
            _count: { _all: true }
        });

        // Recent activity
        const recentSends = await prisma.outreachEmail.findMany({
            where: { status: { in: ['sent', 'failed'] } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { lead: { select: { email: true, name: true } } }
        });

        res.json({
            overview: {
                totalLeads,
                totalSent,
                totalOpened,
                totalFailed,
                openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0',
            },
            statusBreakdown: statusBreakdown.reduce((acc: any, s: any) => {
                acc[s.status] = s._count._all;
                return acc;
            }, {}),
            recentSends,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Sent emails log ---

/**
 * GET /api/admin/outreach/emails
 * List sent outreach emails with lead info
 */
router.get('/outreach/emails', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const [emails, total] = await Promise.all([
            prisma.outreachEmail.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { lead: { select: { email: true, name: true } } }
            }),
            prisma.outreachEmail.count(),
        ]);

        res.json({ emails, total, page, totalPages: Math.ceil(total / limit) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/admin/outreach/retry
 * Retry sending failed emails
 * Body: { emailIds: string[] }
 */
router.post('/outreach/retry', async (req, res) => {
    try {
        const { emailIds } = req.body;
        if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).json({ error: 'emailIds array is required' });
        }

        const failedEmails = await prisma.outreachEmail.findMany({
            where: { id: { in: emailIds }, status: 'failed' },
            include: { lead: true }
        });

        if (failedEmails.length === 0) {
            return res.status(400).json({ error: 'No failed emails found for the given IDs' });
        }

        const results: { email: string; status: string; error?: string }[] = [];
        const HOST = process.env.APP_URL || 'https://openclaw-host.com';
        const SEND_DELAY_MS = 600;

        for (let i = 0; i < failedEmails.length; i++) {
            const record = failedEmails[i];
            if (i > 0) await new Promise(r => setTimeout(r, SEND_DELAY_MS));

            // Re-inject tracking pixel
            const trackingPixel = `<img src="${HOST}/t/${record.id}.png" width="1" height="1" style="display:none" alt="" />`;
            // Fetch original template body if available, or use stored subject
            const fromAddress = `${record.fromName} <${record.fromEmail}>`;

            // We need the original body — fetch from template if templateId exists
            let body = '';
            if (record.templateId) {
                const tpl = await prisma.outreachTemplate.findUnique({ where: { id: record.templateId } });
                if (tpl) {
                    body = tpl.body.replace(/\{\{name\}\}/gi, record.lead?.name || 'there');
                }
            }

            // If no template body, use a minimal retry body
            if (!body) {
                body = `<p>This is a follow-up email.</p>`;
            }
            body += trackingPixel;

            const result = await sendEmail(
                record.lead?.email || '',
                record.subject,
                body,
                { from: fromAddress, replyTo: record.fromEmail }
            );

            if (result.success) {
                await prisma.outreachEmail.update({
                    where: { id: record.id },
                    data: { status: 'sent', resendId: result.id, sentAt: new Date() }
                });
                results.push({ email: record.lead?.email || '', status: 'sent' });
            } else {
                results.push({ email: record.lead?.email || '', status: 'failed', error: result.error });
            }
        }

        res.json({ success: true, total: failedEmails.length, results });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
