import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { AuthProvider } from '@/contexts/AuthContext';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

// Auth routes (lightweight, direct import)
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import AccessDenied from '@/pages/AccessDenied';

// Lazy-loaded Domain Module Pages (Optimized Code-Splitting)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Products = lazy(() => import('@/pages/Products'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Opportunities = lazy(() => import('@/pages/Opportunities'));
const OpportunityDetail = lazy(() => import('@/pages/OpportunityDetail'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const TaskDetail = lazy(() => import('@/pages/TaskDetail'));
const RFQs = lazy(() => import('@/pages/RFQs'));
const RFQDetail = lazy(() => import('@/pages/RFQDetail'));
const RFQCreateWizard = lazy(() => import('@/pages/RFQCreateWizard'));
const CommercialEvaluation = lazy(() => import('@/pages/CommercialEvaluation'));
const ProductionFeasibility = lazy(() => import('@/pages/ProductionFeasibility'));
const ProductionDashboard = lazy(() => import('@/pages/ProductionDashboard'));
const ProductionFeasibilityEngine = lazy(() => import('@/pages/ProductionFeasibilityEngine'));
const ProductionFeasibilityDetail = lazy(() => import('@/pages/ProductionFeasibilityDetail'));
const MarketIntelligence = lazy(() => import('@/pages/MarketIntelligence'));
const RegulatoryIntelligence = lazy(() => import('@/pages/RegulatoryIntelligence'));
const CustomerIntelligence = lazy(() => import('@/pages/CustomerIntelligence'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const WorkflowAdmin = lazy(() => import('@/pages/WorkflowAdmin'));
const WorkflowAnalytics = lazy(() => import('@/pages/WorkflowAnalytics'));
const DepartmentEmployeeManagement = lazy(() => import('@/pages/DepartmentEmployeeManagement'));
const RoleManagement = lazy(() => import('@/pages/RoleManagement'));
const RoleEditor = lazy(() => import('@/pages/RoleEditor'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const MeetingDetail = lazy(() => import('@/pages/MeetingDetail'));
const MeetingCompanion = lazy(() => import('@/pages/MeetingCompanion'));
const MeetingSettings = lazy(() => import('@/pages/MeetingSettings'));
const SettingsConfiguration = lazy(() => import('@/pages/SettingsConfiguration'));
const ResponsibilitySettings = lazy(() => import('@/pages/ResponsibilitySettings'));

// Lightweight Suspense Fallback
const PageLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground text-xs font-mono space-y-2">
    <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
    <span className="tracking-wider uppercase text-[10px]">Loading BDIQ Module...</span>
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionProvider>
          <NotificationProvider>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/access-denied" element={<AccessDenied />} />

                {/* Helpful redirects for common typos and aliases */}
                <Route path="/lunch" element={<Navigate to="/login" replace />} />
                <Route path="/launch" element={<Navigate to="/dashboard" replace />} />
                <Route path="/signin" element={<Navigate to="/login" replace />} />
                <Route path="/auth" element={<Navigate to="/login" replace />} />

                {/* Standalone Meeting Companion Window (for side-by-side with Google Meet/Teams) */}
                <Route path="/meetings/:id/companion" element={<MeetingCompanion />} />

                {/* Protected Routes inside AppShell */}
                <Route element={<AppShell />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/opportunities" element={<Opportunities />} />
                  <Route path="/opportunities/:id" element={<OpportunityDetail />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/tasks/:id" element={<TaskDetail />} />
                  <Route path="/rfqs" element={<RFQs />} />
                  <Route path="/rfqs/create" element={<RFQCreateWizard />} />
                  <Route path="/rfqs/:id" element={<RFQDetail />} />
                  <Route path="/commercial-evaluation" element={<CommercialEvaluation />} />
                  <Route path="/production-feasibility" element={<ProductionFeasibility />} />
                  <Route path="/production-feasibility/dashboard" element={<ProductionDashboard />} />
                  <Route path="/production-feasibility/wizard" element={<ProductionFeasibilityEngine />} />
                  <Route path="/production-feasibility/engine" element={<ProductionFeasibilityEngine />} />
                  {/* Consolidated legacy wizard redirect */}
                  <Route path="/production-feasibility/wizard-legacy" element={<Navigate to="/production-feasibility/wizard" replace />} />
                  <Route path="/production-feasibility/:id" element={<ProductionFeasibilityDetail />} />
                  <Route path="/market-intelligence" element={<MarketIntelligence />} />
                  <Route path="/regulatory-intelligence" element={<RegulatoryIntelligence />} />
                  <Route path="/customer-intelligence" element={<CustomerIntelligence />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/workflows" element={<Navigate to="/workflows/admin" replace />} />
                  <Route path="/workflows/admin" element={<WorkflowAdmin />} />
                  <Route path="/workflows/analytics" element={<WorkflowAnalytics />} />
                  <Route path="/departments" element={<DepartmentEmployeeManagement />} />
                  <Route path="/organization/directory" element={<DepartmentEmployeeManagement />} />
                  <Route path="/users" element={<DepartmentEmployeeManagement />} />
                  <Route path="/roles" element={<RoleManagement />} />
                  <Route path="/roles/:id" element={<RoleEditor />} />
                  <Route path="/meetings" element={<Meetings />} />
                  <Route path="/meetings/:id" element={<MeetingDetail />} />
                  <Route path="/meetings/settings" element={<MeetingSettings />} />
                  <Route path="/configuration" element={<SettingsConfiguration />} />
                  <Route path="/settings" element={<SettingsConfiguration />} />
                  <Route path="/configuration/responsibility" element={<ResponsibilitySettings />} />
                  <Route path="/settings/responsibility" element={<ResponsibilitySettings />} />
                </Route>

                {/* Global Catch-All Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </NotificationProvider>
        </PermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
