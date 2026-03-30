import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Lead, LeadStatus } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { motion } from 'motion/react';
import { Download, Search, Loader2, LogOut, Zap, ArrowUpDown, CheckCircle, Trash2, X, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(10);
  const [model, setModel] = useState('meta/llama-3.1-70b-instruct');
  const [availableModels, setAvailableModels] = useState<{ id: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Review modal state
  const [pendingLeads, setPendingLeads] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sort state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
    fetchModels();
  }, [user]);

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          // Exclude base, embedding, reward, vision, and other non-chat models
          // that will throw a 404 on the v1/chat/completions endpoint
          const validModels = data.data.filter((m: any) => {
            const lowerId = m.id.toLowerCase();
            const blockedTerms = ['embed', 'reward', 'guard', 'clip', 'parse', 'pii', 'vl', 'a3b', 'vision', 'tts', 'asr', 'qa-'];
            return !blockedTerms.some(term => lowerId.includes(term));
          });
          
          setAvailableModels(validModels);
          
          // Try to keep the currently selected model if valid, else fallback to llama 3.1 70b, or the first valid model.
          if (validModels.length > 0 && !validModels.some((m: any) => m.id === model)) {
             const defaultModel = validModels.find((m: any) => m.id.includes('llama-3.1-70b-instruct')) || validModels[0];
             setModel(defaultModel.id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch models", e);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchLeads = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') {
          console.log('Leads table does not exist yet. Please create it in Supabase.');
        } else {
          console.error('Error fetching leads:', error);
        }
      } else {
        setLeads(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry || !location || !count) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/generate-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, location, count, model }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate leads');
      }

      const data = await response.json();
      const generatedLeads = data.leads;

      // Open review modal instead of saving directly
      setPendingLeads(generatedLeads.map((lead: any, idx: number) => ({ ...lead, _key: idx })));
      setShowReview(true);
    } catch (error) {
      console.error(error);
      alert('Error generating leads. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const updatePendingLead = (key: number, field: string, value: string) => {
    setPendingLeads(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));
  };

  const removePendingLead = (key: number) => {
    setPendingLeads(prev => prev.filter(l => l._key !== key));
  };

  const savePendingLeads = async () => {
    if (pendingLeads.length === 0) return;
    setSaving(true);
    try {
      const leadsToInsert = pendingLeads.map((lead: any) => ({
        user_id: user?.id,
        business_name: lead.business_name,
        email: lead.email || null,
        mobile: lead.mobile || null,
        website: lead.website || null,
        address: lead.address || null,
        industry,
        location,
        status: LeadStatus.Pending,
      }));

      if (supabase && user) {
        const { error } = await supabase.from('leads').insert(leadsToInsert);
        if (error) {
          console.error('Error saving leads to Supabase:', error);
          const newLeads = leadsToInsert.map((l: any) => ({ ...l, id: Math.random().toString(), created_at: new Date().toISOString() }));
          setLeads(prev => [...newLeads, ...prev]);
        } else {
          fetchLeads();
        }
      } else {
        const newLeads = leadsToInsert.map((l: any) => ({ ...l, id: Math.random().toString(), created_at: new Date().toISOString(), industry, location, user_id: user?.id || 'anon', status: LeadStatus.Pending }));
        setLeads(prev => [...newLeads, ...prev]);
      }

      setShowReview(false);
      setPendingLeads([]);
    } catch (err) {
      console.error(err);
      alert('Error saving leads.');
    } finally {
      setSaving(false);
    }
  };

  const updateLeadStatus = async (id: string, newStatus: LeadStatus) => {
    // Optimistic update
    setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
    
    if (supabase) {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating status:', error);
        fetchLeads(); // Revert on error
      }
    }
  };

  const getStatusText = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.Pending: return 'Pending';
      case LeadStatus.Contacted: return 'Contacted';
      case LeadStatus.FollowUp: return 'Follow Up';
      case LeadStatus.Replied: return 'Replied';
      case LeadStatus.Confirmed: return 'Confirmed';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.Pending: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      case LeadStatus.Contacted: return 'bg-blue-50 text-blue-700 border-blue-200';
      case LeadStatus.FollowUp: return 'bg-amber-50 text-amber-700 border-amber-200';
      case LeadStatus.Replied: return 'bg-purple-50 text-purple-700 border-purple-200';
      case LeadStatus.Confirmed: return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const handleSort = (key: keyof Lead) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedLeads = React.useMemo(() => {
    let sortableLeads = [...leads];
    if (sortConfig !== null) {
      sortableLeads.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableLeads;
  }, [leads, sortConfig]);

  const filteredLeads = sortedLeads.filter(lead => {
    const searchLower = searchQuery.toLowerCase();
    return (
      lead.business_name?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.mobile?.toLowerCase().includes(searchLower) ||
      lead.location?.toLowerCase().includes(searchLower)
    );
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredLeads.map(l => ({
      'Business Name': l.business_name,
      'Email': l.email || '',
      'Mobile': l.mobile || '',
      'Website': l.website || '',
      'Address': l.address || '',
      'Industry': l.industry || '',
      'Location': l.location || '',
      'Status': getStatusText(l.status),
      'Generated At': new Date(l.created_at).toLocaleString()
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `leads_export_${new Date().getTime()}.xlsx`);
  };

  // Simple email format check
  const isValidEmail = (email: string | null | undefined) => {
    if (!email) return true; // null/empty is allowed
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">

      {/* ── Review Modal ── */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-6xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Review Generated Leads</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Edit or remove leads before saving. Highlighted rows have suspicious emails.
                </p>
              </div>
              <button
                onClick={() => { setShowReview(false); setPendingLeads([]); }}
                className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-6 px-6 py-3 bg-zinc-50 text-sm border-b border-zinc-100">
              <span className="font-medium text-zinc-700">{pendingLeads.length} leads ready</span>
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {pendingLeads.filter(l => !isValidEmail(l.email)).length} suspicious email(s)
              </span>
              <span className="text-zinc-400 text-xs ml-auto">Click any cell to edit inline</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs text-zinc-500 font-medium uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Business Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Mobile</th>
                    <th className="px-4 py-3 text-left">Website</th>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pendingLeads.map((lead, idx) => {
                    const emailOk = isValidEmail(lead.email);
                    return (
                      <tr key={lead._key} className={cn("group hover:bg-zinc-50/80 transition-colors", !emailOk && "bg-amber-50/60")}>
                        <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{idx + 1}</td>
                        {/* Business Name */}
                        <td className="px-4 py-2.5 min-w-[160px]">
                          <input
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 focus:border-zinc-500 outline-none py-0.5 text-zinc-800 font-medium transition-colors"
                            value={lead.business_name || ''}
                            onChange={e => updatePendingLead(lead._key, 'business_name', e.target.value)}
                          />
                        </td>
                        {/* Email */}
                        <td className="px-4 py-2.5 min-w-[180px]">
                          <div className="flex items-center gap-1">
                            {!emailOk && <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                            <input
                              className={cn(
                                "w-full bg-transparent border-0 border-b outline-none py-0.5 transition-colors",
                                emailOk
                                  ? "border-transparent hover:border-zinc-300 focus:border-zinc-500 text-zinc-700"
                                  : "border-amber-300 hover:border-amber-500 focus:border-amber-600 text-amber-800"
                              )}
                              value={lead.email || ''}
                              onChange={e => updatePendingLead(lead._key, 'email', e.target.value)}
                              placeholder="no email"
                            />
                          </div>
                        </td>
                        {/* Mobile */}
                        <td className="px-4 py-2.5 min-w-[130px]">
                          <input
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 focus:border-zinc-500 outline-none py-0.5 text-zinc-700 transition-colors"
                            value={lead.mobile || ''}
                            onChange={e => updatePendingLead(lead._key, 'mobile', e.target.value)}
                            placeholder="none"
                          />
                        </td>
                        {/* Website */}
                        <td className="px-4 py-2.5 min-w-[150px]">
                          <input
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 focus:border-zinc-500 outline-none py-0.5 text-zinc-700 transition-colors"
                            value={lead.website || ''}
                            onChange={e => updatePendingLead(lead._key, 'website', e.target.value)}
                            placeholder="none"
                          />
                        </td>
                        {/* Address */}
                        <td className="px-4 py-2.5 min-w-[200px]">
                          <input
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 focus:border-zinc-500 outline-none py-0.5 text-zinc-700 transition-colors"
                            value={lead.address || ''}
                            onChange={e => updatePendingLead(lead._key, 'address', e.target.value)}
                            placeholder="none"
                          />
                        </td>
                        {/* Delete */}
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => removePendingLead(lead._key)}
                            className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove this lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-zinc-400 text-sm">
                        All leads removed. Close the modal to generate again.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between p-6 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
              <button
                onClick={() => { setShowReview(false); setPendingLeads([]); }}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                Discard all
              </button>
              <Button
                onClick={savePendingLeads}
                disabled={saving || pendingLeads.length === 0}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Save {pendingLeads.length} Lead{pendingLeads.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900">LeadGen AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 hidden sm:inline-block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-zinc-500 hover:text-zinc-900">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Generator Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200"
        >
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Generate New Leads</h2>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry / Domain</Label>
              <Input 
                id="industry" 
                placeholder="e.g., Real Estate, Hotels" 
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location" 
                placeholder="e.g., San Francisco, CA" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">Number of Leads</Label>
              <Input 
                id="count" 
                type="number" 
                min="1" 
                max="50" 
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={modelsLoading || availableModels.length === 0}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))
                ) : (
                  <option value="meta/llama-3.1-70b-instruct">Loading models...</option>
                )}
              </select>
            </div>
            <Button type="submit" disabled={generating} className="w-full">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Leads
                </>
              )}
            </Button>
          </form>
        </motion.section>

        {/* Dashboard Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-zinc-200 flex-1 flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                placeholder="Search leads..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={exportToExcel} disabled={filteredLeads.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-zinc-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('business_name')}>
                    <div className="flex items-center gap-1">Business Name <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">Email <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('mobile')}>
                    <div className="flex items-center gap-1">Mobile <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('website')}>
                    <div className="flex items-center gap-1">Website <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('address')}>
                    <div className="flex items-center gap-1">Address <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                      No leads found. Generate some to get started!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.business_name}</TableCell>
                      <TableCell>{lead.email || <span className="text-zinc-300">-</span>}</TableCell>
                      <TableCell>{lead.mobile || <span className="text-zinc-300">-</span>}</TableCell>
                      <TableCell>
                        {lead.website ? (
                          <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {lead.website}
                          </a>
                        ) : <span className="text-zinc-300">-</span>}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={lead.address || ''}>
                        {lead.address || <span className="text-zinc-300">-</span>}
                      </TableCell>
                      <TableCell>
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, parseInt(e.target.value))}
                          className={cn(
                            "text-xs font-medium rounded-full px-2.5 py-1 border appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1",
                            getStatusColor(lead.status)
                          )}
                        >
                          <option value={LeadStatus.Pending}>Pending</option>
                          <option value={LeadStatus.Contacted}>Contacted</option>
                          <option value={LeadStatus.FollowUp}>Follow Up</option>
                          <option value={LeadStatus.Replied}>Replied</option>
                          <option value={LeadStatus.Confirmed}>Confirmed</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
