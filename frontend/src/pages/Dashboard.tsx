import React, { useState, useEffect } from 'react';
import { LiveChatWidget } from '../components/LiveChatWidget';
import { useStore } from '../store/store';
import { AlertCircle, CheckCircle, Clock, ShieldAlert, Navigation, Settings as SettingsIcon, Trash2, Home, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { incidents, user, token, fetchIncidents, triggerSOS, updateStatus, removeIncident, isRegistrationPopupOpen, setRegistrationPopupOpen, guestLogin, toggleRespond, setActiveChatIncidentId } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [panicMessage, setPanicMessage] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isAuthority = user?.role === 'responder' || user?.role === 'staff';
  const isGuest = user?.role === 'guest';
  // Pure anonymous guests are auto-generated with @pulsecore.local emails.
  // Email-registered users who chose the 'guest' role should still see Settings.
  const isPureGuest = isGuest && (user?.email?.endsWith('@pulsecore.local') ?? false);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Sync name from user when user loads
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  // Auto-open SOS modal if ?sos=1 is in the URL (guest emergency flow)
  useEffect(() => {
    if (searchParams.get('sos') === '1' && !isAuthority) {
      setIsSOSOpen(true);
    }
  }, [searchParams]);

  // Auto-trigger guest login when arriving via the emergency button without a token
  useEffect(() => {
    if (searchParams.get('sos') === '1' && !token) {
      guestLogin();
    }
  }, [searchParams, token, guestLogin]);

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

  // Geocode a text address to lat/lng using OpenStreetMap Nominatim (free, no API key)
  const geocodeLocation = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const encoded = encodeURIComponent(address);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'PulseCore/1.0 (crisis-response)' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    }
    return null;
  };

  const handleSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeocodeError('');

    let finalLat = lat;
    let finalLng = lng;

    // If user typed a location but didn't use GPS auto-detect, geocode the text
    if (location.trim() && (finalLat === null || finalLng === null)) {
      setIsGeocoding(true);
      const coords = await geocodeLocation(location);
      setIsGeocoding(false);
      if (coords) {
        finalLat = coords.lat;
        finalLng = coords.lng;
      } else {
        setGeocodeError('Could not find coordinates for that location. Try being more specific, or use the GPS button.');
        // Still submit — location text alone is better than nothing
      }
    }

    await triggerSOS(location, panicMessage, finalLat, finalLng, isPureGuest ? name : undefined);
    setIsSOSOpen(false);
    setLocation('');
    setPanicMessage('');
    setGeocodeError('');
    setLat(null);
    setLng(null);
  };

  const handleSOSClose = async () => {
    setIsSOSOpen(false);
    if (isPureGuest) {
      if (token) {
        try {
          await fetch(`${import.meta.env.VITE_API_URL}/api/auth/cleanup-guest`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (e) {
          console.error('Cleanup failed:', e);
        }
      }
      useStore.getState().logout();
    }
    navigate('/');
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

  // Wait for the full profile sync (ensures we have user.id, etc.)
  if (!user || !user.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="animate-pulse flex flex-col items-center">
          <ShieldAlert className="w-12 h-12 text-accent-primary mb-4" />
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-stardust">Establishing Secure Sync...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-6 pt-24 font-body relative overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
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
            {isPureGuest && (
              <Link 
                to="/login" 
                className="btn-outline !px-6 !py-3 !text-[10px] font-mono uppercase tracking-[0.2em] border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10"
              >
                Get Access
              </Link>
            )}
            {!isPureGuest && (
              <Link to="/settings" className="btn-outline !p-3 !bg-surface/50 group" title="Account Settings">
                <SettingsIcon className="w-6 h-6 text-stardust group-hover:text-accent-primary transition-colors" />
              </Link>
            )}
            {!isAuthority && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsSOSOpen(true)}
                className="btn-primary !px-10 !py-3.5"
              >
                <ShieldAlert className="w-5 h-5 mr-3 animate-pulse" />
                INITIATE SOS
              </motion.button>
            )}
          </div>
        </motion.div>

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
                <AnimatePresence mode="popLayout">
                  {incidents
                    .filter(inc => isAuthority || inc.reporter_id === user?.id)
                    .map((incident) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
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

                          {isAuthority && (
                            <div className="flex items-center space-x-2 mt-1 bg-surface/30 p-2 rounded-lg border border-white/5">
                              <input
                                type="checkbox"
                                id={`respond-${incident.id}`}
                                checked={incident.responder_id === user?.id}
                                onChange={(e) => toggleRespond(incident.id, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-700 text-accent-secondary focus:ring-accent-secondary bg-void cursor-pointer"
                              />
                              <label htmlFor={`respond-${incident.id}`} className="text-[10px] font-mono uppercase tracking-widest text-stardust cursor-pointer">
                                Responding
                              </label>
                            </div>
                          )}

                          {!isAuthority && (
                            <button
                              onClick={() => {
                                setActiveChatIncidentId(incident.id);
                              }}
                              className="btn-outline !px-3 !py-2 !text-[10px] font-mono uppercase tracking-wider !rounded-xl mt-1 !border-accent-secondary/30 hover:!bg-accent-secondary/10 !text-accent-secondary"
                            >
                              Open Chat
                            </button>
                          )}

                          {isAuthority && incident.responder_id === user?.id && (
                            <button
                              onClick={() => setActiveChatIncidentId(incident.id)}
                              className="btn-outline !px-3 !py-2 !text-[10px] font-mono uppercase tracking-wider !rounded-xl mt-1 !border-accent-secondary/30 hover:!bg-accent-secondary/10 !text-accent-secondary"
                            >
                              Open Chat
                            </button>
                          )}

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
                    </motion.div>
                  ))}
                </AnimatePresence>
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
      <AnimatePresence>
        {isSOSOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/90 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="card-alert max-w-md w-full border-accent-secondary/30 shadow-2xl shadow-accent-secondary/5"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-heading font-bold text-accent-secondary flex items-center neon-text-red">
                  <ShieldAlert className="w-7 h-7 mr-3" />
                  INITIATE SOS
                </h2>
                <button onClick={handleSOSClose} className="text-stardust hover:text-white transition-colors">✕</button>
              </div>

              {user?.role === 'guest' && (
                <div className="mb-8 p-4 bg-accent-secondary/5 border border-accent-secondary/20 rounded-xl">
                  <p className="font-mono text-[10px] text-stardust leading-relaxed uppercase tracking-widest">
                    🧑 Reporting as <strong className="text-accent-secondary">GUEST_USER</strong>. Alert will be prioritized immediately.
                  </p>
                </div>
              )}

              <form onSubmit={handleSOS} className="space-y-8">
                {isPureGuest && (
                  <div>
                    <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Identify_As (Name)</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Name..."
                      className="input-terminal w-full"
                    />
                  </div>
                )}
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
                      onChange={(e) => {
                        setLocation(e.target.value);
                        // Clear GPS coords when user manually edits — will re-geocode on submit
                        if (lat !== null || lng !== null) {
                          setLat(null);
                          setLng(null);
                        }
                        setGeocodeError('');
                      }}
                      placeholder="Type a place, city, or address..."
                      className="input-terminal flex-1"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={getLocation}
                      className="btn-outline !px-4 !py-0 !h-12 !rounded-xl"
                      title="Auto-detect GPS location"
                    >
                      <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin text-accent-primary' : ''}`} />
                    </motion.button>
                  </div>
                  {/* Show GPS-detected coords as confirmation */}
                  {lat !== null && lng !== null && (
                    <p className="mt-2 font-mono text-[10px] text-accent-primary/70 uppercase tracking-widest">
                      📍 GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
                    </p>
                  )}
                  {/* Geocode status / error */}
                  {isGeocoding && (
                    <p className="mt-2 font-mono text-[10px] text-stardust animate-pulse uppercase tracking-widest">
                      🌐 Resolving coordinates...
                    </p>
                  )}
                  {geocodeError && (
                    <p className="mt-2 font-mono text-[10px] text-accent-secondary uppercase tracking-widest">
                      ⚠️ {geocodeError}
                    </p>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isGeocoding}
                  className="btn-primary w-full !py-5 shadow-lg shadow-accent-primary/20 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Activity className={`w-5 h-5 mr-2 ${isGeocoding ? 'animate-spin' : 'animate-pulse'}`} />
                  {isGeocoding ? 'Resolving Location...' : 'Report Emergency'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              {isPureGuest && (
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
              {isPureGuest ? (
                <>
                  <button
                    onClick={() => {
                      if (user && user.id) {
                        localStorage.setItem('previous_guest_id', user.id);
                      }
                      setRegistrationPopupOpen(false);
                      navigate('/login', { state: { isRegister: true, upgrade: true } });
                    }}
                    className="btn-primary w-full !text-xs"
                  >
                    Create an Account
                  </button>
                  <button
                    onClick={async () => {
                      if (token) {
                        try {
                          await fetch(`${import.meta.env.VITE_API_URL}/api/auth/cleanup-guest`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                        } catch (e) {
                          console.error('Cleanup failed:', e);
                        }
                      }
                      useStore.getState().logout();
                      setRegistrationPopupOpen(false);
                      window.location.href = '/';
                    }}
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
      <LiveChatWidget />
    </div>
  );
};
