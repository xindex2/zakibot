import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Key, Globe, Sparkles, Bot, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PlansEdit() {
    const { token } = useAuth();
    const [whopPlans, setWhopPlans] = useState<any[]>([]);
    const [creemPlans, setCreemPlans] = useState<any[]>([]);
    const [provider, setProvider] = useState('whop');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            const [whopRes, creemRes, provRes] = await Promise.all([
                fetch('/api/admin/plans', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/admin/creem-plans', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/payment-provider')
            ]);
            const whopData = await whopRes.json();
            const creemData = await creemRes.json();
            const provData = await provRes.json();
            setWhopPlans(Array.isArray(whopData) ? whopData : []);
            setCreemPlans(Array.isArray(creemData) ? creemData : []);
            setProvider(provData.provider || 'whop');
        } catch (err) {
            console.error('Failed to fetch plans:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveWhop = async (plan: any) => {
        setSaving(true);
        try {
            await fetch('/api/admin/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(plan)
            });
            fetchAll();
        } finally { setSaving(false); }
    };

    const handleSaveCreem = async (plan: any) => {
        setSaving(true);
        try {
            await fetch('/api/admin/creem-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(plan)
            });
            fetchAll();
        } finally { setSaving(false); }
    };

    const handleDeleteWhop = async (id: string) => {
        if (!confirm('Delete this Whop plan?')) return;
        try {
            await fetch(`/api/admin/plans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchAll();
        } catch (err) { console.error(err); }
    };

    const handleDeleteCreem = async (id: string) => {
        if (!confirm('Delete this Creem plan?')) return;
        try {
            await fetch(`/api/admin/creem-plans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchAll();
        } catch (err) { console.error(err); }
    };

    const addWhopPlan = (isCredit = false) => {
        setWhopPlans([...whopPlans, {
            whopPlanId: '',
            planName: isCredit ? 'Credits_5' : '',
            maxInstances: isCredit ? 0 : 1,
            checkoutUrl: '',
            _isNew: true
        }]);
    };

    const addCreemPlan = (isCredit = false) => {
        setCreemPlans([...creemPlans, {
            creemProductId: '',
            planName: isCredit ? 'Credits_5' : '',
            maxInstances: isCredit ? 0 : 1,
            checkoutUrl: '',
            _isNew: true
        }]);
    };

    const updateWhopPlan = (idx: number, field: string, value: any) => {
        const newPlans = [...whopPlans];
        newPlans[idx] = { ...newPlans[idx], [field]: value };
        setWhopPlans(newPlans);
    };

    const updateCreemPlan = (idx: number, field: string, value: any) => {
        const newPlans = [...creemPlans];
        newPlans[idx] = { ...newPlans[idx], [field]: value };
        setCreemPlans(newPlans);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-[#ff4d4d] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const isWhop = provider === 'whop';
    const plans = isWhop ? whopPlans : creemPlans;
    const webhookUrl = isWhop ? 'https://openclaw-host.com/api/webhooks/whop' : 'https://openclaw-host.com/api/webhooks/creem';

    // Separate subscription plans from credit packs
    const subscriptionPlans = plans.filter(p => !p.planName?.startsWith('Credits_'));
    const creditPacks = plans.filter(p => p.planName?.startsWith('Credits_'));

    const accentColor = isWhop ? 'blue' : 'purple';
    const providerName = isWhop ? 'Whop' : 'Creem';

    // Render a single plan card
    const renderPlanCard = (plan: any, idx: number, isCreditPack: boolean) => {
        const isWhopPlan = isWhop;
        const realIdx = plans.indexOf(plan);

        const update = (field: string, value: any) => {
            if (isWhopPlan) updateWhopPlan(realIdx, field, value);
            else updateCreemPlan(realIdx, field, value);
        };

        const save = () => {
            if (isWhopPlan) handleSaveWhop(plan);
            else handleSaveCreem(plan);
        };

        const del = () => {
            if (isWhopPlan) handleDeleteWhop(plan.id);
            else handleDeleteCreem(plan.id);
        };

        const idField = isWhopPlan ? 'whopPlanId' : 'creemProductId';
        const idLabel = isWhopPlan ? 'Whop Plan ID' : 'Creem Product ID';
        const idPlaceholder = isWhopPlan ? 'plan_...' : 'prod_...';

        return (
            <div key={`${plan.id || idx}-${realIdx}`} className="bg-white/2 border border-white/5 rounded-2xl p-6 space-y-5">
                <div className={`grid gap-4 ${isCreditPack ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
                    {/* Product / Plan ID */}
                    <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest text-${accentColor}-500/60 mb-2 block`}>
                            {idLabel}
                        </label>
                        <input
                            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 outline-none font-bold text-xs tracking-tight font-mono"
                            value={plan[idField] || ''}
                            readOnly={!plan._isNew}
                            onChange={(e) => update(idField, e.target.value)}
                            placeholder={idPlaceholder}
                        />
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest text-${accentColor}-500/60 mb-2 block`}>
                            {isCreditPack ? 'Credit Pack Name' : 'Display Name'}
                        </label>
                        <input
                            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 outline-none font-bold text-xs tracking-tight"
                            value={plan.planName || ''}
                            onChange={(e) => update('planName', e.target.value)}
                            placeholder={isCreditPack ? 'Credits_5 / Credits_10 / Credits_50' : 'Pro'}
                        />
                        {isCreditPack && (
                            <p className="text-[8px] text-zinc-600 mt-1.5 font-medium">
                                Format: Credits_AMOUNT (e.g. Credits_5 = $5 credit pack)
                            </p>
                        )}
                    </div>

                    {/* Agent Limit — only for subscription plans */}
                    {!isCreditPack && (
                        <div>
                            <label className={`text-[9px] font-black uppercase tracking-widest text-${accentColor}-500/60 mb-2 block`}>
                                Agent Limit
                            </label>
                            <input
                                type="number"
                                className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 outline-none font-bold text-xs tracking-tight text-cyan-400"
                                value={plan.maxInstances || ''}
                                onChange={(e) => update('maxInstances', e.target.value)}
                                placeholder="5"
                            />
                        </div>
                    )}

                    {/* Checkout URL */}
                    <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest text-${accentColor}-500/60 mb-2 block`}>
                            Checkout URL
                        </label>
                        <input
                            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 outline-none font-bold text-xs tracking-tight font-mono"
                            value={plan.checkoutUrl || ''}
                            onChange={(e) => update('checkoutUrl', e.target.value)}
                            placeholder={isWhopPlan ? 'https://whop.com/checkout/...' : 'https://creem.io/checkout/...'}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={save}
                        disabled={saving}
                        className={`bg-${accentColor}-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-${accentColor}-900/25 flex items-center gap-2`}
                        style={{ backgroundColor: isWhop ? '#2563eb' : '#9333ea' }}
                    >
                        <Save size={12} />
                        {plan._isNew ? 'Create' : 'Save'}
                    </button>
                    {!plan._isNew && (
                        <button
                            onClick={del}
                            className="p-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Plan Overrides</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">
                        {providerName} Product Mapping
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isWhop ? 'bg-blue-400' : 'bg-purple-400'}`}></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {providerName} Active
                        </span>
                    </div>
                </div>
            </div>

            {/* Webhook URL */}
            <div className="bg-white/2 border border-white/5 px-6 py-4 rounded-2xl flex items-center gap-4">
                <Globe size={16} className={isWhop ? 'text-blue-400' : 'text-purple-400'} />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Active Webhook URL</span>
                    <span className={`text-xs font-black italic ${isWhop ? 'text-blue-400' : 'text-purple-400'}`}>{webhookUrl}</span>
                </div>
            </div>

            {/* ===== SUBSCRIPTION PLANS SECTION ===== */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isWhop ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
                            <Bot size={14} className={isWhop ? 'text-blue-400' : 'text-purple-400'} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase italic tracking-tighter">Subscription Plans</h2>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Tier → Agent limit mapping & checkout links</p>
                        </div>
                    </div>
                    <button
                        onClick={() => isWhop ? addWhopPlan(false) : addCreemPlan(false)}
                        className="text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        style={{ backgroundColor: isWhop ? '#2563eb' : '#9333ea' }}
                    >
                        <Plus size={12} /> Add Plan
                    </button>
                </div>

                {subscriptionPlans.length === 0 ? (
                    <div className="bg-white/2 border border-white/5 border-dashed rounded-2xl p-10 text-center text-zinc-600">
                        <p className="text-xs font-bold">No subscription plans configured yet.</p>
                        <p className="text-[10px] mt-1">Click "Add Plan" to create a {providerName} plan mapping.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {subscriptionPlans.map((plan, idx) => renderPlanCard(plan, idx, false))}
                    </div>
                )}
            </div>

            {/* ===== CREDIT TOP-UP PACKS SECTION ===== */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                            <Sparkles size={14} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase italic tracking-tighter">Credit Top-Up Packs</h2>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">AI Credit packs users can purchase (shown on /topup page)</p>
                        </div>
                    </div>
                    <button
                        onClick={() => isWhop ? addWhopPlan(true) : addCreemPlan(true)}
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Add Credit Pack
                    </button>
                </div>

                {creditPacks.length === 0 ? (
                    <div className="bg-white/2 border border-emerald-500/10 border-dashed rounded-2xl p-10 text-center text-zinc-600">
                        <p className="text-xs font-bold">No credit packs configured yet.</p>
                        <p className="text-[10px] mt-1">
                            Add packs with name format <span className="text-emerald-400 font-mono">Credits_AMOUNT</span> (e.g. Credits_5 = $5 pack).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {creditPacks.map((plan, idx) => renderPlanCard(plan, idx, true))}
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-8 rounded-2xl flex items-start gap-6">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <Key className="text-blue-400" size={18} />
                </div>
                <div className="space-y-3">
                    <h3 className="text-base font-black italic uppercase tracking-tighter">How It Works</h3>
                    <div className="text-[11px] text-gray-500 leading-relaxed font-medium space-y-2">
                        <p><strong className="text-white/60">Subscription Plans:</strong> Map your {providerName} product IDs to plan names (Free, Starter, Pro, Elite). Set the agent limit for each tier and the checkout URL shown on the Billing page.</p>
                        <p><strong className="text-white/60">Credit Packs:</strong> Create credit top-up products with names like <code className="text-emerald-400 bg-white/5 px-1 rounded">Credits_5</code>, <code className="text-emerald-400 bg-white/5 px-1 rounded">Credits_10</code>, <code className="text-emerald-400 bg-white/5 px-1 rounded">Credits_50</code>. The number is the dollar amount. These appear on the /topup page.</p>
                        <p><strong className="text-white/60">Webhook:</strong> {isWhop
                            ? 'Verify that your Whop Dashboard secret matches the value configured in Settings. All incoming signals must pass SHA256 signature verification.'
                            : 'Verify that your Creem Dashboard webhook secret matches the value configured in Settings. All incoming events must pass the creem-signature HMAC-SHA256 verification.'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
