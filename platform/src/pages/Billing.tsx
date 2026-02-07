import { CreditCard, Shield, Rocket, CheckCircle2, Bot, Zap, Crown, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Billing() {
    const plans = [
        {
            name: 'Free',
            price: '$0',
            icon: <Rocket size={24} />,
            agents: 1,
            features: ['1 Active Agent Slot', '1 Message Limit / Interaction', 'Community Support'],
            color: 'text-zinc-500',
            bg: 'bg-zinc-900/30'
        },
        {
            name: 'Starter',
            price: '$19',
            icon: <Zap size={24} />,
            agents: 1,
            features: ['1 Active Agent Slot', 'Standard Compute', 'Basic Connectors', 'Email Support'],
            color: 'text-zinc-400',
            bg: 'bg-zinc-900/50'
        },
        {
            name: 'Pro',
            price: '$69',
            icon: <Bot size={24} />,
            agents: 5,
            popular: true,
            features: ['5 Active Agent Slots', 'High Priority Compute', 'All Connectors', '24/7 Priority Support', 'Advanced Skills Pack'],
            color: 'text-red-500',
            bg: 'bg-zinc-900/80',
            border: 'border-red-600/30'
        },
        {
            name: 'Elite',
            price: '$99',
            icon: <Crown size={24} />,
            agents: 10,
            features: ['10 Active Agent Slots', 'Bespoke Private Nodes', 'Custom Skills Hosting', 'Dedicated Account Manager'],
            color: 'text-red-600',
            bg: 'bg-black'
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            icon: <Building2 size={24} />,
            agents: '∞',
            features: ['Unlimited Agents', 'On-Premise Deployment', 'Custom LLM Training', 'SLA Guaranteed Support'],
            color: 'text-white',
            bg: 'bg-zinc-900/30'
        },
    ];

    const checkoutLinks = {
        'Free': '#',
        'Starter': 'https://whop.com/checkout/plan_Ke7ZeyJO29DwZ',
        'Pro': 'https://whop.com/checkout/plan_9NRNdPMrVzwi8',
        'Elite': 'https://whop.com/checkout/plan_XXO2Ey0ki51AI',
        'Enterprise': 'mailto:support@openclaw-host.com'
    };

    return (
        <div className="space-y-12 max-w-6xl mx-auto py-12 px-4">
            <header className="text-center space-y-4">
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" /> Subscription Protocol
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">Fleet Capacity</h1>
                <p className="text-zinc-500 max-w-xl mx-auto text-sm font-medium">Select your operational scale. All plans include full access to the core engine and skill architecture.</p>

                {/* Usage Limit Hit Warning */}
                <div className="mt-8 p-4 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center justify-center gap-4 animate-pulse">
                    <Zap className="text-red-500" size={16} />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Capacity Limit reached? Upgrade your account to initialize more agents.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {plans.map((plan, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                            "p-8 rounded-3xl border flex flex-col relative group overflow-hidden",
                            plan.bg,
                            plan.border || "border-zinc-800",
                            plan.popular && "ring-1 ring-red-600/50"
                        )}
                    >
                        {plan.popular && (
                            <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl">
                                Recommended
                            </div>
                        )}
                        <div className={cn("mb-8", plan.color)}>{plan.icon}</div>
                        <h3 className="text-xl font-black text-white uppercase italic mb-1">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-8">
                            <span className="text-3xl font-black text-white tracking-tighter">{plan.price}</span>
                            {plan.price !== 'Custom' && plan.price !== '$0' && <span className="text-zinc-500 font-bold text-[10px] uppercase">/month</span>}
                        </div>

                        <ul className="space-y-4 mb-10 flex-1">
                            {plan.features.map((f, j) => (
                                <li key={j} className="flex items-start gap-3 text-[11px] font-medium text-zinc-400">
                                    <CheckCircle2 size={14} className="text-red-500 shrink-0 mt-0.5" />
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <a
                            href={checkoutLinks[plan.name as keyof typeof checkoutLinks]}
                            target={plan.name === 'Enterprise' ? '_self' : '_blank'}
                            rel="noopener noreferrer"
                            className={cn(
                                "w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all transform active:scale-95 shadow-xl text-center block",
                                plan.name === 'Free' ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
                                    plan.popular
                                        ? "bg-red-600 text-white shadow-red-600/20 hover:bg-red-700"
                                        : "bg-black text-zinc-400 hover:text-white border border-zinc-800"
                            )}
                            onClick={e => { if (plan.name === 'Free') e.preventDefault(); }}
                        >
                            {plan.name === 'Enterprise' ? 'Contact Intelligence' : plan.name === 'Free' ? 'Current Protocol' : 'Initialize Plan'}
                        </a>
                    </motion.div>
                ))}
            </div>

            <footer className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-black border border-zinc-800 rounded-2xl flex items-center justify-center text-red-500">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase italic tracking-wide">Secure Transaction Protocol</h4>
                        <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">Direct support: support@openclaw-host.com</p>
                    </div>
                </div>
                <div className="flex gap-4 grayscale opacity-40">
                    <CreditCard size={32} />
                    <Bot size={32} />
                </div>
            </footer>
        </div>
    );
}

function cn(...inputs: any) {
    return inputs.filter(Boolean).join(' ');
}
