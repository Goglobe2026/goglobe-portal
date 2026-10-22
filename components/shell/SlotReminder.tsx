'use client';
import { useEffect, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { FIVE_COUNTRIES } from '@/lib/slotproviders';
import { dueCountries, inReminderHours, REMIND_FROM_HOUR, REMIND_GAP_MIN, REMIND_TO_HOUR, reminderText, shouldRemind } from '@/lib/slotchecks';

// Reminders for the person who walks the official pages. They only work while the portal is open in a
// browser (a web page cannot wake a closed computer), they stay quiet outside 9 am–8 pm Pakistan time,
// and they never repeat more often than every half hour.

const OFF_KEY = 'slot-remind-off';       // "1" = this computer has reminders switched off
const SNOOZE_KEY = 'slot-remind-snooze'; // epoch ms: banner hidden until then
const LAST_KEY = 'slot-remind-last';     // epoch ms: last pop-up reminder
const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage can be blocked */ } };

export const remindersOn = () => read(OFF_KEY) !== '1';
export function setRemindersOn(on: boolean) { write(OFF_KEY, on ? '0' : '1'); try { window.dispatchEvent(new Event('slot-remind-changed')); } catch { /* ignore */ } }
export const REMIND_WINDOW_TEXT = `${REMIND_FROM_HOUR > 12 ? REMIND_FROM_HOUR - 12 : REMIND_FROM_HOUR} am to ${REMIND_TO_HOUR - 12} pm Pakistan time, at most every ${REMIND_GAP_MIN} minutes`;

/** Countries whose official page is due, refreshed every 30 seconds. Also puts the count in the browser tab title. */
export function useSlotDue(enabled: boolean): string[] {
  const { slotConfig, slotAlerts } = useAppData();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!enabled) return; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [enabled]);
  const due = enabled ? dueCountries(FIVE_COUNTRIES, slotConfig, slotAlerts, now) : [];
  const count = due.length;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) ${base}` : base;
    return () => { document.title = base; };
  }, [enabled, count]);

  // a desktop pop-up, only when the person allowed it and only inside the reminder hours
  const key = due.join('|');
  useEffect(() => {
    if (!enabled || !count || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !remindersOn()) return;
    const t = Date.now();
    if (!shouldRemind(count, Number(read(LAST_KEY) || 0), t)) return;
    write(LAST_KEY, String(t));
    try { new Notification('Slot Desk', { body: reminderText(due) }); } catch { /* some browsers only allow this from a service worker */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, now]);
  return due;
}

/** Opens Slot Desk and starts the check round (works whether or not Slot Desk is already open). */
export function startCheckRound() {
  write('slot-open-round', '1');
  window.dispatchEvent(new CustomEvent('goto-tab', { detail: 'slotdesk' }));
  window.dispatchEvent(new Event('slot-start-round'));
}

export function SlotReminderBanner({ due }: { due: string[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); const h = () => setTick(n => n + 1); window.addEventListener('slot-remind-changed', h); return () => { clearInterval(t); window.removeEventListener('slot-remind-changed', h); }; }, []);
  const snoozed = Number(read(SNOOZE_KEY) || 0) > now;
  void tick;
  if (!due.length || !inReminderHours(now) || !remindersOn() || snoozed) return null;
  return (
    <div className="mb-4 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap no-print" style={{ background: '#FFF8E6', border: '1px solid #E3C77A' }} data-testid="slot-reminder-banner" role="status">
      <span className="flex-none w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px]" style={{ background: '#FFEFC2', color: '#8A5A00' }} data-testid="slot-reminder-count">{due.length}</span>
      <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
        <b className="text-[13.5px]">Time to look at the official {due.length === 1 ? 'page' : 'pages'}</b>
        <span className="text-[12.5px] text-[var(--muted)]"> · </span><span className="text-[12.5px] text-[var(--muted)]" data-testid="slot-reminder-list">{due.join(', ')}</span>
      </div>
      <div className="flex gap-2 flex-none">
        <button className="btn btn-sm btn-ghost" onClick={() => { write(SNOOZE_KEY, String(Date.now() + REMIND_GAP_MIN * 60000)); setTick(n => n + 1); }} data-testid="slot-reminder-later">Later</button>
        <button className="btn btn-sm btn-primary" onClick={startCheckRound} data-testid="slot-reminder-start">Start check round</button>
      </div>
    </div>
  );
}
