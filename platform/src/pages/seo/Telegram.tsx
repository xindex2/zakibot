import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarField from '../../components/StarField';
import Footer from '../../components/Footer';
import Logo from '../../components/Logo';
import { Send, Bot, Zap, ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import { SEOCard } from './Hosting';

export default function Telegram() {
    useEffect(() => {
        document.title = "How to Link OpenClaw with Telegram - Connect Your AI Agent to Telegram - MyClaw.Host";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute("content", "Step-by-step guide to connect your OpenClaw AI agent to Telegram. Create a bot with BotFather, paste the token, and your agent is live.");
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
                    <Link to="/register" className="bg-[#0088cc] text-white px-8 py-3 rounded-2xl font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#0088cc]/20">
                        TRY IT FREE
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-32">
                <div className="text-center mb-24">
                    <div className="inline-flex items-center gap-3 bg-[#0088cc]/10 border border-[#0088cc]/20 rounded-full px-6 py-2 mb-8">
                        <Send size={18} className="text-[#0088cc]" />
                        <span className="text-[#0088cc] text-sm font-bold uppercase tracking-widest">Telegram Integration</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Link OpenClaw<br />with Telegram
                    </h1>
                    <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
                        Deploy your <strong>OpenClaw AI agent on Telegram</strong> in under 60 seconds.
                        Create a bot with BotFather, paste the token, and you're live.
                    </p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <SEOCard
                        icon={<Bot className="text-[#0088cc]" />}
                        title="BotFather Setup"
                        text="Create a Telegram bot in seconds using @BotFather. Copy the token and paste it into your MyClaw.Host dashboard."
                    />
                    <SEOCard
                        icon={<Zap className="text-[#0088cc]" />}
                        title="Instant Activation"
                        text="No webhooks to configure, no servers to manage. Toggle Telegram on and your agent starts responding immediately."
                    />
                    <SEOCard
                        icon={<Shield className="text-[#0088cc]" />}
                        title="Groups & Private Chats"
                        text="Your bot works in private conversations and group chats. Add it to any group and it responds when mentioned."
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
                                title: "Create a Telegram Bot",
                                desc: "Open Telegram, search for @BotFather, and send /newbot. Follow the prompts to name your bot and get your API token."
                            },
                            {
                                step: "02",
                                title: "Paste the Token",
                                desc: "In your MyClaw.Host dashboard, go to the Channels tab, enable Telegram, and paste the bot token you received from BotFather."
                            },
                            {
                                step: "03",
                                title: "Deploy & Chat",
                                desc: "Save your agent and deploy it. Open your bot on Telegram and start chatting — your AI agent is now live!"
                            }
                        ].map((item) => (
                            <div key={item.step} className="relative p-8 bg-white/2 border border-white/5 rounded-[2rem] hover:border-[#0088cc]/20 transition-all duration-700">
                                <span className="text-6xl font-black italic text-[#0088cc]/10 absolute top-4 right-6">{item.step}</span>
                                <div className="w-10 h-10 bg-[#0088cc]/10 rounded-xl flex items-center justify-center mb-6">
                                    <CheckCircle2 size={20} className="text-[#0088cc]" />
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
                        { q: "How do I get a Telegram bot token?", a: "Open Telegram, search for @BotFather, send /newbot, and follow the instructions. You'll receive a token like 123456:ABC-DEF... — copy and paste it into your dashboard." },
                        { q: "Can I use my existing Telegram bot?", a: "Yes! If you already have a bot token from BotFather, just paste it into the Channels tab. Your OpenClaw agent will take over as the bot's brain." },
                        { q: "Does the bot work in group chats?", a: "Yes. Add your bot to any Telegram group. It will respond when mentioned by name or when replying to its messages." },
                        { q: "Is there a message limit?", a: "Paid plans have unlimited messages. Free users can test with a limited number of messages before upgrading." }
                    ].map((faq, i) => (
                        <div key={i} className="border-b border-white/5 py-6">
                            <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
                            <p className="text-gray-500 font-medium text-sm leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Link to="/register" className="inline-flex items-center gap-3 bg-[#0088cc] text-white px-12 py-6 rounded-[2rem] font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#0088cc]/20">
                        CONNECT TELEGRAM NOW <ArrowRight size={20} />
                    </Link>
                    <p className="text-gray-600 text-sm mt-4">Free to try • No credit card required</p>
                </div>
            </div>
            <Footer />
        </div>
    );
}
