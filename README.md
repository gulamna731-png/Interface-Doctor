# Interface Doctor AI

**by Team DebugMD** — an AI-powered interface improvement tool. Upload a screenshot of a
website or app, get an honest AI diagnosis of design problems, generate a safe responsive
redesign, compare the original and improved versions with an interactive slider, and review
automated accessibility/responsive verification with measurable before-and-after metrics.

This repository now contains the complete **Phase 1–7** workflow:

1. **Upload** a PNG/JPG screenshot (or use the bundled sample).
2. **Diagnose** the interface with a vision AI model or the built-in heuristic demo provider.
3. **Review** prioritized findings, category filters, and clickable screenshot markers.
4. **Generate** a sanitized, responsive HTML/CSS redesign.
5. **Preview** the redesign safely inside a sandboxed iframe.
6. **Compare** before and after with an interactive slider.
7. **Verify** accessibility, contrast, typography, focus, and responsive behavior.
8. **Measure** before-and-after counts and review remaining issues.

No findings, redesigns, or metrics are ever fabricated.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- Server-side API routes (`app/api/analyze`, `app/api/redesign`, `app/api/status`) — keys never reach the browser

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL. Other scripts:

```bash
npm run lint        # ESLint (next/core-web-vitals)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## AI configuration

The **Analyze Interface** button posts the screenshot to `/api/analyze`. The **Generate
Redesign** button posts to `/api/redesign`. Both routes run on the server, so API keys and
Ollama URLs never reach the browser.

The provider is configurable via environment variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | AI engine to use. Default `demo` (self-contained heuristic provider, no key required); set to `ollama` or `openai` for real AI providers. |
| `OLLAMA_BASE_URL` | Local Ollama endpoint. Default `http://localhost:11434`. In GitHub Codespaces this refers to the Codespace/container environment, not your personal computer. |
| `AI_VISION_MODEL` | Model used for analysis and redesign. Defaults to `gemma3` for Ollama and `gpt-4o-mini` for OpenAI. |
| `OPENAI_API_KEY` | Required only when `AI_PROVIDER=openai`. |

### How environment variables reach the app

1. Add variables in the workspace **Secrets** panel (or create a local `.env` file from `.env.example`).
2. **Restart the dev server** (`npm run dev`) after adding or changing a secret. Next.js reads environment variables at process startup, so a running server will not see new secrets until it is restarted.
3. The dashboard fetches `/api/status`, which inspects the server environment and optionally probes Ollama `/api/tags`. It returns safe diagnostics only; the secret value is never exposed.

### DevMarketplace Preview

- Add `OPENAI_API_KEY` (only if using OpenAI), `AI_PROVIDER`, `AI_VISION_MODEL`, and `OLLAMA_BASE_URL` in the workspace **Secrets** panel.
- Restart the dev server after changing secrets.

### GitHub Codespaces

Secrets are **not shared** between DevMarketplace and GitHub Codespaces. Configure them
separately:

