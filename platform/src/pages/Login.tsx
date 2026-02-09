import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import StarField from '../components/StarField';

declare global {
    interface Window {
        google?: any;
    }
}

export default function Login() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleClientId, setGoogleClientId] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // Handle Google OAuth redirect callback (legacy flow — still works on desktop)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const userData = params.get('user');
        const googleError = params.get('error');

        if (token && userData) {
            try {
                const user = JSON.parse(decodeURIComponent(userData));
                login(token, user);
                navigate('/dashboard');
            } catch (e) {
                console.error('Failed to parse user data from Google', e);
                setError('Authentication failed. Please try again.');
            }
        } else if (googleError) {
            setError('Google authentication failed. Please try again.');
        }
    }, [location, login, navigate]);

    // Handle Google credential response (client-side GIS flow)
    const handleGoogleCredential = useCallback(async (response: any) => {
        setLoading(true);
        setError('');
        try {
            const resp = await fetch('/api/auth/google/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Google login failed');
            login(data.token, data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [login, navigate]);

    // Load Google Identity Services SDK
    useEffect(() => {
        const loadGoogleSDK = async () => {
            try {
                const resp = await fetch('/api/auth/config');
                const cfg = await resp.json();
                if (!cfg.googleClientId) return;
                setGoogleClientId(cfg.googleClientId);

                // Load the GIS script if not already loaded
                if (!document.getElementById('google-gsi-script')) {
                    const script = document.createElement('script');
                    script.id = 'google-gsi-script';
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.async = true;
                    script.defer = true;
                    script.onload = () => initGoogle(cfg.googleClientId);
                    document.head.appendChild(script);
                } else if (window.google) {
                    initGoogle(cfg.googleClientId);
                }
            } catch (e) {
                console.error('Failed to load Google config', e);
            }
        };

        const initGoogle = (clientId: string) => {
            if (!window.google?.accounts?.id) return;
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleCredential,
                auto_select: false,
                cancel_on_tap_outside: true,
            });
        };

        loadGoogleSDK();
    }, [handleGoogleCredential]);

    const handleGoogleLogin = () => {
        if (window.google?.accounts?.id) {
            // Use the GIS popup flow (works everywhere including WebViews)
            window.google.accounts.id.prompt((notification: any) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Check if we're in an in-app browser (Facebook, Instagram, etc.)
                    const ua = navigator.userAgent || '';
                    const isInAppBrowser = /FBAN|FBAV|Instagram|Line|Twitter|MicroMessenger|Snapchat/i.test(ua);
                    if (isInAppBrowser) {
                        // In-app browsers block Google OAuth redirects — tell user to open in real browser
                        setError('Google Sign-In is not available in this browser. Please open in Chrome, Safari, or your default browser (tap ⋮ → "Open in browser").');
                    } else {
                        // Desktop or real mobile browser — safe to redirect
                        window.location.href = '/api/auth/google';
                    }
                }
            });
        } else {
            // GIS not loaded — check if in-app browser
            const ua = navigator.userAgent || '';
            const isInAppBrowser = /FBAN|FBAV|Instagram|Line|Twitter|MicroMessenger|Snapchat/i.test(ua);
            if (isInAppBrowser) {
                setError('Google Sign-In is not available in this browser. Please open in Chrome, Safari, or your default browser (tap ⋮ → "Open in browser").');
            } else {
                setLoading(true);
                window.location.href = '/api/auth/google';
            }
        }
    };

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

    return (
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
                            {loading ? 'AUTHENTICATING...' : 'ENTER HUB'}
                        </button>

                        <div className="flex items-center gap-6 my-10">
                            <div className="h-[1px] bg-white/5 flex-1" />
                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em]">SIGNAL SPLIT</span>
                            <div className="h-[1px] bg-white/5 flex-1" />
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white/5 border border-white/5 text-white py-5 rounded-2xl font-black tracking-widest uppercase text-[10px] hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-4"
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" />
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853" />
                                <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#fbbc05" />
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335" />
                            </svg>
                            CONTINUE WITH GOOGLE
                        </button>
                    </form>

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
    );
}
