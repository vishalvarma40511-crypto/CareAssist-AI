import React, { useState } from 'react';
import { Search, FolderOpen, Plus, Download, FileText, Calendar, Filter, Trash2, Check } from 'lucide-react';

interface FileRecord {
  id: number;
  title: string;
  category: 'report' | 'prescription' | 'insurance' | 'certificate' | 'note';
  doctor: string;
  date: string;
  size: string;
}

const DigitalLocker: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'report' | 'prescription' | 'insurance' | 'certificate' | 'note'>('report');
  const [newDoctor, setNewDoctor] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const [files, setFiles] = useState<FileRecord[]>([
    { id: 1, title: 'Annual Complete Blood Count (CBC) Report', category: 'report', doctor: 'Dr. Sarah Connor', date: '2026-05-12', size: '1.2 MB' },
    { id: 2, title: 'COVID-19 Full Vaccination Certificate', category: 'certificate', doctor: 'Ministry of Health', date: '2024-08-20', size: '850 KB' },
    { id: 3, title: 'Amoxicillin Antibiotic Prescription', category: 'prescription', doctor: 'Dr. John Watson', date: '2026-08-01', size: '240 KB' },
    { id: 4, title: 'Allied Health Premium Insurance Card', category: 'insurance', doctor: 'Allied Care Corp', date: '2026-01-01', size: '480 KB' }
  ]);

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newRecord: FileRecord = {
      id: Date.now(),
      title: newTitle.trim(),
      category: newCategory,
      doctor: newDoctor.trim() || 'Self-Registered',
      date: newDate,
      size: `${Math.floor(Math.random() * 2 + 1)}.${Math.floor(Math.random() * 9)} MB`
    };

    setFiles(prev => [newRecord, ...prev]);
    setNewTitle('');
    setNewDoctor('');
    setShowAddForm(false);
  };

  const handleDelete = (id: number) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'report': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'prescription': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400';
      case 'insurance': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
      case 'certificate': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-400';
    }
  };

  const filtered = files.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) || f.doctor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || f.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left panel: Add form or categories */}
      <div className="space-y-6">
        {/* Toggle Form / Upload Area */}
        <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <FolderOpen className="h-5 w-5 text-indigo-400" /> Secure Locker
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-xl p-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition"
            >
              <Plus size={16} />
            </button>
          </div>

          {showAddForm ? (
            <form onSubmit={handleAddFile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lipids Panel Blood Test"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                >
                  <option value="report">Medical Report</option>
                  <option value="prescription">Prescription Slip</option>
                  <option value="insurance">Insurance Policy</option>
                  <option value="certificate">Vaccination Certificate</option>
                  <option value="note">Doctor Consultation Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Issuing Doctor / Body</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. John Watson"
                  value={newDoctor}
                  onChange={e => setNewDoctor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Date Logged</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                Upload File Metadata
              </button>
            </form>
          ) : (
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-secondary bg-slate-50/50 dark:bg-slate-900/10">
              <p className="font-semibold">Drag & drop files here to upload</p>
              <p className="text-[10px] text-slate-400 mt-1">Files are encrypted locally on client profile before upload.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Search filter and files grid */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search header bar */}
        <div className="glass-panel rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search locker files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              { val: 'all', label: 'All Files' },
              { val: 'report', label: 'Reports' },
              { val: 'prescription', label: 'Prescriptions' },
              { val: 'insurance', label: 'Insurance' },
              { val: 'certificate', label: 'Certificates' }
            ].map(cat => (
              <button
                key={cat.val}
                onClick={() => setFilterCategory(cat.val)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${filterCategory === cat.val ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-secondary'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Files list */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-secondary py-12 sm:col-span-2">No documents found matching the search/filter parameters.</p>
          ) : (
            filtered.map(file => (
              <div
                key={file.id}
                className="glass-panel rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-850 flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${getCategoryColor(file.category)}`}>
                      {file.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{file.size}</span>
                  </div>

                  <h4 className="text-sm font-bold text-primary mb-1 line-clamp-1">{file.title}</h4>
                  <p className="text-xs text-secondary flex items-center gap-1"><FileText size={11} /> {file.doctor}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                    <Calendar size={11} /> {file.date}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => alert(`Downloading secure backup of ${file.title}...`)}
                      className="rounded-lg p-1.5 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition"
                      title="Download encrypted file"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="rounded-lg p-1.5 bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 transition"
                      title="Delete metadata"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalLocker;
