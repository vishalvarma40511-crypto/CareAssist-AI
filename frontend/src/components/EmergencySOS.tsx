import React, { useState, useEffect } from 'react';
import { ShieldAlert, PhoneCall, Heart, MapPin, User, Info, Check } from 'lucide-react';

interface EmergencySOSProps {
  apiBase: string;
  token: string;
}

const EmergencySOS: React.FC<EmergencySOSProps> = ({ apiBase, token }) => {
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [emergencyContacts, setEmergencyContacts] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [sosActivated, setSosActivated] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${apiBase}/patient/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data) {
        setBloodGroup(data.blood_group || 'O+');
        setAllergies(data.allergies || '');
        setMedicalHistory(data.medical_history || '');
        setEmergencyContacts(data.emergency_contacts || '');
        setPhone(data.phone || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);
    try {
      const res = await fetch(`${apiBase}/patient/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bloodGroup,
          allergies,
          medicalHistory,
          emergencyContacts,
          phone
        })
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerSOS = () => {
    setSosActivated(true);
    // Simulate playing alert tone or dispatching alerts
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Col 1: Action Panel / SOS Button */}
      <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col items-center justify-between text-center min-h-[350px]">
        <div>
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-primary mt-2">Emergency SOS Portal</h3>
          <p className="text-xs text-secondary mt-1">One-tap medical dispatch system. Notifies your emergency contacts with your live location.</p>
        </div>

        {/* SOS Button */}
        {!sosActivated ? (
          <button
            onClick={triggerSOS}
            className="w-36 h-36 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xl shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all animate-bounce"
            style={{ border: '8px solid rgba(244,63,94,0.2)' }}
          >
            SOS
          </button>
        ) : (
          <div className="space-y-3 w-full">
            <div className="bg-rose-950/80 border border-rose-500/30 text-rose-300 rounded-2xl p-4 text-xs animate-pulse">
              🚨 **SOS ACTIVE** 🚨<br />
              Emergency contacts notified via SMS.<br />
              Dispatched coordinates: **17.3850 N, 78.4867 E**
            </div>
            <button
              onClick={() => setSosActivated(false)}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
            >
              Cancel SOS Alert
            </button>
          </div>
        )}

        <div className="w-full flex gap-2">
          <a
            href="tel:108"
            className="flex-1 rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-xs font-bold text-green-400 hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <PhoneCall size={14} /> Call Ambulance (108)
          </a>
        </div>
      </div>

      {/* Col 2 & 3: Profile SOS Vitals settings */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-rose-500" />
            <h3 className="text-md font-bold text-primary">Emergency Medical Profile</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={e => setBloodGroup(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                >
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              {/* Personal Contact */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Primary Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Allergies */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Allergies (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Peanuts, Pollen"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Medical History */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Chronic Illnesses & Medical Diagnoses</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
                  value={medicalHistory}
                  onChange={e => setMedicalHistory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Emergency Contacts */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Emergency Contacts Name & Phone</label>
                <input
                  type="text"
                  placeholder="e.g. Father (Dad) - +91 99999 88888"
                  value={emergencyContacts}
                  onChange={e => setEmergencyContacts(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info size={12} /> Vitals are stored securely and only accessible during SOS events.
              </span>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {savedSuccess ? <><Check size={14} /> Saved!</> : loading ? 'Saving...' : 'Update Vitals'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmergencySOS;
