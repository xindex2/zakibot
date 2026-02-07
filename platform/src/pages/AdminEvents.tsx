import { useState, useEffect } from 'react';
import { Activity, User, Mail, Calendar, Shield, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminEvents() {
    const { token } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const resp = await fetch('/api/admin/events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            setEvents(data);
        } catch (err) {
            console.error('Failed to fetch events:', err);
        } finally {
            setLoading(false);
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
            <div>
                <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Whop Telemetry</h1>
                <p className="text-gray-500 font-medium uppercase tracking-[0.2em] text-[10px]">Real-time Webhook Activity</p>
            </div>

            <div className="bg-white/2 border border-white/5 rounded-[3rem] overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="text-left border-b border-white/5">
                            <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Event</th>
                            <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">User</th>
                            <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Time</th>
                            <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {events.map((ev: any) => (
                            <tr key={ev.id} className="group hover:bg-white/[0.01]">
                                <td className="px-10 py-8">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${ev.eventType.includes('activated') ? 'bg-green-500' : 'bg-blue-500'}`} />
                                        <div className="font-black italic uppercase tracking-tighter">{ev.eventType}</div>
                                    </div>
                                </td>
                                <td className="px-10 py-8">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm tracking-tight">{ev.email}</span>
                                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{ev.whopUserId}</span>
                                    </div>
                                </td>
                                <td className="px-10 py-8 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    {new Date(ev.createdAt).toLocaleString()}
                                </td>
                                <td className="px-10 py-8">
                                    <button className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                        <ExternalLink size={14} className="text-gray-400" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
