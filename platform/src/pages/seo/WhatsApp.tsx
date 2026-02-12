import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { MessageCircle, QrCode, Shield, ArrowRight, CheckCircle2, Smartphone } from 'lucide-react';
import { SEOCard } from './Hosting';

export default function WhatsApp() {
    useEffect(() => {
        document.title = "How to Link OpenClaw with WhatsApp - Connect Your AI Agent to WhatsApp - MyClaw.Host";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute("content", "Step-by-step guide to connect your OpenClaw AI agent to WhatsApp. Scan a QR code, and your bot is live on WhatsApp in under 60 seconds.");
        }
    }, []);

    return (
        <div className="bg-[#050505] text-white min-h-screen">
            <StarField />
            <nav className="relative z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-4">
                        <Logo size={32} />
                        <span className="text-xl font-black italic uppercase tracking-tighter">MyClaw.Host</span>
                    </Link>
                    <Link to="/register" className="bg-[#25D366] text-white px-8 py-3 rounded-2xl font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#25D366]/20">
                        TRY IT FREE
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-32">
                <div className="text-center mb-24">
                    <div className="inline-flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/20 rounded-full px-6 py-2 mb-8">
                        <MessageCircle size={18} className="text-[#25D366]" />
                        <span className="text-[#25D366] text-sm font-bold uppercase tracking-widest">WhatsApp Integration</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Link OpenClaw<br />with WhatsApp
                    </h1>
                    <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
                        Connect your <strong>OpenClaw AI agent to WhatsApp</strong> in under 60 seconds.
                        No API applications, no business accounts required — just scan a QR code and go.
                    </p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <SEOCard
                        icon={<QrCode className="text-[#25D366]" />}
                        title="Scan & Connect"
                        text="Open your dashboard, enable WhatsApp, and scan the QR code with your phone. Your agent is live instantly."
                    />
                    <SEOCard
                        icon={<Smartphone className="text-[#25D366]" />}
                        title="Works on Any Phone"
                        text="Compatible with any WhatsApp account — personal or business. No special setup or meta developer account needed."
                    />
                    <SEOCard
                        icon={<Shield className="text-[#25D366]" />}
                        title="Secure & Private"
                        text="End-to-end encryption is preserved. Your messages stay private between you and your contacts."
                    />
                </div>

                {/* Step-by-step guide */}
                <div className="mb-24">
                    <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-12 text-center bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        How to Connect in 3 Steps
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                step: "01",
                                title: "Create Your Agent",
                                desc: "Sign up on MyClaw.Host and create a new AI agent from the dashboard. Choose your model and configure its personality."
                            },
                            {
                                step: "02",
                                title: "Enable WhatsApp",
                                desc: "Go to the Channels tab in your agent settings and toggle WhatsApp on. A QR code will appear on your screen."
                            },
                            {
                                step: "03",
                                title: "Scan the QR Code",
                                desc: "Open WhatsApp on your phone → Linked Devices → Link a Device. Scan the QR code and your agent is live!"
                            }
                        ].map((item) => (
                            <div key={item.step} className="relative p-8 bg-white/2 border border-white/5 rounded-[2rem] hover:border-[#25D366]/20 transition-all duration-700">
                                <span className="text-6xl font-black italic text-[#25D366]/10 absolute top-4 right-6">{item.step}</span>
                                <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-6">
                                    <CheckCircle2 size={20} className="text-[#25D366]" />
                                </div>
                                <h3 className="text-xl font-black italic uppercase tracking-tighter mb-3">{item.title}</h3>
                                <p className="text-gray-500 leading-relaxed font-medium text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mb-24 max-w-3xl mx-auto">
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-center">Frequently Asked Questions</h2>
                    {[
                        { q: "Do I need a WhatsApp Business account?", a: "No. OpenClaw works with any regular WhatsApp account. You can also use a business account if you prefer." },
                        { q: "Can my bot reply to group chats?", a: "Yes! Once connected, your agent can respond to both private messages and group conversations where it's mentioned." },
                        { q: "Is there a message limit?", a: "There is no message limit on paid plans. Free users can test with limited messages before upgrading." },
                        { q: "What happens if I disconnect my phone?", a: "Your agent stays connected as a linked device. It works independently after the initial QR scan." }
                    ].map((faq, i) => (
                        <div key={i} className="border-b border-white/5 py-6">
                            <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
                            <p className="text-gray-500 font-medium text-sm leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Link to="/register" className="inline-flex items-center gap-3 bg-[#25D366] text-white px-12 py-6 rounded-[2rem] font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#25D366]/20">
                        CONNECT WHATSAPP NOW <ArrowRight size={20} />
                    </Link>
                    <p className="text-gray-600 text-sm mt-4">Free to try • No credit card required</p>
                </div>
            </div>
            <Footer />
        </div>
    );
}
