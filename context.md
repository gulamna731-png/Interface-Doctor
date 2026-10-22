Project: Interface Doctor AI — Phases 1–7 complete

Purpose and architecture
- Next.js + TypeScript + Tailwind frontend with server API routes under app/api.
- AI provider pluggable: supports Ollama (local, no API key) and OpenAI (requires OPENAI_API_KEY).
- Vision analysis (/api/analyze) and redesign generation (/api/redesign) call into lib/ai.ts and lib/ollama.ts.
- AI-generated HTML is sanitized server-side and rendered inside a sandboxed iframe on the client.

What was completed
- Phases 1–3 (upload, preview, AI diagnosis, findings UI, recent projects) were already in place and left intact.
- Phase 4 (responsive redesign + secure preview + before-and-after comparison) was completed:
  - `/api/redesign` validates input, calls the configured provider, parses the JSON redesign, and sanitizes HTML/CSS.
  - `RedesignPanel` orchestrates generation, tabs, and error/loading/empty states.
  - `SafeHtmlPreview` renders the redesign in a sandboxed iframe with a strict CSP.
  - `BeforeAfterComparison` provides mouse, touch, and keyboard slider controls.
- Phase 5 (accessibility and responsive validation) is implemented in `lib/verification.ts` and shown in `VerificationPanel`.
- Phase 6 (measurable before-and-after results) is implemented in `lib/metrics.ts` and shown in `MetricsPanel`.
- Phase 7 (final integration and polish) ties the workflow together in `Dashboard.tsx` and updates documentation.

Key fixes applied in this pass
- `lib/ai.ts`: provider-aware default vision model (`gpt-4o` for OpenAI, `gemma3` for Ollama) so OpenAI works without manual model selection; Ollama still does not require an API key.
- `lib/ollama.ts`: hardened response parsing for multiple Ollama response shapes; model availability check returns the exact installed model name.
- `app/api/redesign/route.ts`: findings are parsed with sensible defaults so redesign prompts always include severity/category/suggestion.
- `lib/redesign.ts`: sanitization now also strips `<html>`, `<head>`, `<body>`, and `<!doctype>` tags so AI fragments embed cleanly.
- `components/SafeHtmlPreview.tsx`: iframe is `pointer-events-none` so the before-and-after slider cannot be captured by the redesign iframe.
- `public/sample-screenshot.svg`: created the missing bundled sample asset.

Files changed in this pass
- lib/ai.ts
- lib/ollama.ts
- lib/redesign.ts
- app/api/redesign/route.ts
- components/SafeHtmlPreview.tsx
- public/sample-screenshot.svg (new)
- README.md (completion checkpoints, fallback behavior, and environment setup)
- context.md (this file)
- .env.example (model comments)

Environment setup
- OpenAI: set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `AI_VISION_MODEL=gpt-4o`.
- Ollama: set `AI_PROVIDER=ollama`, `AI_VISION_MODEL=gemma3`, and `OLLAMA_BASE_URL=http://localhost:11434`.
- Secrets must be configured separately in DevMarketplace Preview and GitHub Codespaces; they do not transfer automatically.

Testing
- The code was reviewed statically. Runtime checks (`npm run typecheck`, `npm run lint`, `npm run build`, and live AI calls) must be run in the target environment because this workspace does not provide a shell/execution tool.
