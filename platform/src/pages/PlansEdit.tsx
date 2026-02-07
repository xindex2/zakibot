import { useState, useEffect } from 'react';
import { Settings, Plus, Save, Trash2, Key, Globe, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PlansEdit() {
    const { token } = useAuth();
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const resp = await fetch('/api/admin/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (Array.isArray(data)) {
                setPlans(data);
            } else {
                console.error('Invalid plans format:', data);
                setPlans([]);
            }
        } catch (err) {
            console.error('Failed to fetch plans:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (plan: any) => {
        setSaving(true);
        try {
            await fetch('/api/admin/plans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(plan)
            });
            fetchPlans();
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-[#ff4d4d] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Plan Overrides</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">Whop Model Mapping</p>
                </div>
                <div className="bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 px-8 py-4 rounded-2xl flex items-center gap-4">
                    <Globe size={16} className="text-[#ff4d4d]" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Active Webhook URL</span>
                        <span className="text-xs font-black italic text-[#ff4d4d]">https://openclaw-host.com/api/webhooks/whop</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {plans.map((plan, idx) => (
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
                                            const newPlans = [...plans];
                                            newPlans[idx].planName = e.target.value;
                                            setPlans(newPlans);
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
                                            const newPlans = [...plans];
                                            newPlans[idx].maxInstances = e.target.value;
                                            setPlans(newPlans);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleSave(plan)}
                            disabled={saving}
                            className="bg-[#ff4d4d] text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff4d4d]/25"
                        >
                            Sync Plan
                        </button>
                    </div>
                ))}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 p-10 rounded-[2.5rem] flex items-start gap-8">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Key className="text-blue-400" size={20} />
                </div>
                <div className="space-y-4">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Webhook Cryptography</h3>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium">Verify that your Whop Dashboard secret matches the value configured in your <code>.env</code> file (<code>WHOP_WEBHOOK_SECRET</code>). All incoming signals must pass SHA256 signature verification to modify fleet quotas.</p>
                </div>
            </div>
        </div>
    );
}
