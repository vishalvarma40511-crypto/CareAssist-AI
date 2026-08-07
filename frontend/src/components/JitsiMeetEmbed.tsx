import React, { useEffect, useRef } from 'react';
import { PhoneOff } from 'lucide-react';

interface JitsiMeetEmbedProps {
  room: string;
  userName: string;
  voiceOnly: boolean;
  onEnd: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiMeetEmbed: React.FC<JitsiMeetEmbedProps> = ({ room, userName, voiceOnly, onEnd }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const loadJitsiScript = (): Promise<void> => {
      return new Promise((resolve) => {
        if (window.JitsiMeetExternalAPI) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    const initJitsi = async () => {
      await loadJitsiScript();
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;
      if (apiRef.current) { try { apiRef.current.dispose(); } catch (e) {} apiRef.current = null; }

      const options = {
        roomName: room,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        userInfo: { displayName: userName },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: voiceOnly,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          enableWelcomePage: false,
          enableClosePage: false,
          disableInviteFunctions: true,
          toolbarButtons: voiceOnly
            ? ['microphone', 'hangup', 'chat', 'settings', 'participants-pane']
            : ['microphone', 'camera', 'hangup', 'chat', 'desktop', 'settings', 'participants-pane', 'tileview'],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          MOBILE_APP_PROMO: false,
        },
      };

      try {
        apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', options);
        apiRef.current.addEventListeners({
          readyToClose: () => onEnd(),
          videoConferenceLeft: () => onEnd(),
        });
      } catch (err) {
        console.error('Jitsi API initialization failed:', err);
      }
    };

    initJitsi();
    return () => {
      if (apiRef.current) { try { apiRef.current.dispose(); } catch (e) {} apiRef.current = null; }
    };
  }, [room, userName, voiceOnly]);

  const handleEndCall = () => {
    if (apiRef.current) { try { apiRef.current.executeCommand('hangup'); } catch (e) {} }
    onEnd();
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      <button
        onClick={handleEndCall}
        className="absolute top-3 right-3 z-10 flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-xl transition-all shadow-lg"
      >
        <PhoneOff size={14} /> End Call
      </button>
    </div>
  );
};

export default JitsiMeetEmbed;
