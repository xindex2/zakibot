'use client';

import { useState, useEffect } from 'react';
import {
    Bot, Settings, Cpu, Share2, Play, Square,
    CheckCircle2, Globe, MessageSquare, Github,
    CloudRain, Terminal, Search, Zap, Layout,
    ShieldAlert, Server, Activity, ChevronRight,
    Database, Lock, Rocket, Sparkles, RefreshCcw
} from 'lucide-react';

const USER_ID = 'demo-user';

const ICONS = {
    telegram: 'https://telegram.org/favicon.ico',
    discord: 'https://discord.com/favicon.ico',
    whatsapp: 'https://whatsapp.com/favicon.ico',
    feishu: 'https://www.feishu.cn/favicon.ico',
    openai: 'https://openai.com/favicon.ico',
    anthropic: 'https://www.anthropic.com/favicon.ico',
    google: 'https://www.google.com/favicon.ico',
    brave: 'https://brave.com/static-assets/images/brave-favicon.png'
};

export default function Dashboard() {
    const [formData, setFormData] = useState({
        provider: 'openrouter',
        apiKey: '',
        apiBase: '',
        model: 'anthropic/claude-opus-4-5',
        telegramEnabled: false,
        telegramToken: '',
        discordEnabled: false,
        discordToken: '',
        whatsappEnabled: false,
        feishuEnabled: false,
        feishuAppId: '',
        feishuAppSecret: '',
        webSearchApiKey: '',
        githubToken: '',
        browserEnabled: true,
        shellEnabled: false,
        restrictToWorkspace: true,
        gatewayHost: '0.0.0.0',
        gatewayPort: 18790,
        maxToolIterations: 20
    });

    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('provider');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const configResp = await fetch(`/api/config?userId=${USER_ID}`);
                if (configResp.ok) {
                    const config = await configResp.json();
                    if (config && Object.keys(config).length > 0) {
                        setFormData(prev => ({ ...prev, ...config }));
                    }
                }

                await updateStatus();
            } catch (err) {
                console.error('Failed to fetch data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(updateStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const updateStatus = async () => {
        try {
            const statusResp = await fetch('/api/bot/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, action: 'status' })
            });
            if (statusResp.ok) {
                const { status } = await statusResp.json();
                setIsRunning(status === 'running');
            }
        } catch (e) { }
    };

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value)
        }));
    };

    const saveConfig = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: USER_ID,
                    ...formData
                })
            });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleBot = async () => {
        await saveConfig();
        const action = isRunning ? 'stop' : 'start';
        const resp = await fetch('/api/bot/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, action })
        });
        if (resp.ok) {
            const { status } = await resp.json();
            setIsRunning(status === 'running');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <Bot size={64} className="text-blue-500 animate-bounce" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex font-sans selection:bg-blue-500/30 selection:text-white overflow-hidden">
            {/* Dynamic Background Noise */}
            <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-50 mix-blend-overlay" />

            {/* Sidebar */}
            <aside className="w-80 border-r border-white/5 bg-black/40 backdrop-blur-3xl p-8 flex flex-col gap-10 sticky top-0 h-screen z-10">
                <div className="flex items-center gap-4 px-2 group cursor-pointer transition-all">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 group-hover:rotate-12 transition-transform duration-500">
                        <Bot size={28} className="text-white" />
                    </div>
                    <div>
                        <span className="text-2xl font-black tracking-tighter block uppercase italic leading-none">openclaw-host</span>
                        <span className="text-[10px] text-blue-500 font-bold tracking-[0.2em] uppercase opacity-80 mt-1 block">Autonomous Core</span>
                    </div>
                </div>

                <nav className="flex flex-col gap-2">
                    <SidebarTab active={activeTab === 'provider'} onClick={() => setActiveTab('provider')} icon={<Cpu size={18} />} label="AI Brain" sub="Core Intelligence" />
                    <SidebarTab active={activeTab === 'channels'} onClick={() => setActiveTab('channels')} icon={<Share2 size={18} />} label="Inbound Hub" sub="Communication" />
                    <SidebarTab active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} icon={<Terminal size={18} />} label="Capabilities" sub="Tool Registry" />
                    <SidebarTab active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<Server size={18} />} label="System" sub="Infrastructure" />
                </nav>

                <div className="mt-auto flex flex-col gap-4">
                    <div className={`p-6 rounded-3xl border transition-all duration-700 ${isRunning ? 'border-green-500/30 bg-green-500/5 shadow-[0_0_40px_rgba(34,197,94,0.05)]' : 'border-white/5 bg-white/2'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.8)]' : 'bg-gray-600'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isRunning ? 'text-green-500' : 'text-gray-500'}`}>
                                    {isRunning ? 'System Active' : 'System Dormant'}
                                </span>
                            </div>
                            <Activity size={12} className={isRunning ? 'text-green-500' : 'text-gray-600'} />
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                            {isRunning ? 'Subagent manager listening for inbound triggers on Telegram/Discord.' : 'Core in hibernation mode. Waiting for initialization signal.'}
                        </p>
                    </div>

                    <button
                        onClick={toggleBot}
                        disabled={isSaving}
                        className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-sm tracking-widest transition-all transform active:scale-95 disabled:opacity-50 ${isRunning ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20' : 'bg-white text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:-translate-y-1'}`}
                    >
                        {isRunning ? (
                            <><Square size={16} fill="currentColor" /> TERMINATE</>
                        ) : (
                            <><Play size={16} fill="currentColor" /> INITIALIZE</>
                        )}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-16 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,_#0a0a0a_0%,_transparent_100%)] relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -z-10" />

                <header className="flex flex-col gap-4 mb-20 relative">
                    <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-[0.4em]">
                        <Sparkles size={14} className="animate-pulse" /> Command Center
                    </div>
                    <h1 className="text-7xl font-black tracking-tighter italic uppercase underline decoration-blue-600/30 underline-offset-8">
                        {activeTab === 'provider' && 'Intelligence'}
                        {activeTab === 'channels' && 'Omni-Channel'}
                        {activeTab === 'tools' && 'Capabilities'}
                        {activeTab === 'system' && 'Infrastructure'}
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl font-medium mt-2">
                        Configure the central processing unit of your autonomous agent.
                    </p>
                </header>

                <div className="max-w-5xl space-y-16 pb-32">
                    {activeTab === 'provider' && (
                        <div className="grid gap-12 animate-in fade-in zoom-in-95 duration-500">
                            <Section
                                icon={<Lock className="text-blue-500" />}
                                title="Intelligence Provider"
                                desc="Link your LLM core provider and specific intelligence model."
                            >
                                <div className="grid md:grid-cols-2 gap-10">
                                    <InputWrapper label="Provider Architecture">
                                        <select
                                            name="provider"
                                            value={formData.provider}
                                            onChange={handleChange}
                                            className="form-select text-base"
                                        >
                                            <option value="openrouter">OpenRouter AI</option>
                                            <option value="anthropic">Anthropic (Claude)</option>
                                            <option value="openai">OpenAI (GPT)</option>
                                            <option value="deepseek">DeepSeek Central</option>
                                            <option value="gemini">Google Gemini</option>
                                            <option value="groq">Groq LPU</option>
                                            <option value="zhipu">Zhipu AI</option>
                                            <option value="moonshot">Moonshot</option>
                                            <option value="vllm">vLLM Node</option>
                                        </select>
                                    </InputWrapper>
                                    <InputWrapper label="Model Descriptor">
                                        <input
                                            name="model"
                                            value={formData.model}
                                            onChange={handleChange}
                                            placeholder="e.g. anthropic/claude-3.5-sonnet"
                                            className="form-input text-base"
                                        />
                                    </InputWrapper>
                                    <InputWrapper label="Core API Key" full>
                                        <input
                                            name="apiKey"
                                            type="password"
                                            value={formData.apiKey}
                                            onChange={handleChange}
                                            placeholder="sk-..."
                                            className="form-input text-base font-mono"
                                        />
                                    </InputWrapper>
                                </div>
                            </Section>
                        </div>
                    )}

                    {activeTab === 'channels' && (
                        <div className="grid gap-6 animate-in fade-in slide-in-from-right-8 duration-500">
                            <ChannelRow
                                name="Telegram"
                                icon={ICONS.telegram}
                                enabled={formData.telegramEnabled}
                                onToggle={handleChange}
                                toggleName="telegramEnabled"
                            >
                                <InputWrapper label="Bot API Token">
                                    <input
                                        name="telegramToken"
                                        type="password"
                                        value={formData.telegramToken}
                                        onChange={handleChange}
                                        placeholder="123456789:ABC..."
                                        className="form-input py-4 text-sm font-mono"
                                    />
                                </InputWrapper>
                            </ChannelRow>

                            <ChannelRow
                                name="Discord"
                                icon={ICONS.discord}
                                enabled={formData.discordEnabled}
                                onToggle={handleChange}
                                toggleName="discordEnabled"
                            >
                                <InputWrapper label="Discord Secret Token">
                                    <input
                                        name="discordToken"
                                        type="password"
                                        value={formData.discordToken}
                                        onChange={handleChange}
                                        placeholder="MTIzNDU2..."
                                        className="form-input py-4 text-sm font-mono"
                                    />
                                </InputWrapper>
                            </ChannelRow>

                            <ChannelRow
                                name="WhatsApp"
                                icon={ICONS.whatsapp}
                                enabled={formData.whatsappEnabled}
                                onToggle={handleChange}
                                toggleName="whatsappEnabled"
                            >
                                <div className="bg-blue-600/5 p-6 rounded-3xl border border-blue-500/10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <RefreshCcw size={14} className="text-blue-500 animate-spin-slow" />
                                        <p className="text-xs text-blue-500 font-black uppercase tracking-widest">Awaiting Bridge Login</p>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-6">Initialize QR scan via system terminal or OpenClaw Host CLI.</p>
                                </div>
                            </ChannelRow>

                            <ChannelRow
                                name="Feishu"
                                icon={ICONS.feishu}
                                enabled={formData.feishuEnabled}
                                onToggle={handleChange}
                                toggleName="feishuEnabled"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <InputWrapper label="App ID">
                                        <input name="feishuAppId" value={formData.feishuAppId} onChange={handleChange} className="form-input py-4 text-sm" />
                                    </InputWrapper>
                                    <InputWrapper label="App Secret">
                                        <input name="feishuAppSecret" type="password" value={formData.feishuAppSecret} onChange={handleChange} className="form-input py-4 text-sm" />
                                    </InputWrapper>
                                </div>
                            </ChannelRow>
                        </div>
                    )}

                    {activeTab === 'tools' && (
                        <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <ToolCard
                                icon={<img src={ICONS.brave} className="w-8 h-8 rounded-lg" />}
                                title="Web Search"
                                desc="Live search capabilities powered by Brave API."
                            >
                                <input
                                    name="webSearchApiKey"
                                    type="password"
                                    value={formData.webSearchApiKey}
                                    onChange={handleChange}
                                    placeholder="Brave API Key"
                                    className="form-input py-4 text-sm font-mono"
                                />
                            </ToolCard>

                            <ToolCard
                                icon={<Github className="text-white" size={32} />}
                                title="GitHub Tool"
                                desc="Autonomous code management & issue tracking."
                            >
                                <input
                                    name="githubToken"
                                    type="password"
                                    value={formData.githubToken}
                                    onChange={handleChange}
                                    placeholder="Personal Access Token"
                                    className="form-input py-4 text-sm font-mono"
                                />
                            </ToolCard>

                            <ToolCard
                                icon={<Globe className="text-cyan-400" size={32} />}
                                title="Playwright Browser"
                                desc="Dynamic web browsing & scraping."
                                toggleName="browserEnabled"
                                checked={formData.browserEnabled}
                                onToggle={handleChange}
                            />

                            <ToolCard
                                icon={<Terminal className="text-amber-500" size={32} />}
                                title="System Shell"
                                desc="Secure command execution sandbox."
                                toggleName="shellEnabled"
                                checked={formData.shellEnabled}
                                onToggle={handleChange}
                            />
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="grid gap-12 animate-in fade-in slide-in-from-left-8 duration-500">
                            <Section icon={<ShieldAlert className="text-red-500" />} title="Security Sandbox" desc="Isolated process boundaries and execution limits.">
                                <div className="flex items-center justify-between p-8 bg-white/2 rounded-[2rem] border border-white/5 hover:border-blue-500/20 transition-all group">
                                    <div>
                                        <h4 className="font-bold text-xl mb-1 group-hover:text-blue-500 transition-colors">Workspace Jail</h4>
                                        <p className="text-sm text-gray-500 max-w-md mt-2">Force the agent to stay within the designated user project folder. Highly recommended for production.</p>
                                    </div>
                                    <Toggle name="restrictToWorkspace" checked={formData.restrictToWorkspace} onChange={handleChange} />
                                </div>
                            </Section>

                            <Section icon={<Database className="text-purple-500" />} title="Infrastructure" desc="Networking and resource allocation settings.">
                                <div className="grid md:grid-cols-3 gap-8">
                                    <InputWrapper label="Interface Binding">
                                        <input name="gatewayHost" value={formData.gatewayHost} onChange={handleChange} className="form-input py-5 text-sm font-mono" />
                                    </InputWrapper>
                                    <InputWrapper label="Gateway Port">
                                        <input name="gatewayPort" type="number" value={formData.gatewayPort} onChange={handleChange} className="form-input py-5 text-sm font-mono" />
                                    </InputWrapper>
                                    <InputWrapper label="Iterative Limit">
                                        <input name="maxToolIterations" type="number" value={formData.maxToolIterations} onChange={handleChange} className="form-input py-5 text-sm font-mono" />
                                    </InputWrapper>
                                </div>
                            </Section>
                        </div>
                    )}
                </div>

                {/* Floating Actions */}
                <div className="fixed bottom-12 right-12 flex items-center gap-6">
                    {isSaving && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 animate-pulse bg-blue-500/10 px-6 py-3 rounded-full border border-blue-500/30 uppercase tracking-[0.2em]">
                            <Activity size={14} /> Saving State
                        </div>
                    )}
                    <button
                        onClick={saveConfig}
                        disabled={isSaving}
                        className="group relative"
                    >
                        <div className="absolute inset-0 bg-blue-600 blur-2xl opacity-20 group-hover:opacity-50 transition-all rounded-full" />
                        <div className="relative bg-blue-600 hover:bg-shadow-blue-500 text-white px-12 py-6 rounded-[2rem] font-black text-sm tracking-[0.2em] shadow-3xl transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-3">
                            <Rocket size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            DEPLOY CHANGES
                        </div>
                    </button>
                </div>
            </main>

            <style jsx global>{`
        @keyframes slow-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: slow-spin 3s linear infinite;
        }
      `}</style>
        </div>
    );
}

