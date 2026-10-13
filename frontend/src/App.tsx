import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import AppShell from '@/components/layout/AppShell';
import { AuthProvider } from '@/contexts/AuthContext';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import Dashboard from '@/pages/Dashboard';
import AccessDenied from '@/pages/AccessDenied';
import RoleManagement from '@/pages/RoleManagement';
import RoleEditor from '@/pages/RoleEditor';
import SettingsConfiguration from '@/pages/SettingsConfiguration';
import ResponsibilitySettings from '@/pages/ResponsibilitySettings';
import Tasks from '@/pages/Tasks';
import TaskDetail from '@/pages/TaskDetail';
import Products from '@/pages/Products';
import ProductDetail from '@/pages/ProductDetail';
import Opportunities from '@/pages/Opportunities';
import OpportunityDetail from '@/pages/OpportunityDetail';
import MarketIntelligence from '@/pages/MarketIntelligence';
import RegulatoryIntelligence from '@/pages/RegulatoryIntelligence';
import CommercialEvaluation from '@/pages/CommercialEvaluation';
import RFQs from '@/pages/RFQs';
import RFQDetail from '@/pages/RFQDetail';
import RFQCreateWizard from '@/pages/RFQCreateWizard';
import Analytics from '@/pages/Analytics';
import CustomerIntelligence from '@/pages/CustomerIntelligence';
import WorkflowAdmin from '@/pages/WorkflowAdmin';
import WorkflowAnalytics from '@/pages/WorkflowAnalytics';
import ProductionFeasibility from '@/pages/ProductionFeasibility';
import ProductionFeasibilityDetail from '@/pages/ProductionFeasibilityDetail';
import ProductionFeasibilityWizard from '@/pages/ProductionFeasibilityWizard';
import ProductionFeasibilityEngine from '@/pages/ProductionFeasibilityEngine';
import ProductionDashboard from '@/pages/ProductionDashboard';
import Meetings from '@/pages/Meetings';
import MeetingDetail from '@/pages/MeetingDetail';
import MeetingSettings from '@/pages/MeetingSettings';
import DepartmentEmployeeManagement from '@/pages/DepartmentEmployeeManagement';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              
              {/* Helpful redirects for common typos and aliases */}
              <Route path="/lunch" element={<Navigate to="/login" replace />} />
              <Route path="/launch" element={<Navigate to="/dashboard" replace />} />
              <Route path="/signin" element={<Navigate to="/login" replace />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              
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
                <Route path="/production-feasibility/wizard-legacy" element={<ProductionFeasibilityWizard />} />
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
                <Route path="/configuration/meetings" element={<MeetingSettings />} />
                <Route path="/configuration" element={<SettingsConfiguration />} />
                <Route path="/configuration/responsibility" element={<ResponsibilitySettings />} />
                <Route path="/settings/responsibility" element={<ResponsibilitySettings />} />
              </Route>

              {/* Global Catch-All Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </PermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
