import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { ShieldAlert, Activity, MapPin, Brain, ShieldCheck, Loader2, Home, ArrowRight, ChevronLeft, ChevronRight, Mail, Phone, MapPin as MapPinIcon, Globe, MessageCircle, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export const Landing = () => {
  const navigate = useNavigate();
  const token = useStore((state) => state.token);
  const guestLogin = useStore((state) => state.guestLogin);
  const logout = useStore((state) => state.logout);
  const isGuestLoading = useStore((state) => state.isGuestLoading);

  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Real-Time Emergency Synchronization",
      desc: "Instantly connect with responders through our AI-driven command interface.",
      image: "/emergency_command_center_1777093052968.png"
    },
    {
      title: "Personal SOS Monitoring",
      desc: "One-tap emergency broadcast with precise geolocation tracking.",
      image: "/mobile_sos_app_ui_1777093078073.png"
    },
    {
      title: "Community Safety Network",
      desc: "Built on trust and cutting-edge synchronization technology.",
      image: "/community_safety_team_1777093131227.png"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  const handleEmergency = async () => {
    if (token) {
      navigate('/dashboard?sos=1');
    } else {
      await guestLogin();
      navigate('/dashboard?sos=1');
    }
  };

  return (
    <div className="min-h-screen bg-void text-white selection:bg-accent-primary/30 font-body relative overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-accent-secondary/5 blur-[100px] rounded-full pointer-events-none"></div>
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-void/60 backdrop-blur-md fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="relative">
                  <ShieldAlert className="h-8 w-8 text-accent-secondary transition-transform group-hover:scale-110" />
                  <div className="absolute inset-0 bg-accent-secondary/20 blur-lg rounded-full animate-pulse"></div>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-heading font-bold text-xl tracking-tight uppercase">Rapid Crisis</span>
                  <span className="font-mono text-[9px] text-accent-primary font-bold uppercase tracking-[0.3em]">Response Network</span>
                </div>
              </Link>
              <div className="hidden md:flex space-x-1">
                <Link to="/" className="btn-ghost font-mono text-xs uppercase tracking-widest">Home</Link>
                <Link to="/about" className="btn-ghost font-mono text-xs uppercase tracking-widest">About</Link>
                <Link to="/contact" className="btn-ghost font-mono text-xs uppercase tracking-widest">Support</Link>
              </div>
            </div>
            <div className="flex space-x-6 items-center">
              {token ? (
                <>
                  <button 
                    onClick={() => logout()} 
                    className="font-mono text-xs text-stardust hover:text-white uppercase tracking-widest transition-colors"
                  >
                    Disconnect
                  </button>
                  <Link to="/dashboard" className="btn-primary !py-2.5 !px-6 !text-xs">
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="font-mono text-xs text-stardust hover:text-white uppercase tracking-widest transition-colors">
                    Access
                  </Link>
                  <Link to="/login" state={{ isRegister: true }} className="btn-primary !py-2.5 !px-6 !text-xs">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero / Carousel Section */}
      <div className="relative pt-40 pb-32 overflow-hidden">
        {/* Orbital Graphic */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 orbital-ring-1 orbital-ring"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 orbital-ring-2 orbital-ring"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-xs font-mono font-bold uppercase tracking-widest mb-10 animate-fade-in">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Emergency Response Core
            </div>
            <h1 className="text-5xl md:text-8xl font-heading font-bold tracking-tighter mb-10 leading-[1.1] max-w-5xl">
              {slides[currentSlide].title.split(' ').map((word, i, arr) => 
                i >= arr.length - 2 ? (
                  <span key={i} className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary neon-text-purple">
                    {word}{' '}
                  </span>
                ) : word + ' '
              )}
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-stardust font-body leading-relaxed mb-12">
              {slides[currentSlide].desc}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-6 sm:space-y-0 sm:space-x-8">
              <button 
                onClick={handleEmergency}
                disabled={isGuestLoading}
                className="btn-primary !px-12 !py-5 text-lg"
              >
                {isGuestLoading ? (
                  <>
                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Activity className="mr-3 h-6 w-6 animate-pulse" />
                    SEND ALERT
                  </>
                )}
              </button>
              <Link 
                to={token ? "/dashboard" : "/login"}
                className="btn-outline !px-12 !py-5 text-lg"
              >
                Enter Terminal
                <ArrowRight className="ml-3 w-5 h-5" />
              </Link>
            </div>

              {!token && (
                <p className="mt-4 text-sm text-gray-500">
                  Secure anonymous session created automatically for guests.
                </p>
              )}
            </div>

            {/* Carousel Visuals */}
            <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-gray-700 group animate-in fade-in slide-in-from-right duration-700">
              <div 
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out transform scale-105 group-hover:scale-110"
                style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent"></div>
              
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                <div className="space-y-1">
                  <div className="flex space-x-2">
                    {slides.map((_, i) => (
                      <div key={i} className={i === currentSlide ? "h-1.5 rounded-full transition-all duration-500 w-8 bg-accent-primary" : "h-1.5 rounded-full transition-all duration-500 w-2 bg-white/30"}></div>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={prevSlide} className="p-3 bg-void/80 hover:bg-accent-primary rounded-full transition-all border border-white/10"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={nextSlide} className="p-3 bg-void/80 hover:bg-accent-primary rounded-full transition-all border border-white/10"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="bg-dark-matter/50 border-y border-white/5 py-20 backdrop-blur-sm relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            <div className="group">
              <div className="font-mono text-5xl font-bold text-accent-primary mb-3 transition-transform group-hover:scale-110">2.5s</div>
              <div className="font-mono text-stardust uppercase tracking-[0.2em] text-[10px] font-bold">Data Synchronization</div>
            </div>
            <div className="group">
              <div className="font-mono text-5xl font-bold text-white mb-3 transition-transform group-hover:scale-110">99.9%</div>
              <div className="font-mono text-stardust uppercase tracking-[0.2em] text-[10px] font-bold">System Availability</div>
            </div>
            <div className="group">
              <div className="font-mono text-5xl font-bold text-white mb-3 transition-transform group-hover:scale-110">100%</div>
              <div className="font-mono text-stardust uppercase tracking-[0.2em] text-[10px] font-bold">Response Log</div>
            </div>
            <div className="group">
              <div className="font-mono text-5xl font-bold text-accent-primary mb-3 transition-transform group-hover:scale-110">24/7</div>
              <div className="font-mono text-stardust uppercase tracking-[0.2em] text-[10px] font-bold">Active Analysis</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 relative">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-heading font-bold mb-6 tracking-tight">System <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary">Precision</span></h2>
          <p className="text-stardust max-w-2xl mx-auto text-lg leading-relaxed">Our infrastructure leverages high-precision response protocols to ensure mission-critical reliability.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="card-terminal group relative">
            <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-accent-primary/20">UNIT_01</div>
            <div className="h-14 w-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center mb-8 border border-accent-primary/20 shadow-lg shadow-accent-primary/5 transition-transform group-hover:scale-110">
              <MapPin className="h-7 w-7 text-accent-primary" />
            </div>
            <h3 className="text-2xl font-heading font-bold mb-4 text-white">Live Geolocation</h3>
            <p className="text-stardust leading-relaxed text-sm font-body">Sub-meter coordinate broadcast through a resilient routing layer for immediate responder dispatch.</p>
          </div>

          <div className="card-highlight group relative">
            <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-accent-primary/20">UNIT_02</div>
            <div className="h-14 w-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center mb-8 border border-accent-primary/20 shadow-lg shadow-accent-primary/5 transition-transform group-hover:scale-110">
              <Brain className="h-7 w-7 text-accent-primary" />
            </div>
            <h3 className="text-2xl font-heading font-bold mb-4 text-white">AI Response Core</h3>
            <p className="text-stardust leading-relaxed text-sm font-body">Integrated AI synchronization analyzing situational data to generate high-tier emergency protocols.</p>
          </div>

          <div className="card-terminal group relative">
            <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-accent-primary/20">UNIT_03</div>
            <div className="h-14 w-14 bg-white/5 rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-lg transition-transform group-hover:scale-110">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-2xl font-heading font-bold mb-4 text-white">Safety Protocol</h3>
            <p className="text-stardust leading-relaxed text-sm font-body">Encrypted verification protocols ensuring that only authenticated responders maintain network command.</p>
          </div>
        </div>
      </div>

      <footer className="bg-void pt-32 pb-16 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center space-x-3 mb-8">
                <ShieldAlert className="h-8 w-8 text-accent-secondary" />
                <span className="font-heading font-bold text-xl tracking-tight uppercase text-white">Rapid Crisis</span>
              </div>
              <p className="text-stardust text-sm leading-relaxed mb-8">
                A premier synchronized security layer for emergency synchronization and community resilience. 
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-stardust hover:text-accent-primary transition-colors"><Globe className="w-5 h-5" /></a>
                <a href="#" className="text-stardust hover:text-accent-primary transition-colors"><MessageCircle className="w-5 h-5" /></a>
                <a href="#" className="text-stardust hover:text-accent-primary transition-colors"><Share2 className="w-5 h-5" /></a>
              </div>
            </div>
            
            <div>
              <h4 className="font-mono text-white font-bold mb-8 uppercase tracking-[0.2em] text-[10px]">Registry</h4>
              <ul className="space-y-4 text-stardust text-sm">
                <li><Link to="/" className="hover:text-accent-primary transition-colors">Network Map</Link></li>
                <li><Link to="/about" className="hover:text-accent-primary transition-colors">Protocol Docs</Link></li>
                <li><Link to="/contact" className="hover:text-accent-primary transition-colors">Support Portal</Link></li>
                <li><Link to="/login" className="hover:text-accent-primary transition-colors">Access Key</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-white font-bold mb-8 uppercase tracking-[0.2em] text-[10px]">Headquarters</h4>
              <ul className="space-y-6 text-stardust text-sm">
                <li className="flex items-start">
                  <MapPinIcon className="w-5 h-5 mr-4 text-accent-primary shrink-0" />
                  <span className="leading-relaxed">Garia, Kolkata, WB - 700084, Response Zone</span>
                </li>
                <li className="flex items-center">
                  <Phone className="w-5 h-5 mr-4 text-accent-primary shrink-0" />
                  <span className="font-mono">+91 SYNC-CORE</span>
                </li>
                <li className="flex items-center">
                  <Mail className="w-5 h-5 mr-4 text-accent-primary shrink-0" />
                  <span className="font-mono">ops@rapidcrisis.org</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-10 flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            <p className="font-mono text-stardust text-[10px] uppercase tracking-widest text-center">
              © {new Date().getFullYear()} Rapid Crisis Response Network. System v4.0.0
            </p>
            <div className="flex space-x-6">
              <Link to="/about" className="btn-ghost !px-6 !py-2 !text-[10px] font-mono uppercase tracking-[0.2em]">Documentation</Link>
              <Link to="/contact" className="btn-primary !px-8 !py-2 !text-[10px] font-mono uppercase tracking-[0.2em]">Contact Ops</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
