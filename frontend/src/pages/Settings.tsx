import React, { useState } from 'react';
import { useStore } from '../store/store';
import { UserCircle, LogOut, Home } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Settings = () => {
  const { user, setAuth } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [success, setSuccess] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('Settings saved successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleLogout = () => {
    setAuth(null, null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-void text-white pt-24 px-4 font-body relative overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      
      {/* Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-accent-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex space-x-6">
            <Link 
              to="/" 
              className="btn-ghost !px-6 !py-2.5 !text-[10px] font-mono uppercase tracking-[0.2em]"
            >
              <Home className="w-4 h-4 mr-2" />
              HOME
            </Link>
            <Link to="/dashboard" className="flex items-center font-mono text-[10px] text-stardust hover:text-accent-primary uppercase tracking-widest transition-colors">&larr; Back_to_Dashboard</Link>
          </div>
          <h1 className="text-3xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary uppercase tracking-tight">Account_Settings</h1>
        </div>

        <div className="card-terminal !p-0 overflow-hidden shadow-2xl relative z-10">
          <div className="p-10 border-b border-white/5 flex items-center space-x-6 bg-white/2">
            <div className="h-24 w-24 rounded-2xl bg-accent-primary/10 flex items-center justify-center border border-accent-primary/30 shadow-lg shadow-accent-primary/10">
              <UserCircle className="h-14 w-14 text-accent-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-white tracking-tight">{user?.name}</h1>
              <p className="font-mono text-xs text-stardust/60 mt-1 uppercase tracking-widest">{user?.email}</p>
              <span className="inline-block mt-4 px-4 py-1.5 bg-void rounded-lg text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-accent-primary border border-accent-primary/20 shadow-inner">
                ACCOUNT_ROLE: {user?.role}
              </span>
            </div>
          </div>

          <div className="p-10">
            <h2 className="text-xl font-heading font-bold mb-8 uppercase tracking-widest text-white/80">Account_Details</h2>
            <form onSubmit={handleSave} className="space-y-8">
              {success && <div className="p-4 font-mono text-[10px] bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg uppercase tracking-widest text-center">{success}</div>}
              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Full_Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-terminal w-full"
                  placeholder="NAME_DETAILS"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Email_Address (Immutable)</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input-terminal w-full !opacity-40 !cursor-not-allowed"
                />
              </div>

              <div className="pt-8 flex items-center justify-between border-t border-white/5">
                <button
                  type="submit"
                  className="btn-primary !px-10 !py-4 !text-[10px] font-mono uppercase tracking-[0.2em]"
                >
                  Update_Account
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-ghost !px-8 !py-4 !border-accent-primary/20 hover:!border-accent-primary/50 !text-accent-primary !text-[10px] font-mono uppercase tracking-[0.2em]"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
