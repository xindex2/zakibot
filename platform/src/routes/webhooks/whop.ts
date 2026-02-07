import express from 'express';
import { WhopService } from '../../lib/whop-service.js';

import { getSystemConfig } from '../../lib/config-helper.js';

const router = express.Router();

/**
 * Whop Webhook Handler
 * POST /api/webhooks/whop
 */
router.post('/', async (req, res) => {
    const signature = req.headers['x-whop-signature'] as string;
    const secret = (await getSystemConfig('WHOP_WEBHOOK_SECRET')) || process.env.WHOP_WEBHOOK_SECRET;

    // In development/testing, we might skip signature verification if secret is not set
    if (secret && !WhopService.verifySignature(JSON.stringify(req.body), signature, secret)) {
        console.warn('[Whop] Invalid signature receiving webhook');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        await WhopService.handleEvent(req.body);
        res.json({ success: true });
    } catch (e: any) {
        console.error('[Whop] Webhook Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

export default router;
