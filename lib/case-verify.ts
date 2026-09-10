import { readCollection } from './store';

export function getCaseStatusData(code: string) {
  const cases = readCollection('cases');
  const c = cases.find(x => x.referenceCode === code);
  if (!c) return null;

  const verifiedDocs = c.documents.filter(d => d.status === 'Verified').length;

  // Deliberately minimal — no phone, no fees, no discount, no internal
  // consultant name. Just enough for a client to feel confident their case
  // is real and see how far along it is.
  return {
    referenceCode: c.referenceCode,
    clientName: c.name,
    destination: c.destination,
    visaType: c.visaType,
    caseStage: c.caseStage,
    status: c.status,
    documentsVerified: verifiedDocs,
    documentsTotal: c.documents.length,
  };
}
