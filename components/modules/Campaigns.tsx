'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

export function Campaigns() {
  const { campaigns, setCampaigns, leads } = useAppData();
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  return (
    <div>
      <SectionHead title="Campaign performance" count={`${campaigns.length} total`} action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowNew(true)}>+ Add campaign</button>
      } />
      {!campaigns.length ? (
        <EmptyState title="No campaigns yet" body="Track an ad or outreach campaign to see cost per lead and per conversion." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Campaign</th><th>Platform</th><th>Started</th><th>Spend</th><th>Leads</th><th>Closed / lost</th><th>Cost/lead</th><th>Cost/close</th></tr></thead>
            <tbody>
              {campaigns.map(cp => {
                const camLeads = leads.filter(l => l.campaign === cp.name);
                const closed = camLeads.filter(l => l.stage === 'Converted').length;
                const lost = camLeads.filter(l => l.stage === 'Lost').length;
                const cpl = camLeads.length ? Math.round(cp.spend / camLeads.length) : 0;
                const cpc = closed ? Math.round(cp.spend / closed) : 0;
                return (
                  <tr key={cp.id}>
                    <td className="font-medium">{cp.name}</td><td>{cp.platform}</td>
                    <td className="font-mono-ui text-xs">{fmtDate(cp.startDate)}</td>
                    <td className="font-mono-ui text-xs">{money(cp.spend)}</td>
                    <td className="font-mono-ui text-xs">{camLeads.length}</td>
                    <td className="font-mono-ui text-xs">{closed} / {lost}</td>
                    <td className="font-mono-ui text-xs">{cpl ? money(cpl) : '—'}</td>
                    <td className="font-mono-ui text-xs">{cpc ? money(cpc) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <ModalTitle>New campaign</ModalTitle>
        <NewCampaignForm onClose={() => setShowNew(false)} />
      </Modal>
    </div>
  );
}

function NewCampaignForm({ onClose }: { onClose: () => void }) {
  const { setCampaigns } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(''); const [platform, setPlatform] = useState('Facebook');
  const [spend, setSpend] = useState(0); const [startDate, setStartDate] = useState(today());

  function save() {
    if (!name.trim()) { toast('Enter a campaign name'); return; }
    setCampaigns(prev => [...prev, { id: genId('cp'), name, platform, spend, startDate }]);
    toast('Campaign added');
    onClose();
  }

  return (
    <>
      <Field label="Campaign name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. UK Tourist Visa — August" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <select value={platform} onChange={e => setPlatform(e.target.value)}>
            {['Facebook', 'Instagram', 'WhatsApp Business', 'Google Ads', 'TikTok', 'Other'].map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Spend so far (PKR)"><input type="number" value={spend} onChange={e => setSpend(Number(e.target.value))} /></Field>
      </div>
      <Field label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save campaign</button>
      </ModalFoot>
    </>
  );
}
