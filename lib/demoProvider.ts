/**
 * Self-contained demo/heuristic AI provider.
 *
 * Performs real, measurable checks on the uploaded screenshot without any
 * external AI service, and generates a real responsive HTML/CSS redesign
 * clearly labeled as heuristic output.
 */

import { randomUUID } from "node:crypto";
import { measureImage, type DemoImageMetrics } from "@/lib/demoMetrics";
import type { AnalysisFinding, FindingCategory, RedesignPayload, Severity } from "@/lib/types";

const fullRegion = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };

function addFinding(
  findings: AnalysisFinding[],
  title: string,
  severity: Severity,
  category: FindingCategory,
  explanation: string,
  suggestion: string,
): void {
  findings.push({
    id: randomUUID(),
    title,
    severity,
    category,
    explanation,
    suggestion,
    confidence: 0.7,
    region: fullRegion,
  });
}

export function generateDemoFindings(metrics: DemoImageMetrics): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  if (metrics.width < 360 || metrics.height < 360) {
    addFinding(
      findings,
      "Low-resolution screenshot",
      "medium",
      "responsive-design",
      `The image is only ${metrics.width}×${metrics.height}px, which is smaller than many common viewports. Text and controls may be hard to read or interact with.`,
      "Use a higher-resolution screenshot (at least 720px in the smaller dimension) so details are legible.",
    );
  }

  if (metrics.aspectRatio > 2.4 || metrics.aspectRatio < 0.42) {
    addFinding(
      findings,
      "Unusual aspect ratio",
      "low",
      "responsive-design",
      `The screenshot has an aspect ratio of ${metrics.aspectRatio.toFixed(2)}, which is far from common device ratios. A layout tuned for this shape may not adapt well to phones or tablets.`,
      "Test the design on standard phone, tablet, and desktop viewports, and use a responsive grid.",
    );
  }

  if (metrics.fileSizeBytes > 2 * 1024 * 1024) {
    addFinding(
      findings,
      "Large screenshot file",
      "low",
      "other",
      `The upload is ${(metrics.fileSizeBytes / 1024 / 1024).toFixed(1)} MB, which increases transfer time and processing cost.`,
      "Re-export the screenshot as a compressed JPEG or PNG before uploading.",
    );
  }

  if (metrics.brightnessMean < 55) {
    addFinding(
      findings,
      "Very dark interface",
      "high",
      "accessibility",
      `Most of the image is dark (average brightness ${Math.round(metrics.brightnessMean)}/255). Important elements may be hard to see in bright environments.`,
      "Increase luminance for key UI elements and ensure interactive items have clear boundaries.",
    );
  } else if (metrics.brightnessMean > 220) {
    addFinding(
      findings,
      "Very bright, low-contrast interface",
      "medium",
      "color-contrast",
      `The image is very bright (average brightness ${Math.round(metrics.brightnessMean)}/255), which can wash out subtle borders and reduce perceived hierarchy.`,
      "Add stronger tonal contrast between backgrounds, cards, and text.",
    );
  }

  if (metrics.darkPixelRatio > 0.45 && metrics.brightnessMean < 100) {
    addFinding(
      findings,
      "Predominantly dark tones",
      "medium",
      "color-contrast",
      "More than 45% of the screenshot is very dark. Light text or subtle accents may fail contrast checks.",
      "Check text contrast against dark backgrounds and avoid relying on faint dividers.",
    );
  }

  if (metrics.brightnessStd < 28) {
    addFinding(
      findings,
      "Low tonal contrast",
      "high",
      "color-contrast",
      `The brightness standard deviation is only ${Math.round(metrics.brightnessStd)}, indicating a flat, low-contrast image.`,
      "Increase contrast between foreground and background, and use stronger color differentiation for interactive elements.",
    );
  }

  if (metrics.busynessScore > 65) {
    addFinding(
      findings,
      "Visually busy layout",
      "medium",
      "visual-hierarchy",
      `The edge-density estimate is high (busyness score ${metrics.busynessScore}/100), suggesting many small competing elements.`,
      "Group related items, add whitespace, and reduce the number of distinct visual styles on screen.",
    );
  }

  if (findings.length < 3) {
    addFinding(
      findings,
      "Limited visual separation",
      "low",
      "spacing-alignment",
      "The screenshot has only a few detectable tonal regions, which can make the layout feel undifferentiated.",
      "Use spacing, cards, or dividers to create clearer sections and guide attention.",
    );
  }

  const severityRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return findings.slice(0, 6).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function generateDemoRedesign(
  metrics: DemoImageMetrics,
  originalWidth: number,
  originalHeight: number,
): RedesignPayload {
  const improvements: string[] = [
    "Responsive layout with CSS Grid and Flexbox that adapts from 320px to 1200px.",
    "Consistent spacing scale and clear visual hierarchy.",
    "High-contrast, accessible color palette with WCAG-friendly text tones.",
  ];

  if (metrics.brightnessStd < 28 || metrics.brightnessMean < 55 || metrics.brightnessMean > 220) {
    improvements.push("Stronger tonal contrast for better readability.");
  }
  if (metrics.busynessScore > 65) {
    improvements.push("Cleaner grouping and more whitespace to reduce visual clutter.");
  }
  if (metrics.width < 360 || metrics.height < 360) {
    improvements.push("Larger touch targets and scalable typography for small screens.");
  }

  const description =
    "Heuristic demo redesign: a clean, modern responsive layout generated from image metrics without an external AI model.";

  const aspectClass = metrics.aspectRatio > 1.2 ? " idr-wide" : "";

  const html = `
<div class="idr-redesign${aspectClass}">
  <header class="idr-header">
    <div class="idr-logo">Brand</div>
    <nav class="idr-nav" aria-label="Primary">
      <a href="#">Features</a>
      <a href="#">Pricing</a>
      <a href="#">About</a>
      <a href="#" class="idr-btn">Get started</a>
    </nav>
  </header>
  <main>
    <section class="idr-hero">
      <h1>Clearer design, better results</h1>
      <p>This responsive redesign addresses the issues detected in the ${originalWidth}×${originalHeight}px screenshot.</p>
      <div class="idr-actions">
        <a href="#" class="idr-btn idr-btn-primary">Start now</a>
        <a href="#" class="idr-btn idr-btn-secondary">Learn more</a>
      </div>
    </section>
    <section class="idr-features">
      <article class="idr-card">
        <h2>Clean hierarchy</h2>
        <p>Important actions and headings are sized and spaced to guide the eye first.</p>
      </article>
      <article class="idr-card">
        <h2>Readable contrast</h2>
        <p>Text and interactive elements sit on backgrounds with comfortable tonal separation.</p>
      </article>
      <article class="idr-card">
        <h2>Flexible layout</h2>
        <p>The grid reflows automatically across mobile, tablet, and desktop viewports.</p>
      </article>
    </section>
  </main>
  <footer class="idr-footer">
    <p>Generated by Interface Doctor AI · Demo heuristic provider</p>
  </footer>
</div>
`.trim();

  const css = `
.idr-redesign {
  --bg: #f8fafc;
  --surface: #ffffff;
  --ink: #0f172a;
  --muted: #475569;
  --brand: #2563eb;
  --brand-600: #1d4ed8;
  --border: #e2e8f0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--ink);
  background: var(--bg);
  line-height: 1.55;
}
.idr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem clamp(1rem, 4vw, 2.5rem);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.idr-logo { font-weight: 800; font-size: 1.25rem; }
.idr-nav { display: flex; align-items: center; gap: clamp(0.75rem, 2vw, 1.5rem); flex-wrap: wrap; }
.idr-nav a { color: var(--muted); text-decoration: none; font-size: 0.95rem; }
.idr-nav a:hover { color: var(--ink); }
.idr-hero {
  padding: clamp(2.5rem, 8vw, 5rem) clamp(1rem, 4vw, 2.5rem);
  text-align: center;
  max-width: 65ch;
  margin: 0 auto;
}
.idr-hero h1 { font-size: clamp(1.75rem, 5vw, 3rem); margin: 0 0 1rem; line-height: 1.15; }
.idr-hero p { font-size: clamp(1rem, 2.5vw, 1.25rem); color: var(--muted); margin: 0 0 1.5rem; }
.idr-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.idr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid transparent;
}
.idr-btn-primary { background: var(--brand); color: #fff; }
.idr-btn-primary:hover { background: var(--brand-600); }
.idr-btn-secondary { background: #fff; color: var(--ink); border-color: var(--border); }
.idr-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
  padding: 0 clamp(1rem, 4vw, 2.5rem) clamp(2.5rem, 6vw, 4rem);
  max-width: 1200px;
  margin: 0 auto;
}
.idr-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.idr-card h2 { font-size: 1.125rem; margin: 0 0 0.5rem; }
.idr-card p { color: var(--muted); margin: 0; }
.idr-footer {
  padding: 1.5rem clamp(1rem, 4vw, 2.5rem);
  text-align: center;
  color: var(--muted);
  font-size: 0.875rem;
  border-top: 1px solid var(--border);
}
`.trim();

  return { html, css, description, improvements: improvements.slice(0, 6) };
}

export { measureImage };
