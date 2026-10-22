"use client";

import type { ComparisonResult, FindingCategory, Severity } from "@/lib/types";
import { CATEGORY_LABELS, FINDING_CATEGORIES } from "@/lib/types";

interface MetricsPanelProps {
  metrics: ComparisonResult | null;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
        <p className="text-sm text-ink-600">
          Generate a redesign to see measurable before-and-after results.
        </p>
      </div>
    );
  }

  const { before, after, summary } = metrics;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-700">{summary}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard title="Before — original diagnosis">
          <MetricRow label="Total findings" value={before.totalFindings} />
          <SeverityBars counts={before.bySeverity} />
          {before.topCategory && (
            <p className="mt-3 text-xs text-ink-500">
              Most common category: <span className="font-medium text-ink-700">{before.topCategory}</span>
            </p>
          )}
        </MetricCard>

        <MetricCard title="After — redesign verification">
          <MetricRow label="Verification issues" value={after.totalIssues} />
          <MetricRow label="Documented improvements" value={after.improvementsCount} />
          <MetricRow
            label="Responsive score"
            value={after.responsiveScore === null ? "—" : `${after.responsiveScore}/100`}
          />
          <MetricRow label="Contrast issues" value={after.contrastIssues} />
          <MetricRow label="Typography issues" value={after.typographyIssues} />
          <MetricRow label="Accessibility issues" value={after.accessibilityIssues} />
          <MetricRow label="Overflow risks" value={after.overflowRisks} />
          <SeverityBars counts={after.bySeverity} />
        </MetricCard>
      </div>

      <RemainingCategories counts={after.remainingByCategory} />
    </div>
  );
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

function SeverityBars({ counts }: { counts: Record<Severity, number> }) {
  return (
    <div className="mt-3 space-y-1.5">
      {SEVERITY_ORDER.map((severity) => {
        const count = counts[severity];
        const max = Math.max(1, ...SEVERITY_ORDER.map((s) => counts[s]));
        const pct = max ? (count / max) * 100 : 0;
        return (
          <div key={severity} className="flex items-center gap-3 text-xs">
            <span className="w-14 shrink-0 font-medium capitalize text-ink-600">{severity}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className={`h-full rounded-full ${severityColor(severity)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-ink-700">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-red-600";
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-amber-500";
    case "low":
      return "bg-sky-500";
  }
}

function RemainingCategories({ counts }: { counts: Record<FindingCategory, number> }) {
  const entries = FINDING_CATEGORIES.map((c) => [c, counts[c]] as const).filter(
    ([, count]) => count > 0,
  );
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-ink-900">Remaining issues by category</h4>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map(([category, count]) => (
          <div key={category} className="flex items-center justify-between text-sm">
            <span className="text-ink-600">{CATEGORY_LABELS[category]}</span>
            <span className="font-medium text-ink-900">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
