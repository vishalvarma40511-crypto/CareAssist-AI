import React, { useState, useEffect } from 'react';
import { Award, ShieldAlert, Sparkles, Activity, Clock, Check, BarChart2 } from 'lucide-react';

interface DailyWellnessProps {
  apiBase: string;
  token: string;
}

const DailyWellness: React.FC<DailyWellnessProps> = ({ apiBase, token }) => {
  const [sleepHours, setSleepHours] = useState(8);
  const [mood, setMood] = useState('good');
  const [stressLevel, setStressLevel] = useState('low');
  const [waterIntake, setWaterIntake] = useState(2);
  const [exerciseMins, setExerciseMins] = useState(30);
  const [weight, setWeight] = useState(70);
  const [energyLevel, setEnergyLevel] = useState(4);
  const [painLevel, setPainLevel] = useState(1);
  const [temperature, setTemperature] = useState(36.6);
  const [bpSystolic, setBpSystolic] = useState(120);
  const [bpDiastolic, setBpDiastolic] = useState(80);
  const [sugarLevel, setSugarLevel] = useState(90);

  const [wellnessLogs, setWellnessLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [todaysScore, setTodaysScore] = useState<number | null>(null);

  useEffect(() => {
    fetchWellnessHistory();
  }, []);

  const fetchWellnessHistory = async () => {
    try {
      const res = await fetch(`${apiBase}/patient/wellness`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setWellnessLogs(data);
        // Check if today is already logged
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysLog = data.find((l: any) => l.date === todayStr);
        if (todaysLog) {
          setTodaysScore(todaysLog.health_score);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`${apiBase}/patient/wellness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: todayStr,
          sleepHours,
          mood,
          stressLevel,
          waterIntake,
          exerciseMins,
          weight,
          energyLevel,
          painLevel,
          temperature,
          bloodPressure: `${bpSystolic}/${bpDiastolic}`,
          sugarLevel
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTodaysScore(data.score);
        fetchWellnessHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get Score Grade label
  const getScoreGrade = (score: number) => {
    if (score >= 85) return { label: 'Excellent', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 70) return { label: 'Good', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
    if (score >= 50) return { label: 'Average', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Poor', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Columns: Submission Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-brand-500" />
            <h3 className="text-lg font-bold text-primary">Daily Vitality Questionnaire</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Mood Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Current Mood</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 'excellent', label: '😆' },
                    { val: 'good', label: '😊' },
                    { val: 'tired', label: '😴' },
                    { val: 'sad', label: '😔' }
                  ].map(m => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setMood(m.val)}
                      className={`text-xl p-2 rounded-xl transition ${mood === m.val ? 'bg-indigo-600/20 border-indigo-500 border-2' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stress level */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Stress Level</label>
                <select
                  value={stressLevel}
                  onChange={e => setStressLevel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                >
                  <option value="low">Low Stress</option>
                  <option value="medium">Medium Stress</option>
                  <option value="high">High Stress</option>
                </select>
              </div>

              {/* Sleep Hours */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Sleep Hours: {sleepHours}h</label>
                <input
                  type="range"
                  min="2"
                  max="14"
                  value={sleepHours}
                  onChange={e => setSleepHours(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Water Intake */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Water Intake (Liters): {waterIntake}L</label>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={waterIntake}
                  onChange={e => setWaterIntake(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Exercise Mins */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Exercise Duration (Minutes)</label>
                <input
                  type="number"
                  value={exerciseMins}
                  onChange={e => setExerciseMins(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Body Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Sugar Level */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Sugar Level (mg/dL)</label>
                <input
                  type="number"
                  value={sugarLevel}
                  onChange={e => setSugarLevel(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* BP Systolic */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">BP Systolic (mmHg)</label>
                <input
                  type="number"
                  value={bpSystolic}
                  onChange={e => setBpSystolic(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* BP Diastolic */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">BP Diastolic (mmHg)</label>
                <input
                  type="number"
                  value={bpDiastolic}
                  onChange={e => setBpDiastolic(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-xs font-bold text-white shadow-lg transition active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {loading ? 'Submitting secure vitals...' : 'Save Wellness Status'}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Score gauge and historical SVG chart */}
      <div className="space-y-6">
        {/* Today Score Card */}
        <div className="glass-panel rounded-3xl p-6 shadow-md text-center flex flex-col items-center justify-center">
          <h4 className="text-sm font-bold text-primary mb-3">Today's Vitality Index</h4>
          {todaysScore !== null ? (
            <div className="space-y-3">
              <div className="relative flex items-center justify-center w-36 h-36">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="72" cy="72" r="60" stroke="rgba(255,255,255,0.05)" strokeWidth="10" fill="transparent" />
                  <circle cx="72" cy="72" r="60" stroke="url(#indigoGrad)" strokeWidth="10" fill="transparent"
                          strokeDasharray={2 * Math.PI * 60}
                          strokeDashoffset={2 * Math.PI * 60 * (1 - todaysScore / 100)} />
                  <defs>
                    <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-extrabold text-primary">{todaysScore}</span>
                  <span className="block text-[10px] text-secondary font-semibold">Score</span>
                </div>
              </div>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${getScoreGrade(todaysScore).color}`}>
                {getScoreGrade(todaysScore).label}
              </span>
            </div>
          ) : (
            <div className="py-6 space-y-2">
              <Sparkles className="h-8 w-8 text-indigo-400 animate-bounce mx-auto" />
              <p className="text-xs text-secondary">No records entered for today. Submit the vitality form to see your calculated Health Score!</p>
            </div>
          )}
        </div>

        {/* Custom SVG Health Trend Chart */}
        <div className="glass-panel rounded-3xl p-6 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-primary">Wellness Trends (Last 7 Logs)</h4>
          </div>
          {wellnessLogs.length >= 2 ? (
            <div className="space-y-4">
              <div className="h-32 w-full flex items-end gap-1.5 pt-4">
                {wellnessLogs.slice(-7).map((log: any, idx) => (
                  <div key={log.id} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[9px] font-mono text-secondary">{log.health_score}</span>
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 bg-gradient-to-t from-indigo-600 to-purple-500"
                      style={{ height: `${log.health_score}%` }}
                    />
                    <span className="text-[8px] text-slate-400 mt-1">{log.date.substring(5)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 text-center">Charts update dynamically as daily logs are entered.</p>
            </div>
          ) : (
            <p className="text-xs text-secondary py-12 text-center">Log wellness data for at least 2 days to populate historical trend analysis.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyWellness;
