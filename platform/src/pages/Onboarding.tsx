import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import StarField from '../components/StarField';
import { getSource } from '../lib/referral-tracking';
import {
    ChevronRight, ChevronLeft, Sparkles, Lock, Loader2, Search,
    Rocket, Check, MessageSquare, ArrowRight, ExternalLink, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CHANNEL_ICONS: Record<string, string> = {
    telegram: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png',
    discord: 'https://favicon.im/discord.com?t=1770422839363',
    whatsapp: 'https://favicon.im/whatsapp.com?larger=true',
    slack: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
    feishu: 'https://www.feishu.cn/favicon.ico',
};

const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter (Global)' },
    { id: 'anthropic', name: 'Anthropic Claude' },
    { id: 'openai', name: 'OpenAI GPT' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'google', name: 'Google Gemini' },
    { id: 'xai', name: 'xAI Grok' },
    { id: 'groq', name: 'Groq (Fast Inference)' },
    { id: 'moonshot', name: 'Moonshot / Kimi' },
    { id: 'dashscope', name: 'DashScope (Qwen)' },
    { id: 'ollama', name: 'Ollama (Local)' },
    { id: 'venice', name: 'Venice AI' },
    { id: 'vllm', name: 'vLLM (Local)' },
    { id: 'zhipu', name: 'Zhipu AI (GLM)' },
    { id: 'aihubmix', name: 'AIHubMix' },
];

const STEPS = [
    { id: 'account', label: 'Account', num: 1 },
    { id: 'model', label: 'AI Model', num: 2 },
    { id: 'channel', label: 'Channel', num: 3 },
    { id: 'launch', label: 'Launch!', num: 4 },
];

