import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { Bot, X, Send, Loader2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'ai',
  text: "Initializing **Crisis_AI_System**...\nConnected to Secure Core.\n\nI can assist with:\n- High-priority emergency protocols\n- Localized data verification\n- Real-time evacuation routing\n\n🚨 **India Emergency Contacts:**\nPolice: **100 / 112** | Ambulance: **108** | Fire: **101** | Disaster: **1078** | NDRF: **011-24363260**\n\nPlease enter situational details.",
  timestamp: new Date(),
};

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export const AiChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const chatWithAI = useStore((state) => state.chatWithAI);
  const incidents = useStore((state) => state.incidents);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build context string from active incidents for the AI
  const buildContext = () => {
    const active = incidents.filter(i => i.status !== 'resolved');
    if (active.length === 0) return undefined;
    return active
      .slice(0, 3)
      .map(i => `${i.emergency_type ?? 'Incident'} at ${i.location} (${i.severity} severity, ${i.status})`)
      .join('; ');
  };

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    const prevMessages = messages;

    const newMessages = [...prevMessages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    const context = buildContext();

    // Map existing messages to API format
    // Ignore the welcome message if you want, or map it. We'll map it so Gemini has context.
    const apiMessages = newMessages.map(m => ({
      role: m.role === 'ai' ? 'model' : 'user',
      text: m.text
    }));

    const reply = await chatWithAI(apiMessages, context);

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text: reply,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);

    if (!isOpen) setHasUnread(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Window */}
      <div
        className={`fixed bottom-24 right-4 z-50 w-[350px] flex flex-col transition-all duration-300 ease-in-out ${isOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        style={{ maxHeight: 'calc(100vh - 140px)' }}
      >
        <div className="card-glass !p-0 shadow-black/50 flex flex-col overflow-hidden backdrop-blur-2xl bg-base/40 border-accent-primary/20"
          style={{ height: '480px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-primary/30 to-accent-primary/10 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-primary/80 flex items-center justify-center shadow-lg shadow-accent-primary/20">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-primary rounded-full border-2 border-void animate-ping" />
              </div>
              <div>
                <p className="text-sm font-heading font-bold text-white uppercase tracking-tight">CRISIS AI</p>
                <p className="font-mono text-[9px] text-accent-primary/70 uppercase tracking-widest">Powered By Gemini</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center mr-3 mt-1 shrink-0">
                    <Bot className="w-3.5 h-3.5 text-accent-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-accent-primary text-white rounded-br-sm shadow-lg shadow-accent-primary/10'
                    : 'bg-void/40 backdrop-blur-md border border-white/5 text-stardust rounded-bl-sm'
                    }`}
                >
                  <span
                    className="font-body"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                  />
                  <p className={`font-mono text-[9px] mt-2 uppercase tracking-widest ${msg.role === 'user' ? 'text-white/60' : 'text-accent-primary/40'}`}>
                    {format(msg.timestamp, 'HH:mm:ss')}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center mr-3 mt-1 shrink-0">
                  <Bot className="w-3.5 h-3.5 text-accent-primary" />
                </div>
                <div className="bg-void border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-4 border-t border-white/5 bg-white/5 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-3 bg-void border border-white/5 rounded-xl px-4 py-2.5 focus-within:border-accent-primary transition-all duration-300">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter emergency message..."
                disabled={isTyping}
                className="flex-1 bg-transparent text-sm text-white placeholder-stardust/30 font-body focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                className="p-1.5 rounded-lg bg-gradient-to-br from-accent-primary to-accent-primary/80 text-white shadow-lg shadow-accent-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {isTyping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-center font-mono text-[9px] text-stardust/40 mt-3 uppercase tracking-widest">
              Emergency Protocol
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-4 right-4 z-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${isOpen
          ? 'bg-surface border border-white/10'
          : 'bg-gradient-to-br from-accent-primary to-accent-primary/80 shadow-accent-primary/40'
          }`}
        title="Crisis Intelligence"
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <div className="relative">
            <Bot className="w-7 h-7 text-white" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-primary rounded-full border-2 border-void animate-bounce shadow-lg shadow-accent-primary/50" />
            )}
          </div>
        )}
      </button>
    </>
  );
};
