import { useState, useEffect } from 'react';
import { Settings, Save, Key, Shield, Info, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminSettings() {
    const { token } = useAuth();
    const [config, setConfig] = useState<{ [key: string]: string }>({
        'WHOP_API_TOKEN': '',
        'WHOP_WEBHOOK_SECRET': '',
        'WHOP_BUSINESS_ID': '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const resp = await fetch('/api/admin/config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            setConfig(prev => ({ ...prev, ...data }));
        } catch (err) {
            console.error('Failed to fetch config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const resp = await fetch('/api/admin/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
            if (resp.ok) {
                alert('Infrastructure parameters successfully synchronized.');
            }
        } catch (err) {
            console.error('Save failed:', err);
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
                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Settings</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">System Configuration</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-red-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-900/25 flex items-center gap-3"
                >
                    <Save size={16} />
                    {saving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Whop Credentials */}
                <div className="bg-white/2 border border-white/5 rounded-[3rem] p-12 space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                            <Shield className="text-blue-400" size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter">Billing Integration</h3>
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Whop Credentials</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-4 block opacity-60">API Token</label>
                            <div className="relative">
                                <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    className="w-full bg-black border border-white/5 rounded-2xl pl-16 pr-6 py-4 outline-none focus:border-red-500/50 transition-all font-mono text-xs"
                                    value={config['WHOP_API_TOKEN']}
                                    onChange={(e) => setConfig({ ...config, 'WHOP_API_TOKEN': e.target.value })}
                                    placeholder="whop_at_..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-4 block opacity-60">Business ID</label>
                            <input
                                type="text"
                                className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-red-500/50 transition-all font-mono text-xs"
                                value={config['WHOP_BUSINESS_ID']}
                                onChange={(e) => setConfig({ ...config, 'WHOP_BUSINESS_ID': e.target.value })}
                                placeholder="biz_..."
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-4 block opacity-60">Webhook Secret</label>
                            <input
                                type="password"
                                className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-red-500/50 transition-all font-mono text-xs"
                                value={config['WHOP_WEBHOOK_SECRET']}
                                onChange={(e) => setConfig({ ...config, 'WHOP_WEBHOOK_SECRET': e.target.value })}
                                placeholder="wh_sec_..."
                            />
                        </div>
                    </div>
                </div>

                {/* Infrastructure Info */}
                <div className="space-y-8">
                    <div className="bg-white/2 border border-white/5 rounded-[3rem] p-12">
                        <div className="flex items-start gap-6 mb-8">
                            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center shrink-0">
                                <Info className="text-red-500" size={20} />
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xl font-black uppercase tracking-tighter text-white/90">Sync Notice</h4>
                                <p className="text-sm text-gray-500 leading-relaxed font-medium">Changing these values will immediately affect all incoming Whop webhooks and quota calculations. Ensure your secrets match the values found in your <a href="https://whop.com/dash" target="_blank" className="underline text-red-400">Whop Dashboard</a>.</p>
                            </div>
                        </div>

                        <div className="p-8 bg-black rounded-3xl border border-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Endpoint URL</span>
                                <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[9px] font-black uppercase tracking-widest">Active</span>
                            </div>
                            <code className="text-[11px] text-red-500 font-black break-all">https://openclaw-host.com/api/webhooks/whop</code>
                        </div>
                    </div>

                    <div className="bg-red-500/5 border border-red-500/10 p-12 rounded-[3rem] flex items-start gap-8">
                        <AlertTriangle className="text-red-500 shrink-0" size={24} />
                        <div>
                            <h4 className="font-black uppercase tracking-tight mb-2 text-red-500">Security Warning</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">System keys are encrypted at rest but accessible here. Do not share these credentials.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AlertTriangle({ className, size }: any) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    );
}