export default function Onboarding() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Step 1 — Account
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Step 2 — Model
    const [apiKeyMode, setApiKeyMode] = useState<'platform_credits' | 'own_key'>('platform_credits');
    const [provider, setProvider] = useState('openrouter');
    const [model, setModel] = useState('google/gemini-3-flash-preview');
    const [ownApiKey, setOwnApiKey] = useState('');
    const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string; promptPrice?: number; completionPrice?: number }[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [modelSearch, setModelSearch] = useState('');

    // Step 3 — Channel
    const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'discord' | 'whatsapp' | 'slack' | 'feishu' | null>(null);
    const [telegramToken, setTelegramToken] = useState('');
    const [discordToken, setDiscordToken] = useState('');
    const [slackBotToken, setSlackBotToken] = useState('');
    const [slackAppToken, setSlackAppToken] = useState('');
    const [feishuAppId, setFeishuAppId] = useState('');
    const [feishuAppSecret, setFeishuAppSecret] = useState('');

    // Step 4 — Result
    const [deployedBot, setDeployedBot] = useState<any>(null);

    // Auto-fetch models when entering step 2
    useEffect(() => {
        if (step === 1) {
            fetchModels();
        }
    }, [step, apiKeyMode]);

    const fetchModels = async () => {
        const isPlatform = apiKeyMode === 'platform_credits';
        if (!isPlatform && !ownApiKey) return;
        setIsFetchingModels(true);
        try {
            const resp = await fetch('/api/models', {
                method: 'GET',
            });
            const data = await resp.json();
            setFetchedModels(data.models || []);
        } catch {
            // Try the public endpoint
            try {
                const resp = await fetch('/api/models/fetch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        provider: isPlatform ? 'openrouter' : provider,
                        apiKey: isPlatform ? undefined : ownApiKey,
                        apiKeyMode
                    })
                });
                const data = await resp.json();
                setFetchedModels(data.models || []);
            } catch { /* ignore */ }
        } finally {
            setIsFetchingModels(false);
        }
    };

    const canProceed = () => {
        switch (step) {
            case 0: return fullName && email && password && password === confirmPassword;
            case 1: return model && (apiKeyMode === 'platform_credits' || ownApiKey);
            case 2: return selectedChannel && (
                (selectedChannel === 'telegram' && telegramToken) ||
                (selectedChannel === 'discord' && discordToken) ||
                (selectedChannel === 'slack' && slackBotToken && slackAppToken) ||
                (selectedChannel === 'feishu' && feishuAppId && feishuAppSecret) ||
                selectedChannel === 'whatsapp'
            );
            default: return true;
        }
    };

    const handleDeploy = async () => {
        setError('');
        setLoading(true);
        try {
            const resp = await fetch('/api/register-with-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email,
                    password,
                    acquisition_source: getSource(),
                    // Bot config
                    botName: `${fullName}'s Agent`,
                    model,
                    provider: apiKeyMode === 'platform_credits' ? 'openrouter' : provider,
                    apiKeyMode,
                    apiKey: apiKeyMode === 'own_key' ? ownApiKey : '',
                    // Channel
                    telegramEnabled: selectedChannel === 'telegram',
                    telegramToken: selectedChannel === 'telegram' ? telegramToken : '',
                    discordEnabled: selectedChannel === 'discord',
                    discordToken: selectedChannel === 'discord' ? discordToken : '',
                    whatsappEnabled: selectedChannel === 'whatsapp',
                    slackEnabled: selectedChannel === 'slack',
                    slackBotToken: selectedChannel === 'slack' ? slackBotToken : '',
                    slackAppToken: selectedChannel === 'slack' ? slackAppToken : '',
                    feishuEnabled: selectedChannel === 'feishu',
                    feishuAppId: selectedChannel === 'feishu' ? feishuAppId : '',
                    feishuAppSecret: selectedChannel === 'feishu' ? feishuAppSecret : '',
                })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Registration failed');

            login(data.token, data.user);
            setDeployedBot(data.bot);
            setStep(3);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        setError('');
        if (step === 0) {
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
            if (password.length < 4) {
                setError('Password must be at least 4 characters');
                return;
            }
        }
        if (step === 2) {
            handleDeploy();
            return;
        }
        setStep(s => s + 1);
    };

    const inputClass = "w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#ff6b6b]/50 transition-all font-medium text-white placeholder:text-white/20";
    const labelClass = "text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4";

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 md:p-8 bg-[#050505] text-white">
            <StarField />

            <div className="relative z-10 w-full max-w-2xl">
                {/* Progress bar */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEPS.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-300
                                ${i < step ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                                    i === step ? 'bg-[#ff6b6b]/20 border-[#ff6b6b]/50 text-[#ff6b6b]' :
                                        'bg-white/5 border-white/10 text-white/30'}
                            `}>
                                {i < step ? <Check size={14} /> : s.num}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest hidden md:inline ${i === step ? 'text-white' : 'text-white/30'
                                }`}>{s.label}</span>
                            {i < STEPS.length - 1 && (
                                <div className={`w-8 md:w-12 h-px ${i < step ? 'bg-green-500/30' : 'bg-white/10'}`} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Logo size={60} />
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ─── STEP 1: ACCOUNT ─── */}
                        {step === 0 && (
                            <motion.div
                                key="step-account"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Create Your Account</h2>
                                    <p className="text-gray-500 font-medium text-sm">Step 1 of 4 — Let's get you set up</p>
                                </div>

                                <div className="space-y-2">
                                    <label className={labelClass}>Full Name</label>
                                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                        className={inputClass} placeholder="John Doe" required />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Email Address</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        className={inputClass} placeholder="your@email.com" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelClass}>Password</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                            className={inputClass} placeholder="••••••••" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>Confirm</label>
                                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                            className={inputClass} placeholder="••••••••" required />
                                    </div>
                                </div>

                                {/* Social login */}
                                <div className="flex items-center gap-6 my-6">
                                    <div className="h-[1px] bg-white/5 flex-1" />
                                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em]">OR</span>
                                    <div className="h-[1px] bg-white/5 flex-1" />
                                </div>
                                <button type="button" onClick={() => { window.location.href = '/api/auth/google'; }}
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold tracking-wide text-sm flex items-center justify-center gap-4 hover:bg-white/10 active:scale-95 transition-all">
                                    <svg width="18" height="18" viewBox="0 0 18 18">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" />
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853" />
                                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#fbbc05" />
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335" />
                                    </svg>
                                    Continue with Google
                                </button>
                                <button type="button" onClick={() => { window.location.href = '/api/auth/apple'; }}
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold tracking-wide text-sm flex items-center justify-center gap-4 hover:bg-white/10 active:scale-95 transition-all mt-3">
                                    <svg width="18" height="18" viewBox="0 0 18 22" fill="white">
                                        <path d="M17.0493 7.52997C16.9373 7.61597 14.9653 8.72397 14.9653 11.186C14.9653 14.052 17.4933 15.052 17.5733 15.078C17.5613 15.14 17.1733 16.482 16.2373 17.848C15.4133 19.038 14.5533 20.226 13.2533 20.226C11.9533 20.226 11.5893 19.47 10.0893 19.47C8.62534 19.47 8.06534 20.25 6.86534 20.25C5.66534 20.25 4.82934 19.134 3.86534 17.776C2.74534 16.176 1.83734 13.716 1.83734 11.378C1.83734 7.78197 4.11734 5.86797 6.36134 5.86797C7.62534 5.86797 8.68134 6.69597 9.48934 6.69597C10.2613 6.69597 11.4373 5.81997 12.8853 5.81997C13.4453 5.81997 15.4173 5.86797 17.0493 7.52997ZM12.1293 3.83397C12.7533 3.09597 13.1893 2.07597 13.1893 1.05597C13.1893 0.917969 13.1773 0.777969 13.1533 0.665969C12.1413 0.701969 10.9413 1.33797 10.2013 2.17197C9.61334 2.83197 9.08134 3.85197 9.08134 4.88397C9.08134 5.03397 9.10534 5.18397 9.11734 5.23197C9.17734 5.24397 9.27334 5.25597 9.36934 5.25597C10.2733 5.25597 11.4693 4.64397 12.1293 3.83397Z" />
                                    </svg>
                                    Continue with Apple
                                </button>
                            </motion.div>
                        )}

                        {/* ─── STEP 2: MODEL ─── */}
                        {step === 1 && (
                            <motion.div
                                key="step-model"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Choose Your AI</h2>
                                    <p className="text-gray-500 font-medium text-sm">Step 2 of 4 — Pick a model to power your bot</p>
                                </div>

                                {/* API Key Mode */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setApiKeyMode('platform_credits')}
                                        className={`p-5 rounded-2xl border-2 transition-all text-left relative ${apiKeyMode === 'platform_credits'
                                            ? 'border-emerald-500/50 bg-emerald-500/5'
                                            : 'border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        {apiKeyMode === 'platform_credits' && (
                                            <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-full tracking-wider">Recommended</span>
                                        )}
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${apiKeyMode === 'platform_credits' ? 'bg-emerald-500/15' : 'bg-white/5'}`}>
                                                <Sparkles size={16} className={apiKeyMode === 'platform_credits' ? 'text-emerald-400' : 'text-white/30'} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-sm uppercase tracking-tight">Use Our Credits</h4>
                                                <p className="text-[10px] text-emerald-400/80 font-bold">$10 included free</p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-white/50 leading-relaxed">No API key needed — we handle everything.</p>
                                    </button>
                                    <button
                                        onClick={() => setApiKeyMode('own_key')}
                                        className={`p-5 rounded-2xl border-2 transition-all text-left ${apiKeyMode === 'own_key'
                                            ? 'border-blue-500/50 bg-blue-500/5'
                                            : 'border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${apiKeyMode === 'own_key' ? 'bg-blue-500/15' : 'bg-white/5'}`}>
                                                <Lock size={16} className={apiKeyMode === 'own_key' ? 'text-blue-400' : 'text-white/30'} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-sm uppercase tracking-tight">Your Own Key</h4>
                                                <p className="text-[10px] text-blue-400/80 font-bold">Any provider, unlimited</p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-white/50 leading-relaxed">Use your own API key from any provider.</p>
                                    </button>
                                </div>

                                {/* Own key — provider + key fields */}
                                {apiKeyMode === 'own_key' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className={labelClass}>Provider</label>
                                            <select value={provider} onChange={e => setProvider(e.target.value)}
                                                className={inputClass + ' appearance-none'}>
                                                {PROVIDERS.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>API Key</label>
                                            <input type="password" value={ownApiKey} onChange={e => setOwnApiKey(e.target.value)}
                                                className={inputClass + ' font-mono'} placeholder="sk-..." />
                                        </div>
                                    </div>
                                )}

                                {/* Model selector */}
                                <div className="space-y-2">
                                    <label className={labelClass}>Model</label>
                                    <input value={model} onChange={e => setModel(e.target.value)}
                                        className={inputClass + ' font-mono text-sm'} placeholder="e.g. google/gemini-3-flash-preview" />
                                    {fetchedModels.length > 0 && (
                                        <div className="relative mt-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                            <input value={modelSearch} onChange={e => setModelSearch(e.target.value)}
                                                className="w-full bg-white/5 border border-white/5 rounded-xl px-9 py-2.5 outline-none text-xs text-white placeholder:text-white/20"
                                                placeholder="Search models..." />
                                        </div>
                                    )}
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl p-2 mt-2">
                                        {isFetchingModels ? (
                                            <div className="flex items-center justify-center py-6 gap-2 text-white/40">
                                                <Loader2 size={14} className="animate-spin" />
                                                <span className="text-xs">Loading models...</span>
                                            </div>
                                        ) : fetchedModels.length > 0 ? (
                                            fetchedModels
                                                .filter(m => {
                                                    if (!modelSearch.trim()) return true;
                                                    const q = modelSearch.toLowerCase();
                                                    return m.name?.toLowerCase().includes(q) || m.id?.toLowerCase().includes(q);
                                                })
                                                .slice(0, 30)
                                                .map(m => {
                                                    const inputCost = m.promptPrice ? (m.promptPrice * 1_000_000).toFixed(2) : null;
                                                    const isFree = inputCost === '0.00';
                                                    return (
                                                        <button key={m.id} onClick={() => { setModel(m.id); setModelSearch(''); }}
                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all text-xs ${model === m.id ? 'bg-emerald-500/10 border border-emerald-500/30 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'
                                                                }`}>
                                                            <span className="font-bold truncate">{m.name || m.id}</span>
                                                            {isFree ? (
                                                                <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0 ml-2">FREE</span>
                                                            ) : inputCost ? (
                                                                <span className="text-[7px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-full shrink-0 ml-2">${inputCost}/1M</span>
                                                            ) : null}
                                                        </button>
                                                    );
                                                })
                                        ) : (
                                            <div className="text-center py-6 text-white/30 text-xs">
                                                {apiKeyMode === 'platform_credits' ? 'Models will auto-load from OpenRouter.' : 'Enter your API key to load models.'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── STEP 3: CHANNEL ─── */}
                        {step === 2 && (
                            <motion.div
                                key="step-channel"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Connect a Channel</h2>
                                    <p className="text-gray-500 font-medium text-sm">Step 3 of 4 — Where should your bot live?</p>
                                </div>

                                {/* Channel cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        { id: 'telegram' as const, name: 'Telegram', desc: 'Easiest setup', badge: '⭐ Recommended' },
                                        { id: 'discord' as const, name: 'Discord', desc: 'For communities' },
                                        { id: 'whatsapp' as const, name: 'WhatsApp', desc: 'Personal chat' },
                                        { id: 'slack' as const, name: 'Slack', desc: 'Workspace bot' },
                                        { id: 'feishu' as const, name: 'Feishu', desc: 'Lark / Feishu' },
                                    ].map(ch => (
                                        <button key={ch.id} onClick={() => setSelectedChannel(ch.id)}
                                            className={`p-4 rounded-2xl border-2 transition-all text-center relative ${selectedChannel === ch.id
                                                ? 'border-[#ff6b6b]/50 bg-[#ff6b6b]/5'
                                                : 'border-white/5 hover:border-white/10'
                                                }`}>
                                            {ch.badge && selectedChannel === ch.id && (
                                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[#ff6b6b] text-white text-[7px] font-black uppercase rounded-full tracking-wider whitespace-nowrap">{ch.badge}</span>
                                            )}
                                            <img src={CHANNEL_ICONS[ch.id]} alt={ch.name} className="w-10 h-10 mx-auto mb-2 rounded-xl" />
                                            <div className="font-black text-sm">{ch.name}</div>
                                            <div className="text-[10px] text-white/40">{ch.desc}</div>
                                        </button>
                                    ))}
                                </div>

                                {/* Channel-specific setup */}
                                {selectedChannel === 'telegram' && (
                                    <div className="space-y-4 mt-4">
                                        <div className="bg-blue-500/5 p-4 rounded-2xl text-[11px] text-blue-300/80 leading-relaxed border border-blue-500/10">
                                            <div className="flex items-start gap-3">
                                                <Smartphone size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-blue-300 mb-1">📱 Quick Setup (2 min):</p>
                                                    <ol className="list-decimal list-inside space-y-1">
                                                        <li>Install <a href="https://telegram.org/apps" target="_blank" className="text-blue-400 underline">Telegram</a> on your phone</li>
                                                        <li>Open Telegram → search <a href="https://t.me/botfather" target="_blank" className="text-blue-400 underline font-bold">@BotFather</a></li>
                                                        <li>Send <code className="bg-white/10 px-1.5 py-0.5 rounded text-white">/newbot</code> → follow the prompts</li>
                                                        <li>Copy the token BotFather gives you → paste below</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Telegram Bot Token</label>
                                            <input type="password" value={telegramToken} onChange={e => setTelegramToken(e.target.value)}
                                                className={inputClass + ' font-mono text-sm'} placeholder="123456:AABBCC..." />
                                        </div>
                                    </div>
                                )}

                                {selectedChannel === 'discord' && (
                                    <div className="space-y-4 mt-4">
                                        <div className="bg-indigo-500/5 p-4 rounded-2xl text-[11px] text-indigo-300/80 leading-relaxed border border-indigo-500/10">
                                            <div className="flex items-start gap-3">
                                                <MessageSquare size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-indigo-300 mb-1">🎮 Discord Setup:</p>
                                                    <ol className="list-decimal list-inside space-y-1">
                                                        <li>Go to <a href="https://discord.com/developers/applications" target="_blank" className="text-indigo-400 underline">Discord Developer Portal</a></li>
                                                        <li>Create a New Application → go to Bot tab → Get Token</li>
                                                        <li>Enable <strong className="text-white">Message Content Intent</strong> in the Bot settings</li>
                                                        <li>Invite the bot to your server via OAuth2 → URL Generator</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Discord Bot Token</label>
                                            <input type="password" value={discordToken} onChange={e => setDiscordToken(e.target.value)}
                                                className={inputClass + ' font-mono text-sm'} placeholder="MTIz..." />
                                        </div>
                                    </div>
                                )}

                                {selectedChannel === 'whatsapp' && (
                                    <div className="mt-4">
                                        <div className="bg-green-500/5 p-4 rounded-2xl text-[11px] text-green-300/80 leading-relaxed border border-green-500/10">
                                            <div className="flex items-start gap-3">
                                                <Smartphone size={16} className="text-green-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-green-300 mb-1">📲 WhatsApp Setup:</p>
                                                    <p className="mb-2">WhatsApp requires scanning a QR code to link your phone. After your bot deploys, a QR code will appear in your dashboard.</p>
                                                    <p className="text-amber-300/80"><strong className="text-amber-300">⚠️ Tip:</strong> Use a <strong className="text-white">dedicated phone number</strong> — it will auto-reply to all incoming messages.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedChannel === 'slack' && (
                                    <div className="space-y-4 mt-4">
                                        <div className="bg-purple-500/5 p-4 rounded-2xl text-[11px] text-purple-300/80 leading-relaxed border border-purple-500/10">
                                            <div className="flex items-start gap-3">
                                                <MessageSquare size={16} className="text-purple-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-purple-300 mb-1">💼 Slack Setup:</p>
                                                    <ol className="list-decimal list-inside space-y-1">
                                                        <li>Go to <a href="https://api.slack.com/apps" target="_blank" className="text-purple-400 underline">Slack API Dashboard</a></li>
                                                        <li>Create a New App → Enable Socket Mode → get App Token</li>
                                                        <li>Go to OAuth & Permissions → Install to Workspace → get Bot Token</li>
                                                        <li>Enable Events: <code className="bg-white/10 px-1 py-0.5 rounded text-white">message.im</code>, <code className="bg-white/10 px-1 py-0.5 rounded text-white">app_mention</code></li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Slack Bot Token</label>
                                            <input type="password" value={slackBotToken} onChange={e => setSlackBotToken(e.target.value)}
                                                className={inputClass + ' font-mono text-sm'} placeholder="xoxb-..." />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Slack App Token</label>
                                            <input type="password" value={slackAppToken} onChange={e => setSlackAppToken(e.target.value)}
                                                className={inputClass + ' font-mono text-sm'} placeholder="xapp-..." />
                                        </div>
                                    </div>
                                )}

                                {selectedChannel === 'feishu' && (
                                    <div className="space-y-4 mt-4">
                                        <div className="bg-blue-500/5 p-4 rounded-2xl text-[11px] text-blue-300/80 leading-relaxed border border-blue-500/10">
                                            <div className="flex items-start gap-3">
                                                <MessageSquare size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-blue-300 mb-1">🐦 Feishu / Lark Setup:</p>
                                                    <ol className="list-decimal list-inside space-y-1">
                                                        <li>Go to <a href="https://open.feishu.cn/app" target="_blank" className="text-blue-400 underline">Feishu Open Platform</a></li>
                                                        <li>Create a Custom App → get App ID and App Secret</li>
                                                        <li>Enable Bot capability and set up Event subscriptions</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Feishu App ID</label>
                                            <input value={feishuAppId} onChange={e => setFeishuAppId(e.target.value)}
                                                className={inputClass + ' font-mono text-sm'} placeholder="cli_..." />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Feishu App Secret</label>
                                            <input type="password" value={feishuAppSecret} onChange={e => setFeishuAppSecret(e.target.value)}
                                                className={inputClass + ' font-mono text-sm'} placeholder="App secret..." />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ─── STEP 4: LAUNCH SUCCESS ─── */}
                        {step === 3 && (
                            <motion.div
                                key="step-launch"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center space-y-6"
                            >
                                <div className="relative">
                                    <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-3xl flex items-center justify-center border border-green-500/30 mb-4">
                                        <Rocket size={36} className="text-green-400" />
                                    </div>
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Bot Deployed! 🎉</h2>
                                    <p className="text-gray-400 text-sm">Your AI agent is live and ready to chat</p>
                                </div>

                                {/* Credit info */}
                                {apiKeyMode === 'platform_credits' && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 inline-flex items-center gap-3 mx-auto">
                                        <Sparkles size={18} className="text-emerald-400" />
                                        <div className="text-left">
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Free Credits</div>
                                            <div className="text-lg font-black text-emerald-400">$10.00</div>
                                        </div>
                                    </div>
                                )}

                                {/* Channel-specific quick start tip */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ArrowRight size={14} className="text-[#ff6b6b]" />
                                        Next: Send your first message
                                    </h3>

                                    {selectedChannel === 'telegram' && (
                                        <div className="space-y-3">
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400 text-xs font-black">1</div>
                                                <p className="text-sm text-white/60">Open <strong className="text-white">Telegram</strong> on your phone or desktop</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400 text-xs font-black">2</div>
                                                <p className="text-sm text-white/60">Search for your bot (the username you created with @BotFather)</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400 text-xs font-black">3</div>
                                                <p className="text-sm text-white/60">Send any message — your AI will reply instantly! 🚀</p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedChannel === 'discord' && (
                                        <div className="space-y-3">
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400 text-xs font-black">1</div>
                                                <p className="text-sm text-white/60">Open <strong className="text-white">Discord</strong> and go to your server</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400 text-xs font-black">2</div>
                                                <p className="text-sm text-white/60">Make sure you've invited the bot to your server (OAuth2 → URL Generator → Bot scope)</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400 text-xs font-black">3</div>
                                                <p className="text-sm text-white/60">Type a message in any channel — the bot will respond! 🎮</p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedChannel === 'whatsapp' && (
                                        <div className="space-y-3">
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-400 text-xs font-black">1</div>
                                                <p className="text-sm text-white/60">Go to your <strong className="text-white">Dashboard</strong> → open your agent → Channels tab</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-400 text-xs font-black">2</div>
                                                <p className="text-sm text-white/60">Scan the <strong className="text-white">QR code</strong> with WhatsApp on your phone</p>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-400 text-xs font-black">3</div>
                                                <p className="text-sm text-white/60">Send a message from another number — the AI replies! 📲</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="w-full bg-[#ff6b6b] text-white py-5 rounded-2xl font-black tracking-widest uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#ff6b6b]/20 flex items-center justify-center gap-3"
                                >
                                    Go to Dashboard
                                    <ArrowRight size={18} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error display */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-bold mt-6">
                            {error}
                        </div>
                    )}

                    {/* Navigation buttons (steps 0-2 only) */}
                    {step < 3 && (
                        <div className="flex items-center gap-3 mt-8">
                            {step > 0 && (
                                <button onClick={() => { setStep(s => s - 1); setError(''); }}
                                    className="px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-bold text-sm">
                                    <ChevronLeft size={16} />
                                    Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                disabled={!canProceed() || loading}
                                className="flex-1 bg-[#ff6b6b] text-white py-5 rounded-2xl font-black tracking-widest uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#ff6b6b]/20 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        DEPLOYING YOUR BOT...
                                    </>
                                ) : step === 2 ? (
                                    <>
                                        <Rocket size={18} />
                                        DEPLOY & LAUNCH
                                    </>
                                ) : (
                                    <>
                                        NEXT STEP
                                        <ChevronRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Login link */}
                    {step < 3 && (
                        <div className="mt-8 pt-6 border-t border-white/5 text-center">
                            <p className="text-gray-500 text-sm font-medium">
                                Already have an account?{' '}
                                <Link to="/login" className="text-[#ff6b6b] font-bold hover:underline">Login</Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
