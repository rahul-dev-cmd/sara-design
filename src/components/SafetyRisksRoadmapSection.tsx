import React from 'react';
import { ExternalLink } from 'lucide-react';
import { SaraPartsData } from '../lib/saraData';
import { StatusBadge } from './StatusBadge';

interface SafetyRisksRoadmapSectionProps {
  data: SaraPartsData;
}

export const SafetyRisksRoadmapSection: React.FC<SafetyRisksRoadmapSectionProps> = ({ data }) => {
  return (
    <div id="safety-roadmap" className="relative z-20 bg-[#0b0f14]">
      {/* SECTION 9: SAFETY & FAIL-SAFES */}
      <section className="border-t border-white/10 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 text-xs text-[#9aa7b8]">
              <span>09. Safety &amp; Fail-Safes</span>
              <span aria-hidden="true">·</span>
              <StatusBadge status="PLANNED" />
              <span className="font-mono text-[11px] text-[#fbbf24]">UNTESTED</span>
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
              Designed to fail safely and pull out by hand
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#9aa7b8]">
              {data.safety.statusNote}
            </p>
          </div>

          <div className="mt-8 rounded-lg border border-white/10 bg-[#10161f] p-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#8a97a8]">
                  <th className="py-2.5 pr-4 font-medium">Failure Mode</th>
                  <th className="py-2.5 pr-4 font-medium">Hazard</th>
                  <th className="py-2.5 pr-4 font-medium">Fail-Safe (Planned, Untested)</th>
                  <th className="py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {data.safety.rows.map((row) => (
                  <tr key={row.failureMode}>
                    <td className="py-3 pr-4 font-medium text-white whitespace-nowrap">
                      {row.failureMode}
                    </td>
                    <td className="py-3 pr-4 text-[#fbbf24] whitespace-nowrap">{row.hazard}</td>
                    <td className="py-3 pr-4 text-[#cbd5e1]">{row.failsafe}</td>
                    <td className="py-3 text-right">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-[#10161f] p-5">
              <h3 className="font-display text-sm font-semibold text-white">Physical Fail-Safes</h3>
              <ul className="mt-2.5 space-y-1.5 text-xs text-[#cbd5e1]">
                {data.safety.physicalFailsafes.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#10161f] p-5">
              <h3 className="font-display text-sm font-semibold text-white">
                Standards &amp; Enclosure Honesty
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                Standards considered as guidance only: <strong className="text-white">IEC 62133</strong>{' '}
                (lithium cell safety) for the 18650 pack and{' '}
                <strong className="text-white">ISO 12100</strong> as a risk-check framework.{' '}
                <strong className="text-[#fbbf24]">
                  No certification claimed and no IP rating — the body is not sealed.
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: RISKS & BACKUP PLANS */}
      <section className="border-t border-white/10 bg-[#0d121a] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2.5 text-xs text-[#9aa7b8]">
                <span>10. Technical Risks &amp; Backup Plans</span>
                <span aria-hidden="true">·</span>
                <StatusBadge status="PLANNED" />
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
                Known engineering trade-offs before bench build
              </h2>
            </div>
            <div className="rounded border border-[#f59e0b]/45 bg-[#20180c] px-3.5 py-2 text-xs text-[#fcd34d]">
              FEA not done yet, planned for joint yokes and rear 4 mm PETG anchor.
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.risks.map((item) => (
              <div
                key={item.risk}
                className="rounded-lg border border-white/10 bg-[#111822] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-white">{item.risk}</h3>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#9aa7b8]">{item.detail}</p>
                </div>
                <div className="mt-4 border-t border-white/8 pt-3 text-xs leading-relaxed text-[#e8eef5]">
                  <span className="font-semibold text-[#ff7a1a]">Backup plan: </span>
                  {item.backup}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 11: 4-MONTH FABRICATION ROADMAP */}
      <section className="border-t border-white/10 bg-[#0b0f14] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 text-xs text-[#9aa7b8]">
              <span>11. Fabrication Roadmap</span>
              <span aria-hidden="true">·</span>
              <StatusBadge status="PLANNED" />
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
              Four months from parts order to rubble course demo
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.roadmap.map((step) => (
              <div
                key={step.date}
                className="rounded-lg border border-white/10 bg-[#111822] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#9aa7b8]">
                    <span>{step.month}</span>
                    <StatusBadge status={step.status} />
                  </div>
                  <div className="mt-1.5 font-mono text-lg font-semibold text-[#ff7a1a]">
                    {step.date}
                  </div>
                  <h3 className="mt-2 font-display text-sm font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">{step.tasks}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-[#ff7a1a]/40 bg-[#19130e] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-semibold text-[#ffb37b]">
                Stage 3 Target
              </span>
              <StatusBadge status="PLANNED" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white">{data.stage3Target}</p>
          </div>
        </div>
      </section>

      {/* SECTION 12: IMPACT & VISION */}
      <section className="border-t border-white/10 bg-[#0d121a] py-20 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2.5 text-xs text-[#9aa7b8]">
                <span>12. Impact &amp; Vision</span>
                <span aria-hidden="true">·</span>
                <StatusBadge status="PLANNED" />
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white [text-wrap:balance]">
                Built for search and rescue teams everywhere disasters strike
              </h2>
            </div>
            <div className="lg:col-span-7 space-y-4 text-[15px] leading-relaxed text-[#cbd5e1]">
              <p>
                With full resources and field validation beyond the student prototype stage,
                SARA&apos;s customers would be{' '}
                <strong className="text-white">
                  government disaster response agencies, fire services, and mine rescue units
                </strong>{' '}
                in every region affected by earthquakes, building collapses, or other natural
                disasters.
              </p>
              <p className="text-sm text-[#9aa7b8]">
                Because SARA is currently a planned design with no field trials yet, we do not
                publish invented deployment counts, saved-time percentages, or market projections.
                First bench and rubble-course measurements are scheduled for Dec 2026 – Feb 2027.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 13: HONEST FOOTER */}
      <footer className="border-t border-white/10 bg-[#080b0f] py-12">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            <div className="md:col-span-6 space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="font-display text-xl font-bold text-white">SARA</span>
                <StatusBadge status="PLANNED" />
              </div>
              <p className="text-xs leading-relaxed text-[#9aa7b8] max-w-lg">
                {data.project.fullName} · {data.project.award} · Application ID{' '}
                <span className="font-mono text-[#eef2f7]">{data.project.applicationId}</span>.
                This website presents a <strong className="text-white">planned design</strong>. No
                physical hardware has been built or bench-tested yet.
              </p>
              <p className="text-xs text-[#8a97a8]">{data.project.renderCredit}.</p>
            </div>

            <div className="md:col-span-3 space-y-1.5 text-xs">
              <div className="font-semibold text-white">Team</div>
              <p className="text-[#cbd5e1]">{data.project.team.join(', ')}</p>
              <p className="text-[#8a97a8]">{data.project.mentorNote}</p>
            </div>

            <div className="md:col-span-3 space-y-2 text-xs">
              <div className="font-semibold text-white">Repository</div>
              <a
                href={data.project.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[#ff7a1a] hover:underline break-all"
              >
                <span>github.com/rahul-dev-cmd/SARA</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
              <p className="text-[#8a97a8]">
                CAD script (CadQuery), STEP assembly, wiring schematic, pin sheet, BOM, FMEA.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
