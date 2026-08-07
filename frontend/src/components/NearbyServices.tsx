import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Star, Phone, Clock, Search, Loader2, AlertCircle, Building2, Pill, FlaskConical, Droplets, Stethoscope, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Place {
  id: number;
  name: string;
  address: string;
  distance: number; // metres
  lat: number;
  lon: number;
  phone?: string;
  type: string;
  openNow?: boolean;
}

type Category = 'hospitals' | 'clinics' | 'pharmacies' | 'diagnostic_centers' | 'blood_banks';

const CATEGORIES: { val: Category; label: string; icon: React.ReactNode; overpassTag: string }[] = [
  { val: 'hospitals',         label: 'Hospitals',     icon: <Building2 size={13} />,  overpassTag: 'amenity=hospital' },
  { val: 'clinics',           label: 'Clinics',       icon: <Stethoscope size={13} />, overpassTag: 'amenity=clinic' },
  { val: 'pharmacies',        label: 'Pharmacies',    icon: <Pill size={13} />,       overpassTag: 'amenity=pharmacy' },
  { val: 'diagnostic_centers',label: 'Labs',          icon: <FlaskConical size={13} />,overpassTag: 'amenity=laboratory' },
  { val: 'blood_banks',       label: 'Blood Banks',   icon: <Droplets size={13} />,   overpassTag: 'amenity=blood_bank' },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

async function fetchPlaces(lat: number, lon: number, category: Category, apiBase: string, token: string, radiusM = 5000): Promise<Place[]> {
  const url = `${apiBase}/patient/nearby-places?lat=${lat}&lon=${lon}&category=${category}&radius=${radiusM}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch from Overpass API proxy');
  const data = await res.json();

  const places: Place[] = (data.elements || [])
    .map((el: any) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!elLat || !elLon) return null;
      const dist = haversineKm(lat, lon, elLat, elLon);
      const name = el.tags?.name || el.tags?.['name:en'] || 'Unnamed Facility';
      const addr = [
        el.tags?.['addr:housenumber'],
        el.tags?.['addr:street'],
        el.tags?.['addr:city'],
      ].filter(Boolean).join(', ') || el.tags?.['addr:full'] || 'Address not available';

      return {
        id: el.id,
        name,
        address: addr,
        distance: dist,
        lat: elLat,
        lon: elLon,
        phone: el.tags?.phone || el.tags?.contact_phone,
        type: el.tags?.amenity || el.tags?.healthcare || category,
        openNow: el.tags?.opening_hours === '24/7' ? true : undefined,
      } as Place;
    })
    .filter(Boolean)
    .sort((a: Place, b: Place) => a.distance - b.distance)
    .slice(0, 15);

  return places;
}

const NearbyServices: React.FC = () => {
  const { apiBase, token } = useAuth();
  const [locationState, setLocationState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [category, setCategory] = useState<Category>('hospitals');
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // Reverse geocode to get city name
  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state || '';
      const country = data.address?.country_code?.toUpperCase() || '';
      setLocationName(`${city}${country ? ', ' + country : ''}`);
    } catch {
      setLocationName(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
    }
  };

  const requestLocation = () => {
    setLocationState('requesting');
    setError(null);
    if (!navigator.geolocation) {
      setLocationState('denied');
      setError('Your browser does not support location services.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLon(longitude);
        setLocationState('granted');
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setLocationState('denied');
        setError(
          err.code === 1
            ? 'Location access denied. Please enable location in your browser settings.'
            : 'Could not determine your location. Please try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const loadPlaces = useCallback(async () => {
    if (userLat === null || userLon === null) return;
    setLoading(true);
    setError(null);
    setPlaces([]);
    setSelectedPlace(null);
    try {
      const results = await fetchPlaces(userLat, userLon, category, apiBase, token || '');
      if (results.length === 0) {
        setError(`No ${category.replace('_', ' ')} found within 5 km. Try expanding your search.`);
      }
      setPlaces(results);
    } catch (e: any) {
      setError('Failed to load nearby places. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [userLat, userLon, category, apiBase, token]);

  useEffect(() => {
    if (locationState === 'granted') {
      loadPlaces();
    }
  }, [locationState, category, loadPlaces]);

  const filtered = places.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mapPlace = selectedPlace || (filtered.length > 0 ? filtered[0] : null);
  const mapSrc = mapPlace
    ? `https://maps.google.com/maps?q=${mapPlace.lat},${mapPlace.lon}&z=15&output=embed`
    : userLat && userLon
    ? `https://maps.google.com/maps?q=${userLat},${userLon}&z=14&output=embed`
    : null;

  return (
    <div className="space-y-6">

      {/* Location Permission Banner */}
      {locationState === 'idle' && (
        <div
          className="relative overflow-hidden rounded-3xl p-8 text-center shadow-xl flex flex-col items-center gap-5"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #312e81 100%)' }}
        >
          {/* Animated background */}
          <div className="absolute inset-0 opacity-20">
            {[0,1,2].map(i => (
              <div key={i} className="absolute inset-0 rounded-3xl border border-indigo-400 animate-ping"
                style={{ animationDuration: `${2 + i}s`, animationDelay: `${i * 0.5}s` }} />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-900/60"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <MapPin size={36} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Find Hospitals Near You</h2>
              <p className="text-slate-300 text-sm max-w-md">
                Enable location access to discover real hospitals, clinics, pharmacies and labs closest to your current location.
              </p>
            </div>
            <button
              onClick={requestLocation}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl text-white font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              <Navigation size={16} className="rotate-45" /> Allow Location Access
            </button>
            <p className="text-slate-500 text-xs">Your location is never stored on our servers.</p>
          </div>
        </div>
      )}

      {locationState === 'requesting' && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Loader2 size={40} className="text-indigo-500 animate-spin" />
          <p className="text-slate-400 text-sm font-semibold">Detecting your location…</p>
          <p className="text-slate-500 text-xs">Please allow location access in the browser popup.</p>
        </div>
      )}

      {locationState === 'denied' && (
        <div className="glass-panel rounded-3xl p-8 flex flex-col items-center gap-4 text-center border border-red-500/20">
          <AlertCircle size={36} className="text-red-400" />
          <div>
            <h3 className="font-bold text-primary text-lg">Location Access Denied</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">{error}</p>
          </div>
          <button onClick={requestLocation}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all">
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      )}

      {locationState === 'granted' && (
        <>
          {/* Location Badge & Category Filter */}
          <div className="glass-panel rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              {/* Location info */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <MapPin size={16} className="text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">Your Location</p>
                  <p className="text-[10px] text-slate-400">{locationName || `${userLat?.toFixed(4)}°, ${userLon?.toFixed(4)}°`}</p>
                </div>
                <button onClick={requestLocation} title="Refresh location"
                  className="ml-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-indigo-500">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/50 pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.val}
                  onClick={() => { setCategory(cat.val); setSearchQuery(''); }}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    category === cat.val
                      ? 'text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-secondary hover:border-indigo-400'
                  }`}
                  style={category === cat.val ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : {}}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main grid: list + map */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Place List */}
            <div className="lg:col-span-3 space-y-3">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-slate-400 text-sm font-semibold">Finding nearby {category.replace('_', ' ')}…</p>
                </div>
              )}

              {!loading && error && (
                <div className="glass-panel rounded-3xl p-6 text-center border border-amber-500/20">
                  <AlertCircle size={24} className="text-amber-400 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">{error}</p>
                  <button onClick={loadPlaces} className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && filtered.length === 0 && places.length > 0 && (
                <p className="text-center text-xs text-secondary py-8">No results match your search.</p>
              )}

              {!loading && filtered.map((place, idx) => (
                <div
                  key={place.id}
                  onClick={() => setSelectedPlace(place)}
                  className={`glass-panel rounded-2xl p-4 shadow-sm border cursor-pointer hover:border-indigo-500/40 transition-all duration-200 ${
                    selectedPlace?.id === place.id
                      ? 'border-indigo-500/60 shadow-indigo-900/20 shadow-md'
                      : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                          #{idx + 1}
                        </span>
                        <h3 className="font-bold text-primary text-sm truncate">{place.name}</h3>
                        {place.openNow === true && (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[9px] font-bold text-green-600">
                            24/7
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-2">
                        <MapPin size={10} className="shrink-0 text-slate-400" />
                        <span className="truncate">{place.address}</span>
                      </p>

                      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <Navigation size={10} className="text-indigo-400" />
                          {formatDist(place.distance)} away
                        </span>
                        {place.phone && (
                          <a href={`tel:${place.phone}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-blue-500 hover:underline">
                            <Phone size={10} /> {place.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-white text-[10px] font-bold hover:opacity-90 transition shadow-md"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                    >
                      <Navigation size={11} className="rotate-45" /> Go
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Embedded Map */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="glass-panel rounded-3xl overflow-hidden shadow-md border border-slate-100 dark:border-slate-800 flex flex-col min-h-[420px]">
                <div className="p-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                      <MapPin size={12} className="text-white" />
                    </div>
                    <p className="text-xs font-bold text-primary">
                      {mapPlace ? mapPlace.name : 'Your Location'}
                    </p>
                  </div>
                  {mapPlace && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${mapPlace.lat},${mapPlace.lon}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
                    >
                      <Navigation size={10} className="rotate-45" /> Get Directions
                    </a>
                  )}
                </div>
                {mapSrc ? (
                  <iframe
                    src={mapSrc}
                    className="flex-1 w-full border-none"
                    style={{ minHeight: '370px' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Nearby Hospital Map"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={28} className="text-indigo-500 animate-spin" />
                  </div>
                )}
              </div>

              {/* Stats card */}
              <div className="glass-panel rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-primary mb-2">📍 Search Summary</p>
                <div className="space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Radius searched</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">5 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Results found</span>
                    <span className="font-bold text-indigo-500">{places.length}</span>
                  </div>
                  {places.length > 0 && (
                    <div className="flex justify-between">
                      <span>Nearest</span>
                      <span className="font-bold text-green-500">{formatDist(places[0].distance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Data source</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">OpenStreetMap</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NearbyServices;
