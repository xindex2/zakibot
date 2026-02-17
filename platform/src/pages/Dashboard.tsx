import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bot, Cpu, Share2, Terminal, Server, CreditCard, User, LogOut, Search, Globe, HardDrive, Clock,
    Trash2, Play, Square, Settings, LayoutDashboard, ChevronRight, CheckCircle, Plus, Rocket,
    Cloud, FileText, Lock, Sparkles, ChevronLeft, Edit3, Activity, Check, Info, Loader2, Zap, Layout, RefreshCw,
    MessageSquare, Smartphone, QrCode, ShieldAlert, Shield, Layers, Upload, FolderOpen, File, Image, Code,
    Download, Eye, X, FilePlus, Video, Crown, ArrowUpRight, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useAuth } from '../context/AuthContext';


function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ICONS = {
    telegram: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png',
    discord: 'https://favicon.im/discord.com?t=1770422839363',
    whatsapp: 'https://favicon.im/whatsapp.com?larger=true',
    feishu: 'https://www.feishu.cn/favicon.ico',
    github: 'https://github.com/favicon.ico',
    slack: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
    teams: 'https://statics.teams.cdn.live.net/hashed/favicon/prod/favicon-f1722d9.ico'
};

const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter (Global)', icon: 'https://openrouter.ai/favicon.ico' },
    { id: 'anthropic', name: 'Anthropic Claude', icon: 'https://www.anthropic.com/favicon.ico' },
    { id: 'openai', name: 'OpenAI GPT', icon: 'https://openai.com/favicon.ico' },
    { id: 'deepseek', name: 'DeepSeek', icon: 'https://www.deepseek.com/favicon.ico' },
    { id: 'google', name: 'Google Gemini', icon: 'https://www.google.com/favicon.ico' },
    { id: 'xai', name: 'xAI Grok', icon: 'https://x.ai/favicon.ico' },
    { id: 'groq', name: 'Groq (Fast Inference)', icon: 'https://groq.com/favicon.ico' },
    { id: 'moonshot', name: 'Moonshot / Kimi', icon: 'https://www.moonshot.cn/favicon.ico' },
    { id: 'dashscope', name: 'DashScope (Qwen)', icon: 'https://help.aliyun.com/favicon.ico' },
    { id: 'ollama', name: 'Ollama (Local)', icon: 'https://ollama.com/public/ollama.png' },
    { id: 'venice', name: 'Venice AI', icon: 'https://venice.ai/favicon.ico' },
    { id: 'vllm', name: 'vLLM (Local)', icon: 'https://vllm.ai/favicon.ico' },
    { id: 'zhipu', name: 'Zhipu AI (GLM)', icon: 'https://www.zhipuai.cn/favicon.ico' },
    { id: 'aihubmix', name: 'AIHubMix', icon: 'https://aihubmix.com/favicon.ico' },
];

// MODEL_CATALOG removed — models are fetched live from providers

