import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Landing from './pages/Landing';
import Shell from './components/Shell';
import { AuthProvider, useAuth } from './context/AuthContext';

// Route-based code splitting — each page loads only when visited
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const SetupBot = lazy(() => import('./pages/SetupBot'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const PlansEdit = lazy(() => import('./pages/PlansEdit'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Orders = lazy(() => import('./pages/Orders'));
const ThankYou = lazy(() => import('./pages/ThankYou'));
const Profile = lazy(() => import('./pages/Profile'));
const Billing = lazy(() => import('./pages/Billing'));
const TopUpCredits = lazy(() => import('./pages/TopUpCredits'));
const EmailCampaign = lazy(() => import('./pages/EmailCampaign'));
const AdminApiActivity = lazy(() => import('./pages/AdminApiActivity'));
const Hosting = lazy(() => import('./pages/seo/Hosting'));
const VPS = lazy(() => import('./pages/seo/VPS'));
const Deploy = lazy(() => import('./pages/seo/Deploy'));
const Install = lazy(() => import('./pages/seo/Install'));
const WhatsAppSEO = lazy(() => import('./pages/seo/WhatsApp'));
const TelegramSEO = lazy(() => import('./pages/seo/Telegram'));
const Contact = lazy(() => import('./pages/Contact'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const ToS = lazy(() => import('./pages/legal/ToS'));

// Minimal loading spinner for lazy-loaded routes
function PageLoader() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-deep, #0a0a0a)',
        }}>
            <div style={{
                width: 32, height: 32,
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#ef4444',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
        </div>
    );
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
    const { token, user, loading } = useAuth();

    if (loading) return null;
    if (!token) return <Navigate to="/login" replace />;
    if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

    return <Shell>{children}</Shell>;
}

function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Onboarding />} />
                <Route path="/register-basic" element={<Register />} />
                <Route path="/setup-bot" element={<SetupBot />} />
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
                <Route path="/admin/api-activity" element={
                    <ProtectedRoute adminOnly>
                        <AdminApiActivity />
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
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
