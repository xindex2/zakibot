import { useState, useEffect, useCallback } from 'react';

interface StepStats {
    step: number;
    name: string;
    sent: number;
    pending: number;
    failed: number;
    skipped: number;
    total: number;
}

interface RecentEmail {
    email: string;
    step: number;
    stepName: string;
    status: string;
    sentAt: string;
}

interface DripStats {
    overview: {
        total: number;
        sent: number;
        pending: number;
        failed: number;
        skipped: number;
        enrolledUsers: number;
    };
    steps: StepStats[];
    recent: RecentEmail[];
}

const STEP_ICONS = ['🎉', '🤖', '💡', '🧠', '⚡', '📢', '⏰', '⚠️'];
const STEP_TIMING = ['Instant', '+4 hours', 'Day 1', 'Day 2', 'Day 3', 'Day 5', 'Day 6', 'Day 7'];

export default function EmailCampaign() {
    const [stats, setStats] = useState<DripStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [enrollResult, setEnrollResult] = useState<string | null>(null);

    const token = localStorage.getItem('token');

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/drip/stats', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setStats(await res.json());
        } catch (e) {
            console.error('Failed to fetch drip stats:', e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleEnrollAll = async () => {
        if (!confirm('This will enroll ALL existing users into the email drip campaign. Already enrolled users will be skipped. Continue?')) return;

        setEnrolling(true);
        setEnrollResult(null);

        try {
            const res = await fetch('/api/admin/drip/enroll-all', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await res.json();
            setEnrollResult(data.message || `Enrolled ${data.enrolled} users`);
            fetchStats(); // Refresh stats
        } catch (e: any) {
            setEnrollResult(`Error: ${e.message}`);
        } finally {
            setEnrolling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const overview = stats?.overview;

    return (
        <div className="space-y-8 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">📧 Email Campaign</h1>
                    <p className="text-sm text-white/30 mt-1">Drip campaign management & analytics</p>
                </div>
                <button
                    onClick={handleEnrollAll}
                    disabled={enrolling}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                    {enrolling ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Enrolling...
                        </>
                    ) : (
                        <>📤 Enroll All Users</>
                    )}
                </button>
            </div>

            {/* Enroll Result */}
            {enrollResult && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium ${enrollResult.startsWith('Error')
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}>
                    {enrollResult}
                </div>
            )}

            {/* Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Enrolled Users" value={overview?.enrolledUsers || 0} color="text-blue-400" />
                <StatCard label="Total Emails" value={overview?.total || 0} color="text-white" />
                <StatCard label="Sent" value={overview?.sent || 0} color="text-emerald-400" />
                <StatCard label="Pending" value={overview?.pending || 0} color="text-amber-400" />
                <StatCard label="Failed" value={overview?.failed || 0} color="text-red-400" />
                <StatCard label="Skipped" value={overview?.skipped || 0} color="text-white/30" />
            </div>

            {/* Per-Step Breakdown */}
            <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white/40 mb-4">Funnel by Step</h2>
                <div className="space-y-2">
                    {stats?.steps.map((step) => {
                        const sentPct = step.total > 0 ? (step.sent / step.total) * 100 : 0;
                        return (
                            <div
                                key={step.step}
                                className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex items-center gap-4"
                            >
                                {/* Step indicator */}
                                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg shrink-0">
                                    {STEP_ICONS[step.step]}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-white">Day {step.step}</span>
                                        <span className="text-[10px] text-white/20">•</span>
                                        <span className="text-xs text-white/50">{step.name}</span>
                                        <span className="text-[10px] text-white/20">•</span>
                                        <span className="text-[10px] text-white/30">{STEP_TIMING[step.step]}</span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                            style={{ width: `${sentPct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Counts */}
                                <div className="flex items-center gap-3 shrink-0">
                                    <MiniStat label="Sent" value={step.sent} color="text-emerald-400" />
                                    <MiniStat label="Pending" value={step.pending} color="text-amber-400" />
                                    <MiniStat label="Failed" value={step.failed} color="text-red-400" />
                                    <MiniStat label="Skip" value={step.skipped} color="text-white/20" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recent Activity */}
            <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white/40 mb-4">Recent Activity</h2>
                {stats?.recent && stats.recent.length > 0 ? (
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.05]">
                                    {['Email', 'Step', 'Status', 'Sent At'].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/20">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recent.map((item, i) => (
                                    <tr key={i} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                                        <td className="px-4 py-2.5 text-xs text-white/60 font-medium">{item.email}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-[10px] font-bold text-white/40">
                                                {STEP_ICONS[item.step]} {item.stepName}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${item.status === 'sent'
                                                    ? 'text-emerald-400 bg-emerald-500/10'
                                                    : 'text-red-400 bg-red-500/10'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-[11px] text-white/30">
                                            {item.sentAt ? new Date(item.sentAt).toLocaleString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-white/20 text-sm">
                        No emails sent yet. Click "Enroll All Users" to start the campaign.
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value.toLocaleString()}</p>
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="text-center min-w-[40px]">
            <p className={`text-sm font-black ${color}`}>{value}</p>
            <p className="text-[8px] uppercase tracking-wider text-white/20">{label}</p>
        </div>
    );
}
