import { ShieldAlert, Home, Shield, Users, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

export const About = () => {
  return (
    <div className="min-h-screen bg-transparent text-white pt-24 font-body relative overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      <nav className="border-b border-white/5 bg-void/60 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <ShieldAlert className="h-8 w-8 text-accent-secondary transition-transform group-hover:scale-110" />
            <div className="flex flex-col leading-none">
              <span className="font-heading font-bold text-xl tracking-tight uppercase">PulseCore</span>
              <span className="font-mono text-[9px] text-accent-primary font-bold uppercase tracking-[0.3em]">Crisis Response Network</span>
            </div>
          </Link>
          <Link 
            to="/" 
            className="btn-ghost !px-6 !py-2.5 !text-[10px] font-mono uppercase tracking-[0.2em]"
          >
            <Home className="w-4 h-4 mr-2" />
            HOME
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-24">
          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-8 tracking-tighter">About <span className="text-gradient-accent">The System</span></h1>
          <p className="text-xl text-stardust max-w-3xl mx-auto leading-relaxed">
            We are engineering a high-precision security layer to bridge the gap between crisis reporting and synchronized response systems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 group card-terminal p-8 flex items-center justify-center">
            <img 
              src="/community_safety_team_1777093131227.png" 
              alt="Safety Team" 
              className="w-3/4 rounded-2xl object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100 shadow-2xl shadow-accent-primary/20"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent pointer-events-none"></div>
          </div>
          <div className="flex flex-col justify-center space-y-8">
            <h2 className="text-4xl font-heading font-bold text-accent-primary uppercase tracking-tight">Our System</h2>
            <p className="text-stardust leading-relaxed text-lg">
              In a crisis, synchronization is the ultimate security. Traditional response systems suffer from latency and fragmentation. Our platform provides a unified, real-time network that empowers guests, staff, and responders to operate as a single, hardened unit.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="card-terminal !p-6">
                <Users className="text-accent-primary w-8 h-8 mb-4" />
                <h4 className="font-heading font-bold text-sm uppercase tracking-widest">System Synergy</h4>
              </div>
              <div className="card-terminal !p-6 !border-accent-primary/20">
                <Target className="text-accent-primary w-8 h-8 mb-4" />
                <h4 className="font-heading font-bold text-sm uppercase tracking-widest">Zero Latency</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="card-terminal !p-16 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
          <h2 className="text-4xl font-heading font-bold mb-16 text-center uppercase tracking-widest">Core Pillars</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
            <div className="text-center group">
              <div className="w-20 h-20 bg-accent-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-accent-primary/20 shadow-lg shadow-accent-primary/5 transition-transform group-hover:scale-110">
                <Shield className="text-accent-primary w-10 h-10" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4 uppercase">Integrity</h3>
              <p className="text-stardust text-sm leading-relaxed">Ensuring privacy and secure communication for all users in distress.</p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 bg-accent-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-accent-primary/20 shadow-lg shadow-accent-primary/5 transition-transform group-hover:scale-110">
                <Target className="text-accent-primary w-10 h-10" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4 uppercase">Precision</h3>
              <p className="text-stardust text-sm leading-relaxed">Leveraging AI analysis and sub-meter GPS to identify critical emergency needs.</p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-lg transition-transform group-hover:scale-110">
                <Users className="text-white w-10 h-10" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4 uppercase">Synergy</h3>
              <p className="text-stardust text-sm leading-relaxed">Seamlessly connecting distributed teams through a singular high-frequency command interface.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
