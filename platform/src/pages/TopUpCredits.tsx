import { useState, useEffect } from 'react';
import { Sparkles, Zap, ArrowLeft, TrendingUp, CreditCard, AlertTriangle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isIOSWebView } from '../lib/webview-detect';
import IOSWebViewBanner from '../components/IOSWebViewBanner';

interface CreditPack {
    amount: number;
    price: string;
    checkoutUrl: string;
    productId: string;
}

// Fallback packs shown when no Creem/Whop credit products are configured yet
const DEFAULT_PACKS = [
    { amount: 5, price: '$5', label: 'Starter Pack' },
    { amount: 10, price: '$10', label: 'Standard Pack', popular: true },
    { amount: 25, price: '$25', label: 'Power Pack' },
    { amount: 50, price: '$50', label: 'Pro Pack' },
    { amount: 100, price: '$100', label: 'Enterprise Pack' },
];

export default function TopUpCredits() {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    // iOS WebView: show redirect banner instead of payment UI
    if (isIOSWebView()) {
        return <IOSWebViewBanner type="credits" />;
    }
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [packsConfigured, setPacksConfigured] = useState(false);

    useEffect(() => {
        if (!token) return;

        // Fetch balance
        fetch('/api/credits/balance', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => setBalance(data.balance ?? 0))
            .catch(() => { });

        // Fetch available credit packs from server
        fetch('/api/credits/packs')
            .then(r => r.json())
            .then((data: CreditPack[]) => {
                if (Array.isArray(data) && data.length > 0) {
                    setCreditPacks(data);
                    setPacksConfigured(true);
                }
            })
            .catch(() => { });

        // Fetch recent transactions
        fetch('/api/credits/usage', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setTransactions(data.slice(0, 10)); })
            .catch(() => { });

        setLoading(false);
    }, [token]);

    const handlePurchase = async (pack: CreditPack | typeof DEFAULT_PACKS[0]) => {
        if ('checkoutUrl' in pack && pack.checkoutUrl) {
            // Build URL with email prefilled
            const appendEmail = (url: string) => {
                try {
                    const u = new URL(url);
                    if (user?.email) {
                        u.searchParams.set('email', user.email);
                        u.searchParams.set('customer_email', user.email);
                    }
                    return u.toString();
                } catch { return url; }
            };

            try {
                const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        checkoutUrl: pack.checkoutUrl,
                        planName: `Credits_${pack.amount}`,
                        type: 'credit_topup',
                        amount: pack.amount,
                        productId: ('productId' in pack ? pack.productId : null) || null,
                    }),
                });
                const data = await res.json();
                if (data.url) {
                    window.open(data.url, '_blank');
                    return;
                } else if (data.fallbackUrl) {
                    console.warn('Creem API failed, using fallback:', data.error);
                    alert(`Creem API error: ${data.error || 'Unknown error'}. Opening direct link (email won't be prefilled).`);
                    window.open(data.fallbackUrl, '_blank');
                    return;
                } else {
                    alert(`Checkout error: ${data.error || 'Could not create checkout'}. Check your Creem API key in Admin Settings.`);
                }
            } catch {
                alert('Network error creating checkout. Opening direct link.');
                window.open(pack.checkoutUrl, '_blank');
            }
        } else {
            alert('Credit packs are not yet configured. Please contact support or ask your admin to set up credit products in the admin panel (Plans > Add Credit Pack).');
        }
    };

    // Build display list from server packs or fallback defaults
    const packLabels: Record<number, string> = { 5: 'Starter Pack', 10: 'Standard Pack', 25: 'Power Pack', 50: 'Pro Pack', 100: 'Enterprise Pack' };
    const displayPacks = packsConfigured
        ? creditPacks.map(p => ({
            amount: p.amount,
            price: p.price,
            label: packLabels[p.amount] || `$${p.amount} Credits`,
            popular: p.amount === 10,
            checkoutUrl: p.checkoutUrl,
            productId: p.productId
        }))
        : DEFAULT_PACKS.map(p => ({
            ...p,
            checkoutUrl: '',
            productId: ''
        }));

    return (
        <div className="space-y-8 md:space-y-12 max-w-4xl mx-auto py-6 md:py-12 px-4">
            {/* Header */}
            <header className="space-y-4">
                <button
                    onClick={() => navigate(-1)}
                    className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="text-center space-y-4">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" /> Credit Top-Up
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase italic">
                        Add Credits
                    </h1>
                    <p className="text-zinc-500 max-w-xl mx-auto text-sm font-medium">
                        Purchase AI credits to power your agents. Credits are used for model API calls when using platform-managed keys.
                    </p>
                </div>
            </header>

            {/* Current Balance Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-900/20 to-emerald-800/10 border border-emerald-500/20 rounded-2xl md:rounded-3xl p-6 md:p-8"
            >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                            <Sparkles size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-bold">Current Balance</p>
                            <p className="text-3xl font-black text-emerald-400">${balance.toFixed(4)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-xl">
                        <TrendingUp size={14} className="text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                            {balance > 0 ? 'Active' : 'Empty'}
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Not configured warning */}
            {!packsConfigured && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs text-amber-300 font-bold">Credit packs not yet configured</p>
                        <p className="text-[10px] text-amber-400/60 mt-1">
                            Admin: Go to Admin Panel → Plans → Add credit products with names like <code className="bg-black/30 px-1 rounded">Credits_5</code>, <code className="bg-black/30 px-1 rounded">Credits_10</code>, <code className="bg-black/30 px-1 rounded">Credits_25</code> etc. with their Creem checkout URLs.
                        </p>
                    </div>
                </div>
            )}

            {/* Credit Packs */}
            <div className="space-y-4">
                <h2 className="text-sm font-black text-white uppercase italic tracking-wide">Choose Credit Amount</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayPacks.map((pack, i) => (
                        <motion.div
                            key={pack.amount}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className={`relative p-6 rounded-2xl border flex flex-col items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group ${pack.popular
                                ? 'bg-emerald-900/20 border-emerald-500/30 ring-1 ring-emerald-500/20'
                                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                }`}
                            onClick={() => handlePurchase(pack)}
                        >
                            {pack.popular && (
                                <div className="absolute -top-2.5 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                                    Most Popular
                                </div>
                            )}
                            <div className="text-center">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{pack.label}</p>
                                <p className="text-3xl font-black text-white">{pack.price}</p>
                                <p className="text-xs text-zinc-500 mt-1">${pack.amount} in AI credits</p>
                            </div>
                            <button
                                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${pack.popular
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                                    }`}
                            >
                                <CreditCard size={12} />
                                Purchase
                                <ExternalLink size={10} />
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Recent Transactions */}
            {transactions.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-sm font-black text-white uppercase italic tracking-wide">Recent Transactions</h2>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                        {transactions.map((tx, i) => (
                            <div
                                key={tx.id || i}
                                className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/50 last:border-b-0"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                                        }`}>
                                        {tx.amount > 0
                                            ? <Zap size={14} className="text-emerald-400" />
                                            : <TrendingUp size={14} className="text-red-400 rotate-180" />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-xs text-white font-bold">{tx.description || tx.type}</p>
                                        <p className="text-[10px] text-zinc-600">
                                            {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-sm font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Footer */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 text-center">
                <p className="text-[10px] text-zinc-500 font-medium">
                    Credits are used for AI model API calls when using platform-managed keys.
                    Bring your own API key for unlimited usage — configure per-agent in the Dashboard.
                </p>
            </div>
        </div>
    );
}
