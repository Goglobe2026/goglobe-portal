'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today } from '@/lib/constants';
import { DEFAULT_QC_ITEMS, latestQc, passRate } from '@/lib/qc';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Case, QcCheck, QcItem } from '@/lib/types';

// Who is signed in, as a reviewer / sender.
export function useWho(): { id: string; name: string } {
  const { session, team } = useAppData();
  if (session?.type === 'employee') {
    const me = team.find(t => t.id === session.staffId);
    return { id: session.staffId, name: me?.name || 'Team member' };
  }
  return { id: 'ceo', name: 'Head Manager' };
}

export function QualityControl() {
  const { cases, qcChecks } = useAppData();
  const [checkFor, setCheckFor] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const month = today().slice(0, 7);
  const thisMonth = qcChecks.filter(c => c.date.slice(0, 7) === month);
  const rate = passRate(qcChecks);
  const open = cases.filter(c => c.status === 'Active');
  const rows = open.map(c => ({ c, last: latestQc(qcChecks, c.id) }));
  const waiting = rows.filter(r => r.last?.result !== 'Passed');
  const failedNow = rows.filter(r => r.last?.result === 'Failed').length;
  const neverChecked = rows.filter(r => !r.last).length;
  const history = [...qcChecks].sort((a, b) => (b.at || b.date).localeCompare(a.at || a.date));
  const shownHistory = showAll ? history : history.slice(0, 12);
  const viewCheck = qcChecks.find(c => c.id === viewId);

  return (
    <div>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Tile label="Checks done this month" value={String(thisMonth.length)} sub={`${qcChecks.length} in total`} />
        <Tile label="Pass rate" value={rate === null ? '—' : `${rate}%`} sub="passed at the first or later check" color={rate !== null && rate < 70 ? 'var(--red)' : undefined} />
        <Tile label="Failed — to fix" value={String(failedNow)} sub="files whose latest check failed" color={failedNow ? 'var(--red)' : undefined} />
        <Tile label="Not checked yet" value={String(neverChecked)} sub={`of ${open.length} open files`} />
      </div>

      <SectionHead title="Files waiting for a passing check" count={`${waiting.length} of ${open.length} open files`} />
      {!waiting.length ? (
        <EmptyState title="Every open file has passed its check" body="New or failed files appear here." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Client</th><th>Destination</th><th>Stage</th><th>Latest check</th><th></th></tr></thead>
            <tbody>
              {waiting.map(({ c, last }) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}<div className="text-[11px] text-[var(--muted)]">{c.referenceCode}</div></td>
                  <td>{c.destination}</td>
                  <td>{c.caseStage}</td>
                  <td>{last ? <><Stamp text={last.result} /><div className="text-[11px] text-[var(--muted)] mt-1">{last.reviewerName} · {fmtDate(last.date)}{last.result === 'Failed' ? ` · ${last.items.filter(i => !i.ok).length} problem(s)` : ''}</div></> : <span className="text-[var(--muted)]">Not checked</span>}</td>
                  <td className="text-right"><button className="btn btn-sm btn-primary" onClick={() => setCheckFor(c.id)}>{last ? 'Check again' : 'Check file'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionHead title="Checks done" count={`${history.length} recorded`} />
      {!history.length ? (
        <EmptyState title="No checks yet" body="Check a file above and it is recorded here with who did it and what they found." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Checked by</th><th>Result</th><th>Problems</th><th></th></tr></thead>
            <tbody>
              {shownHistory.map(h => {
                const k = cases.find(c => c.id === h.caseId);
                return (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap">{fmtDate(h.date)}</td>
                    <td className="font-medium">{k?.name || '(file removed)'}</td>
                    <td>{h.reviewerName}</td>
                    <td><Stamp text={h.result} /></td>
                    <td>{h.items.filter(i => !i.ok).length || '—'}</td>
                    <td className="text-right"><button className="btn btn-sm btn-ghost" onClick={() => setViewId(h.id)}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {history.length > 12 && <div className="p-3 text-center"><button className="btn btn-sm" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${history.length}`}</button></div>}
        </div>
      )}

      <Modal open={!!checkFor} onClose={() => setCheckFor(null)} wide>
        {checkFor && <QcCheckForm caseId={checkFor} onClose={() => setCheckFor(null)} />}
      </Modal>
      <Modal open={!!viewCheck} onClose={() => setViewId(null)}>
        {viewCheck && <QcCheckView check={viewCheck} caseRec={cases.find(c => c.id === viewCheck.caseId)} onClose={() => setViewId(null)} />}
      </Modal>
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[22px] font-semibold mt-1" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

// The checklist itself. Used from the Quality Control page and from inside a
// case file (before the manager approves it).
export function QcCheckForm({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved?: (c: QcCheck) => void }) {
  const { cases, setQcChecks, logActivity, qcChecks } = useAppData();
  const who = useWho();
  const toast = useToast();
  const c = cases.find(x => x.id === caseId) as Case | undefined;
  const last = latestQc(qcChecks, caseId);
  const [items, setItems] = useState<QcItem[]>(() => DEFAULT_QC_ITEMS.map((label, i) => ({ id: `q${i + 1}`, label, ok: false, note: '' })));
  const [extra, setExtra] = useState('');
  const [notes, setNotes] = useState('');
  if (!c) return null;

  const docs = c.documents || [];
  const verified = docs.filter(d => d.status === 'Verified').length;
  const failed = items.filter(i => !i.ok);
  const set = (id: string, patch: Partial<QcItem>) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  function save() {
    const bad = items.filter(i => !i.ok);
    if (bad.some(i => !(i.note || '').trim())) { toast('Write what is wrong next to each unticked point'); return; }
    const rec: QcCheck = {
      id: genId('qc'), caseId, date: today(), at: new Date().toISOString(), reviewerId: who.id, reviewerName: who.name,
      result: bad.length ? 'Failed' : 'Passed', items: items.map(i => ({ ...i, note: i.ok ? undefined : (i.note || '').trim() })), notes: notes.trim(),
    };
    setQcChecks(prev => [...prev, rec]);
    logActivity(`Quality check ${rec.result.toLowerCase()} — ${c!.name} (${who.name})`);
    toast(rec.result === 'Passed' ? 'Passed — the file can go to the manager' : `Failed — ${bad.length} point(s) to fix`);
    onSaved?.(rec);
    onClose();
  }

  return (
    <>
      <ModalTitle>Quality check — {c.name}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3">
        {c.destination} · {c.visaType || 'visa'} · stage: {c.caseStage} · documents verified: <b>{verified} of {docs.length}</b>
        {last && <> · last check: <b>{last.result}</b> ({fmtDate(last.date)}, {last.reviewerName})</>}
      </div>
      <div className="text-[12.5px] mb-2">Tick each point that is correct. For anything not ticked, write what is wrong — the file only passes when every point is ticked.</div>
      <div className="flex flex-col gap-2 mb-3">
        {items.map(i => (
          <div key={i.id} className="rounded-lg p-2.5" style={{ border: '1px solid var(--line)', background: i.ok ? 'var(--green-50)' : '#fff' }}>
            <label className="!mb-0 text-[13px] !text-[var(--ink)]">
              <input type="checkbox" checked={i.ok} onChange={e => set(i.id, { ok: e.target.checked })} />
              <span>{i.label}</span>
            </label>
            {!i.ok && <input className="mt-2" placeholder="What is wrong, or what is missing?" value={i.note || ''} onChange={e => set(i.id, { note: e.target.value })} />}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mb-3 items-end">
        <Field label="Add your own point (optional)"><input value={extra} onChange={e => setExtra(e.target.value)} placeholder="e.g. Sponsor letter notarised" /></Field>
        <div className="mb-3"><button className="btn btn-sm" onClick={() => { if (!extra.trim()) return; setItems(prev => [...prev, { id: genId('qi'), label: extra.trim(), ok: false, note: '' }]); setExtra(''); }}>Add point</button></div>
      </div>
      <Field label="Notes for the file (optional)"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <div className="text-[13px] mb-1" style={{ color: failed.length ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
        {failed.length ? `${failed.length} point(s) not ticked — this will be recorded as FAILED` : 'Every point ticked — this will be recorded as PASSED'}
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save check</button>
      </ModalFoot>
    </>
  );
}

function QcCheckView({ check, caseRec, onClose }: { check: QcCheck; caseRec?: Case; onClose: () => void }) {
  return (
    <>
      <ModalTitle>{caseRec?.name || 'File'} — quality check</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3 flex items-center gap-2 flex-wrap"><Stamp text={check.result} /> by {check.reviewerName} on {fmtDate(check.date)}</div>
      <div className="flex flex-col gap-1.5 mb-3">
        {check.items.map(i => (
          <div key={i.id} className="text-[13px]" style={{ color: i.ok ? 'var(--ink)' : 'var(--red)' }}>
            {i.ok ? '✓' : '✗'} {i.label}
            {!i.ok && i.note && <div className="text-[12px] ml-4" style={{ color: 'var(--red)' }}>→ {i.note}</div>}
          </div>
        ))}
      </div>
      {check.notes && <div className="text-[13px] mb-3"><b>Notes:</b> {check.notes}</div>}
      <ModalFoot><button className="btn btn-primary" onClick={onClose}>Close</button></ModalFoot>
    </>
  );
}
