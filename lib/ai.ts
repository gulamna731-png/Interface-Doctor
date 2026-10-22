/**
 * Server-side AI provider configuration and vision diagnosis call.
 *
 * Phase 4 scope: Ollama-first provider configuration with useful diagnostics
 * for missing models, connection failures, malformed responses, and oversized
 * images. No mock findings are ever returned.
 */

import { randomUUID } from "node:crypto";
import { callOllamaChat, getOllamaBaseUrl } from "@/lib/ollama";
import { extractJsonContent } from "@/lib/jsonExtraction";
import {
  CATEGORY_LABELS,
  FINDING_CATEGORIES,
  type AnalysisFinding,
  type FindingCategory,
  type Severity,
} from "@/lib/types";

export interface AiConfig {
  configured: boolean;
  provider: string;
  model: string;
  missing: string[];
  apiKey?: string;
}

export function getAiRuntimeStatus(): AiStatusResponse {
  const provider = (process.env.AI_PROVIDER || "ollama").trim().toLowerCase();
  const model = (process.env.AI_VISION_MODEL || "gemma3").trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  const supportedProvider = provider === "ollama" || provider === "openai";

  const variablesChecked = [
    "AI_PROVIDER",
    "AI_VISION_MODEL",
    "OPENAI_API_KEY",
    "OLLAMA_BASE_URL",
  ];

  // Ensure Ollama does not require OPENAI_API_KEY to be considered configured.
  if (provider === "ollama") {
    // no-op: Ollama does not require API keys; keep keyPresent true to reflect readiness.
  }

  if (!supportedProvider) {
    return {
      configured: false,
      provider,
      model,
      keyPresent: Boolean(apiKey),
      supportedProvider: false,
      status: "provider_unsupported",
      missing: ["AI_PROVIDER"],
      message:
        `Provider '${provider}' is not supported. ` +
        "Set AI_PROVIDER=ollama or AI_PROVIDER=openai.",
      diagnostics: { runtime: "nodejs", variablesChecked },
    };
  }

  if (provider === "openai" && !apiKey) {
    return {
      configured: false,
      provider,
      model,
      keyPresent: false,
      supportedProvider: true,
      status: "key_missing",
      missing: ["OPENAI_API_KEY"],
      message:
        "OPENAI_API_KEY is required when using OpenAI. " +
        "For local inference without an API key, use Ollama.",
      diagnostics: { runtime: "nodejs", variablesChecked },
    };
  }

  return {
    configured: true,
    provider,
    model,
    keyPresent: provider === "ollama" || Boolean(apiKey),
    supportedProvider: true,
    status: "ready",
    missing: [],
    message:
      provider === "ollama"
        ? "Ollama AI engine configured."
        : "OpenAI AI engine configured.",
    diagnostics: { runtime: "nodejs", variablesChecked },
  };
}

export function getAiConfig(): AiConfig {
  const runtime = getAiRuntimeStatus();

  return {
    configured: runtime.configured,
    provider: runtime.provider,
    model: runtime.model,
    missing: runtime.missing,
    apiKey:
      runtime.provider === "openai"
        ? process.env.OPENAI_API_KEY?.trim()
        : undefined,
  };
}

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "rate_limited"
      | "provider_error"
      | "invalid_response"
      | "network",
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

const CATEGORY_PROMPT_LIST = FINDING_CATEGORIES.map(
  (c) => `"${c}" — ${CATEGORY_LABELS[c]}`,
).join("; ");

const SYSTEM_PROMPT = [
  "You are Interface Doctor AI, a UI/UX design reviewer.",
  "Examine the provided website or app screenshot and identify concrete, visible interface problems.",
  "Focus on visual hierarchy, spacing and alignment, typography and readability, color contrast and accessibility,",
  "component consistency, navigation and usability, and obvious responsive-design concerns inferable from the screenshot.",
  "Respond with ONLY a JSON object of the shape:",
  '{"findings":[{"title":string,"severity":"critical"|"high"|"medium"|"low","category":"visual-hierarchy"|...,"explanation":string,',
  '"suggestion":string,"confidence":number(0-1),"region":{"x":number,"y":number,"width":number,"height":number}}]}.',
  `Available categories: ${CATEGORY_PROMPT_LIST}.`,
  "Region values are fractions (0-1) of image width and height locating the problem area.",
  "Width and height must be positive.",
  "Confidence is optional but should be a number between 0 and 1 when provided.",
  "Report at most 6 findings, ordered by severity: critical, high, medium, low.",
  "Only report issues visible in the screenshot.",
  "Do not invent measurements, accessibility test results, or numerical scores.",
].join(" ");

