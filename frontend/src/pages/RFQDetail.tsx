import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, Building, ListTodo, Activity, 
  MessageCircle, Layers, ShieldCheck, FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TasksView from '../components/tasks/TasksView';

export default function RFQDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [rfq, setRfq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any>({ TECHNICAL: [], REGULATORY: [], PRODUCTION: [] });

  const fetchRFQ = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/rfqs/${id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRfq(data);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/rfqs/${id}/timeline`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || localStorage.getItem('token')}` }
      });
      if (res.ok) setTimeline(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAssessments = async (type: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/rfqs/${id}/assessments/${type}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssessments((prev: any) => ({ ...prev, [type]: data }));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (id) {
      fetchRFQ();
      fetchTimeline();
      fetchAssessments('TECHNICAL');
      fetchAssessments('REGULATORY');
      fetchAssessments('PRODUCTION');
    }
  }, [id, session?.access_token]);

  if (loading) return <div className="p-8 text-slate-400">Loading RFQ...</div>;
  if (!rfq) return <div className="p-8 text-red-400">RFQ not found</div>;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4 mr-2" /> },
    { id: 'line_items', label: 'Line Items', icon: <Layers className="w-4 h-4 mr-2" /> },
    { id: 'assessments', label: 'Assessments', icon: <ShieldCheck className="w-4 h-4 mr-2" /> },
    { id: 'quotations', label: 'Quotations', icon: <FileSpreadsheet className="w-4 h-4 mr-2" /> },
    { id: 'clarifications', label: 'Clarifications', icon: <MessageCircle className="w-4 h-4 mr-2" /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-4 h-4 mr-2" /> },
    { id: 'timeline', label: 'Timeline & Audit', icon: <Activity className="w-4 h-4 mr-2" /> }
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
      {/* Header */}
      <div className="flex-none bg-slate-900 border-b border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/rfqs')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white">{rfq.rfq_number}</h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {rfq.status}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                <Building className="w-4 h-4" /> {rfq.customer_name || 'Unknown Customer'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition-colors">
              Place on Hold
            </button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
              Submit Quote
            </button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-6 bg-slate-800/50 rounded-lg p-4 border border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-slate-300">RFQ Completeness</span>
            <span className="text-sm font-medium text-indigo-400">65%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '65%' }}></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none border-b border-slate-800 px-6">
        <div className="flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-lg font-medium text-white mb-4">Description</h3>
                  <p className="text-slate-300">{rfq.description || 'No description provided.'}</p>
                </div>
              </div>
              <div className="col-span-1 space-y-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Details</h3>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm text-slate-500">RFQ Type</dt>
                      <dd className="text-sm font-medium text-white mt-1">{rfq.rfq_type || 'NEW_PRODUCT'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-500">Received Date</dt>
                      <dd className="text-sm font-medium text-white mt-1">{rfq.rfq_date}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-500">Response Due</dt>
                      <dd className="text-sm font-medium text-white mt-1">{rfq.response_due_date || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-500">Priority</dt>
                      <dd className="text-sm font-medium text-white mt-1">{rfq.priority}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'line_items' && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Product / Detail</th>
                    <th className="px-6 py-4 font-medium">Market</th>
                    <th className="px-6 py-4 font-medium text-right">Volume</th>
                    <th className="px-6 py-4 font-medium">Assessments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {(rfq.line_items || []).map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-slate-800/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{item.product_name_as_received || item.product?.product_name || `Item ${idx+1}`}</div>
                        <div className="text-slate-400 text-xs mt-1">
                          {item.dosage_form || 'N/A'} • {item.pack_size || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{item.target_country || 'Global'}</td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        {item.annual_volume || item.quantity || 0} <span className="text-slate-500 text-xs ml-1">{item.unit || 'Pack'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${item.technical_status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                             TECH
                           </span>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${item.regulatory_fit === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                             REG
                           </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!rfq.line_items || rfq.line_items.length === 0) && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No line items attached</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'assessments' && (
            <div className="space-y-6">
              {['TECHNICAL', 'REGULATORY', 'PRODUCTION'].map(type => (
                <div key={type} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-lg font-medium text-white mb-4">{type} Assessments</h3>
                  <div className="text-slate-400 text-sm">
                    {assessments[type]?.length > 0 ? (
                      <div className="space-y-4">
                        {assessments[type].map((a: any) => (
                          <div key={a.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700 flex justify-between items-center">
                            <div>
                              <div className="font-medium text-slate-200">Assessment: {a.status}</div>
                              <div className="text-xs text-slate-500 mt-1">Line Item ID: {a.rfq_line_item_id}</div>
                            </div>
                            <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white transition-colors">Review</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "No assessments created yet. Assign responsibilities to generate tasks."
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tasks' && (
             <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <TasksView defaultSourceType="RFQ" defaultSourceId={id} />
             </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {timeline.map((event, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-12 flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 my-2"></div>
                    {idx !== timeline.length - 1 && <div className="w-px h-full bg-slate-700"></div>}
                  </div>
                  <div className="pb-8">
                    <div className="text-sm font-medium text-white">{event.event_type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(event.created_at).toLocaleString()}</div>
                    {event.details && (
                      <div className="mt-2 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                        <pre className="font-mono text-[10px]">{JSON.stringify(event.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <div className="text-slate-400 text-sm">No timeline events found.</div>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