interface AgentConfig {
    id: string;
    name: string;
    description: string;
    provider: string;
    apiKey: string;
    apiKeyMode: string;
    apiBase: string;
    model: string;
    timezone: string;
    telegramEnabled: boolean;
    telegramToken: string;
    telegramAllowFrom: string;
    discordEnabled: boolean;
    discordToken: string;
    discordAllowFrom: string;
    whatsappEnabled: boolean;
    whatsappBridgeUrl: string;
    whatsappAllowFrom: string;
    feishuEnabled: boolean;
    feishuAppId: string;
    feishuAppSecret: string;
    feishuEncryptKey: string;
    feishuVerificationToken: string;
    feishuAllowFrom: string;
    slackEnabled: boolean;
    slackBotToken: string;
    slackAppToken: string;
    slackAllowFrom: string;
    teamsEnabled: boolean;
    teamsAppId: string;
    teamsAppPassword: string;
    teamsAllowFrom: string;
    webSearchApiKey: string;
    githubEnabled: boolean;
    githubToken: string;
    browserEnabled: boolean;
    shellEnabled: boolean;
    tmuxEnabled: boolean;
    restrictToWorkspace: boolean;
    weatherEnabled: boolean;
    summarizeEnabled: boolean;
    cronEnabled: boolean;
    skillCreatorEnabled: boolean;
    firecrawlApiKey: string;
    apifyApiToken: string;
    captchaProvider: string;
    captchaApiKey: string;
    proxyUrl: string;
    gatewayHost: string;
    gatewayPort: number;
    maxToolIterations: number;
    status: string;
    lastRun?: string;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [agents, setAgents] = useState<AgentConfig[]>([]);
    const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('provider');
    const [isSaving, setIsSaving] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [waLinked, setWaLinked] = useState(false);
    const [subscription, setSubscription] = useState<any>(null);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string; promptPrice?: number; completionPrice?: number }[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [modelFetchError, setModelFetchError] = useState<string | null>(null);
    const [modelSearch, setModelSearch] = useState('');
    const [showVideoGuide, setShowVideoGuide] = useState(false);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedJson = useRef<string>('');

    // Listen for sidebar "Dashboard" / "Agents" clicks to exit agent settings
    useEffect(() => {
        const handleReset = () => setEditingAgent(null);
        window.addEventListener('resetDashboard', handleReset);
        return () => window.removeEventListener('resetDashboard', handleReset);
    }, []);

    // Auto-save: debounce 2 seconds after any editingAgent change (only for existing agents)
    useEffect(() => {
        if (!editingAgent || !editingAgent.id || isSaving) return;
        const currentJson = JSON.stringify(editingAgent);
        if (currentJson === lastSavedJson.current) return;

        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(async () => {
            lastSavedJson.current = currentJson;
            if (!user || !token) return;
            try {
                await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ userId: user.id, ...editingAgent })
                });
                fetchAgents();
            } catch (e) { /* silent auto-save */ }
        }, 2000);

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        };
    }, [editingAgent]);

    // Workspace state
    const [wsFiles, setWsFiles] = useState<any[]>([]);
    const [wsPath, setWsPath] = useState('');
    const [wsLoading, setWsLoading] = useState(false);
    const [wsPreview, setWsPreview] = useState<{ name: string; content: string; type: string } | null>(null);
    const [wsNewFile, setWsNewFile] = useState(false);
    const [wsNewFileName, setWsNewFileName] = useState('');
    const [wsNewFileContent, setWsNewFileContent] = useState('');
    const [wsDragOver, setWsDragOver] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAgents();
            fetchSubscription();
            const interval = setInterval(() => {
                fetchAgents();
                fetchSubscription();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchSubscription = async () => {
        if (!token) return;
        try {
            const resp = await fetch('/api/subscription', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setSubscription(data);
            }
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
        }
    };

    const fetchAgents = async () => {
        if (!user) return;
        try {
            const resp = await fetch(`/api/config?userId=${user.id}`);
            if (resp.ok) {
                const data = await resp.json();
                setAgents(data);
            }
        } catch (err) {
            console.error('Failed to fetch agents:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchQr = async (configId: string) => {
        if (!configId) return;
        try {
            const resp = await fetch(`/api/bot/qr/${configId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.qr) {
                    setQrCode(data.qr);
                } else {
                    setQrCode(null);
                }
                setWaLinked(!!data.linked);
            }
        } catch (e) { }
    };

    const fetchDynamicModels = async (overrideMode?: string) => {
        const mode = overrideMode || editingAgent?.apiKeyMode || 'own_key';
        const isPlatformCredits = mode === 'platform_credits';

        if (!isPlatformCredits && !editingAgent?.apiKey) {
            setModelFetchError('Enter your API key first');
            return;
        }
        setIsFetchingModels(true);
        setModelFetchError(null);
        try {
            const resp = await fetch('/api/models/fetch', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    provider: isPlatformCredits ? 'openrouter' : editingAgent!.provider,
                    apiKey: isPlatformCredits ? undefined : editingAgent!.apiKey,
                    apiKeyMode: mode
                })
            });
            const data = await resp.json();
            if (data.error) {
                setModelFetchError(data.error);
            }
            setFetchedModels(data.models || []);
        } catch (e: any) {
            setModelFetchError(e.message || 'Failed to fetch models');
        } finally {
            setIsFetchingModels(false);
        }
    };

    // Auto-fetch models when API key, provider, or apiKeyMode changes
    useEffect(() => {
        if (!editingAgent) return;
        const isPlatformCredits = editingAgent.apiKeyMode === 'platform_credits';

        // For platform credits: auto-fetch immediately if no models loaded
        if (isPlatformCredits && fetchedModels.length === 0) {
            fetchDynamicModels('platform_credits');
            return;
        }

        // For own key: auto-fetch when API key has enough characters
        if (!isPlatformCredits && editingAgent.apiKey && editingAgent.apiKey.length >= 10) {
            const timer = setTimeout(() => {
                fetchDynamicModels();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [editingAgent?.apiKey, editingAgent?.provider, editingAgent?.apiKeyMode]);

    useEffect(() => {
        let interval: any;
        if (activeTab === 'channels' && editingAgent?.whatsappEnabled && editingAgent.id) {
            fetchQr(editingAgent.id);
            interval = setInterval(() => {
                fetchQr(editingAgent.id);
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab, editingAgent?.whatsappEnabled, editingAgent?.id]);

    const handleCreateAgent = () => {
        // Enforce agent creation limit
        const currentPlan = subscription?.plan || 'Free';
        const maxAgents = currentPlan === 'Free' ? 1 : (subscription?.maxInstances || 1);
        const currentCount = agents.length;

        if (currentCount >= maxAgents) {
            setShowLimitModal(true);
            return;
        }

        const newAgent: any = {
            name: 'New Agent',
            description: 'A helpful AI assistant.',
            provider: 'openrouter',
            model: 'google/gemini-3-flash-preview',
            apiKey: '',
            apiKeyMode: 'platform_credits',
            apiBase: '',
            telegramEnabled: false,
            discordEnabled: false,
            whatsappEnabled: false,
            feishuEnabled: false,
            slackEnabled: false,
            teamsEnabled: false,
            browserEnabled: true,
            shellEnabled: true,
            tmuxEnabled: true,
            weatherEnabled: true,
            summarizeEnabled: true,
            cronEnabled: true,
            skillCreatorEnabled: true,
            webSearchApiKey: '',
            githubToken: '',
            firecrawlApiKey: '',
            apifyApiToken: '',
            captchaProvider: '',
            captchaApiKey: '',
            proxyUrl: '',
            restrictToWorkspace: true,
            gatewayHost: '0.0.0.0',
            gatewayPort: 18790 + (agents.length * 10),
            maxToolIterations: 30,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        };
        setEditingAgent(newAgent);
    };

    // One-click quick-start: auto-create and save a working agent with platform credits
    const handleQuickStart = async () => {
        if (subscription && agents.length >= (subscription.maxInstances || 1)) {
            setShowLimitModal(true);
            return;
        }
        const quickAgent: any = {
            name: 'My First Agent',
            description: 'A helpful AI assistant powered by your free credits.',
            provider: 'openrouter',
            model: 'google/gemini-3-flash-preview',
            apiKey: '',
            apiKeyMode: 'platform_credits',
            apiBase: '',
            telegramEnabled: false,
            discordEnabled: false,
            whatsappEnabled: false,
            feishuEnabled: false,
            slackEnabled: false,
            browserEnabled: true,
            shellEnabled: true,
            tmuxEnabled: true,
            weatherEnabled: true,
            summarizeEnabled: true,
            cronEnabled: true,
            skillCreatorEnabled: true,
            webSearchApiKey: '',
            githubToken: '',
            firecrawlApiKey: '',
            apifyApiToken: '',
            captchaProvider: '',
            captchaApiKey: '',
            proxyUrl: '',
            restrictToWorkspace: true,
            gatewayHost: '0.0.0.0',
            gatewayPort: 18790 + (agents.length * 10),
            maxToolIterations: 30,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        };
        await saveConfig(quickAgent);
    };

    const saveConfig = async (config: AgentConfig) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const resp = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId: user.id, ...config })
            });

            const data = await resp.json();

            if (!resp.ok) {
                if (data.error?.startsWith('AGENT_LIMIT_REACHED')) {
                    setShowLimitModal(true);
                } else {
                    alert('Protocol Error: ' + (data.error || 'Failed to save config'));
                }
                return;
            }

            if (resp.ok) {
                // Auto-start the bot immediately after saving/deploying (all plans including Free)
                const savedId = data.id || config.id;
                if (savedId) {
                    try {
                        await fetch('/api/bot/control', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ configId: savedId, action: 'start' })
                        });
                    } catch (e) { /* ignore start errors */ }
                }
                await fetchAgents();
                await fetchSubscription();
                setEditingAgent(null);
            }
        } finally {
            setIsSaving(false);
        }
    };



    const deleteAgent = async (id: string) => {
        if (!confirm('Are you sure you want to delete this agent?')) return;
        try {
            await fetch(`/api/config/${id}`, { method: 'DELETE' });
            await fetchAgents();
            await fetchSubscription();
        } catch (e) { }
    };

    const toggleBot = async (configId: string, currentStatus: string) => {
        const action = currentStatus === 'running' ? 'stop' : 'start';
        const resp = await fetch('/api/bot/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ configId, action })
        });
        if (resp.ok) {
            fetchAgents();
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen py-8 px-4 md:px-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
                {!editingAgent ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                    >
                        <header className="glass-panel rounded-2xl md:rounded-3xl overflow-hidden">
                            {/* Top row: Title, Plan, Agent count, Buttons */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6">
                                <div className="flex items-center gap-4">
                                    <div className="space-y-0.5">
                                        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white uppercase italic">
                                            Dashboard
                                        </h1>
                                    </div>
                                    {subscription && (
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-lg">
                                                {subscription.plan || 'Free'}
                                            </span>
                                            <span className="px-2.5 py-1 bg-white/5 border border-white/5 text-white/50 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
                                                <Bot size={10} /> {agents.length}/{subscription.maxInstances || 1}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowVideoGuide(true)}
                                        className="bg-white/5 hover:bg-white/10 border border-white/5 text-white font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs"
                                    >
                                        <Play size={14} strokeWidth={3} className="text-red-500" fill="currentColor" />
                                        <span className="hidden md:inline">How to Launch My First Agent</span>
                                    </button>
                                    <button
                                        onClick={handleCreateAgent}
                                        className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 md:px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/20 flex items-center gap-2 text-xs"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                        <span>New Agent</span>
                                    </button>
                                </div>
                            </div>


                        </header>

                        {/* Free trial paused banner */}
                        {(!subscription || subscription?.plan === 'Free') && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-300">🚧 Free trial paused due to high demand</p>
                                        <p className="text-[11px] text-amber-200/60 leading-relaxed">Activate a plan to get <strong className="text-amber-200">$10 in free AI credits</strong> and unlock unlimited messages + 24/7 hosting for your agents.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/billing')}
                                    className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black px-5 py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-amber-900/20"
                                >
                                    <Zap size={14} strokeWidth={3} />
                                    Activate Plan — Get $10 Free
                                </button>
                            </div>
                        )}

                        {agents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
                                    <Bot size={36} className="text-white/20" />
                                </div>
                                <h2 className="text-xl font-black uppercase italic tracking-tight mb-2 text-white/60">How to Launch Your First Agent</h2>
                                <p className="text-white/30 text-sm max-w-md mb-8">Watch the quick tutorial below, then click <strong className="text-white/60">"Launch"</strong> to create your first AI agent — ready in seconds.</p>

                                {/* Embedded tutorial video */}
                                <div className="w-full max-w-2xl mb-8">
                                    {/* Desktop: landscape video */}
                                    <div className="hidden md:block">
                                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <iframe
                                                src="https://www.youtube.com/embed/BoQAmvbViAg"
                                                title="How to Launch Your First Agent"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    {/* Mobile: vertical short */}
                                    <div className="md:hidden">
                                        <div style={{ position: 'relative', paddingBottom: '177.78%', height: 0, borderRadius: '16px', overflow: 'hidden', maxWidth: '280px', margin: '0 auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <iframe
                                                src="https://www.youtube.com/embed/HW83uf-BvBk"
                                                title="How to Launch Your First Agent"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateAgent}
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-green-900/20 flex items-center gap-2 text-sm"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                    Create My First Agent
                                </button>
                                <p className="text-[10px] text-white/25 mt-3">Activate a plan to get $10 in free credits • Upgrade to unlock unlimited agents</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {agents.map(agent => (
                                    <AgentCard
                                        key={agent.id}
                                        agent={agent}
                                        onEdit={() => setEditingAgent(agent)}
                                        onDelete={() => deleteAgent(agent.id)}
                                        onToggle={() => toggleBot(agent.id, agent.status)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Agent Limit Modal */}
                        <AnimatePresence>
                            {showLimitModal && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                                    onClick={() => setShowLimitModal(false)}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        className="glass-panel rounded-2xl md:rounded-3xl w-full max-w-md border border-white/10 overflow-hidden"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6 border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                                                    <ShieldAlert size={24} className="text-red-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-black uppercase italic tracking-tight text-white">Upgrade to Deploy</h2>
                                                    <p className="text-white/40 text-sm">Pick a plan to run your agent</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <p className="text-white/60 text-sm leading-relaxed">
                                                Your agent has been saved! To <strong className="text-white">deploy and run</strong> it, choose a plan. Paid plans include more agents, unlimited messages, and priority support.
                                            </p>
                                            <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between border border-white/5">
                                                <div>
                                                    <span className="text-white/40 text-xs">Current Plan</span>
                                                    <p className="text-white text-lg font-black">{subscription?.plan || 'Free'}</p>
                                                </div>
                                                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                                    <Rocket size={20} className="text-orange-400" />
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setShowLimitModal(false)}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-bold py-3 rounded-xl transition-all text-sm"
                                                >
                                                    Close
                                                </button>
                                                <button
                                                    onClick={() => { setShowLimitModal(false); navigate('/billing'); }}
                                                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-yellow-900/20"
                                                >
                                                    <Zap size={16} strokeWidth={3} />
                                                    Pick a Plan
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Video Guide Popup */}
                        <AnimatePresence>
                            {showVideoGuide && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                                    onClick={() => setShowVideoGuide(false)}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        className="glass-panel rounded-2xl md:rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-white/10"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="p-6 md:p-8">
                                            <div className="flex items-center justify-between mb-6">
                                                <div>
                                                    <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">How to Set Up Your First Agent</h2>
                                                    <p className="text-white/40 text-sm mt-1">Watch the video guide to get started quickly.</p>
                                                </div>
                                                <button
                                                    onClick={() => setShowVideoGuide(false)}
                                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white p-2 rounded-xl transition-all"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            {/* Desktop: landscape video */}
                                            <div className="hidden md:block">
                                                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '12px', overflow: 'hidden' }}>
                                                    <iframe
                                                        src="https://www.youtube.com/embed/BoQAmvbViAg"
                                                        title="OpenClaw Setup Guide"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Mobile: vertical short */}
                                            <div className="md:hidden">
                                                <div style={{ position: 'relative', paddingBottom: '177.78%', height: 0, borderRadius: '12px', overflow: 'hidden', maxWidth: '280px', margin: '0 auto' }}>
                                                    <iframe
                                                        src="https://www.youtube.com/embed/HW83uf-BvBk"
                                                        title="OpenClaw Setup Guide"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        className="glass-panel flex flex-col md:flex-row min-h-[60vh] md:min-h-[85vh] rounded-2xl md:rounded-[2.5rem] overflow-hidden border border-white/5"
                    >
                        {/* Editor Sidebar */}
                        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/5 bg-black/20 p-4 md:p-8 flex flex-col gap-4 md:gap-8 shrink-0">
                            <div>
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-6 pl-2">Setup Steps</div>
                                <nav className="flex md:flex-col gap-0 overflow-x-auto pb-2 md:pb-0 custom-scrollbar -mx-2 px-2 md:mx-0 md:px-0">
                                    {[
                                        { id: 'provider', label: 'Model', icon: <Cpu size={16} />, required: true },
                                        { id: 'channels', label: 'Channels', icon: <Share2 size={16} />, required: true },
                                        { id: 'skills', label: 'Skills', icon: <Zap size={16} />, required: false },
                                        { id: 'tools', label: 'Tools', icon: <Terminal size={16} />, required: false },
                                        { id: 'workspace', label: 'Workspace', icon: <HardDrive size={16} />, required: false },
                                        { id: 'automation', label: 'Automation', icon: <Clock size={16} />, required: false },
                                        { id: 'system', label: 'System', icon: <Settings size={16} />, required: false },
                                        { id: 'deploy', label: 'Deploy', icon: <Rocket size={16} />, required: true },
                                    ].map((tab, idx, arr) => {
                                        const tabIds = ['provider', 'channels', 'skills', 'tools', 'workspace', 'automation', 'system', 'deploy'];
                                        const isActive = activeTab === tab.id;
                                        const activeIdx = tabIds.indexOf(activeTab);
                                        const isPast = idx < activeIdx;
                                        const isLast = idx === arr.length - 1;
                                        return (
                                            <div key={tab.id} className="flex md:flex-col items-center md:items-stretch">
                                                <button
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={cn(
                                                        "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold text-[10px] md:text-[11px] transition-all text-left uppercase tracking-widest whitespace-nowrap relative w-full",
                                                        isActive
                                                            ? "text-white bg-primary/10 border border-primary/30 shadow-lg shadow-primary/5"
                                                            : isPast
                                                                ? "text-green-400/60 hover:text-white hover:bg-white/5"
                                                                : "text-white/30 hover:text-white hover:bg-white/5"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black shrink-0 border",
                                                        isActive
                                                            ? "bg-primary/20 border-primary/50 text-primary"
                                                            : isPast
                                                                ? "bg-green-500/10 border-green-500/30 text-green-400"
                                                                : "bg-white/5 border-white/10 text-white/30"
                                                    )}>
                                                        {isPast ? '✓' : idx + 1}
                                                    </span>
                                                    <div className="hidden md:flex flex-col gap-0.5 flex-1 min-w-0">
                                                        <span>{tab.label}</span>
                                                        <span className={cn(
                                                            "text-[8px] tracking-wider normal-case font-medium",
                                                            tab.required ? "text-green-400/50" : "text-white/20"
                                                        )}>
                                                            {tab.id === 'deploy' ? 'final step' : tab.required ? 'required' : 'optional'}
                                                        </span>
                                                    </div>
                                                    <span className="md:hidden">{tab.label}</span>
                                                </button>
                                                {/* Connecting line between steps (desktop only) */}
                                                {!isLast && (
                                                    <div className="hidden md:flex justify-center py-0">
                                                        <div className={cn(
                                                            "w-px h-3",
                                                            isPast ? "bg-green-500/30" : "bg-white/10"
                                                        )} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </nav>
                            </div>
                        </aside>

                        {/* Editor Content */}
                        <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto custom-scrollbar relative">
                            <header className="mb-12 flex items-center justify-between">
                                <div className="flex-1 max-w-2xl">
                                    <button onClick={() => setEditingAgent(null)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest mb-6">
                                        <ChevronLeft size={14} /> Back to list
                                    </button>
                                    <input
                                        value={editingAgent.name}
                                        onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                        maxLength={50}
                                        className="bg-transparent text-2xl md:text-4xl lg:text-5xl font-black text-white outline-none w-full placeholder:text-white/10 uppercase italic tracking-tighter mb-4"
                                        placeholder="AGENT NAME"
                                    />
                                    <textarea
                                        value={editingAgent.description}
                                        onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                                        placeholder="Agent description..."
                                        className="bg-transparent text-white/50 text-base font-medium outline-none w-full resize-none h-12"
                                    />
                                </div>
                            </header>

                            <div className="space-y-16 pb-32">
                                {activeTab === 'provider' && (
                                    <Section icon={<Layers className="text-green-500" />} title="Model" desc="Configure the LLM engine.">
                                        {/* API Key Mode Selector */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 mb-10">
                                            <button
                                                onClick={() => setEditingAgent({ ...editingAgent, apiKeyMode: 'platform_credits' })}
                                                className={cn(
                                                    "p-6 rounded-2xl border-2 transition-all text-left group relative",
                                                    editingAgent.apiKeyMode === 'platform_credits'
                                                        ? "border-emerald-500/50 bg-emerald-500/5"
                                                        : "border-white/5 bg-white/2 hover:border-white/10"
                                                )}
                                            >
                                                {editingAgent.apiKeyMode === 'platform_credits' && (
                                                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-full tracking-wider">Recommended</span>
                                                )}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                                        editingAgent.apiKeyMode === 'platform_credits' ? "bg-emerald-500/15" : "bg-white/5"
                                                    )}>
                                                        <Sparkles size={18} className={editingAgent.apiKeyMode === 'platform_credits' ? 'text-emerald-400' : 'text-white/30'} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-sm uppercase tracking-tight">Use Our AI Credits</h4>
                                                        <p className="text-[10px] text-emerald-400/80 font-bold">$10 included with your plan</p>
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-white/50 leading-relaxed">No API key needed — we handle everything. Credits deducted per message based on model cost.</p>
                                                {editingAgent.apiKeyMode === 'platform_credits' && subscription && (
                                                    <div className="mt-3 pt-3 border-t border-emerald-500/10 flex items-center justify-between">
                                                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Balance</span>
                                                        <span className="text-lg font-black text-emerald-400">${subscription?.creditBalance?.toFixed(4) ?? '0.0000'}</span>
                                                    </div>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setEditingAgent({ ...editingAgent, apiKeyMode: 'own_key' })}
                                                className={cn(
                                                    "p-6 rounded-2xl border-2 transition-all text-left group",
                                                    editingAgent.apiKeyMode === 'own_key'
                                                        ? "border-blue-500/50 bg-blue-500/5"
                                                        : "border-white/5 bg-white/2 hover:border-white/10"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                                        editingAgent.apiKeyMode === 'own_key' ? "bg-blue-500/15" : "bg-white/5"
                                                    )}>
                                                        <Lock size={18} className={editingAgent.apiKeyMode === 'own_key' ? 'text-blue-400' : 'text-white/30'} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-sm uppercase tracking-tight">Bring Your Own Key</h4>
                                                        <p className="text-[10px] text-blue-400/80 font-bold">Any provider, unlimited usage</p>
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-white/50 leading-relaxed">Use your own API key from OpenRouter, OpenAI, Anthropic, or any supported provider. No credit tracking or limits.</p>
                                            </button>
                                        </div>

                                        {/* Platform Credits Mode */}
                                        {editingAgent.apiKeyMode === 'platform_credits' && (
                                            <div className="space-y-6">
                                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                                <Sparkles size={14} className="text-emerald-400" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-white/40">Powered by OpenRouter</p>
                                                                <p className="text-xs text-emerald-400/80 font-bold">✨ AI credits included — no API key needed!</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex items-center gap-3">
                                                            <div>
                                                                <span className="text-xl font-black text-emerald-400">${subscription?.creditBalance?.toFixed(4) ?? '0.0000'}</span>
                                                                <p className="text-[9px] text-white/30 uppercase tracking-widest">remaining</p>
                                                            </div>
                                                            <button
                                                                onClick={() => navigate('/topup')}
                                                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-[10px] uppercase tracking-widest flex items-center gap-1.5"
                                                            >
                                                                <Plus size={12} /> Top Up
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Model selector with pricing */}
                                                <InputWrapper label="Model" full>
                                                    <input
                                                        value={editingAgent.model}
                                                        onChange={e => setEditingAgent({ ...editingAgent, model: e.target.value })}
                                                        className="input-modern w-full font-mono mb-3"
                                                        placeholder="Type a custom model ID or select below..."
                                                    />
                                                    {fetchedModels.length > 0 && (
                                                        <div className="relative mb-3">
                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                                            <input
                                                                value={modelSearch}
                                                                onChange={e => setModelSearch(e.target.value)}
                                                                className="input-modern w-full pl-9 py-2.5 text-xs"
                                                                placeholder="Search models..."
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl p-3">
                                                        {isFetchingModels ? (
                                                            <div className="flex items-center justify-center py-8 gap-3 text-white/40">
                                                                <Loader2 size={16} className="animate-spin" />
                                                                <span className="text-xs font-medium">Loading available models...</span>
                                                            </div>
                                                        ) : fetchedModels.length > 0 ? (
                                                            fetchedModels
                                                                .filter(m => {
                                                                    if (!modelSearch.trim()) return true;
                                                                    const q = modelSearch.toLowerCase();
                                                                    return m.name?.toLowerCase().includes(q) || m.id?.toLowerCase().includes(q);
                                                                })
                                                                .map(m => {
                                                                    const inputCost = m.promptPrice ? (m.promptPrice * 1_000_000).toFixed(2) : null;
                                                                    const outputCost = m.completionPrice ? (m.completionPrice * 1_000_000).toFixed(2) : null;
                                                                    const isFree = inputCost === '0.00' && outputCost === '0.00';
                                                                    return (
                                                                        <button
                                                                            key={m.id}
                                                                            onClick={() => { setEditingAgent({ ...editingAgent, model: m.id }); setModelSearch(''); }}
                                                                            className={cn(
                                                                                "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-all text-xs",
                                                                                editingAgent.model === m.id
                                                                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-white"
                                                                                    : "hover:bg-white/5 text-white/60 hover:text-white"
                                                                            )}
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <span className="font-bold">{m.name}</span>
                                                                                <span className="text-white/30 ml-2 font-mono text-[10px] hidden sm:inline">{m.id}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                                {isFree ? (
                                                                                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">FREE</span>
                                                                                ) : inputCost ? (
                                                                                    <span className="text-[7px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-full whitespace-nowrap" title={`Input: $${inputCost}/1M tokens | Output: $${outputCost}/1M tokens`}>
                                                                                        In ${inputCost} · Out ${outputCost || '?'}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[8px] font-black uppercase tracking-widest text-green-400/60 bg-green-400/5 px-2 py-0.5 rounded-full">LIVE</span>
                                                                                )}
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })
                                                        ) : (
                                                            <div className="text-center py-8 text-white/30 text-xs">
                                                                Models will load automatically via your platform credits.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-white/20 mt-2 font-medium">
                                                        {fetchedModels.length > 0
                                                            ? `Showing ${fetchedModels.length} models. Prices are per 1M input tokens. Hover for full pricing.`
                                                            : 'Models auto-load from OpenRouter.'} You can also type any custom model ID.
                                                    </p>
                                                </InputWrapper>
                                            </div>
                                        )}

                                        {/* Own Key Mode — existing provider/key/model UI */}
                                        {editingAgent.apiKeyMode === 'own_key' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <InputWrapper label="Provider">
                                                    <select
                                                        value={editingAgent.provider}
                                                        onChange={e => setEditingAgent({ ...editingAgent, provider: e.target.value })}
                                                        className="input-modern w-full"
                                                    >
                                                        {PROVIDERS.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </InputWrapper>
                                                <InputWrapper label="Model" full>
                                                    <input
                                                        value={editingAgent.model}
                                                        onChange={e => setEditingAgent({ ...editingAgent, model: e.target.value })}
                                                        className="input-modern w-full font-mono mb-3"
                                                        placeholder="Type a custom model ID or select below..."
                                                    />
                                                    {fetchedModels.length > 0 && (
                                                        <div className="relative mb-3">
                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                                            <input
                                                                value={modelSearch}
                                                                onChange={e => setModelSearch(e.target.value)}
                                                                className="input-modern w-full pl-9 py-2.5 text-xs"
                                                                placeholder="Search models..."
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl p-3">
                                                        {isFetchingModels ? (
                                                            <div className="flex items-center justify-center py-8 gap-3 text-white/40">
                                                                <Loader2 size={16} className="animate-spin" />
                                                                <span className="text-xs font-medium">Fetching models from {editingAgent.provider}...</span>
                                                            </div>
                                                        ) : fetchedModels.length > 0 ? (
                                                            <div className="space-y-0.5">
                                                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-green-400/60 px-3 py-2 sticky top-0 bg-[var(--bg-deep)] flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                                    Available Models ({fetchedModels.filter(m => { if (!modelSearch.trim()) return true; const q = modelSearch.toLowerCase(); return m.name?.toLowerCase().includes(q) || m.id?.toLowerCase().includes(q); }).length})
                                                                </div>
                                                                {fetchedModels
                                                                    .filter(m => {
                                                                        if (!modelSearch.trim()) return true;
                                                                        const q = modelSearch.toLowerCase();
                                                                        return m.name?.toLowerCase().includes(q) || m.id?.toLowerCase().includes(q);
                                                                    })
                                                                    .map(m => (
                                                                        <button
                                                                            key={m.id}
                                                                            onClick={() => { setEditingAgent({ ...editingAgent, model: m.id }); setModelSearch(''); }}
                                                                            className={cn(
                                                                                "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-all text-xs",
                                                                                editingAgent.model === m.id
                                                                                    ? "bg-green-500/10 border border-green-500/30 text-white"
                                                                                    : "hover:bg-white/5 text-white/60 hover:text-white"
                                                                            )}
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <span className="font-bold">{m.name}</span>
                                                                                <span className="text-white/30 ml-2 font-mono text-[10px] hidden sm:inline">{m.id}</span>
                                                                            </div>
                                                                            <span className="text-[8px] font-black uppercase tracking-widest text-green-400/60 bg-green-400/5 px-2 py-0.5 rounded-full shrink-0 ml-2">LIVE</span>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8 text-white/30 text-xs">
                                                                {editingAgent.apiKey
                                                                    ? 'No models found. Check your API key or try the Fetch button below.'
                                                                    : 'Enter your API key to auto-load available models.'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-white/20 mt-2 font-medium">
                                                        {fetchedModels.length > 0
                                                            ? `Showing ${fetchedModels.length} live models from ${editingAgent.provider}.`
                                                            : `Models auto-load when you enter your API key.`
                                                        } You can also type any custom model ID.
                                                    </p>
                                                </InputWrapper>
                                                <InputWrapper label="API Secret Key" full>
                                                    <div className="flex gap-3">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.apiKey}
                                                            onChange={e => setEditingAgent({ ...editingAgent, apiKey: e.target.value })}
                                                            className="input-modern w-full font-mono"
                                                            placeholder="Enter your API key here..."
                                                        />
                                                        <button
                                                            onClick={() => fetchDynamicModels()}
                                                            disabled={isFetchingModels || !editingAgent.apiKey}
                                                            className={cn(
                                                                "shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                                                editingAgent.apiKey
                                                                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                                                    : "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                                                            )}
                                                        >
                                                            {isFetchingModels ? <Loader2 size={14} className="animate-spin" /> : 'Fetch Models'}
                                                        </button>
                                                    </div>
                                                    {modelFetchError && (
                                                        <p className="text-[10px] text-red-400 mt-2">{modelFetchError}</p>
                                                    )}
                                                    {fetchedModels.length > 0 && (
                                                        <p className="text-[10px] text-green-400 mt-2">✓ Found {fetchedModels.length} models from {editingAgent.provider}</p>
                                                    )}
                                                </InputWrapper>
                                                {editingAgent.provider === 'vllm' && (
                                                    <InputWrapper label="Base URL (vLLM / Local)" full>
                                                        <input
                                                            value={editingAgent.apiBase || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, apiBase: e.target.value })}
                                                            className="input-modern w-full font-mono"
                                                            placeholder="http://localhost:8000/v1"
                                                        />
                                                    </InputWrapper>
                                                )}
                                            </div>
                                        )}
                                    </Section>
                                )}

                                {activeTab === 'channels' && (
                                    <Section icon={<MessageSquare className="text-white" />} title="Channels" desc="Connect messaging platforms.">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
                                            <ChannelInput
                                                name="Telegram" icon={ICONS.telegram}
                                                badge="Recommended"
                                                enabled={editingAgent.telegramEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, telegramEnabled: v })}
                                            >
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 p-4 rounded-2xl text-[11px] text-white/60 leading-relaxed border border-white/5">
                                                        Get a token from <a href="https://t.me/botfather" target="_blank" className="text-primary hover:underline">@BotFather</a>. Telegram gives your bot its own dedicated identity — users message the bot directly, no personal number needed.
                                                    </div>
                                                    <InputWrapper label="Bot Token">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.telegramToken || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, telegramToken: e.target.value })}
                                                            className="input-modern w-full font-mono text-xs"
                                                            placeholder="123456:AABBCC..."
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="Allowed Users (IDs)">
                                                        <input
                                                            value={editingAgent.telegramAllowFrom || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, telegramAllowFrom: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                            placeholder="e.g. 1234567, 7654321"
                                                        />
                                                    </InputWrapper>
                                                </div>
                                            </ChannelInput>

                                            <ChannelInput
                                                name="Discord" icon={ICONS.discord}
                                                enabled={editingAgent.discordEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, discordEnabled: v })}
                                            >
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 p-4 rounded-2xl text-[11px] text-white/60 leading-relaxed border border-white/5">
                                                        Create a bot at <a href="https://discord.com/developers" target="_blank" className="text-primary hover:underline">Discord Portal</a>. Enable <span className="text-white font-bold">Message Content Intent</span>.
                                                    </div>
                                                    <InputWrapper label="Bot Token">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.discordToken || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, discordToken: e.target.value })}
                                                            className="input-modern w-full font-mono text-xs"
                                                        />
                                                    </InputWrapper>
                                                </div>
                                            </ChannelInput>

                                            <ChannelInput
                                                name="WhatsApp" icon={ICONS.whatsapp}
                                                enabled={editingAgent.whatsappEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, whatsappEnabled: v })}
                                            >
                                                <div className="space-y-4">
                                                    <div className="bg-amber-500/10 p-4 rounded-2xl text-[11px] text-amber-200/80 leading-relaxed border border-amber-500/20">
                                                        <span className="font-bold text-amber-300">⚠️ Important:</span> The phone number you link will <span className="font-bold text-white">become the bot</span> — it will auto-reply to all incoming messages. We strongly recommend using a <span className="font-bold text-white">dedicated/new number</span> instead of your personal one. For a simpler setup, consider <span className="font-bold text-white">Telegram</span> (recommended).
                                                    </div>
                                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col items-center gap-6">
                                                        <div className="text-center space-y-2">
                                                            <div className="text-xs font-black uppercase text-white">Device Linking</div>
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className={cn(
                                                                    "w-2 h-2 rounded-full",
                                                                    waLinked ? "bg-green-500 shadow-lg shadow-green-500/30" :
                                                                        qrCode ? "bg-yellow-500 animate-pulse" : "bg-white/20"
                                                                )} />
                                                                <span className={cn(
                                                                    "text-[10px] font-black uppercase tracking-widest",
                                                                    waLinked ? "text-green-400" :
                                                                        qrCode ? "text-yellow-400" : "text-white/40"
                                                                )}>
                                                                    {waLinked ? 'Connected' :
                                                                        qrCode ? 'Scan QR to Link' : 'Not Linked'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="w-48 h-48 bg-white rounded-3xl p-4 flex items-center justify-center relative overflow-hidden group">
                                                            {qrCode ? (
                                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} alt="WhatsApp QR" className="w-full h-full" />
                                                            ) : waLinked ? (
                                                                <div className="flex flex-col items-center gap-2 text-green-600">
                                                                    <CheckCircle size={48} />
                                                                    <span className="text-[10px] font-black uppercase">Linked</span>
                                                                </div>
                                                            ) : editingAgent.status === 'running' ? (
                                                                <div className="flex flex-col items-center gap-2 text-orange-500">
                                                                    <Loader2 size={48} className="animate-spin" />
                                                                    <span className="text-[10px] font-black uppercase text-center">Waiting for QR...</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-2 text-black/20">
                                                                    <QrCode size={48} />
                                                                    <span className="text-[10px] font-black uppercase text-center">Deploy agent first</span>
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={async () => {
                                                                    if (waLinked) {
                                                                        // If linked, offer to reset and get fresh QR
                                                                        if (confirm('WhatsApp is already linked. Do you want to unlink and get a new QR code?')) {
                                                                            try {
                                                                                await fetch(`/api/bot/qr-refresh/${editingAgent.id}`, {
                                                                                    method: 'POST',
                                                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                                                });
                                                                                setWaLinked(false);
                                                                                setQrCode(null);
                                                                                // Wait a moment then poll for QR
                                                                                setTimeout(() => fetchQr(editingAgent.id), 5000);
                                                                            } catch (e) { }
                                                                        }
                                                                    } else {
                                                                        // Just refresh the QR
                                                                        fetchQr(editingAgent.id);
                                                                    }
                                                                }}
                                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white"
                                                            >
                                                                <RefreshCw size={24} />
                                                                <span className="text-[10px] font-black uppercase tracking-widest">{waLinked ? 'Reset & Re-scan' : 'Refresh QR'}</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <InputWrapper label="Allowed Contacts (+CountryCode)">
                                                        <input
                                                            value={editingAgent.whatsappAllowFrom || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, whatsappAllowFrom: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                            placeholder="e.g. +123456789, +987654321"
                                                        />
                                                    </InputWrapper>
                                                </div>
                                            </ChannelInput>

                                            <ChannelInput
                                                name="Feishu" icon={ICONS.feishu}
                                                enabled={editingAgent.feishuEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, feishuEnabled: v })}
                                            >
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <InputWrapper label="App ID">
                                                        <input
                                                            value={editingAgent.feishuAppId || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, feishuAppId: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                            placeholder="cli_..."
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="App Secret">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.feishuAppSecret || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, feishuAppSecret: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="Allow From (User IDs)" full>
                                                        <input
                                                            value={editingAgent.feishuAllowFrom || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, feishuAllowFrom: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                            placeholder="ou_..., ou_..."
                                                        />
                                                    </InputWrapper>
                                                </div>
                                            </ChannelInput>

                                            <ChannelInput
                                                name="Slack" icon={ICONS.slack}
                                                enabled={editingAgent.slackEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, slackEnabled: v })}
                                            >
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 p-4 rounded-2xl text-[11px] text-white/60 leading-relaxed border border-white/5">
                                                        Create a Slack app at <a href="https://api.slack.com/apps" target="_blank" className="text-primary hover:underline">api.slack.com</a>. Enable <span className="text-white font-bold">Socket Mode</span> and add the <span className="text-white font-bold">app_mentions:read</span> and <span className="text-white font-bold">chat:write</span> scopes. Generate both a Bot Token (xoxb-) and an App-Level Token (xapp-).
                                                    </div>
                                                    <InputWrapper label="Bot Token (xoxb-...)">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.slackBotToken || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, slackBotToken: e.target.value })}
                                                            className="input-modern w-full font-mono text-xs"
                                                            placeholder="xoxb-..."
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="App Token (xapp-... for Socket Mode)">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.slackAppToken || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, slackAppToken: e.target.value })}
                                                            className="input-modern w-full font-mono text-xs"
                                                            placeholder="xapp-..."
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="Allowed Users (IDs)">
                                                        <input
                                                            value={editingAgent.slackAllowFrom || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, slackAllowFrom: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                            placeholder="e.g. U01234567, U07654321"
                                                        />
                                                    </InputWrapper>
                                                </div>
                                            </ChannelInput>

                                            <ChannelInput
                                                name="MS Teams" icon={ICONS.teams}
                                                enabled={editingAgent.teamsEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, teamsEnabled: v })}
                                            >
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 p-4 rounded-2xl text-[11px] text-white/60 leading-relaxed border border-white/5">
                                                        <p className="text-white font-bold mb-2">📋 How to get your Teams credentials:</p>
                                                        <ol className="list-decimal list-inside space-y-1.5">
                                                            <li>Go to <a href="https://portal.azure.com" target="_blank" className="text-primary hover:underline">Azure Portal</a> → search <strong className="text-white">"Bot Services"</strong> → Create → <strong className="text-white">Azure Bot</strong></li>
                                                            <li>Choose pricing tier <strong className="text-white">F0 (Free)</strong> → Create</li>
                                                            <li>Open the bot → <strong className="text-white">Configuration</strong> → copy the <strong className="text-white">Microsoft App ID</strong></li>
                                                            <li>Click <strong className="text-white">"Manage Password"</strong> → <strong className="text-white">"New client secret"</strong> → copy the <strong className="text-white">Value</strong> (this is your App Password)</li>
                                                            <li>Set <strong className="text-white">Messaging endpoint</strong> to: <code className="text-white/90 bg-white/10 px-1.5 py-0.5 rounded">https://openclaw-host.com/api/teams/messages</code></li>
                                                            <li>Go to <strong className="text-white">Channels</strong> → click <strong className="text-white">Microsoft Teams</strong> → Save</li>
                                                        </ol>
                                                        <p className="mt-2 text-[10px] text-white/40">After deploying, users can find your bot by name in Microsoft Teams and send it a message.</p>
                                                    </div>
                                                    <InputWrapper label="Microsoft App ID">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.teamsAppId || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, teamsAppId: e.target.value })}
                                                            className="input-modern w-full font-mono text-xs"
                                                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="App Password (Client Secret)">
                                                        <input
                                                            type="password"
                                                            value={editingAgent.teamsAppPassword || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, teamsAppPassword: e.target.value })}
                                                            className="input-modern w-full font-mono text-xs"
                                                            placeholder="Your app password..."
                                                        />
                                                    </InputWrapper>
                                                    <InputWrapper label="Allowed Users (IDs)">
                                                        <input
                                                            value={editingAgent.teamsAllowFrom || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, teamsAllowFrom: e.target.value })}
                                                            className="input-modern w-full text-xs"
                                                            placeholder="Leave empty to allow everyone"
                                                        />
                                                    </InputWrapper>
                                                </div>
                                            </ChannelInput>
                                        </div>
                                    </Section>
                                )}

                                {activeTab === 'tools' && (
                                    <Section icon={<Terminal className="text-white" />} title="Tools" desc="Enable capabilities.">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
                                            <ToolCard
                                                title="Web Browser" icon={<Globe size={20} />}
                                                desc="Full internet access via headless browser."
                                                checked={editingAgent.browserEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, browserEnabled: v })}
                                            />
                                            <ToolCard
                                                title="System Shell" icon={<Terminal size={20} />}
                                                desc="Execute commands on the host system."
                                                checked={editingAgent.shellEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, shellEnabled: v })}
                                            />
                                            <ToolCard
                                                title="Tmux Persistence" icon={<Layers size={20} />}
                                                desc="Enable persistent terminal sessions."
                                                checked={editingAgent.tmuxEnabled}
                                                onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, tmuxEnabled: v })}
                                            />
                                            <ToolCard
                                                title="Brave Search" icon={<Search size={20} />}
                                                desc="Real-time web search integration."
                                                checked={!!editingAgent.webSearchApiKey}
                                            >
                                                <input
                                                    type="password"
                                                    value={editingAgent.webSearchApiKey || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, webSearchApiKey: e.target.value })}
                                                    className="input-modern w-full text-[10px] mt-2"
                                                    placeholder="Enter Search API Key..."
                                                />
                                            </ToolCard>
                                            <ToolCard
                                                title="Firecrawl" icon={<Sparkles size={20} />}
                                                desc="Advanced web scraping for summarization."
                                                checked={!!editingAgent.firecrawlApiKey}
                                            >
                                                <input
                                                    type="password"
                                                    value={editingAgent.firecrawlApiKey || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, firecrawlApiKey: e.target.value })}
                                                    className="input-modern w-full text-[10px] mt-2"
                                                    placeholder="Firecrawl API Key..."
                                                />
                                            </ToolCard>
                                            <ToolCard
                                                title="Apify" icon={<Activity size={20} />}
                                                desc="Cloud tools and data extraction."
                                                checked={!!editingAgent.apifyApiToken}
                                            >
                                                <input
                                                    type="password"
                                                    value={editingAgent.apifyApiToken || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, apifyApiToken: e.target.value })}
                                                    className="input-modern w-full text-[10px] mt-2"
                                                    placeholder="Apify API Token..."
                                                />
                                            </ToolCard>
                                            <ToolCard
                                                title="CAPTCHA Solver" icon={<Shield size={20} />}
                                                desc="Auto-solve reCAPTCHA, hCaptcha & Turnstile."
                                                checked={!!editingAgent.captchaApiKey}
                                            >
                                                <select
                                                    value={editingAgent.captchaProvider || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, captchaProvider: e.target.value })}
                                                    className="input-modern w-full text-[10px] mt-2"
                                                >
                                                    <option value="">Select Provider...</option>
                                                    <option value="capsolver">CapSolver (AI, fastest)</option>
                                                    <option value="2captcha">2Captcha (human workers)</option>
                                                    <option value="anticaptcha">Anti-Captcha (human workers)</option>
                                                </select>
                                                <input
                                                    type="password"
                                                    value={editingAgent.captchaApiKey || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, captchaApiKey: e.target.value })}
                                                    className="input-modern w-full text-[10px] mt-2"
                                                    placeholder="CAPTCHA API Key..."
                                                />
                                            </ToolCard>
                                            <ToolCard
                                                title="Browser Proxy" icon={<Globe size={20} />}
                                                desc="Route browser traffic through proxies to avoid IP bans."
                                                checked={!!editingAgent.proxyUrl}
                                            >
                                                <textarea
                                                    value={editingAgent.proxyUrl || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, proxyUrl: e.target.value })}
                                                    className="input-modern w-full text-[10px] mt-2 min-h-[60px] resize-y font-mono"
                                                    placeholder={"http://user:pass@host1:port\nhttp://user:pass@host2:port\nsocks5://host3:port"}
                                                    rows={3}
                                                />
                                                <p className="text-[9px] text-white/30 mt-1.5">One proxy per line. Multiple proxies are <strong className="text-white/50">rotated automatically</strong> each session. Use residential proxies for best results.</p>
                                            </ToolCard>
                                        </div>
                                    </Section>
                                )}

                                {activeTab === 'system' && (
                                    <Section icon={<Server className="text-white/40" />} title="System Tuning" desc="Configure security and performance.">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                                            <div className="col-span-full">
                                                <ToggleRow
                                                    icon={<Lock className="text-orange-500" />}
                                                    label="Workspace Isolation"
                                                    desc="Restrict file system access to the project directory."
                                                    checked={editingAgent.restrictToWorkspace}
                                                    onToggle={(v: boolean) => setEditingAgent({ ...editingAgent, restrictToWorkspace: v })}
                                                />
                                            </div>
                                            <InputWrapper label="Execution Step Limit">
                                                <input
                                                    type="number"
                                                    value={editingAgent.maxToolIterations}
                                                    onChange={e => setEditingAgent({ ...editingAgent, maxToolIterations: parseInt(e.target.value) })}
                                                    className="input-modern w-full font-mono"
                                                />
                                            </InputWrapper>
                                            <InputWrapper label="Gateway Listener Port">
                                                <input
                                                    type="number"
                                                    value={editingAgent.gatewayPort}
                                                    onChange={e => setEditingAgent({ ...editingAgent, gatewayPort: parseInt(e.target.value) })}
                                                    className="input-modern w-full font-mono"
                                                />
                                            </InputWrapper>
                                            <InputWrapper label="Agent Timezone">
                                                <select
                                                    value={editingAgent.timezone || 'UTC'}
                                                    onChange={e => setEditingAgent({ ...editingAgent, timezone: e.target.value })}
                                                    className="input-modern w-full"
                                                >
                                                    {[
                                                        'UTC',
                                                        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                                                        'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo', 'America/Mexico_City',
                                                        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Europe/Istanbul',
                                                        'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai',
                                                        'Asia/Tokyo', 'Asia/Seoul', 'Asia/Hong_Kong',
                                                        'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
                                                        'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
                                                    ].map(tz => (
                                                        <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                                                    ))}
                                                </select>
                                            </InputWrapper>
                                        </div>
                                    </Section>
                                )}

                                {activeTab === 'automation' && (
                                    <Section icon={<Clock className="text-amber-400" />} title="Automation" desc="Schedule recurring tasks and cron jobs.">
                                        <div className="space-y-6 mt-10">
                                            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <Clock size={18} className="text-amber-400" />
                                                    <h4 className="font-black text-sm text-white uppercase italic tracking-wide">Scheduled Messages</h4>
                                                </div>
                                                <p className="text-[11px] text-white/40 mb-6">Configure automated messages on a cron schedule. The agent will process each message as if it were sent by you.</p>
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <InputWrapper label="Cron Expression">
                                                            <input className="input-modern w-full font-mono" placeholder="0 9 * * *" />
                                                        </InputWrapper>
                                                        <InputWrapper label="Message" full>
                                                            <input className="input-modern w-full" placeholder="Check for new emails and summarize..." />
                                                        </InputWrapper>
                                                    </div>
                                                    <button className="px-6 py-3 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                                                        + Add Schedule
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                                                <h4 className="font-black text-xs text-white/40 uppercase tracking-widest mb-3">Chat Commands Reference</h4>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {['/status', '/new', '/reset', '/compact', '/think', '/verbose', '/usage', '/restart'].map(cmd => (
                                                        <div key={cmd} className="px-3 py-2 bg-white/5 rounded-xl text-[11px] font-mono text-cyan-400/80">{cmd}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </Section>
                                )}

                                {activeTab === 'skills' && (
                                    <Section icon={<Zap className="text-violet-400" />} title="Skills" desc="Enable bundled capabilities.">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                                            {[
                                                { name: 'Weather', desc: 'Real-time weather data and forecasts.', icon: <Search size={20} />, key: 'weatherEnabled' },
                                                { name: 'GitHub', desc: 'Interact with repos, PRs, issues, and code reviews.', icon: <Globe size={20} />, key: 'githubEnabled' },
                                                { name: 'Summarization', desc: 'Generate summaries of long documents and web pages.', icon: <FileText size={20} />, key: 'summarizeEnabled' },
                                                { name: 'Cron Scheduler', desc: 'Schedule recurring tasks, reminders and periodic actions.', icon: <Clock size={20} />, key: 'cronEnabled' },
                                                { name: 'Skill Creator', desc: 'Dynamically create new skills and capabilities.', icon: <Sparkles size={20} />, key: 'skillCreatorEnabled' },
                                                { name: 'tmux Sessions', desc: 'Manage persistent terminal sessions for long tasks.', icon: <Terminal size={20} />, key: 'tmuxEnabled' },
                                                { name: 'Web Browser', desc: 'Full headless Chrome for browsing and scraping.', icon: <Globe size={20} />, key: 'browserEnabled' },
                                                { name: 'System Shell', desc: 'Execute system commands and scripts.', icon: <Terminal size={20} />, key: 'shellEnabled' },
                                            ].map(skill => (
                                                <div key={skill.name} className={cn(
                                                    "p-6 rounded-2xl border transition-all",
                                                    (editingAgent as any)[skill.key] ? "bg-white/[0.02] border-primary/20" : "bg-transparent border-white/5 opacity-50"
                                                )}>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", (editingAgent as any)[skill.key] ? "bg-primary text-white" : "bg-white/5 text-white/20")}>
                                                            {skill.icon}
                                                        </div>
                                                        <Toggle checked={(editingAgent as any)[skill.key]} onChange={(v: boolean) => setEditingAgent({ ...editingAgent, [skill.key]: v })} />
                                                    </div>
                                                    <h4 className="font-black text-sm text-white uppercase italic tracking-tight mb-1">{skill.name}</h4>
                                                    <p className="text-[10px] text-white/40">{skill.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {activeTab === 'workspace' && (
                                    <WorkspaceTab
                                        configId={editingAgent.id}
                                        userId={(editingAgent as any).userId || user?.id}
                                        token={token}
                                        files={wsFiles}
                                        currentPath={wsPath}
                                        loading={wsLoading}
                                        preview={wsPreview}
                                        showNewFile={wsNewFile}
                                        newFileName={wsNewFileName}
                                        newFileContent={wsNewFileContent}
                                        dragOver={wsDragOver}
                                        setFiles={setWsFiles}
                                        setPath={setWsPath}
                                        setLoading={setWsLoading}
                                        setPreview={setWsPreview}
                                        setShowNewFile={setWsNewFile}
                                        setNewFileName={setWsNewFileName}
                                        setNewFileContent={setWsNewFileContent}
                                        setDragOver={setWsDragOver}
                                    />
                                )}

                                {activeTab === 'deploy' && (
                                    <Section title="Pre-Flight Check" subtitle="Review your agent configuration before deploying">
                                        <div className="space-y-4 max-w-2xl">
                                            {/* Model Check */}
                                            <div className={cn(
                                                "flex items-center gap-4 p-4 rounded-xl border",
                                                editingAgent.model
                                                    ? "border-green-500/20 bg-green-500/5"
                                                    : "border-yellow-500/20 bg-yellow-500/5"
                                            )}>
                                                <span className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                                    editingAgent.model ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                                                )}>
                                                    {editingAgent.model ? <Check size={16} /> : <Info size={16} />}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-black uppercase tracking-wider text-white/80">AI Model</div>
                                                    <div className="text-sm text-white/50 truncate">{editingAgent.model || 'No model selected'}</div>
                                                </div>
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                                                    editingAgent.model ? "text-green-400 bg-green-500/10" : "text-yellow-400 bg-yellow-500/10"
                                                )}>
                                                    {editingAgent.model ? 'Ready' : 'Required'}
                                                </span>
                                            </div>

                                            {/* Channels Check */}
                                            {(() => {
                                                const channels = [];
                                                if (editingAgent.telegramEnabled) channels.push('Telegram');
                                                if (editingAgent.discordEnabled) channels.push('Discord');
                                                if (editingAgent.whatsappEnabled) channels.push('WhatsApp');
                                                if (editingAgent.teamsEnabled) channels.push('MS Teams');
                                                const hasChannels = channels.length > 0;
                                                return (
                                                    <div className={cn(
                                                        "flex items-center gap-4 p-4 rounded-xl border",
                                                        hasChannels
                                                            ? "border-green-500/20 bg-green-500/5"
                                                            : "border-yellow-500/20 bg-yellow-500/5"
                                                    )}>
                                                        <span className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                                            hasChannels ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                                                        )}>
                                                            {hasChannels ? <Check size={16} /> : <Info size={16} />}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-black uppercase tracking-wider text-white/80">Channels</div>
                                                            <div className="text-sm text-white/50">{hasChannels ? channels.join(', ') : 'No channels connected'}</div>
                                                        </div>
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                                                            hasChannels ? "text-green-400 bg-green-500/10" : "text-yellow-400 bg-yellow-500/10"
                                                        )}>
                                                            {hasChannels ? 'Ready' : 'Required'}
                                                        </span>
                                                    </div>
                                                );
                                            })()}

                                            {/* API Key Mode */}
                                            <div className="flex items-center gap-4 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                                                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-500/20 text-green-400">
                                                    <Check size={16} />
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-black uppercase tracking-wider text-white/80">API Key</div>
                                                    <div className="text-sm text-white/50">
                                                        {editingAgent.apiKeyMode === 'platform_credits' ? 'Using platform credits' : 'Using own key'}
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full text-green-400 bg-green-500/10">
                                                    Ready
                                                </span>
                                            </div>

                                            {/* Optional features summary */}
                                            <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/5 text-white/30">
                                                    <Settings size={16} />
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-black uppercase tracking-wider text-white/80">Optional Features</div>
                                                    <div className="text-sm text-white/50">
                                                        {[
                                                            editingAgent.shellEnabled && 'Shell',
                                                            editingAgent.browserEnabled && 'Browser',
                                                            editingAgent.cronEnabled && 'Cron',
                                                            editingAgent.weatherEnabled && 'Weather',
                                                        ].filter(Boolean).join(', ') || 'None configured (can add later)'}
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full text-white/30 bg-white/5">
                                                    Optional
                                                </span>
                                            </div>

                                            {/* Deploy hint */}
                                            <div className="text-center pt-6">
                                                <p className="text-white/30 text-sm">
                                                    {editingAgent.model && (editingAgent.telegramEnabled || editingAgent.discordEnabled || editingAgent.whatsappEnabled)
                                                        ? '✅ Everything looks good! Hit Deploy Mission below to launch your agent.'
                                                        : '⚠️ Complete the required steps above before deploying.'}
                                                </p>
                                            </div>
                                        </div>
                                    </Section>
                                )}

                            </div>

                            {/* Floating Action Bar — Next/Back navigation */}
                            {(() => {
                                const tabIds = ['provider', 'channels', 'skills', 'tools', 'workspace', 'automation', 'system', 'deploy'];
                                const currentIdx = tabIds.indexOf(activeTab);
                                const isFirst = currentIdx === 0;
                                const isLast = activeTab === 'deploy';
                                return (
                                    <div className="fixed bottom-4 right-4 left-4 md:bottom-12 md:right-12 md:left-auto flex items-center gap-2 md:gap-4 z-50 justify-end">
                                        <button
                                            onClick={() => deleteAgent(editingAgent.id)}
                                            className="p-4 rounded-2xl bg-white/5 border border-white/5 text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                        {!isFirst && (
                                            <button
                                                onClick={() => setActiveTab(tabIds[currentIdx - 1])}
                                                className="px-4 md:px-6 py-3 md:py-5 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                                            >
                                                <ChevronLeft size={18} />
                                                <span className="font-black text-xs uppercase tracking-widest">Back</span>
                                            </button>
                                        )}
                                        {isLast ? (
                                            <button
                                                onClick={() => saveConfig(editingAgent)}
                                                disabled={isSaving}
                                                className="btn-primary-modern px-6 md:px-10 py-3 md:py-5 flex items-center gap-2 md:gap-3 shadow-2xl shadow-primary/20"
                                            >
                                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                                                <span className="font-black text-xs md:text-sm uppercase tracking-widest">Deploy Mission</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setActiveTab(tabIds[currentIdx + 1])}
                                                className="btn-primary-modern px-6 md:px-10 py-3 md:py-5 flex items-center gap-2 md:gap-3 shadow-2xl shadow-primary/20"
                                            >
                                                <span className="font-black text-xs md:text-sm uppercase tracking-widest">Next Step</span>
                                                <ChevronRight size={18} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </main>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}

// --- Workspace Tab Component ---
const FILE_ICONS: Record<string, any> = {
    json: <Code size={16} className="text-yellow-400" />,
    yaml: <Code size={16} className="text-blue-400" />,
    yml: <Code size={16} className="text-blue-400" />,
    py: <Code size={16} className="text-green-400" />,
    js: <Code size={16} className="text-amber-400" />,
    ts: <Code size={16} className="text-blue-500" />,
    txt: <FileText size={16} className="text-white/40" />,
    md: <FileText size={16} className="text-white/60" />,
    log: <FileText size={16} className="text-white/30" />,
    png: <Image size={16} className="text-pink-400" />,
    jpg: <Image size={16} className="text-pink-400" />,
    jpeg: <Image size={16} className="text-pink-400" />,
    gif: <Image size={16} className="text-pink-400" />,
    webp: <Image size={16} className="text-pink-400" />,
    svg: <Image size={16} className="text-orange-400" />,
};
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const TEXT_EXTS = ['json', 'yaml', 'yml', 'py', 'js', 'ts', 'txt', 'md', 'log', 'csv', 'html', 'css', 'xml', 'sh', 'bash', 'env', 'cfg', 'ini', 'toml'];

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function WorkspaceTab({ configId, userId, token, files, currentPath, loading, preview, showNewFile, newFileName, newFileContent, dragOver, setFiles, setPath, setLoading, setPreview, setShowNewFile, setNewFileName, setNewFileContent, setDragOver }: any) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = async (subPath?: string) => {
        setLoading(true);
        try {
            const q = subPath ? `?path=${encodeURIComponent(subPath)}` : '';
            const resp = await fetch(`/api/workspace/${configId}${q}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setFiles(data.files || []);
                setPath(subPath || '');
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { if (configId && !configId.startsWith('temp-')) fetchFiles(); }, [configId]);

    const uploadFiles = async (fileList: FileList) => {
        const fd = new FormData();
        Array.from(fileList).forEach(f => fd.append('files', f));
        if (currentPath) fd.append('path', currentPath);
        await fetch(`/api/workspace/${configId}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd,
        });
        fetchFiles(currentPath);
    };

    const createFile = async () => {
        if (!newFileName.trim()) return;
        await fetch(`/api/workspace/${configId}/create`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: newFileName, content: newFileContent, directory: currentPath || undefined }),
        });
        setShowNewFile(false);
        setNewFileName('');
        setNewFileContent('');
        fetchFiles(currentPath);
    };

    const deleteFile = async (filePath: string) => {
        if (!confirm('Delete this file?')) return;
        await fetch(`/api/workspace/${configId}/${filePath}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        fetchFiles(currentPath);
    };

    const previewFile = async (file: any) => {
        const ext = file.extension || '';
        if (IMAGE_EXTS.includes(ext)) {
            setPreview({ name: file.name, content: `/api/files/${userId}/${configId}/${file.path}`, type: 'image' });
        } else if (TEXT_EXTS.includes(ext) && file.size < 500000) {
            try {
                const resp = await fetch(`/api/files/${userId}/${configId}/${file.path}`);
                const text = await resp.text();
                setPreview({ name: file.name, content: text, type: 'text' });
            } catch { setPreview({ name: file.name, content: 'Failed to load', type: 'text' }); }
        }
    };

    const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

    if (configId?.startsWith('temp-')) {
        return (
            <Section icon={<HardDrive className="text-cyan-400" />} title="Workspace" desc="Manage your bot's files.">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <HardDrive size={32} className="text-white/20 mb-4" />
                    <p className="text-white/40 text-sm">Save the agent first to access its workspace.</p>
                </div>
            </Section>
        );
    }

    return (
        <Section icon={<HardDrive className="text-cyan-400" />} title="Workspace" desc="Manage your bot's files — upload cookies, configs, and more.">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 mt-6 mb-4">
                <button onClick={() => { setShowNewFile(true); setNewFileName(''); setNewFileContent(''); }}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-all uppercase tracking-wider">
                    <FilePlus size={14} /> New File
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold px-3 py-2 rounded-lg transition-all uppercase tracking-wider border border-primary/20">
                    <Upload size={14} /> Upload
                </button>
                <button onClick={() => fetchFiles(currentPath)}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold px-3 py-2 rounded-lg transition-all uppercase tracking-wider">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }} />
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[10px] font-bold text-white/30 mb-4 uppercase tracking-wider">
                <button onClick={() => fetchFiles('')} className="hover:text-white transition-colors">/</button>
                {pathParts.map((part: string, i: number) => (
                    <span key={i} className="flex items-center gap-1">
                        <ChevronRight size={10} />
                        <button onClick={() => fetchFiles(pathParts.slice(0, i + 1).join('/'))} className="hover:text-white transition-colors">{part}</button>
                    </span>
                ))}
            </div>

            {/* Drag & Drop Zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
                className={cn(
                    "rounded-2xl border-2 border-dashed transition-all min-h-[300px]",
                    dragOver ? "border-primary bg-primary/5" : "border-white/5 bg-black/20"
                )}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-white/30" size={28} />
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FolderOpen size={32} className="text-white/10 mb-3" />
                        <p className="text-white/30 text-xs">Empty workspace. Drag files here or use the buttons above.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {files.map((file: any) => (
                            <div key={file.path} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group/file">
                                {/* Icon */}
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                    {file.isDirectory ? <FolderOpen size={16} className="text-cyan-400" /> : (FILE_ICONS[file.extension] || <File size={16} className="text-white/30" />)}
                                </div>
                                {/* Name */}
                                <button
                                    onClick={() => file.isDirectory ? fetchFiles(file.path) : previewFile(file)}
                                    className="flex-1 text-left text-sm font-semibold text-white/80 hover:text-white truncate transition-colors">
                                    {file.name}
                                </button>
                                {/* Size */}
                                <span className="text-[10px] text-white/20 font-mono hidden md:block">{file.isDirectory ? '—' : formatBytes(file.size)}</span>
                                {/* Date */}
                                <span className="text-[10px] text-white/20 hidden lg:block">{new Date(file.modified).toLocaleDateString()}</span>
                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                    {!file.isDirectory && (TEXT_EXTS.includes(file.extension) || IMAGE_EXTS.includes(file.extension)) && (
                                        <button onClick={() => previewFile(file)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Preview">
                                            <Eye size={14} className="text-white/40" />
                                        </button>
                                    )}
                                    {!file.isDirectory && (
                                        <a href={`/api/files/${userId}/${configId}/${file.path}`} download className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Download">
                                            <Download size={14} className="text-white/40" />
                                        </a>
                                    )}
                                    <button onClick={() => deleteFile(file.path)} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete">
                                        <Trash2 size={14} className="text-red-400/60" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* New File Modal */}
            {showNewFile && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowNewFile(false)}>
                    <div className="bg-[#161618] border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Create File</h3>
                            <button onClick={() => setShowNewFile(false)} className="text-white/30 hover:text-white"><X size={18} /></button>
                        </div>
                        <input
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            placeholder="filename.json"
                            className="input-modern w-full text-sm"
                            autoFocus
                        />
                        <textarea
                            value={newFileContent}
                            onChange={e => setNewFileContent(e.target.value)}
                            placeholder="File content (optional)..."
                            className="input-modern w-full text-sm font-mono h-40 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowNewFile(false)} className="text-white/40 hover:text-white text-[10px] font-bold uppercase px-4 py-2">Cancel</button>
                            <button onClick={createFile} className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold uppercase px-5 py-2 rounded-lg transition-all">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {preview && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setPreview(null)}>
                    <div className="bg-[#161618] border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">{preview.name}</h3>
                            <button onClick={() => setPreview(null)} className="text-white/30 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {preview.type === 'image' ? (
                                <img src={preview.content} alt={preview.name} className="max-w-full rounded-lg" />
                            ) : (
                                <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap break-all">{preview.content}</pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Section>
    );
}

function AgentCard({ agent, onEdit, onDelete, onToggle }: any) {
    const isRunning = agent.status === 'running';
    return (
        <motion.div
            layout
            className={cn(
                "font-sans bg-[#111113] p-5 md:p-6 flex flex-col gap-4 relative group rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-black/20",
                isRunning ? "border-green-500/30 shadow-sm shadow-green-900/10" : "border-white/[0.06] hover:border-white/10"
            )}
        >
            {/* Header: icon + status */}
            <div className="flex items-center justify-between">
                <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                    isRunning ? "bg-green-500/15 text-green-400" : "bg-white/[0.04] text-white/25"
                )}>
                    <Bot size={22} />
                </div>
                <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide",
                    isRunning ? "bg-green-500/10 text-green-400" : "bg-white/[0.04] text-white/30"
                )}>
                    <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isRunning ? "bg-green-400 animate-pulse" : "bg-white/20"
                    )} />
                    {isRunning ? 'Running' : 'Stopped'}
                </span>
            </div>

            {/* Title + description */}
            <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-white/90 truncate mb-1 group-hover:text-white transition-colors">{agent.name}</h3>
                <p className="text-[12px] text-white/35 font-normal line-clamp-2 leading-relaxed">{agent.description || 'No description.'}</p>
            </div>

            {/* Configuration error banner */}
            {(() => {
                const issues: string[] = [];
                if (!agent.model) issues.push('No AI model selected');
                if (!agent.telegramEnabled && !agent.discordEnabled && !agent.whatsappEnabled && !agent.feishuEnabled && !agent.slackEnabled && !agent.teamsEnabled) issues.push('No channel connected');
                if (issues.length === 0) return null;
                return (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-red-300 uppercase tracking-wider mb-1">Setup incomplete</p>
                            {issues.map((issue, i) => (
                                <p key={i} className="text-[11px] text-red-200/60">• {issue}</p>
                            ))}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            Fix Now
                        </button>
                    </div>
                );
            })()}

            {/* Model badge */}
            {agent.model && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/20 font-medium bg-white/[0.03] px-2 py-0.5 rounded-md truncate max-w-[200px] border border-white/[0.04]">
                        {agent.model}
                    </span>
                </div>
            )}

            {/* Footer: channels + actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.05] mt-auto">
                <div className="flex -space-x-1.5">
                    {agent.telegramEnabled && <ChannelIcon src={ICONS.telegram} />}
                    {agent.discordEnabled && <ChannelIcon src={ICONS.discord} />}
                    {agent.whatsappEnabled && <ChannelIcon src={ICONS.whatsapp} />}
                    {agent.feishuEnabled && <ChannelIcon src={ICONS.feishu} />}
                    {!agent.telegramEnabled && !agent.discordEnabled && !agent.whatsappEnabled && !agent.feishuEnabled && (
                        <span className="text-[10px] text-white/15 font-medium">No channels</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onEdit} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-all" title="Settings">
                        <Settings size={16} />
                    </button>
                    <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-all" title="Delete">
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={onToggle}
                        className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                            isRunning ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                        )}
                        title={isRunning ? 'Stop' : 'Start'}
                    >
                        {isRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function ChannelIcon({ src }: { src: string }) {
    return (
        <div className="w-8 h-8 rounded-full border-2 border-[#050505] bg-white p-1 hover:translate-y-[-4px] transition-transform cursor-help">
            <img src={src} className="w-full h-full object-contain" />
        </div>
    );
}

function Section({ icon, title, desc, children }: any) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 md:gap-5 mb-6 md:mb-10">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-white/5 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner text-white/20 border border-white/5 shrink-0">
                    {icon}
                </div>
                <div className="min-w-0">
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter text-white uppercase italic">{title}</h2>
                    <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em] truncate">{desc}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

function ChannelInput({ name, icon, enabled, onToggle, badge, children }: any) {
    return (
        <div className={cn(
            "p-6 md:p-8 rounded-[2rem] border transition-all duration-500 relative overflow-hidden",
            enabled ? "bg-white/[0.02] border-primary/20" : "bg-transparent border-white/5 opacity-40 grayscale"
        )}>
            <div className="flex items-center justify-between gap-3 mb-8">
                <div className="flex items-center gap-3 md:gap-5 min-w-0">
                    <div className="w-11 h-11 md:w-14 md:h-14 bg-white p-1.5 md:p-2 rounded-xl md:rounded-2xl shadow-xl shrink-0">
                        <img src={icon} alt={name} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base md:text-lg font-black text-white uppercase italic tracking-tight truncate">{name}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[9px] text-primary font-black uppercase tracking-widest">{enabled ? 'Active Protocol' : 'Standby'}</p>
                            {badge && <span className="px-2 py-0.5 text-[8px] md:text-[9px] font-black uppercase tracking-wider bg-green-500/20 text-green-400 rounded-full border border-green-500/30">{badge}</span>}
                        </div>
                    </div>
                </div>
                <div className="shrink-0">
                    <Toggle checked={enabled} onChange={onToggle} />
                </div>
            </div>
            <AnimatePresence>
                {enabled && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div className="pt-8 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ToolCard({ title, icon, desc, checked, onToggle, children }: any) {
    return (
        <div className={cn(
            "p-8 rounded-[2rem] border transition-all duration-500 group flex flex-col h-full",
            checked ? "bg-white/[0.02] border-primary/20" : "bg-transparent border-white/5"
        )}>
            <div className="flex items-center justify-between mb-6">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all", checked ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-white/10")}>
                    {icon}
                </div>
                {onToggle && <Toggle checked={checked} onChange={onToggle} />}
            </div>
            <h3 className="text-base font-black text-white uppercase italic tracking-tight mb-3">{title}</h3>
            <p className="text-[11px] text-white/40 font-medium leading-relaxed mb-6 flex-1">{desc}</p>
            {children}
        </div>
    );
}

function ToggleRow({ label, desc, icon, checked, onToggle }: any) {
    return (
        <div className="flex items-center justify-between p-6 bg-white/[0.02] rounded-3xl border border-white/5">
            <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/20">
                    {icon}
                </div>
                <div>
                    <h4 className="font-black text-sm text-white uppercase italic tracking-wide">{label}</h4>
                    <p className="text-[11px] text-white/40 font-medium">{desc}</p>
                </div>
            </div>
            <Toggle checked={checked} onChange={onToggle} />
        </div>
    );
}

function InputWrapper({ label, children, full }: any) {
    return (
        <div className={full ? 'col-span-full' : ''}>
            <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-3 block px-1">{label}</label>
            {children}
        </div>
    );
}

function Toggle({ checked, onChange }: any) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className="w-12 h-6.5 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-lg after:transition-all peer-checked:bg-primary transition-all duration-300"></div>
        </label>
    );
}
