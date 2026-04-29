import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { ShieldAlert, Eye, EyeOff, Home } from 'lucide-react';

type Step = 'login' | 'register' | 'otp';

export const Login = () => {
  const location = useLocation();
  const [step, setStep] = useState<Step>(location.state?.isRegister ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('guest');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');


  const setAuth = useStore((state) => state.setAuth);
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (step === 'otp') {
      try {
        const previousGuestId = localStorage.getItem('previous_guest_id');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, guest_id: previousGuestId }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Verification failed');

        setAuth(data.user, data.token);
        localStorage.removeItem('previous_guest_id');
        if (location.state?.triggerSOS) {
          navigate('/dashboard', { state: { triggerSOS: true } });
        } else if (data.user.role === 'guest') {
          navigate('/dashboard');
        } else {
          navigate('/settings');
        }
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const isRegister = step === 'register';
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { email, password, name, role } : { email, password };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isRegister) {
        // Assume backend returns { message: "OTP sent" }
        setStep('otp');
        setSuccessMsg('Registration successful! Please check the terminal for the OTP.');
      } else {
        setAuth(data.user, data.token);
        if (location.state?.triggerSOS) {
          navigate('/dashboard', { state: { triggerSOS: true } });
        } else if (data.user.role === 'guest') {
          navigate('/dashboard');
        } else {
          navigate('/settings');
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent px-4 relative overflow-hidden font-body">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      
      {/* Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-accent-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <Link 
        to="/" 
        className="absolute top-8 left-8 btn-ghost !px-5 !py-2.5 !text-[10px] font-mono uppercase tracking-[0.2em]"
      >
        <Home className="w-4 h-4 mr-2" />
        HOME
      </Link>
      <div className="max-w-md w-full space-y-10 card-terminal !p-10 relative z-10">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <ShieldAlert className="h-14 w-14 text-accent-secondary mx-auto" />
            <div className="absolute inset-0 bg-accent-secondary/20 blur-xl rounded-full animate-pulse"></div>
          </div>
          <h2 className="text-3xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary tracking-tight uppercase">PulseCore</h2>
          <p className="mt-3 font-mono text-[10px] text-stardust uppercase tracking-[0.3em]">
            {step === 'otp' ? 'AUTH_VERIFICATION_REQUIRED' : (step === 'register' ? 'SYSTEM_REGISTRATION' : 'SYSTEM_ACCESS')}
          </p>
        </div>
        <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
          {error && <div className="font-mono text-[10px] text-accent-secondary text-center bg-accent-secondary/10 py-3 rounded-lg border border-accent-secondary/30 uppercase tracking-widest">{error}</div>}
          {successMsg && <div className="font-mono text-[10px] text-green-500 text-center bg-green-500/10 py-3 rounded-lg border border-green-500/30 uppercase tracking-widest">{successMsg}</div>}
          
          <div className="space-y-4">
            {step === 'otp' ? (
              <div>
                <label className="block font-mono text-[10px] text-stardust mb-4 uppercase tracking-[0.2em] text-center">Verification Code</label>
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="input-terminal w-full !text-4xl text-center font-mono tracking-[0.5em] !h-20 text-accent-primary"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
            ) : (
              <>
                {step === 'register' && (
                  <>
                    <div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-terminal w-full"
                        placeholder="FULL_NAME"
                      />
                    </div>
                    <div>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="input-terminal w-full font-mono text-xs uppercase tracking-widest"
                      >
                        <option value="guest" className="bg-void text-stardust">GUEST_USER</option>
                        <option value="staff" className="bg-void text-stardust">STAFF_MEMBER</option>
                        <option value="responder" className="bg-void text-stardust">RESPONDER</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-terminal w-full"
                    placeholder="EMAIL_ADDRESS"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-terminal w-full pr-12"
                    placeholder="PASSWORD"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-stardust/40 hover:text-accent-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {step === 'login' && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-[10px] font-mono text-stardust hover:text-accent-primary uppercase tracking-widest transition-colors">
                      FORGOT_PASSWORD?
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <button
              type="submit"
              className="btn-primary w-full !py-4.5 !text-xs"
            >
              {step === 'otp' ? 'VERIFY_CODE' : (step === 'register' ? 'CREATE_ACCOUNT' : 'SIGN_IN')}
            </button>
          </div>
        </form>


        {step !== 'otp' && (
          <div className="text-center">
            <button
              onClick={() => {
                setStep(step === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="font-mono text-[10px] text-stardust hover:text-accent-primary uppercase tracking-[0.2em] transition-colors"
            >
              {step === 'register' ? 'ALREADY_REGISTERED?_LOGIN' : "NEW_USER?_SIGN_UP"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
