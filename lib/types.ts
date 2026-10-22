/** Shared types for the Interface Doctor AI client and API. */

export type Severity = "critical" | "high" | "medium" | "low";

export type FindingCategory =
  | "visual-hierarchy"
  | "spacing-alignment"
  | "typography-readability"
  | "color-contrast"
  | "accessibility"
  | "component-consistency"
  | "navigation-usability"
  | "responsive-design"
  | "other";

export const FINDING_CATEGORIES: readonly FindingCategory[] = [
  "visual-hierarchy",
  "spacing-alignment",
  "typography-readability",
  "color-contrast",
  "accessibility",
  "component-consistency",
  "navigation-usability",
  "responsive-design",
  "other",
];

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  "visual-hierarchy": "Visual hierarchy",
  "spacing-alignment": "Spacing & alignment",
  "typography-readability": "Typography & readability",
  "color-contrast": "Color & contrast",
  accessibility: "Accessibility",
  "component-consistency": "Component consistency",
  "navigation-usability": "Navigation & usability",
  "responsive-design": "Responsive design",
  other: "Other",
};

export interface FindingRegion {
  /** All values are fractions (0–1) of the screenshot's width/height. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnalysisFinding {
  id: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  explanation: string;
  suggestion: string;
  confidence?: number;
  region?: FindingRegion;
}

export type AnalyzeResult =
  | {
      status: "ok";
      findings: AnalysisFinding[];
      provider: string;
      model: string;
    }
  | {
      status: "ai_unconfigured";
      message: string;
      missing: string[];
    }
  | {
      status: "error";
      message: string;
    };

export interface RedesignPayload {
  /** Standalone HTML body content for the improved interface preview. */
  html: string;
  /** CSS that styles the redesign. Kept separate for validation and CSP. */
  css: string;
  /** Short human-readable summary of the redesign direction. */
  description: string;
  /** List of concrete improvements the redesign makes over the original. */
  improvements: string[];
}

export type RedesignResult =
  | { status: "ok"; redesign: RedesignPayload; provider: string; model: string }
  | { status: "ai_unconfigured"; message: string; missing: string[] }
  | { status: "error"; message: string };

/** A verification finding produced by automated heuristics or manual-review guidance. */
export interface VerificationFinding {
  id: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  explanation: string;
  recommendation: string;
  /** True when the check can be performed automatically by the app. */
  automated: boolean;
}

export interface VerificationSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  automated: number;
  manual: number;
  /** Heuristic 0-100 estimate; null when it cannot be computed. */
  responsiveScore: number | null;
  contrastIssues: number;
  typographyIssues: number;
  accessibilityIssues: number;
  overflowRisks: number;
}

export type VerificationReport =
  | { status: "ok"; findings: VerificationFinding[]; summary: VerificationSummary }
  | { status: "empty"; findings: []; summary: VerificationSummary }
  | { status: "error"; message: string; findings: []; summary: VerificationSummary };

export interface BeforeMetrics {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<FindingCategory, number>;
  topCategory: string | null;
}

export interface AfterMetrics {
  totalIssues: number;
  bySeverity: Record<Severity, number>;
  contrastIssues: number;
  typographyIssues: number;
  accessibilityIssues: number;
  responsiveScore: number | null;
  overflowRisks: number;
  improvementsCount: number;
  remainingByCategory: Record<FindingCategory, number>;
}

export interface ComparisonResult {
  before: BeforeMetrics;
  after: AfterMetrics;
  improvementsCount: number;
  remainingIssues: number;
  /** Honest, plain-language summary of what the numbers do and do not mean. */
  summary: string;
}

export type AiSupportStatus =
  | "ready"
  | "key_missing"
  | "provider_unsupported"
  | "ollama_unreachable"
  | "model_missing";

export interface AiStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  /** True when OPENAI_API_KEY (or the provider-specific key) is present in the server environment. */
  keyPresent: boolean;
  /** True when the configured provider is implemented by the application. */
  supportedProvider: boolean;
  status: AiSupportStatus;
  missing: string[];
  /** Human-readable, safe explanation of the current AI configuration state. */
  message: string;
  /** Safe runtime diagnostics — never includes the secret value. */
  diagnostics: {
    runtime: "nodejs";
    variablesChecked: string[];
    /** The Ollama base URL that the server will contact (no credentials). */
    ollamaBaseUrl?: string;
    /** Whether the Ollama /api/tags endpoint responded successfully. */
    ollamaReachable?: boolean;
    /** Whether the configured model appears in the list of installed Ollama models. */
    modelInstalled?: boolean;
    /** The exact installed model name the server will use in /api/chat (no secrets). */
    modelName?: string;
    /** A safe error hint when Ollama is unreachable or the model is missing. */
    modelError?: string;
  };
}

export interface ScreenshotSelection {
  /** Object URL or data URL used for <img> preview. */
  previewUrl: string;
  /** Data URL sent to the analyze API. */
  dataUrl: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  source: "upload" | "sample";
}
