import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { MessageSquare, X, Send, Loader2, ChevronDown, ShieldAlert } from 'lucide-react';
import { formatEmergencyText } from '../utils/text';
import { format } from 'date-fns';

export const LiveChatWidget: React.FC = () => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { 
    user, 
    incidents, 
    messages, 
    activeChatIncidentId, 
    isChatOpen: isOpen,
    setChatOpen: setIsOpen,
    setActiveChatIncidentId,
    fetchMessages, 
    sendMessage 
  } = useStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine which incident we are chatting about
  // For victims: their own active incident
  // For responders: the activeChatIncidentId selected via UI
  const isAuthority = user?.role === 'responder' || user?.role === 'staff';
  
  const activeIncident = incidents.find(i => 
    isAuthority 
      ? i.id === activeChatIncidentId 
      : i.reporter_id === user?.id && i.status !== 'resolved'
  );

  const incidentMessages = activeIncident ? (messages[activeIncident.id] || []) : [];
  const isResponderAssigned = !!activeIncident?.responder_id;

  useEffect(() => {
    if (activeIncident) {
      fetchMessages(activeIncident.id);
      
      // Poll for messages as fallback if WS misses something
      const interval = setInterval(() => {
        fetchMessages(activeIncident.id);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [activeIncident?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [incidentMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeIncident || !isResponderAssigned) return;

    setIsSending(true);
    await sendMessage(activeIncident.id, text);
    setInput('');
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Do not render if no incident context exists for the current user role
  if (!activeIncident) return null;

  return (
    <>
      {/* Floating Chat Window */}
      <div
        className={`fixed bottom-24 left-4 z-50 w-[350px] flex flex-col transition-all duration-300 ease-in-out ${isOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        style={{ maxHeight: 'calc(100vh - 140px)' }}
      >
        <div className="card-terminal !p-0 shadow-black/50 flex flex-col overflow-hidden"
          style={{ height: '480px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-secondary/30 to-accent-secondary/10 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-secondary to-accent-secondary/80 flex items-center justify-center shadow-lg shadow-accent-secondary/20">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                {isResponderAssigned && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-void animate-ping" />
                )}
              </div>
              <div>
                <p className="text-sm font-heading font-bold text-white uppercase tracking-tight">Responder Chat</p>
                <p className="font-mono text-[9px] text-stardust/70 uppercase tracking-widest">
                  {isResponderAssigned ? 'Secure Live Connection' : 'Awaiting Assignment'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages or Unavailable State */}
          {!isResponderAssigned ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-accent-secondary animate-pulse" />
              <div>
                <p className="text-lg font-bold text-white">Responder Unavailable</p>
                <p className="text-sm text-stardust mt-2 leading-relaxed">
                  Responders are currently triaging active units. Live messaging will be activated automatically once a responder is assigned to your case.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
              {incidentMessages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <span className="font-mono text-[8px] text-stardust/40 uppercase mb-1 tracking-widest px-1">
                      {isOwn ? 'YOU' : msg.sender_name.toUpperCase()}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isOwn
                        ? 'bg-accent-secondary text-white rounded-br-sm shadow-lg shadow-accent-secondary/10'
                        : 'bg-void border border-white/5 text-stardust rounded-bl-sm'
                        }`}
                    >
                      <p className="font-body">{formatEmergencyText(msg.content)}</p>
                      <p className={`font-mono text-[9px] mt-2 uppercase tracking-widest ${isOwn ? 'text-white/60' : 'text-accent-secondary/40'}`}>
                        {format(new Date(msg.timestamp), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-4 border-t border-white/5 bg-surface shrink-0">
            <div className="flex items-center gap-3 bg-void border border-white/5 rounded-xl px-4 py-2.5 focus-within:border-accent-secondary transition-all duration-300">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isResponderAssigned ? "Type message..." : "Live chat locked..."}
                disabled={isSending || !isResponderAssigned}
                className="flex-1 bg-transparent text-sm text-white placeholder-stardust/30 font-body focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending || !isResponderAssigned}
                className="p-1.5 rounded-lg bg-gradient-to-br from-accent-secondary to-accent-secondary/80 text-white shadow-lg shadow-accent-secondary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

  // If the widget is not open, don't render the toggle button either
  // (per user request to only use the "Open Chat" button)
  if (!isOpen || !activeIncident) return null;

  return (
    <>
      {/* Floating Chat Window */}
      <div
        className="fixed bottom-6 left-6 z-50 w-[380px] flex flex-col transition-all duration-300 ease-in-out opacity-100 translate-y-0"
        style={{ maxHeight: 'calc(100vh - 100px)' }}
      >
        <div className="card-terminal !p-0 shadow-2xl shadow-black flex flex-col overflow-hidden border-accent-secondary/30"
          style={{ height: '550px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-accent-secondary/20 to-accent-secondary/5 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-accent-secondary/20 flex items-center justify-center border border-accent-secondary/30">
                  <MessageSquare className="w-5 h-5 text-accent-secondary" />
                </div>
                {isResponderAssigned && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-void animate-pulse" />
                )}
              </div>
              <div>
                <p className="text-sm font-heading font-bold text-white uppercase tracking-tight">Active Protocol Chat</p>
                <p className="font-mono text-[9px] text-stardust/50 uppercase tracking-widest">
                  INCIDENT_{activeIncident.id.slice(-6)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setActiveChatIncidentId(null);
              }}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-stardust hover:text-white border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages or Unavailable State */}
          {!isResponderAssigned ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-accent-secondary/10 rounded-full flex items-center justify-center animate-pulse">
                <ShieldAlert className="w-10 h-10 text-accent-secondary" />
              </div>
              <div>
                <p className="text-xl font-heading font-bold text-white uppercase tracking-tight">Awaiting Responder</p>
                <p className="text-xs text-stardust/60 mt-4 leading-relaxed max-w-[240px] mx-auto font-mono">
                  SECURE CHANNEL STANDBY. MESSAGING WILL ACTIVATE UPON UNIT ASSIGNMENT.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
              {incidentMessages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <span className="font-mono text-[8px] text-stardust/30 uppercase mb-1.5 tracking-widest px-1">
                      {isOwn ? 'YOU_AUTHORIZED' : msg.sender_name.toUpperCase()}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isOwn
                        ? 'bg-accent-secondary text-white rounded-br-sm shadow-xl shadow-accent-secondary/5'
                        : 'bg-void border border-white/10 text-stardust rounded-bl-sm shadow-inner'
                        }`}
                    >
                      <p className="font-body">{msg.content}</p>
                      <p className={`font-mono text-[9px] mt-2.5 uppercase tracking-widest ${isOwn ? 'text-white/40' : 'text-accent-secondary/40'}`}>
                        {format(new Date(msg.timestamp), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="px-5 py-5 border-t border-white/5 bg-surface/30 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-3 bg-void border border-white/5 rounded-2xl px-4 py-3 focus-within:border-accent-secondary/50 transition-all duration-500 shadow-inner">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isResponderAssigned ? "Transmit signal..." : "Channel Encrypted..."}
                disabled={isSending || !isResponderAssigned}
                className="flex-1 bg-transparent text-sm text-white placeholder-stardust/20 font-body focus:outline-none disabled:opacity-30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending || !isResponderAssigned}
                className="p-2 rounded-xl bg-accent-secondary text-white shadow-lg shadow-accent-secondary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
