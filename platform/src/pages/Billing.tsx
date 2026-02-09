import { useState, useEffect } from 'react';
import { CreditCard, Shield, Rocket, CheckCircle2, Bot, Zap, Crown, Building2, Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

function cn(...inputs: any) {
    return inputs.filter(Boolean).join(' ');
}

const PLAN_ORDER = ['Free', 'Starter', 'Pro', 'Elite', 'Enterprise'];

export default function Billing() {
    const { user, token } = useAuth();
    const [subscription, setSubscription] = useState<any>(null);
    const [provider, setProvider] = useState('whop');
    const [creemPlans, setCreemPlans] = useState<any[]>([]);

    useEffect(() => {
        if (!token) return;
        fetch('/api/subscription', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setSubscription(data); })
            .catch(() => { });

        // Fetch active payment provider
        fetch('/api/payment-provider')
            .then(r => r.json())
            .then(data => setProvider(data.provider || 'whop'))
            .catch(() => { });

        // Fetch Creem plans for checkout URLs
        fetch('/api/creem-plans')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setCreemPlans(data); })
            .catch(() => { });
    }, [token]);

    const currentPlan = subscription?.plan || 'Free';
    const currentPlanIdx = PLAN_ORDER.indexOf(currentPlan);

    const getButtonLabel = (planName: string) => {
        const planIdx = PLAN_ORDER.indexOf(planName);
        if (planName === currentPlan) return 'Current Plan';
        if (planName === 'Enterprise') return 'Contact Sales';
        if (planIdx > currentPlanIdx) return 'Upgrade';
        return 'Downgrade';
    };

    const getButtonStyle = (planName: string, popular: boolean | undefined) => {
        if (planName === currentPlan) return 'bg-green-600/20 text-green-400 border border-green-500/30 cursor-default';
        if (planName === 'Enterprise') return 'bg-black text-zinc-400 hover:text-white border border-zinc-800';
        if (popular) return 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-700';
        return 'bg-black text-zinc-400 hover:text-white border border-zinc-800';
    };

    const plans = [
        {
            name: 'Starter',
            price: '$29',
            icon: <Zap size={24} />,
            agents: 1,
            features: ['1 Active Agent Slot', '$10 in API Credits Included', 'Standard Compute', 'Basic Connectors', 'Email Support'],
            color: 'text-zinc-400',
            bg: 'bg-zinc-900/50'
        },
        {
            name: 'Pro',
            price: '$69',
            icon: <Bot size={24} />,
            agents: 5,
            popular: true,
            features: ['5 Active Agent Slots', '$10 in API Credits Included', 'High Priority Compute', 'All Connectors', '24/7 Priority Support', 'Advanced Skills Pack'],
            color: 'text-red-500',
            bg: 'bg-zinc-900/80',
            border: 'border-red-600/30'
        },
        {
            name: 'Elite',
            price: '$99',
            icon: <Crown size={24} />,
            agents: 10,
            features: ['10 Active Agent Slots', '$10 in API Credits Included', 'Bespoke Private Nodes', 'Custom Skills Hosting', 'Dedicated Account Manager'],
            color: 'text-red-600',
            bg: 'bg-black'
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            icon: <Building2 size={24} />,
            agents: '∞',
            features: ['Unlimited Agents', '$10 in API Credits Included', 'On-Premise Deployment', 'Custom LLM Training', 'SLA Guaranteed Support'],
            color: 'text-white',
            bg: 'bg-zinc-900/30'
        },
    ];

    // Whop checkout links (hardcoded fallback)
    const whopLinks: Record<string, string> = {
        'Free': '#',
        'Starter': 'https://whop.com/checkout/plan_Ke7ZeyJO29DwZ',
        'Pro': 'https://whop.com/checkout/plan_9NRNdPMrVzwi8',
        'Elite': 'https://whop.com/checkout/plan_XXO2Ey0ki51AI',
        'Enterprise': 'mailto:support@openclaw-host.com'
    };

    // Build Creem checkout links from plan records
    const creemLinks: Record<string, string> = { 'Free': '#', 'Enterprise': 'mailto:support@openclaw-host.com' };
    creemPlans.forEach(cp => {
        if (cp.planName && cp.checkoutUrl) {
            creemLinks[cp.planName] = cp.checkoutUrl;
        }
    });

    const checkoutLinks = provider === 'creem' ? creemLinks : whopLinks;

    return (
        <div className="space-y-8 md:space-y-12 max-w-5xl mx-auto py-6 md:py-12 px-4">
            <header className="text-center space-y-4">
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" /> Subscription Protocol
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase italic">Fleet Capacity</h1>
                <p className="text-zinc-500 max-w-xl mx-auto text-sm font-medium">Select your operational scale. All plans include full access to the core engine and skill architecture.</p>

                {/* Current Plan Badge */}
                <div className="mt-6 inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Your current plan:</span>
                    <span className="text-sm font-black text-white uppercase italic">{currentPlan}</span>
                    {subscription?.maxInstances && (
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                            ({subscription.currentCount || 0}/{subscription.maxInstances} agents)
                        </span>
                    )}
                </div>

                {/* Usage Limit Hit Warning */}
                {subscription && subscription.currentCount >= subscription.maxInstances && (
                    <div className="mt-4 p-4 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center justify-center gap-4 animate-pulse">
                        <Zap className="text-red-500" size={16} />
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Capacity Limit reached! Upgrade your plan to deploy more agents.</p>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {plans.map((plan, i) => {
                    const isCurrent = plan.name === currentPlan;
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn(
                                "p-6 md:p-8 rounded-2xl md:rounded-3xl border flex flex-col relative group overflow-hidden",
                                plan.bg,
                                isCurrent ? "border-green-500/30 ring-1 ring-green-500/20" : plan.border || "border-zinc-800",
                                plan.popular && !isCurrent && "ring-1 ring-red-600/50"
                            )}
                        >
                            {isCurrent && (
                                <div className="absolute top-0 left-0 right-0 bg-green-600/20 text-green-400 text-[8px] font-black uppercase tracking-widest px-4 py-1.5 text-center border-b border-green-500/20">
                                    ✓ Your Current Plan
                                </div>
                            )}
                            {plan.popular && !isCurrent && (
                                <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl">
                                    Recommended
                                </div>
                            )}
                            <div className={cn("mb-6 md:mb-8", plan.color, isCurrent && "mt-4")}>{plan.icon}</div>
                            <h3 className="text-lg md:text-xl font-black text-white uppercase italic mb-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mb-6 md:mb-8">
                                <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">{plan.price}</span>
                                {plan.price !== 'Custom' && plan.price !== '$0' && <span className="text-zinc-500 font-bold text-[10px] uppercase">/month</span>}
                            </div>

                            <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10 flex-1">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-start gap-3 text-[11px] font-medium text-zinc-400">
                                        <CheckCircle2 size={14} className={cn("shrink-0 mt-0.5", isCurrent ? "text-green-500" : "text-red-500")} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={isCurrent ? '#' : checkoutLinks[plan.name]}
                                target={plan.name === 'Enterprise' || isCurrent ? '_self' : '_blank'}
                                rel="noopener noreferrer"
                                className={cn(
                                    "w-full py-3 md:py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all transform active:scale-95 shadow-xl text-center block",
                                    getButtonStyle(plan.name, plan.popular)
                                )}
                                onClick={e => { if (isCurrent || plan.name === 'Free') e.preventDefault(); }}
                            >
                                {getButtonLabel(plan.name)}
                            </a>
                        </motion.div>
                    );
                })}
            </div>

            {/* Credits Top-Up Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
                            <Sparkles size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="text-white font-black text-sm uppercase italic tracking-wide">API Credits</h4>
                            <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">Use platform-managed API keys instead of your own</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <span className="text-2xl font-black text-emerald-400">${subscription?.creditBalance?.toFixed(2) ?? '0.00'}</span>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Balance</p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!token) return;
                                try {
                                    const resp = await fetch('/api/credits/topup', {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                                    });
                                    if (resp.ok) {
                                        const data = await resp.json();
                                        setSubscription((prev: any) => ({ ...prev, creditBalance: data.newBalance }));
                                        alert('$10 credits added successfully!');
                                    }
                                } catch (e) { }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-6 rounded-xl transition-all text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-emerald-600/20"
                        >
                            <Plus size={14} /> Top Up $10
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-zinc-600 mt-4 text-center sm:text-left">Or bring your own API key for unlimited usage — configure per-agent in the Dashboard.</p>
            </div>

            <footer className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl md:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
                <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-black border border-zinc-800 rounded-xl md:rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                        <Shield size={20} />
                    </div>
                    <div className="text-center sm:text-left">
                        <h4 className="text-white font-bold text-xs md:text-sm uppercase italic tracking-wide">Secure Transaction Protocol</h4>
                        <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">Direct support: support@openclaw-host.com</p>
                    </div>
                </div>
                <div className="flex gap-4 grayscale opacity-40">
                    <CreditCard size={28} />
                    <Bot size={28} />
                </div>
            </footer>
        </div>
    );
}
