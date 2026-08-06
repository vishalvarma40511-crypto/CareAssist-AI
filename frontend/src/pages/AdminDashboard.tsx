import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, UserCheck, ShieldAlert, Award, 
  Trash2, CheckCircle, Database, Server, RefreshCcw 
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { token, apiBase } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'users' | 'doctors' | 'logs'>('users');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersRes = await fetch(`${apiBase}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
      const usersData = await usersRes.json();
      if (usersRes.ok) setUsers(usersData);

      // 2. Fetch Pending Doctors
      const docsRes = await fetch(`${apiBase}/admin/doctors/pending`, { headers: { 'Authorization': `Bearer ${token}` } });
      const docsData = await docsRes.json();
      if (docsRes.ok) setPendingDoctors(docsData);

      // 3. Fetch System Logs
      const logsRes = await fetch(`${apiBase}/admin/logs`, { headers: { 'Authorization': `Bearer ${token}` } });
      const logsData = await logsRes.json();
      if (logsRes.ok) setLogs(logsData);

      // 4. Fetch Analytics
      const analRes = await fetch(`${apiBase}/admin/analytics`, { headers: { 'Authorization': `Bearer ${token}` } });
      const analData = await analRes.json();
      if (analRes.ok) setAnalytics(analData);

      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;

    try {
      const res = await fetch(`${apiBase}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("User deleted successfully!");
        fetchData();
      } else {
        const d = await res.json();
        alert("Error deleting user: " + d.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyDoctor = async (doctorId: string) => {
    try {
      const res = await fetch(`${apiBase}/admin/doctors/verify/${doctorId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Doctor license verified. Access granted.");
        fetchData();
      } else {
        const d = await res.json();
        alert("Error verifying doctor: " + d.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      
      {/* Top Header stats */}
      <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
        
        <div className="glass-panel rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Users</span>
            <h3 className="text-2xl font-extrabold text-primary">{users.length}</h3>
          </div>
          <Users className="h-8 w-8 text-brand-600 opacity-20" />
        </div>

        <div className="glass-panel rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pending Approvals</span>
            <h3 className="text-2xl font-extrabold text-yellow-500">{pendingDoctors.length}</h3>
          </div>
          <ShieldAlert className="h-8 w-8 text-yellow-500 opacity-20" />
        </div>

        <div className="glass-panel rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Analytics Status</span>
            <h3 className="text-xs font-bold text-green-500 flex items-center gap-1 mt-1">
              <CheckCircle className="h-4 w-4" /> Running OK
            </h3>
          </div>
          <Server className="h-8 w-8 text-green-500 opacity-20" />
        </div>

        <div className="glass-panel rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Database Pool</span>
            <h3 className="text-xs font-bold text-brand-500 flex items-center gap-1 mt-1">
              <Database className="h-4 w-4" /> PostgreSQL Connected
            </h3>
          </div>
          <Database className="h-8 w-8 text-brand-600 opacity-20" />
        </div>

      </div>

      {/* Tabs */}
      <div className="mb-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-3">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('users')}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === 'users' ? 'bg-brand-600 text-white' : 'text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            User Directory
          </button>
          <button 
            onClick={() => setActiveTab('doctors')}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === 'doctors' ? 'bg-brand-600 text-white' : 'text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Verification Queue ({pendingDoctors.length})
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === 'logs' ? 'bg-brand-600 text-white' : 'text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            System Logs
          </button>
        </div>

        <button 
          onClick={fetchData} 
          disabled={loading}
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-40"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading && 'animate-spin'}`} /> Reload metrics
        </button>
      </div>

      {/* Tab Content: Users Directory */}
      {activeTab === 'users' && (
        <div className="glass-panel rounded-3xl shadow-md overflow-hidden animate-slide-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-150 dark:border-slate-850 font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Age / Gender</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="p-4 font-bold text-primary">{u.name}</td>
                    <td className="p-4 text-secondary font-mono">{u.email}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' :
                        u.role === 'doctor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                      }`}>{u.role}</span>
                    </td>
                    <td className="p-4 text-secondary">{u.age ? `${u.age} yrs` : 'N/A'} • {u.gender || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold ${u.is_verified ? 'text-green-500' : 'text-yellow-500'}`}>
                        {u.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete Account"
                        >
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Doctor approvals */}
      {activeTab === 'doctors' && (
        <div className="glass-panel rounded-3xl p-6 shadow-md animate-slide-in">
          <h3 className="text-md font-extrabold text-primary mb-4">Doctor Licensure Review Queue</h3>
          
          {pendingDoctors.length === 0 ? (
            <p className="text-center text-xs text-secondary py-8">No pending doctor registrations requiring approval.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pendingDoctors.map(doc => (
                <div key={doc.id} className="rounded-2xl border border-slate-150 p-5 dark:border-slate-850 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-primary">{doc.name}</h4>
                    <p className="text-xs text-brand-600 font-bold mb-2 uppercase tracking-wide">{doc.specialty}</p>
                    <div className="space-y-1 text-slate-500 text-[10px] font-bold">
                      <div>LICENSE: <span className="text-primary font-mono">{doc.license_number}</span></div>
                      <div>ADDRESS: {doc.clinic_address || 'Unspecified'}</div>
                      <div>EMAIL: {doc.email}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleVerifyDoctor(doc.id)}
                    className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white hover:bg-brand-700 shadow-md flex items-center justify-center gap-1"
                  >
                    <UserCheck className="h-4 w-4" /> Approve & Verify License
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: System Audit Logs */}
      {activeTab === 'logs' && (
        <div className="glass-panel rounded-3xl p-6 shadow-md animate-slide-in">
          <h3 className="text-md font-extrabold text-primary mb-4">Database Activity Stream</h3>
          
          <div className="max-h-[50vh] overflow-y-auto space-y-2 rounded-xl bg-slate-900 p-4 border border-slate-950 text-xs font-mono text-slate-300">
            {logs.length === 0 ? (
              <p className="text-center text-secondary py-6">No audit records generated.</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="border-b border-slate-800 pb-2 mb-2 flex justify-between gap-4 items-start">
                  <div>
                    <span className="text-brand-400 font-bold">[{log.action}]</span>
                    <span className="ml-2">{log.details}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
