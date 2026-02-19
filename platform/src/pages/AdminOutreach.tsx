import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Send, Plus, Trash2, Edit3, Search, Upload, Eye, Mail, BarChart3, RefreshCw, X, Check } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Lead {
    id: string;
    email: string;
    name: string | null;
    notes: string | null;
    tags: string | null;
    status: string;
    createdAt: string;
    _count?: { emails: number };
}

interface Template {
    id: string;
    name: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    createdAt: string;
}

interface OutreachEmailRecord {
    id: string;
    leadId: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    status: string;
    openedAt: string | null;
    openCount: number;
    sentAt: string | null;
    createdAt: string;
    lead?: { email: string; name: string | null };
}

interface Stats {
    overview: {
        totalLeads: number;
        totalSent: number;
        totalOpened: number;
        totalFailed: number;
        openRate: string;
    };
    statusBreakdown: Record<string, number>;
    recentSends: OutreachEmailRecord[];
}

const STATUS_COLORS: Record<string, string> = {
    new: '#3b82f6',
    contacted: '#f59e0b',
    replied: '#10b981',
    converted: '#8b5cf6',
};

const TABS = ['Leads', 'Templates', 'Send & Track'] as const;

export default function AdminOutreach() {
    const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Leads');
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    return (
        <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, letterSpacing: '-0.02em' }}>
                📣 Outreach CRM
            </h1>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 24 }}>
                Manage leads, email templates, and campaign tracking
            </p>

            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #27272a', paddingBottom: 0 }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 20px',
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: activeTab === tab ? '#fff' : '#71717a',
                            background: activeTab === tab ? '#18181b' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab ? '2px solid #ef4444' : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab === 'Leads' && <Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                        {tab === 'Templates' && <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                        {tab === 'Send & Track' && <BarChart3 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'Leads' && <LeadsTab headers={headers} />}
            {activeTab === 'Templates' && <TemplatesTab headers={headers} />}
            {activeTab === 'Send & Track' && <SendTrackTab headers={headers} />}
        </div>
    );
}

// ─── Leads Tab ──────────────────────────────────────────────────────────────

