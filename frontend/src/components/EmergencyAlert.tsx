import React, { useState } from 'react';
import { AlertTriangle, Phone, MapPin, Video, Share2, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface EmergencyAlertProps {
  onClose: () => void;
}

const EmergencyAlert: React.FC<EmergencyAlertProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCallEmergency = () => {
    setStatusMessage("Dialing Emergency Services (911 / 112)...");
    setTimeout(() => {
      setStatusMessage(null);
      alert("Emergency services call simulated. In a real scenario, this would initiate a telephone call.");
    }, 2000);
  };

  const handleFindHospitals = () => {
    setStatusMessage("Locating nearest clinics and emergency centers...");
    setTimeout(() => {
      setStatusMessage(null);
      window.open("https://www.google.com/maps/search/hospitals+near+me", "_blank");
    }, 1500);
  };

  const handleStartVideo = () => {
    setStatusMessage("Connecting with on-duty Emergency Response Doctor...");
    setTimeout(() => {
      setStatusMessage(null);
      alert("Emergency video link established! (Simulation Mode)");
    }, 2500);
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setStatusMessage("Accessing device coordinates...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStatusMessage(null);
        alert(`Location shared successfully!\nCoordinates: Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}\nSMS sent to your registered emergency contacts.`);
      },
      (error) => {
        setStatusMessage(null);
        alert("Failed to retrieve location details: " + error.message);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6 animate-fade-in text-white">
      {/* Close button in top-right */}
      <button 
        onClick={onClose} 
        className="absolute right-6 top-6 rounded-full bg-red-900/40 p-3 text-red-200 transition hover:bg-red-800"
        title="Dismiss Alert"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="w-full max-w-2xl text-center">
        {/* Animated Warning Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-600/20 text-red-500 animate-pulse">
          <AlertTriangle className="h-16 w-16" />
        </div>

        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-red-500 sm:text-5xl">
          🚨 {t('emergencyTitle')}
        </h1>

        <p className="mx-auto mb-8 max-w-lg text-lg text-red-200/90 sm:text-xl">
          {t('emergencyWarning')}
        </p>

        {statusMessage && (
          <div className="mb-6 rounded-lg bg-red-950/60 p-3 text-xs font-mono text-red-400 border border-red-900 animate-pulse">
            {statusMessage}
          </div>
        )}

        {/* Option Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          
          <button 
            onClick={handleCallEmergency}
            className="flex items-center justify-center gap-3 rounded-2xl bg-red-600 p-5 font-bold transition hover:bg-red-700 active:scale-95"
          >
            <Phone className="h-6 w-6" />
            <span>Call Emergency Services</span>
          </button>

          <button 
            onClick={handleFindHospitals}
            className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 border border-slate-700 p-5 font-bold transition hover:bg-slate-800 active:scale-95"
          >
            <MapPin className="h-6 w-6 text-red-400" />
            <span>Find Nearby Hospitals</span>
          </button>

          <button 
            onClick={handleStartVideo}
            className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 border border-slate-700 p-5 font-bold transition hover:bg-slate-800 active:scale-95"
          >
            <Video className="h-6 w-6 text-red-400" />
            <span>Start Emergency Video Call</span>
          </button>

          <button 
            onClick={handleShareLocation}
            className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 border border-slate-700 p-5 font-bold transition hover:bg-slate-800 active:scale-95"
          >
            <Share2 className="h-6 w-6 text-red-400" />
            <span>Share My Geolocation</span>
          </button>

        </div>

        <button 
          onClick={onClose} 
          className="mt-8 text-sm font-semibold text-slate-400 underline decoration-dotted transition hover:text-white"
        >
          This is a mistake, return to CareAssist
        </button>

      </div>
    </div>
  );
};

export default EmergencyAlert;
