import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
    return (
        <footer className="py-16 bg-[#0a0a0a] relative z-10 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-4 mb-6">
                            <Logo size={32} />
                            <h3 className="text-xl font-bold italic uppercase tracking-tight">OpenClaw Host</h3>
                        </div>
                        <p className="text-gray-500 leading-relaxed max-w-md">
                            The fastest and most reliable way to <strong>deploy OpenClaw</strong> VPS.
                            Dedicated instances for professional AI agent hosting.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold uppercase tracking-widest text-xs mb-6 text-gray-400">Products</h4>
                        <ul className="flex flex-col gap-3">
                            <li><Link to="/openclaw-vps" className="text-gray-500 hover:text-white transition-colors">OpenClaw VPS</Link></li>
                            <li><Link to="/openclaw-hosting" className="text-gray-500 hover:text-white transition-colors">OpenClaw Hosting</Link></li>
                            <li><Link to="/install-openclaw" className="text-gray-500 hover:text-white transition-colors">Install OpenClaw</Link></li>
                            <li><Link to="/deploy-openclaw" className="text-gray-500 hover:text-white transition-colors">Deploy OpenClaw</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold uppercase tracking-widest text-xs mb-6 text-gray-400">Company</h4>
                        <ul className="flex flex-col gap-3">
                            <li><Link to="/contact" className="text-gray-500 hover:text-white transition-colors">Contact Us</Link></li>
                            <li><Link to="/tos" className="text-gray-500 hover:text-white transition-colors">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-12 flex flex-col items-center gap-6 text-center">
                    <p className="text-gray-600 text-[11px] leading-relaxed max-w-3xl uppercase tracking-widest font-bold opacity-60">
                        <strong>Disclaimer:</strong> OpenClaw Host is an independent hosting provider. We are not officially affiliated with the OpenClaw project.
                        For the official open-source project, please visit <a href="https://openclaw.ai/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">openclaw.ai</a>.
                    </p>
                    <p className="text-gray-700 text-[10px] font-black tracking-widest uppercase">
                        &copy; {new Date().getFullYear()} OpenClaw Host. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
