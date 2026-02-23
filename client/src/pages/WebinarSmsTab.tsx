/**
 * Webinar SMS Admin Tab — Lazy-loaded from UnifiedAdmin
 * 
 * Sub-tabs:
 * 1. Dashboard — overview stats
 * 2. Registrants — list, search, import, add
 * 3. Templates — CRUD SMS templates
 * 4. Campaigns — send and track SMS campaigns
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Users,
  MessageSquare,
  Send,
  BarChart3,
  Plus,
  Search,
  Loader2,
  Upload,
  RefreshCw,
  Trash2,
  Edit,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Zap,
} from 'lucide-react';

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

function DashboardOverview() {
  const { data: stats, isLoading } = trpc.webinarSms.getDashboardStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Registrants', value: stats?.totalRegistrants ?? 0, icon: Users, color: 'text-blue-600' },
    { label: 'SMS Campaigns', value: stats?.totalCampaigns ?? 0, icon: Send, color: 'text-green-600' },
    { label: 'Templates', value: stats?.totalTemplates ?? 0, icon: FileText, color: 'text-purple-600' },
    { label: 'Total SMS Sent', value: stats?.totalSmsSent ?? 0, icon: MessageSquare, color: 'text-amber-600' },
    { label: 'Opted Out', value: stats?.optedOutCount ?? 0, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map(card => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <div>
                <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Registrants Tab ─────────────────────────────────────────────────────────

function RegistrantsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Add form state
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', webinarName: '' });
  const [csvText, setCsvText] = useState('');

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.webinarSms.listRegistrants.useQuery({
    page,
    pageSize: 50,
    source: sourceFilter === 'all' ? undefined : sourceFilter,
    search: search || undefined,
  });

  const addMutation = trpc.webinarSms.addRegistrant.useMutation({
    onSuccess: () => {
      toast.success('Registrant added');
      setShowAddDialog(false);
      setAddForm({ name: '', email: '', phone: '', webinarName: '' });
      utils.webinarSms.listRegistrants.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.webinarSms.deleteRegistrants.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} registrant(s)`);
      setSelectedIds([]);
      utils.webinarSms.listRegistrants.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const csvMutation = trpc.webinarSms.importCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} registrants`);
      setShowCsvDialog(false);
      setCsvText('');
      utils.webinarSms.listRegistrants.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCsvImport = () => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      toast.error('CSV must have a header row and at least one data row');
      return;
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const nameIdx = header.findIndex(h => h === 'name' || h === 'full name');
    const emailIdx = header.findIndex(h => h === 'email');
    const phoneIdx = header.findIndex(h => h === 'phone' || h === 'phone number');

    if (nameIdx === -1 || phoneIdx === -1) {
      toast.error('CSV must have "name" and "phone" columns');
      return;
    }

    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      return {
        name: cols[nameIdx] || '',
        email: emailIdx >= 0 ? cols[emailIdx] : undefined,
        phone: cols[phoneIdx] || '',
      };
    }).filter(r => r.name && r.phone);

    if (rows.length === 0) {
      toast.error('No valid rows found');
      return;
    }

    csvMutation.mutate({ rows });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (!data?.registrants) return;
    if (selectedIds.length === data.registrants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.registrants.map(r => r.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="webinarjam">WebinarJam</SelectItem>
            <SelectItem value="zapier">Zapier</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="csv">CSV Import</SelectItem>
          </SelectContent>
        </Select>

        {selectedIds.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate({ ids: selectedIds })}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete ({selectedIds.length})
          </Button>
        )}

        <div className="flex gap-2 ml-auto">
          <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-1" /> CSV Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import from CSV</DialogTitle>
                <DialogDescription>
                  Paste CSV data with columns: name, email (optional), phone
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="name,email,phone&#10;John Smith,john@example.com,5551234567&#10;Jane Doe,jane@example.com,5559876543"
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={8}
              />
              <DialogFooter>
                <Button onClick={handleCsvImport} disabled={csvMutation.isPending}>
                  {csvMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <WebinarJamImportButton />

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Registrant</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="5551234567" />
                </div>
                <div>
                  <Label>Webinar Name</Label>
                  <Input value={addForm.webinarName} onChange={e => setAddForm(f => ({ ...f, webinarName: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => addMutation.mutate({
                    name: addForm.name,
                    email: addForm.email || undefined,
                    phone: addForm.phone,
                    webinarName: addForm.webinarName || undefined,
                  })}
                  disabled={addMutation.isPending || !addForm.name || !addForm.phone}
                >
                  {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Add Registrant
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === (data?.registrants?.length ?? 0) && selectedIds.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Webinar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.registrants?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No registrants found. Import from WebinarJam, CSV, or add manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.registrants?.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                      <TableCell className="text-sm">{r.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{r.webinarName || '—'}</TableCell>
                      <TableCell>
                        {r.optedOut ? (
                          <Badge variant="destructive" className="text-xs">Opted Out</Badge>
                        ) : r.attended ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Attended</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Registered</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── WebinarJam Import Button ────────────────────────────────────────────────

function WebinarJamImportButton() {
  const [open, setOpen] = useState(false);
  const [selectedWebinar, setSelectedWebinar] = useState<{ id: string; name: string } | null>(null);
  const utils = trpc.useUtils();

  const { data: webinarsData, isLoading: loadingWebinars } = trpc.webinarSms.listWebinars.useQuery(
    undefined,
    { enabled: open }
  );

  const importMutation = trpc.webinarSms.importFromWebinarJam.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} registrants (${data.skipped} duplicates skipped)`);
      setOpen(false);
      setSelectedWebinar(null);
      utils.webinarSms.listRegistrants.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" /> WebinarJam
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from WebinarJam</DialogTitle>
          <DialogDescription>
            Select a webinar to import its registrants. Duplicates are automatically skipped.
          </DialogDescription>
        </DialogHeader>

        {loadingWebinars ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {webinarsData?.webinars?.map((w: any) => (
              <div
                key={w.webinar_id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedWebinar?.id === String(w.webinar_id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedWebinar({ id: String(w.webinar_id), name: w.name })}
              >
                <p className="font-medium text-sm">{w.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {w.webinar_id}
                </p>
              </div>
            ))}
            {(!webinarsData?.webinars || webinarsData.webinars.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No webinars found. Check your WebinarJam API key.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => {
              if (!selectedWebinar) return;
              importMutation.mutate({
                webinarId: selectedWebinar.id,
                webinarName: selectedWebinar.name,
              });
            }}
            disabled={!selectedWebinar || importMutation.isPending}
          >
            {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Import Registrants
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Templates Tab ───────────────────────────────────────────────────────────

function TemplatesTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', body: '', category: 'custom' as string });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.webinarSms.listTemplates.useQuery();

  const createMutation = trpc.webinarSms.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template created');
      setShowCreate(false);
      setForm({ name: '', body: '', category: 'custom' });
      utils.webinarSms.listTemplates.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.webinarSms.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template updated');
      setEditId(null);
      setForm({ name: '', body: '', category: 'custom' });
      utils.webinarSms.listTemplates.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.webinarSms.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template deleted');
      utils.webinarSms.listTemplates.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const charCount = form.body.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SMS Templates</h3>
          <p className="text-sm text-muted-foreground">Create reusable message templates with {'{{name}}'} placeholders</p>
        </div>
        <Dialog open={showCreate || editId !== null} onOpenChange={(open) => {
          if (!open) { setShowCreate(false); setEditId(null); setForm({ name: '', body: '', category: 'custom' }); }
          else setShowCreate(true);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Edit Template' : 'Create Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Template Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Webinar Reminder" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reminder">Reminder</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="promo">Promo</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message Body</Label>
                <Textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Hey {{name}}, your webinar starts in 1 hour! Join here: [link]"
                  rows={4}
                  maxLength={320}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    Variables: {'{{name}}'}, {'{{fullname}}'}, {'{{email}}'}
                  </p>
                  <p className={`text-xs ${charCount > 160 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {charCount}/320 ({smsSegments} SMS segment{smsSegments > 1 ? 's' : ''})
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (editId) {
                    updateMutation.mutate({ id: editId, ...form, category: form.category as any });
                  } else {
                    createMutation.mutate({ ...form, category: form.category as any });
                  }
                }}
                disabled={createMutation.isPending || updateMutation.isPending || !form.name || !form.body}
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : data?.templates?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No templates yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data?.templates?.map(t => (
            <Card key={t.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{t.name}</h4>
                      <Badge variant="outline" className="text-xs">{t.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.body.length} chars · {Math.ceil(t.body.length / 160)} segment{Math.ceil(t.body.length / 160) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditId(t.id);
                        setForm({ name: t.name, body: t.body, category: t.category });
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this template?')) {
                          deleteMutation.mutate({ id: t.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaigns Tab ───────────────────────────────────────────────────────────

function CampaignsTab() {
  const [showSend, setShowSend] = useState(false);
  const [showTestSms, setShowTestSms] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // Send form state
  const [sendForm, setSendForm] = useState({
    name: '',
    messageBody: '',
    source: 'all' as string,
    webinarId: '',
    attended: 'all' as string,
  });

  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');

  const utils = trpc.useUtils();

  const { data: campaignsData, isLoading } = trpc.webinarSms.listCampaigns.useQuery({ page, pageSize: 20 });
  const { data: templatesData } = trpc.webinarSms.listTemplates.useQuery();
  const { data: campaignDetail } = trpc.webinarSms.getCampaignDetails.useQuery(
    { id: selectedCampaignId! },
    { enabled: selectedCampaignId !== null }
  );

  const sendMutation = trpc.webinarSms.sendCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed} failed`);
      setShowSend(false);
      setSendForm({ name: '', messageBody: '', source: 'all', webinarId: '', attended: 'all' });
      utils.webinarSms.listCampaigns.invalidate();
      utils.webinarSms.getDashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testSmsMutation = trpc.webinarSms.sendTestSms.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Test SMS sent!');
        setShowTestSms(false);
      } else {
        toast.error(`Failed: ${data.error}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SMS Campaigns</h3>
          <p className="text-sm text-muted-foreground">Send and track SMS messages to webinar registrants</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showTestSms} onOpenChange={setShowTestSms}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4 mr-1" /> Test SMS
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Test SMS</DialogTitle>
                <DialogDescription>Send a single test message to verify your SimpleTexting setup.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Phone Number</Label>
                  <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="5551234567" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea value={testMessage} onChange={e => setTestMessage(e.target.value)} placeholder="Test message..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => testSmsMutation.mutate({ phone: testPhone, message: testMessage })}
                  disabled={testSmsMutation.isPending || !testPhone || !testMessage}
                >
                  {testSmsMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Send Test
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showSend} onOpenChange={setShowSend}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Send className="w-4 h-4 mr-1" /> New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Send SMS Campaign</DialogTitle>
                <DialogDescription>
                  Compose a message and select recipients. Messages are sent via SimpleTexting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Campaign Name</Label>
                  <Input
                    value={sendForm.name}
                    onChange={e => setSendForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Feb 23 Webinar Reminder"
                  />
                </div>

                {/* Template selector */}
                {templatesData?.templates && templatesData.templates.length > 0 && (
                  <div>
                    <Label>Use Template (optional)</Label>
                    <Select onValueChange={v => {
                      const tmpl = templatesData.templates.find(t => String(t.id) === v);
                      if (tmpl) setSendForm(f => ({ ...f, messageBody: tmpl.body }));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesData.templates.map(t => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Message Body</Label>
                  <Textarea
                    value={sendForm.messageBody}
                    onChange={e => setSendForm(f => ({ ...f, messageBody: e.target.value }))}
                    placeholder="Hey {{name}}, don't miss our webinar today at 3pm EST! Join here: [link]"
                    rows={4}
                    maxLength={320}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {sendForm.messageBody.length}/320 · Variables: {'{{name}}'}, {'{{fullname}}'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Filter by Source</Label>
                    <Select value={sendForm.source} onValueChange={v => setSendForm(f => ({ ...f, source: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="webinarjam">WebinarJam</SelectItem>
                        <SelectItem value="zapier">Zapier</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Filter by Attendance</Label>
                    <Select value={sendForm.attended} onValueChange={v => setSendForm(f => ({ ...f, attended: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="attended">Attended</SelectItem>
                        <SelectItem value="not_attended">Did Not Attend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    const filter: any = {};
                    if (sendForm.source !== 'all') filter.source = sendForm.source;
                    if (sendForm.attended === 'attended') filter.attended = 1;
                    if (sendForm.attended === 'not_attended') filter.attended = 0;

                    sendMutation.mutate({
                      name: sendForm.name,
                      messageBody: sendForm.messageBody,
                      filter: Object.keys(filter).length > 0 ? filter : undefined,
                    });
                  }}
                  disabled={sendMutation.isPending || !sendForm.name || !sendForm.messageBody}
                >
                  {sendMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" /> Send Campaign
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Campaign Detail Panel */}
      {selectedCampaignId && campaignDetail && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{campaignDetail.campaign.name}</CardTitle>
                <CardDescription>
                  Sent {new Date(campaignDetail.campaign.createdAt).toLocaleString()} · 
                  {campaignDetail.campaign.sentCount} delivered · {campaignDetail.campaign.failedCount} failed
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCampaignId(null)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-3 rounded-lg mb-3 text-sm">{campaignDetail.campaign.messageBody}</div>
            <div className="max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignDetail.deliveries.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.phone}</TableCell>
                      <TableCell>
                        {d.deliveryStatus === 'sent' ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" /> Sent
                          </Badge>
                        ) : d.deliveryStatus === 'failed' ? (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-1" /> Failed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" /> {d.deliveryStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-red-500">{d.error || '—'}</TableCell>
                      <TableCell className="text-xs">{new Date(d.sentAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : campaignsData?.campaigns?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No campaigns yet. Send your first SMS campaign.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignsData?.campaigns?.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCampaignId(c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.totalRecipients}</TableCell>
                  <TableCell className="text-green-600">{c.sentCount}</TableCell>
                  <TableCell className="text-red-500">{c.failedCount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={c.status === 'completed' ? 'default' : c.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function WebinarSmsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Webinar SMS System
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage webinar registrants and send SMS campaigns via SimpleTexting
        </p>
      </div>

      <DashboardOverview />

      <Tabs defaultValue="registrants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registrants">
            <Users className="w-4 h-4 mr-1" /> Registrants
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 mr-1" /> Templates
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Send className="w-4 h-4 mr-1" /> Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrants">
          <RegistrantsTab />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
