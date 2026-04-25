import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';

export const useWebSocket = () => {
  const ws = useRef<WebSocket | null>(null);
  const addOrUpdateIncident = useStore((state) => state.addOrUpdateIncident);
  const removeIncidentLocally = useStore((state) => state.removeIncidentLocally);
  const token = useStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const connect = () => {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/ws';
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WS Connected');
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_INCIDENT' || data.type === 'UPDATE_INCIDENT') {
            const state = useStore.getState();
            
            // If it's an update marking it as resolved, and user is NOT staff/responder, show the popup
            const isAuthority = state.user?.role === 'responder' || state.user?.role === 'staff';
            if (data.type === 'UPDATE_INCIDENT' && data.data.status === 'resolved' && !isAuthority) {
              const existing = state.incidents.find(i => i.id === data.data.id);
              if (existing && existing.status !== 'resolved') {
                state.setRegistrationPopupOpen(true);
              }
            }
            
            addOrUpdateIncident(data.data);
          } else if (data.type === 'DELETE_INCIDENT') {
            removeIncidentLocally(data.data.id);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.current.onclose = () => {
        console.log('WS disconnected. Reconnecting...');
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.onclose = null; // Prevent auto-reconnect on unmount
        ws.current.close();
      }
    };
  }, [addOrUpdateIncident, removeIncidentLocally, token]);


  return ws.current;
};
