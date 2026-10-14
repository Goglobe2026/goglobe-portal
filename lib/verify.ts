import { readCollection } from './store';

function maskName(n: string) {
  const parts = n.trim().split(/\s+/);
  return parts.map(p => p.length <= 2 ? p : p[0] + '*'.repeat(p.length - 1)).join(' ');
}
function maskCode(c: string) {
  return c.length <= 4 ? c : c.slice(0, -4).replace(/./g, '*') + c.slice(-4);
}

export function getVerificationData(code: string) {
  const members = readCollection('tourmembers');
  const member = members.find(m => m.referenceCode === code);
  if (!member) return null;

  const tours = readCollection('grouptours');
  const tour = tours.find(t => t.id === member.tourId);
  const groupMembers = members.filter(m => m.tourId === member.tourId);

  return {
    referenceCode: member.referenceCode,
    memberName: member.name,
    status: member.status,
    bookingDate: member.bookingDate,
    tour: tour ? {
      name: tour.name,
      destination: tour.destination,
      startDate: tour.startDate,
      endDate: tour.endDate,
      planPdf: tour.planPdf || '',
      planPdfName: tour.planPdfName || '',
    } : null,
    groupMembers: groupMembers.map(m => ({
      referenceCode: m.referenceCode === code ? m.referenceCode : maskCode(m.referenceCode),
      name: m.referenceCode === code ? m.name : maskName(m.name),
      status: m.status,
      isThisRecord: m.referenceCode === code,
    })),
  };
}
