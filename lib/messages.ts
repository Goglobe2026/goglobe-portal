import type { Session, TeamMessage } from './types';

// 'ceo' for the Head Manager, otherwise the team member's own id.
export function myMessageId(session: Session | null): string {
  if (!session) return '';
  return session.type === 'ceo' ? 'ceo' : session.staffId;
}

export function unreadFor(messages: TeamMessage[], me: string): number {
  return messages.filter(m => m.to === me && !m.readAt).length;
}

export function threadWith(messages: TeamMessage[], me: string, other: string): TeamMessage[] {
  return messages
    .filter(m => (m.from === me && m.to === other) || (m.from === other && m.to === me))
    .sort((a, b) => a.at.localeCompare(b.at));
}
