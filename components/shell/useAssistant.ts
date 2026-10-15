'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { today } from '@/lib/constants';
import { respond, NEW_MEMORY, type AssistantData, type Memory, type Reply } from '@/lib/assistant/engine';

// One conversation for the whole portal: the chat window and the Sales Coach "Ask" tab show
// the same thread, so nothing is lost when you move between them. It lives in memory, and
// the last few messages are kept in this browser tab (sessionStorage) so a page refresh does
// not wipe it. It is cleared when someone else logs in.

export interface ChatMsg { id: number; role: 'user' | 'bot'; text?: string; reply?: Reply; pending?: boolean }
interface Store { key: string; msgs: ChatMsg[]; mem: Memory; open: boolean; busy: boolean }

let store: Store = { key: '', msgs: [], mem: NEW_MEMORY, open: false, busy: false };
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
const set = (patch: Partial<Store>) => { store = { ...store, ...patch }; emit(); };
const STORE_KEY = 'goglobe_assistant_v1';

function save() {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ key: store.key, mem: store.mem, msgs: store.msgs.filter(m => !m.pending).slice(-24) })); } catch { /* no storage — fine */ }
}
function load(key: string) {
  try {
    const raw = sessionStorage.getItem(STORE_KEY); if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && v.key === key && Array.isArray(v.msgs)) return v as { msgs: ChatMsg[]; mem: Memory };
  } catch { /* ignore */ }
  return null;
}

export const assistant = {
  setOpen(open: boolean) { set({ open }); },
  reset() { nextId = 1; set({ msgs: [], mem: NEW_MEMORY, busy: false }); save(); },
  /** Ask a question. `build` makes the data the answer is worked out from (called at the moment of asking, so it is current). */
  ask(question: string, build: () => AssistantData) {
    const q = question.trim().slice(0, 400);
    if (!q || store.busy) return;
    const userMsg: ChatMsg = { id: nextId++, role: 'user', text: q };
    const botId = nextId++;
    set({ msgs: [...store.msgs, userMsg, { id: botId, role: 'bot', pending: true }], busy: true });
    let reply: Reply;
    try { reply = respond(q, build(), store.mem); }
    catch { reply = { blocks: [{ t: 'p', text: 'Sorry — something went wrong while I was working that out. Please try asking it a different way.' }], follow: [], go: [], memory: store.mem, intent: 'error', plain: '' }; }
    // a short pause so the answer feels considered, longer for longer answers
    const wait = Math.min(900, 260 + reply.plain.length * 0.5);
    setTimeout(() => {
      set({ msgs: store.msgs.map(m => (m.id === botId ? { id: botId, role: 'bot', reply } : m)), mem: reply.memory, busy: false });
      save();
    }, wait);
  },
};

export function useAssistantStore(): Store {
  return useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => store,
    () => store,
  );
}

/** Builds the data the assistant answers from, always from the latest portal data. */
export function useAssistantData(): { build: () => AssistantData; role: 'head' | 'staff'; staffId: string; key: string } {
  const d = useAppData();
  const ref = useRef(d); ref.current = d;
  const s = d.session;
  const me = s?.type === 'employee' ? d.team.find(t => t.id === s.staffId) : undefined;
  const role: 'head' | 'staff' = s?.type === 'ceo' || me?.isAdmin ? 'head' : 'staff';
  const staffId = s?.type === 'employee' ? s.staffId : '';
  const key = `${s?.type || 'none'}:${staffId}`;
  const build = (): AssistantData => {
    const x = ref.current;
    return {
      todayIso: today(), nowMs: Date.now(), role, staffId: role === 'head' ? '' : staffId,
      transactions: x.transactions, cases: x.cases, leads: x.leads, payRuns: x.payRuns, loans: x.loans, personalExpenses: x.personalExpenses,
      appointments: x.appointments, team: x.team, bankAccounts: x.bankAccounts, monthlyClosings: x.monthlyClosings,
      complaints: x.complaints, requests: x.requests, groupTours: x.groupTours, followUpTemplates: x.followUpTemplates, rateCard: x.rateCard, staffTargets: x.staffTargets,
    };
  };
  // a different person logged in: start a fresh conversation (or restore this tab's own)
  useEffect(() => {
    if (store.key === key) return;
    const saved = load(key);
    nextId = saved ? Math.max(0, ...saved.msgs.map(m => m.id)) + 1 : 1;
    set({ key, msgs: saved ? saved.msgs : [], mem: saved ? saved.mem : NEW_MEMORY, busy: false, open: false });
  }, [key]);
  return { build, role, staffId, key };
}

export function gotoTab(tab: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('goto-tab', { detail: tab }));
}
