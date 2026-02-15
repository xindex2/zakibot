import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Package, CreditCard, RefreshCw, Filter, Activity, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Order {
    id: string;
    userId: string;
    user?: { email: string; full_name: string; acquisition_source?: string };
    type: string;
    status: string;
    amount: number;
    currency: string;
    planName: string | null;
    productId: string | null;
    checkoutId: string | null;
    provider: string;
    source: string | null;
    createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    refunded: 'bg-red-500/10 text-red-400 border-red-500/20',
    canceled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
};

type Tab = 'orders' | 'logs';

export default function Orders() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('logs');

    // ─── Orders state ───
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [search, setSearch] = useState('');

    // ─── Event Log state ───
    const [events, setEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    // ─── Fetch Orders ───
    const fetchOrders = async () => {
        setOrdersLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (typeFilter !== 'all') params.set('type', typeFilter);
            if (search) params.set('search', search);

            const res = await fetch(`/api/admin/orders?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setOrders(data.orders || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        } finally {
            setOrdersLoading(false);
        }
    };

    // ─── Fetch Events ───
    const fetchEvents = async () => {
        setEventsLoading(true);
        try {
            const resp = await fetch('/api/admin/events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            setEvents(data);
        } catch (err) {
            console.error('Failed to fetch events:', err);
        } finally {
            setEventsLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, [page, statusFilter, typeFilter]);
    useEffect(() => { fetchEvents(); }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchOrders();
    };

    const handleRefresh = () => {
        if (activeTab === 'orders') fetchOrders();
        else fetchEvents();
    };

    // Revenue summary
    const completedOrders = orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Orders & Logs</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">
                        Payments & Webhook Telemetry
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="bg-white/5 border border-white/5 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                >
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 bg-white/2 border border-white/5 rounded-2xl p-1 w-fit">
                {([
                    { key: 'logs' as Tab, label: 'Event Log', icon: <Activity size={13} /> },
                    { key: 'orders' as Tab, label: 'Orders', icon: <CreditCard size={13} /> },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.key
                            ? 'bg-white/10 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════ EVENT LOG TAB ═══════════════════════════════ */}
            {activeTab === 'logs' && (
                <>
                    {eventsLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-[#ff4d4d] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="bg-white/2 border border-white/5 border-dashed rounded-2xl p-16 text-center">
                            <Activity size={40} className="mx-auto text-gray-600 mb-4" />
                            <p className="text-sm font-bold text-gray-500">No events yet</p>
                            <p className="text-[10px] text-gray-600 mt-1">Webhook events will appear here in real-time</p>
                        </div>
                    ) : (
                        <div className="bg-white/2 border border-white/5 rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b border-white/5">
                                        <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600">Event</th>
                                        <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600">User</th>
                                        <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600">Time</th>
                                        <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {events.map((ev: any) => (
                                        <tr key={ev.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${ev.eventType?.includes('activated') ? 'bg-green-500' : 'bg-blue-500'}`} />
                                                    <div className="font-black italic uppercase tracking-tighter text-sm">{ev.eventType}</div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm tracking-tight">{ev.email}</span>
                                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{ev.whopUserId}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-[11px] font-bold text-gray-500">
                                                {new Date(ev.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5">
                                                <button className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                                    <ExternalLink size={14} className="text-gray-400" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════ ORDERS TAB ═══════════════════════════════ */}
            {activeTab === 'orders' && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total', value: total, color: 'text-white' },
                            { label: 'Completed', value: orders.filter(o => o.status === 'completed').length, color: 'text-emerald-400' },
                            { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'text-yellow-400' },
                            { label: 'Revenue (page)', value: `$${totalRevenue.toFixed(0)}`, color: 'text-cyan-400' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/2 border border-white/5 rounded-2xl p-5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">{stat.label}</p>
                                <p className={`text-2xl font-black italic tracking-tight ${stat.color}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2 bg-white/2 border border-white/5 rounded-xl px-4 py-2">
                            <Filter size={12} className="text-gray-500" />
                            <select
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-xs font-bold outline-none text-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="refunded">Refunded</option>
                                <option value="canceled">Canceled</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-white/2 border border-white/5 rounded-xl px-4 py-2">
                            <Package size={12} className="text-gray-500" />
                            <select
                                value={typeFilter}
                                onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-xs font-bold outline-none text-white"
                            >
                                <option value="all">All Types</option>
                                <option value="subscription">Subscriptions</option>
                                <option value="credit_topup">Credit Top-Ups</option>
                            </select>
                        </div>

                        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by email..."
                                    className="w-full bg-white/2 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-white/10 transition-all"
                                />
                            </div>
                        </form>
                    </div>

                    {/* Order Table */}
                    {ordersLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-[#ff4d4d] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="bg-white/2 border border-white/5 border-dashed rounded-2xl p-16 text-center">
                            <Package size={40} className="mx-auto text-gray-600 mb-4" />
                            <p className="text-sm font-bold text-gray-500">No orders found</p>
                            <p className="text-[10px] text-gray-600 mt-1">Orders will appear here when users make purchases via Creem</p>
                        </div>
                    ) : (
                        <div className="bg-white/2 border border-white/5 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            {['Date', 'User', 'Type', 'Plan / Pack', 'Amount', 'Status', 'Source', 'Provider'].map(header => (
                                                <th key={header} className="text-left px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(order => (
                                            <tr key={order.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                                                <td className="px-6 py-4 text-xs font-mono text-gray-400">
                                                    {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    <br />
                                                    <span className="text-[10px] text-gray-600">
                                                        {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-xs font-bold truncate max-w-[180px]">{order.user?.email || 'Unknown'}</p>
                                                    <p className="text-[10px] text-gray-600 truncate">{order.user?.full_name}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${order.type === 'subscription'
                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        }`}>
                                                        {order.type === 'subscription' ? <Package size={10} /> : <CreditCard size={10} />}
                                                        {order.type === 'subscription' ? 'Sub' : 'Credit'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold">
                                                    {order.planName || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-black text-cyan-400">
                                                    ${order.amount.toFixed(0)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(order.source || order.user?.acquisition_source) ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/50">
                                                            {order.source || order.user?.acquisition_source}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-white/20 italic">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">
                                                    {order.provider}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-500 font-bold">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2.5 rounded-xl border border-white/5 hover:bg-white/5 disabled:opacity-30 transition-all"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2.5 rounded-xl border border-white/5 hover:bg-white/5 disabled:opacity-30 transition-all"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
