import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Clipboard, Calendar, MessageSquare, Plus, Trash2, 
  UserCheck, AlertCircle, FileText, Send, User, ChevronRight, Check
} from 'lucide-react';

const DoctorDashboard: React.FC = () => {
  const { user, token, apiBase } = useAuth();
  const { t } = useLanguage();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'appointments' | 'chat' | 'prescription'>('appointments');
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);

  // Patient History Details
  const [patientHistory, setPatientHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Prescription Writer States
  const [medicines, setMedicines] = useState<any[]>([{ name: '', dosage: '', frequency: '', instruction: '' }]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);

  // Chat States
  const [activePatientChatId, setActivePatientChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (user?.isVerified) {
      fetchAppointments();
    }
  }, [token]);

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${apiBase}/doctor/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAppointments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (apptId: string, newStatus: 'accepted' | 'completed' | 'cancelled') => {
    try {
      const res = await fetch(`${apiBase}/doctor/appointments/${apptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchAppointments();
        if (selectedAppt && selectedAppt.id === apptId) {
          setSelectedAppt(null);
          setPatientHistory(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Patient Medical Folder
  const handleInspectPatient = async (appt: any) => {
    setSelectedAppt(appt);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${apiBase}/doctor/patient-history/${appt.patient_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setHistoryLoading(false);
      if (res.ok) setPatientHistory(data);
    } catch (err) {
      setHistoryLoading(false);
      console.error(err);
    }
  };

  // Prescription Dynamic Rows Management
  const handleAddMedRow = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: '', instruction: '' }]);
  };

  const handleRemoveMedRow = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleMedChange = (idx: number, field: string, val: string) => {
    const updated = [...medicines];
    updated[idx] = { ...updated[idx], [field]: val };
    setMedicines(updated);
  };

  // Submit Prescription
  const handleSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) {
      alert("Please select a patient appointment first.");
      return;
    }

    setPrescriptionLoading(true);
    try {
      const res = await fetch(`${apiBase}/doctor/prescriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: selectedAppt.patient_id,
          medicineData: medicines.filter(m => m.name),
          notes: prescriptionNotes
        })
      });

      setPrescriptionLoading(false);
      if (res.ok) {
        alert("Digital prescription created and dispatched to patient successfully!");
        setMedicines([{ name: '', dosage: '', frequency: '', instruction: '' }]);
        setPrescriptionNotes('');
        handleUpdateStatus(selectedAppt.id, 'completed'); // Automatically complete visit
        setActiveTab('appointments');
      } else {
        const d = await res.json();
        alert("Error creating prescription: " + (d.error || 'Unknown error'));
      }
    } catch (err) {
      setPrescriptionLoading(false);
      console.error(err);
    }
  };

  // Patient Chat Management
  const openChatRoom = async (patientId: string) => {
    setActivePatientChatId(patientId);
    setActiveTab('chat');
    try {
      const res = await fetch(`${apiBase}/doctor/messages/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setChatMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activePatientChatId) return;

    try {
      const res = await fetch(`${apiBase}/doctor/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: activePatientChatId,
          content: chatInput
        })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages([...chatMessages, data]);
        setChatInput('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // If Doctor profile is not approved by Admin
  if (user && !user.isVerified) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="glass-panel rounded-3xl p-8 shadow-md border border-yellow-200">
          <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-primary mb-2">License Verification Required</h2>
          <p className="text-sm text-secondary leading-relaxed mb-4">
            Hello, Dr. {user.name}. Your profile registration is currently in our verification queue. An administrator will verify your credentials (License ID: {user.doctorProfile?.license_number}) before enabling patient consultation access.
          </p>
          <div className="text-xs text-brand-600 font-semibold bg-brand-50 p-2.5 rounded-lg">
            System status: Pending Credentials Validation
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      
      {/* Tab bar header */}
      <div className="mb-8 flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button 
          onClick={() => setActiveTab('appointments')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === 'appointments' ? 'bg-brand-600 text-white' : 'text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Consultation Requests
        </button>
        {selectedAppt && selectedAppt.status === 'accepted' && (
          <button 
            onClick={() => setActiveTab('prescription')}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === 'prescription' ? 'bg-brand-600 text-white' : 'text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Issue Prescription (Dr. {selectedAppt.patient_name})
          </button>
        )}
      </div>

      {/* Tab: Appointments List and Details Panel */}
      {activeTab === 'appointments' && (
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* List Col */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-600" /> Clinic Log
            </h3>
            
            {appointments.length === 0 ? (
              <p className="text-xs text-secondary py-12 text-center">No assigned consultation requests.</p>
            ) : (
              <div className="space-y-3">
                {appointments.map(appt => (
                  <div 
                    key={appt.id} 
                    onClick={() => handleInspectPatient(appt)}
                    className={`rounded-2xl border p-4 cursor-pointer transition ${
                      selectedAppt?.id === appt.id 
                        ? 'border-brand-500 bg-brand-50/20 shadow-md' 
                        : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-primary">{appt.patient_name}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                        appt.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        appt.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                      }`}>{appt.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mb-2">Age: {appt.patient_age || 'N/A'} • {appt.patient_gender}</p>
                    <p className="text-xs text-secondary line-clamp-1">"{appt.reason || 'Symptom consult'}"</p>
                    <span className="block text-[10px] text-slate-400 mt-2 font-mono">{new Date(appt.appointment_date).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details Col */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAppt ? (
              <div className="glass-panel rounded-3xl p-6 shadow-md space-y-6 animate-slide-in">
                
                {/* Header Action controls */}
                <div className="flex flex-wrap justify-between items-center border-b border-slate-150 dark:border-slate-850 pb-4 gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-primary">{selectedAppt.patient_name}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase">Requested channel: {selectedAppt.type}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    {selectedAppt.status === 'pending' && (
                      <button 
                        onClick={() => handleUpdateStatus(selectedAppt.id, 'accepted')}
                        className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Accept Consultation
                      </button>
                    )}
                    {selectedAppt.status === 'accepted' && (
                      <>
                        <button 
                          onClick={() => openChatRoom(selectedAppt.patient_id)}
                          className="rounded-xl bg-slate-900 border border-slate-750 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1"
                        >
                          <MessageSquare className="h-4 w-4" /> Message Room
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(selectedAppt.id, 'completed')}
                          className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700"
                        >
                          Mark Completed
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => handleUpdateStatus(selectedAppt.id, 'cancelled')}
                      className="rounded-xl bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 text-xs font-bold"
                    >
                      Cancel Visit
                    </button>
                  </div>
                </div>

                {/* Patient Health Folder */}
                {historyLoading ? (
                  <p className="text-xs text-secondary animate-pulse py-6">Retrieving secure medical records folder...</p>
                ) : patientHistory ? (
                  <div className="space-y-6">
                    {/* Vital Demographics */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Biological Attributes</h4>
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-xs font-semibold">
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3">
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-1">Age</span>
                          <span className="text-primary">{patientHistory.profile.age || 'Unspecified'} yrs</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3">
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-1">Gender</span>
                          <span className="text-primary">{patientHistory.profile.gender || 'Unspecified'}</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3">
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-1">Height</span>
                          <span className="text-primary">{patientHistory.profile.height ? patientHistory.profile.height + ' cm' : 'Unspecified'}</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3">
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-1">Weight</span>
                          <span className="text-primary">{patientHistory.profile.weight ? patientHistory.profile.weight + ' kg' : 'Unspecified'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chronic diseases & Allergies */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Registered Allergies & Diagnoses</h4>
                      {patientHistory.records.length === 0 ? (
                        <p className="text-xs text-secondary">None declared by patient.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {patientHistory.records.map((r: any) => (
                            <span 
                              key={r.id}
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                r.type === 'allergy' ? 'bg-red-50 text-red-700' :
                                r.type === 'chronic_disease' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.title} ({r.type.replace('_', ' ')})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Past AI Assessment summary logs */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Symptom Interview Logs</h4>
                      {patientHistory.consultations.length === 0 ? (
                        <p className="text-xs text-secondary">No AI consultation metrics.</p>
                      ) : (
                        <div className="space-y-2">
                          {patientHistory.consultations.map((c: any) => (
                            <div key={c.id} className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3.5 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-red-500 uppercase tracking-wider text-[9px]">{c.risk_level} Risk Level</span>
                                <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-secondary italic">"{c.health_summary}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                ) : null}

              </div>
            ) : (
              <div className="glass-panel rounded-3xl p-6 shadow-md text-center py-16 text-slate-400 text-xs">
                Select an appointment from the clinic log to view patient health folder.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: Prescription Writer Form */}
      {activeTab === 'prescription' && selectedAppt && (
        <div className="glass-panel rounded-3xl p-6 shadow-md max-w-3xl mx-auto animate-slide-in">
          <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-primary">Write Digital Prescription</h3>
              <p className="text-xs text-secondary">Patient: Dr. Sarah Connor → {selectedAppt.patient_name}</p>
            </div>
            <button onClick={() => setActiveTab('appointments')} className="text-xs font-bold text-slate-500 hover:underline">
              Back to Appointments
            </button>
          </div>

          <form onSubmit={handleSubmitPrescription} className="space-y-6">
            
            {/* Dynamic Med Input Rows */}
            <div className="space-y-3">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Medication List</span>
              {medicines.map((med, idx) => (
                <div key={idx} className="flex gap-2 items-center flex-wrap sm:flex-nowrap border-b border-slate-100 dark:border-slate-850 pb-3 sm:border-0 sm:pb-0">
                  <input 
                    type="text" 
                    placeholder="Medicine Name (e.g. Paracetamol)" 
                    value={med.name}
                    onChange={e => handleMedChange(idx, 'name', e.target.value)}
                    required
                    className="flex-1 rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950"
                  />
                  <input 
                    type="text" 
                    placeholder="Dosage (500mg)" 
                    value={med.dosage}
                    onChange={e => handleMedChange(idx, 'dosage', e.target.value)}
                    className="w-24 rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950"
                  />
                  <input 
                    type="text" 
                    placeholder="Frequency (1-0-1)" 
                    value={med.frequency}
                    onChange={e => handleMedChange(idx, 'frequency', e.target.value)}
                    className="w-28 rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950"
                  />
                  <input 
                    type="text" 
                    placeholder="Instructions (After food)" 
                    value={med.instruction}
                    onChange={e => handleMedChange(idx, 'instruction', e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950"
                  />
                  
                  {medicines.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveMedRow(idx)}
                      className="rounded-xl p-2 bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button 
                type="button" 
                onClick={handleAddMedRow}
                className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1 dark:text-brand-400 mt-2"
              >
                <Plus className="h-4 w-4" /> Add Another Medication
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Observations / Clinician Notes</label>
              <textarea 
                value={prescriptionNotes}
                onChange={e => setPrescriptionNotes(e.target.value)}
                rows={3}
                placeholder="Diagnostic remarks, duration notes, warnings..."
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950"
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={prescriptionLoading}
              className="w-full rounded-xl bg-brand-600 py-3 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50 shadow-md"
            >
              {prescriptionLoading ? 'Dispatching...' : 'Sign and Dispatch Prescription'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Clinic Message Room */}
      {activeTab === 'chat' && activePatientChatId && (
        <div className="flex flex-col h-[70vh] glass-panel rounded-3xl shadow-lg overflow-hidden max-w-3xl mx-auto animate-slide-in">
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
            <div>
              <h2 className="font-bold text-sm">Consultation Message Room</h2>
              <p className="text-[10px] text-slate-400">Direct portal with patient</p>
            </div>
            <button onClick={() => setActiveTab('appointments')} className="text-slate-400 hover:text-white">
              Close Room
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-secondary py-12">No messages exchanged yet.</p>
            ) : (
              chatMessages.map((msg, idx) => {
                const isSentByMe = msg.sender_id === user?.id;
                return (
                  <div key={idx} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs ${
                      isSentByMe 
                        ? 'bg-slate-800 text-white rounded-br-none' 
                        : 'bg-brand-600 text-white rounded-bl-none'
                    }`}>
                      <p>{msg.content}</p>
                      <span className="block text-[8px] text-slate-300 text-right mt-1 font-mono">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSendChat} className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input 
              type="text" 
              required
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Enter message for patient..."
              className="flex-1 rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950"
            />
            <button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-700">
              Send
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default DoctorDashboard;
