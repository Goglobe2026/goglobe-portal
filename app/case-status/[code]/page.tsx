import { getCaseStatusData } from '@/lib/case-verify';
import { LOGO_FULL } from '@/lib/logo';
import { FeedbackForm } from '@/components/ui/FeedbackForm';

const STAGES = ['Assessment', 'Documents', 'Manager Review', 'Appointment Booking', 'Submitted', 'Interview', 'Decision'];

export default async function CaseStatusPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = getCaseStatusData(code);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: '#F2F8F5' }}>
        <div className="card text-center" style={{ maxWidth: 440 }}>
          <img src={LOGO_FULL} alt="GoGlobe Consultants" className="w-40 max-w-[70%] h-auto mx-auto mb-4" />
          <b className="block font-display text-lg mb-2">Reference not found</b>
          <p className="text-[var(--muted)] text-sm">This code doesn&apos;t match any case in our system. Double-check the code and try again, or contact GoGlobe Consultant directly.</p>
        </div>
      </div>
    );
  }

  const stageIndex = STAGES.indexOf(data.caseStage);
  const statusColor: Record<string, string> = {
    Active: 'var(--blue)', Approved: 'var(--green)', Refused: 'var(--red)', Closed: 'var(--faint)',
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F2F8F5' }}>
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <div className="rounded-t-2xl px-6 py-6 text-center text-white" style={{ background: 'linear-gradient(165deg,#14213D 0%,#1B3358 100%)' }}>
          <img src={LOGO_FULL} alt="GoGlobe Consultants" style={{ width: 220, maxWidth: '80%', height: 'auto', margin: '0 auto' }} />
        </div>

        <div className="bg-white px-6 py-6">
          <div className="rounded-lg px-4 py-3 mb-5 flex items-center gap-2" style={{ background: 'var(--green-50)' }}>
            <span style={{ color: 'var(--green)' }}>✓</span>
            <span className="text-[13.5px] font-medium" style={{ color: 'var(--green)' }}>Verified case — currently active in the GoGlobe Consultant system.</span>
          </div>

          <div className="flex justify-between text-[12.5px] mb-5">
            <div><div className="text-[var(--muted)] uppercase text-[10.5px] font-semibold">Reference</div><div className="font-mono-ui mt-0.5">{data.referenceCode}</div></div>
            <div className="text-right"><div className="text-[var(--muted)] uppercase text-[10.5px] font-semibold">Status</div><div className="font-medium mt-0.5" style={{ color: statusColor[data.status] || 'var(--blue)' }}>{data.status}</div></div>
          </div>

          <h1 className="font-display text-lg font-semibold mb-1">{data.clientName}</h1>
          <p className="text-[13.5px] text-[var(--muted)] mb-5">{data.destination} · {data.visaType} visa application</p>

          <div className="text-[12px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-3">Where things stand</div>
          <div className="mb-6">
            {STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-none text-[11px] font-semibold"
                  style={{
                    background: i < stageIndex ? 'var(--green)' : i === stageIndex ? 'var(--navy)' : 'var(--line)',
                    color: i <= stageIndex ? '#fff' : 'var(--faint)',
                  }}>
                  {i < stageIndex ? '✓' : i + 1}
                </div>
                <span className="text-[13px]" style={{ fontWeight: i === stageIndex ? 600 : 400, color: i === stageIndex ? 'var(--ink)' : 'var(--muted)' }}>{stage}</span>
                {i === stageIndex && <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--navy-50)', color: 'var(--navy)' }}>Current</span>}
              </div>
            ))}
          </div>

          {data.documentsTotal > 0 && (
            <div className="mb-6">
              <div className="text-[12px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-2">Documents</div>
              <div className="rounded-lg h-3 overflow-hidden mb-1.5" style={{ background: 'var(--navy-50)' }}>
                <div className="h-full rounded-lg" style={{ width: `${(data.documentsVerified / data.documentsTotal) * 100}%`, background: 'linear-gradient(90deg,var(--navy),var(--navy-light))' }} />
              </div>
              <div className="text-[12px] text-[var(--muted)]">{data.documentsVerified} of {data.documentsTotal} documents verified</div>
            </div>
          )}

          <FeedbackForm referenceCode={data.referenceCode} />

          <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--line)' }}>
            <p className="text-[11px] text-[var(--faint)] mb-1">© {new Date().getFullYear()} GoGlobe Consultant. Private case status portal.</p>
            <p className="text-[11px] font-medium" style={{ color: 'var(--red)' }}>This document is not a visa, immigration approval, government authorization, airline ticket, or embassy-issued document.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
