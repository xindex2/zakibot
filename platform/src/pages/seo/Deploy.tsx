import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { Rocket, Terminal, Zap, ArrowRight } from 'lucide-react';
import { SEOCard } from './Hosting';

export default function Deploy() {
    useEffect(() => {
        document.title = "Deploy OpenClaw - Instant 1-Click AI Agent Deployment";
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
                        DEPLOY NOW
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-32">
                <div className="text-center mb-24">
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Deploy OpenClaw Instantly
                    </h1>
                    <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
                        The fastest way to <strong>deploy OpenClaw</strong>.
                        No complex setup, no terminal wrestling. Just 1-click and your agents are live.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <SEOCard
                        icon={<Rocket className="text-[#ff6b6b]" />}
                        title="1-Click Launch"
                        text="Our automated orchestrator handles everything from container creation to agent initialization."
                    />
                    <SEOCard
                        icon={<Terminal className="text-[#ff6b6b]" />}
                        title="Pre-configured Environment"
                        text="Python, dependencies, and core OpenClaw logic are pre-installed and optimized."
                    />
                    <SEOCard
                        icon={<Zap className="text-[#ff6b6b]" />}
                        title="Automatic Scaling"
                        text="Start small and scale your deployment as you add more tools and complex agent tasks."
                    />
                </div>

                <div className="text-center">
                    <Link to="/register" className="inline-flex items-center gap-3 bg-white text-black px-12 py-6 rounded-[2rem] font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-3xl">
                        INITIALIZE DEPLOYMENT <ArrowRight size={20} />
                    </Link>
                </div>
            </div>
            <Footer />
        </div>
    );
}
