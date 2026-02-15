import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify as joseJwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw-host';

// Fix for ESM/CJS interop
const jwtSign = (jwt as any).default?.sign || (jwt as any).sign || jwt.sign;
const jwtVerify = (jwt as any).default?.verify || (jwt as any).verify || jwt.verify;

// Google OAuth Setup
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`
);

// Initiate Google OAuth
router.get('/auth/google', (req, res) => {
    const url = googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
    });
    res.redirect(url);
});

// Google OAuth Callback
router.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const { tokens } = await googleClient.getToken(code as string);
        googleClient.setCredentials(tokens);

        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token!,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) throw new Error('No payload from Google');

        const { sub: googleId, email, name: full_name, picture: avatar_url } = payload;

        if (!email) throw new Error('No email from Google');

        // 1. Try to find by Google ID
        let user = await prisma.user.findUnique({ where: { google_id: googleId } });

        // 2. If not found, try to find by email and link
        if (!user) {
            user = await prisma.user.findUnique({ where: { email: email } });
            if (user) {
                // Link Google account to existing user
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        google_id: googleId,
                        avatar_url: avatar_url || user.avatar_url,
                        full_name: full_name || user.full_name
                    }
                });
            } else {
                // 3. Create new user with subscription
                try {
                    user = await prisma.user.create({
                        data: {
                            full_name: full_name || 'Commander',
                            email,
                            password: crypto.randomBytes(16).toString('hex'),
                            google_id: googleId,
                            avatar_url,
                            acquisition_source: 'Direct',
                            subscription: {
                                create: {
                                    plan: 'Free',
                                    maxInstances: 1,
                                    creditBalance: 10
                                }
                            }
                        }
                    });
                } catch (createErr: any) {
                    // Fallback if creditBalance column not yet migrated
                    if (createErr.message?.includes('creditBalance')) {
                        user = await prisma.user.create({
                            data: {
                                full_name: full_name || 'Commander',
                                email,
                                password: crypto.randomBytes(16).toString('hex'),
                                google_id: googleId,
                                avatar_url,
                                acquisition_source: 'Direct',
                                subscription: {
                                    create: {
                                        plan: 'Free',
                                        maxInstances: 1
                                    }
                                }
                            }
                        });
                    } else {
                        throw createErr;
                    }
                }
            }
        } else if (avatar_url && user.avatar_url !== avatar_url) {
            // Update avatar if it changed in Google
            user = await prisma.user.update({
                where: { id: user.id },
                data: { avatar_url }
            });
        }

        // Enroll in drip campaign (idempotent — skips if already enrolled)
        try {
            const { enrollUser } = await import('../lib/drip-engine.js');
            await enrollUser(user.id, user.email);
        } catch (dripErr: any) {
            console.error('[Drip] OAuth enrollment failed:', dripErr.message);
        }

        // Generate JWT token
        const token = jwtSign(
            { userId: user.id, full_name: user.full_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Redirect back to frontend with token
        // Token is used as userId in current auth middleware, but we'll use actual JWT soon
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            avatar_url: user.avatar_url,
            role: user.role
        }))}`);

    } catch (error) {
        console.error('Google Auth Error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
});

// Google Sign-In via client-side ID token (works in WebViews / mobile)
router.post('/auth/google/token', async (req: any, res: any) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) throw new Error('No payload from Google');

        const { sub: googleId, email, name: full_name, picture: avatar_url } = payload;
        if (!email) throw new Error('No email from Google');

        // Find or create user (same logic as callback)
        let user = await prisma.user.findUnique({ where: { google_id: googleId } });

        if (!user) {
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        google_id: googleId,
                        avatar_url: avatar_url || user.avatar_url,
                        full_name: full_name || user.full_name
                    }
                });
            } else {
                try {
                    user = await prisma.user.create({
                        data: {
                            full_name: full_name || 'Commander',
                            email,
                            password: crypto.randomBytes(16).toString('hex'),
                            google_id: googleId,
                            avatar_url,
                            acquisition_source: 'Direct',
                            subscription: {
                                create: { plan: 'Free', maxInstances: 1, creditBalance: 10 }
                            }
                        }
                    });
                } catch (createErr: any) {
                    if (createErr.message?.includes('creditBalance')) {
                        user = await prisma.user.create({
                            data: {
                                full_name: full_name || 'Commander',
                                email,
                                password: crypto.randomBytes(16).toString('hex'),
                                google_id: googleId,
                                avatar_url,
                                acquisition_source: 'Direct',
                                subscription: {
                                    create: { plan: 'Free', maxInstances: 1 }
                                }
                            }
                        });
                    } else {
                        throw createErr;
                    }
                }
            }
        } else if (avatar_url && user.avatar_url !== avatar_url) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { avatar_url }
            });
        }

        // Enroll in drip campaign (idempotent)
        try {
            const { enrollUser } = await import('../lib/drip-engine.js');
            await enrollUser(user.id, user.email);
        } catch (dripErr: any) {
            console.error('[Drip] OAuth enrollment failed:', dripErr.message);
        }

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
                avatar_url: user.avatar_url,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Google Token Auth Error:', error);
        res.status(401).json({ error: 'Google authentication failed' });
    }
});

// ==========================================================================
// Apple Sign-In
// ==========================================================================

// Apple JWKS for verifying id_tokens
const appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Generate a short-lived Apple client secret JWT.
 * Apple doesn't use a static secret — you sign a JWT with your .p8 key.
 */
function generateAppleClientSecret(): string {
    const teamId = process.env.APPLE_TEAM_ID;
    const clientId = process.env.APPLE_CLIENT_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!teamId || !clientId || !keyId || !privateKey) {
        throw new Error('Apple Sign-In env vars not configured');
    }

    return jwtSign(
        {},
        privateKey,
        {
            algorithm: 'ES256',
            expiresIn: '180d',
            audience: 'https://appleid.apple.com',
            issuer: teamId,
            subject: clientId,
            keyid: keyId,
        }
    );
}

