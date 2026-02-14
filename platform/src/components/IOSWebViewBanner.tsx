import { ExternalLink, Smartphone } from 'lucide-react';
import { openInExternalBrowser } from '../lib/webview-detect';

/**
 * Banner shown in iOS WebView to redirect users to Safari for purchases.
 * Apple App Store Guideline 3.1.1 — digital purchases must use IAP or be handled outside the app.
 */
export default function IOSWebViewBanner({ type = 'billing' }: { type?: 'billing' | 'credits' }) {
    const path = type === 'credits' ? '/top-up' : '/billing';
    const label = type === 'credits' ? 'purchase credits' : 'manage your subscription';

    return (
        <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-6">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto">
                <Smartphone size={28} className="text-zinc-500" />
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-black text-white uppercase italic tracking-tight">
                    Open in Browser
                </h2>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                    To {label}, please open <strong className="text-white">myclaw.host</strong> in your browser.
                </p>
            </div>
            <button
                onClick={() => openInExternalBrowser(path)}
                className="inline-flex items-center gap-3 bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-red-500 active:scale-95 transition-all shadow-xl shadow-red-600/20"
            >
                <ExternalLink size={16} />
                Open in Safari
            </button>
            <p className="text-[10px] text-zinc-600 font-medium max-w-sm mx-auto">
                Your purchases and subscriptions are managed through our website and will be reflected in your app automatically.
            </p>
        </div>
    );
}
