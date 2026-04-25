import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Incident {
  id: string;
  location: string;
  status: string;
  severity: string;
  emergency_type?: string;
  details?: string;
  latitude?: number;
  longitude?: number;
  ai_advice?: string;
  created_at: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  incidents: Incident[];
  isGuestLoading: boolean;
  isRegistrationPopupOpen: boolean;
  setRegistrationPopupOpen: (isOpen: boolean) => void;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  setIncidents: (incidents: Incident[]) => void;
  addOrUpdateIncident: (incident: Incident) => void;
  removeIncidentLocally: (id: string) => void;
  fetchIncidents: () => Promise<void>;
  triggerSOS: (location: string, panicMessage: string, lat: number | null, lng: number | null) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  removeIncident: (id: string) => Promise<void>;
  guestLogin: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  chatWithAI: (messages: {role: string, text: string}[], context?: string) => Promise<string>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  incidents: [],
  isGuestLoading: false,
  isRegistrationPopupOpen: false,

  setRegistrationPopupOpen: (isOpen) => set({ isRegistrationPopupOpen: isOpen }),

  setAuth: (user, token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  setIncidents: (incidents) => set({ incidents }),

  addOrUpdateIncident: (incident) => set((state) => {
    const exists = state.incidents.find((i) => i.id === incident.id);
    if (exists) {
      return { incidents: state.incidents.map((i) => i.id === incident.id ? incident : i) };
    }
    return { incidents: [incident, ...state.incidents] };
  }),

  removeIncidentLocally: (id) => set((state) => ({
    incidents: state.incidents.filter((i) => i.id !== id),
  })),

  fetchIncidents: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/incidents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({ incidents: data });
      }
    } catch (e) {
      console.error(e);
    }
  },

  triggerSOS: async (location, panicMessage, lat, lng) => {
    const { token } = get();
    if (!token) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location,
          panic_message: panicMessage,
          latitude: lat,
          longitude: lng
        })
      });
    } catch (e) {
      console.error(e);
    }
  },

  updateStatus: async (id, status) => {
    const { token } = get();
    if (!token) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/incidents/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.error(e);
    }
  },

  removeIncident: async (id) => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/incidents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok || res.status === 204) {
        get().removeIncidentLocally(id);
      }
    } catch (e) {
      console.error(e);
    }
  },

  guestLogin: async () => {
    set({ isGuestLoading: true });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        get().setAuth(data.user, data.token);
      } else {
        console.error('Guest login failed:', res.status);
      }
    } catch (e) {
      console.error('Guest login error:', e);
    } finally {
      set({ isGuestLoading: false });
    }
  },

  forgotPassword: async (email: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      return { success: res.ok, message: data.message };
    } catch (e) {
      console.error(e);
      return { success: false, message: "Network error" };
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword })
      });
      const data = await res.json();
      return { success: res.ok, message: data.message };
    } catch (e) {
      console.error(e);
      return { success: false, message: "Network error" };
    }
  },

  chatWithAI: async (messages, context) => {
    const { token } = get();
    // AI chat works even without a token (guest-friendly) but prefer token
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, context })
      });
      if (res.ok) {
        const data = await res.json();
        return data.reply as string;
      }
    } catch (e) {
      console.error(e);
    }
    return "I'm having trouble connecting right now. Please call emergency services: Police 100 | Ambulance 108 | Fire 101.";
  },
}));
