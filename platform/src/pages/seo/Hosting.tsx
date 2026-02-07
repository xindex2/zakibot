import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { Cloud, TrendingUp, Users, ArrowRight } from 'lucide-react';

export default function Hosting() {
    useEffect(() => {
        document.title = "OpenClaw Hosting - Professional Managed AI Agent Solutions";
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
                        TRY HOSTING
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-32">
                <div className="text-center mb-24">
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Premium OpenClaw Hosting
                    </h1>
                    <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
                        Zero-config <strong>OpenClaw hosting</strong> for developers and businesses.
                        We handle the infrastructure, updates, and scaling while you focus on building your agents.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <SEOCard
                        icon={<Cloud className="text-[#ff6b6b]" />}
                        title="Managed Infrastructure"
                        text="Never worry about system updates or Docker configs. We manage the stack for you."
                    />
                    <SEOCard
                        icon={<TrendingUp className="text-[#ff6b6b]" />}
                        title="Operational Visibility"
                        text="Track your agent's health and logs with our integrated terminal and monitoring tools."
                    />
                    <SEOCard
                        icon={<Users className="text-[#ff6b6b]" />}
                        title="Team Ready"
                        text="Collaborate with your team by managing multiple agent instances under a single dashboard."
                    />
                </div>

                <div className="text-center">
                    <Link to="/register" className="inline-flex items-center gap-3 bg-white text-black px-12 py-6 rounded-[2rem] font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-3xl">
                        START FREE HOSTING TRIAL <ArrowRight size={20} />
                    </Link>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export function SEOCard({ icon, title, text }: any) {
    return (
        <div className="p-10 bg-white/2 border border-white/5 rounded-[3rem] hover:border-[#ff6b6b]/20 transition-all duration-700">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8">
                {icon}
            </div>
            <h3 className="text-2xl font-black italic uppercase mb-4 tracking-tighter">{title}</h3>
            <p className="text-gray-500 leading-relaxed font-medium">{text}</p>
        </div>
    );
}
