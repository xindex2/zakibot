// ─── Email Templates ────────────────────────────────────────────────────────
// Branded HTML email templates for OpenClaw Host drip campaign.
// Each function returns { subject, html }.
// ──────────────────────────────────────────────────────────────────────────────

const BRAND_COLOR = '#ff4d4d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://openclaw-host.com';

function wrap(body: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111;border-radius:24px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 40px 16px;text-align:center;">
<span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;">Open<span style="color:${BRAND_COLOR};">Claw</span></span>
<span style="display:block;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">HOST</span>
</td></tr>

<!-- Body -->
<tr><td style="padding:16px 40px 40px;color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
${body}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
OpenClaw Host · AI Agent Platform<br>
<a href="${FRONTEND_URL}" style="color:rgba(255,255,255,0.3);text-decoration:none;">openclaw-host.com</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td align="center">
<a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;letter-spacing:1px;text-transform:uppercase;">
${text}
</a>
</td></tr>
</table>`;
}

// ─── Step 0: Welcome (Instant) ──────────────────────────────────────────────
export function welcomeEmail(name: string): { subject: string; html: string } {
    return {
        subject: '🎉 Welcome to OpenClaw! You have $10 free credits',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Welcome aboard, ${name}! 🚀</h2>
<p>Your OpenClaw Host account is ready. We've loaded <strong style="color:${BRAND_COLOR};">$10.00 in free credits</strong> to get you started — no credit card required.</p>

<p>Here's what you can do right now:</p>
<ul style="padding-left:20px;margin:16px 0;">
<li>🤖 Create your first AI agent in under 60 seconds</li>
<li>💬 Deploy to Telegram, Discord, WhatsApp & more</li>
<li>🧠 Use GPT-4o, Claude, Gemini — your choice</li>
</ul>

<p><strong>Watch this quick 60-second setup guide:</strong></p>
<p><a href="https://www.youtube.com/watch?v=BoQAmvbViAg" style="color:${BRAND_COLOR};font-weight:bold;">▶ How to Set Up Your First Agent</a></p>

${ctaButton('Create Your Agent', `${FRONTEND_URL}/dashboard`)}

<p style="font-size:13px;color:rgba(255,255,255,0.4);">Hit reply if you need any help — we're here for you!</p>
`)
    };
}

// ─── Step 1: Setup Nudge (+4 hours) ─────────────────────────────────────────
export function setupNudgeEmail(name: string): { subject: string; html: string } {
    return {
        subject: '🤖 Did you set up your first agent yet?',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Hey ${name} 👋</h2>
<p>We noticed you haven't created your first AI agent yet. It only takes <strong>60 seconds</strong> — seriously!</p>

<p>Here's the quick guide to get started:</p>
<p><a href="https://www.youtube.com/watch?v=BoQAmvbViAg" style="color:${BRAND_COLOR};font-weight:bold;">▶ Watch: Set Up Your First Agent (60 sec)</a></p>

<p>Your <strong style="color:${BRAND_COLOR};">$10 free credits</strong> are waiting. Don't let them go to waste!</p>

${ctaButton('Set Up Your Agent Now', `${FRONTEND_URL}/dashboard`)}
`)
    };
}

// ─── Step 2: Help Offer (Day 1) ─────────────────────────────────────────────
export function helpOfferEmail(name: string): { subject: string; html: string } {
    return {
        subject: '💡 Need help setting up your agent?',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">${name}, are you facing any issues?</h2>
<p>Setting up your first AI agent should be smooth, but we know things can sometimes get tricky.</p>

<p>Common questions we can help with:</p>
<ul style="padding-left:20px;margin:16px 0;">
<li>🔗 Connecting Telegram, Discord, or WhatsApp</li>
<li>🧠 Choosing the right AI model</li>
<li>⚙️ Configuring agent skills and tools</li>
<li>📁 Adding custom knowledge to your agent</li>
</ul>

<p>Just <strong>reply to this email</strong> and we'll personally help you get set up!</p>

${ctaButton('Go to Dashboard', `${FRONTEND_URL}/dashboard`)}
`)
    };
}

