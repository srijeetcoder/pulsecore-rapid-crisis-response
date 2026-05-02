import React, { useState } from 'react';
import { useStore } from '../store/store';
import { UserCircle, LogOut, Home, ShieldAlert } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Settings = () => {
  const { user, setAuth, updateProfile, token } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergency_contact || '');
  
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setAuth(null, null);
        navigate('/');
      } else {
        console.error('Account deletion failed:', res.status);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await updateProfile({
      name,
      phone,
      occupation,
      dob,
      bio,
      emergency_contact: emergencyContact
    });

    setLoading(false);
    if (result.success) {
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.message);
    }
  };

  const handleLogout = () => {
    setAuth(null, null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-transparent text-white pt-24 px-4 font-body relative overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

      {/* Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-accent-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="max-w-3xl mx-auto pb-20">
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

        {(!user || (user.role === 'guest' && user.email?.endsWith('@pulsecore.local'))) ? (
          <div className="card-terminal text-center shadow-2xl relative z-10 py-20 px-8">
            <UserCircle className="w-20 h-20 text-accent-primary/50 mx-auto mb-6" />
            <h2 className="text-3xl font-heading font-bold text-white mb-4">Guest Session Active</h2>
            <p className="text-stardust max-w-md mx-auto mb-10 leading-relaxed">
              You are currently browsing the network anonymously. To save personal details, manage your emergency contacts, or change system preferences, please log in or create a full account.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link to="/login" className="btn-outline w-full sm:w-auto !px-10 !py-4 uppercase tracking-widest text-xs font-mono">
                Log In
              </Link>
              <Link to="/login" state={{ isRegister: true }} className="btn-primary w-full sm:w-auto !px-10 !py-4 uppercase tracking-widest text-xs font-mono">
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="card-terminal !p-0 overflow-hidden shadow-2xl relative z-10">
            <div className="p-6 sm:p-10 border-b border-white/5 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left space-y-4 sm:space-y-0 sm:space-x-6 bg-white/2">
              <div className="h-24 w-24 rounded-2xl bg-accent-primary/10 flex items-center justify-center border border-accent-primary/30 shadow-lg shadow-accent-primary/10">
                <UserCircle className="h-14 w-14 text-accent-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-bold text-white tracking-tight">{user.name}</h1>
                <p className="font-mono text-xs text-stardust/60 mt-1 uppercase tracking-widest">{user.email}</p>
                <span className="inline-block mt-4 px-4 py-1.5 bg-void rounded-lg text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-accent-primary border border-accent-primary/20 shadow-inner">
                   AUTHENTICATED_AS: {user.role.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-10">
              <h2 className="text-xl font-heading font-bold mb-8 uppercase tracking-widest text-white/80 border-l-4 border-accent-primary pl-6">Profile_Configuration</h2>
              <form onSubmit={handleSave} className="space-y-8">
                {success && <div className="p-4 font-mono text-[10px] bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg uppercase tracking-widest text-center">{success}</div>}
                {error && <div className="p-4 font-mono text-[10px] bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary rounded-lg uppercase tracking-widest text-center">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">About_Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="input-terminal w-full !h-24 py-4"
                      placeholder="Enter a brief biography..."
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Full_Identity_Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-terminal w-full"
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Identity_Email (Read-Only)</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="input-terminal w-full !opacity-40 !cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Current_Occupation</label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="input-terminal w-full"
                      placeholder="e.g. Software Engineer, Doctor"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Date_of_Birth</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="input-terminal w-full [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Primary_Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-terminal w-full"
                      placeholder="+XX XXXXX XXXXX"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Emergency_Contact_Protocol</label>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="input-terminal w-full"
                      placeholder="Name & Contact Details"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Link to="/forgot-password" className="text-[10px] font-mono text-stardust hover:text-accent-primary uppercase tracking-widest transition-colors underline underline-offset-4 decoration-accent-primary/30">
                    Need to change security passphrase?
                  </Link>
                </div>

                <div className="pt-8 flex flex-col sm:flex-row items-center justify-between border-t border-white/5 space-y-4 sm:space-y-0">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full sm:w-auto !px-12 !py-4.5 !text-[10px] font-mono uppercase tracking-[0.2em] shadow-xl shadow-accent-primary/10"
                  >
                    {loading ? 'SYNCHRONIZING...' : 'COMMIT_CHANGES'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="btn-ghost w-full sm:w-auto !px-8 !py-4 !border-accent-primary/20 hover:!border-accent-primary/50 !text-accent-primary !text-[10px] font-mono uppercase tracking-[0.2em]"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Logout
                  </button>
                </div>

                <div className="mt-12 pt-8 border-t border-accent-secondary/20 bg-accent-secondary/5 rounded-xl p-6">
                  <h3 className="text-lg font-heading font-bold text-accent-secondary mb-2 uppercase tracking-widest">Danger Zone</h3>
                  <p className="text-stardust/60 text-xs mb-6 leading-relaxed">
                    Permanently delete your PulseCore account. This action cannot be undone, and all historical incident data, tokens, and credentials will be purged entirely.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteWarningOpen(true)}
                    className="btn-danger !px-8 !py-3.5 !bg-accent-secondary/10 hover:!bg-accent-secondary !text-accent-secondary hover:!text-white border !border-accent-secondary/30 hover:!border-accent-secondary transition-all font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    Delete Account Permanently
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {isDeleteWarningOpen && (
          <div className="fixed inset-0 bg-void/95 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="card-alert max-w-md w-full border-accent-secondary/30 shadow-2xl shadow-accent-secondary/5 text-center p-8">
              <div className="w-16 h-16 bg-accent-secondary/20 text-accent-secondary rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-accent-secondary mb-3 uppercase tracking-tight">Warning: Irreversible Purge</h2>
              <p className="text-stardust/80 text-sm mb-8 leading-relaxed">
                You are about to wipe your profile and all associated incident logs completely. Once committed, you will be forcibly logged out.
              </p>
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleDeleteAccount}
                  className="btn-primary !bg-accent-secondary hover:!bg-accent-secondary/80 w-full !py-4 uppercase tracking-widest text-xs font-mono shadow-lg shadow-accent-secondary/20"
                >
                  Confirm Deletion
                </button>
                <button
                  onClick={() => setIsDeleteWarningOpen(false)}
                  className="btn-outline w-full !py-4 uppercase tracking-widest text-xs font-mono !text-stardust/60"
                >
                  Abort Operation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
