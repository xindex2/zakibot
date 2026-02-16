import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import Maintenance from './pages/Maintenance';

import PlansEdit from './pages/PlansEdit';
import AdminSettings from './pages/AdminSettings';
import Orders from './pages/Orders';
import ThankYou from './pages/ThankYou';
import Profile from './pages/Profile';
import Billing from './pages/Billing';
import TopUpCredits from './pages/TopUpCredits';
import EmailCampaign from './pages/EmailCampaign';
import Hosting from './pages/seo/Hosting';
import VPS from './pages/seo/VPS';
import Deploy from './pages/seo/Deploy';
import Install from './pages/seo/Install';
import WhatsAppSEO from './pages/seo/WhatsApp';
import TelegramSEO from './pages/seo/Telegram';
import Contact from './pages/Contact';
import Privacy from './pages/legal/Privacy';
import ToS from './pages/legal/ToS';
import Shell from './components/Shell';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
    const { token, user, loading } = useAuth();

    if (loading) return null;
    if (!token) return <Navigate to="/login" replace />;
    if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

    return <Shell>{children}</Shell>;
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Onboarding />} />
            <Route path="/register-basic" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* SEO Pages */}
            <Route path="/hosting" element={<Hosting />} />
            <Route path="/vps" element={<VPS />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/install" element={<Install />} />

            {/* Legacy SEO Routes */}
            <Route path="/openclaw-hosting" element={<Hosting />} />
            <Route path="/openclaw-vps" element={<VPS />} />
            <Route path="/deploy-openclaw" element={<Deploy />} />
            <Route path="/install-openclaw" element={<Install />} />
            <Route path="/openclaw-whatsapp" element={<WhatsAppSEO />} />
            <Route path="/openclaw-telegram" element={<TelegramSEO />} />
            <Route path="/link-openclaw-whatsapp" element={<WhatsAppSEO />} />
            <Route path="/link-openclaw-telegram" element={<TelegramSEO />} />

            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/tos" element={<ToS />} />

            {/* Protected User Routes */}
            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />
            <Route path="/profile" element={
                <ProtectedRoute>
                    <Profile />
                </ProtectedRoute>
            } />
            <Route path="/billing" element={
                <ProtectedRoute>
                    <Billing />
                </ProtectedRoute>
            } />
            <Route path="/topup" element={
                <ProtectedRoute>
                    <TopUpCredits />
                </ProtectedRoute>
            } />

            {/* Protected Admin Routes */}
            <Route path="/admin" element={
                <ProtectedRoute adminOnly>
                    <AdminDashboard />
                </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
                <ProtectedRoute adminOnly>
                    <UserManagement />
                </ProtectedRoute>
            } />

            <Route path="/admin/orders" element={
                <ProtectedRoute adminOnly>
                    <Orders />
                </ProtectedRoute>
            } />
            <Route path="/admin/plans" element={
                <ProtectedRoute adminOnly>
                    <PlansEdit />
                </ProtectedRoute>
            } />
            <Route path="/admin/maintenance" element={
                <ProtectedRoute adminOnly>
                    <Maintenance />
                </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
                <ProtectedRoute adminOnly>
                    <AdminSettings />
                </ProtectedRoute>
            } />
            <Route path="/admin/emails" element={
                <ProtectedRoute adminOnly>
                    <EmailCampaign />
                </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
