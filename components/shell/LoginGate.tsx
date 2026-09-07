'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { useToast } from '@/components/ui/Toast';
import { LOGO_FULL } from '@/lib/logo';

export function LoginGate() {
  const { setSession } = useAppData();
  const toast = useToast();
  const [mode, setMode] = useState<'ceo' | 'employee'>('ceo');
  const [pin, setPin] = useState('');
  const [team, setTeam] = useState<{ id: string; name: string; role: string }[]>([]);
  const [staffId, setStaffId] = useState('');

  // Employee mode needs the staff list to populate the dropdown, but that's
  // exactly the kind of data a signed-out visitor shouldn't be able to pull
  // in bulk — so this uses a small, public, name-only endpoint instead of
  // the authenticated /api/data/team route.
  async function loadStaffNames() {
    if (team.length) return;
    try {
      const res = await fetch('/api/staff-names');
      const list = await res.json();
      setTeam(list);
      if (list.length) setStaffId(list[0].id);
    } catch {
      toast('Could not load staff list');
    }
  }

  async function login() {
    const body = mode === 'ceo' ? { mode: 'ceo', pin } : { mode: 'employee', staffId, pin };
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) { toast('Incorrect PIN'); return; }
    const json = await res.json();
    setSession(json.session);
    window.location.reload();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'linear-gradient(165deg,#14213D 0%,#1B3358 100%)' }}>
      <div className="w-full text-center" style={{ maxWidth: 440 }}>
        <div className="mb-6">
          <img src={LOGO_FULL} alt="GoGlobe Consultants" style={{ width: 260, maxWidth: '85%', height: 'auto', margin: '0 auto' }} />
          <div className="text-[13px] mt-3" style={{ color: '#BFE6D3' }}>Guiding Journeys, Building Trust.</div>
        </div>
        <div className="card w-full text-center" style={{ maxWidth: 440 }}>
        <div className="flex gap-2 mb-4.5 justify-center">
          <button
            onClick={() => setMode('ceo')}
            className="btn rounded-full px-4"
            style={mode === 'ceo' ? { background: 'linear-gradient(135deg,var(--navy-light),var(--navy))', color: '#fff', borderColor: 'transparent' } : {}}
          >
            CEO / Owner
          </button>
          <button
            onClick={() => { setMode('employee'); loadStaffNames(); }}
            className="btn rounded-full px-4"
            style={mode === 'employee' ? { background: 'linear-gradient(135deg,var(--navy-light),var(--navy))', color: '#fff', borderColor: 'transparent' } : {}}
          >
            Employee
          </button>
        </div>

        {mode === 'ceo' ? (
          <>
            <div className="font-display text-[17px] font-semibold mb-1">Owner sign-in</div>
            <div className="text-[12.5px] text-[var(--muted)] mb-4">Full access to every module, every employee&apos;s numbers, and finance.</div>
            <div className="mb-3 text-left">
              <label>Owner PIN</label>
              <input type="password" maxLength={8} value={pin} onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()} placeholder="Enter PIN" />
            </div>
          </>
        ) : (
          <>
            <div className="font-display text-[17px] font-semibold mb-1">Employee sign-in</div>
            <div className="text-[12.5px] text-[var(--muted)] mb-4">You&apos;ll only see your own attendance, cases and earnings.</div>
            <div className="mb-3 text-left">
              <label>Your name</label>
              <select value={staffId} onChange={e => setStaffId(e.target.value)}>
                {team.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
              </select>
            </div>
            <div className="mb-3 text-left">
              <label>PIN</label>
              <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()} placeholder="Your PIN" />
            </div>
          </>
        )}

        <button className="btn btn-primary w-full" onClick={login}>
          {mode === 'ceo' ? 'Enter CEO dashboard' : 'Enter my portal'}
        </button>

        <div className="text-[11.5px] text-[var(--faint)] mt-4 text-left">
          This is a session-protected login, not a public account system — PINs are set and reset by the CEO.
          Ask your manager if you don&apos;t know yours.
        </div>
        </div>
      </div>
    </div>
  );
}
