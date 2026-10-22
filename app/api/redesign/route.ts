import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAiRuntimeStatus } from "@/lib/ai";
import { runRedesignGeneration } from "@/lib/redesign";
import type { AnalysisFinding, RedesignResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

interface RedesignRequestBody {
  image?: unknown;
  mimeType?: unknown;
  findings?: unknown;
  originalWidth?: unknown;
  originalHeight?: unknown;
}

/** POST /api/redesign — validate input and generate a safe responsive redesign. */
export async function POST(req: NextRequest): Promise<NextResponse<RedesignResult>> {
  let body: RedesignRequestBody;
  try {
    body = (await req.json()) as RedesignRequestBody;
  } catch {
    return NextResponse.json(
      { status: "error", message: "The request body was not valid JSON." },
      { status: 400 },
    );
  }

  const { image, mimeType, findings, originalWidth, originalHeight } = body;

  if (typeof mimeType !== "string" || !ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { status: "error", message: "Only PNG or JPG screenshots can be redesigned." },
      { status: 400 },
    );
  }
  if (typeof image !== "string" || !image.startsWith(`data:${mimeType};base64,`)) {
    return NextResponse.json(
      { status: "error", message: "The screenshot data is missing or malformed." },
      { status: 400 },
    );
  }

  const approxBytes = Math.ceil((image.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { status: "error", message: "The screenshot exceeds the 10 MB limit." },
      { status: 413 },
    );
  }

  const parsedFindings = parseFindings(findings);
  const width = typeof originalWidth === "number" ? originalWidth : 1200;
  const height = typeof originalHeight === "number" ? originalHeight : 800;

  const runtimeStatus = getAiRuntimeStatus();
  if (!runtimeStatus.configured) {
    return NextResponse.json(
      {
        status: "ai_unconfigured",
        message:
          "Redesign generation cannot run: " +
          runtimeStatus.message +
          " No redesign was generated.",
        missing: runtimeStatus.missing,
      },
      { status: 200 },
    );
  }

  try {
    const redesign = await runRedesignGeneration({
      imageDataUrl: image,
      findings: parsedFindings,
      originalWidth: width,
      originalHeight: height,
    });
    return NextResponse.json({
      status: "ok",
      redesign,
      provider: runtimeStatus.provider,
      model: runtimeStatus.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Redesign generation failed.";
    // Safe diagnostic log — never includes API keys.
    console.error("[/api/redesign] unexpected error:", message);
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}

const VALID_SEVERITIES = ["critical", "high", "medium", "low"] as const;
const VALID_CATEGORIES = [
  "visual-hierarchy",
  "spacing-alignment",
  "typography-readability",
  "color-contrast",
  "accessibility",
  "component-consistency",
  "navigation-usability",
  "responsive-design",
  "other",
] as const;

function parseFindings(value: unknown): AnalysisFinding[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => item as Record<string, unknown>)
    .filter((f) => typeof f.title === "string")
    .map((f) => ({
      id: typeof f.id === "string" ? f.id : randomUUID(),
      title: f.title as string,
      severity: VALID_SEVERITIES.includes(f.severity as (typeof VALID_SEVERITIES)[number])
        ? (f.severity as (typeof VALID_SEVERITIES)[number])
        : "medium",
      category: VALID_CATEGORIES.includes(f.category as (typeof VALID_CATEGORIES)[number])
        ? (f.category as (typeof VALID_CATEGORIES)[number])
        : "other",
      explanation: typeof f.explanation === "string" ? f.explanation : "",
      suggestion: typeof f.suggestion === "string" ? f.suggestion : "",
      confidence: typeof f.confidence === "number" ? f.confidence : undefined,
      region:
        typeof f.region === "object" && f.region !== null
          ? {
              x: Number((f.region as Record<string, unknown>).x),
              y: Number((f.region as Record<string, unknown>).y),
              width: Number((f.region as Record<string, unknown>).width),
              height: Number((f.region as Record<string, unknown>).height),
            }
          : undefined,
    })) as AnalysisFinding[];
}
