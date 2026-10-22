/**
 * Server-side AI-generated responsive redesign.
 *
 * Generates a static HTML + CSS preview of an improved interface using the
 * configured AI provider (Ollama or OpenAI). The output is sanitized to remove
 * scripts and event handlers before it is returned to the client, and it is
 * rendered inside a sandboxed iframe so arbitrary AI-generated JavaScript can
 * never execute.
 */

import { getAiConfig, getAiRuntimeStatus } from "@/lib/ai";
import { callOllamaChat, getOllamaBaseUrl } from "@/lib/ollama";
import { extractJsonContent } from "@/lib/jsonExtraction";
import { generateDemoRedesign, measureImage } from "@/lib/demoProvider";
import type { AnalysisFinding, RedesignPayload } from "@/lib/types";

export interface RedesignOptions {
  imageDataUrl: string;
  findings?: AnalysisFinding[];
  originalWidth: number;
  originalHeight: number;
}

const REDESIGN_SYSTEM_PROMPT = [
  "You are Interface Doctor AI, a senior UI/UX designer and frontend developer.",
  "Create a responsive webpage redesign inspired by the provided screenshot.",
  "Respond with ONLY valid JSON matching this exact shape:",
  '{"html":"string","css":"string","description":"string","improvements":["string",...]}',
  "Rules:",
  "- The 'html' value must be a single self-contained fragment (no <html>, <head>, or <body> tags).",
  "- Use only semantic HTML and CSS. No JavaScript, no <script> tags, no inline event handlers (onclick, onload, etc.).",
  "- The 'css' value must be plain CSS scoped to the redesign (e.g. wrap selectors in .idr-redesign).",
  "- Make the layout responsive: use flexbox/grid and relative units so it works from 320px to 1200px.",
  "- Preserve the original purpose/content where visible; improve hierarchy, spacing, typography, contrast, and consistency.",
  "- The redesign should look like a polished, modern webpage mockup, not a long document.",
  "- improvements should list 3-5 concrete improvements over the original screenshot.",
  "- Do not invent measurements, accessibility test results, or numerical scores.",
].join(" ");

function buildUserPrompt(options: RedesignOptions): string {
  const { findings, originalWidth, originalHeight } = options;
  const base = `Design an improved version of the interface in the screenshot. The original dimensions are ${originalWidth}×${originalHeight}px.`;
  if (!findings || findings.length === 0) return base;

  const points = findings
    .slice(0, 6)
    .map(
      (f) =>
        `- ${f.title} (${f.severity}): ${f.suggestion || f.explanation}`,
    )
    .join("\n");

  return `${base}\n\nAddress these diagnosed issues where applicable:\n${points}`;
}

