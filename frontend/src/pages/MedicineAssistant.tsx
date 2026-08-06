import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Pill, Search, ShieldAlert, HeartPulse, HelpCircle, Check, Info } from 'lucide-react';

const MedicineAssistant: React.FC = () => {
  const { token, apiBase } = useAuth();
  const { language } = useLanguage();

  const [queryName, setQueryName] = useState('');
  const [medicineInfo, setMedicineInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryName.trim()) return;

    setLoading(true);
    setError(null);
    setMedicineInfo(null);

    try {
      const res = await fetch(`${apiBase}/ai/explain-medicine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ medicineName: queryName, language })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve medicine details');
      }

      setMedicineInfo(data);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      
      {/* Search Header Banner */}
      <div className="glass-panel rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-brand-500/10 blur-xl"></div>
        <div className="max-w-xl space-y-2">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
            <Pill className="h-6 w-6" />
            <h2 className="text-xl font-bold text-primary">Medicine Information Assistant</h2>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Search about any drug or active ingredient. Get simple explanations on functions, general dosing guidelines, side effects, and precautions.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2 max-w-lg">
          <input 
            type="text" 
            required
            value={queryName}
            onChange={e => setQueryName(e.target.value)}
            placeholder="Search e.g. Aspirin, Ibuprofen, Metformin..." 
            className="flex-1 rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="rounded-xl bg-brand-600 px-6 py-3 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-55 flex items-center gap-1.5"
          >
            <Search className="h-4 w-4" /> {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Display Area */}
      {medicineInfo ? (
        <div className="glass-panel rounded-3xl p-6 shadow-md space-y-6 animate-slide-in">
          
          {/* Main Info Header */}
          <div className="border-b border-slate-150 dark:border-slate-850 pb-4 flex justify-between items-start flex-wrap gap-3">
            <div>
              <h3 className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">{medicineInfo.name}</h3>
              <p className="text-xs text-secondary mt-1">{medicineInfo.whatIsIt}</p>
            </div>
            
            <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-[10px] text-yellow-800 max-w-xs dark:bg-yellow-950/20 dark:border-yellow-900 dark:text-yellow-400 leading-relaxed font-semibold">
              ⚠️ General clinical guide only. Always adhere to prescribing physician's directions.
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            
            {/* Left Col: Core Usage, Actions, Food rules */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> What it is used for</h4>
                <p className="text-xs text-primary leading-relaxed mt-1">{medicineInfo.whatUsedFor}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><HeartPulse className="h-4 w-4 text-brand-500" /> How it works</h4>
                <p className="text-xs text-primary leading-relaxed mt-1">{medicineInfo.howItWorks}</p>
              </div>

              <div className="grid gap-4 grid-cols-2 border-t border-slate-100 dark:border-slate-850 pt-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Adult Dosage Context</h4>
                  <p className="text-[11px] text-secondary mt-1">{medicineInfo.adultUse}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Food Intake Timing</h4>
                  <p className="text-[11px] text-secondary mt-1">{medicineInfo.foodTiming}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Missed Dose Guideline</h4>
                <p className="text-xs text-secondary leading-relaxed mt-1">{medicineInfo.missedDoseGuidance}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Overdose Alert</h4>
                <p className="text-xs text-red-500 font-semibold leading-relaxed mt-1">{medicineInfo.overdoseAdvice}</p>
              </div>
            </div>

            {/* Right Col: Warnings & Precautions */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/30 p-5 space-y-4 border border-slate-100 dark:border-slate-850">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">Safety Indicators & Warnings</h4>
              
              <div className="grid gap-4 grid-cols-2 text-xs">
                <div>
                  <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider">Pregnancy Status</span>
                  <p className="text-secondary mt-0.5">{medicineInfo.precautions?.pregnancy || 'Consult Doctor'}</p>
                </div>
                <div>
                  <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider">Breastfeeding</span>
                  <p className="text-secondary mt-0.5">{medicineInfo.precautions?.breastfeeding || 'Consult Doctor'}</p>
                </div>
                <div>
                  <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider">Driving Precautions</span>
                  <p className="text-secondary mt-0.5">{medicineInfo.precautions?.driving || 'Proceed with caution'}</p>
                </div>
                <div>
                  <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider">Alcohol Warnings</span>
                  <p className="text-red-500 font-semibold mt-0.5">{medicineInfo.precautions?.alcohol || 'Avoid alcohol'}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Common Side Effects</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {medicineInfo.commonSideEffects?.map((se: string, i: number) => (
                    <span key={i} className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-350">{se}</span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold block text-[10px] text-red-400 uppercase tracking-wider mb-1">Serious Side Effects (Contact Emergency)</span>
                <ul className="space-y-1 text-[11px] text-secondary">
                  {medicineInfo.seriousSideEffects?.map((se: string, i: number) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
                      <span>{se}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-850 pt-3">
                <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Drug Interactions</span>
                <p className="text-[11px] text-secondary leading-relaxed">{medicineInfo.drugInteractions?.join(', ') || 'Consult doctor before combining medicines.'}</p>
              </div>

              <div>
                <span className="font-bold block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Food Interactions</span>
                <p className="text-[11px] text-secondary leading-relaxed">{medicineInfo.foodInteractions?.join(', ') || 'None reported.'}</p>
              </div>
            </div>

          </div>

          {/* Contact doctor prompt */}
          <div className="border-t border-slate-150 dark:border-slate-850 pt-4 flex items-center gap-2 text-xs text-brand-600 font-semibold">
            <Info className="h-4 w-4" />
            <span>{medicineInfo.whenToContactDoctor}</span>
          </div>

        </div>
      ) : (
        !loading && (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <HelpCircle className="h-10 w-10 text-slate-300" />
            <span>Enter a medicine name above to generate detailed safety instructions.</span>
          </div>
        )
      )}

      {loading && (
        <div className="glass-panel rounded-3xl p-12 text-center text-xs animate-pulse">
          CareAssist Pharmacologist AI is researching drug safety profiles...
        </div>
      )}

    </div>
  );
};

export default MedicineAssistant;
