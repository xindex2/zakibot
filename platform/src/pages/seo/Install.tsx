import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { Download, Cpu, ShieldCheck, ArrowRight } from 'lucide-react';
import { SEOCard } from './Hosting';

export default function Install() {
    useEffect(() => {
        document.title = "Install OpenClaw - Automated Installation Scripts";
    }, []);

    return (
        <div className="bg-[#050505] text-white min-h-screen">
            <StarField />
            <nav className="relative z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-4">
                        <Logo size={32} />
                        <span className="text-xl font-black italic uppercase tracking-tighter">OpenClaw Host</span>
                    </Link>
                    <Link to="/register" className="bg-[#ff6b6b] text-white px-8 py-3 rounded-2xl font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#ff6b6b]/20">
                        START INSTALL
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-32">
                <div className="text-center mb-24">
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Automated OpenClaw Install
                    </h1>
                    <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
                        Save hours of configuration. <strong>Install OpenClaw</strong> with our proven,
                        hardened scripts designed for performance and security.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <SEOCard
                        icon={<Download className="text-[#ff6b6b]" />}
                        title="Automated Scripts"
                        text="Our installation process is fully scripted, ensuring a clean and consistent environment every time."
                    />
                    <SEOCard
                        icon={<Cpu className="text-[#ff6b6b]" />}
                        title="Environment Detection"
                        text="Scripts automatically detect and optimize for your specific hardware allocation."
                    />
                    <SEOCard
                        icon={<ShieldCheck className="text-[#ff6b6b]" />}
                        title="Security Hardening"
                        text="Every installation goes through a safety check to ensure your agent's workspace is protected."
                    />
                </div>

                <div className="text-center">
                    <Link to="/register" className="inline-flex items-center gap-3 bg-white text-black px-12 py-6 rounded-[2rem] font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-3xl">
                        START AUTOMATED INSTALL <ArrowRight size={20} />
                    </Link>
                </div>
            </div>
            <Footer />
        </div>
    );
}
