import { useState, useEffect } from 'react';
import { Users, Bot, Activity, Server, Shield, Cpu, Zap, HardDrive, TrendingUp, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

function AdminNavLink({ to, icon, label, color }: any) {
    return (
        <Link to={to} className="flex flex-col items-center gap-4 p-8 bg-white/2 border border-white/5 rounded-[2rem] hover:bg-white/5 transition-all group">
            <div className={`w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center transition-colors ${color}`}>
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">{label}</span>
        </Link>
    );
}

interface Stats {
    summary: {
        totalUsers: number;
        totalAgents: number;
        activeAgents: number;
    };
    system: {
        cpu: { usage: number; cores: number; load: string };
        ram: { percent: number; used: string; total: string };
        disk: { percent: number; used: string; total: string };
    };
    growth: { date: string; count: number }[];
    plans: { plan: string; count: number }[];
    agentUsage: {
        id: string;
        name: string;
        subdomain: string;
        status: string;
        cpu: number;
        memory: { percent: number; usage: string };
    }[];
}

export default function AdminDashboard() {
    const { token } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 10000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-[#ff4d4d] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const system = stats.system;

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Command Center</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">OpenClaw Host Infrastructure Monitor</p>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">System Nominal</span>
                </div>
            </div>

            {/* Admin Quick Navigation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <AdminNavLink to="/admin/users" icon={<Users size={18} />} label="User Registry" color="text-blue-500" />
                <AdminNavLink to="/admin/events" icon={<Activity size={18} />} label="Whop Logs" color="text-[#ff4d4d]" />
                <AdminNavLink to="/admin/plans" icon={<Settings size={18} />} label="Plan Config" color="text-amber-500" />
                <AdminNavLink to="/admin/settings" icon={<Cpu size={18} />} label="Integration" color="text-cyan-400" />
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: "Total Recruits", value: stats.summary.totalUsers, icon: <Users className="text-blue-500" /> },
                    { label: "Total Assets", value: stats.summary.totalAgents, icon: <Bot className="text-[#ff4d4d]" /> },
                    { label: "Active Deployments", value: stats.summary.activeAgents, icon: <Server className="text-green-500" /> }
                ].map((s, i) => (
                    <div key={i} className="bg-white/2 border border-white/5 rounded-[2.5rem] p-10 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{s.label}</p>
                            <h2 className="text-5xl font-black italic">{s.value}</h2>
                        </div>
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center">
                            {s.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* System Health */}
            <div>
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-600 mb-8 ml-4">Hardware Telemetry</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <ResourceCard
                        icon={<Cpu size={18} className="text-blue-400" />}
                        label="CPU Load"
                        percent={system.cpu.usage}
                        details={`${system.cpu.cores} Cores | ${system.cpu.load}`}
                        color="bg-blue-500"
                    />
                    <ResourceCard
                        icon={<Zap size={18} className="text-purple-400" />}
                        label="RAM Capacity"
                        percent={system.ram.percent}
                        details={`${system.ram.used} / ${system.ram.total}`}
                        color="bg-purple-500"
                    />
                    <ResourceCard
                        icon={<HardDrive size={18} className="text-green-400" />}
                        label="Storage Volume"
                        percent={system.disk.percent}
                        details={`${system.disk.used} / ${system.disk.total}`}
                        color="bg-green-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Growth Chart (Simplified) */}
                <div className="bg-white/2 border border-white/5 rounded-[3rem] p-12">
                    <div className="flex items-center gap-3 mb-12">
                        <TrendingUp size={20} className="text-[#ff4d4d]" />
                        <h3 className="font-black italic uppercase tracking-tighter text-xl">Recruitment Trend</h3>
                    </div>
                    <div className="h-[200px] flex items-end gap-4">
                        {stats.growth.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                <div
                                    className="w-full bg-[#ff4d4d]/20 group-hover:bg-[#ff4d4d] transition-all rounded-t-xl min-h-[4px]"
                                    style={{ height: `${(day.count / Math.max(...stats.growth.map(d => d.count), 1)) * 100}%` }}
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                                    {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Plan Distribution */}
                <div className="bg-white/2 border border-white/5 rounded-[3rem] p-12">
                    <div className="flex items-center gap-3 mb-12">
                        <Shield size={20} className="text-blue-400" />
                        <h3 className="font-black italic uppercase tracking-tighter text-xl">Squad Tiers</h3>
                    </div>
                    <div className="space-y-8">
                        {stats.plans.map((p, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-400">{p.plan}</span>
                                    <span className="text-xl font-black italic">{p.count}</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500/50 rounded-full"
                                        style={{ width: `${(p.count / (stats.summary.totalUsers || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Agent List */}
            <div className="bg-white/2 border border-white/5 rounded-[3rem] p-12 overflow-hidden">
                <div className="flex items-center gap-3 mb-12">
                    <Activity size={20} className="text-[#ff4d4d]" />
                    <h3 className="font-black italic uppercase tracking-tighter text-xl">Active Assets Telemetry</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-white/5">
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Asset Identity</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Status</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Processor</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Memory</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {stats.agentUsage.map((agent) => (
                                <tr key={agent.id} className="group">
                                    <td className="py-6">
                                        <div className="font-black italic uppercase tracking-tight group-hover:text-[#ff4d4d] transition-colors">{agent.name}</div>
                                    </td>
                                    <td className="py-6">
                                        <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${agent.status === 'running' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                            }`}>
                                            {agent.status}
                                        </div>
                                    </td>
                                    <td className="py-6 w-48">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500/50" style={{ width: `${Math.min(agent.cpu * 2, 100)}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400">{agent.cpu}%</span>
                                        </div>
                                    </td>
                                    <td className="py-6 w-48">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#ff4d4d]/50" style={{ width: `${agent.memory.percent}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400">{agent.memory.usage}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ResourceCard({ icon, label, percent, details, color }: any) {
    return (
        <div className="bg-white/2 border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">{icon}</div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
                </div>
                <span className="text-xl font-black italic">{percent}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{details}</p>
        </div>
    );
}
