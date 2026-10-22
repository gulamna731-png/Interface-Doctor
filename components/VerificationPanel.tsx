"use client";

import type { Severity, VerificationFinding, VerificationReport } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface VerificationPanelProps {
  report: VerificationReport;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-sky-50 text-sky-700 border-sky-200",
};

export function VerificationPanel({ report }: VerificationPanelProps) {
  if (report.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h4 className="text-sm font-semibold text-red-800">Verification could not run</h4>
        <p className="mt-1 text-sm text-red-700">{report.message}</p>
      </div>
    );
  }

  if (report.status === "empty") {
    return (
      <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
        <p className="text-sm text-ink-600">
          No redesign content was found, so verification checks cannot run.
        </p>
      </div>
    );
  }

  const { summary, findings } = report;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="Total" value={summary.total} />
        <SummaryBox label="Automated" value={summary.automated} />
        <SummaryBox label="Manual review" value={summary.manual} />
        <SummaryBox
          label="Responsive score"
          value={summary.responsiveScore === null ? "—" : `${summary.responsiveScore}/100`}
        />
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        These checks are heuristics run against the generated HTML and CSS. A clean result
        here does not replace real user testing, screen-reader testing, or manual design review.
      </p>

      {findings.length === 0 ? (
        <p className="text-sm text-ink-600">
          No verification findings were produced. This usually means the redesign output was
          minimal or could not be parsed.
        </p>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding) => (
            <FindingItem key={finding.id} finding={finding} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3 text-center">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function FindingItem({ finding }: { finding: VerificationFinding }) {
  return (
    <li className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[finding.severity]}`}
        >
          {finding.severity}
        </span>
        <span className="text-xs text-ink-500">{CATEGORY_LABELS[finding.category]}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            finding.automated
              ? "bg-brand-50 text-brand-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {finding.automated ? "Automated" : "Manual review"}
        </span>
      </div>
      <h5 className="mt-2 text-sm font-semibold text-ink-900">{finding.title}</h5>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">{finding.explanation}</p>
      <p className="mt-2 text-sm text-ink-700">
        <span className="font-medium text-brand-700">Recommendation: </span>
        {finding.recommendation}
      </p>
    </li>
  );
}
