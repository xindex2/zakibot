/**
 * Referral / Source Tracking
 *
 * Captures UTM params & referrer on first visit into localStorage so the
 * source survives Google OAuth redirects and multi-page flows.
 *
 * Usage:
 *   captureSource()  — call once on app init (Landing / App mount)
 *   getSource()      — read the stored source string
 *   clearSource()    — call after syncing to server
 */

const STORAGE_KEY = 'oc_acquisition_source';
const STORAGE_META_KEY = 'oc_acquisition_meta';

interface SourceMeta {
    source: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    timestamp: number;
}

/**
 * Capture UTM params & referrer from the current URL into localStorage.
 * Only captures once per visitor session (first touch wins).
 */
export function captureSource(): void {
    // Already captured? Skip
    if (localStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const ref = params.get('ref'); // custom ?ref=xxx links
    const referrer = document.referrer;

    let source = 'Direct';

    if (utmSource) {
        source = utmSource;
    } else if (ref) {
        source = ref;
    } else if (referrer) {
        try {
            const refUrl = new URL(referrer);
            const host = refUrl.hostname;
            if (host.includes('google')) source = 'Google';
            else if (host.includes('bing')) source = 'Bing';
            else if (host.includes('facebook') || host.includes('fb.me')) source = 'Facebook';
            else if (host.includes('twitter.com') || host.includes('t.co') || host.includes('x.com')) source = 'Twitter';
            else if (host.includes('youtube.com') || host.includes('youtu.be')) source = 'YouTube';
            else if (host.includes('reddit.com')) source = 'Reddit';
            else if (host.includes('tiktok.com')) source = 'TikTok';
            else if (host.includes('linkedin.com')) source = 'LinkedIn';
            else if (!host.includes(window.location.hostname)) source = `Referral: ${host}`;
        } catch { /* malformed referrer, keep Direct */ }
    }

    // Build composite label: "twitter (ad)" or just "twitter"
    let label = source;
    if (utmMedium) label += ` (${utmMedium})`;
    if (utmCampaign) label += ` [${utmCampaign}]`;

    localStorage.setItem(STORAGE_KEY, label);

    // Store metadata for potential future use
    const meta: SourceMeta = {
        source,
        medium: utmMedium || undefined,
        campaign: utmCampaign || undefined,
        referrer: referrer || undefined,
        timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
}

/**
 * Get the captured source string (e.g. "twitter (ad)")
 */
export function getSource(): string {
    return localStorage.getItem(STORAGE_KEY) || 'Direct';
}

/**
 * Clear stored source after it has been synced to the server
 */
export function clearSource(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
}

/**
 * Sync the captured source to the server for the authenticated user.
 * Call this after login/register/Google OAuth callback.
 */
export async function syncSourceToServer(token: string): Promise<void> {
    const source = getSource();
    if (!source || source === 'Direct') return; // nothing meaningful to sync

    try {
        await fetch('/api/users/source', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ source }),
        });
        clearSource();
    } catch (e) {
        console.warn('[SourceTracking] Failed to sync source:', e);
    }
}
