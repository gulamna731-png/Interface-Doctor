"use client";

import { useMemo } from "react";
import type { RedesignPayload } from "@/lib/types";

interface SafeHtmlPreviewProps {
  redesign: RedesignPayload;
  title?: string;
  /** Approximate aspect ratio used to size the preview container. */
  aspectRatio?: number;
  className?: string;
}

/**
 * Render an AI-generated redesign inside a sandboxed iframe.
 *
 * The iframe has an empty sandbox (no scripts, no forms, no popups) and a
 * restrictive Content Security Policy. The HTML and CSS are server-sanitized
 * before they reach the client, so arbitrary JavaScript cannot execute.
 */
export function SafeHtmlPreview({
  redesign,
  title,
  aspectRatio = 4 / 3,
  className,
}: SafeHtmlPreviewProps) {
  const srcDoc = useMemo(() => buildSrcDoc(redesign), [redesign]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-ink-200 bg-white ${className ?? ""}`}
      style={{ aspectRatio: `${aspectRatio}` }}
    >
      <iframe
        title={title || "AI-generated redesign preview"}
        srcDoc={srcDoc}
        sandbox=""
        className="h-full w-full pointer-events-none"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function buildSrcDoc({ html, css }: RedesignPayload): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body { margin:0; padding:0; min-height:100%; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  ${css}
</style>
</head>
<body>
<div class="idr-redesign">
${html}
</div>
</body>
</html>`;
}
