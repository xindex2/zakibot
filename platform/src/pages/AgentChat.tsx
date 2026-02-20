import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Paperclip, Trash2, Loader2, Bot, User, Image, File as FileIcon, X, AlertTriangle,
    Sparkles, MessageSquare, Phone, Globe, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ---- Markdown Renderer ----
function renderMarkdown(text: string) {
    if (!text) return null;

    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, bi) => {
        if (block.startsWith('```') && block.endsWith('```')) {
            const inner = block.slice(3, -3);
            const nlIdx = inner.indexOf('\n');
            const lang = nlIdx > -1 ? inner.slice(0, nlIdx).trim() : '';
            const code = nlIdx > -1 ? inner.slice(nlIdx + 1) : inner;
            return (
                <div key={bi} className="relative group/code my-3">
                    {lang && (
                        <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/20 bg-white/5 rounded-bl-lg rounded-tr-xl">{lang}</div>
                    )}
                    <pre className="bg-black/50 border border-white/[0.06] rounded-xl p-4 overflow-x-auto text-[12px] font-mono text-emerald-300/80 leading-relaxed">
                        {code}
                    </pre>
                </div>
            );
        }

        // Process inline formatting
        const parts = block.split('\n').map((line, li) => {
            // Headers
            if (line.startsWith('### ')) return <h3 key={li} className="text-sm font-bold text-white/80 mt-3 mb-1">{line.slice(4)}</h3>;
            if (line.startsWith('## ')) return <h3 key={li} className="text-sm font-bold text-white/80 mt-3 mb-1">{line.slice(3)}</h3>;
            if (line.startsWith('# ')) return <h2 key={li} className="text-base font-bold text-white/90 mt-3 mb-1">{line.slice(2)}</h2>;

            // Bullet points
            if (line.match(/^[\s]*[-*]\s/)) {
                const content = line.replace(/^[\s]*[-*]\s/, '');
                return <div key={li} className="flex gap-2 ml-2"><span className="text-primary/60 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: inlineFormat(content) }} /></div>;
            }

            // Numbered lists
            if (line.match(/^\d+\.\s/)) {
                const num = line.match(/^(\d+)\./)?.[1];
                const content = line.replace(/^\d+\.\s/, '');
                return <div key={li} className="flex gap-2 ml-2"><span className="text-primary/60 font-bold text-[11px] mt-0.5">{num}.</span><span dangerouslySetInnerHTML={{ __html: inlineFormat(content) }} /></div>;
            }

            let processed = inlineFormat(line);
            return (
                <span key={li}>
                    {li > 0 && <br />}
                    <span dangerouslySetInnerHTML={{ __html: processed }} />
                </span>
            );
        });

        return <span key={bi}>{parts}</span>;
    });
}

