# NAUIP + Playwright MCP browser agent

This is a small, visible browser agent. **Your NAUIP gateway model is the brain**: it reads the task and chooses the next available browser tool. **Playwright MCP is the controller**: it opens the browser, reads the page's accessibility tree, and performs the chosen browser action.

## How it works

```text
Your task
  ↓
NAUIP model decides the next safe tool call
  ↓
Playwright MCP opens / reads / clicks / types in a real browser
  ↓
Tool result returns to the NAUIP model
  ↓
The NAUIP model verifies the result and either repeats or answers
```

The console prints each tool call and writes a complete machine-readable log to `artifacts/`. With the default setting, the actual browser window opens so you can watch it work.

The first visible-browser launch is allowed up to two minutes to start. This avoids a false timeout while Playwright prepares the browser.

Playwright MCP relies on the page's accessibility tree: the model sees controls such as `textbox "Search"` and their temporary references, then uses those references to act. It does not need to guess pixel coordinates.

## Setup

1. Install the project dependencies:

   ```powershell
   npm install
   ```
2. Copy `.env.example` as `.env`, then add the secret value of your NAUIP virtual key as `NAUIP_API_KEY`. The key alias (for example, `Zaheer Shaik`) is not the secret value.
3. Discover the model IDs your virtual key can use:

   ```powershell
   npm run models
   ```

   Copy one listed ID into `NAUIP_MODEL` in `.env`.

   To confirm the browser controller works before adding the key, run:

   ```powershell
   npm start -- --inspect-tools
   ```
4. Run a safe, read-only task:

   ```powershell
   npm start -- "Open https://example.com and tell me its main heading."
   ```
5. For a harmless interaction demo, use the Playwright Todo sample:

   ```powershell
   npm run demo
   ```

   Or write the task yourself:

   ```powershell
   npm start -- --allow-actions "Open https://demo.playwright.dev/todomvc and add Buy groceries. Confirm it appears in the list."
   ```
6. Run without showing a browser window, if needed:

   ```powershell
   npm start -- --headless "Read https://example.com and summarize it."
   ```

## NMC PDF extraction and OCR

Task 2 is a separate, read-only pipeline. It accepts a public NMC PDF URL or an NMC `document-viewer?file=...` link, extracts normal PDF text locally, and sends only scanned or low-text pages to Chandra OCR. This avoids OCR calls for PDFs that already contain selectable text.

Add this optional setting to `.env` (it is the default):

```env
NMC_OCR_MODEL=negdai-chandra-ocr-2
```

```powershell
npm run ocr -- "https://www.nmc.org.in/.../document.pdf"
npm run ocr -- --max-pages 5 "https://www.nmc.org.in/.../document.pdf"
```

NMC's website often exposes documents through a viewer URL instead of showing the PDF URL directly. Both forms work:

```powershell
npm run ocr -- "https://nmc.org.in/document-viewer?file=https%3A%2F%2Fnmc.org.in%2F210357_NMC_Act-1-1.pdf&title=NMC%20Act%2C%202019%20English"
```

To provide the client with an answer, instead of requiring them to read the extracted document, add `--ask`. The normal NAUIP model answers from the extracted pages and cites page numbers:

```powershell
npm run ocr -- --ask "What does this document establish?" "https://nmc.org.in/document-viewer?file=..."
```

Each run writes matching files in `artifacts/`:

- `nmc-ocr-*.json`: exact page-level transcription and machine-readable metadata.
- `nmc-ocr-*.md`: the same transcription in a readable document format.

The JSON identifies whether each page came from the PDF text layer or Chandra OCR, records the source URL, page numbers, timestamps, and a SHA-256 checksum of the downloaded PDF. OCR does not log in, fill forms, or submit anything.

## Direct Playwright form workflow

Task 3 uses a reviewed JSON schema and direct Playwright locators. This is separate from the LLM browser agent: it is deterministic, fast, validates each field after filling it, and keeps an audit log with sensitive fields redacted.

First install the local Chromium runtime once:

```powershell
npm run install-browser
```

Use preview mode first. It fills and validates fields but cannot submit:

```powershell
npm run form -- --pause-for-review --schema forms/example-todo.json --data forms/example-todo-data.json
```

For a fuller practice form with text fields, a password field, a dropdown, and a checkbox, use:

```powershell
npm run form -- --pause-for-review --schema forms/example-selenium-web-form.json --data forms/example-selenium-web-form-data.json
```

The project also includes a safe preview for NMC's student-feedback page. It selects only the provided college and year; it has no submit action and does not manufacture survey answers:

```powershell
npm run form -- --pause-for-review --schema forms/nmc-student-feedback-preview.json --data forms/nmc-student-feedback-preview-data.json
```

Submission requires a second, explicit command after review:

```powershell
npm run form -- --schema forms/example-todo.json --data forms/example-todo-data.json --submit --approve-submit I_CONFIRM_SUBMIT
```

For an NMC form, create a reviewed schema with only the approved fields and stable `testId`, label, or ARIA-role locators. Keep each user's real data in a separate local `forms/*-data.json` file; those files are ignored by Git. The workflow never handles passwords, OTPs, CAPTCHA bypass, file upload, or unreviewed fields.

## Built-in safety boundaries

- The default mode permits only read-only browser actions.
- `--allow-actions` grants click/type actions for one run; it should only be used on a harmless, reviewed task.
- Local/private URLs and `file:` URLs are blocked.
- Arbitrary browser code and file-upload tools stay disabled, even in action mode.
- The model is instructed to stop for logins, passwords, OTPs, uploads, deletion, payments, submissions, and account changes.
- API keys belong only in `.env`, which is ignored by Git.
- NAUIP API calls automatically retry transient network and gateway failures four times.
- Each run is limited to 12 browser steps so an unexpected loop stops visibly.
- OCR accepts only public HTTPS files on `nmc.org.in`, follows only NMC redirects, and rejects PDFs larger than 25 MB.

## Files to know

| File                     | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `src/agent.mjs`        | The agent loop: NAUIP model → MCP tool → browser result → NAUIP model.  |
| `src/nauip.mjs`        | NAUIP OpenAI-compatible gateway adapter, model discovery, and retry logic. |
| `src/safety.mjs`       | URL and browser-action rules.                                              |
| `src/form-fill.mjs`    | Direct Playwright, schema-based preview and approved-submit workflow.      |
| `forms/*.json`         | Reviewed form schemas and local user-data examples.                         |
| `test/safety.test.mjs` | Checks the local safety boundaries.                                        |
| `artifacts/*.jsonl`    | Per-run event log: task, tool calls, and results.                          |

## Next upgrades

Once the basic loop is working, sensible upgrades are a small web interface, human approval prompts for individual actions, website-specific workflows, persistent browser profiles, and a database for structured extracted information. Do not add those until you can clearly explain and observe the basic loop above.

## References

- [Playwright MCP introduction](https://playwright.dev/mcp/introduction)
- [Playwright MCP repository and options](https://github.com/microsoft/playwright-mcp)
