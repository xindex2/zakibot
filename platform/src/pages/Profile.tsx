import { useState, useEffect } from 'react';
import { User, Shield, Camera, Lock, Bot, Trash2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function Profile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [profileForm, setProfileForm] = useState({ full_name: '', avatar_url: '', password: '' });
    const [status, setStatus] = useState({ loading: false, error: '', success: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [deleteStatus, setDeleteStatus] = useState({ loading: false, error: '' });

    useEffect(() => {
        if (user) {
            setProfileForm({
                full_name: user.full_name || '',
                avatar_url: user.avatar_url || '',
                password: ''
            });
        }
    }, [user]);

    const handleUpdate = async () => {
        setStatus({ loading: true, error: '', success: '' });
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(profileForm)
            });
            if (res.ok) {
                setStatus({ loading: false, error: '', success: 'Profile synchronized successfully!' });
            } else {
                setStatus({ loading: false, error: 'Failed to update credentials.', success: '' });
            }
        } catch (err) {
            setStatus({ loading: false, error: 'Network error occurred.', success: '' });
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteStatus({ loading: true, error: '' });
        try {
            const res = await fetch('/api/profile', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ confirmEmail: deleteConfirmEmail })
            });
            const data = await res.json();
            if (res.ok) {
                logout();
                navigate('/login');
            } else {
                setDeleteStatus({ loading: false, error: data.error || 'Failed to delete account.' });
            }
        } catch (err) {
            setDeleteStatus({ loading: false, error: 'Network error occurred.' });
        }
    };

    return (
        <div className="space-y-12 max-w-4xl">
            <header>
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" /> Identity Crypt
                </div>
                <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Commander Profile</h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="col-span-1 space-y-6">
                    <div className="aspect-square rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden relative group shadow-2xl">
                        {profileForm.avatar_url ? (
                            <img src={profileForm.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                        ) : (
                            <Bot size={64} className="text-zinc-800" />
                        )}
                        <div className="absolute inset-0 bg-red-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <Camera className="text-white" size={24} />
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner">
                        <div className="flex items-center gap-3 mb-2">
                            <Shield size={16} className="text-red-500" />
                            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Clearance Level</h3>
                        </div>
                        <p className="text-xl font-bold text-white capitalize italic tracking-wide">{user?.role || 'Officer'}</p>
                        <p className="text-[10px] text-red-500/60 font-medium mt-1 uppercase tracking-tight">Level 4 Operational Grade</p>
                    </div>
                </div>

                <div className="col-span-2 space-y-8">
                    <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-10 shadow-xl space-y-8">
                        <div className="grid grid-cols-1 gap-8">
                            <InputWrapper label="Full Name">
                                <input
                                    value={profileForm.full_name}
                                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                                    className="input-modern w-full"
                                    placeholder="Enter your name"
                                />
                            </InputWrapper>
                            <InputWrapper label="Avatar URL">
                                <input
                                    value={profileForm.avatar_url}
                                    onChange={e => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                                    className="input-modern w-full"
                                    placeholder="https://images.com/photo..."
                                />
                            </InputWrapper>
                            <InputWrapper label="Update Secret Key">
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={profileForm.password}
                                        onChange={e => setProfileForm({ ...profileForm, password: e.target.value })}
                                        className="input-modern w-full pr-12"
                                        placeholder="••••••••"
                                    />
                                    <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700" />
                                </div>
                            </InputWrapper>
                        </div>

                        {status.success && (
                            <div className="p-4 bg-zinc-800 border border-red-900/50 text-red-500 text-xs font-bold rounded-xl flex items-center gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                {status.success}
                            </div>
                        )}

                        {status.error && (
                            <div className="p-4 bg-zinc-800 border border-red-900/50 text-red-700 text-xs font-bold rounded-xl flex items-center gap-3">
                                <div className="w-2 h-2 bg-red-700 rounded-full" />
                                {status.error}
                            </div>
                        )}

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={handleUpdate}
                                disabled={status.loading}
                                className="bg-red-600 text-white px-10 py-4 rounded-xl font-bold text-xs tracking-widest uppercase hover:scale-105 transition-all shadow-xl shadow-red-600/20 disabled:opacity-50"
                            >
                                {status.loading ? 'Synchronizing...' : 'Update Records'}
                            </button>
                        </div>
                    </section>

                    {/* ── Danger Zone ── */}
                    <section className="border border-red-900/40 rounded-3xl p-10 shadow-xl bg-red-950/10">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle size={18} className="text-red-500" />
                            <h2 className="text-sm font-black text-red-500 uppercase tracking-widest">Danger Zone</h2>
                        </div>
                        <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                            Permanently delete your account and all associated data including agents, configurations, chat history, and subscription.
                            <strong className="text-red-400"> This action cannot be undone.</strong>
                        </p>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-red-950/50 border border-red-800/50 text-red-400 px-8 py-3.5 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-red-900/50 hover:border-red-700/50 hover:text-red-300 active:scale-95 transition-all flex items-center gap-3"
                        >
                            <Trash2 size={14} />
                            Delete Account
                        </button>
                    </section>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}>
                    <div className="bg-zinc-900 border border-red-900/50 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                                <AlertTriangle size={22} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white tracking-tight">Delete Account</h3>
                                <p className="text-xs text-zinc-500 font-medium">This is permanent and irreversible</p>
                            </div>
                        </div>

                        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 mb-6">
                            <p className="text-red-400 text-xs font-bold leading-relaxed">
                                All your agents will be stopped and deleted. Your subscription, credits, and all data will be permanently removed. You will be logged out immediately.
                            </p>
                        </div>

                        <div className="space-y-2 mb-6">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block px-1">
                                Type your email to confirm: <span className="text-red-400">{user?.email}</span>
                            </label>
                            <input
                                type="email"
                                value={deleteConfirmEmail}
                                onChange={e => setDeleteConfirmEmail(e.target.value)}
                                className="input-modern w-full border-red-900/30 focus:border-red-500/50"
                                placeholder="your@email.com"
                                autoComplete="off"
                            />
                        </div>

                        {deleteStatus.error && (
                            <div className="p-3 bg-red-950/30 border border-red-900/30 text-red-400 text-xs font-bold rounded-lg mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                {deleteStatus.error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeleteConfirmEmail(''); setDeleteStatus({ loading: false, error: '' }); }}
                                className="flex-1 bg-zinc-800 text-zinc-300 py-4 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-zinc-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleteStatus.loading || deleteConfirmEmail !== user?.email}
                                className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-red-500 transition-all shadow-xl shadow-red-600/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} />
                                {deleteStatus.loading ? 'Deleting...' : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InputWrapper({ label, children }: any) {
    return (
        <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 block px-1">{label}</label>
            {children}
        </div>
    );
}
