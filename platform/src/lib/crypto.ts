/**
 * Encryption utilities for sensitive data (API keys, tokens, secrets).
 * 
 * Uses AES-256-GCM for encryption/decryption.
 * The ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
 * If not set, a deterministic key is derived from JWT_SECRET as fallback.
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128-bit IV
const TAG_LENGTH = 16;  // 128-bit auth tag

function getEncryptionKey(): Buffer {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
        return Buffer.from(envKey, 'hex');
    }
    // Derive from JWT_SECRET as fallback
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_openclaw_host';
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing: IV + AuthTag + Ciphertext.
 * Returns empty string for empty/null input.
 */
export function encrypt(plaintext: string): string {
    if (!plaintext) return '';

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    // Pack: IV (16) + Tag (16) + Ciphertext
    const packed = Buffer.concat([iv, tag, encrypted]);
    return 'enc:' + packed.toString('base64');
}

/**
 * Decrypt a previously encrypted string.
 * Expects the 'enc:' prefix + base64 payload.
 * Returns the original plaintext, or the input unchanged if not encrypted.
 */
export function decrypt(ciphertext: string): string {
    if (!ciphertext) return '';

    // If it doesn't have the prefix, it's already plaintext (migration case)
    if (!ciphertext.startsWith('enc:')) return ciphertext;

    try {
        const key = getEncryptionKey();
        const packed = Buffer.from(ciphertext.slice(4), 'base64');

        const iv = packed.subarray(0, IV_LENGTH);
        const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = packed.subarray(IV_LENGTH + TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        // If decryption fails, return as-is (might be plain text from before encryption was added)
        console.warn('Decryption failed, returning raw value (possible migration)');
        return ciphertext;
    }
}

/**
 * List of BotConfig fields that contain sensitive data and should be encrypted.
 */
export const SENSITIVE_FIELDS = [
    'apiKey',
    'telegramToken',
    'discordToken',
    'slackBotToken',
    'slackAppToken',
    'feishuAppSecret',
    'feishuEncryptKey',
    'feishuVerificationToken',
    'webSearchApiKey',
    'captchaApiKey',
    'firecrawlApiKey',
    'apifyApiToken',
    'githubToken',
];

/**
 * Encrypt all sensitive fields in a config data object (before saving to DB).
 */
export function encryptSensitiveFields(data: Record<string, any>): Record<string, any> {
    const result = { ...data };
    for (const field of SENSITIVE_FIELDS) {
        if (result[field] && typeof result[field] === 'string' && !result[field].startsWith('enc:')) {
            result[field] = encrypt(result[field]);
        }
    }
    return result;
}

/**
 * Decrypt all sensitive fields in a config object (after reading from DB).
 */
export function decryptSensitiveFields(data: Record<string, any>): Record<string, any> {
    const result = { ...data };
    for (const field of SENSITIVE_FIELDS) {
        if (result[field] && typeof result[field] === 'string' && result[field].startsWith('enc:')) {
            result[field] = decrypt(result[field]);
        }
    }
    return result;
}

/**
 * Mask a sensitive value for display (show only last 4 chars).
 */
export function maskSensitive(value: string): string {
    if (!value || value.length <= 4) return '****';
    return '****' + value.slice(-4);
}
