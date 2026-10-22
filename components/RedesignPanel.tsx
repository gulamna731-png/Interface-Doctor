"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useState } from "react";
import { SafeHtmlPreview } from "@/components/SafeHtmlPreview";
import { BeforeAfterComparison } from "@/components/BeforeAfterComparison";
import { VerificationPanel } from "@/components/VerificationPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import type {
  ComparisonResult,
  RedesignResult,
  ScreenshotSelection,
  VerificationReport,
} from "@/lib/types";

interface RedesignPanelProps {
  selection: ScreenshotSelection;
  redesignResult: RedesignResult | null;
  generating: boolean;
  verification: VerificationReport | null;
  metrics: ComparisonResult | null;
  onGenerate: () => void;
  onReset: () => void;
}

type RedesignTab = "comparison" | "redesign" | "verification" | "metrics";

export function RedesignPanel({
  selection,
  redesignResult,
  generating,
  verification,
  metrics,
  onGenerate,
  onReset,
}: RedesignPanelProps) {
  const [tab, setTab] = useState<RedesignTab>("comparison");

  const handleGenerate = useCallback(() => {
    if (generating) return;
    onGenerate();
  }, [generating, onGenerate]);

  if (!redesignResult && !generating) {
    return (
      <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Generate responsive redesign</h3>
            <p className="mt-1 max-w-lg text-sm text-ink-500">
              Ask the AI to produce an improved, responsive webpage preview based on your
              screenshot and the diagnosed issues.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-brand-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M5 16l-3 3 3 3M19 8l3-3-3-3M14 2l-4 20"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Generate Redesign
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-ink-100 bg-ink-50 p-3">
          <p className="text-xs leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">Safety note:</span> The redesign is
            generated as static HTML and CSS, sanitized on the server, and rendered inside a
            sandboxed iframe with no JavaScript execution.
          </p>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div role="status" className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
        <p className="flex items-center gap-3 text-sm text-ink-600">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
            aria-hidden="true"
          />
          Generating a responsive redesign… this can take up to a minute.
        </p>
        <div className="mt-4 space-y-3" aria-hidden="true">
          <div className="h-40 animate-pulse rounded-lg bg-ink-100" />
        </div>
      </div>
    );
  }

  if (!redesignResult) return null;

  if (redesignResult.status === "ai_unconfigured") {
    return (
      <div
        role="status"
        className="mt-6 animate-fade-in rounded-xl border border-amber-200 bg-amber-50 p-5"
      >
        <h3 className="text-sm font-semibold text-amber-800">Redesign requires configuration</h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-800/90">
          {redesignResult.message}
        </p>
        <p className="mt-2 text-xs text-amber-700">
          Required:{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">
            {redesignResult.missing.join(", ")}
          </code>
        </p>
      </div>
    );
  }

  if (redesignResult.status === "error") {
    return (
      <div role="alert" className="mt-6 animate-fade-in rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-semibold text-red-800">Redesign could not be generated</h3>
        <p className="mt-1 text-sm text-red-700">{redesignResult.message}</p>
        <button
          type="button"
          onClick={handleGenerate}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }

  const { redesign, provider, model } = redesignResult;
  const aspectRatio = selection.width / selection.height;

  const originalImage = (
    <img
      src={selection.previewUrl}
      alt={`Original screenshot: ${selection.name}`}
      className="h-full w-full object-contain"
    />
  );

  const redesignPreview = (
    <SafeHtmlPreview redesign={redesign} aspectRatio={aspectRatio} title="AI redesign preview" />
  );

  const redesignPreviewFill = (
    <SafeHtmlPreview
      redesign={redesign}
      aspectRatio={aspectRatio}
      title="AI redesign preview"
      className="h-full"
    />
  );

  return (
    <section
      aria-label="AI redesign"
      className="mt-6 animate-fade-in rounded-xl border border-ink-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Responsive redesign</h3>
          <p className="mt-1 text-sm text-ink-500">
            {redesign.description || "An AI-generated improved version of the interface."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-400">
            {provider} · {model}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <TabButton
          label="Before & After"
          active={tab === "comparison"}
          onClick={() => setTab("comparison")}
        />
        <TabButton
          label="Redesign only"
          active={tab === "redesign"}
          onClick={() => setTab("redesign")}
        />
        <TabButton
          label="Verification"
          active={tab === "verification"}
          onClick={() => setTab("verification")}
        />
        <TabButton
          label="Metrics"
          active={tab === "metrics"}
          onClick={() => setTab("metrics")}
        />
      </div>

      <div className="mt-4">
        {tab === "comparison" && (
          <BeforeAfterComparison
            before={originalImage}
            after={redesignPreviewFill}
            aspectRatio={aspectRatio}
            label="Drag to compare original screenshot and AI redesign"
          />
        )}
        {tab === "redesign" && redesignPreview}
        {tab === "verification" &&
          (verification ? (
            <VerificationPanel report={verification} />
          ) : (
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
              <p className="text-sm text-ink-600">
                Verification results will appear here once a redesign has been generated.
              </p>
            </div>
          ))}
        {tab === "metrics" && <MetricsPanel metrics={metrics} />}
      </div>

      {redesign.improvements.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Key improvements
          </h4>
          <ul className="mt-2 space-y-2">
            {redesign.improvements.map((improvement, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                  aria-hidden="true"
                />
                {improvement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
      }`}
    >
      {label}
    </button>
  );
}
