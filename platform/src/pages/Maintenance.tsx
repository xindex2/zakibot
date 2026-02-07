import { useState, useEffect, useRef } from 'react';
import { Settings, Rocket, RefreshCw, Terminal as TerminalIcon, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LogEntry {
    message: string;
    type: 'info' | 'success' | 'error' | 'build';
    timestamp: string;
}

export default function Maintenance() {
    const { token } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [running, setRunning] = useState(false);
    const [action, setAction] = useState<string | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const handleAction = async (type: string) => {
        if (!confirm(`Initialize global ${type} sequence?`)) return;

        setRunning(true);
        setAction(type);
        setLogs(prev => [...prev, {
            message: `INITIATING: ${type.toUpperCase()} PROTOCOL...`,
            type: 'info',
            timestamp: new Date().toLocaleTimeString()
        }]);

        // Mocking backend action
        setTimeout(() => {
            setLogs(prev => [...prev, {
                message: `${type.toUpperCase()} SEQUENCE COMPLETED SUCCESSFULLY.`,
                type: 'success',
                timestamp: new Date().toLocaleTimeString()
            }]);
            setRunning(false);
            setAction(null);
        }, 3000);
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Fleet Maintenance</h1>
                    <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">Global Infrastructure Overrides</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <MaintenanceCard
                    icon={<Rocket className="text-[#ff6b6b]" />}
                    title="Rebuild Base Image"
                    description="Synchronizes core dependencies and rebuilds the standard deployment container."
                    onAction={() => handleAction('rebuild')}
                    disabled={running}
                    loading={running && action === 'rebuild'}
                />
                <MaintenanceCard
                    icon={<RefreshCw className="text-blue-400" />}
                    title="Sync Global Assets"
                    description="Pushes the latest OpenClaw Host updates to every active deployment in the fleet."
                    onAction={() => handleAction('update')}
                    disabled={running}
                    loading={running && action === 'update'}
                />
            </div>

            {/* Terminal Logs */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
                <div className="px-10 py-6 border-b border-white/5 bg-white/2 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <TerminalIcon size={16} className="text-gray-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Telemetry Stream</h4>
                    </div>
                    <button
                        onClick={() => setLogs([])}
                        className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors"
                    >
                        CLEAR CACHE
                    </button>
                </div>

                <div className="h-[400px] overflow-y-auto p-10 font-mono text-xs leading-relaxed">
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-40">
                            <ActivityIcon size={40} className="mb-4 animate-pulse" />
                            <p className="font-black uppercase tracking-widest">Awaiting Command Input...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log, i) => (
                                <div key={i} className={`flex gap-4 border-l-2 pl-6 ${log.type === 'success' ? 'border-green-500/50' :
                                    log.type === 'error' ? 'border-red-500/50' : 'border-[#ff6b6b]/50'
                                    }`}>
                                    <span className="text-gray-700 font-bold shrink-0">[{log.timestamp}]</span>
                                    <div className={
                                        log.type === 'success' ? 'text-green-400' :
                                            log.type === 'error' ? 'text-red-400' : 'text-gray-300'
                                    }>
                                        <span className="font-black italic uppercase mr-2 tracking-tighter">&gt;&gt;</span>
                                        {log.message}
                                    </div>
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MaintenanceCard({ icon, title, description, onAction, disabled, loading }: any) {
    return (
        <div className="group p-12 bg-white/2 border border-white/5 rounded-[3.5rem] hover:border-white/10 transition-all duration-700 flex flex-col">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-700">
                {icon}
            </div>
            <h3 className="text-2xl font-black italic uppercase mb-4">{title}</h3>
            <p className="text-gray-500 leading-relaxed font-medium mb-10 flex-1">{description}</p>
            <button
                onClick={onAction}
                disabled={disabled}
                className="w-full py-5 bg-white/5 border border-white/5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-white/10 active:scale-95 transition-all text-gray-400 hover:text-white disabled:opacity-50"
            >
                {loading ? 'INITIALIZING...' : 'EXECUTE PROTOCOL'}
            </button>
        </div>
    );
}

function ActivityIcon({ className, size }: any) {
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    );
}