export async function runVisionDiagnosis(
  imageDataUrl: string,
  config: AiConfig,
): Promise<AnalysisFinding[]> {
  if (!config.configured) {
    throw new AiRequestError(
      `AI provider is not configured. Missing: ${
        config.missing.join(", ") || "valid provider configuration"
      }.`,
      "provider_error",
    );
  }

  let rawContent: string;

  if (config.provider === "ollama") {
    const imageMatch = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/s);
    if (!imageMatch) {
      throw new AiRequestError(
        "The supplied screenshot is not a valid base64 image data URL.",
        "invalid_response",
      );
    }

    try {
      rawContent = await callOllamaChat(getOllamaBaseUrl(), config.model, {
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: "Diagnose the interface problems in this screenshot.",
        imageBase64: imageMatch[1],
        numPredict: 1_500,
        jsonMode: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AiRequestError(message, classifyOllamaError(message));
    }
  } else if (config.provider === "openai") {
    if (!config.apiKey) {
      throw new AiRequestError("OPENAI_API_KEY is missing.", "provider_error");
    }

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Diagnose the interface problems in this screenshot.",
                },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });
    } catch {
      throw new AiRequestError(
        "Could not reach OpenAI. Check the network connection and try again.",
        "network",
      );
    }

    if (response.status === 429) {
      throw new AiRequestError(
        "The AI provider rate limit was reached. Wait a moment and try again.",
        "rate_limited",
      );
    }

    if (!response.ok) {
      let detail = "";
      try {
        const errorPayload = (await response.json()) as {
          error?: { message?: string };
        };
        detail = errorPayload.error?.message || "";
      } catch {
        // The provider did not return a readable error body.
      }

      if (response.status === 401 || response.status === 403) {
        throw new AiRequestError(
          "Authentication failed. Check that OPENAI_API_KEY is set correctly and is valid.",
          "provider_error",
        );
      }

      throw new AiRequestError(
        `${config.provider} returned HTTP ${response.status}.${
          detail ? ` ${detail}` : ""
        }`,
        "provider_error",
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiRequestError(
        "The AI provider returned an empty response.",
        "invalid_response",
      );
    }
    rawContent = extractJsonContent(content);
  } else {
    throw new AiRequestError(
      `Unsupported AI provider: ${config.provider}.`,
      "provider_error",
    );
  }

  return parseFindings(rawContent);
}

function classifyOllamaError(message: string): AiRequestError["kind"] {
  const lower = message.toLowerCase();
  if (
    lower.includes("could not reach") ||
    lower.includes("fetch failed") ||
    lower.includes("connect") ||
    lower.includes("econnrefused") ||
    lower.includes("socket") ||
    lower.includes("abort")
  ) {
    return "network";
  }
  if (
    lower.includes("not installed") ||
    lower.includes("not found") ||
    lower.includes("not supported") ||
    lower.includes("model") ||
    lower.includes("/api/tags")
  ) {
    return "provider_error";
  }
  if (
    lower.includes("json") ||
    lower.includes("empty response") ||
    lower.includes("findings") ||
    lower.includes("html") ||
    lower.includes("css")
  ) {
    return "invalid_response";
  }
  return "provider_error";
}

const VALID_SEVERITIES: readonly Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

function parseFindings(content: string): AnalysisFinding[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJsonContent(content));
  } catch {
    throw new AiRequestError(
      "The AI response was not valid JSON.",
      "invalid_response",
    );
  }

  const raw = (parsed as { findings?: unknown })?.findings;

  if (!Array.isArray(raw)) {
    throw new AiRequestError(
      "The AI response did not contain a findings list.",
      "invalid_response",
    );
  }

  const findings: AnalysisFinding[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const f = item as Record<string, unknown>;

    if (typeof f.title !== "string" || typeof f.explanation !== "string") {
      continue;
    }

    const category = parseCategory(f.category);
    const confidence = parseConfidence(f.confidence);
    const region = parseRegion(f.region);

    findings.push({
      id: randomUUID(),
      title: f.title,
      severity: VALID_SEVERITIES.includes(f.severity as Severity)
        ? (f.severity as Severity)
        : "medium",
      category,
      explanation: f.explanation,
      suggestion: typeof f.suggestion === "string" ? f.suggestion : "",
      confidence,
      region,
    });
  }

  if (findings.length === 0) {
    throw new AiRequestError(
      "The AI response contained no usable findings.",
      "invalid_response",
    );
  }

  const severityRank: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return findings.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );
}

function parseCategory(value: unknown): FindingCategory {
  if (typeof value !== "string") {
    return "other";
  }

  return (FINDING_CATEGORIES as readonly string[]).includes(value)
    ? (value as FindingCategory)
    : "other";
}

function parseConfidence(value: unknown): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    return undefined;
  }

  return value;
}

function parseRegion(
  value: unknown,
): AnalysisFinding["region"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const r = value as Record<string, unknown>;
  const nums = [r.x, r.y, r.width, r.height];

  if (
    !nums.every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  ) {
    return undefined;
  }

  const [x, y, width, height] = nums as number[];

  const inRange =
    x >= 0 &&
    x <= 1 &&
    y >= 0 &&
    y <= 1 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1 &&
    y + height <= 1;

  return inRange ? { x, y, width, height } : undefined;
}
