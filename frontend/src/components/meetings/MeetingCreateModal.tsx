import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { meetingApi } from '@/services/meeting.api';
import type { Meeting } from '@/types/meeting';
import { ModernTimePicker } from '@/components/ui/ModernTimePicker';
import {
  X,
  Calendar,
  Clock,
  Building2,
  Repeat,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Check,
  ChevronDown
} from 'lucide-react';

const FALLBACK_PRODUCTS = [
  { id: 'p1000000-0000-0000-0000-000000000001', product_name: 'Atorvastatin 20mg Film-Coated Tablets', brand_name: 'Lipitor', product_code: 'PROD-2026-000001' },
  { id: 'p1000000-0000-0000-0000-000000000002', product_name: 'Semaglutide 1.0mg/0.75mL Prefilled Pen', brand_name: 'Ozempic', product_code: 'PROD-2026-000002' },
  { id: 'p1000000-0000-0000-0000-000000000003', product_name: 'Amoxicillin / Clavulanate 875mg/125mg Tablets', brand_name: 'Augmentin', product_code: 'PROD-2026-000003' },
  { id: 'p1000000-0000-0000-0000-000000000007', product_name: 'Empagliflozin 10mg Tablets', brand_name: 'Jardiance', product_code: 'PROD-2026-000007' }
];

const FALLBACK_CUSTOMERS = [
  { id: 'c1000000-0000-0000-0000-000000000001', name: 'Novo Nordisk A/S', tier: 'Tier 1 Global Sponsor' },
  { id: 'c1000000-0000-0000-0000-000000000002', name: 'Sanofi SA', tier: 'Tier 1 Global CDMO Client' },
  { id: 'c1000000-0000-0000-0000-000000000003', name: 'AstraZeneca PLC', tier: 'Tier 1 Global Pharma' },
  { id: 'c1000000-0000-0000-0000-000000000004', name: 'Novartis AG', tier: 'Strategic Partner' },
  { id: 'c1000000-0000-0000-0000-000000000005', name: 'Pfizer Global Supply', tier: 'Tier 1 Global Sponsor' },
  { id: 'c1000000-0000-0000-0000-000000000006', name: 'F. Hoffmann-La Roche Ltd', tier: 'Strategic Partner' }
];

const FALLBACK_OPPORTUNITIES = [
  { id: 'o1000000-0000-0000-0000-000000000001', title: 'Semaglutide Formulation & Fill-Finish Scale-up (Novo Nordisk)', opportunity_code: 'OPP-2026-001' },
  { id: 'o1000000-0000-0000-0000-000000000002', title: 'Atorvastatin 20mg EU Regulatory Transfer & Launch (Sanofi)', opportunity_code: 'OPP-2026-002' },
  { id: 'o1000000-0000-0000-0000-000000000003', title: 'Amoxicillin/Clavulanate Sterile Batch Capacity (AstraZeneca)', opportunity_code: 'OPP-2026-003' }
];

const FALLBACK_RFQS = [
  { id: 'r1000000-0000-0000-0000-000000000001', rfq_number: 'RFQ-2026-0041', customer_name: 'Novo Nordisk A/S' },
  { id: 'r1000000-0000-0000-0000-000000000002', rfq_number: 'RFQ-2026-0082', customer_name: 'Sanofi SA' },
  { id: 'r1000000-0000-0000-0000-000000000003', rfq_number: 'RFQ-2026-0105', customer_name: 'AstraZeneca PLC' }
];

interface MeetingCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated: (meeting: Meeting) => void;
}

