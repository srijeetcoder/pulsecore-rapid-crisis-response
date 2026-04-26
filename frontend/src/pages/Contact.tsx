import { Home, Shield, Mail, Phone, MapPin, Send, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Contact = () => {
  return (
    <div className="min-h-screen bg-void text-white pt-24 font-body relative overflow-hidden">
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

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-24">
          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 tracking-tighter">Contact <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary neon-text-purple">Support</span></h1>
          <p className="text-xl text-stardust max-w-2xl mx-auto leading-relaxed">Direct synchronization channel for network support and platform partnerships.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div className="card-terminal shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent-primary to-accent-secondary"></div>
              <h2 className="text-2xl font-heading font-bold mb-10 text-white uppercase tracking-widest">Support_Registry</h2>
              <div className="space-y-8">
                 <div className="flex items-start space-x-6">
                   <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 shadow-lg shadow-accent-primary/5 transition-transform group-hover:scale-110">
                     <Mail className="text-accent-primary w-7 h-7" />
                   </div>
                   <div>
                     <p className="font-mono text-[10px] text-stardust font-bold uppercase tracking-[0.2em] mb-2">Comms_Channel</p>
                     <p className="text-lg font-heading font-bold text-white">ops@pulsecore.in</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-6">
                   <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 shadow-lg shadow-accent-primary/5 transition-transform group-hover:scale-110">
                     <Phone className="text-accent-primary w-7 h-7" />
                   </div>
                   <div>
                     <p className="font-mono text-[10px] text-stardust font-bold uppercase tracking-[0.2em] mb-2">Hotline_Sync</p>
                     <p className="text-lg font-heading font-bold text-white">+91 SYNC-CORE</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-6">
                   <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg transition-transform group-hover:scale-110">
                     <MapPin className="text-white w-7 h-7" />
                   </div>
                   <div>
                     <p className="font-mono text-[10px] text-stardust font-bold uppercase tracking-[0.2em] mb-2">Root_Location</p>
                     <p className="text-lg font-heading font-bold text-white leading-relaxed">
                       Garia, Kolkata, WB - 700084, Response Zone
                     </p>
                   </div>
                 </div>
              </div>
            </div>

             <div className="card-terminal !p-0 shadow-xl overflow-hidden relative h-[300px]">
               {/* Simple stylized map representation */}
               <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat"></div>
               <div className="relative z-10 h-full flex flex-col justify-end p-8 bg-gradient-to-t from-void to-transparent">
                 <h4 className="font-mono text-white uppercase tracking-[0.3em] text-[10px] mb-3">Sync_Root_HQ</h4>
                 <p className="text-stardust font-body text-sm italic">"The core of our synchronized network."</p>
               </div>
             </div>
          </div>

          <div className="card-terminal shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-accent-primary to-accent-secondary"></div>
            <h2 className="text-2xl font-heading font-bold mb-10 text-center uppercase tracking-widest text-white">Send_Message</h2>
            <form className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Given_Name</label>
                  <input type="text" className="input-terminal w-full" placeholder="Arjun" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Family_Name</label>
                  <input type="text" className="input-terminal w-full" placeholder="Sharma" />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Email_Address</label>
                <input type="email" className="input-terminal w-full" placeholder="arjun@email.in" />
              </div>
              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Category</label>
                <select className="input-terminal w-full appearance-none font-mono text-xs uppercase tracking-widest">
                  <option>General_Inquiry</option>
                  <option>Partnership_Proposal</option>
                  <option>Technical_Support</option>
                  <option>Media_Inquiry</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Message_Body</label>
                <textarea rows={4} className="input-terminal w-full h-32 resize-none" placeholder="Describe the message details..."></textarea>
              </div>
              <button type="submit" className="btn-primary w-full !py-5">
                <Send className="w-5 h-5 mr-3" />
                SEND_MESSAGE
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