function inlineFormat(line: string): string {
    return line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-white/70">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-white/[0.08] text-cyan-300/90 px-1.5 py-0.5 rounded text-[11px] font-mono">$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">$1</a>')
        .replace(/(^|[^"'])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener" class="text-primary/70 underline underline-offset-2 hover:text-primary transition-colors">$2</a>');
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
    channel?: string;
    attachments?: string[];
}

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
    telegram: { label: 'Telegram', color: 'text-blue-400 bg-blue-500/10' },
    discord: { label: 'Discord', color: 'text-indigo-400 bg-indigo-500/10' },
    whatsapp: { label: 'WhatsApp', color: 'text-green-400 bg-green-500/10' },
    slack: { label: 'Slack', color: 'text-purple-400 bg-purple-500/10' },
    webchat: { label: 'Web', color: 'text-primary bg-primary/10' },
    cli: { label: 'CLI', color: 'text-gray-400 bg-gray-500/10' },
    cron: { label: 'Cron', color: 'text-amber-400 bg-amber-500/10' },
};

const INTRO_MESSAGE = "Tell me who am I, and who you are. What can you help me with?";

export default function AgentChat() {
    const { agentId } = useParams<{ agentId: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [agentName, setAgentName] = useState('Agent');
    const [agentStatus, setAgentStatus] = useState('');
    const [agentModel, setAgentModel] = useState('');
    const [agentChannels, setAgentChannels] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch agent info + chat history on mount
    useEffect(() => {
        if (!agentId || !token) return;

        // Get agent config — must use actual user ID
        fetch(`/api/config?userId=${user?.id || ''}`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : [])
            .then(configs => {
                const agent = (configs || []).find((c: any) => c.id === agentId);
                if (agent) {
                    setAgentName(agent.name || 'Agent');
                    setAgentStatus(agent.status || 'stopped');
                    setAgentModel(agent.model || '');
                    const chs: string[] = [];
                    if (agent.telegramEnabled) chs.push('Telegram');
                    if (agent.discordEnabled) chs.push('Discord');
                    if (agent.whatsappEnabled) chs.push('WhatsApp');
                    if (agent.slackEnabled) chs.push('Slack');
                    if (agent.feishuEnabled) chs.push('Feishu');
                    if (agent.teamsEnabled) chs.push('Teams');
                    setAgentChannels(chs);
                }
            })
            .catch(() => { });

        // Get unified chat history
        fetch(`/api/chat/${agentId}/history`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : { messages: [] })
            .then(data => {
                setMessages(data.messages || []);
                setHistoryLoaded(true);
            })
            .catch(() => setHistoryLoaded(true));
    }, [agentId, token]);

    // Auto-send intro message on first conversation
    useEffect(() => {
        if (!historyLoaded || messages.length > 0 || sending || agentStatus !== 'running') return;
        // First ever conversation — send intro automatically
        const timer = setTimeout(() => {
            doSendMessage(INTRO_MESSAGE);
        }, 500);
        return () => clearTimeout(timer);
    }, [historyLoaded, messages.length, agentStatus]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const doSendMessage = async (msgText: string, files: File[] = []) => {
        if ((!msgText.trim() && files.length === 0) || sending || !agentId) return;

        const userMsg: ChatMessage = {
            role: 'user',
            content: msgText.trim(),
            timestamp: new Date().toISOString(),
            channel: 'webchat',
            attachments: files.map(f => f.name),
        };

        setMessages(prev => [...prev, userMsg]);
        setSending(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('message', msgText.trim());
            for (const file of files) {
                formData.append('files', file);
            }

            const resp = await fetch(`/api/chat/${agentId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const data = await resp.json();

            if (!resp.ok) {
                setError(data.error || 'Failed to send message');
                return;
            }

            const botMsg: ChatMessage = {
                role: 'assistant',
                content: data.response || '(empty response)',
                timestamp: new Date().toISOString(),
                channel: 'webchat',
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const sendMessage = async () => {
        const currentInput = input.trim();
        const currentFiles = [...attachments];
        setInput('');
        setAttachments([]);
        // Reset textarea height
        if (inputRef.current) inputRef.current.style.height = 'auto';
        await doSendMessage(currentInput, currentFiles);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const clearChat = () => {
        if (!confirm('Clear all chat history?')) return;
        setMessages([]);
    };

    const formatTime = (ts?: string) => {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    const formatDate = (ts?: string) => {
        if (!ts) return '';
        try {
            const d = new Date(ts);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (d.toDateString() === today.toDateString()) return 'Today';
            if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch { return ''; }
    };

    // Group messages by date
    let lastDate = '';

    const isOnline = agentStatus === 'running';

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0a0a0c]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-white/[0.06] bg-[#0e0e10]/95 backdrop-blur-2xl shrink-0">
                <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isOnline ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.04] text-white/25'}`}>
                        <Bot size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-white truncate">{agentName}</h1>
                            {agentModel && (
                                <span className="hidden md:inline text-[9px] text-white/15 font-medium bg-white/[0.03] px-1.5 py-0.5 rounded truncate max-w-[140px] border border-white/[0.04]">{agentModel}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <span className="text-[10px] text-green-400 flex items-center gap-1 font-medium">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                                    Online
                                </span>
                            ) : (
                                <span className="text-[10px] text-white/25 font-medium">Offline</span>
                            )}
                            {agentChannels.length > 0 && (
                                <span className="text-[9px] text-white/15 hidden md:inline">
                                    · {agentChannels.join(', ')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={clearChat} className="p-2 rounded-xl hover:bg-red-500/10 text-white/15 hover:text-red-400 transition-all" title="Clear chat">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                {messages.length === 0 && !sending && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-8 border border-primary/10">
                            <Bot size={40} className="text-primary/50" />
                        </div>
                        <h2 className="text-xl font-bold text-white/70 mb-3">{agentName}</h2>
                        <p className="text-sm text-white/25 max-w-md leading-relaxed mb-1">
                            Your AI agent with the same memory, tools, and personality as your connected channels.
                        </p>
                        <p className="text-[11px] text-white/15 mb-6">
                            Conversation history is unified across all channels
                        </p>
                        {!isOnline && (
                            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/15 px-5 py-3 rounded-2xl">
                                <AlertTriangle size={16} className="text-yellow-400/70 shrink-0" />
                                <p className="text-[11px] text-yellow-300/70">Agent is stopped — start it from the dashboard to chat</p>
                            </div>
                        )}
                        {isOnline && (
                            <div className="flex items-center gap-2 text-white/20">
                                <Sparkles size={14} className="text-primary/50" />
                                <p className="text-[11px]">Starting conversation...</p>
                            </div>
                        )}
                    </div>
                )}

                {messages.map((msg, i) => {
                    // Date separator
                    const msgDate = formatDate(msg.timestamp);
                    let showDate = false;
                    if (msgDate && msgDate !== lastDate) {
                        lastDate = msgDate;
                        showDate = true;
                    }

                    const channelInfo = msg.channel ? CHANNEL_LABELS[msg.channel] || { label: msg.channel, color: 'text-white/30 bg-white/5' } : null;

                    return (
                        <div key={i}>
                            {showDate && (
                                <div className="flex items-center justify-center my-6">
                                    <span className="text-[10px] text-white/15 font-bold uppercase tracking-widest bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.04]">
                                        {msgDate}
                                    </span>
                                </div>
                            )}
                            <div className={`flex gap-2.5 py-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1.5">
                                        <Bot size={14} className="text-primary/70" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === 'user'
                                    ? 'bg-primary/15 border border-primary/15 rounded-2xl rounded-br-sm'
                                    : 'bg-white/[0.03] border border-white/[0.05] rounded-2xl rounded-bl-sm'
                                    } px-4 py-2.5`}>
                                    {/* Channel tag for non-webchat messages */}
                                    {channelInfo && msg.channel !== 'webchat' && (
                                        <div className="mb-1.5">
                                            <span className={`inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider ${channelInfo.color} px-1.5 py-0.5 rounded`}>
                                                <Globe size={8} /> via {channelInfo.label}
                                            </span>
                                        </div>
                                    )}
                                    {/* Attachments */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {msg.attachments.map((name, ai) => (
                                                <span key={ai} className="inline-flex items-center gap-1 text-[9px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                                                    <Paperclip size={8} /> {name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {/* Content */}
                                    <div className={`text-[13px] leading-relaxed ${msg.role === 'user' ? 'text-white/85' : 'text-white/65'}`}>
                                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                                    </div>
                                    {/* Timestamp */}
                                    {msg.timestamp && (
                                        <p className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-white/20 text-right' : 'text-white/10'}`}>
                                            {formatTime(msg.timestamp)}
                                        </p>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-1.5 overflow-hidden">
                                        {user?.avatar_url ? (
                                            <img src={user.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={14} className="text-white/30" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {sending && (
                    <div className="flex gap-2.5 justify-start py-1.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1.5">
                            <Bot size={14} className="text-primary/70" />
                        </div>
                        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl rounded-bl-sm px-4 py-3">
                            <div className="flex items-center gap-2.5">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[10px] text-white/15 font-medium">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex justify-center my-3">
                        <div className="bg-red-500/10 border border-red-500/15 rounded-2xl px-4 py-2.5 flex items-center gap-2 max-w-md">
                            <AlertTriangle size={14} className="text-red-400/70 shrink-0" />
                            <p className="text-[11px] text-red-300/70 flex-1">{error}</p>
                            <button onClick={() => setError('')} className="text-red-400/40 hover:text-red-400 ml-1">
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview */}
            {attachments.length > 0 && (
                <div className="px-4 md:px-8 pb-2 flex flex-wrap gap-2">
                    {attachments.map((file, i) => (
                        <div key={i} className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5 text-[11px] text-white/50">
                            {file.type.startsWith('image/') ? <Image size={12} className="text-pink-400" /> : <FileIcon size={12} className="text-white/25" />}
                            <span className="truncate max-w-[120px]">{file.name}</span>
                            <button onClick={() => removeAttachment(i)} className="text-white/25 hover:text-white">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="shrink-0 border-t border-white/[0.05] bg-[#0e0e10]/95 backdrop-blur-2xl px-4 md:px-8 py-3">
                <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-xl hover:bg-white/5 text-white/20 hover:text-white/40 transition-all shrink-0 mb-0.5"
                        title="Attach file"
                    >
                        <Paperclip size={18} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={e => {
                            if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                            e.target.value = '';
                        }}
                    />
                    <div className="flex-1">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message..."
                            disabled={false}
                            rows={1}
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/85 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/20 resize-none transition-all disabled:opacity-30"
                            style={{ minHeight: '44px', maxHeight: '160px' }}
                            onInput={(e) => {
                                const el = e.target as HTMLTextAreaElement;
                                el.style.height = 'auto';
                                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                            }}
                        />
                    </div>
                    <button
                        onClick={sendMessage}
                        disabled={sending || (!input.trim() && attachments.length === 0)}
                        className="p-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0 mb-0.5 shadow-lg shadow-primary/10"
                        title="Send"
                    >
                        {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
                <p className="text-[9px] text-white/[0.06] text-center mt-2 select-none">Enter to send · Shift+Enter for new line · Unified with all channels</p>
            </div>
        </div>
    );
}
