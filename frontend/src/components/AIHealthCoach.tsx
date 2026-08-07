import React, { useState } from 'react';
import { Sparkles, CheckSquare, Plus, Droplets, Flame, Footprints, Moon, Award } from 'lucide-react';

const AIHealthCoach: React.FC = () => {
  const [glassCount, setGlassCount] = useState(3);
  const [steps, setSteps] = useState(3400);
  const [sleepScore, setSleepScore] = useState(82);

  const [coachTasks, setCoachTasks] = useState([
    { id: 1, text: "Hydrate: Drink at least 8 glasses of water today", completed: false, value: 'water' },
    { id: 2, text: "Activity: Complete 6,000 steps walking goal", completed: false, value: 'steps' },
    { id: 3, text: "Mindfulness: Conduct a 5-minute breathing session", completed: true, value: 'breathe' },
    { id: 4, text: "Dietary: Increase dietary protein to 60g+", completed: false, value: 'protein' },
    { id: 5, text: "Prescription: Take medication reminders on schedule", completed: true, value: 'meds' }
  ]);

  const handleToggleTask = (id: number, value: string) => {
    setCoachTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextState = !t.completed;
        if (value === 'water' && nextState) setGlassCount(8);
        if (value === 'steps' && nextState) setSteps(6200);
        return { ...t, completed: nextState };
      }
      return t;
    }));
  };

  const handleDrinkGlass = () => {
    if (glassCount < 12) {
      setGlassCount(prev => prev + 1);
      if (glassCount + 1 >= 8) {
        // Mark task 1 as completed
        setCoachTasks(prev => prev.map(t => t.value === 'water' ? { ...t, completed: true } : t));
      }
    }
  };

  const completedCount = coachTasks.filter(t => t.completed).length;
  const taskPercentage = Math.round((completedCount / coachTasks.length) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Col 1: Coach Task Checklist */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h3 className="text-lg font-bold text-primary">Your AI Coach Daily Objectives</h3>
          </div>

          <div className="space-y-3">
            {coachTasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id, task.value)}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800 cursor-pointer hover:border-indigo-500/20 transition duration-200"
              >
                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-350 text-transparent'}`}>
                  <CheckSquare size={14} />
                </div>
                <span className={`text-xs font-semibold leading-relaxed ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-primary'}`}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-400">Coach Completion Progress</span>
              <span className="text-primary">{taskPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-905 h-2.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#6366f1]" style={{ width: `${taskPercentage}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Col 2 & 3: Coach widgets metrics */}
      <div className="space-y-6">
        {/* Hydration Tracker */}
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col justify-between min-h-[180px]">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-primary flex items-center gap-1">
              <Droplets className="text-blue-500 h-4.5 w-4.5" /> Hydration Level
            </h4>
            <span className="text-[10px] text-slate-400 font-bold">{glassCount} / 8 Glasses</span>
          </div>

          <div className="flex items-center gap-4 py-2">
            {/* Visual glasses row */}
            <div className="flex-1 flex gap-1.5 justify-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-10 rounded-b-md border transition-all duration-300 ${i < glassCount ? 'bg-blue-500 border-blue-400 shadow-[0_0_6px_#3b82f6]' : 'bg-transparent border-slate-300 dark:border-slate-700'}`}
                />
              ))}
            </div>

            <button
              onClick={handleDrinkGlass}
              className="rounded-full bg-blue-600 text-white p-3 hover:bg-blue-500 transition shadow-lg shadow-blue-900/30"
              title="Log Water glass"
            >
              <Plus size={16} />
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-normal">Each logged glass equates to 250ml. Hydrating daily optimizes blood pressure and physical endurance indices.</p>
        </div>

        {/* Physical steps target */}
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col justify-between min-h-[180px]">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-primary flex items-center gap-1">
              <Footprints className="text-emerald-500 h-4.5 w-4.5" /> Walking Distance
            </h4>
            <span className="text-[10px] text-slate-400 font-bold">{steps} / 6000 Steps</span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-slate-100 dark:bg-slate-905 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-[0_0_6px_#10b981]"
                style={{ width: `${Math.min((steps / 6000) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
              <span>{Math.round((steps * 0.0008) * 10) / 10} km distance</span>
              <span>{Math.round(steps * 0.04)} kcal burnt</span>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => setSteps(prev => prev + 500)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-950 transition"
            >
              +500 steps (Simulate walk)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIHealthCoach;
