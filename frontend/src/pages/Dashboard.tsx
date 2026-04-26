import React, { useState, useEffect } from 'react';
import { useStore } from '../store/store';
import { AlertCircle, CheckCircle, Clock, ShieldAlert, Navigation, Settings as SettingsIcon, Trash2, Home, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link, useSearchParams } from 'react-router-dom';

// Fix leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to recenter map
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export const Dashboard = () => {
  const { incidents, user, fetchIncidents, triggerSOS, updateStatus, removeIncident, isRegistrationPopupOpen, setRegistrationPopupOpen } = useStore();
  const [searchParams] = useSearchParams();
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [panicMessage, setPanicMessage] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Auto-open SOS modal if ?sos=1 is in the URL (guest emergency flow)
  useEffect(() => {
    if (searchParams.get('sos') === '1') {
      setIsSOSOpen(true);
    }
  }, [searchParams]);

  const getLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          setLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
          setIsLocating(false);
        },
        (error) => {
          console.error("Error obtaining location", error);
          setIsLocating(false);
        }
      );
    } else {
      setIsLocating(false);
    }
  };

  const handleSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    await triggerSOS(location, panicMessage, lat, lng);
    setIsSOSOpen(false);
    setLocation('');
    setPanicMessage('');
    setLat(null);
    setLng(null);
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    await removeIncident(id);
    setRemovingId(null);
  };

  // Default center: India (geographic center)
  const center: [number, number] = [20.5937, 78.9629];
  let zoom = 5;
  let activeIncidents = incidents.filter(i => i.status !== 'resolved');
  if (activeIncidents.length > 0 && activeIncidents[0].latitude && activeIncidents[0].longitude) {
    center[0] = activeIncidents[0].latitude;
    center[1] = activeIncidents[0].longitude;
    zoom = 13;
  }

  const isAuthority = user?.role === 'responder' || user?.role === 'staff';
  const isGuest = user?.role === 'guest';

  return (
    <div className="min-h-screen bg-transparent text-white p-6 pt-24 font-body relative overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link
              to="/"
              className="btn-ghost !px-4 !py-2 mr-4 !text-[10px] font-mono uppercase tracking-[0.2em]"
            >
              <Home className="w-4 h-4 mr-2" />
              HOME
            </Link>
            <div>
              <h1 className="text-3xl font-heading font-bold text-gradient-accent">{isAuthority ? 'Command Center' : 'Network Emergencies'}</h1>
              <p className="text-stardust font-mono text-xs uppercase tracking-widest mt-1">
                Real-time Active Units
                {user?.role === 'guest' && (
                  <span className="ml-3 px-2 py-0.5 text-[10px] bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/30 rounded-full font-bold">
                    GUEST_ACCESS
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            {!isGuest && (
              <Link to="/settings" className="btn-outline !p-3 !bg-surface/50 group" title="Account Settings">
                <SettingsIcon className="w-6 h-6 text-stardust group-hover:text-accent-primary transition-colors" />
              </Link>
            )}
            <button
              onClick={() => setIsSOSOpen(true)}
              className="btn-primary !px-10 !py-3.5"
            >
              <ShieldAlert className="w-5 h-5 mr-3 animate-pulse" />
              INITIATE SOS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Map View */}
            <div className="card-terminal !p-1 h-[350px] overflow-hidden relative z-0 shadow-2xl">
              <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', borderRadius: '0.9rem' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <ChangeView center={center} zoom={zoom} />
                {activeIncidents.map((inc) => (
                  inc.latitude && inc.longitude ? (
                    <Marker key={inc.id} position={[inc.latitude, inc.longitude]}>
                      <Popup>
                        <div className="text-gray-900 font-sans">
                          <strong>{inc.emergency_type}</strong><br />
                          {inc.status}<br />
                          {inc.location}
                        </div>
                      </Popup>
                    </Marker>
                  ) : null
                ))}
              </MapContainer>
            </div>

            {/* Incidents List */}
            <div className="card-terminal shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-heading font-bold text-white">Active Incidents</h2>
                {isAuthority && incidents.some(i => i.status === 'resolved') && (
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-widest">
                    Resolved reports archived
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={`p-6 bg-void rounded-2xl border transition-all group relative overflow-hidden ${incident.status === 'resolved'
                        ? 'border-green-800/20 opacity-60 hover:opacity-100'
                        : 'border-white/5 hover:border-accent-primary/30 shadow-lg hover:shadow-accent-primary/5'
                      }`}
                  >
                    <div className="absolute top-0 right-0 p-4 font-mono text-[9px] text-accent-primary/20 uppercase tracking-widest">ID_{incident.id.slice(-6)}</div>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.2em] ${incident.severity === 'critical' ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/50 neon-text-red' :
                              incident.severity === 'high' ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50 neon-text-purple' :
                                'bg-stardust/20 text-stardust border border-stardust/50'
                            }`}>
                            {incident.severity}
                          </span>
                          <span className="text-stardust font-mono text-[10px] uppercase tracking-widest flex items-center">
                            <Clock className="w-3 h-3 mr-1.5" />
                            {format(new Date(incident.created_at), 'HH:mm:ss')}
                          </span>
                          {incident.emergency_type && (
                            <span className="text-primary text-sm font-semibold flex items-center">
                              <AlertCircle className="w-4 h-4 mr-1" />
                              {incident.emergency_type}
                            </span>
                          )}
                          {incident.status === 'resolved' && (
                            <span className="px-3 py-1 text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-mono font-bold uppercase tracking-widest">
                              STATUS_RESOLVED
                            </span>
                          )}
                        </div>
                        <p className="text-xl font-heading font-bold text-white mt-4">{incident.location}</p>

                        {incident.details && (
                          <div className="mt-4 bg-surface p-4 rounded-xl border border-white/5 shadow-inner">
                            <span className="text-[10px] font-mono font-bold text-stardust uppercase tracking-widest mb-2 block">Incident Details</span>
                            <p className="text-sm text-stardust leading-relaxed">{incident.details}</p>
                          </div>
                        )}

                        {incident.ai_advice && (
                          <div className="mt-4 p-4 bg-accent-primary/5 border border-accent-primary/20 rounded-xl relative">
                            <div className="absolute top-2 right-4 font-mono text-[9px] text-accent-primary/30">CRISIS AI</div>
                            <p className="text-sm text-stardust flex items-start">
                              <span className="mr-3 text-accent-primary">⚙️</span> {incident.ai_advice}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col space-y-2 ml-4 shrink-0">
                        <select
                          value={incident.status}
                          onChange={(e) => updateStatus(incident.id, e.target.value, incident.emergency_type)}
                          disabled={!isAuthority}
                          className="input-terminal !h-10 !text-xs font-mono uppercase tracking-widest disabled:opacity-40"
                        >
                          <option value="reported">Reported</option>
                          <option value="investigating">Auditing</option>
                          <option value="resolving">Syncing</option>
                          <option value="resolved">Proved</option>
                        </select>

                        {/* Remove button — only for resolved incidents, only for authorities */}
                        {isAuthority && incident.status === 'resolved' && (
                          <button
                            onClick={() => handleRemove(incident.id)}
                            disabled={removingId === incident.id}
                            title="Remove resolved case"
                            className="btn-danger !px-3 !py-2 !text-xs !rounded-lg !bg-red-500/10 hover:!bg-red-600 !text-red-400 hover:!text-white border !border-red-500/30 hover:!border-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {removingId === incident.id ? 'Removing…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {incidents.length === 0 && (
                  <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    No active incidents. Venue is secure.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-terminal shadow-xl">
              <h2 className="text-xl font-heading font-bold mb-8 uppercase tracking-widest text-white">System Status</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-void rounded-xl border border-white/5">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-widest">Network Status</span>
                  <span className="flex items-center text-accent-primary text-xs font-mono font-bold">
                    <div className="w-2 h-2 rounded-full bg-accent-primary mr-3 animate-ping"></div>
                    LIVE
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-void rounded-xl border border-white/5">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-widest">AI Core</span>
                  <span className="text-accent-primary text-xs font-mono font-bold neon-text-purple">SYSTEM_ACTIVE</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-void rounded-xl border border-white/5">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-widest">Auth Level</span>
                  <span className={`text-xs font-mono font-bold uppercase text-accent-primary`}>
                    {user?.role ?? 'ANONYMOUS'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="card-terminal shadow-xl">
              <h2 className="text-xl font-heading font-bold mb-8 uppercase tracking-widest text-white">Response Statistics</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-[0.2em]">Total Reports</span>
                  <span className="font-mono text-lg font-bold text-white">{incidents.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-[0.2em]">Active Crisis</span>
                  <span className="font-mono text-lg font-bold text-accent-secondary">{incidents.filter(i => i.status !== 'resolved').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-[0.2em]">Validated</span>
                  <span className="font-mono text-lg font-bold text-green-400">{incidents.filter(i => i.status === 'resolved').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-stardust uppercase tracking-[0.2em]">High Priority</span>
                  <span className="font-mono text-lg font-bold text-accent-secondary neon-text-red">{incidents.filter(i => i.severity === 'critical').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SOS Modal */}
      {isSOSOpen && (
        <div className="fixed inset-0 bg-void/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="card-alert max-w-md w-full border-accent-secondary/30 shadow-2xl shadow-accent-secondary/5">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-heading font-bold text-accent-secondary flex items-center neon-text-red">
                <ShieldAlert className="w-7 h-7 mr-3" />
                INITIATE SOS
              </h2>
              <button onClick={() => setIsSOSOpen(false)} className="text-stardust hover:text-white transition-colors">✕</button>
            </div>

            {user?.role === 'guest' && (
              <div className="mb-8 p-4 bg-accent-secondary/5 border border-accent-secondary/20 rounded-xl">
                <p className="font-mono text-[10px] text-stardust leading-relaxed uppercase tracking-widest">
                  🧑 Reporting as <strong className="text-accent-secondary">GUEST_USER</strong>. Alert will be prioritized immediately.
                </p>
              </div>
            )}

            <form onSubmit={handleSOS} className="space-y-8">
              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Emergency Details</label>
                <textarea
                  required
                  value={panicMessage}
                  onChange={(e) => setPanicMessage(e.target.value)}
                  placeholder="Describe the situation for AI analysis..."
                  className="input-terminal w-full h-32 resize-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Unit Geolocation</label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Physical location or Lat/Lng..."
                    className="input-terminal flex-1"
                  />
                  <button
                    type="button"
                    onClick={getLocation}
                    className="btn-outline !px-4 !py-0 !h-12 !rounded-xl"
                    title="Fetch precision GPS"
                  >
                    <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full !py-5 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-accent-primary/20 active:scale-95 flex items-center justify-center"
              >
                <Activity className="w-5 h-5 mr-2 animate-pulse" />
                Report Emergency
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Guest Registration Popup */}
      {isRegistrationPopupOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Emergency Resolved</h2>
            <p className="text-gray-400 mb-6">
              The emergency you reported has been successfully resolved by our responder team.
              {isGuest && (
                <>
                  <br /><br />
                  If you found our PulseCore service helpful, please consider registering for a full account to get access to advanced features, family tracking, and faster response times!
                </>
              )}
              {!isGuest && (
                <>
                  <br /><br />
                  Case resolved. Thanks and stay safe!
                </>
              )}
            </p>
            <div className="flex flex-col space-y-3">
              {isGuest ? (
                <>
                  <button
                    onClick={() => {
                      setRegistrationPopupOpen(false);
                      window.location.href = '/login?register=1';
                    }}
                    className="btn-primary w-full !text-xs"
                  >
                    Create an Account
                  </button>
                  <button
                    onClick={() => setRegistrationPopupOpen(false)}
                    className="btn-outline w-full !text-xs !text-stardust/60"
                  >
                    Maybe Later
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setRegistrationPopupOpen(false)}
                  className="btn-primary w-full !text-xs"
                >
                  Great, Thanks!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
