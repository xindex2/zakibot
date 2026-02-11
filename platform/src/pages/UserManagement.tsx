import { useState, useEffect } from 'react';
import { Search, Trash2, Shield, Gem, ChevronLeft, ChevronRight, Edit2, Loader2, Save, X, ChevronDown, Bot, MessageSquare, CreditCard, Plus, Play, Square, RotateCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface BotInfo {
    id: string;
    name: string;
    model: string;
    telegramEnabled: boolean;
    discordEnabled: boolean;
    whatsappEnabled: boolean;
}

interface UserData {
    id: string;
    email: string;
    full_name: string;
    role: string;
    acquisition_source: string;
    subscription?: {
        plan: string;
        maxInstances: number;
        creditBalance?: number;
    };
    _count: {
        configs: number;
    };
    configs: BotInfo[];
    createdAt: string;
}

export default function UserManagement() {
    const { token } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [botStatuses, setBotStatuses] = useState<Record<string, string>>({});
    const [botControlLoading, setBotControlLoading] = useState<Record<string, boolean>>({});
    const [restartAllLoading, setRestartAllLoading] = useState(false);

    // Edit State
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [editForm, setEditForm] = useState({ role: '', plan: '', maxInstances: 1, creditGrant: 0 });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadUsers();
        }, 300); // Simple debounce
        return () => clearTimeout(timeoutId);
    }, [token, page, search]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                search: search
            });

            const usersRes = await fetch(`/api/admin/users?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const usersData = await usersRes.json();
            setUsers(usersData.users);
            setTotalPages(usersData.totalPages);
            setTotalUsers(usersData.total);

            // Fetch bot statuses separately — may 404 if backend not updated
            try {
                const statusesRes = await fetch('/api/admin/bot-statuses', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (statusesRes.ok) {
                    const statusData = await statusesRes.json();
                    setBotStatuses(statusData);
                }
            } catch { /* ignore status errors */ }
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBotControl = async (configId: string, action: 'start' | 'stop' | 'restart') => {
        setBotControlLoading(prev => ({ ...prev, [configId]: true }));
        try {
            const res = await fetch('/api/admin/bot/control', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, configId })
            });
            const data = await res.json();
            if (data.success) {
                setBotStatuses(prev => ({ ...prev, [configId]: data.status }));
            } else {
                alert(data.error || 'Bot control failed');
            }
        } catch (e) {
            alert('Failed to control bot');
        } finally {
            setBotControlLoading(prev => ({ ...prev, [configId]: false }));
        }
    };

    const handleRestartAllPaid = async () => {
        if (!confirm('Restart all stopped bots for paid users? This may take a moment.')) return;
        setRestartAllLoading(true);
        try {
            const res = await fetch('/api/admin/bots/restart-paid', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(`Restarted ${data.results?.filter((r: any) => r.status === 'started').length || 0} of ${data.total} bot(s)`);
                loadUsers();
            } else {
                alert(data.error || 'Restart failed');
            }
        } catch (e) {
            alert('Failed to restart bots');
        } finally {
            setRestartAllLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('WARNING: You are about to permanently delete this user and all their agents. Proceed?')) return;
        try {
            await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            loadUsers();
        } catch (e) {
            alert('Failed to delete user');
        }
    };

    const handleEditUser = (user: UserData) => {
        setEditingUser(user);
        setEditForm({
            role: user.role,
            plan: user.subscription?.plan || 'Free',
            maxInstances: user.subscription?.maxInstances || 1,
            creditGrant: 0
        });
    };

    const saveUser = async () => {
        if (!editingUser) return;
        setIsSaving(true);
        try {
            await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editForm)
            });
            // If credit grant > 0, also add credits
            if (editForm.creditGrant > 0) {
                await fetch(`/api/admin/credits/add`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId: editingUser.id, amount: editForm.creditGrant })
                });
            }
            setEditingUser(null);
            loadUsers();
        } catch (e) {
            alert('Failed to save user');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 container mx-auto py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Fleet Commanders
                    </h1>
                    <p className="text-primary font-bold uppercase tracking-[0.2em] text-[10px]">
                        Global User Registry & Management
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRestartAllPaid}
                        disabled={restartAllLoading}
                        className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                        {restartAllLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                        Restart All Paid Bots
                    </button>
                </div>

                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Email, Name, or ID..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="input-modern w-full pl-14 relative z-10"
                    />
                </div>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-white/5 bg-white/[0.02]">
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Commander</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Role</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Plan Status</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Bots</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Credits</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Registered</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Source</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 text-right">Control</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map((u) => {
                                const isExpanded = expandedUser === u.id;
                                const bots = u.configs || [];
                                const runningCount = bots.filter(b => botStatuses[b.id] === 'running').length;
                                const stoppedCount = bots.length - runningCount;
                                return (
                                    <>
                                        <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center font-bold text-white shadow-inner">
                                                        {u.full_name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-white/90 group-hover:text-primary transition-colors">{u.full_name}</div>
                                                        <div className="text-[11px] text-white/40">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${u.role === 'admin'
                                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                                    : 'bg-white/5 border-white/10 text-white/60'
                                                    }`}>
                                                    {u.role === 'admin' && <Shield size={10} className="mr-1.5" />}
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <Gem size={12} className={u.subscription?.plan !== 'Free' ? "text-vibrant-secondary" : "text-white/30"} />
                                                        <span className="text-xs font-bold">{u.subscription?.plan || 'Free'}</span>
                                                    </div>
                                                    <span className="text-[10px] text-white/30 tracking-wide">
                                                        {u._count?.configs || 0} / {u.subscription?.maxInstances || 1} Agents
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {bots.length > 0 ? (
                                                    <button
                                                        onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                                        className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        <Bot size={14} className="text-white/50" />
                                                        <span className="text-xs font-bold text-white/70">{bots.length}</span>
                                                        {runningCount > 0 && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
                                                                <span className="relative flex h-2 w-2">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                                </span>
                                                                {runningCount}
                                                            </span>
                                                        )}
                                                        {stoppedCount > 0 && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                                                                <span className="inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                {stoppedCount}
                                                            </span>
                                                        )}
                                                        <ChevronDown size={12} className={`text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-white/20 italic">No bots</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={12} className={u.subscription?.creditBalance ? 'text-emerald-400' : 'text-white/20'} />
                                                    <span className={`text-xs font-bold ${u.subscription?.creditBalance ? 'text-emerald-400' : 'text-white/30'}`}>
                                                        ${(u.subscription?.creditBalance ?? 0).toFixed(4)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-[11px] font-mono text-white/40">
                                                {new Date(u.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-8 py-6">
                                                {u.acquisition_source ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/50">
                                                        {u.acquisition_source}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-white/20 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditUser(u)}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg text-white/60 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expanded bot cards */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <tr key={`${u.id}-bots`}>
                                                    <td colSpan={8} className="px-8 py-4">
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="pl-14 grid gap-2"
                                                        >
                                                            {bots.map(bot => {
                                                                const isRunning = botStatuses[bot.id] === 'running';
                                                                const channels = [
                                                                    bot.telegramEnabled && 'TG',
                                                                    bot.discordEnabled && 'DC',
                                                                    bot.whatsappEnabled && 'WA',
                                                                ].filter(Boolean);
                                                                return (
                                                                    <div key={bot.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
                                                                        {/* Status dot */}
                                                                        {isRunning ? (
                                                                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shrink-0"></span>
                                                                        )}

                                                                        {/* Bot name */}
                                                                        <span className="text-sm font-semibold text-white/80 truncate">{bot.name}</span>

                                                                        {/* Status label */}
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${isRunning
                                                                            ? 'text-green-400 bg-green-500/10 border-green-500/20'
                                                                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                                                                            }`}>
                                                                            {isRunning ? 'Running' : 'Stopped'}
                                                                        </span>

                                                                        <div className="flex-1" />

                                                                        {/* Model */}
                                                                        <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded hidden sm:inline">
                                                                            {bot.model?.split('/').pop() || 'unknown'}
                                                                        </span>

                                                                        {/* Channel badges */}
                                                                        {channels.map(ch => (
                                                                            <span key={ch as string} className="text-[9px] font-bold uppercase tracking-wider text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                                                                {ch}
                                                                            </span>
                                                                        ))}

                                                                        {/* Admin Bot Controls */}
                                                                        <div className="flex items-center gap-1 ml-2">
                                                                            {botControlLoading[bot.id] ? (
                                                                                <Loader2 size={14} className="animate-spin text-white/40" />
                                                                            ) : isRunning ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleBotControl(bot.id, 'stop'); }}
                                                                                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors" title="Stop"
                                                                                    >
                                                                                        <Square size={12} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleBotControl(bot.id, 'restart'); }}
                                                                                        className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 transition-colors" title="Restart"
                                                                                    >
                                                                                        <RotateCw size={12} />
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleBotControl(bot.id, 'start'); }}
                                                                                    className="p-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors" title="Start"
                                                                                >
                                                                                    <Play size={12} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </motion.div>
                                                    </td>
                                                </tr>
                                            )}
                                        </AnimatePresence>
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-8 py-6 border-t border-white/5 bg-white/[0.01]">
                    <div className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
                        Total {totalUsers} Commanders
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-mono px-2 text-white/50">
                            {page} / {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 content-center"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="glass-panel w-full max-w-lg rounded-3xl p-8 relative"
                        >
                            <button
                                onClick={() => setEditingUser(null)}
                                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-black italic uppercase tracking-tight mb-8">
                                Updating Commander
                                <span className="block text-sm font-normal text-white/40 not-italic normal-case mt-1">{editingUser.email}</span>
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 block mb-2">System Role</label>
                                    <select
                                        className="input-modern w-full appearance-none"
                                        value={editForm.role}
                                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 block mb-2">Subscription Plan</label>
                                        <select
                                            className="input-modern w-full"
                                            value={editForm.plan}
                                            onChange={e => {
                                                const newPlan = e.target.value;
                                                const limits: Record<string, number> = {
                                                    'Free': 1,
                                                    'Starter': 1,
                                                    'Pro': 5,
                                                    'Elite': 10,
                                                    'Enterprise': 100
                                                };
                                                setEditForm({
                                                    ...editForm,
                                                    plan: newPlan,
                                                    maxInstances: limits[newPlan] || editForm.maxInstances
                                                });
                                            }}
                                        >
                                            <option value="Free">Free</option>
                                            <option value="Starter">Starter</option>
                                            <option value="Pro">Pro</option>
                                            <option value="Elite">Elite</option>
                                            <option value="Enterprise">Enterprise</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 block mb-2">Bot Allowance</label>
                                        <input
                                            type="number"
                                            className="input-modern w-full"
                                            value={editForm.maxInstances}
                                            onChange={e => setEditForm({ ...editForm, maxInstances: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 block mb-2">Grant Credits ($)</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            className="input-modern w-full"
                                            value={editForm.creditGrant}
                                            min={0}
                                            onChange={e => setEditForm({ ...editForm, creditGrant: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                        />
                                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold whitespace-nowrap">
                                            <CreditCard size={12} />
                                            Current: ${(editingUser.subscription?.creditBalance ?? 0).toFixed(4)}
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-white/30 mt-1">Enter amount to add to the user's credit balance. Leave 0 to skip.</p>
                                </div>

                                <div className="pt-6 flex gap-4">
                                    <button
                                        onClick={() => setEditingUser(null)}
                                        className="btn-secondary-modern w-full"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveUser}
                                        disabled={isSaving}
                                        className="btn-primary-modern w-full flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
