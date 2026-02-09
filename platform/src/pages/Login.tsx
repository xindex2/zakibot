import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import StarField from '../components/StarField';

declare global {
    interface Window {
        google?: any;
    }
}

/** Detect in-app WebView browsers (Instagram, Facebook, TikTok, etc.) */
function isWebView(): boolean {
    const ua = navigator.userAgent || '';
    return /FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger|Snapchat|TikTok|BytedanceWebview|wv\)/i.test(ua);
}

/** Try to open the current page in the system browser, escaping the WebView */
function openInSystemBrowser(): boolean {
    const url = window.location.href;

    // Android: intent:// URL opens the page in the default browser
    if (/android/i.test(navigator.userAgent)) {
        const host = window.location.host;
        const path = window.location.pathname + window.location.search;
        window.location.href = `intent://${host}${path}#Intent;scheme=https;end`;
        return true;
    }

    // iOS & others: try window.open (some WebViews open system browser for _blank)
    const w = window.open(url, '_blank');
    if (w) return true;

    // Fallback: copy URL to clipboard
    try {
        navigator.clipboard.writeText(url);
    } catch { /* ignore */ }
    return false;
}

export default function Login() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const [googleFailed, setGoogleFailed] = useState(false);
    const [urlCopied, setUrlCopied] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const googleBtnRef = useRef<HTMLDivElement>(null);

    // On Android WebViews: auto-redirect to system browser immediately
    useEffect(() => {
        if (isWebView() && /android/i.test(navigator.userAgent)) {
            openInSystemBrowser();
        }
    }, []);

    // Handle Google OAuth redirect callback (legacy desktop flow)
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

    // Handle Google credential response (called by GIS)
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

    // Load Google Identity Services SDK and render button
    useEffect(() => {
        let mounted = true;
        let timeoutId: ReturnType<typeof setTimeout>;

        const loadGoogleSDK = async () => {
            try {
                const resp = await fetch('/api/auth/config');
                const cfg = await resp.json();
                if (!cfg.googleClientId || !mounted) return;

                // If Google doesn't load within 4 seconds, show fallback
                timeoutId = setTimeout(() => {
                    if (mounted && !googleReady) {
                        setGoogleFailed(true);
                    }
                }, 4000);

                const initAndRender = (clientId: string) => {
                    if (!window.google?.accounts?.id || !mounted) return;

                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleGoogleCredential,
                        auto_select: false,
                        cancel_on_tap_outside: true,
                        ux_mode: 'popup',
                        use_fedcm_for_prompt: false,
                    });

                    if (googleBtnRef.current) {
                        googleBtnRef.current.innerHTML = '';
                        window.google.accounts.id.renderButton(googleBtnRef.current, {
                            type: 'standard',
                            theme: 'filled_black',
                            size: 'large',
                            text: 'continue_with',
                            shape: 'pill',
                            width: Math.min(googleBtnRef.current.offsetWidth || 340, 400),
                            logo_alignment: 'center',
                        });
                        if (mounted) {
                            setGoogleReady(true);
                            setGoogleFailed(false);
                            clearTimeout(timeoutId);
                        }
                    }

                    window.google.accounts.id.prompt();
                };

                if (!document.getElementById('google-gsi-script')) {
                    const script = document.createElement('script');
                    script.id = 'google-gsi-script';
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.async = true;
                    script.defer = true;
                    script.onload = () => initAndRender(cfg.googleClientId);
                    script.onerror = () => { if (mounted) setGoogleFailed(true); };
                    document.head.appendChild(script);
                } else if (window.google) {
                    initAndRender(cfg.googleClientId);
                }
            } catch (e) {
                console.error('Failed to load Google config', e);
                if (mounted) setGoogleFailed(true);
            }
        };

        loadGoogleSDK();
        return () => { mounted = false; clearTimeout(timeoutId); };
    }, [handleGoogleCredential]);

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

    const handleOpenInBrowser = () => {
        const opened = openInSystemBrowser();
        if (!opened) {
            // Couldn't open — at least copy URL
            try {
                navigator.clipboard.writeText(window.location.href);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 3000);
            } catch { /* ignore */ }
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

                        {/* Google Sign-In Button */}
                        <div className="flex flex-col items-center gap-3">
                            <div
                                ref={googleBtnRef}
                                className="w-full flex items-center justify-center"
                                style={{ minHeight: 50, display: googleReady ? 'flex' : 'none' }}
                            />
                            {!googleReady && !googleFailed && (
                                <div className="w-full bg-white/5 border border-white/5 text-gray-600 py-5 rounded-2xl font-black tracking-widest uppercase text-[10px] flex items-center justify-center gap-4 opacity-60">
                                    <svg width="18" height="18" viewBox="0 0 18 18">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" />
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853" />
                                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#fbbc05" />
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335" />
                                    </svg>
                                    Loading Google Sign-In...
                                </div>
                            )}
                            {!googleReady && googleFailed && (
                                <button
                                    type="button"
                                    onClick={handleOpenInBrowser}
                                    className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-2xl font-bold tracking-wide text-xs flex items-center justify-center gap-4 hover:bg-white/10 active:scale-95 transition-all"
                                >
                                    <svg width="18" height="18" viewBox="0 0 18 18">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" />
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853" />
                                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#fbbc05" />
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335" />
                                    </svg>
                                    {urlCopied ? '✓ Link Copied — Paste in Browser' : 'Open in Browser to Sign in with Google'}
                                </button>
                            )}
                        </div>
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