function LeadsTab({ headers }: { headers: Record<string, string> }) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [search, setSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [bulkMode, setBulkMode] = useState(false);
    const [form, setForm] = useState({ email: '', name: '', notes: '', tags: '', bulk: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '30', search });
            const res = await fetch(`/api/admin/outreach/leads?${params}`, { headers });
            const data = await res.json();
            setLeads(data.leads || []);
            setTotal(data.total || 0);
        } catch { }
        setLoading(false);
    }, [page, search]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    const handleAdd = async () => {
        setError('');
        try {
            const body = bulkMode ? { bulk: form.bulk, tags: form.tags } : { email: form.email, name: form.name, notes: form.notes, tags: form.tags };
            const res = await fetch('/api/admin/outreach/leads', { method: 'POST', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setShowAdd(false);
            setForm({ email: '', name: '', notes: '', tags: '', bulk: '' });
            fetchLeads();
        } catch (e: any) { setError(e.message); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this lead?')) return;
        await fetch(`/api/admin/outreach/leads/${id}`, { method: 'DELETE', headers });
        fetchLeads();
    };

    const handleStatusChange = async (id: string, status: string) => {
        await fetch(`/api/admin/outreach/leads/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status }) });
        fetchLeads();
    };

    return (
        <div>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#71717a' }} />
                    <input
                        placeholder="Search leads..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        style={inputStyle({ paddingLeft: 32 })}
                    />
                </div>
                <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}>
                    <Plus size={14} /> Add Lead
                </button>
                <button onClick={() => { setBulkMode(true); setShowAdd(true); }} style={btnSecondary}>
                    <Upload size={14} /> Bulk Import
                </button>
            </div>

            {/* Add form */}
            {showAdd && (
                <div style={cardStyle}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                        {bulkMode ? '📋 Bulk Import' : '➕ Add Lead'}
                    </h3>
                    {bulkMode ? (
                        <>
                            <p style={{ fontSize: 11, color: '#71717a', marginBottom: 8 }}>
                                One per line: <code>email</code> or <code>email, name</code>
                            </p>
                            <textarea
                                value={form.bulk}
                                onChange={e => setForm({ ...form, bulk: e.target.value })}
                                rows={6}
                                placeholder="john@example.com, John Doe&#10;jane@example.com"
                                style={{ ...inputStyle(), width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                            />
                        </>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle()} />
                            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle()} />
                            <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle()} />
                        </div>
                    )}
                    <input placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={{ ...inputStyle(), marginTop: 8, width: '100%' }} />
                    {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={handleAdd} style={btnPrimary}>{bulkMode ? 'Import' : 'Save'}</button>
                        <button onClick={() => { setShowAdd(false); setBulkMode(false); setError(''); }} style={btnSecondary}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <span style={tagStyle('#3b82f6')}>Total: {total}</span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Tags</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Emails</th>
                            <th style={thStyle}>Added</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.map(lead => (
                            <tr key={lead.id} style={{ borderBottom: '1px solid #1e1e1e' }}>
                                <td style={tdStyle}>{lead.email}</td>
                                <td style={tdStyle}>{lead.name || '—'}</td>
                                <td style={tdStyle}>
                                    {lead.tags ? lead.tags.split(',').map(t => (
                                        <span key={t} style={{ ...tagStyle('#6366f1'), marginRight: 4 }}>{t.trim()}</span>
                                    )) : '—'}
                                </td>
                                <td style={tdStyle}>
                                    <select
                                        value={lead.status}
                                        onChange={e => handleStatusChange(lead.id, e.target.value)}
                                        style={{ ...inputStyle(), padding: '4px 8px', fontSize: 11, color: STATUS_COLORS[lead.status] || '#fff', fontWeight: 700 }}
                                    >
                                        <option value="new">New</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="replied">Replied</option>
                                        <option value="converted">Converted</option>
                                    </select>
                                </td>
                                <td style={tdStyle}>{lead._count?.emails || 0}</td>
                                <td style={tdStyle}>{new Date(lead.createdAt).toLocaleDateString()}</td>
                                <td style={tdStyle}>
                                    <button onClick={() => handleDelete(lead.id)} style={iconBtn} title="Delete">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {leads.length === 0 && (
                            <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#52525b', padding: 32 }}>
                                {loading ? 'Loading...' : 'No leads yet. Add your first lead above.'}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > 30 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnSecondary}>← Prev</button>
                    <span style={{ color: '#71717a', fontSize: 12, lineHeight: '36px' }}>Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={leads.length < 30} style={btnSecondary}>Next →</button>
                </div>
            )}
        </div>
    );
}

// ─── Templates Tab ──────────────────────────────────────────────────────────

function TemplatesTab({ headers }: { headers: Record<string, string> }) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', fromName: 'Ezzaky @ MyClaw', fromEmail: 'ezzaky@myclaw.host', subject: '', body: '' });
    const [error, setError] = useState('');

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/outreach/templates', { headers });
            setTemplates(await res.json());
        } catch { }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleSave = async () => {
        setError('');
        try {
            const payload = editId ? { ...form, id: editId } : form;
            const res = await fetch('/api/admin/outreach/templates', { method: 'POST', headers, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setShowForm(false);
            setEditId(null);
            setForm({ name: '', fromName: 'Ezzaky @ MyClaw', fromEmail: 'ezzaky@myclaw.host', subject: '', body: '' });
            fetchTemplates();
        } catch (e: any) { setError(e.message); }
    };

    const handleEdit = (tpl: Template) => {
        setForm({ name: tpl.name, fromName: tpl.fromName, fromEmail: tpl.fromEmail, subject: tpl.subject, body: tpl.body });
        setEditId(tpl.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        await fetch(`/api/admin/outreach/templates/${id}`, { method: 'DELETE', headers });
        fetchTemplates();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: '#71717a', fontSize: 13 }}>{templates.length} template(s)</span>
                <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', fromName: 'Ezzaky @ MyClaw', fromEmail: 'ezzaky@myclaw.host', subject: '', body: '' }); }} style={btnPrimary}>
                    <Plus size={14} /> New Template
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div style={cardStyle}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                        {editId ? '✏️ Edit Template' : '📝 New Template'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                            <label style={labelStyle}>Template Name</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Affiliate Pitch v1" style={inputStyle()} />
                        </div>
                        <div>
                            <label style={labelStyle}>Subject Line</label>
                            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Your subject here..." style={inputStyle()} />
                        </div>
                        <div>
                            <label style={labelStyle}>From Name</label>
                            <input value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} style={inputStyle()} />
                        </div>
                        <div>
                            <label style={labelStyle}>From Email</label>
                            <input value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })} style={inputStyle()} />
                        </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <label style={labelStyle}>Body (HTML) — use {'{{name}}'} for personalization</label>
                        <textarea
                            value={form.body}
                            onChange={e => setForm({ ...form, body: e.target.value })}
                            rows={10}
                            placeholder="<p>Hi {{name}},</p><p>We'd love to...</p>"
                            style={{ ...inputStyle(), width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                        />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={handleSave} style={btnPrimary}>{editId ? 'Update' : 'Create'}</button>
                        <button onClick={() => { setShowForm(false); setEditId(null); setError(''); }} style={btnSecondary}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Template Cards */}
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {templates.map(tpl => (
                    <div key={tpl.id} style={{ ...cardStyle, cursor: 'default' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{tpl.name}</h4>
                                <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>
                                    <Mail size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
                                    {tpl.fromName} &lt;{tpl.fromEmail}&gt;
                                </p>
                                <p style={{ fontSize: 12, color: '#d4d4d8', marginBottom: 4 }}>
                                    <strong>Subject:</strong> {tpl.subject}
                                </p>
                                <div style={{ fontSize: 11, color: '#71717a', maxHeight: 60, overflow: 'hidden', background: '#0a0a0a', padding: 8, borderRadius: 6, fontFamily: 'monospace' }}>
                                    {tpl.body.substring(0, 200)}...
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                                <button onClick={() => handleEdit(tpl)} style={iconBtn} title="Edit"><Edit3 size={14} /></button>
                                <button onClick={() => handleDelete(tpl.id)} style={iconBtn} title="Delete"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </div>
                ))}
                {templates.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#52525b', padding: 32 }}>
                        No templates yet. Create your first one above.
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Send & Track Tab ───────────────────────────────────────────────────────

function SendTrackTab({ headers }: { headers: Record<string, string> }) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [emails, setEmails] = useState<OutreachEmailRecord[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<any>(null);
    const [searchLeads, setSearchLeads] = useState('');
    const [selectedFailed, setSelectedFailed] = useState<Set<string>>(new Set());
    const [retrying, setRetrying] = useState(false);
    const [retryResult, setRetryResult] = useState<any>(null);

    const fetchAll = useCallback(async () => {
        try {
            const [leadsRes, tplRes, statsRes, emailsRes] = await Promise.all([
                fetch(`/api/admin/outreach/leads?limit=200&search=${searchLeads}`, { headers }),
                fetch('/api/admin/outreach/templates', { headers }),
                fetch('/api/admin/outreach/stats', { headers }),
                fetch('/api/admin/outreach/emails?limit=30', { headers }),
            ]);
            const leadsData = await leadsRes.json();
            setLeads(leadsData.leads || []);
            setTemplates(await tplRes.json());
            setStats(await statsRes.json());
            const emailsData = await emailsRes.json();
            setEmails(emailsData.emails || []);
        } catch { }
    }, [searchLeads]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const toggleLead = (id: string) => {
        setSelectedLeads(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedLeads.size === leads.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(leads.map(l => l.id)));
        }
    };

    const handleSend = async () => {
        if (selectedLeads.size === 0 || !selectedTemplate) return;
        if (!confirm(`Send email to ${selectedLeads.size} lead(s)?`)) return;

        setSending(true);
        setSendResult(null);
        try {
            const res = await fetch('/api/admin/outreach/send', {
                method: 'POST',
                headers,
                body: JSON.stringify({ leadIds: [...selectedLeads], templateId: selectedTemplate }),
            });
            const data = await res.json();
            setSendResult(data);
            setSelectedLeads(new Set());
            fetchAll();
        } catch (e: any) {
            setSendResult({ error: e.message });
        }
        setSending(false);
    };

    const toggleFailed = (id: string) => {
        setSelectedFailed(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAllFailed = () => {
        const failedIds = emails.filter(e => e.status === 'failed').map(e => e.id);
        if (selectedFailed.size === failedIds.length && failedIds.length > 0) {
            setSelectedFailed(new Set());
        } else {
            setSelectedFailed(new Set(failedIds));
        }
    };

    const handleRetry = async () => {
        if (selectedFailed.size === 0) return;
        if (!confirm(`Retry ${selectedFailed.size} failed email(s)?`)) return;

        setRetrying(true);
        setRetryResult(null);
        try {
            const res = await fetch('/api/admin/outreach/retry', {
                method: 'POST',
                headers,
                body: JSON.stringify({ emailIds: [...selectedFailed] }),
            });
            const data = await res.json();
            setRetryResult(data);
            setSelectedFailed(new Set());
            fetchAll();
        } catch (e: any) {
            setRetryResult({ error: e.message });
        }
        setRetrying(false);
    };

    const failedCount = emails.filter(e => e.status === 'failed').length;

    return (
        <div>
            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <StatCard label="Total Leads" value={stats.overview.totalLeads} color="#3b82f6" />
                    <StatCard label="Emails Sent" value={stats.overview.totalSent} color="#10b981" />
                    <StatCard label="Opened" value={stats.overview.totalOpened} color="#8b5cf6" />
                    <StatCard label="Open Rate" value={stats.overview.openRate + '%'} color="#f59e0b" />
                    <StatCard label="Failed" value={stats.overview.totalFailed} color="#ef4444" />
                </div>
            )}

            {/* Send Section */}
            <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    <Send size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Send Campaign
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Left: Select leads */}
                    <div>
                        <label style={labelStyle}>Select Leads ({selectedLeads.size} selected)</label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={12} style={{ position: 'absolute', left: 8, top: 9, color: '#52525b' }} />
                                <input
                                    placeholder="Filter leads..."
                                    value={searchLeads}
                                    onChange={e => setSearchLeads(e.target.value)}
                                    style={inputStyle({ paddingLeft: 28, fontSize: 11 })}
                                />
                            </div>
                            <button onClick={selectAll} style={{ ...btnSecondary, fontSize: 10, padding: '6px 10px' }}>
                                {selectedLeads.size === leads.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #27272a', borderRadius: 8, background: '#0a0a0a' }}>
                            {leads.map(lead => (
                                <label key={lead.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                    borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontSize: 12,
                                    background: selectedLeads.has(lead.id) ? '#1a1a2e' : 'transparent',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedLeads.has(lead.id)}
                                        onChange={() => toggleLead(lead.id)}
                                        style={{ accentColor: '#ef4444' }}
                                    />
                                    <span style={{ flex: 1, color: '#d4d4d8' }}>{lead.email}</span>
                                    <span style={{ color: '#71717a', fontSize: 10 }}>{lead.name}</span>
                                    <span style={{ ...tagStyle(STATUS_COLORS[lead.status] || '#555'), fontSize: 9 }}>{lead.status}</span>
                                </label>
                            ))}
                            {leads.length === 0 && (
                                <div style={{ padding: 20, textAlign: 'center', color: '#52525b', fontSize: 12 }}>No leads</div>
                            )}
                        </div>
                    </div>

                    {/* Right: Select template & send */}
                    <div>
                        <label style={labelStyle}>Email Template</label>
                        <select
                            value={selectedTemplate}
                            onChange={e => setSelectedTemplate(e.target.value)}
                            style={{ ...inputStyle(), width: '100%', marginBottom: 12 }}
                        >
                            <option value="">— Select template —</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
                            ))}
                        </select>

                        {selectedTemplate && (() => {
                            const tpl = templates.find(t => t.id === selectedTemplate);
                            return tpl ? (
                                <div style={{ background: '#0a0a0a', border: '1px solid #27272a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                    <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>
                                        <strong>From:</strong> {tpl.fromName} &lt;{tpl.fromEmail}&gt;
                                    </p>
                                    <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 6 }}>
                                        <strong>Subject:</strong> {tpl.subject}
                                    </p>
                                    <div style={{ fontSize: 11, color: '#71717a', maxHeight: 120, overflow: 'auto', fontFamily: 'monospace', lineHeight: 1.5 }}>
                                        {tpl.body.substring(0, 400)}{tpl.body.length > 400 ? '...' : ''}
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        <button
                            onClick={handleSend}
                            disabled={sending || selectedLeads.size === 0 || !selectedTemplate}
                            style={{
                                ...btnPrimary,
                                width: '100%',
                                opacity: (sending || selectedLeads.size === 0 || !selectedTemplate) ? 0.5 : 1,
                                fontSize: 13,
                                padding: '12px 16px',
                            }}
                        >
                            {sending ? (
                                <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                            ) : (
                                <><Send size={14} /> Send to {selectedLeads.size} lead(s)</>
                            )}
                        </button>

                        {sendResult && (
                            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: sendResult.error ? '#2d1919' : '#192d19', border: `1px solid ${sendResult.error ? '#7f1d1d' : '#1d7f1d'}`, fontSize: 12 }}>
                                {sendResult.error ? (
                                    <span style={{ color: '#ef4444' }}>❌ {sendResult.error}</span>
                                ) : (
                                    <span style={{ color: '#10b981' }}>
                                        ✅ Sent {sendResult.total} email(s)!
                                        {sendResult.results?.filter((r: any) => r.status === 'failed').length > 0 && (
                                            <span style={{ color: '#f59e0b' }}> ({sendResult.results.filter((r: any) => r.status === 'failed').length} failed)</span>
                                        )}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Email Activity */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                    📧 Recent Email Activity
                </h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {failedCount > 0 && (
                        <button onClick={selectAllFailed} style={{ ...btnSecondary, fontSize: 10, padding: '6px 10px' }}>
                            {selectedFailed.size === failedCount ? 'Deselect All Failed' : `Select All Failed (${failedCount})`}
                        </button>
                    )}
                    {selectedFailed.size > 0 && (
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            style={{
                                ...btnPrimary,
                                background: '#f59e0b',
                                fontSize: 11,
                                padding: '6px 14px',
                                opacity: retrying ? 0.5 : 1,
                            }}
                        >
                            {retrying ? (
                                <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Retrying...</>
                            ) : (
                                <><RefreshCw size={12} /> Retry {selectedFailed.size} Failed</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {retryResult && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: retryResult.error ? '#2d1919' : '#192d19', border: `1px solid ${retryResult.error ? '#7f1d1d' : '#1d7f1d'}`, fontSize: 12 }}>
                    {retryResult.error ? (
                        <span style={{ color: '#ef4444' }}>❌ {retryResult.error}</span>
                    ) : (
                        <span style={{ color: '#10b981' }}>
                            ✅ Retried {retryResult.total} email(s)!
                            {retryResult.results?.filter((r: any) => r.status === 'sent').length > 0 && (
                                <span> ({retryResult.results.filter((r: any) => r.status === 'sent').length} succeeded)</span>
                            )}
                        </span>
                    )}
                </div>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: 36 }}></th>
                            <th style={thStyle}>To</th>
                            <th style={thStyle}>Subject</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Opens</th>
                            <th style={thStyle}>Sent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {emails.map(em => (
                            <tr key={em.id} style={{ borderBottom: '1px solid #1e1e1e', background: selectedFailed.has(em.id) ? '#2d1919' : 'transparent' }}>
                                <td style={tdStyle}>
                                    {em.status === 'failed' && (
                                        <input
                                            type="checkbox"
                                            checked={selectedFailed.has(em.id)}
                                            onChange={() => toggleFailed(em.id)}
                                            style={{ accentColor: '#f59e0b' }}
                                        />
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    <span>{em.lead?.email || '—'}</span>
                                    {em.lead?.name && <span style={{ color: '#71717a', fontSize: 10, marginLeft: 6 }}>{em.lead.name}</span>}
                                </td>
                                <td style={tdStyle}>{em.subject}</td>
                                <td style={tdStyle}>
                                    <span style={{
                                        ...tagStyle(em.status === 'sent' ? '#10b981' : em.status === 'failed' ? '#ef4444' : '#71717a'),
                                    }}>
                                        {em.status}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    {em.openCount > 0 ? (
                                        <span style={{ color: '#8b5cf6', fontWeight: 700 }}>
                                            <Eye size={12} style={{ verticalAlign: -2, marginRight: 2 }} />
                                            {em.openCount}x
                                        </span>
                                    ) : (
                                        <span style={{ color: '#52525b' }}>—</span>
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    {em.sentAt ? new Date(em.sentAt).toLocaleString() : '—'}
                                </td>
                            </tr>
                        ))}
                        {emails.length === 0 && (
                            <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#52525b', padding: 32 }}>
                                No emails sent yet.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
    return (
        <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 12,
            padding: '16px 20px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: 24, fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
        </div>
    );
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

const inputStyle = (extra?: any): React.CSSProperties => ({
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: '#fff',
    outline: 'none',
    width: '100%',
    ...extra,
});

const cardStyle: React.CSSProperties = {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
};

const btnPrimary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#ef4444', color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '8px 16px', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const btnSecondary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#27272a', color: '#a1a1aa',
    border: '1px solid #3f3f46', borderRadius: 8,
    padding: '8px 16px', fontSize: 12, fontWeight: 700,
    cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: '#71717a',
    cursor: 'pointer', padding: 6, borderRadius: 6,
};

const tagStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    fontSize: 10, fontWeight: 700,
    color,
    background: color + '15',
    border: `1px solid ${color}30`,
    borderRadius: 6, padding: '2px 8px',
    textTransform: 'uppercase', letterSpacing: '0.05em',
});

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: '#71717a', textTransform: 'uppercase',
    letterSpacing: '0.1em', marginBottom: 4,
};

const tableStyle: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse',
    background: '#18181b', borderRadius: 12,
    overflow: 'hidden',
};

const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 16px',
    fontSize: 10, fontWeight: 700,
    color: '#71717a', textTransform: 'uppercase',
    letterSpacing: '0.1em', borderBottom: '1px solid #27272a',
    background: '#111',
};

const tdStyle: React.CSSProperties = {
    padding: '10px 16px', fontSize: 12, color: '#d4d4d8',
};
