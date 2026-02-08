import { useState, useEffect } from 'react';
import { Settings, Plus, Save, Trash2, Key, Globe, Info } from 'lucide-react';
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

    const addCreemPlan = () => {
        setCreemPlans([...creemPlans, { creemProductId: '', planName: '', maxInstances: 1, checkoutUrl: '', _isNew: true }]);
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

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Plan Overrides</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">
                        {isWhop ? 'Whop' : 'Creem'} Product Mapping
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Provider indicator */}
                    <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isWhop ? 'bg-blue-400' : 'bg-purple-400'}`}></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {isWhop ? 'Whop' : 'Creem'} Active
                        </span>
                    </div>

                    {!isWhop && (
                        <button
                            onClick={addCreemPlan}
                            className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus size={14} />
                            Add Plan
                        </button>
                    )}
                </div>
            </div>

            {/* Webhook URL */}
            <div className="bg-white/2 border border-white/5 px-8 py-4 rounded-2xl flex items-center gap-4">
                <Globe size={16} className={isWhop ? 'text-blue-400' : 'text-purple-400'} />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Active Webhook URL</span>
                    <span className={`text-xs font-black italic ${isWhop ? 'text-blue-400' : 'text-purple-400'}`}>{webhookUrl}</span>
                </div>
            </div>

            {/* Plans List */}
            <div className="grid grid-cols-1 gap-8">
                {plans.length === 0 && (
                    <div className="text-center py-20 text-gray-600">
                        <p className="text-sm font-bold">No plans configured for {isWhop ? 'Whop' : 'Creem'} yet.</p>
                        {!isWhop && <p className="text-xs mt-2">Click "Add Plan" above to create a plan mapping.</p>}
                    </div>
                )}

                {isWhop ? (
                    /* Whop Plans */
                    whopPlans.map((plan, idx) => (
                        <div key={idx} className="bg-white/2 border border-white/5 rounded-[3rem] p-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="flex-1 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#ff4d4d] mb-4 block opacity-60">Whop Plan ID</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight"
                                            value={plan.whopPlanId}
                                            readOnly
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#ff4d4d] mb-4 block opacity-60">Display Name</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight"
                                            value={plan.planName}
                                            onChange={(e) => {
                                                const newPlans = [...whopPlans];
                                                newPlans[idx].planName = e.target.value;
                                                setWhopPlans(newPlans);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#ff4d4d] mb-4 block opacity-60">Agent Limit</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight text-cyan-400"
                                            value={plan.maxInstances}
                                            onChange={(e) => {
                                                const newPlans = [...whopPlans];
                                                newPlans[idx].maxInstances = e.target.value;
                                                setWhopPlans(newPlans);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleSaveWhop(plan)}
                                disabled={saving}
                                className="bg-[#ff4d4d] text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff4d4d]/25"
                            >
                                Sync Plan
                            </button>
                        </div>
                    ))
                ) : (
                    /* Creem Plans */
                    creemPlans.map((plan, idx) => (
                        <div key={idx} className="bg-white/2 border border-white/5 rounded-[3rem] p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-4 block opacity-60">Creem Product ID</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight font-mono"
                                        value={plan.creemProductId}
                                        readOnly={!plan._isNew}
                                        onChange={(e) => {
                                            const newPlans = [...creemPlans];
                                            newPlans[idx].creemProductId = e.target.value;
                                            setCreemPlans(newPlans);
                                        }}
                                        placeholder="prod_..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-4 block opacity-60">Display Name</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight"
                                        value={plan.planName}
                                        onChange={(e) => {
                                            const newPlans = [...creemPlans];
                                            newPlans[idx].planName = e.target.value;
                                            setCreemPlans(newPlans);
                                        }}
                                        placeholder="Pro"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-4 block opacity-60">Agent Limit</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight text-cyan-400"
                                        value={plan.maxInstances}
                                        onChange={(e) => {
                                            const newPlans = [...creemPlans];
                                            newPlans[idx].maxInstances = e.target.value;
                                            setCreemPlans(newPlans);
                                        }}
                                        placeholder="5"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-4 block opacity-60">Checkout URL</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm tracking-tight font-mono"
                                        value={plan.checkoutUrl || ''}
                                        onChange={(e) => {
                                            const newPlans = [...creemPlans];
                                            newPlans[idx].checkoutUrl = e.target.value;
                                            setCreemPlans(newPlans);
                                        }}
                                        placeholder="https://creem.io/checkout/..."
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => handleSaveCreem(plan)}
                                    disabled={saving}
                                    className="bg-purple-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-purple-900/25"
                                >
                                    {plan._isNew ? 'Create Plan' : 'Sync Plan'}
                                </button>
                                {!plan._isNew && (
                                    <button
                                        onClick={() => handleDeleteCreem(plan.id)}
                                        className="p-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-10 rounded-[2.5rem] flex items-start gap-8">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Key className="text-blue-400" size={20} />
                </div>
                <div className="space-y-4">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Webhook Cryptography</h3>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium">
                        {isWhop
                            ? 'Verify that your Whop Dashboard secret matches the value configured in Settings. All incoming signals must pass SHA256 signature verification.'
                            : 'Verify that your Creem Dashboard webhook secret matches the value configured in Settings. All incoming events must pass the creem-signature HMAC-SHA256 verification.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
