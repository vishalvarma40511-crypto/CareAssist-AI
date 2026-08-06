import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Salad, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, HelpCircle, Droplet } from 'lucide-react';

const NutritionPlanner: React.FC = () => {
  const { token, apiBase, user } = useAuth();
  const { language } = useLanguage();

  const [nutritionData, setNutritionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePlan = async () => {
    setLoading(true);
    setError(null);
    setNutritionData(null);

    try {
      const res = await fetch(`${apiBase}/ai/nutrition-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ language })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate personalized diet plan');
      }

      setNutritionData(data);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      
      {/* Banner */}
      <div className="glass-panel rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="max-w-xl space-y-2">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
            <Salad className="h-6 w-6 text-green-500" />
            <h2 className="text-xl font-bold text-primary">Personalized Diet & Nutrition</h2>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Generate custom dietary recommendations mapped with your existing health conditions (e.g. high blood pressure, diabetes, wheat allergy, age/weight indices) parsed from your active Electronic Health records directory.
          </p>
        </div>

        <button 
          onClick={handleGeneratePlan}
          disabled={loading}
          className="rounded-xl bg-brand-600 px-6 py-3 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-55 shrink-0 flex items-center gap-1.5 shadow-md shadow-brand-500/10"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Salad className="h-4 w-4" />}
          <span>{loading ? 'Compiling Diet Plan...' : 'Compile Diet Plan'}</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">
          <span>{error}</span>
        </div>
      )}

      {/* Plan Render */}
      {nutritionData ? (
        <div className="grid gap-6 sm:grid-cols-3 animate-slide-in">
          
          {/* Main Grid left cols (core diet) */}
          <div className="sm:col-span-2 space-y-6">
            
            {/* Foods to Eat vs Avoid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-panel rounded-2xl p-5 shadow-sm border border-green-200">
                <h4 className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-500" /> Foods to Incorporate
                </h4>
                <ul className="space-y-2">
                  {nutritionData.foodsToEat?.map((food: string, i: number) => (
                    <li key={i} className="text-xs text-secondary leading-relaxed flex items-start gap-1.5">
                      <span className="h-1 w-1 bg-green-500 rounded-full shrink-0 mt-2"></span>
                      <span>{food}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-panel rounded-2xl p-5 shadow-sm border border-red-100">
                <h4 className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Foods to Avoid
                </h4>
                <ul className="space-y-2">
                  {nutritionData.foodsToAvoid?.map((food: string, i: number) => (
                    <li key={i} className="text-xs text-secondary leading-relaxed flex items-start gap-1.5">
                      <span className="h-1 w-1 bg-red-500 rounded-full shrink-0 mt-2"></span>
                      <span>{food}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recovery Diets */}
            <div className="glass-panel rounded-2xl p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Clinical Recovery Diet Plan</h4>
              <p className="text-xs text-primary leading-relaxed">{nutritionData.recoveryDietPlan}</p>
            </div>

          </div>

          {/* Right Col: Nutrient breakdown & hydration */}
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 p-6 space-y-5">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">Nutritional Ratios</h4>
            
            {/* Water Target */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
                <Droplet className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Hydration Target</span>
                <span className="text-sm font-extrabold text-primary">{nutritionData.dailyWaterGoal || '2.5 Litres'}</span>
              </div>
            </div>

            {/* Protein Sources */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">Protein Recommendations</span>
              <div className="flex flex-wrap gap-1.5">
                {nutritionData.proteinSources?.map((src: string, i: number) => (
                  <span key={i} className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-350">{src}</span>
                ))}
              </div>
            </div>

            {/* Recommended Fruits & Veg */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Recommended Fruits</span>
              <p className="text-xs text-secondary leading-relaxed">{nutritionData.recommendedFruits?.join(', ') || 'Fresh local fruits'}</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Recommended Vegetables</span>
              <p className="text-xs text-secondary leading-relaxed">{nutritionData.recommendedVegetables?.join(', ') || 'Fresh greens and roots'}</p>
            </div>

            {/* Vital Vitamins */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Essential Vitamins</span>
              <p className="text-xs text-secondary leading-relaxed">{nutritionData.essentialVitamins?.join(', ') || 'Standard Daily Multi-vitamins'}</p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-4 text-[10px] text-slate-400 leading-relaxed flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
              <span>Tailored based on active records directory.</span>
            </div>

          </div>

        </div>
      ) : (
        !loading && (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <HelpCircle className="h-10 w-10 text-slate-300" />
            <span>Click the button above to calculate a nutrition plan optimized with your health history.</span>
          </div>
        )
      )}

      {loading && (
        <div className="glass-panel rounded-3xl p-12 text-center text-xs animate-pulse">
          CareAssist Dietitian AI is compiling health-adapted nutrition metrics...
        </div>
      )}

    </div>
  );
};

export default NutritionPlanner;
