import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';

export default function ToS() {
    useEffect(() => {
        document.title = "Terms | OpenClaw Host Platform";
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
                        Terms of Engagement
                    </h1>
                    <div className="h-1 w-24 bg-[#ff6b6b]" />
                </div>

                <div className="space-y-16">
                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">01</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Hosting Directives</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            OpenClaw Host provides infrastructure and professional hosting services for the OpenClaw Host agent project.
                            We are a premium hosting provider and operate independently from external open-source communities.
                        </p>
                    </section>

                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">02</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Protocol Acceptance</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            By interfacing with the OpenClaw Host Terminal, you agree to comply with these Terms of Engagement.
                            Commanders must be at least 13 solar years of age to operate our systems.
                        </p>
                    </section>

                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">03</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Command Responsibility</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            Users are solely responsible for the neural outputs and actions of their deployed agents.
                            Prohibited actions include system-level network attacks, unauthorized data harvesting, or illegal operations targeting third-party nodes.
                        </p>
                    </section>

                    <section className="group">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">04</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Liability Threshold</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            OpenClaw Host is provided "as is" and "as available". We are not liable for any logical data decay, agent downtime, or indirect damages resulting from system utilization.
                        </p>
                    </section>

                    <section className="group pb-12 border-b border-white/5">
                        <div className="flex items-center gap-6 mb-8">
                            <span className="text-xs font-black text-[#ff6b6b] border border-[#ff6b6b]/30 px-3 py-1 rounded-full uppercase tracking-widest bg-[#ff6b6b]/5">05</span>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#ff6b6b] transition-colors">Hub Termination</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            We reserve the absolute right to suspend or decommission command hubs that violate these directives or engage in hostile behavior toward our core infrastructure.
                        </p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
