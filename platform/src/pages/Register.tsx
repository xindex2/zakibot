import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import StarField from '../components/StarField';
import { captureSource, getSource } from '../lib/referral-tracking';

export default function Register() {
    // Capture source on page visit (survives OAuth redirect)
    useEffect(() => { captureSource(); }, []);
    const [formData, setFormData] = useState({ full_name: '', email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: formData.full_name,
                    email: formData.email,
                    password: formData.password,
                    acquisition_source: getSource()
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed');

            login(data.token || 'demo-token', data.user || data);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-8 bg-[#050505] text-white">
            <StarField />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 shadow-2xl">
                    <div className="text-center mb-12">
                        <div className="flex justify-center mb-6">
                            <Logo size={80} />
                        </div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Join the Squad</h2>
                        <p className="text-gray-500 font-medium">Start hosting your OpenClaw instances</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-bold">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Full Name</label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#ff6b6b]/50 transition-all font-medium"
                                placeholder="John Doe"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#ff6b6b]/50 transition-all font-medium"
                                placeholder="your@email.com"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#ff6b6b]/50 transition-all font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Confirm</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#ff6b6b]/50 transition-all font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#ff6b6b] text-white py-5 rounded-2xl font-black tracking-widest uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#ff6b6b]/20 disabled:opacity-50"
                        >
                            {loading ? 'INITIALIZING...' : 'CREATE ACCOUNT'}
                        </button>

                        <div className="flex items-center gap-6 my-10">
                            <div className="h-[1px] bg-white/5 flex-1" />
                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em]">OR</span>
                            <div className="h-[1px] bg-white/5 flex-1" />
                        </div>

                        {/* Google Sign-In */}
                        <button
                            type="button"
                            onClick={() => { window.location.href = '/api/auth/google'; }}
                            className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-2xl font-bold tracking-wide text-sm flex items-center justify-center gap-4 hover:bg-white/10 active:scale-95 transition-all"
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" />
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853" />
                                <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#fbbc05" />
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335" />
                            </svg>
                            Continue with Google
                        </button>

                        {/* Apple Sign-In */}
                        <button
                            type="button"
                            onClick={() => { window.location.href = '/api/auth/apple'; }}
                            className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-2xl font-bold tracking-wide text-sm flex items-center justify-center gap-4 hover:bg-white/10 active:scale-95 transition-all mt-3"
                        >
                            <svg width="18" height="18" viewBox="0 0 18 22" fill="white">
                                <path d="M17.0493 7.52997C16.9373 7.61597 14.9653 8.72397 14.9653 11.186C14.9653 14.052 17.4933 15.052 17.5733 15.078C17.5613 15.14 17.1733 16.482 16.2373 17.848C15.4133 19.038 14.5533 20.226 13.2533 20.226C11.9533 20.226 11.5893 19.47 10.0893 19.47C8.62534 19.47 8.06534 20.25 6.86534 20.25C5.66534 20.25 4.82934 19.134 3.86534 17.776C2.74534 16.176 1.83734 13.716 1.83734 11.378C1.83734 7.78197 4.11734 5.86797 6.36134 5.86797C7.62534 5.86797 8.68134 6.69597 9.48934 6.69597C10.2613 6.69597 11.4373 5.81997 12.8853 5.81997C13.4453 5.81997 15.4173 5.86797 17.0493 7.52997ZM12.1293 3.83397C12.7533 3.09597 13.1893 2.07597 13.1893 1.05597C13.1893 0.917969 13.1773 0.777969 13.1533 0.665969C12.1413 0.701969 10.9413 1.33797 10.2013 2.17197C9.61334 2.83197 9.08134 3.85197 9.08134 4.88397C9.08134 5.03397 9.10534 5.18397 9.11734 5.23197C9.17734 5.24397 9.27334 5.25597 9.36934 5.25597C10.2733 5.25597 11.4693 4.64397 12.1293 3.83397Z" />
                            </svg>
                            Continue with Apple
                        </button>
                    </form>

                    <div className="mt-12 pt-8 border-t border-white/5 text-center">
                        <p className="text-gray-500 text-sm font-medium">
                            Already have an account?{' '}
                            <Link to="/login" className="text-[#ff6b6b] font-bold hover:underline">Login</Link>
                        </p>
                        <Link to="/" className="inline-block mt-4 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors">
                            ← BACK TO BASE
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
