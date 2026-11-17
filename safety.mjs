// FILE PURPOSE: Local checks for the general MCP agent: filter tool names and URLs, then shorten tool text for the model.
// READING TIP: Comments explain logical blocks; executable statements and literal values are unchanged.
// FORM ROUTE: npm run form -> form-fill.mjs -> form-schema.mjs + schema/data JSON -> Playwright -> browser.
// Read top to bottom: configuration and helper definitions lead into the command workflow or exported functions.
// Names in this set are allowed by default. The code checks tool names, not every possible argument combination.
const READ_ONLY_TOOLS = new Set([
  "browser_navigate",
  "browser_navigate_back",
  "browser_snapshot",
  "browser_find",
  "browser_take_screenshot",
  "browser_wait_for",
  "browser_console_messages",
  "browser_network_requests",
  "browser_tabs",
  "browser_close",
]);

// These are not needed for a normal browser agent and would let a model run
// arbitrary browser/server code or move local files into a page.
const ALWAYS_BLOCKED_TOOLS = new Set([
  "browser_run_code_unsafe",
  "browser_evaluate",
  "browser_file_upload",
  "browser_drop",
]);

// Explicit host exclusions supplement the URL protocol check; this is not a complete network sandbox.
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

// isAllowedUrl(): Check HTTP(S) and the explicit host exclusions below. This is a basic filter, not complete private-network detection.
export function isAllowedUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !BLOCKED_HOSTS.has(url.hostname.toLowerCase()) &&
      !url.hostname.toLowerCase().endsWith(".local")
    );
  } catch {
    return false;
  }
}

// toolIsAllowed(): Check local tool restrictions before the general agent executes a model-requested browser action.
export function toolIsAllowed(name, args, allowActions) {
  // Block powerful code-evaluation/upload tools even when ordinary browser actions are enabled.
  if (ALWAYS_BLOCKED_TOOLS.has(name)) {
    return {
      allowed: false,
      reason: `${name} is disabled in this starter agent because it can run arbitrary code or upload local files.`,
    };
  }

  // Without --allow-actions, reject tool names outside the default set.
  if (!allowActions && !READ_ONLY_TOOLS.has(name)) {
    return {
      allowed: false,
      reason: `${name} can change a website. Re-run with --allow-actions only after reviewing the task.`,
    };
  }

  // Check a URL argument when one is present; other arguments are passed through unchanged.
  if (typeof args?.url === "string" && !isAllowedUrl(args.url)) {
    return {
      allowed: false,
      reason: "Navigation is limited to public http(s) websites; local and private network addresses are blocked.",
    };
  }

  return { allowed: true };
}

// compactMcpResult(): Keep MCP text blocks and truncate long results. Images and other content blocks are not forwarded here.
export function compactMcpResult(result, maxLength = 12_000) {
  // Only text content is passed back to the general model loop; screenshot/image blocks are omitted here.
  const text = (result?.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");

  // Keep short tool results intact and explicitly mark a result when it must be truncated.
  if (text.length <= maxLength) return text || "The browser action completed without text output.";
  return `${text.slice(0, maxLength)}\n[Browser result shortened]`;
}
