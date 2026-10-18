import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import { getApiBaseUrl } from '../../lib/api';

export interface EvidenceRecord {
  id: string;
  candidate_id: string;
  claim: string;
  claim_category: 'MARKET_PRESENCE' | 'REGULATORY_FILING' | 'MANUFACTURING_FOOTPRINT' | 'SOURCING_SIGNAL' | 'RELATIONSHIP_HISTORY' | 'CLINICAL_PIPELINE';
  source_organization: string;
  source_title: string;
  source_url: string | null;
  source_excerpt: string;
  location_reference: string;
  source_date: string;
  retrieved_at: string;
  effective_date?: string;
  source_type: string;
  verification_status: 'VERIFIED' | 'SOURCE_LINKED_NOT_REVIEWED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'CONFLICTING' | 'EXPIRED_STALE' | 'DEMONSTRATION_DATA' | 'UNSUPPORTED';
  reviewer?: string;
  reviewed_at?: string;
  limitations?: string;
  associated_product_name?: string;
  extraction_method: string;
}

interface SourceProofModalProps {
  evidence: EvidenceRecord | null;
  candidateId: string;
  companyName: string;
  sessionToken?: string;
  onClose: () => void;
  onVerificationUpdated?: (updatedEvidence: EvidenceRecord) => void;
}

export const SourceProofModal: React.FC<SourceProofModalProps> = ({
  evidence,
  candidateId,
  companyName,
  sessionToken,
  onClose,
  onVerificationUpdated
}) => {
  if (!evidence) return null;

  const [reviewStatus, setReviewStatus] = useState<string>(evidence.verification_status);
  const [reviewNotes, setReviewNotes] = useState<string>(evidence.limitations || '');
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isExternalUrl = evidence.source_url && evidence.source_url.startsWith('http');
  const isDemo = evidence.verification_status === 'DEMONSTRATION_DATA' || evidence.source_type === 'DEMONSTRATION_DATA';

  const handleUpdateVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/customer-intelligence/candidates/${candidateId}/evidence/${evidence.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || 'dev-admin-token'}`
        },
        body: JSON.stringify({
          status: reviewStatus,
          notes: reviewNotes
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.message || 'Verification update failed');
      }

      const updated = await res.json();
      setSaveSuccess(true);
      if (onVerificationUpdated) {
        onVerificationUpdated(updated);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update verification status');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Verified Evidence' };
      case 'SOURCE_LINKED_NOT_REVIEWED':
        return { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Source-Linked (Not Reviewed)' };
      case 'PARTIALLY_VERIFIED':
        return { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Partially Verified' };
      case 'CONFLICTING':
        return { bg: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Conflicting Sources' };
      case 'EXPIRED_STALE':
        return { bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'Expired / Stale' };
      case 'DEMONSTRATION_DATA':
        return { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Demonstration Fixture' };
      default:
        return { bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Unverified' };
    }
  };

  const statusInfo = getStatusBadge(evidence.verification_status);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${statusInfo.bg}`}>
                <ShieldCheck className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">ID: {evidence.id}</span>
            </div>
            <h2 className="text-base font-bold text-foreground mt-1 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Traceable Source Proof Inspector
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Associated Company: <strong className="text-foreground">{companyName}</strong>
              {evidence.associated_product_name && (
                <> • Target Product: <strong className="text-foreground">{evidence.associated_product_name}</strong></>
              )}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-foreground">
          {/* Claim Box */}
          <div className="p-4 rounded-xl bg-background border border-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
              Exact Claim / Fact Supported
            </span>
            <div className="text-sm font-semibold text-foreground leading-relaxed">
              "{evidence.claim}"
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                Category: {evidence.claim_category}
              </span>
              <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                Extraction: {evidence.extraction_method}
              </span>
            </div>
          </div>

          {/* Source Excerpt */}
          <div className="p-4 rounded-xl bg-muted/20 border border-primary/20 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Inspectable Source Excerpt
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Location: {evidence.location_reference}
              </span>
            </div>
            <blockquote className="italic text-foreground/90 font-serif leading-relaxed text-xs border-l-2 border-primary/40 pl-3 my-2 bg-background/50 p-2.5 rounded-r">
              "{evidence.source_excerpt}"
            </blockquote>
            <div className="text-[11px] text-muted-foreground mt-2">
              Source Organization: <strong className="text-foreground">{evidence.source_organization}</strong>
              {' '}- <span className="text-foreground">{evidence.source_title}</span>
            </div>
          </div>

          {/* Source Provenance Metadata Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 text-[11px] font-semibold text-foreground border-b border-border">
              Provenance & Metadata
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Source Type:</span>
                <span className="font-medium text-foreground">{evidence.source_type}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Location / Coordinate:</span>
                <span className="font-mono text-foreground text-[11px]">{evidence.location_reference}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Source Published Date:</span>
                <span className="font-medium text-foreground">{evidence.source_date || 'Undisclosed'}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Retrieved / Synced At:</span>
                <span className="font-medium text-foreground">{new Date(evidence.retrieved_at).toLocaleString()}</span>
              </div>
              {evidence.reviewer && (
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground block">Human Reviewer:</span>
                  <span className="font-medium text-foreground">{evidence.reviewer} ({evidence.reviewed_at ? new Date(evidence.reviewed_at).toLocaleDateString() : 'N/A'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Demo Data Warning or Limitations */}
          {isDemo && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong className="font-semibold block text-amber-200">Demonstration Fixture Warning</strong>
                This record originates from demonstration seed fixtures. It has NOT been verified by external regulatory registries and must NOT be used for binding CDMO production commitments.
              </div>
            </div>
          )}

          {evidence.limitations && (
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl text-xs space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Documented Evidence Limitations & Caveats:
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {evidence.limitations}
              </p>
            </div>
          )}

          {/* External Source Action */}
          <div className="p-4 rounded-xl bg-background border border-border flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-xs text-foreground">Inspect Underlying External Record</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {isExternalUrl ? 'Direct authorized link to external regulatory or SEC filing.' : 'Internal BDIQ document or isolated fixture repository.'}
              </div>
            </div>

            {isExternalUrl ? (
              <a
                href={evidence.source_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-colors shadow-xs"
              >
                <span>Open Original Source</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs border border-border font-mono cursor-not-allowed">
                <Lock className="w-3 h-3" />
                <span>Internal / Offline Record</span>
              </div>
            )}
          </div>

          {/* Human Review & Verification Controls (Phase 4) */}
          <form onSubmit={handleUpdateVerification} className="pt-2 border-t border-border space-y-3">
            <div className="font-semibold text-xs text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Human Review & Verification Gate
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Update Verification Status:
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg text-xs py-1.5 px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="VERIFIED">Verified (Reviewed & Authenticated)</option>
                  <option value="SOURCE_LINKED_NOT_REVIEWED">Source-Linked, Not Reviewed</option>
                  <option value="PARTIALLY_VERIFIED">Partially Verified</option>
                  <option value="CONFLICTING">Conflicting Evidence</option>
                  <option value="EXPIRED_STALE">Expired or Stale</option>
                  <option value="UNVERIFIED">Unverified / Unsupported</option>
                  <option value="DEMONSTRATION_DATA">Demonstration Data</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Reviewer Audit Notes / Limitations:
                </label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document specific verification caveat..."
                  className="w-full bg-background border border-border rounded-lg text-xs py-1.5 px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {saveSuccess && (
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verification status updated. Fit score automatically recalculated.
              </div>
            )}

            {saveError && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {saveError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-card border border-border text-foreground hover:bg-muted text-xs font-medium rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Saving Review...' : 'Save Human Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
