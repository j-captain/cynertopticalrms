import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientForm from './pages/PatientForm.jsx';
import Reports from './pages/Reports.jsx';
import Orders from './pages/Orders.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';
import Profile from './pages/Profile.jsx';
import ICD11Codes from './pages/ICD11Codes.jsx';
import InsuranceCodes from './pages/InsuranceCodes.jsx';
import CustomRecipients from './pages/CustomRecipients.jsx';
import DatabasePage from './pages/Database.jsx';
import CollectionViewer from './pages/CollectionViewer.jsx';
import Documents from './pages/Documents.jsx';
import LensTypes from './pages/LensTypes.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import LoginLogs from './pages/LoginLogs.jsx';
import ContactUs from './pages/ContactUs.jsx';
import NotFound from './pages/NotFound.jsx';
import Forbidden from './pages/Forbidden.jsx';

import Billing from './pages/Billing.jsx';

import OpticianPending from './pages/OpticianPending.jsx';
import OpticianAll from './pages/OpticianAll.jsx';
import OpticianAmount from './pages/OpticianAmount.jsx';
import DirectorNew from './pages/DirectorNew.jsx';
import DirectorOrders from './pages/DirectorOrders.jsx';
import OpticianBilled from './pages/OpticianBilled.jsx';
import PaymentChannels from './pages/PaymentChannels.jsx';
import OpticianSubmitted from './pages/OpticianSubmitted.jsx';

const AdminOnly = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/403" replace />;
  return children;
};

const RoleGate = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;
  return children;
};

const HomeRouter = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'optician') return <Navigate to="/optician/amount" replace />;
  if (user.role === 'director') return <Navigate to="/director/new" replace />;
  return <Dashboard />;
};

const App = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/reset-password/:token" element={<ResetPassword />} />
    <Route path="/contact" element={<ContactUs />} />
    <Route path="/403" element={<Forbidden />} />

    <Route path="/" element={<ProtectedRoute><Layout><HomeRouter /></Layout></ProtectedRoute>} />

    {/* Admin / Staff */}
    <Route path="/patients" element={<ProtectedRoute><Layout><Patients /></Layout></ProtectedRoute>} />
    <Route path="/patients/new" element={<ProtectedRoute><Layout><PatientForm /></Layout></ProtectedRoute>} />
    <Route path="/patients/:id/edit" element={<ProtectedRoute><Layout><PatientForm /></Layout></ProtectedRoute>} />
    <Route path="/orders" element={<ProtectedRoute><Layout><Orders /></Layout></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
    <Route path="/icd11" element={<ProtectedRoute><Layout><ICD11Codes /></Layout></ProtectedRoute>} />
    <Route path="/insurance" element={<ProtectedRoute><Layout><InsuranceCodes /></Layout></ProtectedRoute>} />
    <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
    <Route path="/lens-types" element={<ProtectedRoute><Layout><LensTypes /></Layout></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

    {/* Admin-only */}
    <Route path="/billing" element={<AdminOnly><Layout><Billing /></Layout></AdminOnly>} />
    <Route path="/custom-recipients" element={<AdminOnly><Layout><CustomRecipients /></Layout></AdminOnly>} />
    <Route path="/database" element={<AdminOnly><Layout><DatabasePage /></Layout></AdminOnly>} />
    <Route path="/database/:name" element={<AdminOnly><Layout><CollectionViewer /></Layout></AdminOnly>} />
    <Route path="/login-logs" element={<AdminOnly><Layout><LoginLogs /></Layout></AdminOnly>} />
    <Route path="/users" element={<AdminOnly><Layout><Users /></Layout></AdminOnly>} />
    <Route path="/settings" element={<AdminOnly><Layout><Settings /></Layout></AdminOnly>} />
    <Route path="/audit" element={<AdminOnly><Layout><Audit /></Layout></AdminOnly>} />
    <Route path="/payment-channels" element={<AdminOnly><Layout><PaymentChannels /></Layout></AdminOnly>} />

    {/* Optician */}
    <Route path="/optician/pending" element={<RoleGate roles={['optician', 'admin']}><Layout><OpticianPending /></Layout></RoleGate>} />
    <Route path="/optician/billed" element={<RoleGate roles={['optician', 'admin']}><Layout><OpticianBilled /></Layout></RoleGate>} />
    <Route path="/optician/all" element={<RoleGate roles={['optician', 'admin']}><Layout><OpticianAll /></Layout></RoleGate>} />
    <Route path="/optician/amount" element={<RoleGate roles={['optician', 'admin']}><Layout><OpticianAmount /></Layout></RoleGate>} />
    <Route path="/optician/submitted" element={<RoleGate roles={['optician', 'admin']}><Layout><OpticianSubmitted /></Layout></RoleGate>} />

    {/* Director */}
    <Route path="/director/new" element={<RoleGate roles={['director', 'admin']}><Layout><DirectorNew /></Layout></RoleGate>} />
    <Route path="/director/unpaid" element={<RoleGate roles={['director', 'admin']}><Layout><DirectorOrders mode="unpaid" /></Layout></RoleGate>} />
    <Route path="/director/paid" element={<RoleGate roles={['director', 'admin']}><Layout><DirectorOrders mode="paid" /></Layout></RoleGate>} />
    <Route path="/director/payment" element={<RoleGate roles={['director', 'admin']}><Layout><PaymentChannels /></Layout></RoleGate>} />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default App;