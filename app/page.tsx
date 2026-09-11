'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { ToastProvider } from '@/components/ui/Toast';
import { LoginGate } from '@/components/shell/LoginGate';
import { Shell } from '@/components/shell/Shell';
import { Dashboard } from '@/components/modules/Dashboard';
import { Leads } from '@/components/modules/Leads';
import { Campaigns } from '@/components/modules/Campaigns';
import { Cases } from '@/components/modules/Cases';
import { Appointments } from '@/components/modules/Appointments';
import { Pricing } from '@/components/modules/Pricing';
import { HR } from '@/components/modules/HR';
import { Attendance } from '@/components/modules/Attendance';
import { Accounts } from '@/components/modules/Accounts';
import { Reports } from '@/components/modules/Reports';
import { Testimonials } from '@/components/modules/Testimonials';
import { ReferralAgents } from '@/components/modules/ReferralAgents';
import { GroupTours } from '@/components/modules/GroupTours';
import { MyPortal } from '@/components/modules/MyPortal';
import type { Lead } from '@/lib/types';

function PortalApp() {
  const { loading, connectionError, session, team } = useAppData();
  const [tab, setTab] = useState('dashboard');
  const [prefillLead, setPrefillLead] = useState<Lead | null>(null);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted)]">Loading…</div>;
  }
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="card max-w-md text-center">
          <b className="block font-display text-[15px] mb-2">Can&apos;t reach the server</b>
          <div className="text-[var(--muted)] text-sm">{connectionError}</div>
        </div>
      </div>
    );
  }
  if (!session) return <LoginGate />;

  const myTeamRecord = session.type === 'employee' ? team.find(t => t.id === session.staffId) : null;
  const isAdminEmployee = !!myTeamRecord?.isAdmin;

  if (session.type === 'employee' && !isAdminEmployee) {
    return (
      <Shell currentTab="myportal" onTabChange={() => {}}>
        <MyPortal />
      </Shell>
    );
  }

  function goToCasesWithLead(lead: Lead) {
    setPrefillLead(lead);
    setTab('cases');
  }

  return (
    <Shell
      currentTab={tab}
      onTabChange={setTab}
      topAction={tab !== 'cases' ? undefined : undefined}
    >
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'leads' && <Leads onConvert={goToCasesWithLead} />}
      {tab === 'campaigns' && <Campaigns />}
      {tab === 'cases' && <Cases prefillFromLead={prefillLead} clearPrefill={() => setPrefillLead(null)} />}
      {tab === 'appointments' && <Appointments />}
      {tab === 'pricing' && <Pricing />}
      {tab === 'hr' && <HR />}
      {tab === 'attendance' && <Attendance />}
      {tab === 'accounts' && <Accounts />}
      {tab === 'reports' && <Reports />}
      {tab === 'testimonials' && <Testimonials />}
      {tab === 'referralagents' && <ReferralAgents />}
      {tab === 'grouptours' && <GroupTours />}
    </Shell>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <PortalApp />
    </ToastProvider>
  );
}
