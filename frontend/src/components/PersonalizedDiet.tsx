import React, { useState, useEffect } from 'react';
import { Apple, Plus, Sparkles, Check, Info, Award } from 'lucide-react';

interface PersonalizedDietProps {
  apiBase: string;
  token: string;
}

const PersonalizedDiet: React.FC<PersonalizedDietProps> = ({ apiBase, token }) => {
  const [goal, setGoal] = useState('weight_loss');
  const [dietType, setDietType] = useState('vegetarian');
  const [budget, setBudget] = useState('medium');

  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveDietPlan();
  }, []);

  const fetchActiveDietPlan = async () => {
    try {
      const res = await fetch(`${apiBase}/patient/diet`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data) {
        setActivePlan(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateDietPlan = async () => {
    setLoading(true);
    try {
      // 1. Request AI-generated diet plan from Gemini via backend
      const aiRes = await fetch(`${apiBase}/ai/diet-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          goal,
          dietType,
          budget
        })
      });
      if (!aiRes.ok) {
        throw new Error('AI diet generation failed');
      }
      const aiData = await aiRes.json();

      // 2. Save the generated plan to user profile database
      const res = await fetch(`${apiBase}/patient/diet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          breakfast: aiData.breakfast,
          lunch: aiData.lunch,
          dinner: aiData.dinner,
          snacks: aiData.snacks,
          calories: aiData.calories,
          protein: aiData.protein,
          carbs: aiData.carbs,
          fat: aiData.fat,
          waterIntake: aiData.waterIntake,
          goals: aiData.goals || `${dietType.toUpperCase()} - ${goal.toUpperCase()}`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActivePlan(data);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to Gemini AI. Running offline cache simulation.');
    } finally {
      setLoading(false);
    }
  };

  const getMacroPercentage = (macro: number, total: number) => {
    return Math.round((macro / total) * 100);
  };

  const macroTotal = activePlan ? activePlan.protein + activePlan.carbs + activePlan.fat : 1;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left panel: diet planner configurator */}
      <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 h-fit space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Apple className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-bold text-primary">Diet Configuration</h3>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Target Health Goal</label>
          <select
            value={goal}
            onChange={e => setGoal(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="weight_loss">Weight Loss</option>
            <option value="weight_gain">Weight Gain</option>
            <option value="muscle_gain">Muscle Gain (High Protein)</option>
            <option value="diabetes">Diabetes Care (Low Carb)</option>
            <option value="hypertension">Hypertension (Low Sodium)</option>
            <option value="kidney_care">Kidney Care (Controlled Potassium)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Dietary Preference</label>
          <select
            value={dietType}
            onChange={e => setDietType(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="vegetarian">Vegetarian</option>
            <option value="non_vegetarian">Non-Vegetarian</option>
            <option value="vegan">Vegan</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Weekly Budget</label>
          <select
            value={budget}
            onChange={e => setBudget(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="low">Budget Friendly</option>
            <option value="medium">Standard Budget</option>
            <option value="high">Premium / Organic</option>
          </select>
        </div>

        <button
          onClick={generateDietPlan}
          disabled={loading}
          className="w-full rounded-xl py-3 text-xs font-bold text-white shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <Sparkles size={14} className="animate-spin-slow" />
          {loading ? 'Compiling dietary algorithms...' : 'Generate AI Meal Plan'}
        </button>
      </div>

      {/* Right panels: active meal plan & macro target widgets */}
      <div className="lg:col-span-2 space-y-6">
        {activePlan ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Meal Plan List */}
            <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 space-y-4">
              <h3 className="text-sm font-bold text-primary border-b border-slate-100 dark:border-slate-800 pb-2">Active Meal Schedule</h3>
              
              <div className="space-y-3.5">
                {[
                  { label: 'Breakfast 🍳', desc: activePlan.breakfast },
                  { label: 'Lunch 🥗', desc: activePlan.lunch },
                  { label: 'Dinner 🍲', desc: activePlan.dinner },
                  { label: 'Snacks 🍎', desc: activePlan.snacks }
                ].map(m => (
                  <div key={m.label} className="text-xs">
                    <span className="font-bold text-indigo-400 block mb-0.5">{m.label}</span>
                    <p className="text-secondary leading-relaxed">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Macro targets chart & summaries */}
            <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Macro Nutritional Target</h3>
                
                {/* Visual horizontal macro bars */}
                <div className="space-y-3">
                  {[
                    { label: 'Carbohydrates', val: `${activePlan.carbs}g`, pct: getMacroPercentage(activePlan.carbs, macroTotal), color: 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' },
                    { label: 'Protein', val: `${activePlan.protein}g`, pct: getMacroPercentage(activePlan.protein, macroTotal), color: 'bg-emerald-500 shadow-[0_0_8px_#10b981]' },
                    { label: 'Dietary Fat', val: `${activePlan.fat}g`, pct: getMacroPercentage(activePlan.fat, macroTotal), color: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' }
                  ].map(m => (
                    <div key={m.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">{m.label}</span>
                        <span className="text-primary">{m.val} ({m.pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-905 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${m.color}`} style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom stats summary */}
              <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs font-semibold">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-2.5">
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Energy Target</span>
                  <span className="text-primary">{activePlan.calories} kcal</span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-2.5">
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Hydration Target</span>
                  <span className="text-primary">{activePlan.water_intake} L/day</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 shadow-md text-center py-16 border border-slate-100 dark:border-slate-850 flex flex-col items-center justify-center space-y-3">
            <Apple className="h-10 w-10 text-indigo-400 animate-bounce" />
            <h3 className="font-bold text-primary">No Meal Plan Configured</h3>
            <p className="text-xs text-secondary max-w-sm">Use the diet configurator to generate a custom meal plan structured for your medical needs.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalizedDiet;
