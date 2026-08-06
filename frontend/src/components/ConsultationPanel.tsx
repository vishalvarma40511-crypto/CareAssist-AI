import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Video, MessageSquare, X, Wifi, WifiOff, Phone, PhoneOff, Mic, MicOff, Camera, CameraOff } from 'lucide-react';

interface Message {
  id?: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface ConsultationPanelProps {
  appointment: any;
  user: any;
  token: string;
  apiBase: string;
  onClose: () => void;
}

const SOCKET_URL = (apiBase: string) =>
  apiBase.replace('/api', '').replace(/\/$/, '');

const ConsultationPanel: React.FC<ConsultationPanelProps> = ({
  appointment,
  user,
  token,
  apiBase,
  onClose
}) => {
  const [activeView, setActiveView] = useState<'chat' | 'video'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [videoActive, setVideoActive] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Jitsi room name — unique per appointment
  const jitsiRoom = `CareAssist-${appointment.id.replace(/-/g, '').slice(0, 12)}`;

  useEffect(() => {
    const serverUrl = SOCKET_URL(apiBase);
    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocketError(null);
      socket.emit('join_consultation', { appointmentId: appointment.id });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('joined', () => {
      console.log('Joined consultation room');
    });

    socket.on('message_history', (history: Message[]) => {
      setMessages(history);
    });

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('error', (err: { message: string }) => {
      setSocketError(err.message);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      setSocketError(`Connection failed: ${err.message}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [appointment.id, token, apiBase]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current || !connected) return;
    socketRef.current.emit('send_message', {
      appointmentId: appointment.id,
      content: input.trim()
    });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const otherName = user.role === 'patient'
    ? appointment.doctor_name
    : appointment.patient_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl h-[600px] flex flex-col rounded-3xl shadow-2xl overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
             style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-lg">
              {otherName?.[0] || '?'}
            </div>
            <div>
              <p className="font-semibold text-white">{otherName}</p>
              <p className="text-xs text-indigo-200 flex items-center gap-1">
                {connected
                  ? <><Wifi size={10} className="text-green-400" /> <span className="text-green-400">Live</span></>
                  : <><WifiOff size={10} className="text-red-400" /> <span className="text-red-400">Connecting...</span></>}
                {' · '}{appointment.type?.toUpperCase()} consultation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <button onClick={() => setActiveView('chat')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${activeView === 'chat' ? 'bg-white text-indigo-700' : 'text-white/70 hover:text-white'}`}>
              <MessageSquare size={14} /> Chat
            </button>
            <button onClick={() => { setActiveView('video'); setVideoActive(true); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${activeView === 'video' ? 'bg-white text-indigo-700' : 'text-white/70 hover:text-white'}`}>
              <Video size={14} /> Video
            </button>
            <button onClick={onClose}
              className="ml-2 text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {socketError && (
          <div className="px-4 py-2 bg-red-500/20 border-b border-red-500/30 text-red-300 text-sm flex items-center gap-2">
            <span>⚠️ {socketError}</span>
          </div>
        )}

        {/* Chat View */}
        {activeView === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-5xl mb-3">💬</div>
                  <p className="text-slate-400 text-sm">Consultation started. Send your first message!</p>
                  <p className="text-slate-500 text-xs mt-1">Your conversation is private and secure.</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === user.id;
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMe && (
                        <span className="text-xs text-slate-400 ml-1">{msg.sender_name}</span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-xs text-slate-500 px-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-700/50">
              <div className="flex items-center gap-2 bg-slate-800 rounded-2xl px-4 py-2 border border-slate-700">
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 bg-transparent text-slate-200 text-sm resize-none outline-none placeholder-slate-500 max-h-24"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !connected}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center mt-2">
                🔒 Messages are encrypted and only visible during your consultation slot
              </p>
            </div>
          </>
        )}

        {/* Video Call View — Jitsi Meet */}
        {activeView === 'video' && (
          <div className="flex-1 flex flex-col">
            {!videoActive ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-20 h-20 rounded-full bg-indigo-600/20 flex items-center justify-center">
                  <Video size={36} className="text-indigo-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-white font-semibold text-lg">Start Video Call</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Join a secure video consultation with {otherName}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Powered by Jitsi Meet — no download required</p>
                </div>
                <button
                  onClick={() => setVideoActive(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-900/40">
                  <Phone size={18} /> Join Video Call
                </button>
              </div>
            ) : (
              <div className="flex-1 relative">
                <iframe
                  src={`https://meet.jit.si/${jitsiRoom}#userInfo.displayName="${encodeURIComponent(user.name || 'User')}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
                  allow="camera; microphone; display-capture; autoplay"
                  allowFullScreen
                  className="w-full h-full border-none"
                  title="CareAssist Video Consultation"
                />
                <button
                  onClick={() => setVideoActive(false)}
                  className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-xl transition-all shadow-lg">
                  <PhoneOff size={14} /> End Call
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationPanel;
