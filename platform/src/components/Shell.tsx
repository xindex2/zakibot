import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Bot, Layout as LayoutIcon, Users, Settings, LogOut, Activity, ShieldCheck, MessageSquare, CreditCard, Cpu, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

export default function Shell({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const isAdmin = user?.role === 'admin';

    const menuItems = [
        { icon: <LayoutIcon size={18} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Bot size={18} />, label: 'Agents', path: '/dashboard' },
    ];

    const adminItems = [
        { icon: <Activity size={18} />, label: 'Overview', path: '/admin' },
        { icon: <Users size={18} />, label: 'Users', path: '/admin/users' },
        { icon: <ShieldCheck size={18} />, label: 'Logs', path: '/admin/events' },
        { icon: <Settings size={18} />, label: 'Business Plans', path: '/admin/plans' },
        { icon: <Cpu size={18} />, label: 'Settings', path: '/admin/settings' },
    ];

    const accountItems = [
        { icon: <Bot size={18} />, label: 'Profile', path: '/profile' },
        { icon: <CreditCard size={18} />, label: 'Billing', path: '/billing' },
    ];

    const handleNav = (path: string) => {
        navigate(path);
        setSidebarOpen(false);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
            {/* Topbar Header */}
            <header className="h-14 md:h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4 md:px-8 relative z-[60] shrink-0 shadow-xl shadow-black/20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="md:hidden text-zinc-400 hover:text-white transition-colors p-1"
                    >
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <Link to="/dashboard" className="flex items-center gap-2 md:gap-3 group">
                        <div className="flex items-center justify-center transition-transform hover:scale-110">
                            <Logo size={80} className="drop-shadow-lg" />
                        </div>
                        <span className="text-xs md:text-sm font-black tracking-widest uppercase italic">OpenClaw<span className="text-red-600"> Host</span></span>
                    </Link>
                </div>

                <div className="flex items-center gap-6">
                    <a href="mailto:support@openclaw-host.com" className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 hover:text-red-500 transition-colors">
                        <MessageSquare size={14} /> Mission Support
                    </a>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 z-40 md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`
                    fixed md:static inset-y-0 left-0 z-50 md:z-10
                    w-64 border-r border-zinc-800 bg-black p-6 flex flex-col gap-8 shrink-0
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    top-14 md:top-0
                `}>
                    <nav className="flex flex-col gap-8 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3">
                            <p className="px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Platform</p>
                            <div className="space-y-0.5">
                                {menuItems.map((item) => (
                                    <SidebarItem
                                        key={item.path}
                                        {...item}
                                        active={location.pathname === item.path}
                                        onClick={() => handleNav(item.path)}
                                    />
                                ))}
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="space-y-3">
                                <p className="px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-red-500/70">Administration</p>
                                <div className="space-y-0.5">
                                    {adminItems.map((item) => (
                                        <SidebarItem
                                            key={item.path}
                                            {...item}
                                            active={location.pathname === item.path}
                                            onClick={() => handleNav(item.path)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <p className="px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Account</p>
                            <div className="space-y-0.5">
                                {accountItems.map((item) => (
                                    <SidebarItem
                                        key={item.path}
                                        {...item}
                                        active={location.pathname === item.path}
                                        onClick={() => handleNav(item.path)}
                                    />
                                ))}
                            </div>
                        </div>
                    </nav>

                    {/* User Section */}
                    <div className="mt-auto pt-6 border-t border-zinc-800 flex flex-col gap-4">
                        <div className="flex items-center gap-3 px-2 h-10">
                            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-white border border-zinc-700 overflow-hidden text-xs shadow-inner">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    user?.full_name?.charAt(0) || 'U'
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                    <p className="text-[11px] font-bold text-white truncate">
                                        {user?.full_name || 'User'}
                                    </p>
                                    <button onClick={logout} className="text-zinc-500 hover:text-red-500 transition-colors shrink-0">
                                        <LogOut size={12} />
                                    </button>
                                </div>
                                <p className="text-[9px] font-medium text-zinc-500 truncate uppercase tracking-widest">{user?.role || 'Member'}</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto relative z-10 p-4 md:p-8 lg:p-12 bg-zinc-950">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

function SidebarItem({ icon, label, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[11px] transition-all text-left group ${active
                ? 'bg-zinc-900 text-white shadow-xl shadow-black/10 border border-zinc-800'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900/50'
                }`}
        >
            <div className={`transition-colors duration-200 ${active ? 'text-red-500' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                {icon}
            </div>
            <span className="translate-y-px tracking-wide uppercase">{label}</span>
        </button>
    );
}
