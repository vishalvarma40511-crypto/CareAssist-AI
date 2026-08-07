import React, { useState } from 'react';
import { Search, MapPin, Navigation, Star, Phone, Clock } from 'lucide-react';

const mockServices: { [key: string]: any[] } = {
  hospitals: [
    { name: 'Red Cross Emergency Hospital', distance: '0.8 km', rating: 4.8, hours: 'Open 24 Hours', phone: '+1 555-0199', address: '452 Medical Center Parkway' },
    { name: 'Saint Jude General Hospital', distance: '1.5 km', rating: 4.6, hours: 'Open 24 Hours', phone: '+1 555-0182', address: '12 Health Science Road' },
    { name: 'Metro Cardiology Clinic & Hospital', distance: '2.3 km', rating: 4.7, hours: 'Open 24 Hours', phone: '+1 555-0155', address: '88 Heart Beat Boulevard' }
  ],
  clinics: [
    { name: 'CareFirst Pediatric Clinic', distance: '0.4 km', rating: 4.9, hours: '8:00 AM - 6:00 PM', phone: '+1 555-0133', address: '11 Kids Wellness Blvd' },
    { name: 'Family Care Practice clinic', distance: '1.1 km', rating: 4.5, hours: '9:00 AM - 5:00 PM', phone: '+1 555-0174', address: '302 Community Square' }
  ],
  pharmacies: [
    { name: 'Apex 24/7 Pharmacy', distance: '0.2 km', rating: 4.7, hours: 'Open 24 Hours', phone: '+1 555-0121', address: '98 Pharma Corner Lane' },
    { name: 'HealthMart Wellness Pharmacy', distance: '0.9 km', rating: 4.4, hours: '7:00 AM - 10:00 PM', phone: '+1 555-0146', address: '55 Remedy Avenue' }
  ],
  diagnostic_centers: [
    { name: 'ProLab Advanced Diagnostic Labs', distance: '1.2 km', rating: 4.8, hours: '7:00 AM - 8:00 PM', phone: '+1 555-0110', address: '14 Bio Labs Circle' },
    { name: 'Metro MRI & Scan Diagnostics', distance: '2.1 km', rating: 4.6, hours: '8:00 AM - 8:00 PM', phone: '+1 555-0105', address: '90 Imaging Tech Center' }
  ],
  blood_banks: [
    { name: 'National Red Cross Blood Repository', distance: '1.8 km', rating: 4.9, hours: 'Open 24 Hours', phone: '+1 555-0160', address: '5 Life Saver Road' }
  ]
};

const NearbyServices: React.FC = () => {
  const [category, setCategory] = useState<'hospitals' | 'clinics' | 'pharmacies' | 'diagnostic_centers' | 'blood_banks'>('hospitals');
  const [searchQuery, setSearchQuery] = useState('');

  const services = mockServices[category] || [];
  const filtered = services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Panel: Category selection & list */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search & Filter Header */}
        <div className="glass-panel rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search health centers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { val: 'hospitals', label: '🏥 Hospitals' },
              { val: 'clinics', label: '🩺 Clinics' },
              { val: 'pharmacies', label: '💊 Pharmacies' },
              { val: 'diagnostic_centers', label: '🔬 Labs' },
              { val: 'blood_banks', label: '🩸 Blood Banks' }
            ].map(cat => (
              <button
                key={cat.val}
                onClick={() => { setCategory(cat.val as any); setSearchQuery(''); }}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${category === cat.val ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-secondary'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-secondary py-12">No health centers found matching your query.</p>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={idx}
                className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-indigo-500/20 transition-all duration-300"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-primary text-sm sm:text-md">{item.name}</h3>
                    <span className="flex items-center gap-0.5 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[9px] font-bold text-yellow-500">
                      <Star size={10} fill="currentColor" /> {item.rating}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin size={12} /> {item.address} ({item.distance})
                  </p>
                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 font-semibold pt-1">
                    <span className="flex items-center gap-1"><Clock size={11} /> {item.hours}</span>
                    <span className="flex items-center gap-1"><Phone size={11} /> {item.phone}</span>
                  </div>
                </div>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.name + ' ' + item.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md flex items-center gap-1 hover:opacity-90 active:scale-[0.98] transition"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  <Navigation size={12} className="rotate-45" /> Navigate
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Radar/Map Simulation */}
      <div className="glass-panel rounded-3xl p-6 shadow-md border border-slate-100 dark:border-slate-850 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[350px]">
        <div className="w-full">
          <h4 className="text-sm font-bold text-primary">Live Radar Scan</h4>
          <p className="text-[10px] text-secondary mt-1">Locating diagnostic healthcare facilities closest to you.</p>
        </div>

        {/* Radar concentric circles */}
        <div className="relative w-48 h-48 flex items-center justify-center rounded-full border border-indigo-500/10 bg-indigo-950/5">
          <div className="absolute w-36 h-36 rounded-full border border-indigo-500/20" />
          <div className="absolute w-24 h-24 rounded-full border border-indigo-500/20" />
          
          {/* Concentric scan line */}
          <div className="absolute w-full h-0.5 bg-indigo-500/30 animate-[spin_5s_linear_infinite] origin-center" />

          {/* Center User marker */}
          <div className="absolute w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_12px_#3b82f6] z-15" />

          {/* Near clinic node markers */}
          <div className="absolute top-8 left-12 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute bottom-12 right-8 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute top-20 right-14 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </div>

        <div className="w-full flex items-center gap-1 justify-center text-[10px] text-slate-400">
          <MapPin size={10} className="text-blue-500" />
          <span>Coordinates: 17.3850° N, 78.4867° E (Hyderabad, IN)</span>
        </div>
      </div>
    </div>
  );
};

export default NearbyServices;
