/**
 * Routes and route guards (US-13 AC5, AC6).
 *
 * Visitors who are not logged in can open only Log in, Register, the two password reset pages
 * ("Forgot password?" and the page the emailed link opens) and the Privacy page (linked from Register,
 * so it is open to everyone); every other address, including unknown ones, sends them to Log in.
 * Logged-in students who open Log in or Register go to Home.
 */
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { SessionProvider } from './lib/session.jsx'
import { useSession } from './lib/useSession.js'
import Badges from './pages/Badges.jsx'
import FindStudents from './pages/FindStudents.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Guide from './pages/Guide.jsx'
import History from './pages/History.jsx'
import Home from './pages/Home.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import LogAction from './pages/LogAction.jsx'
import Login from './pages/Login.jsx'
import Privacy from './pages/Privacy.jsx'
import Register from './pages/Register.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import { NotFound } from './pages/SimplePages.jsx'
import StudentProfile from './pages/StudentProfile.jsx'
import Success from './pages/Success.jsx'

/**
 * Renders the child routes only for logged-in students.
 * @returns {import('react').JSX.Element | null}
 */
function RequireLogin() {
  const { session, loading } = useSession()
  if (loading) return null
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

/**
 * Renders the child routes only for visitors (not logged in).
 * @returns {import('react').JSX.Element | null}
 */
function VisitorsOnly() {
  const { session, loading } = useSession()
  if (loading) return null
  return session ? <Navigate to="/" replace /> : <Outlet />
}

/**
 * The app: router, session and routes.
 * @returns {import('react').JSX.Element}
 */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SessionProvider>
        <Routes>
          <Route element={<VisitorsOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route element={<RequireLogin />}>
            <Route path="/" element={<Home />} />
            <Route path="/log" element={<LogAction />} />
            <Route path="/log/success" element={<Success />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/history" element={<History />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/students" element={<FindStudents />} />
            <Route path="/students/:id" element={<StudentProfile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
