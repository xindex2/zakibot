/**
 * Detect if the app is running inside an iOS WebView (WKWebView).
 * Used to hide payment flows that violate Apple App Store Guideline 3.1.1.
 */
export function isIOSWebView(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // WKWebView doesn't include "Safari" in the UA string, but regular Safari does
    const isSafari = /Safari/.test(ua);
    const isWebView = isIOS && !isSafari;
    return isWebView;
}

/**
 * Open the billing page in the external browser (Safari) when in a WebView,
 * or navigate normally when on the web.
 */
export function openInExternalBrowser(path: string = '/billing') {
    const domain = window.location.origin || 'https://myclaw.host';
    // window.open with _blank in WKWebView opens Safari
    window.open(`${domain}${path}`, '_blank');
}
