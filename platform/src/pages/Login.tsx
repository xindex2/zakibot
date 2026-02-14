import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import StarField from '../components/StarField';
import { captureSource, syncSourceToServer } from '../lib/referral-tracking';

export default function Login() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // Capture source on page visit (survives OAuth redirect)
    useEffect(() => { captureSource(); }, []);

    // Handle Google OAuth redirect callback
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const userData = params.get('user');
        const googleError = params.get('error');

        if (token && userData) {
            try {
                const user = JSON.parse(decodeURIComponent(userData));
                login(token, user);
                // Sync the pre-auth source to the server
                syncSourceToServer(token);
                navigate('/dashboard');
            } catch (e) {
                console.error('Failed to parse user data from Google', e);
                setError('Authentication failed. Please try again.');
            }
        } else if (googleError) {
            setError(googleError === 'apple_auth_failed'
                ? 'Apple authentication failed. Please try again.'
                : 'Google authentication failed. Please try again.');
        }
    }, [location, login, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed');

            login(data.token || 'demo-token', data.user || data);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /** Use server-side OAuth redirect — works on all platforms (desktop, mobile, WebView) */
    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google';
    };

    const handleAppleLogin = () => {
        window.location.href = '/api/auth/apple';
    };

    return (
        <>
            <div className="min-h-screen relative flex items-center justify-center p-8 bg-[#050505] text-white">
                <StarField />

                <div className="relative z-10 w-full max-w-md">
                    <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 shadow-2xl">
                        <div className="text-center mb-12">
                            <div className="flex justify-center mb-6">
                                <Logo size={80} />
                            </div>
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Welcome Back</h2>
                            <p className="text-gray-500 font-medium">Login to manage your squad</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-bold">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#ff6b6b]/50 transition-all font-medium"
                                    placeholder="commander@zephyr.ai"
                                    required
                                />
                            </div>

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

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#ff6b6b] text-white py-5 rounded-2xl font-black tracking-widest uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#ff6b6b]/20 disabled:opacity-50"
                            >
                                {loading ? 'AUTHENTICATING...' : 'LOGIN'}
                            </button>

                            <div className="flex items-center gap-6 my-10">
                                <div className="h-[1px] bg-white/5 flex-1" />
                                <span className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em]">SIGNAL SPLIT</span>
                                <div className="h-[1px] bg-white/5 flex-1" />
                            </div>

                            {/* Google Sign-In — uses server-side OAuth redirect (works everywhere) */}
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
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
                                onClick={handleAppleLogin}
                                className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-2xl font-bold tracking-wide text-sm flex items-center justify-center gap-4 hover:bg-white/10 active:scale-95 transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 18 22" fill="white">
                                    <path d="M17.0493 7.52997C16.9373 7.61597 14.9653 8.72397 14.9653 11.186C14.9653 14.052 17.4933 15.052 17.5733 15.078C17.5613 15.14 17.1733 16.482 16.2373 17.848C15.4133 19.038 14.5533 20.226 13.2533 20.226C11.9533 20.226 11.5893 19.47 10.0893 19.47C8.62534 19.47 8.06534 20.25 6.86534 20.25C5.66534 20.25 4.82934 19.134 3.86534 17.776C2.74534 16.176 1.83734 13.716 1.83734 11.378C1.83734 7.78197 4.11734 5.86797 6.36134 5.86797C7.62534 5.86797 8.68134 6.69597 9.48934 6.69597C10.2613 6.69597 11.4373 5.81997 12.8853 5.81997C13.4453 5.81997 15.4173 5.86797 17.0493 7.52997ZM12.1293 3.83397C12.7533 3.09597 13.1893 2.07597 13.1893 1.05597C13.1893 0.917969 13.1773 0.777969 13.1533 0.665969C12.1413 0.701969 10.9413 1.33797 10.2013 2.17197C9.61334 2.83197 9.08134 3.85197 9.08134 4.88397C9.08134 5.03397 9.10534 5.18397 9.11734 5.23197C9.17734 5.24397 9.27334 5.25597 9.36934 5.25597C10.2733 5.25597 11.4693 4.64397 12.1293 3.83397Z" />
                                </svg>
                                Continue with Apple
                            </button>
                        </form>

                        {/* Mobile-only: How to Set Up Your First Agent */}
                        <div className="md:hidden mt-8">
                            <button
                                type="button"
                                onClick={() => setShowVideo(true)}
                                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-[#ff6b6b]/30 bg-gradient-to-r from-[#ff6b6b]/10 to-transparent hover:from-[#ff6b6b]/20 active:scale-[0.97] transition-all"
                            >
                                <div className="w-10 h-10 rounded-full bg-[#EF4444] flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 16px rgba(239,68,68,0.5), 0 0 32px rgba(239,68,68,0.2)' }}>
                                    <svg width="12" height="14" viewBox="0 0 12 14" fill="white">
                                        <path d="M0 0v14l12-7z" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <span className="text-sm font-bold text-white block">How to Set Up Your First Agent</span>
                                    <span className="text-[11px] text-white/40 font-medium">Watch a quick 60-second guide</span>
                                </div>
                            </button>
                        </div>

                        <div className="mt-12 pt-8 border-t border-white/5 text-center">
                            <p className="text-gray-500 text-sm font-medium">
                                Don't have access?{' '}
                                <Link to="/register" className="text-[#ff6b6b] font-bold hover:underline">Register Now!</Link>
                            </p>
                            <Link to="/" className="inline-block mt-4 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors">
                                ← BACK TO BASE
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Video Popup Modal */}
            {
                showVideo && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowVideo(false)}
                    >
                        <div
                            className="relative w-[90vw] max-w-[360px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowVideo(false)}
                                className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                            >
                                ✕
                            </button>
                            <div style={{ position: 'relative', paddingBottom: '177.78%', height: 0, borderRadius: '16px', overflow: 'hidden' }}>
                                <iframe
                                    src="https://www.youtube.com/embed/HW83uf-BvBk?autoplay=1"
                                    title="How to setup your 1st agent"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
