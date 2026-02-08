import express from 'express';
import { CreemService } from '../../lib/creem-service.js';
import { getSystemConfig } from '../../lib/config-helper.js';

const router = express.Router();

/**
 * Creem Webhook Handler
 * POST /api/webhooks/creem
 */
router.post('/', async (req, res) => {
    const signature = req.headers['creem-signature'] as string;
    const secret = (await getSystemConfig('CREEM_WEBHOOK_SECRET')) || process.env.CREEM_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (secret && !CreemService.verifySignature(JSON.stringify(req.body), signature, secret)) {
        console.warn('[Creem] Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        await CreemService.handleEvent(req.body);
        res.json({ success: true });
    } catch (e: any) {
        console.error('[Creem] Webhook Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

export default router;
