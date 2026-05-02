import React, { useState, useEffect, useMemo } from 'react';
import { LiveChatWidget } from '../components/LiveChatWidget';
import { useStore } from '../store/store';
import { AlertCircle, CheckCircle, Clock, ShieldAlert, Navigation, Settings as SettingsIcon, Trash2, Home, Activity, Search, Filter, Calendar, ArrowUpDown, ChevronDown, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { formatEmergencyText } from '../utils/text';
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

const createCustomIcon = (type: 'police' | 'fire' | 'hospital') => {
  const colorClass = type === 'police' ? 'bg-blue-500 shadow-blue-500/50' :
                     type === 'fire' ? 'bg-orange-500 shadow-orange-500/50' :
                     'bg-red-500 shadow-red-500/50';
  
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div class="w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${colorClass}">
             <div class="w-2 h-2 bg-white rounded-full animate-ping"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isWounded, setIsWounded] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<{name: string, lat: number, lng: number, type: 'police' | 'fire' | 'hospital'} | null>(null);

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

    await triggerSOS(location, panicMessage, finalLat, finalLng, isPureGuest ? name : undefined, isWounded, additionalDetails);
    setIsSOSOpen(false);

    if (searchParams.get('sos') === '1') {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('sos');
      navigate({ search: newSearchParams.toString() }, { replace: true });
    }

    setLocation('');
    setPanicMessage('');
    setAdditionalDetails('');
    setIsWounded(false);
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

  const filteredAndSortedIncidents = useMemo(() => {
    return incidents
      .filter(inc => isAuthority || inc.reporter_id === user?.id)
      .filter(inc => {
        const query = searchQuery.toLowerCase();
        return (
          inc.location.toLowerCase().includes(query) ||
          (inc.emergency_type || '').toLowerCase().includes(query) ||
          (inc.details || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') {
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (sortBy === 'severity') {
          const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
          const aSev = a.severity.toLowerCase();
          const bSev = b.severity.toLowerCase();
          comparison = (severityOrder[aSev as keyof typeof severityOrder] || 0) - 
                       (severityOrder[bSev as keyof typeof severityOrder] || 0);
        } else if (sortBy === 'type') {
          comparison = (a.emergency_type || '').localeCompare(b.emergency_type || '');
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [incidents, isAuthority, user?.id, searchQuery, sortBy, sortOrder]);

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
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
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
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gradient-accent">{isAuthority ? 'Command Center' : 'Network Emergencies'}</h1>
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
                <ChangeView center={selectedFacility ? [selectedFacility.lat, selectedFacility.lng] : center} zoom={selectedFacility ? 15 : zoom} />
                  {selectedFacility && (
                    <Marker position={[selectedFacility.lat, selectedFacility.lng]} icon={createCustomIcon(selectedFacility.type)}>
                      <Popup>
                        <div className="text-gray-900 font-sans font-bold">
                          {selectedFacility.name}
                        </div>
                      </Popup>
                    </Marker>
                  )}
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
              <div className="flex flex-col space-y-6 mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">Active Incidents</h2>
                  {isAuthority && incidents.some(i => i.status === 'resolved') && (
                    <span className="font-mono text-[10px] text-stardust uppercase tracking-widest">
                      Resolved reports archived
                    </span>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stardust/40 group-focus-within:text-accent-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="SEARCH_BY_LOCATION_OR_TYPE..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-terminal w-full !pl-12 !py-3 !text-[10px] font-mono uppercase tracking-widest"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stardust/40" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="input-terminal !pl-12 !pr-8 !py-3 !text-[10px] font-mono uppercase tracking-widest appearance-none cursor-pointer"
                      >
                        <option value="date">SORT_BY_DATE</option>
                        <option value="severity">SORT_BY_SEVERITY</option>
                        <option value="type">SORT_BY_TYPE</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-stardust/40 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="btn-outline !p-3 !bg-surface/50 hover:!border-accent-primary group"
                      title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
                    >
                      <ArrowUpDown className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {filteredAndSortedIncidents.map((incident) => (
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
                      <div className="flex flex-col md:flex-row items-start md:justify-between gap-4">
                        <div className="space-y-2 w-full flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.2em] ${incident.severity === 'critical' ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/50 neon-text-red' :
                                incident.severity === 'high' ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50 neon-text-purple' :
                                  'bg-stardust/20 text-stardust border border-stardust/50'
                              }`}>
                              {incident.severity}
                            </span>
                            <span className="text-stardust font-mono text-[10px] uppercase tracking-widest flex items-center">
                              <Calendar className="w-3 h-3 mr-1.5" />
                              {format(new Date(incident.created_at), 'MMM dd, yyyy')}
                              <Clock className="w-3 h-3 ml-3 mr-1.5" />
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
                              <span className="text-[10px] font-mono font-bold text-stardust uppercase tracking-widest mb-2 block">Incident Brief</span>
                              <p className="text-sm text-stardust leading-relaxed">{incident.details}</p>
                              
                              {incident.is_wounded && (
                                <div className="mt-3 inline-flex items-center px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest">
                                  <ShieldAlert className="w-3 h-3 mr-1.5" />
                                  Casualties / Wounded Reported
                                </div>
                              )}

                              {incident.additional_details && (
                                <div className="mt-4 pt-3 border-t border-white/5">
                                  <span className="text-[9px] font-mono font-bold text-stardust/40 uppercase tracking-widest mb-1 block">Additional Context</span>
                                  <p className="text-xs text-stardust/70 leading-relaxed italic">{incident.additional_details}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {incident.ai_advice && (
                            <div className="mt-4 p-5 bg-accent-primary/[0.03] border border-accent-primary/20 rounded-2xl relative overflow-hidden group shadow-lg shadow-accent-primary/5">
                              {/* Background Pulse */}
                              <div className="absolute inset-0 bg-accent-primary/[0.01] animate-pulse pointer-events-none"></div>
                              
                              {/* Glowing Edge */}
                              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent-primary via-accent-primary/50 to-transparent"></div>

                              <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center space-x-3">
                                  <div className="relative h-5 w-5 flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-accent-primary relative z-10" />
                                    <div className="absolute inset-0 bg-accent-primary/30 blur-md animate-pulse rounded-full"></div>
                                  </div>
                                  <span className="font-mono text-[10px] text-accent-primary uppercase tracking-[0.3em] font-bold">Crisis_Intelligence_Brief</span>
                                </div>
                                <div className="flex items-center space-x-2 bg-accent-primary/10 px-2 py-1 rounded-md border border-accent-primary/20">
                                  <div className="w-1 h-1 rounded-full bg-accent-primary animate-ping"></div>
                                  <span className="font-mono text-[8px] text-accent-primary font-bold uppercase tracking-widest">Synchronized</span>
                                </div>
                              </div>

                              <div className="relative z-10 pl-2">
                                <div className="text-[13px] leading-relaxed text-white/90 font-body">
                                  {formatEmergencyText(incident.ai_advice || '')}
                                </div>
                              </div>
                              
                              <div className="mt-5 pt-3 border-t border-white/5 flex justify-between items-center relative z-10">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-[8px] text-stardust/30 uppercase tracking-widest">Protocol: OPS_ADVISORY_v2.4</span>
                                </div>
                                <div className="flex space-x-1">
                                  {[1, 2, 3].map(i => (
                                    <div key={i} className="w-0.5 h-3 bg-accent-primary/20 rounded-full overflow-hidden">
                                      <div 
                                        className="w-full bg-accent-primary animate-pulse" 
                                        style={{ 
                                          height: '100%', 
                                          animationDuration: `${1 + i * 0.5}s`,
                                          animationDelay: `${i * 0.2}s`
                                        }}
                                      ></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {incident.hospital_contacts && (
                            <div className="mt-8 space-y-4">
                              <div className="flex items-center space-x-2 px-1">
                                <Activity className="w-3.5 h-3.5 text-accent-secondary" />
                                <span className="font-mono text-[9px] text-accent-secondary uppercase tracking-[0.3em] font-bold">Priority_Emergency_Sync</span>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                {incident.hospital_contacts.split('\n').filter(line => line.trim()).map((line, idx) => {
                                  const match = line.match(/^(?:\d+\.\s*)?(.*?)(?:\s*\|\s*(-?\d+\.\d+),\s*(-?\d+\.\d+))?:\s*(.*)$/);
                                  if (match) {
                                    const [, name, latStr, lngStr, phone] = match;
                                    const isPolice = name.toLowerCase().includes('police');
                                    const isFire = name.toLowerCase().includes('fire');
                                    const type = isPolice ? 'police' : isFire ? 'fire' : 'hospital';
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        onClick={() => {
                                          if (latStr && lngStr) {
                                            setSelectedFacility({ name: name.trim(), lat: parseFloat(latStr), lng: parseFloat(lngStr), type });
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                          }
                                        }}
                                        className={`bg-void/40 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-accent-secondary/30 transition-all hover:bg-accent-secondary/[0.02] ${latStr && lngStr ? 'cursor-pointer' : ''}`}
                                      >
                                        <div className="flex items-center space-x-4">
                                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-lg transition-transform group-hover:scale-110 ${
                                            isPolice ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-blue-500/5' :
                                            isFire ? 'bg-orange-500/10 border-orange-500/20 text-orange-400 shadow-orange-500/5' :
                                            'bg-accent-secondary/10 border-accent-secondary/20 text-accent-secondary shadow-accent-secondary/5'
                                          }`}>
                                            {isPolice ? <ShieldAlert className="w-5 h-5" /> : 
                                             isFire ? <Activity className="w-5 h-5" /> : 
                                             <ShieldAlert className="w-5 h-5" />}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-[11px] font-heading font-bold text-white uppercase tracking-wider truncate">{name}</p>
                                            <p className="text-[10px] font-mono text-stardust/60 mt-1">{phone}</p>
                                          </div>
                                        </div>
                                        <a 
                                          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                                          className="btn-ghost !p-2.5 !rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:!bg-accent-secondary hover:!text-white border border-transparent hover:border-accent-secondary/50"
                                          title={`Call ${name}`}
                                        >
                                          <Phone className="w-4 h-4" />
                                        </a>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={idx} className="bg-void/40 border border-white/5 rounded-xl p-4 text-[10px] font-mono text-stardust/60 italic">
                                      {formatEmergencyText(line)}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row md:flex-col flex-wrap space-x-2 md:space-x-0 space-y-0 md:space-y-2 md:ml-4 shrink-0 w-full md:w-auto">
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
                    placeholder="Describe the main situation (e.g. fire, accident, medical)..."
                    className="input-terminal w-full h-24 resize-none"
                  />
                </div>

                <div className="flex items-center space-x-4 p-4 bg-accent-secondary/5 border border-accent-secondary/20 rounded-xl">
                  <input
                    type="checkbox"
                    id="wounded"
                    checked={isWounded}
                    onChange={(e) => setIsWounded(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-700 text-accent-secondary focus:ring-accent-secondary bg-void cursor-pointer"
                  />
                  <label htmlFor="wounded" className="text-sm font-heading font-bold text-white cursor-pointer select-none">
                    Are you or any victim wounded?
                  </label>
                </div>

                <div>
                  <label className="block font-mono text-[10px] font-bold text-stardust mb-3 uppercase tracking-widest">Additional Context (Optional)</label>
                  <textarea
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    placeholder="E.g. Number of people involved, visible threats, or specific landmarks nearby..."
                    className="input-terminal w-full h-20 resize-none"
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
                      // Force register mode explicitly via state
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
