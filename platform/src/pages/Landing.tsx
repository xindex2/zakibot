import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { captureSource } from '../lib/referral-tracking';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

declare global {
    interface Window {
        google?: any;
    }
}
import {
    faServer,
    faTerminal,
    faBolt,
    faHdd,
    faRobot,
    faArrowRight,
    faQuestionCircle,
    faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import Logo from '../components/Logo';
import StarField from '../components/StarField';
import Footer from '../components/Footer';

export default function Landing() {
    const { isAuthenticated, login } = useAuth();
    const navigate = useNavigate();
    const [oneTapLoading, setOneTapLoading] = useState(false);

    // Handle Google One Tap credential
    const handleGoogleCredential = useCallback(async (response: any) => {
        setOneTapLoading(true);
        try {
            const resp = await fetch('/api/auth/google/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            const data = await resp.json();
            if (resp.ok && data.token) {
                login(data.token, data.user);
                navigate('/dashboard');
            }
        } catch (e) {
            console.error('Google One Tap login failed:', e);
        } finally {
            setOneTapLoading(false);
        }
    }, [login, navigate]);

    // Google One Tap initialization
    useEffect(() => {
        if (isAuthenticated) return;

        const initOneTap = async () => {
            try {
                const resp = await fetch('/api/auth/config');
                const cfg = await resp.json();
                if (!cfg.googleClientId) return;

                const loadAndInit = (clientId: string) => {
                    if (!window.google?.accounts?.id) return;
                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleGoogleCredential,
                        auto_select: false,
                        cancel_on_tap_outside: true,
                    });
                    window.google.accounts.id.prompt();
                };

                if (!document.getElementById('google-gsi-script')) {
                    const script = document.createElement('script');
                    script.id = 'google-gsi-script';
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.async = true;
                    script.defer = true;
                    script.onload = () => loadAndInit(cfg.googleClientId);
                    document.head.appendChild(script);
                } else if (window.google) {
                    loadAndInit(cfg.googleClientId);
                }
            } catch (e) {
                console.error('Failed to load Google One Tap:', e);
            }
        };

        initOneTap();
    }, [isAuthenticated, handleGoogleCredential]);
    useEffect(() => {
        document.title = "OpenClaw VPS Hosting & Deploy OpenClaw Multi Agents in 60s - MyClaw.Host";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute("content", "The easiest way to host OpenClaw agents. 1-Click setup, Multi-Agent support for Telegram & WhatsApp, and 24/7 uptime. Start for $19/mo.");
        }

        // Track acquisition source (persists in localStorage through OAuth redirects)
        captureSource();
    }, []);

    return (
        <div className="landing" style={{ position: 'relative', background: 'var(--bg-deep)', minHeight: '100vh' }}>
            <StarField />

            {/* Navigation */}
            <nav className="nav" style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>
                <div className="container flex-between" style={{ padding: 'clamp(0.75rem, 2vw, 1.25rem) var(--spacing-lg)' }}>
                    <div className="flex gap-md" style={{ alignItems: 'center' }}>
                        <h3 style={{ margin: 0, letterSpacing: '-0.02em' }}>My<span style={{ color: '#ef4444' }}>Claw</span>.Host</h3>
                        <Logo size={36} />
                    </div>
                    <div className="flex gap-lg" style={{ alignItems: 'center' }}>
                        <a href="#pricing" className="btn btn-ghost" style={{ fontSize: '0.95rem' }}>Pricing</a>
                        <a href="#faq" className="btn btn-ghost" style={{ fontSize: '0.95rem' }}>FAQ</a>
                        {isAuthenticated ? (
                            <Link to="/dashboard" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.95rem' }}>Login</Link>
                                <Link to="/register" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>Get Started</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero" style={{
                minHeight: '85vh',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                zIndex: 1,
                padding: 'var(--spacing-2xl) 0',
            }}>
                <div className="container text-center">
                    <div className="animate-fade-in-up" style={{ maxWidth: '900px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-xl)' }}>
                            <Logo size={120} />
                        </div>

                        <h1 style={{
                            fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
                            marginBottom: 'var(--spacing-md)',
                            lineHeight: 1.05,
                            letterSpacing: '-0.03em',
                            textTransform: 'uppercase'
                        }}>
                            OpenClaw VPS Hosting
                        </h1>

                        <p style={{
                            fontSize: '1.3rem',
                            maxWidth: '700px',
                            margin: '0 auto var(--spacing-xl)',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.6,
                        }}>
                            Deploy autonomous AI agents in 60 seconds. No coding. No servers. Just results.
                        </p>

                        {/* Key Benefits */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-sm)',
                            alignItems: 'center',
                            marginBottom: 'var(--spacing-2xl)',
                        }}>
                            {[
                                { icon: '✅', text: 'Multi-Agent Support: Run Telegram & WhatsApp bots simultaneously.' },
                                { icon: '✅', text: '24/7 Uptime: Your agents work while you sleep.' },
                                { icon: '✅', text: '1-Click Setup: No Linux commands required.' },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '1.05rem',
                                    color: 'var(--color-text-secondary)',
                                }}>
                                    <span>{item.icon}</span>
                                    <span>{item.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Providers & Channels Showcase */}
                        <div style={{ maxWidth: '700px', margin: '0 auto var(--spacing-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            {/* AI Providers */}
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 'bold', marginBottom: '0.75rem' }}>Supported AI Models</p>
                                <div className="flex-center" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { name: 'Anthropic', icon: 'https://www.anthropic.com/favicon.ico' },
                                        { name: 'OpenAI', icon: 'https://openai.com/favicon.ico' },
                                        { name: 'Google', icon: 'https://www.google.com/favicon.ico' },
                                        { name: 'DeepSeek', icon: 'https://www.deepseek.com/favicon.ico' },
                                        { name: 'xAI', icon: 'https://x.ai/favicon.ico' },
                                        { name: 'Groq', icon: 'https://groq.com/favicon.ico' },
                                        { name: 'OpenRouter', icon: 'https://openrouter.ai/favicon.ico' },
                                    ].map((p) => (
                                        <div key={p.name} style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '0.4rem 0.75rem',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '999px',
                                            fontSize: '0.8rem',
                                            color: 'var(--color-text-secondary)',
                                            fontWeight: '600'
                                        }}>
                                            <img src={p.icon} alt={p.name} style={{ width: 16, height: 16, borderRadius: '4px' }} />
                                            {p.name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Channels */}
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 'bold', marginBottom: '0.75rem' }}>Channels & Integrations</p>
                                <div className="flex-center" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { name: 'Telegram', icon: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png' },
                                        { name: 'Discord', icon: 'https://favicon.im/discord.com?t=1770422839363' },
                                        { name: 'WhatsApp', icon: 'https://favicon.im/whatsapp.com?larger=true' },
                                        { name: 'Slack', icon: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png' },
                                    ].map((ch) => (
                                        <div key={ch.name} style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '0.4rem 0.75rem',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '999px',
                                            fontSize: '0.8rem',
                                            color: 'var(--color-text-secondary)',
                                            fontWeight: '600'
                                        }}>
                                            <img src={ch.icon} alt={ch.name} style={{ width: 16, height: 16, borderRadius: '4px' }} />
                                            {ch.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex-center gap-md" style={{ flexWrap: 'wrap' }}>
                            <Link to="/register" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2.5rem' }}>
                                Deploy Your Agent Now
                            </Link>
                            {!isAuthenticated && (
                                <>
                                    <a
                                        href="/api/auth/google"
                                        className="btn btn-ghost"
                                        style={{
                                            fontSize: '1rem',
                                            padding: '0.85rem 2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: 'var(--radius-lg)',
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 18 18">
                                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" />
                                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853" />
                                            <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#fbbc05" />
                                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335" />
                                        </svg>
                                        Login with Google
                                    </a>
                                    <a
                                        href="/api/auth/apple"
                                        className="btn btn-ghost"
                                        style={{
                                            fontSize: '1rem',
                                            padding: '0.85rem 2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: 'var(--radius-lg)',
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 18 22" fill="white">
                                            <path d="M17.0493 7.52997C16.9373 7.61597 14.9653 8.72397 14.9653 11.186C14.9653 14.052 17.4933 15.052 17.5733 15.078C17.5613 15.14 17.1733 16.482 16.2373 17.848C15.4133 19.038 14.5533 20.226 13.2533 20.226C11.9533 20.226 11.5893 19.47 10.0893 19.47C8.62534 19.47 8.06534 20.25 6.86534 20.25C5.66534 20.25 4.82934 19.134 3.86534 17.776C2.74534 16.176 1.83734 13.716 1.83734 11.378C1.83734 7.78197 4.11734 5.86797 6.36134 5.86797C7.62534 5.86797 8.68134 6.69597 9.48934 6.69597C10.2613 6.69597 11.4373 5.81997 12.8853 5.81997C13.4453 5.81997 15.4173 5.86797 17.0493 7.52997ZM12.1293 3.83397C12.7533 3.09597 13.1893 2.07597 13.1893 1.05597C13.1893 0.917969 13.1773 0.777969 13.1533 0.665969C12.1413 0.701969 10.9413 1.33797 10.2013 2.17197C9.61334 2.83197 9.08134 3.85197 9.08134 4.88397C9.08134 5.03397 9.10534 5.18397 9.11734 5.23197C9.17734 5.24397 9.27334 5.25597 9.36934 5.25597C10.2733 5.25597 11.4693 4.64397 12.1293 3.83397Z" />
                                        </svg>
                                        Login with Apple
                                    </a>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </section>

            {/* What is OpenClaw? — SEO Section */}
            <section style={{
                padding: 'var(--spacing-2xl) 0',
                background: 'rgba(255,255,255,0.02)',
                borderTop: '1px solid var(--color-border)',
                position: 'relative',
                zIndex: 1
            }}>
                <div className="container" style={{ maxWidth: '850px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-lg)', letterSpacing: '-0.02em' }}>
                        What is OpenClaw?
                    </h2>
                    <p style={{
                        fontSize: '1.15rem',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.8,
                        margin: '0 auto'
                    }}>
                        <strong>OpenClaw</strong> is an open-source autonomous agent framework.
                        Unlike standard VPS providers like Contabo or Hostinger where you get a blank Linux server,
                        <strong> MyClaw</strong> gives you a <strong>fully managed OpenClaw instance</strong> pre-installed
                        with Docker, ready to automate tasks on <strong>Telegram</strong>, <strong>Discord</strong>,
                        <strong> WhatsApp</strong>, and the web instantly.
                    </p>
                    <div style={{
                        marginTop: 'var(--spacing-xl)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: 'var(--spacing-lg)'
                    }}>
                        {[
                            { label: 'Pre-installed Docker', icon: '🐳' },
                            { label: 'Ready for Telegram', icon: '💬' },
                            { label: 'WhatsApp Support', icon: '📱' },
                            { label: 'Web Automation', icon: '🌐' },
                        ].map((item, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0.6rem 1.2rem',
                                background: 'rgba(255,107,107,0.06)',
                                border: '1px solid rgba(255,107,107,0.15)',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.9rem',
                                color: 'var(--color-text-secondary)',
                                fontWeight: '600'
                            }}>
                                <span>{item.icon}</span>
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Video Demo */}
            <section style={{ padding: 'var(--spacing-2xl) 0', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--color-border)', position: 'relative', zIndex: 1 }}>
                <div className="container">

                    <p className="text-center" style={{ color: 'var(--color-text-secondary)', maxWidth: '700px', margin: '0 auto var(--spacing-2xl)', fontSize: '1.1rem', lineHeight: 1.6 }}>
                        Watch how to deploy your OpenClaw agent in under 60 seconds.
                    </p>

                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {/* Desktop: 16:9 landscape video */}
                        <div className="hidden md:block card-glass" style={{ padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-xl)' }}>
                            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <iframe
                                    src="https://www.youtube.com/embed/BoQAmvbViAg"
                                    title="OpenClaw Demo"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                />
                            </div>
                        </div>

                        {/* Mobile: 9:16 vertical short */}
                        <div className="md:hidden card-glass" style={{ padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-xl)' }}>
                            <div style={{ position: 'relative', paddingBottom: '177.78%', height: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxWidth: '350px', margin: '0 auto' }}>
                                <iframe
                                    src="https://www.youtube.com/embed/HW83uf-BvBk"
                                    title="OpenClaw Demo"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" style={{ padding: 'var(--spacing-2xl) 0', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--color-border)', position: 'relative', zIndex: 1 }}>
                <div className="container">
                    <h2 className="text-center mb-xl" style={{ letterSpacing: '-0.02em', fontSize: '2.5rem' }}>
                        Enterprise OpenClaw VPS features
                    </h2>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 'var(--spacing-xl)',
                        marginTop: 'var(--spacing-2xl)',
                    }}>
                        {[
                            { icon: faServer, title: "OpenClaw VPS", text: "Each instance runs in an isolated high-performance Docker container." },
                            { icon: faTerminal, title: "Instant Installation", text: "No technical skills needed. Our automated scripts install OpenClaw for you." },
                            { icon: faBolt, title: "1-Click Deploy", text: "Launch your dedicated AI environment instantly with our optimized setup." },
                            { icon: faHdd, title: "Safe Storage", text: "Your data and agent configuration persist securely across container restarts." },
                            { icon: faRobot, title: "Unlimited Agents", text: "Run multiple OpenClaw agents tailored for different tasks on one account." },
                            { icon: faBolt, title: "Auto-Scalable", text: "Enterprise-grade infrastructure that grows with your AI agent needs." }
                        ].map((feature, i) => (
                            <div key={i} className="card-glass" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-md)', color: 'var(--coral-bright)' }}>
                                    <FontAwesomeIcon icon={feature.icon} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-sm)' }}>{feature.title}</h3>
                                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>{feature.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Deploy Under 1 Minute */}
            <section style={{ padding: 'var(--spacing-2xl) 0', background: 'rgba(255,107,107,0.02)', borderTop: '1px solid var(--color-border)', position: 'relative', zIndex: 1 }}>
                <div className="container">
                    <h2 className="text-center" style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)', letterSpacing: '-0.02em' }}>
                        Deploy OpenClaw under 1 minute
                    </h2>
                    <p className="text-center" style={{ color: 'var(--color-text-secondary)', maxWidth: '700px', margin: '0 auto var(--spacing-2xl)', fontSize: '1.1rem', lineHeight: 1.6 }}>
                        Avoid all technical complexity and one-click deploy your own 24/7 active OpenClaw instance under 1 minute.
                    </p>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                        gap: 'var(--spacing-xl)',
                        maxWidth: '1000px',
                        margin: '0 auto'
                    }}>
                        {/* Traditional Method */}
                        <div className="card-glass" style={{
                            padding: 'var(--spacing-xl)',
                            borderRadius: 'var(--radius-xl)',
                            opacity: 0.7,
                            border: '1px solid var(--color-border)'
                        }}>
                            <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-muted)' }}>
                                Traditional Method
                            </h3>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {[
                                    { step: 'Purchasing a VPS server', time: '15 min' },
                                    { step: 'Creating SSH keys & storing securely', time: '10 min' },
                                    { step: 'Connecting to the server via SSH', time: '5 min' },
                                    { step: 'Installing Node.js and NPM', time: '5 min' },
                                    { step: 'Installing OpenClaw', time: '7 min' },
                                    { step: 'Setting up OpenClaw', time: '10 min' },
                                    { step: 'Connecting to AI provider', time: '4 min' },
                                    { step: 'Pairing with Telegram', time: '4 min' },
                                ].map((item, i) => (
                                    <li key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.6rem 0',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-secondary)'
                                    }}>
                                        <span>{item.step}</span>
                                        <span style={{ fontWeight: 'bold', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>{item.time}</span>
                                    </li>
                                ))}
                            </ul>
                            <div style={{
                                marginTop: 'var(--spacing-lg)',
                                padding: '0.75rem 1rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Total</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>~60 min</span>
                            </div>
                            <p style={{ marginTop: 'var(--spacing-md)', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
                                If you're non-technical, multiply these times by 10 — you have to learn each step before doing it.
                            </p>
                        </div>

                        {/* MyClaw.Host */}
                        <div className="card-glass" style={{
                            padding: 'var(--spacing-xl)',
                            borderRadius: 'var(--radius-xl)',
                            border: '2px solid var(--coral-bright)',
                            background: 'linear-gradient(135deg, rgba(255,107,107,0.06) 0%, rgba(255,107,107,0.02) 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '-12px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'linear-gradient(135deg, var(--coral-bright), #ff8a5c)',
                                color: 'white',
                                padding: '4px 18px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                ⚡ MyClaw.Host
                            </div>
                            <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--spacing-lg)', color: 'var(--coral-bright)', textAlign: 'center' }}>
                                With MyClaw.Host
                            </h3>
                            {/* 3-step flow */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                                {[
                                    { num: '1', label: 'Choose your AI model', icon: '🧠', time: '10s' },
                                    { num: '2', label: 'Connect Telegram or WhatsApp', icon: '💬', time: '20s' },
                                    { num: '3', label: 'Hit Deploy — you\'re live', icon: '🚀', time: '5s' },
                                ].map((step, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-md)',
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: '3px solid var(--coral-bright)'
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>{step.icon}</span>
                                        <span style={{ flex: 1, fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>{step.label}</span>
                                        <span style={{ fontWeight: 'bold', color: 'var(--coral-bright)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{step.time}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'rgba(255,107,107,0.08)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--spacing-md)'
                            }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Total</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--coral-bright)' }}>&lt;1 min</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
                                No servers. No SSH. No terminal. Everything is pre-configured and ready to go.
                            </p>
                            <Link to="/register" className="btn btn-primary" style={{ padding: '0.8rem 2.5rem', fontSize: '1rem', alignSelf: 'center' }}>
                                <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: '8px' }} />
                                Deploy Now
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
            {/* Pricing Section */}
            <section id="pricing" style={{ padding: 'var(--spacing-2xl) 0', position: 'relative', zIndex: 1, borderTop: '1px solid var(--color-border)' }}>
                <div className="container">
                    <h2 className="text-center mb-xl" style={{ fontSize: '2.5rem' }}>Simple, Transparent Pricing</h2>
                    <p className="text-center" style={{ color: 'var(--color-text-secondary)', maxWidth: '700px', margin: '0 auto var(--spacing-2xl)', fontSize: '1.1rem' }}>
                        All plans include unlimited usage. You provide your own API keys, we provide the ultimate high-performance hosting.
                    </p>

                    <div className="responsive-grid" style={{
                        marginTop: 'var(--spacing-xl)',
                        maxWidth: '1200px',
                        margin: 'var(--spacing-xl) auto 0'
                    }}>
                        {[
                            { name: "One Agent", price: "$19", limit: "1 Agent", features: ["Dedicated VPS", "1-Click Installation", "Web Terminal Access", "Persistent Storage"], checkoutUrl: "https://whop.com/checkout/plan_Ke7ZeyJO29DwZ" },
                            { name: "5 Agents", price: "$69", limit: "Multi-Agent Dashboard: Run 5 Simultaneous Bots", features: ["Priority Support", "Dedicated Resources", "Multi-Agent Dashboard", "Safe Volume Backups"], popular: true, checkoutUrl: "https://whop.com/checkout/plan_9NRNdPMrVzwi8" },
                            { name: "10 Agents", price: "$99", limit: "Up to 10 Agents", features: ["Enterprise Hardware", "Advanced Monitoring", "Custom Subdomains", "Global Edge Network"], checkoutUrl: "https://whop.com/checkout/plan_XXO2Ey0ki51AI" },
                        ].map((plan, i) => (
                            <div key={i} className="card-glass" style={{
                                padding: 'var(--spacing-xl)',
                                borderRadius: 'var(--radius-xl)',
                                display: 'flex',
                                flexDirection: 'column',
                                border: plan.popular ? '2px solid var(--coral-bright)' : '1px solid var(--color-border)',
                                background: plan.popular ? 'rgba(255,107,107,0.03)' : 'var(--color-bg-elevated)',
                                position: 'relative'
                            }}>
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-12px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        background: 'var(--coral-bright)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        Most Popular
                                    </div>
                                )}
                                <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-xs)' }}>{plan.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: 'var(--spacing-md)' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{plan.price}</span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>/mo</span>
                                </div>
                                <p style={{ color: 'var(--coral-bright)', fontWeight: 'bold', marginBottom: 'var(--spacing-lg)' }}>{plan.limit}</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--spacing-xl) 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {plan.features.map((f, j) => (
                                        <li key={j} style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'var(--color-success)', fontSize: '0.8rem' }} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                {isAuthenticated ? (
                                    <a href={plan.checkoutUrl} target="_blank" rel="noopener noreferrer" className={`btn ${plan.popular ? 'btn-primary' : 'btn-ghost'}`} style={{ width: '100%', textAlign: 'center' }}>
                                        Buy Now on Whop
                                    </a>
                                ) : (
                                    <Link to="/register" className={`btn ${plan.popular ? 'btn-primary' : 'btn-ghost'}`} style={{ width: '100%', textAlign: 'center' }}>
                                        Register Now
                                    </Link>
                                )}
                                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--spacing-sm)' }}>
                                    {isAuthenticated ? 'Instant account creation with Whop' : 'Create an account to view checkout'}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Enterprise / Custom Section */}
                    <div className="card-glass enterprise-custom-card" style={{
                        marginTop: 'var(--spacing-xl)',
                        maxWidth: '1200px',
                        margin: 'var(--spacing-xl) auto 0',
                        padding: 'var(--spacing-xl) var(--spacing-2xl)',
                        borderRadius: 'var(--radius-xl)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-xl)',
                        border: '1px solid var(--color-border)',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,107,107,0.05) 100%)'
                    }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--spacing-sm)' }}>
                                <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Enterprise</span>
                                <h3 style={{ margin: 0, fontSize: 'clamp(1.5rem, 5vw, 2rem)' }}>Custom Plan</h3>
                            </div>
                            <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                                Need more than 10 agents? We provide dedicated clusters and custom SLA.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', flex: '1 1 300px' }}>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', width: '100%', gap: 'var(--spacing-sm) var(--spacing-xl)' }}>
                                {[
                                    "Custom Agent Limits",
                                    "Dedicated Account Manager",
                                    "SLA Guarantee",
                                    "Private Infrastructure"
                                ].map((f, i) => (
                                    <li key={i} style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'var(--coral-bright)', fontSize: '0.75rem' }} />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ flex: '0 0 auto', width: 'auto' }}>
                            <Link to="/contact" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                                Contact Sales
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Technical Specs */}
            <section style={{
                padding: 'var(--spacing-lg) 0',
                position: 'relative',
                zIndex: 1,
                borderTop: '1px solid var(--color-border)',
                background: 'rgba(255,255,255,0.015)'
            }}>
                <div className="container text-center">
                    <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        fontWeight: 'bold',
                        marginBottom: 'var(--spacing-md)'
                    }}>Technical Specs</p>
                    <div className="flex-center" style={{ gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                        {[
                            'Dedicated Docker Container',
                            '2GB+ RAM',
                            'NVMe Storage',
                            'Persistent Memory',
                            'Auto-Healing'
                        ].map((spec, i) => (
                            <span key={i} style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.85rem',
                                color: 'var(--color-text-secondary)',
                                fontWeight: '600'
                            }}>
                                {spec}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section style={{
                padding: 'var(--spacing-2xl) 0',
                position: 'relative',
                zIndex: 1,
                borderTop: '1px solid var(--color-border)',
                background: 'rgba(255,107,107,0.02)'
            }}>
                <div className="container">
                    <h2 className="text-center mb-xl" style={{ fontSize: '2.5rem', letterSpacing: '-0.02em' }}>Why MyClaw vs. a Standard VPS?</h2>
                    <p className="text-center" style={{ color: 'var(--color-text-secondary)', maxWidth: '700px', margin: '0 auto var(--spacing-2xl)', fontSize: '1.1rem' }}>
                        Stop wasting hours on server setup. See how we compare to DIY VPS providers.
                    </p>
                    <div style={{ maxWidth: '800px', margin: '0 auto', overflow: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-xl)',
                            overflow: 'hidden',
                            fontSize: '0.95rem'
                        }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    <th style={{ padding: '1rem 1.25rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feature</th>
                                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', color: 'var(--coral-bright)', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MyClaw (Us)</th>
                                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standard VPS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { feature: 'Setup Time', us: '60 Seconds (1-Click)', them: '45+ Minutes (Manual)' },
                                    { feature: 'Software', us: 'Pre-Installed', them: 'You Install It Yourself' },
                                    { feature: 'Multi-Agent', us: 'Built-in Dashboard', them: 'Requires Complex Coding' },
                                    { feature: 'Maintenance', us: 'Managed Updates', them: 'You Fix It When It Breaks' },
                                ].map((row, i) => (
                                    <tr key={i} style={{ borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none' }}>
                                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{row.feature}</td>
                                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--color-success)', fontWeight: '600' }}>✅ {row.us}</td>
                                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>❌ {row.them}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" style={{ padding: 'var(--spacing-2xl) 0', position: 'relative', zIndex: 1 }}>
                <div className="container">
                    <h2 className="text-center mb-xl" style={{ fontSize: '2.5rem' }}>Frequently Asked Questions</h2>
                    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {[
                            { q: "What is MyClaw.Hosting?", a: "MyClaw.Hosting is a dedicated platform that provides pre-configured VPS for running OpenClaw AI agents with zero technical setup." },
                            { q: "How do I install OpenClaw?", a: "With 1-click deployment, we automatically install OpenClaw and all its dependencies in a secure Docker container for you." },
                            { q: "Can I run OpenClaw VPS for business?", a: "Yes, our enterprise-grade infrastructure is designed for reliable, 24/7 agent operations, perfect for business automation." },
                            { q: "Is the OpenClaw VPS dedicated?", a: "Absolutely. Every user gets an isolated environment with dedicated resources to ensure maximum speed and privacy." },
                            { q: "Can I run multiple agents at once?", a: "Yes! With our Pro Plan ($69/mo), you can use our Multi-Agent Dashboard to run up to 5 simultaneous agents for different tasks (e.g., one for Support, one for Sales)." },
                            { q: "Do I need to keep my computer on?", a: "No. Your agents run on our 24/7 cloud infrastructure. You can close your browser, and they keep working." },
                            { q: "Is my data private?", a: "Yes. Every agent runs in an isolated Docker container. Your API keys and memory are encrypted and never shared." }
                        ].map((faq, i) => (
                            <div key={i} className="card-glass" style={{ padding: 'var(--spacing-lg)' }}>
                                <h4 style={{ color: 'var(--coral-bright)', marginBottom: 'var(--spacing-sm)', fontSize: '1.2rem' }}>{faq.q}</h4>
                                <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