1. Open your Codespace.
2. Go to **Settings → Secrets and variables → Codespaces secrets** (or your organization's equivalent).
3. Add the variables you need:
   - For Ollama:
     - `AI_PROVIDER=ollama`
     - `OLLAMA_BASE_URL=http://localhost:11434`
     - `AI_VISION_MODEL=gemma3`
   - For OpenAI:
     - `AI_PROVIDER=openai`
     - `AI_VISION_MODEL=gpt-4o-mini`
     - `OPENAI_API_KEY=sk-...`
4. Rebuild the container or restart the dev server so the new secrets are loaded.

The application reads `OPENAI_API_KEY` only through `process.env.OPENAI_API_KEY` in server-side code. It is never sent to the browser, logged, or returned from `/api/status`.

### Status badge meanings

- **AI engine ready** — the provider is supported and (for Ollama) the service is reachable and the model is installed. For `demo`, this means the heuristic provider is active and no external key is required.
- **Ollama unreachable** — `AI_PROVIDER=ollama` is set, but the server cannot reach Ollama at `OLLAMA_BASE_URL`.
- **Model missing** — Ollama is reachable, but the configured `AI_VISION_MODEL` is not installed.
- **Key not found in server environment** — `AI_PROVIDER=openai` but `OPENAI_API_KEY` is missing or empty in the server environment.
- **Provider unsupported** — `AI_PROVIDER` is set to a value that is not implemented.

You can also verify the runtime status directly:

```bash
curl http://localhost:3000/api/status
```

The response reports configuration, Ollama reachability, and model availability; the secret value is never returned.

### Ollama setup in GitHub Codespaces

1. Install Ollama in the Codespace if it is not already present:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Start the Ollama service in the background:
   ```bash
   ollama serve &
   ```
3. Pull a vision-capable model. The default is `gemma3`, but any Ollama model that supports images works (e.g. `llava`, `llama3.2-vision`):
   ```bash
   ollama pull gemma3
   ```
4. Verify the model is installed and Ollama is reachable from the same container:
   ```bash
   curl http://localhost:11434/api/tags
   ```
5. Add the environment variables in the Codespace secrets panel or a local `.env` file.
6. **Restart the Next.js dev server** (`npm run dev`) after changing secrets.

`localhost:11434` refers to the Codespace/container environment, not your personal computer.

### Troubleshooting Ollama

If analysis or redesign fails with an Ollama error:

1. Check the server-side status badge or call `curl http://localhost:3000/api/status`.
2. Verify the exact model name Ollama knows about:
   ```bash
   curl http://localhost:11434/api/tags | jq '.models[].name'
   ```
3. Make sure the model supports image inputs. The default `gemma3` is multimodal.
4. Restart the Next.js dev server after changing environment variables.

### Troubleshooting OpenAI

If analysis or redesign fails with a key error:

1. Confirm `AI_PROVIDER=openai` is set.
2. Confirm `OPENAI_API_KEY` is set as a server-side secret (not in the browser, not in `.env.example`).
3. Confirm the dev server was restarted after the secret was added.
4. Check that `AI_VISION_MODEL` is a vision-capable model (e.g. `gpt-4o-mini` or `gpt-4o`).
5. Inspect `/api/status` for the `keyPresent` flag.

**If no AI service is reachable**, the upload/preview workflow still works end-to-end and the UI
clearly explains the issue — no fake findings or redesigns are ever shown. Rate limits, network
failures, missing models, invalid request formats, and malformed responses are surfaced as honest
error messages.

## Responsive redesign and before/after comparison

After diagnosis, click **Generate Redesign** to ask the configured provider for an improved, responsive webpage
preview based on the screenshot and the diagnosed issues.

- The request goes to `/api/redesign`, which validates the screenshot and forwards it to the
  vision model with a structured prompt.
- The AI returns HTML, CSS, a description, and a list of improvements. The server validates the
  JSON shape and sanitizes the output:
  - `<script>` tags, inline event handlers, `javascript:` URLs, and `<iframe>`/`<embed>`/
    `<object>` tags are removed.
  - CSS `@import`, `expression()`, and closing `</style>` markers are removed.
- The result is rendered in `SafeHtmlPreview` using an iframe with an empty `sandbox`
  attribute and a strict Content Security Policy. No JavaScript can execute and no external
  network requests can be made.
- `BeforeAfterComparison` overlays the original screenshot on the redesign preview with a
draggable slider so you can compare them interactively.

If no AI key is configured, the UI clearly explains that redesign generation requires
configuration — no fabricated previews are shown.

## Verification and measurable results (Phases 5 & 6)

After a redesign is generated, the app runs client-side verification heuristics on the
sanitized HTML/CSS:

- **Contrast** — estimates contrast ratios for declared text/background color pairs.
- **Semantic structure** — heading order, missing image alt text, missing form labels, and
  interactive elements without accessible names.
- **Typography** — very small font sizes and tight line heights.
- **Responsive** — fixed widths that may overflow, missing media queries, and images without
  `max-width: 100%`.
- **Focus** — presence of visible `:focus` or `:focus-visible` styles.

Every finding is labeled **Automated** or **Manual review**. Manual checks remind you to test
keyboard navigation, screen-reader order, and color-blind accessibility, because those cannot
be verified by static heuristics alone.

The **Metrics** tab compares:

- The original diagnosis counts (by severity and category).
- The redesign verification counts (issues found, improvements listed, responsive score,
  contrast/typography/accessibility/overflow counts).

These are real counts from the AI diagnosis and the verification report. They are not invented
scores, and the summary explains what they do and do not mean.

## Data persistence

There is no database yet. "Recent projects" are stored in the browser's `localStorage`
(downscaled thumbnails only) and reset if storage is cleared. A later phase will move this to a
real database (it can be enabled from the workspace Database button).

## Completion checkpoints

The implementation is considered complete when all of the following are verified:

1. **Upload and preview** — PNG/JPG screenshots can be uploaded or the bundled sample can be loaded, validated, and previewed.
2. **AI diagnosis** — `/api/analyze` returns real findings from the configured provider, or an honest `ai_unconfigured` / error message when the provider is missing or unreachable.
3. **Findings UX** — Findings are filterable by category, clickable, and highlighted with numbered markers on the screenshot.
4. **Redesign generation** — `/api/redesign` produces sanitized HTML/CSS based on the screenshot and diagnosis, or returns a clear error.
5. **Secure preview** — The redesign renders inside an iframe with `sandbox=""` and a strict CSP, so no scripts execute and no unauthorized network requests can be made.
6. **Before-and-after comparison** — The interactive slider works with mouse, touch, and keyboard (arrow keys, Home, End).
7. **Accessibility and responsive validation** — Verification runs automatically on generated redesigns and labels every finding as **Automated** or **Manual review**.
8. **Measurable results** — Metrics compare real counts from the original diagnosis with the redesign verification; no scores are fabricated.
9. **Error handling** — Missing keys, rate limits, quota errors, authentication failures, and model errors are surfaced with plain-language messages.
10. **Existing functionality** — Recent projects, dashboard navigation, sidebar, and saved-project behavior remain intact.

## Safe fallback behavior

- **AI not configured:** The UI shows a clear unconfigured message instead of fake findings or redesigns. The upload/preview workflow still works.
- **Diagnosis or redesign API failure:** The error is displayed with a **Try again** button; no mock data is returned.
- **Verification cannot run:** The Verification tab shows the error, and the Metrics tab explains that no redesign is available.
- **No redesign generated:** The Verification and Metrics tabs show empty-state guidance.
- **Invalid or oversized upload:** The upload is rejected immediately with a clear message (PNG/JPG only, ≤10 MB).
- **Ollama unreachable or model missing:** `/api/status` reports the exact issue so the badge and messages tell the user what to fix.
- **OpenAI key missing:** `/api/status` reports `key_missing` only when `AI_PROVIDER=openai`; the key is never exposed to the browser, logs, or source control.

## Structure

```
app/
  layout.tsx             Root layout + metadata
  page.tsx               Dashboard entry
  globals.css            Tailwind layers + focus styles
  api/analyze/route.ts   GET: AI config status · POST: validate + diagnose
  api/redesign/route.ts  POST: validate + generate safe responsive redesign
  api/status/route.ts    GET: safe runtime AI-status diagnostics
components/
  Dashboard.tsx                 Client-side state orchestration
  Sidebar.tsx, Logo.tsx, AiStatusBadge.tsx
  UploadDropzone.tsx            Drag-and-drop + file picker with validation
  ScreenshotPreview.tsx         Preview, remove/replace, Analyze button
  ScreenshotAnnotator.tsx       Issue markers overlaid on the screenshot
  AnalysisResultPanel.tsx       Loading / unconfigured / error / findings + filters
  RedesignPanel.tsx             Generate redesign + tabs (preview, comparison, verification, metrics)
  SafeHtmlPreview.tsx           Sandboxed iframe preview of AI-generated HTML/CSS
  BeforeAfterComparison.tsx     Interactive before/after slider
  VerificationPanel.tsx         Accessibility/responsive verification findings
  MetricsPanel.tsx              Before-and-after measurable comparison
  RecentProjects.tsx            localStorage-backed recent projects grid
lib/
  types.ts                   Shared API/domain types
  ai.ts                      Server-side provider config + validated vision call
  ollama.ts                  Shared Ollama connectivity, model checks, and chat helpers
  jsonExtraction.ts          Robust JSON extraction from Markdown-fenced AI responses
  redesign.ts                Server-side AI redesign generation + HTML/CSS sanitization
  verification.ts            Client-side redesign verification heuristics
  metrics.ts                 Before-and-after comparison metrics
  geometry.ts                Map fractional regions to rendered screenshot pixels
  uploadValidation.ts        PNG/JPG + 10 MB validation, byte formatting
  imageUtils.ts              File→preview, sample rasterization, thumbnails
  recentProjects.ts          localStorage store
public/
  sample-screenshot.svg      Bundled sample UI screenshot (rasterized to PNG on use)
```

## Notes

- This project intentionally keeps dependencies minimal and does not require a database.
- Verification results are heuristics, not a substitute for real accessibility audits or user testing.
