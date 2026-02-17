import { useState, useEffect } from 'react';
import { Activity, Search, ChevronLeft, ChevronRight, DollarSign, Zap, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

interface Transaction {
    id: string;
    userId: string;
    email: string;
    userName: string;
    plan: string;
    botName: string;
    model: string;
    amount: number;
    description: string;
    createdAt: string;
}

export default function AdminApiActivity() {
    const { token } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [todayCost, setTodayCost] = useState(0);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        loadActivity();
    }, [page, search]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            loadActivity(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [page, search]);

    const loadActivity = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: '50',
                ...(search ? { search } : {})
            });
            const res = await fetch(`/api/admin/api-activity?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setTransactions(data.transactions || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
            setTodayCost(data.todayCost || 0);
        } catch (err) {
            console.error('Failed to load API activity:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        setSearch(searchInput);
    };

    const planColor = (plan: string) => {
        switch (plan?.toLowerCase()) {
            case 'pro': return 'bg-purple-500/10 text-purple-400';
            case 'business': return 'bg-amber-500/10 text-amber-400';
            case 'free': return 'bg-gray-500/10 text-gray-400';
            default: return 'bg-blue-500/10 text-blue-400';
        }
    };

    const timeAgo = (dateStr: string) => {
        const now = Date.now();
        const d = new Date(dateStr).getTime();
        const diffMs = now - d;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-[#ff4d4d] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <Link to="/admin" className="text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors mb-4 inline-block">
                        ← Command Center
                    </Link>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">API Activity</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">Real-time OpenRouter API Usage Log</p>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live · Refreshes 15s</span>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/2 border border-white/5 rounded-[2rem] p-8 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Today's Spend</p>
                        <h2 className="text-3xl font-black italic text-[#ff4d4d]">${todayCost.toFixed(4)}</h2>
                    </div>
                    <div className="w-14 h-14 bg-[#ff4d4d]/10 rounded-2xl flex items-center justify-center">
                        <DollarSign className="text-[#ff4d4d]" size={22} />
                    </div>
                </div>
                <div className="bg-white/2 border border-white/5 rounded-[2rem] p-8 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Total Transactions</p>
                        <h2 className="text-3xl font-black italic">{total.toLocaleString()}</h2>
                    </div>
                    <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                        <Zap className="text-blue-400" size={22} />
                    </div>
                </div>
                <div className="bg-white/2 border border-white/5 rounded-[2rem] p-8 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Avg Per Call</p>
                        <h2 className="text-3xl font-black italic">
                            ${transactions.length > 0 ? (transactions.reduce((s, t) => s + t.amount, 0) / transactions.length).toFixed(5) : '0.00'}
                        </h2>
                    </div>
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                        <Clock className="text-emerald-400" size={22} />
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        className="w-full bg-white/2 border border-white/5 rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-[#ff4d4d]/50 transition-all text-sm"
                        placeholder="Search by email or name..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="px-8 py-4 bg-[#ff4d4d] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                    Search
                </button>
            </div>

            {/* Transaction Table */}
            <div className="bg-white/2 border border-white/5 rounded-[2.5rem] overflow-hidden">
                <div className="p-8 md:p-10 border-b border-white/5 flex items-center gap-3">
                    <Activity size={18} className="text-[#ff4d4d]" />
                    <h3 className="font-black italic uppercase tracking-tighter text-lg">Transaction Log</h3>
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-gray-600">
                        Showing {transactions.length} of {total}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-white/5">
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Time</th>
                                <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">User</th>
                                <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Plan</th>
                                <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Bot</th>
                                <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Model</th>
                                <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="text-[11px] font-bold text-gray-400">{timeAgo(tx.createdAt)}</div>
                                        <div className="text-[9px] text-gray-600 mt-0.5">
                                            {new Date(tx.createdAt).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-xs font-bold text-white truncate max-w-[200px]">{tx.email}</div>
                                        {tx.userName && (
                                            <div className="text-[10px] text-gray-500 mt-0.5">{tx.userName}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${planColor(tx.plan)}`}>
                                            {tx.plan}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-[11px] font-bold text-gray-300 truncate max-w-[150px]">
                                            {tx.botName || '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-[10px] font-mono text-gray-400 truncate max-w-[200px]">{tx.model || '—'}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="text-sm font-black text-[#ff4d4d]">
                                            ${tx.amount.toFixed(5)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-gray-600 text-sm">
                                        No API activity found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-6 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page >= totalPages}
                                className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