// Initiate Apple Sign-In
router.get('/auth/apple', (req, res) => {
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) {
        return res.status(500).json({ error: 'Apple Sign-In not configured' });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const redirectUri = `${backendUrl}/api/auth/apple/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        response_type: 'code id_token',
        response_mode: 'form_post',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'name email',
        state,
    });

    res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

// Apple OAuth Callback (POST — Apple uses form_post response mode)
router.post('/auth/apple/callback', express.urlencoded({ extended: true }), async (req: any, res: any) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        const { id_token, code, user: userParam } = req.body;
        if (!id_token) throw new Error('No id_token from Apple');

        // Verify the id_token with Apple's public keys
        const { payload } = await joseJwtVerify(id_token, appleJWKS, {
            issuer: 'https://appleid.apple.com',
            audience: process.env.APPLE_CLIENT_ID,
        });

        const appleId = payload.sub;
        const email = payload.email as string | undefined;

        if (!appleId) throw new Error('No sub in Apple id_token');

        // Apple sends user info (name) ONLY on first authorization, as a JSON string
        let appleUserInfo: { name?: { firstName?: string; lastName?: string } } = {};
        if (userParam) {
            try {
                appleUserInfo = typeof userParam === 'string' ? JSON.parse(userParam) : userParam;
            } catch (e) { /* ignore parse errors */ }
        }

        const appleName = [appleUserInfo?.name?.firstName, appleUserInfo?.name?.lastName]
            .filter(Boolean)
            .join(' ') || undefined;

        // 1. Try to find by Apple ID
        let user = await prisma.user.findUnique({ where: { apple_id: appleId } });

        // 2. If not found, try to find by email and link
        if (!user && email) {
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                // Link Apple account to existing user
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        apple_id: appleId,
                        full_name: appleName || user.full_name,
                    }
                });
            }
        }

        // 3. Create new user if not found
        if (!user) {
            const userEmail = email || `${appleId}@privaterelay.appleid.com`;
            try {
                user = await prisma.user.create({
                    data: {
                        full_name: appleName || 'Commander',
                        email: userEmail,
                        password: crypto.randomBytes(16).toString('hex'),
                        apple_id: appleId,
                        acquisition_source: 'Direct',
                        subscription: {
                            create: {
                                plan: 'Free',
                                maxInstances: 1,
                                creditBalance: 10
                            }
                        }
                    }
                });
            } catch (createErr: any) {
                // Fallback if creditBalance column not yet migrated
                if (createErr.message?.includes('creditBalance')) {
                    user = await prisma.user.create({
                        data: {
                            full_name: appleName || 'Commander',
                            email: userEmail,
                            password: crypto.randomBytes(16).toString('hex'),
                            apple_id: appleId,
                            acquisition_source: 'Direct',
                            subscription: {
                                create: { plan: 'Free', maxInstances: 1 }
                            }
                        }
                    });
                } else {
                    throw createErr;
                }
            }
        }

        // Enroll in drip campaign (idempotent)
        try {
            const { enrollUser } = await import('../lib/drip-engine.js');
            await enrollUser(user.id, user.email);
        } catch (dripErr: any) {
            console.error('[Drip] OAuth enrollment failed:', dripErr.message);
        }

        // Generate JWT token
        const token = jwtSign(
            { userId: user.id, full_name: user.full_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Redirect back to frontend with token (same as Google flow)
        res.redirect(`${frontendUrl}/login?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            avatar_url: user.avatar_url,
            role: user.role
        }))}`);

    } catch (error) {
        console.error('Apple Auth Error:', error);
        res.redirect(`${frontendUrl}/login?error=apple_auth_failed`);
    }
});

// Update Profile
router.put('/profile', async (req: any, res: any) => {
    // Basic verify middleware logic (inline for now or assume app.use calls it? 
    // Wait, auth routes are usually public except this one. 
    // server.ts mounts authRoutes at /api. Access control is usually needed.)

    // We need to verify token here because auth routes might not be globally protected in server.ts
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded: any = jwtVerify(token, JWT_SECRET);
        const userId = decoded.userId;

        const { full_name, avatar_url, password } = req.body;
        const data: any = {};
        if (full_name) data.full_name = full_name;
        if (avatar_url) data.avatar_url = avatar_url;
        if (password) {
            const bcrypt = await import('bcryptjs');
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data
        });

        // Return new token with updated info
        const newToken = jwtSign(
            { userId: user.id, full_name: user.full_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ user, token: newToken });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Account (permanent)
router.delete('/profile', async (req: any, res: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded: any = jwtVerify(token, JWT_SECRET);
        const userId = decoded.userId;

        // Require email confirmation in body
        const { confirmEmail } = req.body || {};
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (confirmEmail !== user.email) {
            return res.status(400).json({ error: 'Email confirmation does not match. Please type your email to confirm deletion.' });
        }

        // Stop all running bots for this user
        const userBots = await prisma.botConfig.findMany({ where: { userId } });
        for (const bot of userBots) {
            try {
                const { stopBot } = await import('../lib/bot-executor.js');
                await stopBot(bot.id);
            } catch (e) { /* ignore stop errors */ }
        }

        // Delete all related records in correct order (foreign key constraints)
        await prisma.creditTransaction.deleteMany({ where: { userId } });
        await prisma.order.deleteMany({ where: { userId } });
        await prisma.botConfig.deleteMany({ where: { userId } });
        await prisma.subscription.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });

        res.json({ success: true, message: 'Account permanently deleted.' });
    } catch (e: any) {
        console.error('Delete Account Error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
