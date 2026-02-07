import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { Server, Shield, Zap, ArrowRight } from 'lucide-react';
import { SEOCard } from './Hosting';

export default function VPS() {
    useEffect(() => {
        document.title = "OpenClaw VPS - High Performance Virtual Private Servers for AI";
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
                        GET VPS
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-32">
                <div className="text-center mb-24">
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Dedicated OpenClaw VPS
                    </h1>
                    <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
                        High-performance <strong>OpenClaw VPS</strong> instances with pre-configured environments.
                        Optimized for ultra-low latency and consistent agent performance.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <SEOCard
                        icon={<Server className="text-[#ff6b6b]" />}
                        title="Isolated Resources"
                        text="Every VPS is a dedicated container with guaranteed CPU and RAM allocation for your agents."
                    />
                    <SEOCard
                        icon={<Shield className="text-[#ff6b6b]" />}
                        title="Secure by Default"
                        text="Baked-in security protocols and isolated networking keep your API keys and data safe."
                    />
                    <SEOCard
                        icon={<Zap className="text-[#ff6b6b]" />}
                        title="Instant Delivery"
                        text="Zero wait time. Your VPS is provisioned and your OpenClaw environment is ready in seconds."
                    />
                </div>

                <div className="text-center">
                    <Link to="/register" className="inline-flex items-center gap-3 bg-white text-black px-12 py-6 rounded-[2rem] font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-3xl">
                        PROVISION YOUR VPS <ArrowRight size={20} />
                    </Link>
                </div>
            </div>
            <Footer />
        </div>
    );
}
