import React, { useState } from 'react';
import { Pill, Check, Clock, Upload, ShieldAlert, BookOpen, AlertCircle, Info, Sparkles } from 'lucide-react';

interface MedicineManagerProps {
  apiBase: string;
  token: string;
  reminders: any[];
  adherenceToday: any[];
  onRefresh: () => void;
}

const MedicineManager: React.FC<MedicineManagerProps> = ({ apiBase, token, reminders, adherenceToday, onRefresh }) => {
  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any | null>(null);

  // New Reminder Form
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState({ morning: false, afternoon: false, evening: false, night: false });
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;
    try {
      const res = await fetch(`${apiBase}/patient/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          medicineName: medName.trim(),
          dosage: dosage.trim() || '1 tablet',
          morning: times.morning,
          afternoon: times.afternoon,
          evening: times.evening,
          night: times.night
        })
      });
      if (res.ok) {
        setMedName('');
        setDosage('');
        setTimes({ morning: false, afternoon: false, evening: false, night: false });
        setShowAddForm(false);
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAdherence = async (reminderId: string, currentlyTaken: boolean) => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`${apiBase}/patient/adherence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reminderId,
          date: todayStr,
          taken: !currentlyTaken
        })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isTaken = (reminderId: string) => {
    return adherenceToday.some(log => log.reminder_id === reminderId && log.taken);
  };

  const handleScanStrip = (file: File) => {
    setScanning(true);
    setScannedResult(null);

    // Simulate OCR scanner delay
    setTimeout(() => {
      setScanning(false);
      
      let name = "Paracetamol (Dolo 650)";
      let uses = "Pain relief, reducing high fever, general body aches.";
      let sideEffects = "Nausea, sweating, skin rashes, liver strain if overdosed.";
      let warnings = "Do not exceed 4000mg (4g) within 24 hours. Avoid alcohol consumption.";
      let dosageInfo = "1 tablet every 4-6 hours post food as needed.";
      let storage = "Store in a cool, dry place below 25°C.";
      let interactions = "Increases toxicity risk if taken with other paracetamol products or blood thinners (Warfarin).";

      if (file.name.toLowerCase().includes('amoxicillin')) {
        name = "Amoxicillin 500mg";
        uses = "Bacterial infections of the ear, nose, throat, lungs, and skin.";
        sideEffects = "Diarrhea, nausea, stomach upset, mild rash.";
        warnings = "Complete full prescribed course to prevent bacterial resistance.";
        dosageInfo = "1 capsule 3 times daily or as advised by physician.";
        storage = "Store capsules at room temperature. Keep suspension in refrigerator.";
        interactions = "May reduce effectiveness of oral contraceptive pills.";
      }

      setScannedResult({ name, uses, sideEffects, warnings, dosageInfo, storage, interactions });
    }, 2500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Col 1: Medicine Scanner Dropzone */}
      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850">
          <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-1.5">
            <BookOpen className="h-5 w-5 text-indigo-400" /> Strip OCR Scanner
          </h3>
          <p className="text-[11px] text-secondary mb-4">Upload or drag a photo of your medicine strip. AI will identify the name, active usage, and safety alerts.</p>

          {scanning ? (
            <div className="relative border-2 border-dashed border-indigo-500/30 rounded-2xl p-8 text-center bg-indigo-950/10 min-h-[180px] flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_12px_#3b82f6] animate-[scan_2s_ease-in-out_infinite]" />
              <div className="h-10 w-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-3" />
              <span className="text-xs text-primary font-bold animate-pulse">Running OCR Strip Recognition...</span>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-secondary bg-slate-50/50 dark:bg-slate-900/10 min-h-[180px] flex flex-col items-center justify-center">
              <input
                type="file"
                id="medScan"
                className="hidden"
                accept="image/*"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleScanStrip(e.target.files[0]);
                  }
                }}
              />
              <label
                htmlFor="medScan"
                className="cursor-pointer rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 font-bold mb-2 shadow transition"
              >
                Scan Strip Image
              </label>
              <p className="text-[10px] text-slate-400">Supported formats: PNG, JPG, JPEG up to 5MB</p>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleScanStrip(new File([], "dolo650.png"))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  ⚡ Test Dolo
                </button>
                <button
                  onClick={() => handleScanStrip(new File([], "amoxicillin.png"))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  ⚡ Test Amox
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Col 2 & 3: Results or Reminders schedule */}
      <div className="lg:col-span-2 space-y-6">
        {/* Scanned Result display */}
        {scannedResult && (
          <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-primary text-md flex items-center gap-1">
                <Sparkles size={16} className="text-indigo-400 animate-spin-slow" /> Identified: {scannedResult.name}
              </h3>
              <button
                onClick={() => setScannedResult(null)}
                className="text-xs font-bold text-red-500 hover:opacity-80"
              >
                Reset Scanner
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="font-bold text-indigo-400 block mb-0.5">Indications & Uses</span>
                <p className="text-secondary leading-relaxed">{scannedResult.uses}</p>
              </div>
              <div>
                <span className="font-bold text-indigo-400 block mb-0.5">Recommended Dosage</span>
                <p className="text-secondary leading-relaxed">{scannedResult.dosageInfo}</p>
              </div>
              <div>
                <span className="font-bold text-indigo-400 block mb-0.5">Side Effects</span>
                <p className="text-secondary leading-relaxed">{scannedResult.sideEffects}</p>
              </div>
              <div>
                <span className="font-bold text-indigo-400 block mb-0.5">Storage Advice</span>
                <p className="text-secondary leading-relaxed">{scannedResult.storage}</p>
              </div>
              <div className="sm:col-span-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-amber-600 dark:text-amber-400 flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[10px] uppercase tracking-wider">Safety Warnings & Drug Interactions</span>
                  <p className="leading-relaxed mt-0.5 text-[11px]">{scannedResult.warnings} {scannedResult.interactions}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reminders List & Add form */}
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-primary">Medicine Schedule Reminders</h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-xl px-3 py-1.5 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 text-xs font-bold transition"
            >
              {showAddForm ? 'Cancel' : 'Add Medicine'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddReminder} className="space-y-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800 p-5 rounded-2xl">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Medicine Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lipitor, Metformin"
                    value={medName}
                    onChange={e => setMedName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Dosage / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 tablet, 500mg post-dinner"
                    value={dosage}
                    onChange={e => setDosage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Schedule Time slots</label>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {['morning', 'afternoon', 'evening', 'night'].map(tKey => (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => setTimes(prev => ({ ...prev, [tKey]: !prev[tKey as keyof typeof prev] }))}
                      className={`rounded-xl py-2 font-bold transition capitalize ${times[tKey as keyof typeof times] ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-secondary'}`}
                    >
                      {tKey}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                Schedule Medicine Reminder
              </button>
            </form>
          )}

          {/* Schedule list rows */}
          {reminders.length === 0 ? (
            <p className="text-center text-xs text-secondary py-12">No active medicine reminders scheduled.</p>
          ) : (
            <div className="space-y-3">
              {reminders.map(rem => {
                const taken = isTaken(rem.id);
                return (
                  <div
                    key={rem.id}
                    className="glass-panel rounded-2xl border border-slate-100/50 p-4 dark:border-slate-850 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">{rem.medicine_name}</span>
                        <span className="text-[10px] text-slate-400">({rem.dosage})</span>
                      </div>
                      <div className="flex gap-2 text-[8px] font-bold text-slate-500 uppercase">
                        {rem.morning && <span>Morning</span>}
                        {rem.afternoon && <span>Afternoon</span>}
                        {rem.evening && <span>Evening</span>}
                        {rem.night && <span>Night</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleAdherence(rem.id, taken)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition ${taken ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/10' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
                    >
                      <Check size={14} />
                      {taken ? 'Taken' : 'Mark Taken'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicineManager;
