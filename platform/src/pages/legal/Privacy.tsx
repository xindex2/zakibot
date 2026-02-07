import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';

export default function Privacy() {
    useEffect(() => {
        document.title = "Privacy | OpenClaw Host Platform";
    }, []);

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-[#ff6b6b]/30">
            <StarField />

            <nav className="relative z-20 border-b border-white/5 bg-black/20 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-8 h-24 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-4 hover:scale-105 transition-transform active:scale-95">
                        <Logo size={40} />
                        <span className="text-xl font-black italic uppercase tracking-tighter">OpenClaw Host</span>
                    </Link>
                    <Link to="/login" className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-all">
                        Login
                    </Link>
                </div>
            </nav>

            <main className="relative z-10 max-w-4xl mx-auto px-8 py-24">
                <div className="mb-20">
                    <h1 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-r from-white via-white to-[#ff6b6b] bg-clip-text text-transparent">
                        Privacy Protocol
                    </h1>
                    <div className="h-1 w-24 bg-[#ff6b6b]" />
                </div>

                <div className="space-y-16">
                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">01</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Data Ingestion</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            We collect minimal metadata required to provide professional hosting services: your email address for command authorization and tactical logs for platform stability.
                        </p>
                    </section>

                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">02</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Agent Integrity</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            Your agent neural networks and configurations are stored in isolated encrypted volumes. OpenClaw Host does not inspect the logic of your agent's private directory or monitor its internal directives unless required by global law.
                        </p>
                    </section>

                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">03</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">External Nodes</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            We do not trade your tactical data. We only use certified infrastructure partners for essential server capacity where resources are protected under strict security protocols.
                        </p>
                    </section>

                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">04</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Network Security</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            We implement ironclad security measures to protect your Command Hub and hosted instances, including adaptive firewall protection and end-to-end encrypted terminal sessions.
                        </p>
                    </section>

                    <section className="group pb-12 border-b border-white/5">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">05</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">System Updates</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            The Protocol may be updated as the fleet evolves. Significant revisions will be broadcasted via encrypted email or high-priority dashboard alerts.
                        </p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
