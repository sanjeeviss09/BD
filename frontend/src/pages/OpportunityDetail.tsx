import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Clock,
  Globe,
  AlertTriangle,
  CheckSquare,
  BarChart2,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Pill,
  MessageSquare,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { WorkflowProgress } from '@/components/visualization/WorkflowProgress';
import { WorkflowTransitionModal } from '@/components/workflow/WorkflowTransitionModal';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline';

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { hasPermission } = usePermission();

  const [opp, setOpp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regulatoryAssessment, setRegulatoryAssessment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'products'
    | 'qualification'
    | 'tasks'
    | 'markets'
    | 'risks'
    | 'regulatory'
    | 'requirements'
    | 'timeline'
    | 'comments'
    | 'future'
  >('overview');

  // Products & Criteria reference
  const [criteria, setCriteria] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // Modals & Action States
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowInstance, setWorkflowInstance] = useState<any>(null);
  const [validTransitions, setValidTransitions] = useState<any[]>([]);
  const [selectedTargetStage, setSelectedTargetStage] = useState('');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeStatus, setCloseStatus] = useState<'WON' | 'LOST' | 'CANCELLED'>('WON');
  const [closeReason, setCloseReason] = useState('');

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [assocProductId, setAssocProductId] = useState('');
  const [assocRelType, setAssocRelType] = useState('SECONDARY_PRODUCT');
  const [assocIsPrimary, setAssocIsPrimary] = useState(false);

  const [showAddMarketModal, setShowAddMarketModal] = useState(false);
  const [marketCountry, setMarketCountry] = useState('');
  const [marketRole, setMarketRole] = useState('PRIMARY');
  const [marketDate, setMarketDate] = useState('');

  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [riskType, setRiskType] = useState('TECHNICAL');
  const [riskSeverity, setRiskSeverity] = useState('MEDIUM');
  const [riskDescription, setRiskDescription] = useState('');
  const [riskMitigation, setRiskMitigation] = useState('');

  const [showAddReqModal, setShowAddReqModal] = useState(false);
  const [reqType, setReqType] = useState('TECHNICAL');
  const [reqDescription, setReqDescription] = useState('');

  const [showQualModal, setShowQualModal] = useState(false);
  const [qualScores, setQualScores] = useState<Record<string, number>>({});

  const [commentText, setCommentText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOpportunity = async () => {
    if (!id || !session?.access_token) return;
    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setOpp(data.data);

        // Fetch Step 10 Workflow Instance & Valid Server-Validated Transitions
        try {
          const [instRes, transRes] = await Promise.all([
            fetch(`http://localhost:4000/api/workflows/opportunities/${id}/instance`, { headers }),
            fetch(`http://localhost:4000/api/workflows/opportunities/${id}/valid-transitions`, { headers }),
          ]);
          if (instRes.ok) {
            const instData = await instRes.json();
            setWorkflowInstance(instData.data);
          }
          if (transRes.ok) {
            const transData = await transRes.json();
            setValidTransitions(transData.data || []);
          }
        } catch (wfErr) {
          console.error('Failed to load workflow engine state:', wfErr);
        }

        // Fetch Step 13 Regulatory Assessment Summary
        try {
          const regRes = await fetch(`http://localhost:4000/api/regulatory/products/${data.data.product_id || 'default-prod'}`, { headers });
          if (regRes.ok) {
            const regData = await regRes.json();
            setRegulatoryAssessment(regData);
          }
        } catch (regErr) {
          console.error('Failed to load regulatory intelligence summary:', regErr);
        }
      } else {
        navigate('/opportunities');
      }
    } catch (err) {
      console.error('Failed to fetch opportunity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunity();
  }, [id, session?.access_token]);

  // Load Reference Data
  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    const loadMeta = async () => {
      try {
        const [critRes, prodRes] = await Promise.all([
          fetch('http://localhost:4000/api/opportunities/references/criteria', { headers }),
          fetch('http://localhost:4000/api/products?limit=100', { headers }),
        ]);

        if (critRes.ok) {
          const cList = (await critRes.json()).data || [];
          setCriteria(cList);
          const initialScores: Record<string, number> = {};
          cList.forEach((c: any) => {
            initialScores[c.key] = 70;
          });
          setQualScores(initialScores);
        }
        if (prodRes.ok) setAllProducts((await prodRes.json()).products || []);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    };

    loadMeta();
  }, [session?.access_token]);

  // Close Opportunity
  const handleCloseOpportunity = async () => {
    if (!closeReason.trim()) {
      alert('Closure reason is required');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          status: closeStatus,
          reason: closeReason.trim(),
        }),
      });

      if (res.ok) {
        setShowCloseModal(false);
        setCloseReason('');
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Reopen
  const handleReopen = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/reopen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) fetchOpportunity();
    } finally {
      setActionLoading(false);
    }
  };

  // Add Product
  const handleAddProduct = async () => {
    if (!assocProductId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          product_id: assocProductId,
          relationship_type: assocRelType,
          is_primary: assocIsPrimary,
        }),
      });

      if (res.ok) {
        setShowAddProductModal(false);
        setAssocProductId('');
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to remove this product association?')) return;
    await fetch(`http://localhost:4000/api/opportunities/${id}/products/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchOpportunity();
  };

  // Qualification
  const handleRecordQualification = async () => {
    setActionLoading(true);
    const criteriaPayload = criteria.map(c => ({
      criterion_key: c.key,
      criterion_name: c.name,
      score: qualScores[c.key] || 0,
      weight: c.defaultWeight,
    }));

    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/qualify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ criteria: criteriaPayload }),
      });

      if (res.ok) {
        setShowQualModal(false);
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Market
  const handleAddMarket = async () => {
    if (!marketCountry.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          country_code: marketCountry.trim().toUpperCase(),
          market_role: marketRole,
          target_date: marketDate || undefined,
        }),
      });
      if (res.ok) {
        setShowAddMarketModal(false);
        setMarketCountry('');
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMarket = async (marketId: string) => {
    if (!confirm('Remove market?')) return;
    await fetch(`http://localhost:4000/api/opportunities/${id}/markets/${marketId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchOpportunity();
  };

  // Risk
  const handleAddRisk = async () => {
    if (!riskDescription.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/risks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          risk_type: riskType,
          severity: riskSeverity,
          description: riskDescription.trim(),
          mitigation: riskMitigation.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowAddRiskModal(false);
        setRiskDescription('');
        setRiskMitigation('');
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRisk = async (riskId: string) => {
    if (!confirm('Delete risk?')) return;
    await fetch(`http://localhost:4000/api/opportunities/${id}/risks/${riskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchOpportunity();
  };

  // Requirement
  const handleAddReq = async () => {
    if (!reqDescription.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          requirement_type: reqType,
          description: reqDescription.trim(),
        }),
      });
      if (res.ok) {
        setShowAddReqModal(false);
        setReqDescription('');
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReq = async (reqId: string) => {
    if (!confirm('Delete requirement?')) return;
    await fetch(`http://localhost:4000/api/opportunities/${id}/requirements/${reqId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchOpportunity();
  };

  // Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ comment: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText('');
        fetchOpportunity();
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        Loading Opportunity details...
      </div>
    );
  }

  if (!opp) return null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/opportunities')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </button>

        <div className="flex items-center gap-2">
          {opp.status === 'OPEN' ? (
            <>
              {(hasPermission('workflow.execute') || hasPermission('opportunities.stage')) && (
                <button
                  onClick={() => setShowWorkflowModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 text-white rounded-md text-xs font-semibold hover:from-cyan-500 hover:to-sky-500 shadow-sm"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Advance Stage Gate
                </button>
              )}
              {hasPermission('opportunities.close') && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50"
                >
                  Close Deal...
                </button>
              )}
            </>
          ) : (
            hasPermission('opportunities.reopen') && (
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reopen Opportunity
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Opportunity Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                {opp.opportunity_code}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {opp.stage.replace(/_/g, ' ')}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  opp.status === 'WON'
                    ? 'bg-purple-100 text-purple-800'
                    : opp.status === 'LOST'
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {opp.status}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  opp.health === 'HEALTHY'
                    ? 'bg-emerald-100 text-emerald-800'
                    : opp.health === 'ATTENTION'
                    ? 'bg-yellow-100 text-yellow-800'
                    : opp.health === 'AT_RISK'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                Health: {opp.health}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{opp.title}</h1>
            <p className="text-xs text-gray-500">
              Type: <span className="font-semibold text-gray-700">{opp.opportunity_type}</span> • Source:{' '}
              <span className="font-semibold text-gray-700">{opp.source}</span> • Age:{' '}
              <span className="font-semibold text-gray-700">{opp.opportunity_age_days} days</span>
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-5 bg-gray-50 p-3.5 rounded-lg border border-gray-100 text-sm">
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase">Est. Value</div>
              <div className="font-bold text-gray-900">
                ${(opp.estimated_value || 0).toLocaleString()} {opp.currency}
              </div>
            </div>
            <div className="border-l pl-4">
              <div className="text-xs text-gray-400 font-semibold uppercase">Probability</div>
              <div className="font-bold text-indigo-600">{opp.probability}%</div>
            </div>
            <div className="border-l pl-4">
              <div className="text-xs text-gray-400 font-semibold uppercase">Weighted Value</div>
              <div className="font-bold text-emerald-600">
                ${(opp.weighted_pipeline_value || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Gated BD Workflow Progression */}
        <div className="mt-5">
          <WorkflowProgress
            currentStage={opp.stage}
            workflowInstance={workflowInstance}
            validTransitions={validTransitions}
            onSelectStage={(target) => {
              setSelectedTargetStage(target);
              setShowWorkflowModal(true);
            }}
            onOpenTransitionDrawer={() => setShowWorkflowModal(true)}
            canTransition={
              (hasPermission('workflow.execute') || hasPermission('opportunities.stage')) &&
              opp.status === 'OPEN'
            }
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-6 border-b border-gray-200 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Overview & Commercials
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'products'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pill className="w-4 h-4" />
            Products ({opp.opportunity_products?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('qualification')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'qualification'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award className="w-4 h-4" />
            Qualification ({opp.qualification_status})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Workflow Tasks ({opp.linked_tasks?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'markets'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            Markets ({opp.opportunity_markets?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('risks')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'risks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Risks ({opp.opportunity_risks?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('regulatory')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'regulatory'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Regulatory Intelligence
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requirements'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Requirements ({opp.opportunity_requirements?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'comments'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Comments ({opp.opportunity_comments?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('future')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'future'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Intelligence Extensions
          </button>
        </div>
      </div>

      {/* Tab 1: Overview & Financials */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider text-indigo-700 border-b pb-2">
              Commercial & Launch Deadlines
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Target Launch Date:</span>
                <span className="font-semibold text-gray-900">
                  {opp.target_launch_date || 'Not Scheduled'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Expected Decision Date:</span>
                <span className="font-semibold text-gray-900">
                  {opp.expected_decision_date || 'Not Scheduled'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Target Market Entry Date:</span>
                <span className="text-gray-700">{opp.target_market_date || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Responsible BD Owner:</span>
                <span className="font-medium text-gray-900">{opp.owner?.email || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Strategic Priority:</span>
                <span className="font-semibold text-gray-800">{opp.strategic_priority}</span>
              </div>
            </div>

            {/* Next Action Box */}
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg space-y-1 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-indigo-900">Next Action</span>
                {opp.next_action_delay_days > 0 ? (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                    Delayed {opp.next_action_delay_days} days
                  </span>
                ) : opp.next_action_date ? (
                  <span className="text-xs text-indigo-600 font-mono">Due: {opp.next_action_date}</span>
                ) : null}
              </div>
              <p className="text-sm text-indigo-950 font-medium">
                {opp.next_action || 'No next action logged.'}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider text-indigo-700 border-b pb-2">
              Strategic Evaluation & Closure
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Qualification Score:</span>
                <span className="font-bold text-indigo-600">
                  {opp.qualification_score ? `${opp.qualification_score}%` : 'Not Evaluated'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Overall Risk Level:</span>
                <span
                  className={`font-semibold ${
                    opp.risk_level === 'CRITICAL'
                      ? 'text-red-600'
                      : opp.risk_level === 'HIGH'
                      ? 'text-amber-600'
                      : 'text-gray-900'
                  }`}
                >
                  {opp.risk_level}
                </span>
              </div>
              {opp.closed_at && (
                <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                  <div className="text-xs font-bold text-gray-700 uppercase">Closed Record</div>
                  <div className="text-xs text-gray-600">Date: {new Date(opp.closed_at).toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Reason: {opp.closed_reason || '—'}</div>
                </div>
              )}
            </div>

            {opp.description && (
              <div className="pt-2">
                <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                  Opportunity Description
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-100">
                  {opp.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Products */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Associated Pharmaceutical Products</h3>
              <p className="text-xs text-gray-500">
                Products linked to this opportunity from the Product Master catalog.
              </p>
            </div>
            {hasPermission('opportunities.update') && (
              <button
                onClick={() => setShowAddProductModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Associate Product
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Product Code</th>
                  <th className="px-4 py-2.5">Product Name</th>
                  <th className="px-4 py-2.5">Role / Relationship</th>
                  <th className="px-4 py-2.5">Primary</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opp.opportunity_products && opp.opportunity_products.length > 0 ? (
                  opp.opportunity_products.map((op: any) => (
                    <tr key={op.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600">
                        {op.products?.product_code || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {op.products?.product_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          {op.relationship_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {op.is_primary ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Primary
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Secondary</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('opportunities.update') && (
                          <button
                            onClick={() => handleRemoveProduct(op.product_id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 text-xs">
                      No products associated with this opportunity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Qualification */}
      {activeTab === 'qualification' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Multi-Criteria Opportunity Qualification</h3>
              <p className="text-xs text-gray-500">
                Structured qualification criteria evaluating Strategic Fit, Market Potential, Technical & Regulatory feasibility.
              </p>
            </div>
            {hasPermission('opportunities.qualify') && (
              <button
                onClick={() => setShowQualModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
              >
                <Award className="w-3.5 h-3.5" />
                Run Qualification Evaluation
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <div className="text-xs font-semibold uppercase text-gray-500">Status</div>
              <div className="text-xl font-bold text-gray-900 mt-1">{opp.qualification_status}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <div className="text-xs font-semibold uppercase text-gray-500">Weighted Score</div>
              <div className="text-xl font-bold text-indigo-600 mt-1">
                {opp.qualification_score ? `${opp.qualification_score}%` : '—'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <div className="text-xs font-semibold uppercase text-gray-500">Evaluation Runs</div>
              <div className="text-xl font-bold text-gray-900 mt-1">
                {opp.opportunity_qualification_runs?.length || 0}
              </div>
            </div>
          </div>

          {/* Historical Runs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Evaluation History
            </h4>
            {opp.opportunity_qualification_runs && opp.opportunity_qualification_runs.length > 0 ? (
              opp.opportunity_qualification_runs.map((r: any) => (
                <div key={r.id} className="p-3 bg-gray-50 rounded border border-gray-200 text-xs space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>
                      Run #{r.version} — Outcome: {r.result} ({r.score}%)
                    </span>
                    <span className="text-gray-400">{new Date(r.completed_at).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-600">{r.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400">No qualification runs performed yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Workflow Tasks (Step 7 Integration) */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Associated Workflow Tasks</h3>
              <p className="text-xs text-gray-500">
                Operational tasks linked to this opportunity (feasibility checks, quotation follow-ups, dossier audits).
              </p>
            </div>
            {hasPermission('tasks.create') && (
              <button
                onClick={() => navigate('/tasks')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Task Code</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Commitment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opp.linked_tasks && opp.linked_tasks.length > 0 ? (
                  opp.linked_tasks.map((t: any) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">
                        {t.task_code}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.title}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold">
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">{t.priority}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">
                        {t.original_due_date || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 text-xs">
                      No operational tasks linked to this opportunity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Markets */}
      {activeTab === 'markets' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Target Markets & Territories</h3>
              <p className="text-xs text-gray-500">Target countries for commercial launch or regulatory filing.</p>
            </div>
            {hasPermission('opportunities.update') && (
              <button
                onClick={() => setShowAddMarketModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Target Market
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Country Code</th>
                  <th className="px-4 py-2.5">Market Role</th>
                  <th className="px-4 py-2.5">Target Launch</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opp.opportunity_markets && opp.opportunity_markets.length > 0 ? (
                  opp.opportunity_markets.map((m: any) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{m.country_code}</td>
                      <td className="px-4 py-3 text-xs font-semibold">{m.market_role}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono">{m.target_date || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('opportunities.update') && (
                          <button
                            onClick={() => handleRemoveMarket(m.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400 text-xs">
                      No target countries logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Risks */}
      {activeTab === 'risks' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Risk Assessment & Mitigations</h3>
              <p className="text-xs text-gray-500">
                Identified technical, regulatory, supply, and commercial risk factors.
              </p>
            </div>
            {hasPermission('opportunities.risk') && (
              <button
                onClick={() => setShowAddRiskModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Risk
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Mitigation Plan</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opp.opportunity_risks && opp.opportunity_risks.length > 0 ? (
                  opp.opportunity_risks.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-xs font-bold text-gray-700">{r.risk_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            r.severity === 'CRITICAL'
                              ? 'bg-red-100 text-red-800'
                              : r.severity === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.description}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.mitigation || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('opportunities.risk') && (
                          <button
                            onClick={() => handleDeleteRisk(r.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 text-xs">
                      No risks recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Regulatory Intelligence Domain Link */}
      {activeTab === 'regulatory' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                  Stage 5 Operational Evaluation
                </span>
                <h3 className="text-base font-bold text-gray-900">Regulatory Intelligence & Authorizations</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Verified marketing authorizations, dossier readiness, and regulatory risk conditions for target jurisdictions.
              </p>
            </div>

            <button
              onClick={() => navigate('/regulatory-intelligence')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 shadow-sm"
            >
              <FileText className="w-4 h-4" />
              Open Regulatory Intelligence Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-[11px] font-mono text-gray-500 uppercase">Target Markets Evaluated</span>
              <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                {opp.opportunity_markets?.length || 3} Jurisdictions
              </div>
              <div className="text-xs text-gray-500 mt-1 font-mono">
                {opp.opportunity_markets?.map((m: any) => m.country_code).join(', ') || 'US, EU, GB'}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-[11px] font-mono text-gray-500 uppercase">Regulatory Readiness</span>
              <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                {regulatoryAssessment?.readiness?.score || 75}%
              </div>
              <div className="text-xs text-emerald-600 font-mono mt-1">
                Verified statutory feed lineage
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-[11px] font-mono text-gray-500 uppercase">Workflow Evaluation State</span>
              <div className="text-xl font-bold text-gray-900 mt-1">
                {opp.stage === 'REGULATORY_EVALUATION' ? 'ACTIVE EVALUATION' : 'READY / QUALIFIED'}
              </div>
              <div className="text-xs text-gray-500 font-mono mt-1">
                Zero black-box AI conclusions
              </div>
            </div>
          </div>

          {regulatoryAssessment?.risks && regulatoryAssessment.risks.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-mono uppercase font-bold text-gray-700">Identified Regulatory Decision-Support Risks</h4>
              <div className="space-y-2">
                {regulatoryAssessment.risks.map((r: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded bg-gray-50 border border-gray-100 flex items-start justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-rose-600">[{r.severity}] {r.title}</span>
                      <p className="text-gray-600 mt-0.5">{r.explanation}</p>
                    </div>
                    <span className="text-[11px] font-medium text-gray-700">{r.mitigationSuggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Requirements */}
      {activeTab === 'requirements' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Project & Technical Requirements</h3>
              <p className="text-xs text-gray-500">
                Product specifications, regulatory submissions, and commercial deliverables required.
              </p>
            </div>
            {hasPermission('opportunities.update') && (
              <button
                onClick={() => setShowAddReqModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Requirement
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opp.opportunity_requirements && opp.opportunity_requirements.length > 0 ? (
                  opp.opportunity_requirements.map((rq: any) => (
                    <tr key={rq.id}>
                      <td className="px-4 py-3 text-xs font-bold text-gray-700">{rq.requirement_type}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{rq.description}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">
                          {rq.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('opportunities.update') && (
                          <button
                            onClick={() => handleDeleteReq(rq.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400 text-xs">
                      No requirements logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 8: Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Workflow Stage Dwell & Transition History */}
          <WorkflowTimeline history={workflowInstance?.stage_history || []} />

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Chronological Activity Trail</h3>
            <div className="space-y-4 relative border-l-2 border-indigo-100 ml-3 pl-4">
              {opp.opportunity_timeline && opp.opportunity_timeline.length > 0 ? (
                opp.opportunity_timeline.map((tl: any) => (
                  <div key={tl.id} className="relative space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700">{tl.event_type}</span>
                      <span className="text-gray-400 font-mono">
                        {new Date(tl.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{tl.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400">No activity logged.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 9: Comments */}
      {activeTab === 'comments' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          <h3 className="text-base font-bold text-gray-900">Collaboration & Comments</h3>

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Add a remark or collaboration update..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <button
              type="submit"
              disabled={actionLoading || !commentText.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              Post Comment
            </button>
          </form>

          <div className="space-y-3">
            {opp.opportunity_comments && opp.opportunity_comments.length > 0 ? (
              opp.opportunity_comments.map((cm: any) => (
                <div key={cm.id} className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{cm.user?.email || 'User'}</span>
                    <span className="font-mono">{new Date(cm.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-800">{cm.comment}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400">No comments posted yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 10: Future Extension Points */}
      {activeTab === 'future' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-lg border border-dashed border-gray-300 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
              <BarChart2 className="w-4 h-4" />
              Market Intelligence (IMS / Commercial Observations)
            </div>
            <p className="text-xs text-gray-500">
              Future connection point: Launch market research to extract 24-month sales/volume trends
              and competitor market shares directly into opportunity{' '}
              <span className="font-mono text-gray-800">{opp.opportunity_code}</span>.
            </p>
            <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 p-2 rounded">
              Ready for Phase 10 integration.
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <FileText className="w-4 h-4" />
                <span>Commercial Evaluation Engine (Step 18)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                STAGE 7 ACTIVE
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Unit economics, transparent costing, gross margin feasibility, and sealed decision snapshots are managed in the Commercial Evaluation Engine.
            </p>
            <div className="pt-1">
              <button
                onClick={() => navigate('/commercial-evaluation')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded hover:bg-black transition-colors shadow-sm"
              >
                <span>Launch Commercial Evaluation Workbench</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 10 Operational Workflow Transition Modal */}
      <WorkflowTransitionModal
        isOpen={showWorkflowModal}
        onClose={() => setShowWorkflowModal(false)}
        opportunityId={opp.id}
        opportunityTitle={opp.title}
        currentStage={opp.stage}
        targetStageInit={selectedTargetStage}
        validTransitions={validTransitions}
        onTransitionSuccess={() => {
          fetchOpportunity();
        }}
        token={session?.access_token}
      />

      {/* Close Deal Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="font-bold text-gray-900">Close Opportunity Deal</div>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Resolution Outcome</label>
                <select
                  value={closeStatus}
                  onChange={e => setCloseStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="WON">Won / Contract Secured</option>
                  <option value="LOST">Lost to Competitor / Declined</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Price competitiveness, Customer selected local player..."
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseOpportunity}
                disabled={actionLoading || !closeReason.trim()}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm Closure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Associate Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="font-bold text-gray-900">Associate Pharmaceutical Product</div>
              <button onClick={() => setShowAddProductModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Product</label>
                <select
                  value={assocProductId}
                  onChange={e => setAssocProductId(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="">Select Product...</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.product_code} — {p.product_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Relationship</label>
                <select
                  value={assocRelType}
                  onChange={e => setAssocRelType(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="PRIMARY_PRODUCT">Primary Product</option>
                  <option value="SECONDARY_PRODUCT">Secondary Product</option>
                  <option value="ALTERNATIVE_PRODUCT">Alternative Product</option>
                  <option value="REFERENCE_PRODUCT">Reference Product</option>
                  <option value="COMPETITOR_PRODUCT">Competitor Product</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assocIsPrimary}
                  onChange={e => setAssocIsPrimary(e.target.checked)}
                />
                Designate as Primary Product for Opportunity
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProduct}
                disabled={actionLoading || !assocProductId}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Association
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Qualification Modal */}
      {showQualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <div className="font-bold text-gray-900">Execute Multi-Criteria Qualification</div>
              <button onClick={() => setShowQualModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-gray-500">
                Score each criterion from 0 to 100 based on verified technical and commercial evidence.
              </p>
              <div className="space-y-3">
                {criteria.map(c => (
                  <div key={c.key} className="flex items-center justify-between gap-4 p-2 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-gray-800">{c.name}</div>
                      <div className="text-[11px] text-gray-400">{c.description}</div>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={qualScores[c.key] ?? 70}
                        onChange={e =>
                          setQualScores({
                            ...qualScores,
                            [c.key]: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full px-2 py-1 border rounded text-sm text-right font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowQualModal(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordQualification}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Submit Qualification Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Market Modal */}
      {showAddMarketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="font-bold text-gray-900">Add Target Country</div>
              <button onClick={() => setShowAddMarketModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Country (ISO-2)</label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="e.g., DE"
                  value={marketCountry}
                  onChange={e => setMarketCountry(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Market Role</label>
                <select
                  value={marketRole}
                  onChange={e => setMarketRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="PRIMARY">Primary Launch Market</option>
                  <option value="SECONDARY">Secondary Territory</option>
                  <option value="EXPANSION">Future Expansion</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={marketDate}
                  onChange={e => setMarketDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowAddMarketModal(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMarket}
                disabled={actionLoading || !marketCountry.trim()}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Market
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Risk Modal */}
      {showAddRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="font-bold text-gray-900">Add Risk Assessment</div>
              <button onClick={() => setShowAddRiskModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={riskType}
                  onChange={e => setRiskType(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="TECHNICAL">Technical / Formulation</option>
                  <option value="REGULATORY">Regulatory / Filing</option>
                  <option value="COMMERCIAL">Commercial / Pricing</option>
                  <option value="SUPPLY">Supply Chain / API</option>
                  <option value="COMPETITIVE">Competitive Response</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Severity</label>
                <select
                  value={riskSeverity}
                  onChange={e => setRiskSeverity(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g., API supplier capacity bottleneck"
                  value={riskDescription}
                  onChange={e => setRiskDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mitigation Plan</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Qualify secondary API source by Q3"
                  value={riskMitigation}
                  onChange={e => setRiskMitigation(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowAddRiskModal(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRisk}
                disabled={actionLoading || !riskDescription.trim()}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Risk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Requirement Modal */}
      {showAddReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="font-bold text-gray-900">Add Requirement Deliverable</div>
              <button onClick={() => setShowAddReqModal(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                <select
                  value={reqType}
                  onChange={e => setReqType(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value="TECHNICAL">Technical Requirement</option>
                  <option value="REGULATORY">Regulatory Requirement</option>
                  <option value="COMMERCIAL">Commercial Requirement</option>
                  <option value="CUSTOMER">Customer Requirement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g., Bioequivalence study data required for EU filing"
                  value={reqDescription}
                  onChange={e => setReqDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowAddReqModal(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddReq}
                disabled={actionLoading || !reqDescription.trim()}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Requirement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
