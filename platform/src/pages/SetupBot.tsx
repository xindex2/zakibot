import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import StarField from '../components/StarField';
import {
    ChevronRight, ChevronLeft, Sparkles, Lock, Loader2, Search,
    Rocket, Check, ArrowRight, Smartphone, MessageSquare,
    Zap, Crown, Building2, CheckCircle2, AlertTriangle
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
    { id: 'model', label: 'AI Model', num: 1 },
    { id: 'channel', label: 'Channel', num: 2 },
    { id: 'plan', label: 'Plan', num: 3 },
    { id: 'launch', label: 'Launch!', num: 4 },
];

/**
 * Post-OAuth onboarding: 4-step wizard for users who signed in via
 * Google / Apple and have no bots yet. Account already exists.
 */
export default function SetupBot() {
    const navigate = useNavigate();
    const { user, token } = useAuth();

    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Step 1 — Model
    const [apiKeyMode, setApiKeyMode] = useState<'platform_credits' | 'own_key'>('platform_credits');
    const [provider, setProvider] = useState('openrouter');
    const [model, setModel] = useState('google/gemini-3-flash-preview');
    const [ownApiKey, setOwnApiKey] = useState('');
    const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string; promptPrice?: number; completionPrice?: number }[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [modelSearch, setModelSearch] = useState('');

    // Step 2 — Channel
    const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'discord' | 'whatsapp' | 'slack' | 'feishu' | null>(null);
    const [telegramToken, setTelegramToken] = useState('');
    const [discordToken, setDiscordToken] = useState('');
    const [slackBotToken, setSlackBotToken] = useState('');
    const [slackAppToken, setSlackAppToken] = useState('');
    const [feishuAppId, setFeishuAppId] = useState('');
    const [feishuAppSecret, setFeishuAppSecret] = useState('');

    // Step 3 — Result
    const [deployedBot, setDeployedBot] = useState<any>(null);

    // Plan data
    const [paymentProvider, setPaymentProvider] = useState('creem');
    const [creemPlans, setCreemPlans] = useState<any[]>([]);

    const PLANS = [
        { name: 'Starter', price: '$29', icon: <Rocket size={20} />, color: 'text-blue-500', bg: 'border-blue-500/30 bg-blue-500/5', features: ['1 Active Agent', '$10 API Credits', 'Priority Support', 'All Skills'] },
        { name: 'Pro', price: '$69', icon: <Zap size={20} />, color: 'text-purple-500', bg: 'border-purple-500/30 bg-purple-500/5', features: ['5 Active Agents', '$10 API Credits', 'Advanced Skills', 'API Access'], recommended: true },
        { name: 'Elite', price: '$99', icon: <Crown size={20} />, color: 'text-red-500', bg: 'border-red-500/30 bg-red-500/5', features: ['10 Agent Slots', '$10 API Credits', 'Private Nodes', 'Dedicated Manager'] },
        { name: 'Enterprise', price: 'Custom', icon: <Building2 size={20} />, color: 'text-white', bg: 'border-white/10 bg-white/5', features: ['Unlimited Agents', 'On-Premise Deploy', 'Custom LLM Training', 'SLA Support'] },
    ];

    // Redirect if not logged in
    useEffect(() => {
        if (!token) navigate('/login');
    }, [token]);

    // Auto-fetch models when entering step 1
    useEffect(() => {
        if (step === 0) fetchModels();
    }, [step, apiKeyMode]);

    // Fetch plan data when reaching the plan step
    useEffect(() => {
        if (step === 2) {
            fetch('/api/payment-provider')
                .then(r => r.json())
                .then(data => setPaymentProvider(data.provider || 'creem'))
                .catch(() => { });
            fetch('/api/creem-plans')
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setCreemPlans(data); })
                .catch(() => { });
        }
    }, [step]);

    const fetchModels = async () => {
        const isPlatform = apiKeyMode === 'platform_credits';
        if (!isPlatform && !ownApiKey) return;
        setIsFetchingModels(true);
        try {
            const resp = await fetch('/api/models', { method: 'GET' });
            const data = await resp.json();
            setFetchedModels(data.models || []);
        } catch {
            try {
                const resp = await fetch('/api/models/fetch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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
            case 0: return model && (apiKeyMode === 'platform_credits' || ownApiKey);
            case 1: return selectedChannel && (
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
        if (!user || !token) return;
        setError('');
        setLoading(true);
        try {
            // Create bot config via the existing /api/config endpoint
            const botConfig: any = {
                userId: user.id,
                name: `${user.full_name || 'My'}'s Agent`,
                description: 'AI assistant created during setup.',
                provider: apiKeyMode === 'platform_credits' ? 'openrouter' : provider,
                model,
                apiKeyMode,
                apiKey: apiKeyMode === 'own_key' ? ownApiKey : '',
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
            };

            const saveResp = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(botConfig)
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || 'Failed to create bot');

            // Auto-start the bot
            const botId = saveData.id;
            if (botId) {
                try {
                    await fetch('/api/bot/control', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ configId: botId, action: 'start' })
                    });
                } catch { /* ignore start errors */ }
            }

            setDeployedBot(saveData);
            setStep(2);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        setError('');
        if (step === 1) {
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
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Logo size={60} />
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ─── STEP 1: MODEL ─── */}
                        {step === 0 && (
                            <motion.div
                                key="step-model"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Choose Your AI</h2>
                                    <p className="text-gray-500 font-medium text-sm">Step 1 of 4 — Pick a model to power your bot</p>
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

                        {/* ─── STEP 2: CHANNEL ─── */}
                        {step === 1 && (
                            <motion.div
                                key="step-channel"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Connect a Channel</h2>
                                    <p className="text-gray-500 font-medium text-sm">Step 2 of 4 — Where should your bot live?</p>
                                </div>

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

                        {/* ─── STEP 3: CHOOSE PLAN ─── */}
                        {step === 2 && (
                            <motion.div
                                key="step-plan"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="space-y-6"
                            >
                                <div className="text-center mb-4">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Choose Your Plan</h2>
                                    <p className="text-gray-500 font-medium text-sm">Step 3 of 4 — Unlock the full power of your agent</p>
                                </div>

                                {/* Free trial paused notice */}
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-300">Free trial paused</p>
                                        <p className="text-[11px] text-amber-200/60 leading-relaxed">Due to overwhelming demand, we've temporarily paused the free trial. Choose a plan below to deploy and run your agent.</p>
                                    </div>
                                </div>

                                {/* Plan cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {PLANS.map(plan => {
                                        const creemLink = creemPlans.find((cp: any) => cp.planName === plan.name)?.checkoutUrl;
                                        const checkoutUrl = plan.name === 'Enterprise'
                                            ? 'mailto:support@myclaw.host'
                                            : (paymentProvider === 'creem' ? creemLink : null) || '#';

                                        return (
                                            <button
                                                key={plan.name}
                                                onClick={() => {
                                                    if (plan.name === 'Enterprise') {
                                                        window.open('mailto:support@myclaw.host', '_blank');
                                                    } else if (checkoutUrl && checkoutUrl !== '#') {
                                                        try {
                                                            const u = new URL(checkoutUrl);
                                                            if (user?.email) {
                                                                u.searchParams.set('email', user.email);
                                                                u.searchParams.set('customer_email', user.email);
                                                            }
                                                            window.open(u.toString(), '_blank');
                                                        } catch {
                                                            window.open(checkoutUrl, '_blank');
                                                        }
                                                    } else {
                                                        navigate('/billing');
                                                    }
                                                }}
                                                className={`p-5 rounded-2xl border-2 transition-all text-left relative hover:scale-[1.02] active:scale-95 ${plan.bg}`}
                                            >
                                                {plan.recommended && (
                                                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-purple-500 text-white text-[7px] font-black uppercase rounded-full tracking-wider">Recommended</span>
                                                )}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${plan.color}`}>
                                                        {plan.icon}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-sm uppercase tracking-tight text-white">{plan.name}</h4>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg font-black text-white">{plan.price}</span>
                                                            {plan.price !== 'Custom' && <span className="text-[9px] text-white/40 font-bold">/mo</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ul className="space-y-1.5">
                                                    {plan.features.map((f, i) => (
                                                        <li key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                                                            <CheckCircle2 size={10} className={plan.color} />
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Skip for now */}
                                <button
                                    onClick={() => setStep(3)}
                                    className="w-full text-center text-white/30 hover:text-white/60 text-xs font-bold py-3 transition-all"
                                >
                                    Skip for now — I'll test my bot first →
                                </button>
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

                                {apiKeyMode === 'platform_credits' && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 inline-flex items-center gap-3 mx-auto">
                                        <Sparkles size={18} className="text-emerald-400" />
                                        <div className="text-left">
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Free Credits</div>
                                            <div className="text-lg font-black text-emerald-400">$10.00</div>
                                        </div>
                                    </div>
                                )}

                                {/* Channel-specific quick start tips */}
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

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-bold mt-6">
                            {error}
                        </div>
                    )}

                    {step < 2 && (
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
                                ) : step === 1 ? (
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


                </div>
            </div>
        </div>
    );
}
