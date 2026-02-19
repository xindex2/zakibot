import { Resend } from 'resend';

// ─── Resend Email Service ───────────────────────────────────────────────────
// All outbound emails go through Resend API.
// Env: RESEND_API_KEY
// ──────────────────────────────────────────────────────────────────────────────

const FROM_ADDRESS = 'Ezzaky @ OpenClaw Host <support@openclaw-host.com>';

let resend: Resend | null = null;

function getResend(): Resend {
    if (!resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('[Email] RESEND_API_KEY not set — emails will be logged only');
        }
        resend = new Resend(apiKey || 'dummy');
    }
    return resend;
}

export async function sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: { from?: string; replyTo?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.log(`[Email] (DRY RUN) To: ${to} | Subject: ${subject}`);
        return { success: true, id: 'dry-run' };
    }

    try {
        const { data, error } = await getResend().emails.send({
            from: options?.from || FROM_ADDRESS,
            to: [to],
            subject,
            html,
            replyTo: options?.replyTo || 'support@openclaw-host.com',
        });

        if (error) {
            console.error(`[Email] Failed to send to ${to}:`, error);
            return { success: false, error: error.message };
        }

        console.log(`[Email] Sent to ${to}: "${subject}" (id: ${data?.id})`);
        return { success: true, id: data?.id };
    } catch (err: any) {
        console.error(`[Email] Exception sending to ${to}:`, err.message);
        return { success: false, error: err.message };
    }
}