export async function runRedesignGeneration(
  options: RedesignOptions,
): Promise<RedesignPayload> {
  const runtimeStatus = getAiRuntimeStatus();
  if (!runtimeStatus.configured) {
    throw new Error(
      `AI provider is not configured. ${runtimeStatus.message}`,
    );
  }

  const config = getAiConfig();
  if (config.provider === "openai" && !config.apiKey) {
    throw new Error("OPENAI_API_KEY is required when using OpenAI.");
  }

  if (config.provider === "demo") {
    const metrics = await measureImage(options.imageDataUrl);
    return generateDemoRedesign(
      metrics,
      options.originalWidth,
      options.originalHeight,
    );
  }

  const imageMatch = options.imageDataUrl.match(
    /^data:image\/[^;]+;base64,(.+)$/s,
  );
  if (!imageMatch) {
    throw new Error(
      "The supplied screenshot is not a valid base64 image data URL.",
    );
  }

  let rawContent: string;

  if (config.provider === "ollama") {
    try {
      rawContent = await callOllamaChat(getOllamaBaseUrl(), config.model, {
        systemPrompt: REDESIGN_SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(options),
        imageBase64: imageMatch[1],
        numPredict: 1_600,
        jsonMode: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    }
  } else if (config.provider === "openai") {
    let response: Response;
    try {
      response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          signal: AbortSignal.timeout(120_000),
          body: JSON.stringify({
            model: config.model,
            max_tokens: 1600,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: REDESIGN_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: buildUserPrompt(options) },
                  {
                    type: "image_url",
                    image_url: { url: options.imageDataUrl },
                  },
                ],
              },
            ],
          }),
        },
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const message = detail.toLowerCase().includes("timeout")
        ? "The OpenAI redesign request timed out. Try again with a smaller screenshot or check the connection."
        : "Could not reach OpenAI. Check the network connection and try again.";
      throw new Error(message);
    }

    if (!response.ok) {
      let detail = "";
      try {
        const errorPayload = (await response.json()) as {
          error?: { message?: string };
        };
        detail = errorPayload.error?.message || "";
      } catch {
        // Provider did not return a readable error body.
      }

      if (response.status === 429) {
        throw new Error(
          "The AI provider rate limit was reached. Wait a moment and try again.",
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Authentication failed. Check that OPENAI_API_KEY is set correctly and is valid.",
        );
      }
      if (response.status === 400) {
        throw new Error(
          `The AI provider rejected the request (model or format error). ${detail}`.trim(),
        );
      }
      throw new Error(
        `AI provider returned HTTP ${response.status}. ${detail}`.trim(),
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("The AI provider returned an empty redesign response.");
    }
    rawContent = extractJsonContent(content);
  } else {
    throw new Error(`Unsupported AI provider: ${config.provider}.`);
  }

  const parsed = parseRedesignPayload(rawContent);
  return {
    html: sanitizeHtml(parsed.html),
    css: sanitizeCss(parsed.css),
    description: sanitizeText(parsed.description),
    improvements: sanitizeImprovements(parsed.improvements),
  };
}

function parseRedesignPayload(content: string): RedesignPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonContent(content));
  } catch {
    throw new Error("The AI redesign response was not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The AI redesign response was not a JSON object.");
  }

  const p = parsed as Record<string, unknown>;
  if (typeof p.html !== "string" || typeof p.css !== "string") {
    throw new Error("The AI redesign response is missing html or css.");
  }

  const improvements = Array.isArray(p.improvements)
    ? p.improvements.filter((item): item is string => typeof item === "string")
    : [];

  return {
    html: p.html,
    css: p.css,
    description:
      typeof p.description === "string" ? p.description : "",
    improvements,
  };
}

function sanitizeHtml(html: string): string {
  return (
    html
      // Remove <script> elements and their contents.
      .replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        "",
      )
      // Remove javascript: URLs.
      .replace(/\s*javascript\s*:\s*/gi, "")
      // Remove inline event handlers.
      .replace(
        /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|`[^`]*`|[^\s>]*)/gi,
        "",
      )
      // Remove meta refresh / CSP meta tags for safety.
      .replace(/<meta\b[^>]*>/gi, "")
      // Remove <base> tags that could change relative URLs.
      .replace(/<base\b[^>]*>/gi, "")
      // Remove external resource links.
      .replace(/<link\b[^>]*>/gi, "")
      // Remove iframe/embed/object tags to prevent nested execution contexts.
      .replace(
        /<(iframe|embed|object)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi,
        "",
      )
      // Remove forms; the iframe is sandboxed without forms, but defense in depth is cheap.
      .replace(
        /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
        "",
      )
      // Remove embedded <style> blocks; CSS belongs in the css field only.
      .replace(
        /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
        "",
      )
      // Remove document-level tags so the fragment can be safely embedded.
      .replace(/<!doctype\b[^>]*>/gi, "")
      .replace(/<!DOCTYPE\b[^>]*>/gi, "")
      .replace(/<\/?html\b[^>]*>/gi, "")
      .replace(/<\/?head\b[^>]*>/gi, "")
      .replace(/<\/?body\b[^>]*>/gi, "")
      .trim()
  );
}

function sanitizeCss(css: string): string {
  // Remove @import and expression() to block external resources and IE expressions,
  // and break out of any embedded <style> tags that could terminate the CSP block.
  return css
    .replace(/@import\s+[^;]+;/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/<\/?style\b/gi, "")
    .trim();
}

function sanitizeText(text: string): string {
  return text.trim();
}

function sanitizeImprovements(improvements: string[]): string[] {
  return improvements.map((i) => i.trim()).filter(Boolean).slice(0, 8);
}
