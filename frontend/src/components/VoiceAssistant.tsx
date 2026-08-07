import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Globe, Sparkles, X } from 'lucide-react';

interface VoiceAssistantProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onTriggerSOS: () => void;
}

const languages = [
  { code: 'en-US', label: 'English', greeting: 'Hello, how can I help you today?', respond: 'Switching module as requested.' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', greeting: 'नमस्ते, आज मैं आपकी क्या सहायता कर सकती हूँ?', respond: 'अनुरोध के अनुसार मॉड्यूल बदला जा रहा है।' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', greeting: 'నమస్కారం, ఈరోజు నేను మీకు ఎలా సహాయపడగలను?', respond: 'మీ అభ్యర్థన మేరకు మాడ్యూల్ మార్చబడింది.' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', greeting: 'வணக்கம், இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?', respond: 'கோரிக்கையின்படி தொகுதி மாற்றப்படுகிறது.' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', greeting: 'ನಮಸ್ಕಾರ, ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?', respond: 'ವಿನಂತಿಯಂತೆ ಮಾಡ್ಯೂಲ್ ಬದಲಾಯಿಸಲಾಗುತ್ತಿದೆ.' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', greeting: 'നമസ്കാരം, ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?', respond: 'നിങ്ങളുടെ അഭ്യർത്ഥനപ്രകാരം മോഡ്യൂൾ മാറ്റുന്നു.' }
];

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ activeTab, setActiveTab, onTriggerSOS }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [langCode, setLangCode] = useState('en-US');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiSpeechResponse, setAiSpeechResponse] = useState('');
  const [recognition, setRecognition] = useState<any | null>(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recObj = new SpeechRecognition();
      recObj.continuous = false;
      recObj.interimResults = false;
      
      recObj.onstart = () => setListening(true);
      recObj.onerror = () => setListening(false);
      recObj.onend = () => setListening(false);
      
      recObj.onresult = (event: any) => {
        const text = event.results[0][0].transcript.toLowerCase();
        setTranscript(text);
        processCommand(text);
      };

      setRecognition(recObj);
    }
  }, [langCode]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      window.speechSynthesis.speak(utterance);
      setAiSpeechResponse(text);
    }
  };

  const currentLang = languages.find(l => l.code === langCode) || languages[0];

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      // Speak warm greeting
      setTimeout(() => speakText(currentLang.greeting), 300);
    } else {
      window.speechSynthesis.cancel();
    }
  };

  const startListening = () => {
    if (recognition) {
      setTranscript('');
      recognition.lang = langCode;
      try {
        recognition.start();
      } catch (e) {
        recognition.stop();
      }
    } else {
      alert("Speech recognition is not supported in this browser window. Please use Chrome or Safari.");
    }
  };

  const processCommand = (cmd: string) => {
    let respondMsg = currentLang.respond;

    if (cmd.includes('sos') || cmd.includes('emergency') || cmd.includes('danger') || cmd.includes('ఆపద') || cmd.includes('खतरा')) {
      onTriggerSOS();
      setActiveTab('emergency');
      respondMsg = "Activating Emergency S O S broadcast right now.";
    } else if (cmd.includes('wellness') || cmd.includes('score') || cmd.includes('health') || cmd.includes('వైద్య') || cmd.includes('स्वास्थ्य')) {
      setActiveTab('wellness');
    } else if (cmd.includes('reminder') || cmd.includes('medicine') || cmd.includes('pill') || cmd.includes('మందులు') || cmd.includes('दवाई')) {
      setActiveTab('reminders');
    } else if (cmd.includes('diet') || cmd.includes('nutrition') || cmd.includes('food') || cmd.includes('ఆహారం') || cmd.includes('भोजन')) {
      setActiveTab('diet');
    } else if (cmd.includes('locker') || cmd.includes('records') || cmd.includes('files') || cmd.includes('ఫైల్స్') || cmd.includes('दस्तावेज़')) {
      setActiveTab('locker');
    } else if (cmd.includes('doctor') || cmd.includes('chat') || cmd.includes('consultation') || cmd.includes('సంప్రదింపులు') || cmd.includes('डॉक्टर')) {
      setActiveTab('booking');
    } else if (cmd.includes('coach') || cmd.includes('advice') || cmd.includes('tips') || cmd.includes('సలహా') || cmd.includes('सलाह')) {
      setActiveTab('coach');
    } else if (cmd.includes('symptom') || cmd.includes('checker') || cmd.includes('fever') || cmd.includes('లక్షణాలు') || cmd.includes('लक्षण')) {
      setActiveTab('chat_ai');
    } else {
      respondMsg = langCode === 'en-US' 
        ? "Command not recognized. Try saying: Switch to diet, start symptom checker, or call emergency SOS."
        : "आदेश समझ में नहीं आया। कृपया पुनः प्रयास करें।";
    }

    speakText(respondMsg);
  };

  return (
    <>
      {/* Floating Microphone Trigger Button */}
      <button
        onClick={handleToggleOpen}
        className="fixed bottom-6 right-6 z-40 rounded-full p-4 text-white shadow-2xl transition hover:scale-105 active:scale-95 animate-pulse"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
      >
        <Mic className="h-6 w-6" />
      </button>

      {/* Voice Assistant Interface Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-850 relative text-center space-y-6">
            <button
              onClick={handleToggleOpen}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
            >
              <X size={18} />
            </button>

            {/* Header Title */}
            <div>
              <h3 className="text-md font-bold text-primary flex items-center justify-center gap-1.5">
                <Sparkles size={16} className="text-indigo-400 animate-spin-slow" /> Voice Assistant
              </h3>
              <p className="text-[10px] text-secondary mt-1">Talk naturally to navigate and trigger modules.</p>
            </div>

            {/* Language Selector */}
            <div className="flex justify-center items-center gap-2 text-xs">
              <Globe size={13} className="text-indigo-400" />
              <select
                value={langCode}
                onChange={e => {
                  setLangCode(e.target.value);
                  setTranscript('');
                  setAiSpeechResponse('');
                }}
                className="rounded-xl border border-slate-200 bg-white/50 px-2.5 py-1.5 focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-semibold"
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Microphone listening visualization */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <button
                onClick={startListening}
                className={`h-24 w-24 rounded-full flex items-center justify-center transition-all ${listening ? 'bg-rose-600 text-white animate-ping' : 'bg-indigo-600 text-white shadow-xl hover:scale-102'}`}
              >
                {listening ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
              <span className="text-xs font-bold text-indigo-400">
                {listening ? 'Listening to speech...' : 'Tap Mic to Speak'}
              </span>
            </div>

            {/* Speech to text & response boxes */}
            <div className="space-y-3 pt-2 text-xs">
              {transcript && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/40 p-3 text-left">
                  <span className="font-bold text-slate-400 block mb-0.5">You said:</span>
                  <p className="text-primary italic">"{transcript}"</p>
                </div>
              )}

              {aiSpeechResponse && (
                <div className="rounded-xl bg-indigo-600/10 border border-indigo-500/20 p-3 text-left flex gap-2">
                  <Volume2 size={16} className="text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold text-indigo-400 block mb-0.5">Assistant:</span>
                    <p className="text-primary font-semibold">{aiSpeechResponse}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;
