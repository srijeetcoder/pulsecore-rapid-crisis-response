import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function GlobalWebSocket() {
  useWebSocket();
  return null;
}

function App() {
  const token = useStore((state) => state.token);

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
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
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
