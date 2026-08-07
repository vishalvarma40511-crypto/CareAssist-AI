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
      // Mock generated values matching parameters
      let breakfast = "Oatmeal with chia seeds, banana slices, and almond milk.";
      let lunch = "Quinoa salad with mixed greens, cherry tomatoes, cucumbers, and boiled chickpeas.";
      let dinner = "Brown rice with steamed broccoli, grilled tofu, and low-sodium soy sauce.";
      let snacks = "Mixed unsalted nuts (walnuts & almonds) and a green apple.";
      let calories = 1600;
      let protein = 70;
      let carbs = 220;
      let fat = 50;
      let water = 3.0;

      if (goal === 'muscle_gain') {
        breakfast = "Scrambled tofu or eggs with whole wheat toast, avocado, and spinach.";
        lunch = "High protein lentil curry or chicken with brown rice, broccoli, and yogurt.";
        dinner = "Paneer or grilled fish with sweet potato mash and green beans.";
        snacks = "Protein shake with peanut butter and hemp seeds.";
        calories = 2500;
        protein = 130;
        carbs = 310;
        fat = 75;
        water = 3.5;
      } else if (goal === 'diabetes') {
        breakfast = "Chia seed pudding made with unsweetened almond milk and fresh blueberries.";
        lunch = "Spinach and kale salad with avocado, pumpkin seeds, and grilled tofu.";
        dinner = "Steamed cauliflower mash with baked salmon or paneer and asparagus.";
        snacks = "Cucumber slices with hummus.";
        calories = 1400;
        protein = 85;
        carbs = 110;
        fat = 65;
        water = 3.0;
      }

      if (dietType === 'non_vegetarian') {
        if (goal === 'muscle_gain') {
          lunch = "Grilled chicken breast with wild brown rice, sautéed spinach, and green peas.";
          dinner = "Baked salmon fillet with sweet potato chunks and grilled zucchini.";
        } else {
          lunch = "Light tuna salad sandwich on multi-grain bread with lettuce and tomatoes.";
          dinner = "Baked turkey breast with roasted bell peppers and quinoa.";
        }
      } else if (dietType === 'vegan') {
        breakfast = "Tofu scramble with spinach, tomatoes, and whole grain sourdough.";
        lunch = "Black bean and avocado salad with lime dressing and brown rice.";
        dinner = "Lentil shepherd's pie with sweet potato mash topping.";
      }

      const res = await fetch(`${apiBase}/patient/diet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          breakfast,
          lunch,
          dinner,
          snacks,
          calories,
          protein,
          carbs,
          fat,
          waterIntake: water,
          goals: `${dietType.toUpperCase()} - ${goal.toUpperCase()}`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActivePlan(data);
      }
    } catch (err) {
      console.error(err);
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
