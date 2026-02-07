import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Rocket, ArrowRight, Home } from 'lucide-react';
import Logo from '../components/Logo';
import StarField from '../components/StarField';

export default function ThankYou() {
    useEffect(() => {
        document.title = "Success | OpenClaw Host Platform";
    }, []);

    return (
        <div className="min-h-screen relative flex items-center justify-center p-8 bg-[#050505] text-white overflow-hidden">
            <StarField />

            <div className="relative z-10 w-full max-w-2xl">
                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-16 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                        <CheckCircle size={200} className="text-[#ff6b6b]" />
                    </div>

                    <div className="flex justify-center mb-10">
                        <Logo size={80} />
                    </div>

                    <div className="w-24 h-24 bg-[#ff6b6b]/10 rounded-full flex items-center justify-center mx-auto mb-10 border-2 border-[#ff6b6b]">
                        <CheckCircle size={40} className="text-[#ff6b6b]" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-6 bg-gradient-to-r from-white to-[#ff6b6b] bg-clip-text text-transparent">
                        Protocol Activated
                    </h1>

                    <p className="text-gray-400 text-lg font-medium leading-relaxed mb-12 max-w-md mx-auto">
                        Your subscription has been successfully updated. Your fleet capacity is now increased and your command metrics are synced.
                    </p>

                    <div className="bg-white/2 border border-white/5 rounded-[2.5rem] p-10 mb-12 text-left relative z-10">
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-[#ff6b6b] mb-6">Immediate Directives:</h4>
                        <ul className="space-y-4">
                            <li className="flex items-center gap-4 text-sm font-bold italic text-gray-300">
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-[#ff6b6b] border border-white/10">1</div>
                                Navigate to Command Hub to view fleet status.
                            </li>
                            <li className="flex items-center gap-4 text-sm font-bold italic text-gray-300">
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-[#ff6b6b] border border-white/10">2</div>
                                Recruit new agents using your increased bandwidth.
                            </li>
                            <li className="flex items-center gap-4 text-sm font-bold italic text-gray-300">
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-[#ff6b6b] border border-white/10">3</div>
                                Deploy bots to production within seconds.
                            </li>
                        </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center">
                        <Link to="/dashboard" className="bg-white text-black px-12 py-5 rounded-2xl font-black text-xs tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5">
                            <Rocket size={18} /> GO TO HUB
                        </Link>
                        <Link to="/" className="bg-white/5 border border-white/5 px-12 py-5 rounded-2xl font-black text-xs tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3">
                            <Home size={18} /> BACK TO BASE
                        </Link>
                    </div>

                    <p className="mt-12 text-[10px] font-black uppercase tracking-[0.4em] text-gray-600">
                        Transmission Complete // Syncing Metadata...
                    </p>
                </div>
            </div>
        </div>
    );
}
