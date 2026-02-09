import { useState, useEffect } from 'react';
import { Sparkles, Zap, ArrowLeft, TrendingUp, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CREDIT_PACKS = [
    { amount: 5, price: '$5', popular: false, label: 'Starter Pack' },
    { amount: 10, price: '$10', popular: true, label: 'Standard Pack' },
    { amount: 25, price: '$25', popular: false, label: 'Power Pack' },
    { amount: 50, price: '$50', popular: false, label: 'Pro Pack' },
    { amount: 100, price: '$100', popular: false, label: 'Enterprise Pack' },
];

export default function TopUpCredits() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [provider, setProvider] = useState('whop');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        // Fetch balance
        fetch('/api/credits/balance', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => setBalance(data.balance ?? 0))
            .catch(() => { });

        // Fetch recent transactions
        fetch('/api/credits/usage', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setTransactions(data.slice(0, 10)); })
            .catch(() => { });

        // Fetch active payment provider
        fetch('/api/payment-provider')
            .then(r => r.json())
            .then(data => setProvider(data.provider || 'whop'))
            .catch(() => { });

        setLoading(false);
    }, [token]);

    const handlePurchase = (amount: number) => {
        // Redirect to the Creem or Whop checkout for credit purchase
        // The admin should configure credit pack checkout URLs
        // For now, redirect to billing with amount param
        if (provider === 'creem') {
            // Use Creem checkout URL for credits
            window.open(`https://creem.io/checkout?amount=${amount}&type=credits`, '_blank');
        } else {
            // Use Whop checkout URL for credits
            window.open(`https://whop.com/openclaw-host/?credits=${amount}`, '_blank');
        }
    };

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
                            <p className="text-3xl font-black text-emerald-400">${balance.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-xl">
                        <TrendingUp size={14} className="text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active</span>
                    </div>
                </div>
            </motion.div>

            {/* Credit Packs */}
            <div className="space-y-4">
                <h2 className="text-sm font-black text-white uppercase italic tracking-wide">Choose Credit Amount</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CREDIT_PACKS.map((pack, i) => (
                        <motion.div
                            key={pack.amount}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className={`relative p-6 rounded-2xl border flex flex-col items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group ${pack.popular
                                    ? 'bg-emerald-900/20 border-emerald-500/30 ring-1 ring-emerald-500/20'
                                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                }`}
                            onClick={() => handlePurchase(pack.amount)}
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
                                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${pack.popular
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                                    }`}
                            >
                                <CreditCard size={12} className="inline mr-2" />
                                Purchase
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
