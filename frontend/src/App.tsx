import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useStore } from './store/store';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Settings } from './pages/Settings';
import { useWebSocket } from './hooks/useWebSocket';
import { AiChatWidget } from './components/AiChatWidget';
import { TiltedGridBackground } from './components/TiltedGridBackground';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore((state) => state.token);
  return token ? children : <Navigate to="/login" />;
}

// SOS emergency flows bypass auth — Dashboard handles guestLogin + spinner internally.
// All other unauthenticated dashboard access still redirects to /login.
function DashboardRoute() {
  const token = useStore((state) => state.token);
  const [searchParams] = useSearchParams();
  const isSOS = searchParams.get('sos') === '1';
  if (!token && !isSOS) return <Navigate to="/login" />;
  return <Dashboard />;
}

function GlobalWebSocket() {
  useWebSocket();
  return null;
}

function App() {
  const token = useStore((state) => state.token);
  const fetchProfile = useStore((state) => state.fetchProfile);

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token, fetchProfile]);

  return (
    <Router>
      <TiltedGridBackground />
      {/* Global Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        <div className="ambient-blob ambient-blob-primary"></div>
        <div className="ambient-blob ambient-blob-secondary"></div>
        <div className="ambient-blob ambient-blob-tertiary"></div>
      </div>
      
      {token && <GlobalWebSocket />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {/* Global AI chat widget — visible on all authenticated pages */}
      {token && <AiChatWidget />}
    </Router>
  );
}

export default App;
