/** Client-side verification heuristics for AI-generated redesigns.
 *
 * These checks run against the sanitized HTML/CSS output. They are intentionally
 * conservative: only report what can be measured, label everything else as a
 * manual review, and never claim a redesign is fully accessible or responsive. */

import {
  type RedesignPayload,
  type Severity,
  type VerificationFinding,
  type VerificationReport,
  type VerificationSummary,
} from "@/lib/types";

const AA_CONTRAST_THRESHOLD = 4.5;

export function runVerification(redesign: RedesignPayload): VerificationReport {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return emptyReport();
  }

  try {
    const doc = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>${redesign.html}</body></html>`,
      "text/html",
    );
    const body = doc.body;
    if (!body || body.children.length === 0) {
      return emptyReport();
    }

    const findings: VerificationFinding[] = [];
    const cssState = analyzeCss(redesign.css);

    checkContrast(body, cssState, findings);
    checkSemanticStructure(body, findings);
    checkTypography(cssState, findings);
    checkResponsive(cssState, findings);
    checkFocusIndicators(cssState, findings);
    addManualReviewFindings(findings);

    const summary = buildSummary(findings, cssState);
    return { status: "ok", findings, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      message: `Verification could not run: ${message}`,
      findings: [],
      summary: buildSummary([], emptyCssState()),
    };
  }
}

function emptyReport(): VerificationReport {
  return { status: "empty", findings: [], summary: buildSummary([], emptyCssState()) };
}

interface CssState {
  mediaQueryCount: number;
  imgMaxWidth100: boolean;
  focusStylesPresent: boolean;
  overflowRisks: string[];
  lowContrastPairs: string[];
  typographyIssues: string[];
  rules: CSSStyleRule[];
}

function emptyCssState(): CssState {
  return {
    mediaQueryCount: 0,
    imgMaxWidth100: false,
    focusStylesPresent: false,
    overflowRisks: [],
    lowContrastPairs: [],
    typographyIssues: [],
    rules: [],
  };
}

function analyzeCss(css: string): CssState {
  const state = emptyCssState();
  if (typeof CSSStyleSheet === "undefined" || !css.trim()) return state;

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    collectRules(sheet.cssRules, state);
  } catch {
    // Malformed CSS does not block other checks.
  }
  return state;
}

function collectRules(rules: CSSRuleList, state: CssState): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      state.rules.push(rule);
      inspectStyleRule(rule, state);
    } else if (rule instanceof CSSMediaRule) {
      state.mediaQueryCount += 1;
      collectRules(rule.cssRules, state);
    }
  }
}

function inspectStyleRule(rule: CSSStyleRule, state: CssState): void {
  const style = rule.style;
  const selector = rule.selectorText || "";

  // Contrast
  const color = style.getPropertyValue("color");
  const bg = style.getPropertyValue("background-color");
  if (color && bg) {
    const ratio = contrastRatio(color, bg);
    if (ratio && ratio < AA_CONTRAST_THRESHOLD) {
      const key = `${selector}|${color}|${bg}`;
      if (!state.lowContrastPairs.includes(key)) {
        state.lowContrastPairs.push(key);
      }
    }
  }

  // Overflow / responsive
  const width = style.getPropertyValue("width");
  const minWidth = style.getPropertyValue("min-width");
  const whiteSpace = style.getPropertyValue("white-space");
  const maxWidth = style.getPropertyValue("max-width");

  const widthPx = parsePx(width);
  const minWidthPx = parsePx(minWidth);
  if (
    (widthPx && widthPx > 768) ||
    (minWidthPx && minWidthPx > 360) ||
    (whiteSpace === "nowrap" && widthPx && widthPx > 320)
  ) {
    if (!maxWidth || maxWidth === "none") {
      const key = `${selector}|${width || ""}|${minWidth || ""}|${whiteSpace || ""}`;
      if (!state.overflowRisks.includes(key)) state.overflowRisks.push(key);
    }
  }

  if (
    selector.toLowerCase().includes("img") &&
    (maxWidth === "100%" || width === "100%")
  ) {
    state.imgMaxWidth100 = true;
  }

  if (/:(focus|focus-visible|focus-within)\b/i.test(selector)) {
    state.focusStylesPresent = true;
  }

  // Typography
  const fontSize = style.getPropertyValue("font-size");
  const lineHeight = style.getPropertyValue("line-height");
  const fsPx = parsePx(fontSize);
  if (fsPx && fsPx < 12) {
    const key = `${selector}|font-size:${fontSize}`;
    if (!state.typographyIssues.includes(key)) state.typographyIssues.push(key);
  }
  const lh = parseFloat(lineHeight);
  if (lineHeight && !Number.isNaN(lh) && lh > 0 && lh < 1.2) {
    const key = `${selector}|line-height:${lineHeight}`;
    if (!state.typographyIssues.includes(key)) state.typographyIssues.push(key);
  }
}

function checkContrast(
  body: HTMLElement,
  state: CssState,
  findings: VerificationFinding[],
): void {
  for (const key of state.lowContrastPairs) {
    const [selector, color, bg] = key.split("|");
    const ratio = contrastRatio(color, bg);
    if (!ratio) continue;
    findings.push({
      id: crypto.randomUUID(),
      severity: ratio < 3 ? "critical" : ratio < 4.5 ? "high" : "medium",
      category: "color-contrast",
      title: `Low contrast in "${selector}"`,
      explanation: `The declared text color (${color}) against the background (${bg}) has an estimated contrast ratio of ${ratio.toFixed(2)}:1, below the WCAG AA target of ${AA_CONTRAST_THRESHOLD}:1.`,
      recommendation:
        "Increase the color contrast to at least 4.5:1 for normal text. Use a contrast checker to verify the final computed colors.",
      automated: true,
    });
  }

  // Inline styles
  body.querySelectorAll("[style]").forEach((el) => {
    const htmlEl = el as HTMLElement;
    const color = htmlEl.style.getPropertyValue("color");
    const bg = htmlEl.style.getPropertyValue("background-color");
    if (color && bg) {
      const ratio = contrastRatio(color, bg);
      if (ratio && ratio < AA_CONTRAST_THRESHOLD) {
        findings.push({
          id: crypto.randomUUID(),
          severity: ratio < 3 ? "critical" : ratio < 4.5 ? "high" : "medium",
          category: "color-contrast",
          title: "Low contrast from inline style",
          explanation: `An inline style declares a text/background combination with an estimated contrast ratio of ${ratio.toFixed(
            2,
          )}:1.`,
          recommendation:
            "Move the color pair to a class and verify the contrast ratio with a real contrast tool.",
          automated: true,
        });
      }
    }
  });
}

function checkSemanticStructure(body: HTMLElement, findings: VerificationFinding[]): void {
  const images = body.querySelectorAll("img");
  images.forEach((img) => {
    if (!img.hasAttribute("alt") && img.getAttribute("aria-hidden") !== "true") {
      findings.push({
        id: crypto.randomUUID(),
        severity: "medium",
        category: "accessibility",
        title: "Image missing alternative text",
        explanation:
          "An <img> element does not have an alt attribute. Decorative images should use alt=\"\" or aria-hidden=\"true\".",
        recommendation:
          'Add descriptive alt text for informative images, or alt="" for purely decorative images.',
        automated: true,
      });
    }
  });

  const headings = Array.from(body.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  let previousLevel = 0;
  let previousHeading: Element | null = null;
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1], 10);
    if (previousLevel && level > previousLevel + 1) {
      findings.push({
        id: crypto.randomUUID(),
        severity: "medium",
        category: "accessibility",
        title: "Heading level skipped",
        explanation: `The document jumps from an <${
          previousHeading?.tagName ?? "h?"
        }> to an <${heading.tagName}> without the intermediate level.`,
        recommendation:
          "Use heading levels sequentially so screen-reader users can navigate the outline.",
        automated: true,
      });
    }
    previousLevel = level;
    previousHeading = heading;
  });

  const interactive = Array.from(
    body.querySelectorAll("button, a, [role='button'], [role='link']"),
  );
  interactive.forEach((el) => {
    const text = (el.textContent || "").trim();
    const ariaLabel = el.getAttribute("aria-label");
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    const title = el.getAttribute("title");
    if (!text && !ariaLabel && !ariaLabelledBy && !title) {
      findings.push({
        id: crypto.randomUUID(),
        severity: "high",
        category: "accessibility",
        title: "Interactive element without accessible name",
        explanation:
          "A button or link has no visible text and no aria-label/title, so assistive technologies cannot announce its purpose.",
        recommendation:
          "Add visible text, an aria-label, or an aria-labelledby reference.",
        automated: true,
      });
    }
  });

  const formControls = Array.from(
    body.querySelectorAll("input, select, textarea"),
  );
  formControls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const type = htmlEl.getAttribute("type");
    if (type === "hidden" || type === "submit" || type === "button") return;
    const id = htmlEl.id;
    const ariaLabel = htmlEl.getAttribute("aria-label");
    const ariaLabelledBy = htmlEl.getAttribute("aria-labelledby");
    const hasLabel =
      id && htmlEl.ownerDocument.querySelector(`label[for="${id}"]`);
    if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
      findings.push({
        id: crypto.randomUUID(),
        severity: "medium",
        category: "accessibility",
        title: "Form control missing label",
        explanation:
          "An input, select, or textarea has no associated <label> and no aria-label/aria-labelledby.",
        recommendation:
          "Associate a <label for=\"...\"> with the control or add an aria-label.",
        automated: true,
      });
    }
  });
}

function checkTypography(state: CssState, findings: VerificationFinding[]): void {
  for (const key of state.typographyIssues) {
    const [selector, declaration] = key.split("|");
    const isFontSize = declaration.startsWith("font-size");
    findings.push({
      id: crypto.randomUUID(),
      severity: isFontSize ? "high" : "medium",
      category: "typography-readability",
      title: isFontSize ? "Very small font size" : "Tight line height",
      explanation: isFontSize
        ? `The rule "${selector}" sets a font size below 12 px, which may be hard to read on mobile devices.`
        : `The rule "${selector}" sets a line height below 1.2, which can reduce readability for longer text.`,
      recommendation: isFontSize
        ? "Use relative units (rem) and keep body text at least 1 rem (16 px)."
        : "Use a line height of at least 1.5 for body text.",
      automated: true,
    });
  }
}

function checkResponsive(state: CssState, findings: VerificationFinding[]): void {
  for (const key of state.overflowRisks) {
    const [selector] = key.split("|");
    findings.push({
      id: crypto.randomUUID(),
      severity: "medium",
      category: "responsive-design",
      title: "Potential horizontal overflow risk",
      explanation: `The rule "${selector}" uses a fixed width or nowrap layout that may clip or scroll on narrow viewports.`,
      recommendation:
        "Prefer max-width: 100%, flex-wrap, or media queries so the layout adapts to small screens.",
      automated: true,
    });
  }

  if (state.mediaQueryCount === 0) {
    findings.push({
      id: crypto.randomUUID(),
      severity: "low",
      category: "responsive-design",
      title: "No CSS media queries detected",
      explanation:
        "The generated CSS does not contain any @media rules. The layout may not adapt gracefully across mobile, tablet, and desktop widths.",
      recommendation:
        "Add media queries to reflow columns, adjust font sizes, and resize containers for different viewports.",
      automated: true,
    });
  }

  if (!state.imgMaxWidth100) {
    findings.push({
      id: crypto.randomUUID(),
      severity: "low",
      category: "responsive-design",
      title: "Images may not scale down",
      explanation:
        "No rule was found that sets images to max-width: 100%. Large images could overflow their containers on small screens.",
      recommendation:
        "Add img { max-width: 100%; height: auto; } to keep images responsive.",
      automated: true,
    });
  }
}

function checkFocusIndicators(state: CssState, findings: VerificationFinding[]): void {
  if (state.focusStylesPresent) return;
  findings.push({
    id: crypto.randomUUID(),
    severity: "medium",
    category: "accessibility",
    title: "No visible focus styles detected",
    explanation:
      "The generated CSS does not include :focus, :focus-visible, or :focus-within rules. Keyboard users may not see which element is focused.",
    recommendation:
      "Add a clear :focus-visible outline or box-shadow to interactive elements.",
    automated: true,
  });
}

function addManualReviewFindings(findings: VerificationFinding[]): void {
  findings.push({
    id: crypto.randomUUID(),
    severity: "high",
    category: "accessibility",
    title: "Manual review: keyboard navigation",
    explanation:
      "Automated checks cannot verify tab order, focus traps, or custom-keyboard behavior. Test the real page with only a keyboard.",
    recommendation:
      "Tab through every interactive element and confirm focus order matches the visual order.",
    automated: false,
  });

  findings.push({
    id: crypto.randomUUID(),
    severity: "medium",
    category: "color-contrast",
    title: "Manual review: color-blind accessibility",
    explanation:
      "Contrast ratios are estimated from declared colors only. Meaning conveyed only by color (e.g., red/green status) must also use icons, labels, or patterns.",
    recommendation:
      "Simulate common color-vision deficiencies and ensure information is not lost.",
    automated: false,
  });
}

function buildSummary(findings: VerificationFinding[], state: CssState): VerificationSummary {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  let automated = 0;
  let manual = 0;
  let contrastIssues = 0;
  let typographyIssues = 0;
  let accessibilityIssues = 0;

  for (const f of findings) {
    bySeverity[f.severity] += 1;
    if (f.automated) automated += 1;
    else manual += 1;
    if (f.category === "color-contrast") contrastIssues += 1;
    if (f.category === "typography-readability") typographyIssues += 1;
    if (f.category === "accessibility") accessibilityIssues += 1;
  }

  let responsiveScore = 50;
  if (state.mediaQueryCount > 0) responsiveScore += 20;
  if (state.imgMaxWidth100) responsiveScore += 10;
  if (state.overflowRisks.length === 0) responsiveScore += 10;
  if (state.focusStylesPresent) responsiveScore += 10;
  responsiveScore = Math.max(0, Math.min(100, responsiveScore));

  return {
    total: findings.length,
    bySeverity,
    automated,
    manual,
    responsiveScore,
    contrastIssues,
    typographyIssues,
    accessibilityIssues,
    overflowRisks: state.overflowRisks.length,
  };
}

function parsePx(value: string): number | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)\s*px$/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

function contrastRatio(colorA: string, colorB: string): number | null {
  const c1 = parseColor(colorA);
  const c2 = parseColor(colorB);
  if (!c1 || !c2) return null;
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let colorProbe: HTMLDivElement | null = null;

function parseColor(value: string): { r: number; g: number; b: number } | null {
  if (!value || value === "transparent" || value === "none") return null;

  if (!colorProbe) {
    colorProbe = document.createElement("div");
    colorProbe.style.position = "fixed";
    colorProbe.style.visibility = "hidden";
    colorProbe.style.pointerEvents = "none";
    document.body.appendChild(colorProbe);
  }

  colorProbe.style.color = "black";
  colorProbe.style.color = value;
  const computed = getComputedStyle(colorProbe).color;
  if (!computed || computed === "rgba(0, 0, 0, 0)") return null;

  const rgb = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return null;
  return {
    r: parseInt(rgb[1], 10),
    g: parseInt(rgb[2], 10),
    b: parseInt(rgb[3], 10),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
