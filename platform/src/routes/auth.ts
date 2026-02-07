import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
                // 3. Create new user
                user = await prisma.user.create({
                    data: {
                        full_name: full_name || 'Commander',
                        email,
                        password: crypto.randomBytes(16).toString('hex'), // Random password for OAuth users
                        google_id: googleId,
                        avatar_url,
                        acquisition_source: 'Google Auth'
                    }
                });
            }
        } else if (avatar_url && user.avatar_url !== avatar_url) {
            // Update avatar if it changed in Google
            user = await prisma.user.update({
                where: { id: user.id },
                data: { avatar_url }
            });
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
        if (password) data.password = password; // Should hash ideally

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

export default router;