// ─── Step 3: Multi-Agent Feature (Day 2) ────────────────────────────────────
export function multiAgentEmail(name: string): { subject: string; html: string } {
    return {
        subject: '🤖 Did you know? Multi-agent support is here!',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">${name}, one agent is just the start 💪</h2>
<p>With OpenClaw Host, you can deploy <strong>multiple AI agents</strong> — each with its own personality, knowledge, and channels.</p>

<p>Use cases our users love:</p>
<ul style="padding-left:20px;margin:16px 0;">
<li>🏢 <strong>Customer Support Bot</strong> — handles FAQs 24/7</li>
<li>📊 <strong>Sales Agent</strong> — qualifies leads on WhatsApp</li>
<li>📝 <strong>Content Assistant</strong> — helps your team write</li>
<li>🎓 <strong>Training Bot</strong> — onboards new employees</li>
</ul>

<p>Free plan includes 1 agent. <strong>Upgrade to unlock up to 10 agents!</strong></p>

${ctaButton('Explore Plans', `${FRONTEND_URL}/billing`)}
`)
    };
}

// ─── Step 4: Upgrade CTA (Day 3) ────────────────────────────────────────────
export function upgradeCTAEmail(name: string): { subject: string; html: string } {
    return {
        subject: '⚡ Upgrade your account — unlock full power',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">${name}, ready to go pro? ⚡</h2>
<p>Your free credits are a taste of what OpenClaw can do. Here's what you unlock with an upgrade:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr>
<td style="padding:12px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
<p style="margin:0 0 8px;font-weight:800;color:#fff;">🚀 Starter — $29/mo</p>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">1 always-on agent • Auto-restart • All channels</p>
</td>
</tr>
<tr><td style="height:8px;"></td></tr>
<tr>
<td style="padding:12px;background:rgba(255,77,77,0.08);border-radius:12px;border:1px solid rgba(255,77,77,0.15);">
<p style="margin:0 0 8px;font-weight:800;color:#fff;">💎 Pro — $69/mo <span style="color:${BRAND_COLOR};font-size:11px;">POPULAR</span></p>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">5 agents • Priority support • Advanced tools</p>
</td>
</tr>
<tr><td style="height:8px;"></td></tr>
<tr>
<td style="padding:12px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
<p style="margin:0 0 8px;font-weight:800;color:#fff;">👑 Elite — $99/mo</p>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">10 agents • White-label • Everything included</p>
</td>
</tr>
</table>

${ctaButton('Upgrade Now', `${FRONTEND_URL}/billing`)}
`)
    };
}

// ─── Step 5: Price Rising (Day 5) ───────────────────────────────────────────
export function priceRisingEmail(name: string): { subject: string; html: string } {
    return {
        subject: '📢 Price going up soon — lock in today\'s rate',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Heads up, ${name} 📢</h2>
<p>We're planning a price increase as we add more features and capabilities to OpenClaw Host.</p>

<p><strong style="color:${BRAND_COLOR};">If you upgrade now, you'll be locked in at today's price forever.</strong></p>

<p>That means:</p>
<ul style="padding-left:20px;margin:16px 0;">
<li>✅ Current pricing guaranteed for life</li>
<li>✅ All future features included</li>
<li>✅ Priority access to new capabilities</li>
</ul>

<p>Don't miss out — early adopters always win.</p>

${ctaButton('Lock In Your Price', `${FRONTEND_URL}/billing`)}
`)
    };
}

// ─── Step 6: Last Chance (Day 6) ────────────────────────────────────────────
export function lastChanceEmail(name: string): { subject: string; html: string } {
    return {
        subject: '⏰ Last chance to upgrade at current pricing',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Final reminder, ${name} ⏰</h2>
<p>This is your <strong>last chance</strong> to lock in the current pricing before rates go up.</p>

<p style="background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.2);border-radius:12px;padding:16px;text-align:center;">
<strong style="color:${BRAND_COLOR};font-size:18px;">Prices increase soon</strong><br>
<span style="font-size:13px;color:rgba(255,255,255,0.5);">Upgrade today and your rate is locked forever</span>
</p>

${ctaButton('Upgrade Before It\'s Too Late', `${FRONTEND_URL}/billing`)}

<p style="font-size:13px;color:rgba(255,255,255,0.4);">If you have questions, just hit reply — we're happy to help.</p>
`)
    };
}

// ─── Step 7: Inactive Warning (Day 7) ───────────────────────────────────────
export function inactiveWarningEmail(name: string): { subject: string; html: string } {
    return {
        subject: '⚠️ Your free account is inactive',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">${name}, we miss you! 💔</h2>
<p>It's been a week since you signed up, and your account is still sitting idle.</p>

<p>We built OpenClaw Host to help people like you deploy AI agents effortlessly. Your <strong style="color:${BRAND_COLOR};">$10 free credits</strong> won't last forever.</p>

<p><strong>Here's what you're missing:</strong></p>
<ul style="padding-left:20px;margin:16px 0;">
<li>🤖 AI agents that work 24/7 on Telegram, Discord, WhatsApp</li>
<li>🧠 Access to GPT-4o, Claude, Gemini & more</li>
<li>⚡ Deploy in 60 seconds, no coding required</li>
</ul>

<p>Come back and give it a try — we promise it's worth it.</p>

${ctaButton('Reactivate My Account', `${FRONTEND_URL}/dashboard`)}

<p style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:24px;">Inactive free accounts may be removed in the future to keep the platform running smoothly.</p>
`)
    };
}

// ─── Password Reset Email ───────────────────────────────────────────────────
export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string } {
    return {
        subject: '🔐 Reset your OpenClaw password',
        html: wrap(`
<h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Password Reset</h2>
<p>Hi ${name}, we received a request to reset your password.</p>
<p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>

${ctaButton('Reset Password', resetUrl)}

<p style="font-size:13px;color:rgba(255,255,255,0.4);">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
`)
    };
}

// ─── Template Dispatcher ────────────────────────────────────────────────────
export function getDripTemplate(step: number, name: string): { subject: string; html: string } | null {
    switch (step) {
        case 0: return welcomeEmail(name);
        case 1: return setupNudgeEmail(name);
        case 2: return helpOfferEmail(name);
        case 3: return multiAgentEmail(name);
        case 4: return upgradeCTAEmail(name);
        case 5: return priceRisingEmail(name);
        case 6: return lastChanceEmail(name);
        case 7: return inactiveWarningEmail(name);
        default: return null;
    }
}
