'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { useToast } from '@/components/ui/Toast';
import { LOGO_FULL } from '@/lib/logo';
import { patternImage } from '@/lib/moduleTheme';

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

  const pill = (active: boolean): React.CSSProperties => active
    ? { background: 'linear-gradient(135deg,#1B3358,#14213D)', color: '#fff', borderColor: 'transparent', boxShadow: '0 10px 20px -10px rgba(20,33,61,.6)' }
    : {};
  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)' }}>
      <div className="relative overflow-hidden max-md:hidden flex flex-col justify-between p-12 text-white" style={{ background: 'linear-gradient(150deg,#0E1B36 0%,#17305B 55%,#0B6E4F 140%)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: patternImage('rings'), opacity: .9 }} />
        <div style={{ position: 'absolute', right: -120, top: -140, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,146,46,.45), transparent 65%)' }} />
        <div className="relative">
          <img src={LOGO_FULL} alt="GoGlobe Consultants" style={{ width: 250, maxWidth: '80%', height: 'auto', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.35))' }} />
        </div>
        <div className="relative max-w-[460px]">
          <h1 className="font-display text-[40px] font-semibold leading-[1.1] m-0">Every lead, every file, every rupee — in one calm place.</h1>
          <div className="mt-6 flex flex-col gap-3.5 text-[14.5px]" style={{ color: '#CFDCF3' }}>
            {[['Never lose a lead', 'Follow-ups and reminders tell each agent what to do next.'], ['Know where every case stands', 'From first consultation to the embassy decision.'], ['See the money clearly', 'What came in, what is owed, what we kept.']].map(([a, b]) => (
              <div key={a} className="flex gap-3 items-start">
                <span className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-none text-[12px]" style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.25)' }}>✓</span>
                <span><b className="text-white">{a}.</b> {b}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[12.5px]" style={{ color: '#9FB3D6' }}>Guiding Journeys, Building Trust.</div>
      </div>

      <div className="flex items-center justify-center p-6" style={{ background: 'linear-gradient(180deg,#F6F9FD,#EAF0F8)' }}>
        <div className="w-full" style={{ maxWidth: 420 }}>
          <div className="md:hidden text-center mb-5"><img src={LOGO_FULL} alt="GoGlobe Consultants" style={{ width: 220, maxWidth: '80%', height: 'auto', margin: '0 auto' }} /></div>
          <div className="card w-full" style={{ padding: 28, borderRadius: 24, boxShadow: '0 30px 60px -30px rgba(20,33,61,.35)' }}>
            <div className="flex gap-2 mb-5 justify-center">
              <button onClick={() => setMode('ceo')} className="btn rounded-full px-4" style={pill(mode === 'ceo')}>Head Manager</button>
              <button onClick={() => { setMode('employee'); loadStaffNames(); }} className="btn rounded-full px-4" style={pill(mode === 'employee')}>Employee</button>
            </div>

            {mode === 'ceo' ? (
              <>
                <div className="font-display text-[22px] font-semibold mb-1">Head Manager sign-in</div>
                <div className="text-[13px] text-[var(--muted)] mb-5">Full access to every module, every employee&apos;s numbers, and finance.</div>
                <div className="mb-4 text-left">
                  <label>Head Manager PIN</label>
                  <input type="password" maxLength={8} value={pin} onChange={e => setPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && login()} placeholder="Enter PIN" style={{ padding: '12px 14px', fontSize: 15 }} />
                </div>
              </>
            ) : (
              <>
                <div className="font-display text-[22px] font-semibold mb-1">Employee sign-in</div>
                <div className="text-[13px] text-[var(--muted)] mb-5">You&apos;ll only see your own attendance, cases and earnings.</div>
                <div className="mb-3 text-left">
                  <label>Your name</label>
                  <select value={staffId} onChange={e => setStaffId(e.target.value)} style={{ padding: '12px 14px', fontSize: 14.5 }}>
                    {team.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
                  </select>
                </div>
                <div className="mb-4 text-left">
                  <label>PIN</label>
                  <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && login()} placeholder="Your PIN" style={{ padding: '12px 14px', fontSize: 15 }} />
                </div>
              </>
            )}

            <button className="btn btn-primary w-full" style={{ padding: '13px 16px', fontSize: 15, borderRadius: 14, background: 'linear-gradient(135deg,#1B3358,#14213D)' }} onClick={login}>
              {mode === 'ceo' ? 'Enter Head Manager dashboard' : 'Enter my portal'}
            </button>

            <div className="text-[11.5px] text-[var(--faint)] mt-4 text-left leading-relaxed">
              This is a session-protected login, not a public account system — PINs are set and reset by the Head Manager.
              Ask your manager if you don&apos;t know yours.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
