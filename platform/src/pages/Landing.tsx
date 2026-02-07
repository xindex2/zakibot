import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
    const { isAuthenticated } = useAuth();
    useEffect(() => {
        document.title = "OpenClaw Hosting, OpenClaw VPS, Install OpenClaw, Deploy OpenClaw - OpenClaw Host";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute("content", "The professional way to hosting OpenClaw. High-performance OpenClaw VPS, 1-click install, and instant deployment for your AI agents.");
        }

        // Track acquisition source
        if (!sessionStorage.getItem('acquisition_source')) {
            const urlParams = new URLSearchParams(window.location.search);
            const utmSource = urlParams.get('utm_source');
            const referrer = document.referrer;

            let source = 'Direct';

            if (utmSource) {
                source = utmSource;
            } else if (referrer) {
                try {
                    const refUrl = new URL(referrer);
                    if (refUrl.hostname.includes('google')) {
                        source = 'Google';
                    } else if (refUrl.hostname.includes('bing')) {
                        source = 'Bing';
                    } else if (refUrl.hostname.includes('facebook') || refUrl.hostname.includes('fb.me')) {
                        source = 'Facebook';
                    } else if (refUrl.hostname.includes('twitter.com') || refUrl.hostname.includes('t.co') || refUrl.hostname.includes('x.com')) {
                        source = 'Twitter';
                    } else if (!refUrl.hostname.includes(window.location.hostname)) {
                        source = `Referral: ${refUrl.hostname}`;
                    }
                } catch (e) {
                    console.error('Referrer parsing error:', e);
                }
            }

            sessionStorage.setItem('acquisition_source', source);
        }
    }, []);

    return (
        <div className="landing" style={{ position: 'relative', background: 'var(--bg-deep)', minHeight: '100vh' }}>
            <StarField />

            {/* Navigation */}
            <nav className="nav" style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>
                <div className="container flex-between" style={{ padding: 'clamp(0.75rem, 2vw, 1.25rem) var(--spacing-lg)' }}>
                    <div className="flex gap-md" style={{ alignItems: 'center' }}>
                        <h3 style={{ margin: 0, letterSpacing: '-0.02em' }}>OpenClaw Host</h3>
                        <Logo size={36} />
                    </div>
                    <div className="flex gap-lg" style={{ alignItems: 'center' }}>
                        <a href="#pricing" className="btn btn-ghost" style={{ fontSize: '0.95rem' }}>Pricing</a>
                        <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.95rem' }}>Login</Link>
                        <Link to="/register" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>Get Started</Link>
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

                        <div style={{
                            background: 'rgba(255,107,107,0.1)',
                            padding: '0.75rem 1.5rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(255,107,107,0.2)',
                            marginBottom: 'var(--spacing-xl)',
                            display: 'inline-block'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                                <strong>Independent Hosting:</strong> We provide infrastructure for OpenClaw. For the official project, visit <a href="https://openclaw.ai/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--coral-bright)', textDecoration: 'none', fontWeight: 'bold' }}>openclaw.ai</a>
                            </p>
                        </div>

                        <h1 style={{
                            fontSize: 'clamp(3rem, 8vw, 5rem)',
                            marginBottom: 'var(--spacing-md)',
                            lineHeight: 1,
                            letterSpacing: '-0.03em',
                            textTransform: 'uppercase'
                        }}>
                            OpenClaw Hosting
                        </h1>
                        <p style={{
                            fontSize: '1rem',
                            color: 'var(--coral-bright)',
                            fontWeight: 'var(--font-weight-bold)',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            marginBottom: 'var(--spacing-xl)'
                        }}>
                            THE AI THAT ACTUALLY DOES THINGS.
                        </p>

                        <p style={{
                            fontSize: '1.25rem',
                            maxWidth: '650px',
                            margin: '0 auto var(--spacing-2xl)',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.6,
                        }}>
                            The easiest way to <strong>install OpenClaw</strong> and <strong>deploy OpenClaw</strong> VPS.
                            Get your dedicated AI agent in under 60 seconds.
                        </p>

                        <div className="flex-center gap-md" style={{ flexWrap: 'wrap' }}>
                            <Link to="/register" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2.5rem' }}>
                                Deploy Your Agent Now
                            </Link>
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
                            { name: "5 Agents", price: "$69", limit: "Up to 5 Agents", features: ["Priority Support", "Dedicated Resources", "Multi-Agent Dashboard", "Safe Volume Backups"], popular: true, checkoutUrl: "https://whop.com/checkout/plan_9NRNdPMrVzwi8" },
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

            {/* FAQ Section */}
            <section id="faq" style={{ padding: 'var(--spacing-2xl) 0', position: 'relative', zIndex: 1 }}>
                <div className="container">
                    <h2 className="text-center mb-xl" style={{ fontSize: '2.5rem' }}>Frequently Asked Questions</h2>
                    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {[
                            { q: "What is OpenClaw Hosting?", a: "OpenClaw Hosting is a dedicated platform that provides pre-configured VPS for running OpenClaw AI agents with zero technical setup." },
                            { q: "How do I install OpenClaw?", a: "With 1-click deployment, we automatically install OpenClaw and all its dependencies in a secure Docker container for you." },
                            { q: "Can I run OpenClaw VPS for business?", a: "Yes, our enterprise-grade infrastructure is designed for reliable, 24/7 agent operations, perfect for business automation." },
                            { q: "Is the OpenClaw VPS dedicated?", a: "Absolutely. Every user gets an isolated environment with dedicated resources to ensure maximum speed and privacy." }
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
