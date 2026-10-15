'use client';
import { useAppData } from '@/lib/AppDataContext';
import { money, today } from '@/lib/constants';
import { caseCharge, casePaid } from '@/lib/finance';

export interface HeroStat { label: string; value: string }

// The two or three live numbers shown in the banner of a screen.
export function useHeroStats(tab: string): HeroStat[] {
  const { leads, cases, appointments, team, requests, complaints, groupTours, tourMembers, referralAgents, testimonials, announcements, qcChecks, leadSources } = useAppData();
  const todayStr = today();
  const open = (l: { stage: string }) => !['Converted', 'Lost'].includes(l.stage);
  const dueLeads = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && open(l)).length;
  const monthKey = todayStr.slice(0, 7);

  switch (tab) {
    case 'leads':
    case 'coach':
      return [
        { label: 'Follow-ups due', value: String(dueLeads) },
        { label: 'New today', value: String(leads.filter(l => (l.createdAt || '') === todayStr).length) },
        { label: 'Open leads', value: String(leads.filter(open).length) },
      ];
    case 'leadsources':
      return [{ label: 'Lead forms', value: String(leadSources.length) }, { label: 'Leads today', value: String(leads.filter(l => l.createdAt === todayStr).length) }];
    case 'cases':
      return [
        { label: 'Active', value: String(cases.filter(c => c.status === 'Active').length) },
        { label: 'In manager review', value: String(cases.filter(c => c.caseStage === 'Manager Review').length) },
        { label: 'Opened this month', value: String(cases.filter(c => (c.closedDate || c.createdAt || '').slice(0, 7) === monthKey).length) },
      ];
    case 'appointments':
      return [
        { label: 'Coming up', value: String(appointments.filter(a => a.date >= todayStr && a.status === 'Scheduled').length) },
        { label: 'Today', value: String(appointments.filter(a => a.date === todayStr).length) },
      ];
    case 'referralagents':
      return [{ label: 'Partners', value: String(referralAgents.length) }, { label: 'Referred files', value: String(cases.filter(c => c.referralAgentId).length) }];
    case 'complaints':
      return [{ label: 'Open', value: String(complaints.filter(c => c.status !== 'Resolved').length) }, { label: 'Total', value: String(complaints.length) }];
    case 'grouptours':
      return [{ label: 'Tours', value: String(groupTours.length) }, { label: 'Travellers', value: String(tourMembers.length) }];
    case 'hr':
      return [
        { label: 'Team members', value: String(team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active').length) },
        { label: 'Requests waiting', value: String(requests.filter(r => r.status === 'Pending').length) },
      ];
    case 'announcements':
      return [{ label: 'Notices', value: String(announcements.length) }];
    case 'testimonials':
      return [{ label: 'Stories', value: String(testimonials.length) }];
    case 'qc':
      return [{ label: 'Checks done', value: String(qcChecks.length) }];
    case 'billing': {
      const owed = cases.filter(c => c.status !== 'Refused').reduce((s, c) => s + Math.max(0, caseCharge(c) - casePaid(c)), 0);
      return [{ label: 'Clients still owe', value: money(owed) }, { label: 'Files with a balance', value: String(cases.filter(c => c.status !== 'Refused' && caseCharge(c) - casePaid(c) > 0).length) }];
    }
    default:
      return [];
  }
}

