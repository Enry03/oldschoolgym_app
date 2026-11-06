import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Spinner } from './components/ui'
import { AuthProvider } from './context/AuthContext'
import { ClientLayout, RequireAuth, StaffLayout } from './layouts/Layouts'
import { ForgotPassword, Login, Register, UpdatePassword } from './pages/public/Auth'
import Landing from './pages/public/Landing'
import { CookieBanner, CookiePolicy, Privacy } from './pages/public/Legal'

const ClientHome = lazy(() => import('./pages/client/Home'))
const ClientCalendar = lazy(() => import('./pages/client/Calendar'))
const Training = lazy(() => import('./pages/client/Training'))
const MembershipPage = lazy(() => import('./pages/client/Membership'))
const QrPass = lazy(() => import('./pages/client/QrPass'))
const Profile = lazy(() => import('./pages/client/Profile'))
const Social = {
  Notifications: lazy(() => import('./pages/client/Social').then((m) => ({ default: m.NotificationsPage }))),
  News: lazy(() => import('./pages/client/Social').then((m) => ({ default: m.NewsPage }))),
  Messages: lazy(() => import('./pages/client/Social').then((m) => ({ default: m.MessagesPage }))),
  Invite: lazy(() => import('./pages/client/Social').then((m) => ({ default: m.InvitePage }))),
  Personal: lazy(() => import('./pages/client/Social').then((m) => ({ default: m.PersonalPage }))),
}
const StaffDashboard = lazy(() => import('./pages/staff/Dashboard'))
const Clients = lazy(() => import('./pages/staff/Clients'))
const ClientDetail = lazy(() => import('./pages/staff/ClientDetail'))
const StaffCalendar = lazy(() => import('./pages/staff/StaffCalendar'))
const Checkin = lazy(() => import('./pages/staff/Checkin'))
const Workouts = lazy(() => import('./pages/staff/Workouts'))
const admin = (k: string) => lazy(() => import('./pages/staff/Admin').then((m) => ({ default: (m as unknown as Record<string, React.ComponentType>)[k] })))
const More = admin('More')
const Comms = admin('Comms')
const StatsPage = admin('StatsPage')
const LeadsPage = admin('LeadsPage')
const PricingPage = admin('PricingPage')
const ShopPage = admin('ShopPage')
const ExportPage = admin('ExportPage')
const SettingsPage = admin('SettingsPage')
const AuditPage = admin('AuditPage')

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/accedi" element={<Login />} />
            <Route path="/registrati" element={<Register />} />
            <Route path="/password-dimenticata" element={<ForgotPassword />} />
            <Route path="/nuova-password" element={<UpdatePassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookie" element={<CookiePolicy />} />

            <Route element={<RequireAuth />}>
              <Route path="/app" element={<ClientLayout />}>
                <Route index element={<ClientHome />} />
                <Route path="calendario" element={<ClientCalendar />} />
                <Route path="allenamento" element={<Training />} />
                <Route path="schede" element={<Navigate to="/app/allenamento" replace />} />
                <Route path="abbonamento" element={<MembershipPage />} />
                <Route path="qr" element={<QrPass />} />
                <Route path="profilo" element={<Profile />} />
                <Route path="notifiche" element={<Social.Notifications />} />
                <Route path="news" element={<Social.News />} />
                <Route path="messaggi" element={<Social.Messages />} />
                <Route path="invita" element={<Social.Invite />} />
                <Route path="personal" element={<Social.Personal />} />
              </Route>
            </Route>

            <Route element={<RequireAuth staff />}>
              <Route path="/staff" element={<StaffLayout />}>
                <Route index element={<StaffDashboard />} />
                <Route path="clienti" element={<Clients />} />
                <Route path="clienti/:id" element={<ClientDetail />} />
                <Route path="calendario" element={<StaffCalendar />} />
                <Route path="checkin" element={<Checkin />} />
                <Route path="schede" element={<Workouts />} />
                <Route path="altro" element={<More />} />
                <Route path="comunicazioni" element={<Comms />} />
                <Route path="statistiche" element={<StatsPage />} />
                <Route path="lead" element={<LeadsPage />} />
                <Route path="listino" element={<PricingPage />} />
                <Route path="shop" element={<ShopPage />} />
                <Route path="export" element={<ExportPage />} />
                <Route path="impostazioni" element={<SettingsPage />} />
                <Route path="registro" element={<AuditPage />} />
                <Route path="messaggi" element={<Social.Messages />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <CookieBanner />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#0F1F3A', color: '#FCF8ED', border: '1px solid #233A63', borderRadius: '16px' },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
