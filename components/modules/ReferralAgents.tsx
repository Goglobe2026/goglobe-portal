'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, genId, today } from '@/lib/constants';
import { overallCharge } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { ReferralAgent } from '@/lib/types';

export function ReferralAgents() {
  const { referralAgents, setReferralAgents, cases, transactions, setTransactions, logActivity } = useAppData();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ReferralAgent | null>(null);
  const toast = useToast();

  function remove(id: string) {
    if (cases.some(c => c.referralAgentId === id)) { toast('This agent has linked cases — reassign or clear those first'); return; }
    setReferralAgents(prev => prev.filter(a => a.id !== id));
    toast('Agent removed');
  }

  return (
    <div>
      <SectionHead title="Referral agents" count={`${referralAgents.length} external partners`} action={
        <button className="btn btn-primary ml-auto" onClick={() => setShowNew(true)}>+ Add referral agent</button>
      } />
      <div className="card mb-3.5" style={{ background: 'var(--navy-50)' }}>
        <div className="text-[12.5px]" style={{ color: 'var(--navy)' }}>
          For clients sourced directly by an outside agent rather than through your own leads. Commission is calculated on <b>net profit</b> (overall charges minus the cost to execute the case) — not gross revenue — at whatever rate you agree per agent. Set it up per case from that case&apos;s file.
        </div>
      </div>

      {!referralAgents.length ? (
        <EmptyState title="No referral agents yet" body="Add an outside agent who brings you clients directly, and set their commission rate." />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
          {referralAgents.map(a => {
            const linkedCases = cases.filter(c => c.referralAgentId === a.id);
            const totalNetProfit = linkedCases.reduce((s, c) => s + Math.max(0, overallCharge(c) - c.costToExecute), 0);
            const totalEarned = linkedCases.reduce((s, c) => s + Math.round(Math.max(0, overallCharge(c) - c.costToExecute) * (c.referralCommissionPercent / 100)), 0);
            const totalPaid = linkedCases.reduce((s, c) => s + (c.referralCommissionPaid || 0), 0);
            const totalDue = Math.max(0, totalEarned - totalPaid);
            return (
              <div key={a.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-display font-semibold text-[15px]">{a.name}</div>
                    <div className="text-[var(--muted)] text-xs">{a.phone}</div>
                  </div>
                  <span className="font-mono-ui text-xs text-[var(--faint)]">{a.defaultCommissionPercent}% default</span>
                </div>
                {a.notes && <div className="text-[12.5px] text-[var(--muted)] mt-2 italic">{a.notes}</div>}
                <div className="pt-2.5 mt-2.5 border-t" style={{ borderColor: 'var(--line)' }}>
                  <Row label="Cases sourced" value={String(linkedCases.length)} />
                  <Row label="Total net profit generated" value={money(totalNetProfit)} />
                  <Row label="Commission earned" value={money(totalEarned)} />
                  <Row label="Already paid" value={money(totalPaid)} last />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[13px] font-medium">Due now</span>
                    <span className="font-mono-ui font-semibold" style={{ color: totalDue > 0 ? 'var(--gold)' : 'var(--green)' }}>{money(totalDue)}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="btn btn-sm flex-1" onClick={() => setEditing(a)}>Edit</button>
                    <button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(a.id)}>Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showNew || !!editing} onClose={() => { setShowNew(false); setEditing(null); }}>
        <AgentForm agent={editing} onClose={() => { setShowNew(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between text-[12.5px] ${last ? 'mb-0' : 'mb-1.5'}`}>
      <span className="text-[var(--muted)]">{label}</span><span className="font-mono-ui">{value}</span>
    </div>
  );
}

function AgentForm({ agent, onClose }: { agent: ReferralAgent | null; onClose: () => void }) {
  const { setReferralAgents } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(agent?.name || ''); const [phone, setPhone] = useState(agent?.phone || '');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState(agent?.defaultCommissionPercent || 50);
  const [notes, setNotes] = useState(agent?.notes || '');

  function save() {
    if (!name.trim()) { toast('Enter a name'); return; }
    if (agent) {
      setReferralAgents(prev => prev.map(a => a.id === agent.id ? { ...a, name, phone, defaultCommissionPercent, notes } : a));
      toast('Agent updated');
    } else {
      setReferralAgents(prev => [...prev, { id: genId('ra'), name, phone, defaultCommissionPercent, notes, createdAt: today() }]);
      toast('Agent added');
    }
    onClose();
  }

  return (
    <>
      <ModalTitle>{agent ? 'Edit referral agent' : 'Add referral agent'}</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Default commission (% of net profit)"><input type="number" value={defaultCommissionPercent} onChange={e => setDefaultCommissionPercent(Number(e.target.value))} /></Field>
      <Field label="Notes"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="How you know them, what they usually send" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{agent ? 'Save changes' : 'Add agent'}</button>
      </ModalFoot>
    </>
  );
}