export const MeetingCreateModal: React.FC<MeetingCreateModalProps> = ({
  isOpen,
  onClose,
  onMeetingCreated,
}) => {
  const { session } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('Customer Meeting');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [objective, setObjective] = useState('');
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [agenda, setAgenda] = useState('');
  const [externalOrgs, setExternalOrgs] = useState('');

  // 3-Box Template & Input Refs
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);

  // Linked BDIQ entities
  const [customerId, setCustomerId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [rfqId, setRfqId] = useState('');
  const [productId, setProductId] = useState('');

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('WEEKLY');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Dropdown options
  const [customers, setCustomers] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    loadDropdownData();
  }, [isOpen]);

  const loadDropdownData = async () => {
    try {
      const token = session?.access_token;
      const headers = { Authorization: `Bearer ${token || 'dev-admin-token'}` };

      // Load products
      fetch('http://localhost:4000/api/products', { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const list = Array.isArray(d) ? d : (d?.products || d?.data || []);
          setProducts(list.length > 0 ? list : FALLBACK_PRODUCTS);
        })
        .catch(() => setProducts(FALLBACK_PRODUCTS));

      // Load customers
      fetch('http://localhost:4000/api/customers', { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const list = Array.isArray(d) ? d : (d?.customers || d?.data || []);
          if (list && list.length > 0) {
            setCustomers(list);
          } else {
            return fetch('http://localhost:4000/api/customer-intelligence/candidates', { headers })
              .then(r => r.ok ? r.json() : [])
              .then(cands => {
                const mapped = (Array.isArray(cands) ? cands : cands?.data || []).map((c: any) => ({
                  id: c.company_id || c.id,
                  name: c.companies?.name || c.name || 'Pharma Customer'
                }));
                setCustomers(mapped.length > 0 ? mapped : FALLBACK_CUSTOMERS);
              })
              .catch(() => setCustomers(FALLBACK_CUSTOMERS));
          }
        })
        .catch(() => setCustomers(FALLBACK_CUSTOMERS));

      // Load opportunities
      fetch('http://localhost:4000/api/opportunities', { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const list = Array.isArray(d) ? d : (d?.opportunities || d?.data || []);
          setOpportunities(list.length > 0 ? list : FALLBACK_OPPORTUNITIES);
        })
        .catch(() => setOpportunities(FALLBACK_OPPORTUNITIES));

      // Load RFQs
      fetch('http://localhost:4000/api/rfqs', { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const list = Array.isArray(d) ? d : (d?.rfqs || d?.data || []);
          setRfqs(list.length > 0 ? list : FALLBACK_RFQS);
        })
        .catch(() => setRfqs(FALLBACK_RFQS));

      // Load Users for participants
      fetch('http://localhost:4000/api/users', { headers })
        .then(r => r.ok ? r.json() : [])
        .then(d => setUsers(Array.isArray(d) ? d : d.data || []))
        .catch(() => {});

      // Load templates
      meetingApi.listTemplates(token)
        .then(t => setTemplates(t))
        .catch(() => {});
    } catch {
      setProducts(FALLBACK_PRODUCTS);
      setCustomers(FALLBACK_CUSTOMERS);
      setOpportunities(FALLBACK_OPPORTUNITIES);
      setRfqs(FALLBACK_RFQS);
    }
  };

  const handleApplyTemplate = (tpl: any) => {
    if (!tpl) return;
    setMeetingType(tpl.meeting_type);
    if (tpl.default_agenda && Array.isArray(tpl.default_agenda)) {
      setAgenda(tpl.default_agenda.join('\n• '));
    }
  };

  // 3-Box Preset Templates (matches pharmaceutical CDMO workflows and Screenshot 2)
  const PRESET_TEMPLATES = [
    {
      name: 'Formulation & Excipient Readiness',
      description: 'Reviews formulation parameters, excipients & batch readiness (Screenshot #2 preset)',
      objective: 'Align on formulation feasibility and confirm batch readiness for RFQ / trial production.',
      expectedOutcomes: '1. Finalize excipient compatibility limits and critical quality attributes.\n2. Confirm batch trial schedule and pilot suite readiness.\n3. Assign technical lead and cross-functional owners.',
      agenda: '1. Review previous open action items\n2. Formulation parameters & excipient readiness\n3. Next steps & assignment'
    },
    {
      name: 'Commercial BD & RFQ Pricing Review',
      description: 'Cost modeling, batch sizing, margin targets and quotation delivery',
      objective: 'Evaluate commercial costing, volume commitments, and customer contract terms.',
      expectedOutcomes: '1. Agree on per-unit pricing baseline and API pass-through rules.\n2. Confirm tooling and qualification timeline.\n3. Approve formal proposal submission date.',
      agenda: '1. Customer background & RFQ scope review\n2. Cost model review & capacity reservation\n3. Commercial pricing signoff & proposal timeline'
    },
    {
      name: 'GMP Regulatory & Quality Gate',
      description: 'Audit readiness, DMF/ASMF filings, and change control evaluation',
      objective: 'Verify regulatory filing pathway, GMP compliance gates, and audit readiness.',
      expectedOutcomes: '1. Confirm DMF/ASMF submission checklist completeness.\n2. Sign off on critical process parameter (CPP) validation plan.\n3. Approve draft Quality Agreement.',
      agenda: '1. Regulatory status overview & filing pathway\n2. Analytical method transfer & CQA risk review\n3. Open action items & owner assignment'
    }
  ];

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setObjective(preset.objective);
    setExpectedOutcomes(preset.expectedOutcomes);
    setAgenda(preset.agenda);
    setTemplateSuccess(`✓ Applied "${preset.name}" preset template!`);
    setTimeout(() => setTemplateSuccess(null), 4000);
  };

  const handleClear3Boxes = () => {
    setObjective('');
    setExpectedOutcomes('');
    setAgenda('');
    setTemplateSuccess('Cleared Meeting Objective, Expected Outcomes, and Agenda.');
    setTimeout(() => setTemplateSuccess(null), 3000);
  };

  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      // Prepare 3-box data row
      const exportObjective = objective.trim() || 'Align on formulation feasibility and confirm batch readiness for Phase II RFQ';
      const exportOutcomes = expectedOutcomes.trim() || '1. Sign-off on excipient specs and analytical test limits.\n2. Freeze batch delivery milestone schedule.\n3. Assign technical lead and cross-functional owners.';
      const exportAgenda = agenda.trim() || '1. Review previous open action items\n2. Formulation parameters & excipient readiness\n3. Next steps & assignment';

      const dataRow = {
        'Meeting Objective': exportObjective,
        'Expected Outcomes': exportOutcomes,
        'Agenda Items': exportAgenda
      };

      const ws = XLSX.utils.json_to_sheet([dataRow]);
      ws['!cols'] = [{ wch: 45 }, { wch: 45 }, { wch: 55 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Meeting_Plan');

      // Add Instructions Sheet
      const instructions = [
        { 'Step': 1, 'Guidance': 'Open the "Meeting_Plan" sheet in Excel or any spreadsheet editor.' },
        { 'Step': 2, 'Guidance': 'Row 1 contains the headers: Meeting Objective, Expected Outcomes, Agenda Items.' },
        { 'Step': 3, 'Guidance': 'Row 2 contains your meeting details. You can edit or add bullet points.' },
        { 'Step': 4, 'Guidance': 'Save the file and click "Upload Template" in BDIQ to automatically populate all 3 boxes.' }
      ];
      const wsInstructions = XLSX.utils.json_to_sheet(instructions);
      wsInstructions['!cols'] = [{ wch: 8 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

      const fileName = format === 'csv' ? 'BDIQ_Meeting_3Box_Template.csv' : 'BDIQ_Meeting_3Box_Template.xlsx';
      XLSX.writeFile(wb, fileName, { bookType: format });

      setTemplateSuccess(`Template downloaded as ${fileName}. Fill it out and click "Upload Template"!`);
      setTimeout(() => setTemplateSuccess(null), 5000);
    } catch (err: any) {
      setTemplateError(err.message || 'Failed to generate template download.');
      setTimeout(() => setTemplateError(null), 6000);
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTemplateError(null);
    setTemplateSuccess(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Prefer sheet named 'Meeting_Plan', otherwise use first sheet
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('meeting') || n.toLowerCase().includes('plan')) || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];

      if (!sheet) {
        throw new Error('Workbook contains no readable sheets.');
      }

      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rows || rows.length === 0) {
        throw new Error('The uploaded file appears to be empty.');
      }

      let newObjective = '';
      let newOutcomes = '';
      let newAgenda = '';

      // Check horizontal columns
      let headerRowIdx = -1;
      let objCol = -1;
      let outCol = -1;
      let agCol = -1;

      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim().toLowerCase();
          if (val.includes('objective') && objCol === -1) objCol = c;
          if (val.includes('outcome') && outCol === -1) outCol = c;
          if (val.includes('agenda') && agCol === -1) agCol = c;
        }

        if (objCol !== -1 || outCol !== -1 || agCol !== -1) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx !== -1 && (objCol !== -1 || outCol !== -1 || agCol !== -1)) {
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;

          if (objCol !== -1 && row[objCol]) {
            newObjective = newObjective ? `${newObjective}\n${String(row[objCol]).trim()}` : String(row[objCol]).trim();
          }
          if (outCol !== -1 && row[outCol]) {
            newOutcomes = newOutcomes ? `${newOutcomes}\n${String(row[outCol]).trim()}` : String(row[outCol]).trim();
          }
          if (agCol !== -1 && row[agCol]) {
            newAgenda = newAgenda ? `${newAgenda}\n${String(row[agCol]).trim()}` : String(row[agCol]).trim();
          }
        }
      }

      // Check vertical layout fallback
      if (!newObjective && !newOutcomes && !newAgenda) {
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row) || row.length < 2) continue;
          const key = String(row[0] || '').trim().toLowerCase();
          const val = String(row[1] || '').trim();

          if (key.includes('objective') && !newObjective) newObjective = val;
          if (key.includes('outcome') && !newOutcomes) newOutcomes = val;
          if (key.includes('agenda') && !newAgenda) newAgenda = val;
        }
      }

      // Check plain text fallback
      if (!newObjective && !newOutcomes && !newAgenda) {
        const textContent = await file.text();
        const lines = textContent.split(/\r?\n/);
        let currentSection: 'obj' | 'out' | 'ag' | null = null;
        for (const line of lines) {
          const lower = line.trim().toLowerCase();
          if (lower.startsWith('meeting objective') || lower.startsWith('objective:')) {
            currentSection = 'obj';
            const remainder = line.replace(/^[^:]*:/, '').trim();
            if (remainder) newObjective = remainder;
          } else if (lower.startsWith('expected outcomes') || lower.startsWith('outcomes:')) {
            currentSection = 'out';
            const remainder = line.replace(/^[^:]*:/, '').trim();
            if (remainder) newOutcomes = remainder;
          } else if (lower.startsWith('agenda items') || lower.startsWith('agenda:')) {
            currentSection = 'ag';
            const remainder = line.replace(/^[^:]*:/, '').trim();
            if (remainder) newAgenda = remainder;
          } else if (currentSection === 'obj' && line.trim()) {
            newObjective += (newObjective ? '\n' : '') + line;
          } else if (currentSection === 'out' && line.trim()) {
            newOutcomes += (newOutcomes ? '\n' : '') + line;
          } else if (currentSection === 'ag' && line.trim()) {
            newAgenda += (newAgenda ? '\n' : '') + line;
          }
        }
      }

      if (!newObjective && !newOutcomes && !newAgenda) {
        throw new Error(
          `Could not detect Objective, Outcomes, or Agenda columns in "${file.name}". Please ensure headers match "Meeting Objective", "Expected Outcomes", and "Agenda Items".`
        );
      }

      if (newObjective) setObjective(newObjective);
      if (newOutcomes) setExpectedOutcomes(newOutcomes);
      if (newAgenda) setAgenda(newAgenda);

      setTemplateSuccess(`✓ Template "${file.name}" loaded successfully! Meeting Objective, Expected Outcomes, and Agenda items auto-populated.`);
      setTimeout(() => setTemplateSuccess(null), 6000);
    } catch (err: any) {
      setTemplateError(err.message || 'Failed to parse template file.');
      setTimeout(() => setTemplateError(null), 7000);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Meeting title is required.');
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (endTime && meetingTime && endTime <= meetingTime) {
      setError('Meeting end time must be after the start time.');
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        title: title.trim(),
        meeting_type: meetingType,
        meeting_date: meetingDate,
        meeting_time: meetingTime ? `${meetingTime}:00` : '10:00:00',
        end_time: endTime ? `${endTime}:00` : null,
        timezone,
        location_or_link: locationOrLink.trim() || null,
        objective: objective.trim() || null,
        expected_outcomes: expectedOutcomes.trim() || null,
        agenda: agenda.trim() || null,
        external_organizations: externalOrgs.trim() || null,
        customer_id: customerId || null,
        opportunity_id: opportunityId || null,
        rfq_id: rfqId || null,
        product_id: productId || null,
        participants: selectedParticipants,
      };

      if (isRecurring) {
        payload.recurrence = {
          enabled: true,
          type: recurrenceType,
          interval: recurrenceInterval,
          end_date: recurrenceEndDate || null
        };
      }

      const created = await meetingApi.createMeeting(session?.access_token, payload);
      onMeetingCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule meeting.');
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Schedule New Meeting
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect to customer, deal opportunities, RFQs, products, and recurrence rules.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 pb-16">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Template Quick Selection */}
          {templates.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Pre-load Template:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.slice(0, 3).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="text-xs px-2.5 py-1 rounded bg-background hover:bg-muted border border-border text-foreground transition-colors"
                  >
                    {tpl.template_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                Meeting Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Formulation Feasibility Alignment - Batch #2"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                Meeting Type
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="Customer Meeting">Customer Meeting</option>
                <option value="Internal BD Meeting">Internal BD Meeting</option>
                <option value="R&D Discussion">R&D Discussion</option>
                <option value="Regulatory Discussion">Regulatory Discussion</option>
                <option value="Production Review">Production Review</option>
                <option value="Supply Chain Review">Supply Chain Review</option>
                <option value="Commercial Discussion">Commercial Discussion</option>
                <option value="Project Review">Project Review</option>
                <option value="Management Review">Management Review</option>
                <option value="Vendor Meeting">Vendor Meeting</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                Location or Video Link
              </label>
              <input
                type="text"
                value={locationOrLink}
                onChange={(e) => setLocationOrLink(e.target.value)}
                placeholder="e.g. Conference Room A or https://meet.google.com/xyz"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              />
            </div>
          </div>

          {/* Section 2: Date, Time & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/20 border border-border">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Date <span className="text-destructive">*</span>
              </label>
              <div
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker();
                  } catch {}
                }}
                className="relative cursor-pointer group"
              >
                <input
                  ref={dateInputRef}
                  type="date"
                  required
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer transition-colors group-hover:border-foreground/50 [color-scheme:dark]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-primary transition-colors flex items-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Start Time <span className="text-destructive">*</span>
              </label>
              <ModernTimePicker
                value={meetingTime}
                onChange={setMeetingTime}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                End Time
              </label>
              <ModernTimePicker
                value={endTime}
                onChange={setEndTime}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono text-xs"
              >
                <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
                <option value="UTC">UTC (Universal)</option>
                <option value="America/New_York">EST (New York)</option>
                <option value="Europe/London">GMT/BST (London)</option>
                <option value="Europe/Berlin">CET (Berlin)</option>
                <option value="Asia/Singapore">SGT (Singapore)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Entity Association */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              Connected BDIQ Platform Entities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-semibold text-foreground">
                  Customer
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-background border border-border text-foreground transition-colors hover:border-foreground/50 focus:border-primary"
                >
                  <option value="">None / Internal</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.companies?.name || c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-semibold text-foreground">
                  Opportunity
                </label>
                <select
                  value={opportunityId}
                  onChange={(e) => setOpportunityId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-background border border-border text-foreground transition-colors hover:border-foreground/50 focus:border-primary"
                >
                  <option value="">None</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title || o.opportunity_code || o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-semibold text-foreground">
                  Related RFQ
                </label>
                <select
                  value={rfqId}
                  onChange={(e) => setRfqId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-background border border-border text-foreground transition-colors hover:border-foreground/50 focus:border-primary"
                >
                  <option value="">None</option>
                  {rfqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rfq_number} {r.customer_name ? `(${r.customer_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-semibold text-foreground">
                  Product
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-background border border-border text-foreground font-medium transition-colors hover:border-foreground/50 focus:border-primary"
                >
                  <option value="">None</option>
                  {products.map((p) => {
                    const label = p.product_name || p.brand_name || p.name || p.product_code;
                    const brand = p.brand_name && p.brand_name !== label ? ` (${p.brand_name})` : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {label}{brand}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: 3-Box Meeting Plan (Objective, Outcomes & Agenda) with Template Download & Auto-Upload */}
          <div className="space-y-4 p-4 rounded-xl bg-muted/15 border border-border">
            {/* Header & Template Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-primary/10 text-primary">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    3-Box Meeting Plan (Objective, Outcomes & Agenda)
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Download template, fill in Excel/CSV, or upload your file to automatically take in all 3 boxes.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2">
                {/* Download Template (.xlsx) */}
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  title="Download Excel Template (.xlsx)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background hover:bg-muted border border-border text-xs font-medium text-foreground transition-all hover:border-foreground/40 shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span>Download Template (.xlsx)</span>
                </button>

                {/* Download Template (.csv) */}
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  title="Download CSV Template"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background hover:bg-muted border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  <FileText className="w-3 h-3" />
                  <span>CSV</span>
                </button>

                {/* Upload Template (.xlsx, .csv) */}
                <label
                  title="Upload filled template to automatically populate all 3 boxes"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer hover:bg-primary/90 transition-all shadow-sm active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Template</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv,.txt"
                    onChange={handleUploadTemplate}
                    className="hidden"
                  />
                </label>

                {/* Quick Presets Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background hover:bg-muted border border-border text-xs font-medium text-foreground transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Presets</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>

                  {presetDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-popover border border-border rounded-lg shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in-50 zoom-in-95">
                      <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border">
                        Quick 3-Box Presets
                      </div>
                      {PRESET_TEMPLATES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            handleApplyPreset(p);
                            setPresetDropdownOpen(false);
                          }}
                          className="w-full text-left p-2 rounded hover:bg-muted transition-colors group flex flex-col"
                        >
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary flex items-center justify-between">
                            {p.name}
                            <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                            {p.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clear / Reset button if any box has content */}
                {(objective || expectedOutcomes || agenda) && (
                  <button
                    type="button"
                    onClick={handleClear3Boxes}
                    title="Clear Objective, Outcomes & Agenda"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Template Status / Feedback Banner */}
            {templateSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{templateSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateSuccess(null)}
                  className="text-emerald-400/70 hover:text-emerald-400 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {templateError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{templateError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateError(null)}
                  className="text-destructive/70 hover:text-destructive text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* The 3 Boxes (Matching Screenshot 2 exactly) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Meeting Objective */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                    Meeting Objective
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {objective.length} chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="What is the primary target of this meeting?"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>

              {/* Box 2: Expected Outcomes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                    Expected Outcomes
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {expectedOutcomes.length} chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={expectedOutcomes}
                  onChange={(e) => setExpectedOutcomes(e.target.value)}
                  placeholder="What commitments or deliverables must be reached?"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>

              {/* Box 3: Agenda Items (Full Width) */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                    Agenda Items
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {agenda ? agenda.split('\n').filter(Boolean).length : 0} items
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="1. Review previous open action items&#10;2. Formulation parameters & excipient readiness&#10;3. Next steps & assignment"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 5: External Organizations & Participants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                External Organizations (CRO, Sponsor, Partner, Vendor)
              </label>
              <input
                type="text"
                value={externalOrgs}
                onChange={(e) => setExternalOrgs(e.target.value)}
                placeholder="e.g. Pfizer Global, Lonza Biologics"
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground"
              />
            </div>

            {users.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                  Internal Participants ({selectedParticipants.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 rounded-lg bg-background border border-border">
                  {users.map((u) => {
                    const isSelected = selectedParticipants.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedParticipants(prev =>
                            prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {u.first_name} {u.last_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Recurrence Configuration */}
          <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Recurring Meeting Series
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                onClick={() => setIsRecurring(!isRecurring)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background ${
                  isRecurring ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                    isRecurring ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isRecurring && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Frequency</label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-background border border-border text-foreground"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Interval</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-background border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Series End Date</label>
                  <div className="relative cursor-pointer group">
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="w-full pl-2.5 pr-8 py-1.5 text-xs rounded bg-background border border-border text-foreground cursor-pointer transition-colors group-hover:border-foreground/50 [color-scheme:dark]"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-primary transition-colors flex items-center">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-border flex items-center justify-between gap-3 bg-muted/40 shrink-0 z-20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors shrink-0"
            >
              Cancel
            </button>
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/25 min-w-0 max-w-md truncate animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
          >
            {loading ? (
              <span>Scheduling...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Schedule Meeting</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
