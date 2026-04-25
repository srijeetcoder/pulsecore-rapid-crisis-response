import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { Home, KeyRound } from 'lucide-react';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const forgotPassword = useStore((state) => state.forgotPassword);
  const resetPassword = useStore((state) => state.resetPassword);
  const navigate = useNavigate();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) {
      setStep('reset');
      setSuccess('OTP sent to your email.');
    } else {
      setError(result.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await resetPassword(email, otp, newPassword);
    setLoading(false);
    if (result.success) {
      setSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-void px-4 relative overflow-hidden font-body">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
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
            <KeyRound className="h-14 w-14 text-accent-primary mx-auto" />
            <div className="absolute inset-0 bg-accent-primary/20 blur-xl rounded-full animate-pulse"></div>
          </div>
          <h2 className="text-3xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary tracking-tight uppercase">Reset Protocol</h2>
          <p className="mt-3 font-mono text-[10px] text-stardust uppercase tracking-[0.3em]">
            {step === 'request' ? 'SYNC_REQUEST_PENDING' : 'VALIDATING_NEW_KEY'}
          </p>
        </div>

        {error && (
          <div className="font-mono text-[10px] text-accent-secondary text-center bg-accent-secondary/10 py-3 rounded-lg border border-accent-secondary/30 uppercase tracking-widest">
            {error}
          </div>
        )}
        {success && (
          <div className="font-mono text-[10px] text-green-500 text-center bg-green-500/10 py-3 rounded-lg border border-green-500/30 uppercase tracking-widest">
            {success}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={step === 'request' ? handleRequestOtp : handleResetPassword}>
          <div className="space-y-4">
            {step === 'request' ? (
              <div>
                <label className="block font-mono text-[10px] text-stardust mb-3 uppercase tracking-widest">Identity_Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-terminal w-full"
                  placeholder="SYNC_KEY_EMAIL"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block font-mono text-[10px] text-stardust mb-4 uppercase tracking-[0.2em] text-center">Protocol OTP</label>
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
                <div>
                  <label className="block font-mono text-[10px] text-stardust mb-3 uppercase tracking-widest">New_Passphrase</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-terminal w-full"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full !py-4.5 !text-xs"
          >
            {loading ? 'SYNCING...' : (step === 'request' ? 'REQUEST_RESET_KEY' : 'UPDATE_PASSPHRASE')}
          </button>
        </form>

        <div className="text-center">
          <Link to="/login" className="font-mono text-[10px] text-stardust hover:text-accent-primary uppercase tracking-[0.2em] transition-colors">
            Return_to_Authentication
          </Link>
        </div>
      </div>
    </div>
  );
};
