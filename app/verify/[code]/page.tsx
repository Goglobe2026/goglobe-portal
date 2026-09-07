import { getVerificationData } from '@/lib/verify';
import { fmtDate } from '@/lib/constants';
import { LOGO_FULL } from '@/lib/logo';

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = getVerificationData(code);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: '#F2F8F5' }}>
        <div className="card text-center" style={{ maxWidth: 440 }}>
          <img src={LOGO_FULL} alt="GoGlobe Consultants" className="w-40 max-w-[70%] h-auto mx-auto mb-4" />
          <b className="block font-display text-lg mb-2">Reference not found</b>
          <p className="text-[var(--muted)] text-sm">This code doesn&apos;t match any registration in our system. Double-check the code and try again, or contact GoGlobe Consultant directly.</p>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    Registered: 'var(--blue)', 'Partially Paid': 'var(--gold)', 'Fully Paid': 'var(--green)',
    'Documentation Complete': 'var(--green)', 'Travel Confirmed': 'var(--green)', Cancelled: 'var(--red)',
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F2F8F5' }}>
      <div className="mx-auto" style={{ maxWidth: 640 }}>
        <div className="rounded-t-2xl px-6 py-6 text-center text-white" style={{ background: 'linear-gradient(165deg,#14213D 0%,#1B3358 100%)' }}>
          <img src={LOGO_FULL} alt="GoGlobe Consultants" className="w-48 max-w-[75%] h-auto mx-auto mb-3" />
          <div className="font-display text-xl font-semibold">GoGlobe Consultant</div>
          <div className="text-[12.5px] opacity-80 mt-0.5">Guiding Journeys, Building Trust.</div>
        </div>

        <div className="bg-white px-6 py-6">
          <div className="rounded-lg px-4 py-3 mb-5 flex items-center gap-2" style={{ background: 'var(--green-50)' }}>
            <span style={{ color: 'var(--green)' }}>✓</span>
            <span className="text-[13.5px] font-medium" style={{ color: 'var(--green)' }}>Verified registration — currently active in the GoGlobe Consultant system.</span>
          </div>

          <div className="flex justify-between text-[12.5px] mb-5">
            <div><div className="text-[var(--muted)] uppercase text-[10.5px] font-semibold">Date checked</div><div className="font-medium mt-0.5">{fmtDate(new Date().toISOString().slice(0, 10))}</div></div>
            <div className="text-right"><div className="text-[var(--muted)] uppercase text-[10.5px] font-semibold">Reference</div><div className="font-mono-ui mt-0.5">{data.referenceCode}</div></div>
          </div>

          {data.tour && (
            <>
              <h1 className="font-display text-lg font-semibold mb-2">{data.tour.name}</h1>
              <p className="text-[13.5px] text-[var(--ink)] leading-relaxed mb-5">
                GoGlobe Consultant confirms that <b>{data.memberName}</b> holds an active registration for this group tour to <b>{data.tour.destination}</b>,
                departing <b>{fmtDate(data.tour.startDate)}</b> and returning <b>{fmtDate(data.tour.endDate)}</b>.
              </p>
            </>
          )}

          <div className="mb-5">
            <div className="text-[12px] text-[var(--muted)] mb-1">This registration&apos;s status</div>
            <span className="stamp" style={{ color: statusColor[data.status] || 'var(--blue)', background: 'transparent', borderColor: 'currentColor' }}>
              <span className="stamp-dot" />{data.status}
            </span>
          </div>

          <div className="text-[12px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-2">Confirmed group members travelling together</div>
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
            {data.groupMembers.map((m, i) => (
              <div key={i} className="flex justify-between items-center px-3.5 py-2.5" style={{ borderBottom: i < data.groupMembers.length - 1 ? '1px solid var(--line)' : 'none', background: m.isThisRecord ? 'var(--navy-50)' : 'transparent' }}>
                <div>
                  <div className="text-[13px] font-medium">{m.name}{m.isThisRecord && <span className="text-[11px] font-normal text-[var(--muted)]"> (this record)</span>}</div>
                  <div className="font-mono-ui text-[11px] text-[var(--muted)]">{m.referenceCode}</div>
                </div>
                <span className="text-[11.5px] font-medium" style={{ color: statusColor[m.status] || 'var(--blue)' }}>{m.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--line)' }}>
            <p className="text-[11px] text-[var(--faint)] mb-1">© {new Date().getFullYear()} GoGlobe Consultant. Private group tour registration &amp; verification portal.</p>
            <p className="text-[11px] font-medium" style={{ color: 'var(--red)' }}>This document is not a visa, immigration approval, government authorization, airline ticket, or embassy-issued document.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
