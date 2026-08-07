import React, { useState, useEffect } from 'react';
import { Smile, Brain, Compass, Clock, Heart, Award, Sparkles, RefreshCw } from 'lucide-react';

const affirmations = [
  "My body is strong, and my mind is peaceful.",
  "Every breath I take fills me with calmness and health.",
  "I am doing my best, and that is enough.",
  "I choose to be kind to myself today.",
  "My health is a priority, and I cherish it.",
  "I trust my body's natural healing abilities.",
  "I release all stress and invite tranquility.",
  "Quiet minds bring strong health."
];

const MentalWellness: React.FC = () => {
  // Affirmation state
  const [affirmation, setAffirmation] = useState(affirmations[0]);
  
  // Breathing states
  const [breathPhase, setBreathPhase] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [breathTimer, setBreathTimer] = useState(0);

  // Meditation states
  const [medMins, setMedMins] = useState(5);
  const [medSeconds, setMedSeconds] = useState(0);
  const [medActive, setMedActive] = useState(false);

  // Mood history logs
  const [moodLogs, setMoodLogs] = useState<{ date: string; mood: number }[]>([
    { date: 'Mon', mood: 4 },
    { date: 'Tue', mood: 3 },
    { date: 'Wed', mood: 5 },
    { date: 'Thu', mood: 4 },
    { date: 'Fri', mood: 5 }
  ]);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  // Breathing timer handler
  useEffect(() => {
    let interval: any;
    if (breathPhase !== 'idle') {
      interval = setInterval(() => {
        setBreathTimer(prev => {
          if (breathPhase === 'inhale' && prev >= 4) {
            setBreathPhase('hold');
            return 0;
          }
          if (breathPhase === 'hold' && prev >= 7) {
            setBreathPhase('exhale');
            return 0;
          }
          if (breathPhase === 'exhale' && prev >= 8) {
            setBreathPhase('inhale');
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [breathPhase]);

  // Meditation timer handler
  useEffect(() => {
    let interval: any;
    if (medActive) {
      interval = setInterval(() => {
        if (medSeconds > 0) {
          setMedSeconds(prev => prev - 1);
        } else if (medMins > 0) {
          setMedMins(prev => prev - 1);
          setMedSeconds(59);
        } else {
          setMedActive(false);
          alert("Meditation session complete! Excellent job taking time for your mind.");
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [medActive, medMins, medSeconds]);

  const handleStartBreathing = () => {
    setBreathPhase('inhale');
    setBreathTimer(0);
  };

  const handleStopBreathing = () => {
    setBreathPhase('idle');
    setBreathTimer(0);
  };

  const toggleMeditation = () => {
    setMedActive(!medActive);
  };

  const handleLogMood = (score: number) => {
    setSelectedMood(score);
    const day = new Date().toLocaleDateString([], { weekday: 'short' });
    // Append or replace today's log
    setMoodLogs(prev => {
      const filtered = prev.filter(l => l.date !== day);
      return [...filtered, { date: day, mood: score }];
    });
  };

  const rotateAffirmation = () => {
    const idx = Math.floor(Math.random() * affirmations.length);
    setAffirmation(affirmations[idx]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Col 1: Affirmations and Mood logger */}
      <div className="space-y-6">
        {/* Daily Affirmation Card */}
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 relative overflow-hidden">
          <div className="absolute top-2 right-2 text-indigo-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3">Daily Positive Affirmation</h4>
          <p className="text-sm font-semibold italic text-slate-100 leading-relaxed min-h-[50px]">
            "{affirmation}"
          </p>
          <button
            onClick={rotateAffirmation}
            className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition"
          >
            <RefreshCw size={12} className="animate-spin-slow" /> Draw New Card
          </button>
        </div>

        {/* Mood Logger & Chart */}
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850">
          <div className="flex items-center gap-2 mb-4">
            <Smile className="h-5 w-5 text-brand-500" />
            <h3 className="text-sm font-bold text-primary">Daily Mood Tracker</h3>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center mb-6">
            {[
              { score: 1, emoji: '😢', name: 'Awful' },
              { score: 2, emoji: '😔', name: 'Low' },
              { score: 3, emoji: '😐', name: 'Okay' },
              { score: 4, emoji: '😊', name: 'Happy' },
              { score: 5, emoji: '😆', name: 'Great' }
            ].map(m => (
              <button
                key={m.score}
                onClick={() => handleLogMood(m.score)}
                className={`p-2 rounded-xl transition ${selectedMood === m.score ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <span className="text-xl block">{m.emoji}</span>
                <span className="text-[8px] block font-bold text-slate-400 mt-1">{m.name}</span>
              </button>
            ))}
          </div>

          {/* Simple Mood Chart */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weekly Mood Flow</h4>
            <div className="h-24 w-full flex items-end gap-3 pt-4">
              {moodLogs.map((log, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-pink-500 transition-all duration-300"
                    style={{ height: `${log.mood * 20}%` }}
                  />
                  <span className="text-[9px] text-slate-400 font-bold">{log.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Col 2: Breathing Exercise Helper */}
      <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col items-center justify-between min-h-[350px]">
        <div className="w-full text-center">
          <div className="flex justify-center mb-1">
            <Brain className="h-6 w-6 text-brand-500" />
          </div>
          <h3 className="text-sm font-bold text-primary">Soma Breathing Engine</h3>
          <p className="text-[10px] text-secondary mt-1">Calm your nervous system using the 4-7-8 deep breathing framework.</p>
        </div>

        {/* Dynamic breathing circle */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div
            className={`absolute rounded-full bg-indigo-500/10 border border-indigo-500/30 transition-all duration-1000 ${
              breathPhase === 'inhale' ? 'scale-100 w-44 h-44 opacity-100' :
              breathPhase === 'hold' ? 'scale-95 w-40 h-40 opacity-90' :
              breathPhase === 'exhale' ? 'scale-50 w-24 h-24 opacity-60' : 'w-24 h-24 scale-50 opacity-40'
            }`}
          />
          <div className="z-10 text-center space-y-1">
            <span className="text-sm font-extrabold text-primary capitalize">
              {breathPhase === 'idle' ? 'Ready' : breathPhase}
            </span>
            {breathPhase !== 'idle' && (
              <span className="block text-2xl font-black text-indigo-400">{breathTimer}s</span>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="w-full">
          {breathPhase === 'idle' ? (
            <button
              onClick={handleStartBreathing}
              className="w-full rounded-xl py-2 text-xs font-bold text-white transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              Start Breathing Loop
            </button>
          ) : (
            <button
              onClick={handleStopBreathing}
              className="w-full rounded-xl py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all"
            >
              Pause Loop
            </button>
          )}
        </div>
      </div>

      {/* Col 3: Meditation Timer */}
      <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col items-center justify-between min-h-[350px]">
        <div className="w-full text-center">
          <div className="flex justify-center mb-1">
            <Compass className="h-6 w-6 text-brand-500" />
          </div>
          <h3 className="text-sm font-bold text-primary">Mindful Meditation Timer</h3>
          <p className="text-[10px] text-secondary mt-1">Disconnect from external stimuli and focus inward.</p>
        </div>

        {/* Timer display */}
        <div className="text-center space-y-2">
          <Clock className="h-10 w-10 text-indigo-400 mx-auto animate-pulse" />
          <div className="text-4xl font-black text-primary font-mono tracking-widest">
            {String(medMins).padStart(2, '0')}:{String(medSeconds).padStart(2, '0')}
          </div>
          <div className="flex justify-center gap-2">
            {[1, 5, 10, 20].map(m => (
              <button
                key={m}
                disabled={medActive}
                onClick={() => { setMedMins(m); setMedSeconds(0); }}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${medMins === m ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* Action button */}
        <div className="w-full">
          <button
            onClick={toggleMeditation}
            className={`w-full rounded-xl py-2 text-xs font-bold text-white transition-all shadow-md ${medActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            {medActive ? 'Pause Meditation' : 'Start Zen Timer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentalWellness;
