/** Measurable before-and-after metrics.
 *
 * These functions compare the original diagnosis with the verification results
 * for the generated redesign. They use real counts from those two sources and
 * do not fabricate scores. */

import {
  CATEGORY_LABELS,
  FINDING_CATEGORIES,
  type AnalysisFinding,
  type AfterMetrics,
  type BeforeMetrics,
  type ComparisonResult,
  type FindingCategory,
  type RedesignPayload,
  type Severity,
  type VerificationReport,
  type VerificationSummary,
} from "@/lib/types";

export function computeBeforeMetrics(findings: AnalysisFinding[]): BeforeMetrics {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byCategory: Record<FindingCategory, number> = {
    "visual-hierarchy": 0,
    "spacing-alignment": 0,
    "typography-readability": 0,
    "color-contrast": 0,
    accessibility: 0,
    "component-consistency": 0,
    "navigation-usability": 0,
    "responsive-design": 0,
    other: 0,
  };

  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byCategory[f.category] += 1;
  }

  const top = Object.entries(byCategory)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
    topCategory: top ? CATEGORY_LABELS[top[0] as FindingCategory] : null,
  };
}

export function computeAfterMetrics(
  report: VerificationReport,
  redesign: RedesignPayload,
): AfterMetrics {
  const summary: VerificationSummary =
    report.status === "ok" || report.status === "empty"
      ? report.summary
      : {
          total: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          automated: 0,
          manual: 0,
          responsiveScore: null,
          contrastIssues: 0,
          typographyIssues: 0,
          accessibilityIssues: 0,
          overflowRisks: 0,
        };

  const remainingByCategory: Record<FindingCategory, number> = {
    "visual-hierarchy": 0,
    "spacing-alignment": 0,
    "typography-readability": 0,
    "color-contrast": 0,
    accessibility: 0,
    "component-consistency": 0,
    "navigation-usability": 0,
    "responsive-design": 0,
    other: 0,
  };

  if (report.status === "ok") {
    for (const f of report.findings) {
      remainingByCategory[f.category] += 1;
    }
  }

  return {
    totalIssues: summary.total,
    bySeverity: summary.bySeverity,
    contrastIssues: summary.contrastIssues,
    typographyIssues: summary.typographyIssues,
    accessibilityIssues: summary.accessibilityIssues,
    responsiveScore: summary.responsiveScore,
    overflowRisks: summary.overflowRisks,
    improvementsCount: redesign.improvements.length,
    remainingByCategory,
  };
}

export function compareMetrics(
  before: BeforeMetrics,
  after: AfterMetrics,
): ComparisonResult {
  const remainingIssues = after.totalIssues;
  const improvementsCount = after.improvementsCount;

  const summary =
    improvementsCount > 0
      ? `The redesign documents ${improvementsCount} intended improvement${
          improvementsCount === 1 ? "" : "s"
        }. Automated verification found ${remainingIssues} issue${
          remainingIssues === 1 ? "" : "s"
        } to review before the redesign can be considered polished. These numbers are counts, not a guarantee that every original issue is fixed.`
      : `Automated verification found ${remainingIssues} issue${
          remainingIssues === 1 ? "" : "s"
        } in the generated redesign. No improvement list was provided.`;

  return {
    before,
    after,
    improvementsCount,
    remainingIssues,
    summary,
  };
}
