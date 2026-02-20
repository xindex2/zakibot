import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Paperclip, Trash2, Loader2, Bot, User, Image, File as FileIcon, X, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Simple markdown-ish renderer: bold, italic, code blocks, inline code, links, newlines
function renderMarkdown(text: string) {
    if (!text) return null;

    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, bi) => {
        if (block.startsWith('```') && block.endsWith('```')) {
            const inner = block.slice(3, -3);
            const nlIdx = inner.indexOf('\n');
            const code = nlIdx > -1 ? inner.slice(nlIdx + 1) : inner;
            return (
                <pre key={bi} className="bg-black/40 border border-white/5 rounded-xl p-4 my-2 overflow-x-auto text-[12px] font-mono text-green-300/80 leading-relaxed">
                    {code}
                </pre>
            );
        }

        // Process inline formatting
        const parts = block.split('\n').map((line, li) => {
            // Process inline elements
            let processed = line
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\*(.*?)\*/g, '<i>$1</i>')
                .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-cyan-300">$1</code>')
                .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary underline underline-offset-2 hover:text-primary/80">$1</a>');

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

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
    attachments?: string[];
}

export default function AgentChat() {
    const { agentId } = useParams<{ agentId: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [agentName, setAgentName] = useState('Agent');
    const [agentStatus, setAgentStatus] = useState('');
    const [error, setError] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch agent info + chat history on mount
    useEffect(() => {
        if (!agentId || !token) return;

        // Get agent config
        fetch('/api/config?userId=_all', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(configs => {
                const agent = (configs || []).find((c: any) => c.id === agentId);
                if (agent) {
                    setAgentName(agent.name || 'Agent');
                    setAgentStatus(agent.status || 'stopped');
                }
            })
            .catch(() => { });

        // Get chat history
        fetch(`/api/chat/${agentId}/history`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : { messages: [] })
            .then(data => setMessages(data.messages || []))
            .catch(() => { });
    }, [agentId, token]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if ((!input.trim() && attachments.length === 0) || sending || !agentId) return;

        const userMsg: ChatMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString(),
            attachments: attachments.map(f => f.name),
        };

        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setSending(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('message', currentInput);
            for (const file of attachments) {
                formData.append('files', file);
            }
            setAttachments([]);

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
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
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
        // Optionally: call backend to clear session file
    };

    const formatTime = (ts?: string) => {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0a0a0c]">
            {/* Header */}
            <div className="flex items-center gap-4 px-4 md:px-6 py-3 border-b border-white/5 bg-[#111113]/80 backdrop-blur-xl shrink-0">
                <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                        <Bot size={20} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-white truncate">{agentName}</h1>
                        <p className="text-[10px] text-white/30 font-medium">
                            {agentStatus === 'running' ? (
                                <span className="text-green-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                                    Online
                                </span>
                            ) : (
                                <span className="text-white/30">Offline</span>
                            )}
                        </p>
                    </div>
                </div>
                <button onClick={clearChat} className="p-2 rounded-xl hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all" title="Clear chat">
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
                {messages.length === 0 && !sending && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20">
                        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                            <Bot size={36} className="text-primary/60" />
                        </div>
                        <h2 className="text-lg font-bold text-white/60 mb-2">Chat with {agentName}</h2>
                        <p className="text-sm text-white/25 max-w-md">
                            Send a message to start a conversation. Your agent will respond using the same AI model and tools configured in the dashboard.
                        </p>
                        {agentStatus !== 'running' && (
                            <div className="mt-6 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 rounded-xl">
                                <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
                                <p className="text-[11px] text-yellow-300/80">This agent is currently stopped. Start it from the dashboard first.</p>
                            </div>
                        )}
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                                <Bot size={16} className="text-primary" />
                            </div>
                        )}
                        <div className={`max-w-[80%] md:max-w-[70%] ${msg.role === 'user'
                            ? 'bg-primary/20 border border-primary/20 rounded-2xl rounded-br-md'
                            : 'bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md'
                            } px-4 py-3`}>
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {msg.attachments.map((name, ai) => (
                                        <span key={ai} className="inline-flex items-center gap-1 text-[9px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                                            <Paperclip size={8} /> {name}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className={`text-[13px] leading-relaxed ${msg.role === 'user' ? 'text-white/90' : 'text-white/70'}`}>
                                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                            </div>
                            {msg.timestamp && (
                                <p className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-white/25 text-right' : 'text-white/15'}`}>
                                    {formatTime(msg.timestamp)}
                                </p>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-1">
                                <User size={16} className="text-white/40" />
                            </div>
                        )}
                    </div>
                ))}

                {sending && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                            <Bot size={16} className="text-primary" />
                        </div>
                        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[11px] text-white/25">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex justify-center">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 flex items-center gap-2 max-w-md">
                            <AlertTriangle size={14} className="text-red-400 shrink-0" />
                            <p className="text-[11px] text-red-300/80">{error}</p>
                            <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400 ml-2">
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview */}
            {attachments.length > 0 && (
                <div className="px-4 md:px-6 pb-2 flex flex-wrap gap-2">
                    {attachments.map((file, i) => (
                        <div key={i} className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white/60">
                            {file.type.startsWith('image/') ? <Image size={12} className="text-pink-400" /> : <FileIcon size={12} className="text-white/30" />}
                            <span className="truncate max-w-[120px]">{file.name}</span>
                            <button onClick={() => removeAttachment(i)} className="text-white/30 hover:text-white">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="shrink-0 border-t border-white/5 bg-[#111113]/80 backdrop-blur-xl px-4 md:px-6 py-3">
                <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-xl hover:bg-white/5 text-white/25 hover:text-white/50 transition-all shrink-0 mb-0.5"
                        title="Attach file"
                    >
                        <Paperclip size={20} />
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
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none transition-all"
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
                        className="p-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mb-0.5"
                        title="Send"
                    >
                        {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </div>
                <p className="text-[9px] text-white/10 text-center mt-2">Press Enter to send • Shift+Enter for new line</p>
            </div>
        </div>
    );
}