function SidebarTab({ icon, label, sub, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-4 px-6 py-5 rounded-[1.5rem] transition-all text-left relative group ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
        >
            {active && (
                <div className="absolute inset-0 bg-blue-600/10 rounded-[1.5rem] border border-blue-500/10 shadow-[inner_0_0_20px_rgba(37,99,235,0.1)]" />
            )}
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all relative z-10 ${active ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/40' : 'bg-white/5 group-hover:bg-white/10'}`}>
                {icon}
            </div>
            <div className="flex flex-col relative z-10">
                <span className="text-sm font-black tracking-tight">{label}</span>
                <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{sub}</span>
            </div>
        </button>
    );
}

function Section({ icon, title, desc, children }: any) {
    return (
        <div className="bg-white/2 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-12 relative overflow-hidden group hover:border-white/10 transition-all duration-700">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-blue-600/10 transition-all" />
            <div className="relative z-10">
                <div className="flex items-center gap-6 mb-12">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-700 shadow-inner">
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter uppercase italic">{title}</h2>
                        <p className="text-[13px] text-gray-500 font-bold uppercase tracking-widest opacity-80">{desc}</p>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

function ChannelRow({ name, icon, enabled, onToggle, toggleName, children }: any) {
    return (
        <div className={`p-10 rounded-[2.5rem] border transition-all duration-500 ${enabled ? 'bg-blue-600/5 border-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.03)]' : 'bg-white/2 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="w-16 h-16 bg-white p-3.5 rounded-[1.5rem] shadow-2xl shadow-black relative group">
                        <div className="absolute inset-0 bg-blue-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                        <img src={icon} alt={name} className="w-full h-full object-contain relative z-10" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black tracking-tight underline decoration-white/10 underline-offset-4">{name}</h3>
                        <p className="text-xs text-gray-500 font-bold uppercase mt-1 tracking-widest">{enabled ? 'Status: Online' : 'Status: Dormant'}</p>
                    </div>
                </div>
                <Toggle name={toggleName} checked={enabled} onChange={onToggle} />
            </div>
            {enabled && children && (
                <div className="mt-10 pt-10 border-t border-white/5 animate-in slide-in-from-top-4 duration-500">
                    {children}
                </div>
            )}
        </div>
    );
}

function ToolCard({ icon, title, desc, toggleName, checked, onToggle, children }: any) {
    return (
        <div className={`p-12 rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden group ${checked || (!onToggle && children) ? 'bg-blue-600/5 border-blue-500/20' : 'bg-white/2 border-white/5 hover:border-white/10'}`}>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full group-hover:bg-blue-500/10 transition-all" />
            <div className="flex items-center justify-between mb-10">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                    {icon}
                </div>
                {onToggle && <Toggle name={toggleName} checked={checked} onChange={onToggle} />}
            </div>
            <h3 className="text-2xl font-black tracking-tighter mb-2 uppercase italic leading-none">{title}</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">{desc}</p>
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}

function InputWrapper({ label, children, full }: any) {
    return (
        <div className={`flex flex-col gap-3 ${full ? 'md:col-span-2' : ''}`}>
            <label className="text-[10px] font-black text-blue-500/60 uppercase tracking-[0.3em] px-2">{label}</label>
            {children}
        </div>
    );
}

function Toggle({ name, checked, onChange }: any) {
    return (
        <label className="relative inline-flex items-center cursor-pointer group">
            <input
                type="checkbox"
                name={name}
                checked={checked}
                onChange={onChange}
                className="sr-only peer"
            />
            <div className="w-16 h-8 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 shadow-inner group-hover:bg-white/10 transition-all"></div>
        </label>
    );
}
