import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, ExternalLink, MessageCircle } from 'lucide-react';
import StarField from '../components/StarField';
import Footer from '../components/Footer';
import Logo from '../components/Logo';

export default function Contact() {
    useEffect(() => {
        document.title = "Contact | OpenClaw Host Support";
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

            <main className="relative z-10 max-w-6xl mx-auto px-8 py-32">
                <div className="text-center mb-32">
                    <h1 className="text-7xl md:text-9xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-r from-white via-white to-[#ff6b6b] bg-clip-text text-transparent inline-block">
                        Command Support
                    </h1>
                    <p className="text-gray-400 text-xl font-bold italic tracking-wide max-w-2xl mx-auto">
                        Need assistance with your fleet or hosting nodes? Our operations team is on standby to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                    {/* Primary Support Channel */}
                    <a
                        href="mailto:support@openclaw-host.com"
                        className="group relative bg-white/2 border border-white/5 rounded-[4rem] p-16 hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] active:scale-95 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Mail size={160} className="text-[#ff6b6b]" />
                        </div>

                        <div className="w-20 h-20 bg-[#ff6b6b]/10 rounded-3xl flex items-center justify-center mb-10 border border-[#ff6b6b]/30 group-hover:scale-110 transition-transform duration-500">
                            <Mail size={32} className="text-[#ff6b6b]" />
                        </div>

                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[#ff6b6b] mb-4">Direct Communication</h3>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-6">support@openclaw-host.com</h2>
                        <p className="text-gray-500 font-bold italic">24/7 Priority support for all fleet commanders.</p>

                        <div className="mt-12 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b6b]">
                            OPEN TRANSMISSION <ExternalLink size={12} />
                        </div>
                    </a>

                    {/* Secondary Channel / Location */}
                    <div className="group relative bg-white/2 border border-white/5 rounded-[4rem] p-16 hover:bg-white/5 transition-all duration-500 overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                            <MapPin size={160} className="text-[#ff6b6b]" />
                        </div>

                        <div className="w-20 h-20 bg-[#ff6b6b]/10 rounded-3xl flex items-center justify-center mb-10 border border-[#ff6b6b]/30">
                            <MapPin size={32} className="text-[#ff6b6b]" />
                        </div>

                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[#ff6b6b] mb-4">Strategic Location</h3>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-6">Global Nodes</h2>
                        <p className="text-gray-500 font-bold italic">Remote hosting infrastructure distributed across multiple strategic zones.</p>

                        <div className="mt-12 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-700">
                            STATUS: OPERATIONAL
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-32 text-center p-12 bg-white/2 rounded-[3rem] border border-white/5 max-w-4xl mx-auto">
                    <p className="text-gray-500 font-bold italic flex items-center justify-center gap-4">
                        <MessageCircle size={20} className="text-[#ff6b6b]" />
                        Looking for the official open-source project?
                        <a href="https://openclaw.ai/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#ff6b6b] transition-colors border-b border-white/10 ml-2">
                            Visit openclaw.ai
                        </a>
                    </p>
                </div>

                <div className="mt-20 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.6em] text-gray-800">
                        Signal Integrity Confirmed // Waiting for Input...
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
