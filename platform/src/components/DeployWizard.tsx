import React, { useState } from 'react';
import { Bot, ChevronRight, Zap, MessageSquare, Globe, ArrowRight, ShieldCheck, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeployWizardProps {
    user: any;
    onDeploy: (config: any) => void;
    isDeploying: boolean;
}

const MODELS = [
    { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', icon: 'https://www.anthropic.com/favicon.ico', color: '#f5f5f7' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', icon: 'https://openai.com/favicon.ico', color: '#74aa9c' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek-V3', icon: 'https://www.deepseek.com/favicon.ico', color: '#60a5fa' },
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', icon: 'https://www.google.com/favicon.ico', color: '#4285f4' },
    { id: 'moonshot/moonshot-v1-8k', name: 'Moonshot (Kimi)', icon: 'https://www.moonshot.cn/favicon.ico', color: '#f97316' },
    { id: 'groq/llama-3.1-70b-versatile', name: 'Groq Llama 3.1', icon: 'https://groq.com/favicon.ico', color: '#f59e0b' }
];

const CHANNELS = [
    { id: 'telegram', name: 'Telegram', icon: 'https://telegram.org/favicon.ico', status: 'available' },
    { id: 'discord', name: 'Discord', icon: 'https://discord.com/favicon.ico', status: 'available' },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'https://whatsapp.com/favicon.ico', status: 'coming_soon' },
    { id: 'feishu', name: 'Feishu / Lark', icon: 'https://www.feishu.cn/favicon.ico', status: 'coming_soon' }
];

export default function DeployWizard({ user, onDeploy, isDeploying }: DeployWizardProps) {
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [selectedChannel, setSelectedChannel] = useState('telegram');

    const handleDeploy = () => {
        onDeploy({
            name: `${user.full_name?.split(' ')[0]}'s Agent`,
            provider: selectedModel.split('/')[0],
            model: selectedModel,
            telegramEnabled: selectedChannel === 'telegram',
            status: 'stopped'
        });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] py-20 px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-16"
            >
                <h1 className="text-6xl font-black tracking-tighter mb-4">Deploy OpenClaw under 1 minute</h1>
                <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
                    Avoid all technical complexity and one click deploy your own 24/7 active OpenClaw instance under 1 minute.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl bg-[#0a0a0a] border border-white/5 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden"
            >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative space-y-12">
                    {/* Model Selection */}
                    <div className="space-y-6">
                        <label className="text-sm font-bold text-gray-400 uppercase tracking-widest block">Which model do you want as default?</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setSelectedModel(m.id)}
                                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all ${selectedModel === m.id
                                        ? 'bg-white/5 border-white/20 shadow-lg'
                                        : 'bg-transparent border-white/5 hover:border-white/10 text-gray-500'
                                        }`}
                                >
                                    <img src={m.icon} className="w-5 h-5 grayscale-0" alt={m.name} />
                                    <span className="text-xs font-black uppercase tracking-tight">{m.name}</span>
                                    {selectedModel === m.id && <CheckCircle className="ml-auto w-4 h-4 text-green-500" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Channel Selection */}
                    <div className="space-y-6">
                        <label className="text-sm font-bold text-gray-400 uppercase tracking-widest block">Which channel do you want to use for sending messages?</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {CHANNELS.map(c => (
                                <button
                                    key={c.id}
                                    disabled={c.status === 'coming_soon'}
                                    onClick={() => setSelectedChannel(c.id)}
                                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all relative ${selectedChannel === c.id
                                        ? 'bg-white/5 border-white/20'
                                        : 'bg-transparent border-white/5 text-gray-500'
                                        } ${c.status === 'coming_soon' ? 'opacity-40 cursor-not-allowed' : 'hover:border-white/10'}`}
                                >
                                    <img src={c.icon} className="w-5 h-5 rounded-lg" alt={c.name} />
                                    <div className="flex flex-col items-start translate-y-0.5">
                                        <span className="text-xs font-black uppercase tracking-tight">{c.name}</span>
                                        {c.status === 'coming_soon' && <span className="text-[8px] font-bold opacity-50">Coming soon</span>}
                                    </div>
                                    {selectedChannel === c.id && <CheckCircle className="ml-auto w-4 h-4 text-green-500" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User Profile Snippet */}
                    <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center overflow-hidden">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-black text-red-500">{user.full_name?.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                    {user.full_name} <LogOut className="w-3 h-3 hover:text-red-500 transition-colors cursor-pointer" />
                                </span>
                                <span className="text-[10px] font-medium text-gray-600 tracking-wider lowercase italic">{user.email}</span>
                            </div>
                        </div>
                    </div>

                    {/* CTA Section */}
                    <div className="space-y-6">
                        <button
                            onClick={handleDeploy}
                            disabled={isDeploying}
                            className={`w-full py-6 rounded-2xl font-black text-sm tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 ${isDeploying
                                ? 'bg-white/10 text-white/50 cursor-wait'
                                : 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-2xl shadow-white/5'
                                }`}
                        >
                            <Zap size={18} fill="currentColor" /> {isDeploying ? 'Deploying...' : 'Deploy OpenClaw'}
                        </button>

                        <div className="text-center space-y-2">
                            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-loose">
                                Connect {selectedChannel} to continue. <span className="text-gray-800">You can also other channels to same account in the future.</span>
                            </p>
                            <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest">
                                Limited cloud servers — only 5 left
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function CheckCircle({ className, ...props }: any) {
    return (
        <svg
            {...props}
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function LogOut({ className, ...props }: any) {
    return (
        <svg
            {...props}
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}
