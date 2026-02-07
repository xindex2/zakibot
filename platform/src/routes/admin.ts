import express from 'express';
import { PrismaClient } from '@prisma/client';

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
    const { whopPlanId, planName, maxInstances } = req.body;
    try {
        const plan = await prisma.whopPlan.upsert({
            where: { whopPlanId },
            update: { planName, maxInstances: Number(maxInstances) },
            create: { whopPlanId, planName, maxInstances: Number(maxInstances) }
        });
        res.json(plan);
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
        growth.forEach(u => {
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
        const configMap = configs.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
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
        const operations = Object.entries(data).map(([key, value]) => {
            return prisma.systemConfig.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
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

export default router;
