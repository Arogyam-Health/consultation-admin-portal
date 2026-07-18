'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Slot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
  status: 'available' | 'booked' | 'blocked' | 'expired';
}

interface Booking {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  created_at: string;
  slots?: { start_time: string; end_time: string };
}

type Tab = 'dashboard' | 'slots' | 'bookings';

const DURATIONS = [15, 20, 30, 45, 60];

const apiFetch = async (url: string, token: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
};

const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [adminInfo, setAdminInfo] = useState<{ email: string; role: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loginEmail, setLoginEmail] = useState('admin@theobesitykiller.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [assessCount, setAssessCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const [genForm, setGenForm] = useState({
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '18:00',
    duration_minutes: 30,
    break_start: '',
    break_end: '',
    include_blocked: false,
  });

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [frozenDates, setFrozenDates] = useState<string[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Login failed');
      setToken(json.data.token);
      setAdminInfo({ email: json.data.admin.email, role: json.data.admin.role });
      setIsLoggedIn(true);
      localStorage.setItem('admin_token', json.data.token);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const { data: sessions } = await fetch('/api/admin/sessions/stats', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (sessions) {
        setAssessCount(sessions.total || 0);
        setVerifiedCount(sessions.verified || 0);
      }
    } catch { /* ignore */ }
  }, [token]);

  const loadSlots = useCallback(async () => {
    if (!token) return;
    try {
      const from = new Date().toISOString().split('T')[0];
      const to = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const data = await apiFetch(`/api/admin/slots?from=${from}&to=${to}`, token);
      setSlots(data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load slots', 'error');
    }
  }, [token]);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/api/admin/bookings', token);
      setBookings(data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load bookings', 'error');
    }
  }, [token]);

  const loadFrozenDates = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/api/admin/slots/freeze', token);
      setFrozenDates(data || []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { if (isLoggedIn) loadFrozenDates(); }, [isLoggedIn, loadFrozenDates]);

  const handleFreezeDate = async (date: string) => {
    try {
      await apiFetch('/api/admin/slots/freeze', token, { method: 'POST', body: JSON.stringify({ dates: [date] }) });
      showToast(`Frozen ${date}`);
      loadFrozenDates();
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to freeze date', 'error');
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const connectWs = () => {
      setWsStatus('connecting');
      const ws = new WebSocket(`ws://localhost:4001`);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus('connected');
      ws.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connectWs, 3000);
      };
      ws.onerror = () => setWsStatus('disconnected');
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (['slot_updated', 'slot_booked', 'slot_released', 'slot_blocked'].includes(msg.type)) {
            loadSlots();
          }
        } catch { /* ignore */ }
      };
    };

    connectWs();
    return () => wsRef.current?.close();
  }, [isLoggedIn, loadSlots]);

  useEffect(() => {
    if (isLoggedIn) {
      loadDashboard();
      loadSlots();
      loadBookings();
    }
  }, [isLoggedIn, loadDashboard, loadSlots, loadBookings]);

  const handleGenerateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { ...genForm };
      if (!body.break_start) { delete body.break_start; }
      if (!body.break_end) { delete body.break_end; }
      const result = await apiFetch('/api/admin/slots', token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast(`✓ Created ${result.created} slots (${result.duplicates_skipped} dupes, ${result.booked_preserved} booked preserved)`);
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to generate slots', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlockSlot = async (slotId: string) => {
    try {
      await apiFetch(`/api/admin/slots/${slotId}/block`, token, { method: 'POST', body: JSON.stringify({}) });
      showToast('Slot blocked');
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to block slot', 'error');
    }
  };

  const handleUnblockSlot = async (slotId: string) => {
    try {
      await apiFetch(`/api/admin/slots/${slotId}/block`, token, { method: 'DELETE' });
      showToast('Slot unblocked');
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to unblock slot', 'error');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Delete this slot?')) return;
    try {
      await apiFetch(`/api/admin/slots/${slotId}/block`, token, { method: 'DELETE' });
      showToast('Slot deleted');
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete slot', 'error');
    }
  };

  const handleBulkDelete = async () => {
    const from = prompt('From date (YYYY-MM-DD):');
    if (!from) return;
    const to = prompt('To date (YYYY-MM-DD):');
    if (!to) return;
    if (!confirm(`Delete all available slots from ${from} to ${to}?`)) return;
    try {
      const result = await apiFetch(`/api/admin/slots?from=${from}&to=${to}&status=available`, token, { method: 'DELETE' });
      showToast(`Deleted ${result.deleted} slots`);
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete slots', 'error');
    }
  };

  const handleBookingStatus = async (bookingId: string, status: string) => {
    try {
      await apiFetch(`/api/admin/bookings/${bookingId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Booking ${status}`);
      loadBookings();
      loadSlots();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update booking', 'error');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <div className="logo-icon">🏥</div>
            <h1>The Obesity Killer</h1>
            <p>Admin Portal</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@theobesitykiller.com" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Enter password" required />
            </div>
            {loginError && <div className="error-msg">{loginError}</div>}
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const slotsByDate: Record<string, Slot[]> = {};
  slots.forEach(s => {
    if (!slotsByDate[s.slot_date]) slotsByDate[s.slot_date] = [];
    slotsByDate[s.slot_date].push(s);
  });

  const now = new Date().toISOString();

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon">🏥</span>
          <div>
            <div className="brand">The Obesity Killer</div>
            <div className="brand-sub">Admin Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {([['dashboard', '📊', 'Dashboard'], ['slots', '🕐', 'Consultation Slots'], ['bookings', '📋', 'Bookings']] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="ws-badge" data-status={wsStatus}>
            <span className="ws-dot" />
            WS {wsStatus}
          </div>
          <div className="admin-chip">
            <span>👤</span>
            <span>{adminInfo?.email}</span>
          </div>
          <button className="btn-logout" onClick={() => { setIsLoggedIn(false); setToken(''); localStorage.removeItem('admin_token'); }}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <h2 className="page-title">
            {activeTab === 'dashboard' && '📊 Dashboard'}
            {activeTab === 'slots' && '🕐 Consultation Slots'}
            {activeTab === 'bookings' && '📋 Bookings'}
          </h2>
        </div>

        {activeTab === 'dashboard' && (
          <div className="tab-content">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-number">{assessCount}</div>
                <div className="stat-label">Total Assessment Leads</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{verifiedCount}</div>
                <div className="stat-label">Verified Leads</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{slots.filter(s => s.status === 'available').length}</div>
                <div className="stat-label">Available Slots</div>
              </div>
              <div className="stat-card booked">
                <div className="stat-number">{slots.filter(s => s.status === 'booked').length}</div>
                <div className="stat-label">Booked Consultations</div>
              </div>
              <div className="stat-card bookings-stat">
                <div className="stat-number">{bookings.filter(b => b.status === 'confirmed' && b.slots?.start_time && b.slots.start_time > now).length}</div>
                <div className="stat-label">Upcoming Consultations</div>
              </div>
            </div>

            <div className="section-card">
              <h3>Recent Bookings</h3>
              <table className="data-table">
                <thead><tr><th>Patient</th><th>Phone</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {bookings.slice(0, 10).map(b => (
                    <tr key={b.id}>
                      <td>{b.full_name}</td>
                      <td>{b.phone}</td>
                      <td>{b.slots ? fmtDate(b.slots.start_time) : '—'}</td>
                      <td>{b.slots ? fmt(b.slots.start_time) : '—'}</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                    </tr>
                  ))}
                  {bookings.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No bookings yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'slots' && (
          <div className="tab-content">
            <div className="section-card">
              <h3>Generate Consultation Slots</h3>
              <p className="section-hint">Set your availability window, duration, and optional break. Slots are created for every date in the range.</p>
              <form onSubmit={handleGenerateSlots} className="generate-form">
                <div className="form-row">
                  <div className="field">
                    <label>From Date</label>
                    <input type="date" value={genForm.from_date} onChange={e => setGenForm(p => ({ ...p, from_date: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>To Date</label>
                    <input type="date" value={genForm.to_date} onChange={e => setGenForm(p => ({ ...p, to_date: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Start Time</label>
                    <input type="time" value={genForm.start_time} onChange={e => setGenForm(p => ({ ...p, start_time: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>End Time</label>
                    <input type="time" value={genForm.end_time} onChange={e => setGenForm(p => ({ ...p, end_time: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Duration</label>
                    <select value={genForm.duration_minutes} onChange={e => setGenForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))}>
                      {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Break Start (optional)</label>
                    <input type="text" value={genForm.break_start} onChange={e => setGenForm(p => ({ ...p, break_start: e.target.value }))} placeholder="HH:MM" />
                  </div>
                  <div className="field">
                    <label>Break End (optional)</label>
                    <input type="text" value={genForm.break_end} onChange={e => setGenForm(p => ({ ...p, break_end: e.target.value }))} placeholder="HH:MM" />
                  </div>
                  <div className="field" style={{ justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={genForm.include_blocked} onChange={e => setGenForm(p => ({ ...p, include_blocked: e.target.checked }))} />
                      Include blocked slots
                    </label>
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Generating…' : '⚡ Generate Slots'}
                </button>
              </form>
              <div style={{ marginTop: 12 }}>
                <button className="btn-sm btn-warn" onClick={handleBulkDelete}>🗑️ Bulk Delete Available Slots</button>
              </div>
            </div>

            <div className="section-card">
              <div className="slots-header">
                <h3>Slot Calendar</h3>
                <div className="legend">
                  <span className="legend-item"><span className="dot available" />Available</span>
                  <span className="legend-item"><span className="dot booked" />Booked</span>
                  <span className="legend-item"><span className="dot blocked" />Blocked</span>
                </div>
              </div>

              {Object.entries(slotsByDate).map(([date, daySlots]) => {
                const isFrozen = frozenDates.includes(date);
                return (
                <div key={date} className="day-section">
                  <div className="day-heading">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {isFrozen && <span className="frozen-badge">❄️ Frozen</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="slot-count">{daySlots.filter(s => s.status === 'available').length} available</span>
                      {!isFrozen && (
                        <button className="btn-sm btn-freeze" onClick={() => handleFreezeDate(date)} title="Freeze this date">❄️ Freeze</button>
                      )}
                    </div>
                  </div>
                  <div className="slots-grid">
                    {daySlots.map(slot => (
                      <div key={slot.id} className={`slot-chip slot-${slot.status}`}>
                        <div className="slot-time">{fmt(slot.start_time)}</div>
                        <div className="slot-dur">{slot.duration_mins}m</div>
                        {slot.status === 'available' && (
                          <>
                            <button className="slot-action" onClick={() => handleBlockSlot(slot.id)} title="Block slot">🚫</button>
                            <button className="slot-action" onClick={() => handleDeleteSlot(slot.id)} title="Delete slot">🗑️</button>
                          </>
                        )}
                        {slot.status === 'blocked' && (
                          <button className="slot-action" onClick={() => handleUnblockSlot(slot.id)} title="Unblock slot">✅</button>
                        )}
                        {slot.status === 'booked' && <span className="slot-action" title="Booked">📅</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
              })}

              {Object.keys(slotsByDate).length === 0 && (
                <div className="empty-state">
                  <p>No slots generated yet. Use the form above to create slots.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="tab-content">
            <div className="section-card">
              <h3>All Bookings</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Phone</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td>{b.full_name}</td>
                      <td>{b.phone}</td>
                      <td>{b.slots ? fmtDate(b.slots.start_time) : '—'}</td>
                      <td>{b.slots ? fmt(b.slots.start_time) : '—'}</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                      <td>
                        <div className="action-btns">
                          {b.status === 'confirmed' && (
                            <>
                              <button className="btn-sm btn-success" onClick={() => handleBookingStatus(b.id, 'completed')}>Complete</button>
                              <button className="btn-sm btn-danger" onClick={() => handleBookingStatus(b.id, 'cancelled')}>Cancel</button>
                              <button className="btn-sm btn-warn" onClick={() => handleBookingStatus(b.id, 'no_show')}>No Show</button>
                            </>
                          )}
                          {b.status === 'completed' && (
                            <button className="btn-sm" onClick={() => handleBookingStatus(b.id, 'confirmed')}>Revert to Confirmed</button>
                          )}
                          {b.status === 'cancelled' && (
                            <button className="btn-sm" onClick={() => handleBookingStatus(b.id, 'confirmed')}>Revert to Confirmed</button>
                          )}
                          {b.status === 'no_show' && (
                            <>
                              <button className="btn-sm btn-success" onClick={() => handleBookingStatus(b.id, 'completed')}>Mark Completed</button>
                              <button className="btn-sm" onClick={() => handleBookingStatus(b.id, 'confirmed')}>Revert to Confirmed</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No bookings found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
