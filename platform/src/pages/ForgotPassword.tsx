import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Something went wrong');
            }

            setSubmitted(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        Open<span className="text-[#ff4d4d]">Claw</span>
                    </h1>
                    <p className="text-[10px] text-white/20 uppercase tracking-[4px] mt-1">HOST</p>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-8">
                    {submitted ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4">📧</div>
                            <h2 className="text-xl font-bold text-white mb-3">Check your inbox</h2>
                            <p className="text-sm text-white/50 mb-6 leading-relaxed">
                                If an account exists with <strong className="text-white/70">{email}</strong>,
                                we've sent a password reset link. Check your email (and spam folder).
                            </p>
                            <Link
                                to="/login"
                                className="text-sm text-[#ff4d4d] hover:text-[#ff6b6b] font-semibold transition-colors"
                            >
                                ← Back to Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-white mb-2">Forgot password?</h2>
                            <p className="text-sm text-white/40 mb-6">
                                Enter your email and we'll send you a reset link.
                            </p>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        placeholder="you@example.com"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#ff4d4d]/40 transition-colors"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#ff4d4d] hover:bg-[#ff3333] text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>

                            <p className="text-center mt-6 text-sm text-white/30">
                                Remember your password?{' '}
                                <Link to="/login" className="text-[#ff4d4d] hover:text-[#ff6b6b] font-semibold transition-colors">
                                    Log in
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
