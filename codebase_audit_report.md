# AI DOM Tutor — Full Codebase Audit Report

**Project:** `ai-dom-tutor-complete`  
**Audit Date:** November 6, 2026  
**Auditor:** Kiro AI Code Review  
**Scope:** Every source file reviewed line-by-line  
**Verdict:** ⚠️ **Beta-quality — Not Production-Ready**

---

## Table of Contents

1. [What the Project Actually Does](#1-what-the-project-actually-does)
2. [File Inventory](#2-file-inventory)
3. [Real vs Mock / Hardcoded Code Analysis](#3-real-vs-mock--hardcoded-code-analysis)
4. [Module-by-Module Review](#4-module-by-module-review)
5. [Duplicate & Redundant Code](#5-duplicate--redundant-code)
6. [Missing / Incomplete Functionality](#6-missing--incomplete-functionality)
7. [Security Issues](#7-security-issues)
8. [Build & Tooling Problems](#8-build--tooling-problems)
9. [Production-Readiness Score](#9-production-readiness-score)
10. [Improvement Suggestions](#10-improvement-suggestions)
11. [Priority Action Plan](#11-priority-action-plan)

---

## 1. What the Project Actually Does

**Real use-case with example:**

> A person who speaks Urdu visits a government benefits application form in English. They click the purple floating button injected by the extension, pick "اردو", then tab to a field labelled "Social Security Number". The extension detects the focus event, sends element metadata (`label`, `type`, `placeholder`) to the background service worker, which calls the Groq/OpenAI/Gemini API with a localised prompt. The API returns a 1-2 sentence Urdu explanation that is shown as a tooltip and optionally read aloud via TTS.

**Real-world users:** Non-English speakers, people with reading difficulties, elderly users filling out forms, accessibility testers.

---

## 2. File Inventory

| File | Role | Status |
|---|---|---|
| `src/background.ts` | **Active** service worker — API calls, config storage | ✅ Real, primary |
| `src/content.ts` | **Active** content script — DOM UI, focus handling | ✅ Real, primary |
| `src/popup.ts` | **Active** admin panel logic | ✅ Real, primary |
| `src/types.ts` | Shared TypeScript interfaces | ✅ Real |
| `src/background/background.ts` | **Older/parallel** background implementation | ⚠️ Duplicate, legacy |
| `src/content/content.ts` | **Older/parallel** content script | ⚠️ Duplicate, legacy |
| `src/popup/popup.ts` | **Older/parallel** popup logic | ⚠️ Duplicate, legacy |
| `src/popup/popup.html` | Older popup HTML (no CSS link) | ⚠️ Duplicate, legacy |
| `src/providers/providers.ts` | Standalone provider class | ⚠️ Dead code — never imported |
| `public/popup.html` | **Active** popup HTML — loaded by Vite | ✅ Real, primary |
| `public/popup.css` | Production popup styles | ✅ Real |
| `public/content.css` | Injected page styles | ✅ Real |
| `server.js` | Optional Express backend for BFF/TTS | ⚠️ Partially real (see §4.6) |
| `vite.config.ts` | **Active** build config | ✅ Real |
| `webpack.config.js` | Parallel build config | ⚠️ Redundant alongside Vite |
| `manifest.json` (root) | Root-level manifest | ⚠️ Duplicate of `public/manifest.json` |
| `tests/background.test.ts` | Unit tests | ❌ Broken — incomplete |
| `tsconfig.json` | TypeScript config | ✅ Real but has issues |

---

## 3. Real vs Mock / Hardcoded Code Analysis

### ✅ Fully Real (Live) Code

| Location | What is real |
|---|---|
| `src/background.ts` → `callOpenAIFormat()` | Genuine HTTP fetch to OpenAI/Groq endpoints with real auth headers |
| `src/background.ts` → `callGemini()` | Genuine Gemini API call with correct `?key=` param pattern |
| `src/background.ts` → `chrome.storage.sync` | Real Chrome extension storage API |
| `src/content.ts` → Focus/blur event listeners | Real DOM event capture on all sites |
| `src/content.ts` → `VoiceManager` | Real `SpeechSynthesis` API with voice loading, locale selection |
| `src/content.ts` → `TTSProvider` | Real multi-fallback TTS chain (background → backend → Google Translate) |
| `src/content.ts` → `highlightElement()` | Real `getBoundingClientRect` + absolute overlay div |
| `src/popup.ts` → `testProvider()` | Real live AI API call for the test button |

### ⚠️ Hardcoded / Incomplete Values

| Location | Issue |
|---|---|
| `server.js` line 9 | `model: 'gpt-5-mini'` — **does not exist**. GPT-5 is not a real OpenAI model as of this writing; the real model name is `gpt-4o-mini` |
| `server.js` `SAFE_MODE` | When `SAFE_MODE=1` and no API key, returns `[en] <user input>` — this is a **mock echo**, not a real response |
| `src/background/background.ts` → `buildPrompt()` | Only has EN/AR/HI/UR prompts; ES/FR/DE fall back silently to English with no warning |
| `src/popup/popup.ts` → `renderLanguages()` | Uses inline `onclick="adminPanel.setDefaultLanguage(...)"` — breaks CSP in MV3 extensions |
| `src/popup/popup.html` → Analytics tab | `"Analytics data will be displayed here"` — **100% placeholder text**, nothing is implemented |
| `tests/background.test.ts` | Test checks `activeProvider === 'openai'` but the real default in `src/background.ts` is `'groq'` — test is **wrong/stale** |
| `src/content.ts` → `backendBase` | `localStorage.getItem('bff_url')` — using `localStorage` to configure a backend URL is a dev workaround, not a proper settings flow |
| `src/content.ts` → `TTSProvider.requestViaBackground()` | Sends `action: 'tts'` but the background service worker has **no handler** for this — silently returns `null` every time |

### ❌ Truly Mock / Non-functional

| Location | Issue |
|---|---|
| Analytics tab (both popup HTMLs) | Completely empty — zero backend, zero data, just placeholder text |
| `server.js` `SAFE_MODE` response | Returns user input echoed back — this is a debug stub, not a feature |
| `server.js` `/api/tts` endpoint | The server has no `/api/tts` route; the TTS backend path referenced in `content.ts` is unimplemented |

---

## 4. Module-by-Module Review

### 4.1 `src/background.ts` — Service Worker

**Overall: 7/10 — Functional but fragile**

**✅ Good:**
- Proper `chrome.storage.sync` read/write with error handling
- Correctly returns `true` from `onMessage` for async responses
- Splits OpenAI-format vs Gemini routing cleanly
- Multilingual system-prompt injection per language

**❌ Issues:**

```typescript
// No handler for 'tts' action message
// content.ts sends { action: 'tts' } but background never handles it
switch (request.action) {
  case 'getConfig':         // ✅
  case 'updateConfig':      // ✅
  case 'getAIExplanation':  // ✅
  // 'tts' → MISSING → TTSProvider.requestViaBackground always returns null
}
```

```typescript
// API key trimmed on use, not on storage
provider.apiKey.trim()
// Better to trim on save (in popup) so the stored value is clean
```

```typescript
// buildPrompt has 7 languages but callOpenAIFormat languageInstructions
// also has 7. If a new language is added in one place it must be manually
// added in the other — fragile coupling.
```

---

### 4.2 `src/content.ts` — Content Script

**Overall: 8/10 — Best file in the project**

**✅ Good:**
- `VoiceManager` properly handles voice loading race condition via `voicesReady` Promise
- Correctly blocks wrong-language voice fallback (English voice reading Urdu)
- `TTSProvider` has a real 3-tier fallback strategy
- `MutationObserver` re-injects the button if a SPA removes it — smart
- `extractElementData` is thorough: checks `labels`, `aria-label`, `placeholder`, parent text nodes
- Tooltip repositioning logic using `getBoundingClientRect` to avoid viewport overflow
- Accessibility: `role="tooltip"`, `role="menu"`, `aria-label` on button, keyboard support (Enter/Space/Escape)

**❌ Issues:**

```typescript
// backendBase read from localStorage — not a settings page setting
private readonly backendBase = (localStorage.getItem('bff_url') || '').trim();
// There is no UI to set this. A developer must open DevTools manually.
// Should be stored in chrome.storage and configurable from popup.
```

```typescript
// audioCache stores Object URLs forever — memory leak
private audioCache = new Map<string, string>();
// Object URLs are never revoked (URL.revokeObjectURL).
```

```typescript
// handleElementBlur cancels speech only when !isActive
if ('speechSynthesis' in window && !this.state.isActive) {
  speechSynthesis.cancel();
}
// When tutor IS active, blurring an element does NOT cancel ongoing speech.
// A user tabbing quickly triggers overlapping speech utterances.
```

```typescript
// Tooltip uses fixed positioning but adds scroll offsets — wrong
tooltip.style.position = 'fixed';   // fixed positioning…
// …but then adds scrollX/scrollY which are irrelevant for fixed elements.
// This causes tooltips to appear in wrong positions on scrolled pages.
```

```typescript
// 10-second tooltip auto-hide is not cancellable
setTimeout(() => this.hideTooltip(), 10000);
// No clearTimeout stored. Rapid tabbing causes stale timers removing
// the tooltip for the wrong element.
```

```typescript
// updateConfig fires and forgets — no error handling
private updateConfig(updates: Partial<Config>): void {
  chrome.runtime.sendMessage({ action: 'updateConfig', config: updates });
}
// Silent failures on config save cause UI state and storage to diverge.
```

---

### 4.3 `src/popup.ts` — Admin Panel

**Overall: 7/10 — Functional, some UX and security gaps**

**✅ Good:**
- Full tab system with providers, languages, settings
- Real API test from the popup using actual AI call
- Toggle switches for voice and tooltips
- Status toast system
- Properly guards against removing the last language

**❌ Issues:**

```typescript
// Uses window.prompt() for API key input — blocked in many MV3 contexts
const apiKey = prompt(`Enter API Key for ${provider.name}...`);
// Should be an inline password input field.
```

```typescript
// testProvider hardcodes a fake element, ignores user's typed test input
const elementData = {
  tagName: 'INPUT',
  type: 'email',
  label: 'Email address field',   // <-- hardcoded, ignores the test-input field
  placeholder: 'Enter your email'
};
```

```typescript
// addLanguage() generates invalid BCP-47 ttsVoice tags
ttsVoice: `${code}-${code.toUpperCase()}`
// For 'ja' this becomes 'ja-JA' (should be 'ja-JP')
```

```typescript
// setDefaultLanguage does not sync the content script live
// Language change only takes effect after page refresh.
```

---

### 4.4 `src/types.ts` — Shared Types

**Overall: 8/10 — Good but incomplete**

```typescript
// Language.ttsVoice typed as string, but runtime data uses string | null
export interface Language {
  ttsVoice: string;  // should be string | null
}
```

- No `ProviderKey` union type — provider keys like `'openai' | 'groq' | 'gemini'` are plain `string` everywhere, allowing typos to fail silently at runtime.

---

### 4.5 `src/providers/providers.ts` — Dead Code

**Overall: 2/10 — Never used**

- `AIProviderManager` class is defined but **imported nowhere**
- Has a `callClaude()` method — the only place Claude is implemented — but unreachable
- Uses `provider.name.toLowerCase()` for routing (`'google gemini'`) which will not match the key `'gemini'` used everywhere else — **routing is broken even if imported**
- Defines its own `Provider` interface instead of importing from `types.ts`
- The whole file should either be integrated into `background.ts` or deleted

---

### 4.6 `server.js` — Express Backend

**Overall: 3/10 — Mostly stub, has a critical bug**

```javascript
// Non-existent model name — will 404 from OpenAI
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
// Should be 'gpt-4o-mini'
```

```javascript
// SAFE_MODE echo is a mock response, not a feature
if (SAFE_MODE && !OPENAI_API_KEY) {
  return res.json({ text: `[${lang}] ${last}` });
  // Returns the user's own text back — not an AI response.
}
```

```javascript
// No /api/tts route — content.ts calls this endpoint but it doesn't exist
// TTSProvider.requestViaBackend() will always get a 404
```

```javascript
// No rate limiting, no auth, no request validation
// Anyone who can reach this server can proxy unlimited OpenAI calls at your cost
```

```javascript
// No .env.example file — developers don't know what env vars are needed
// (OPENAI_API_KEY, OPENAI_MODEL, PORT, SAFE_MODE)
```

---

### 4.7 Legacy Files (`src/background/`, `src/content/`, `src/popup/`)

**Overall: 1/10 — Should be deleted**

These are an earlier iteration of the codebase. They:
- Define the same interfaces (`Config`, `Provider`, `Language`) inline instead of importing from `types.ts`
- Are **not referenced** by `vite.config.ts` or `webpack.config.js`
- Will never be built or shipped
- Create confusion about which files are "real"
- The old `src/popup/popup.ts` uses unsafe inline `onclick="adminPanel.method()"` which violates Chrome MV3 Content Security Policy

---

### 4.8 Build Configuration

**Dual build system conflict:**

Both `vite.config.ts` and `webpack.config.js` target the same entry points and the same `dist/` folder. Running both corrupts output. The webpack config also lacks `@crxjs` so it cannot generate the manifest properly. **Only one build tool should exist.**

**`tsconfig.json` issue:**
- `rootDir: "./src"` but `tests/` is outside `src/` — tests won't compile without a separate `tsconfig.test.json`

---

### 4.9 Tests (`tests/background.test.ts`)

**Overall: 1/10 — Broken**

```typescript
// Wrong expected value
expect((service as any).config.activeProvider).toBe('openai');
// Real default in src/background.ts is 'groq', not 'openai' — test fails immediately
```

```typescript
// BackgroundService is not imported — ReferenceError at runtime
```

- No test for `content.ts`, `popup.ts`, or any other module
- 1 test file covering 1 partial, broken scenario is not meaningful coverage

---

## 5. Duplicate & Redundant Code

### A — Three parallel full implementations

| Feature | `src/*.ts` (Active) | `src/background/`, `src/content/`, `src/popup/` (Legacy) |
|---|---|---|
| Background service | ✅ Full | ⚠️ Older version |
| Content script | ✅ Full | ⚠️ Older version |
| Admin panel | ✅ Full | ⚠️ Older version |
| Interfaces | Imports `types.ts` | Re-declares inline |

**Impact:** ~600 lines of dead legacy code across 4 files.

### B — Two identical `manifest.json` files

`/manifest.json` and `/public/manifest.json` are byte-for-byte identical. Only the `public/` one is used by Vite.

### C — `buildPrompt()` duplicated in 3 places

| File | Method | Languages |
|---|---|---|
| `src/background.ts` | `buildPrompt()` | 7 languages |
| `src/background/background.ts` | `buildPrompt()` | 4 languages |
| `src/providers/providers.ts` | `buildPrompt()` | 4 languages |

All three do the same thing with slightly different strings. Should be one shared utility.

### D — `getLanguageFlag()` duplicated

| File | Method | Entries |
|---|---|---|
| `src/content.ts` | `getLanguageFlag()` | 8 (includes `fil`) |
| `src/popup.ts` | `getLanguageFlag()` | 7 (missing `fil`) |

Same function in two places, different data — consistency bug.

### E — Language instruction maps duplicated

`languageInstructions` in `callOpenAIFormat()` and `buildPrompt()` in the same `background.ts` file both map language codes to localised strings. Two separate Maps for one concern.

### F — Tooltip styles defined twice

- `src/styles/content.css` defines `.ai-tutor-tooltip` with `position: fixed`
- `src/content.ts` `showTooltip()` also sets inline styles (background, border, padding, font, z-index)

The inline styles duplicate and partially contradict the CSS class. This is also the root of the scroll-offset positioning bug.

---

## 6. Missing / Incomplete Functionality

### Critical Missing

| # | What is missing | Impact |
|---|---|---|
| 1 | `'tts'` message handler in `background.ts` | `TTSProvider` background TTS path never works — always falls through to Google Translate |
| 2 | `/api/tts` route in `server.js` | Backend TTS path always returns 404 |
| 3 | `chrome.storage.onChanged` listener in `content.ts` | Language or enable/disable changes from popup don't apply to already-open pages without a full reload |
| 4 | Claude provider wired up | `providers.ts` has a Claude implementation but it is dead code; `background.ts` has no Claude routing |
| 5 | API key input UI (popup) | Uses `window.prompt()` which is blocked in MV3 extensions — users may not be able to enter their API key |

### Important Missing

| # | What is missing | Impact |
|---|---|---|
| 6 | Analytics feature | Tab exists with placeholder text, nothing is tracked or displayed |
| 7 | `clearTimeout` for tooltip auto-hide | Rapid element tabbing causes stale timers removing the wrong tooltip |
| 8 | `URL.revokeObjectURL` in TTS audio cache | Memory leak on long-running TTS-heavy pages |
| 9 | `.env.example` | Developers have no guidance on required env vars for `server.js` |
| 10 | Error boundary for `chrome.runtime.lastError` in `updateConfig()` | Silent failures on config save |
| 11 | Keyboard shortcut to activate/deactivate tutor | Users must reach the floating button with a mouse |
| 12 | Support for `<iframe>` forms | Content script runs on top-level documents; iframe-based forms (many payment pages) are not covered |

### Nice-to-have Missing

| # | What is missing |
|---|---|
| 13 | Retry logic for API calls (transient network errors) |
| 14 | Token/usage tracking for API cost awareness |
| 15 | Export/import of configuration |
| 16 | Per-site enable/disable (blocklist/allowlist) |
| 17 | `aria-live` region on tooltip for screen reader announcements |

---

## 7. Security Issues

### HIGH

| Issue | File | Detail |
|---|---|---|
| API keys stored in `chrome.storage.sync` | `background.ts` | `sync` storage is accessible profile-wide. Should use `chrome.storage.local` for sensitive data like API keys. |
| `server.js` has no authentication | `server.js` | Any request to `/api/chat` will be proxied to OpenAI at the owner's cost. No API key, token, or origin check. |
| `window.prompt()` for API key | `popup.ts` | Key value exposed in native dialog which may be captured by accessibility tools or screen recording software. |
| `localStorage` for backend URL | `content.ts` | `localStorage` is accessible to all page JavaScript. A compromised page could overwrite `bff_url` to redirect requests to an attacker's server. |

### MEDIUM

| Issue | File | Detail |
|---|---|---|
| `any` types throughout | All files | Bypasses TypeScript safety — `request.config`, `elementData`, API responses all typed `any`. Malformed messages can cause uncaught runtime errors. |
| No input sanitisation on `elementData.label` | `background.ts` | Label is injected into prompt strings via template literals. A malicious web page could craft a label to attempt prompt injection. |
| `host_permissions: ["https://*/*", "http://*/*"]` | `manifest.json` | Extension has access to every page including banking and healthcare sites. Should be opt-in or per-domain. |

---

## 8. Build & Tooling Problems

| # | Issue |
|---|---|
| 1 | **Dual build system**: Both Vite and Webpack are configured for the same entry points. Running both will corrupt `dist/`. |
| 2 | **`package.json` `"build"` runs Vite only** — webpack is never invoked by any npm script. Webpack config is dead. |
| 3 | **`dependencies` vs `devDependencies`**: Hundreds of build-tool packages (`webpack`, `clean-css`, `terser`, `lodash`, `glob`, etc.) are in `dependencies` instead of `devDependencies`. |
| 4 | **No `clean` script** in `package.json` despite README claiming `npm run clean` exists. |
| 5 | **`tsconfig.json` `rootDir: "./src"`** but `tests/` is outside `src/` — tests won't type-check without a separate `tsconfig.test.json`. |
| 6 | **`server.js` imports `express` and `dotenv`** which are not in `package.json` — `node server.js` will crash without manually running `npm install express dotenv`. |

---

## 9. Production-Readiness Score

| Category | Score | Notes |
|---|---|---|
| Core feature (AI tooltip on form elements) | 7/10 | Works end-to-end if API key entered, but key input UI is broken in MV3 |
| Multilingual support | 6/10 | 7 languages exist; TTS fallback chain works; but `chrome.storage.onChanged` missing so live language switch doesn't work |
| Voice / TTS | 5/10 | Web Speech works. Background TTS proxy handler missing. Google Translate TTS last-resort is rate-limited. |
| Admin Popup | 5/10 | `window.prompt` for API key is broken in MV3. Analytics tab is empty. |
| Build System | 4/10 | Dual bundler conflict, wrong dep categories, missing scripts |
| Test Coverage | 1/10 | 1 broken test, no coverage for content or popup |
| Security | 4/10 | API key in sync storage, unauthenticated backend, localStorage for config URL |
| Code Quality | 5/10 | Massive duplication (~3× every module), dead code, inconsistent typing |
| Documentation | 8/10 | README is thorough and accurate for the primary flow |
| **Overall** | **5/10** | **Beta quality. Core feature works. Not ready for Chrome Web Store or production use.** |

---

## 10. Improvement Suggestions

### Priority 1 — Fix Broken Core Features

**1. Add `'tts'` handler in `background.ts`**
```typescript
case 'tts':
  // Proxy TTS request to OpenAI TTS API or other provider
  // Return blobUrl to content script
  this.callTTS(request.text, request.lang)
    .then(blobUrl => sendResponse({ ok: true, blobUrl }))
    .catch(() => sendResponse({ ok: false }));
  return true;
```

**2. Replace `window.prompt()` with inline input for API key in popup**
```html
<!-- In popup.html, add per-provider input section -->
<input type="password" id="api-key-input" placeholder="sk-..." autocomplete="off">
<button id="save-key-btn">Save Key</button>
```

**3. Add `chrome.storage.onChanged` listener in `content.ts`**
```typescript
chrome.storage.onChanged.addListener((changes) => {
  if (changes.config) {
    this.config = changes.config.newValue;
    this.state.currentLanguage = this.config.language;
    this.voiceManager.updateLanguage(this.config.language);
  }
});
```

**4. Fix `server.js` model name**
```javascript
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // not gpt-5-mini
```

**5. Add `/api/tts` route to `server.js`**
```javascript
app.post('/api/tts', async (req, res) => {
  const { text, lang } = req.body;
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy' })
  });
  const buffer = await r.arrayBuffer();
  res.set('Content-Type', 'audio/mpeg').send(Buffer.from(buffer));
});
```

### Priority 2 — Eliminate Duplication

6. **Delete all files in `src/background/`, `src/content/`, `src/popup/`** — dead legacy code.
7. **Delete `src/providers/providers.ts`** — or integrate Claude support into `background.ts`.
8. **Delete root `manifest.json`** — keep only `public/manifest.json`.
9. **Remove `webpack.config.js`** — the project uses Vite exclusively.
10. **Move `buildPrompt()` and `getLanguageFlag()` to `src/utils.ts`** and import from both `background.ts` and `popup.ts`.

### Priority 3 — Security Hardening

11. **Move API keys to `chrome.storage.local`** (not `sync`) to prevent cross-profile leakage.
12. **Add basic auth to `server.js`** (Bearer token or signed request) so only your extension can call it.
13. **Remove `localStorage` for `bff_url`** — add proper input in popup Settings tab, store in `chrome.storage.local`.
14. **Add prompt injection guard**: sanitize `elementData.label` before inserting into prompts:
    ```typescript
    const safeLabel = (elementData.label || '').replace(/[`"]/g, '').substring(0, 100);
    ```

### Priority 4 — Code Quality

15. **Fix tooltip memory leak** — store setTimeout ID and clearTimeout before creating a new tooltip:
    ```typescript
    private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
    // In showTooltip:
    if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
    this.tooltipTimer = setTimeout(() => this.hideTooltip(), 10000);
    ```

16. **Fix Object URL leak** — call `URL.revokeObjectURL` when evicting from `audioCache` (implement an LRU with max 20 entries).

17. **Fix tooltip position** — use `position: absolute` with `scrollX/scrollY` OR `position: fixed` without scroll offsets. Currently mixes both incorrectly.

18. **Add a `ProviderKey` union type** in `types.ts`:
    ```typescript
    export type ProviderKey = 'openai' | 'groq' | 'gemini' | 'claude';
    ```

19. **Fix `ttsVoice` generation** in `addLanguage()`:
    ```typescript
    const voiceMap: Record<string, string> = { ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN' };
    ttsVoice: voiceMap[code] || `${code}-${code.toUpperCase()}`
    ```

20. **Move all build-tool packages from `dependencies` to `devDependencies`**.

### Priority 5 — New Features

21. **Implement Analytics tab** — track elements explained, languages used, API calls, errors (stored in `chrome.storage.local`)
22. **Add `chrome.runtime.onInstalled` handler** — set up config on first install, show onboarding page
23. **Support iframes** — use `all_frames: true` in manifest content_scripts for forms inside iframes
24. **Add keyboard shortcut** — register `chrome.commands` in manifest to toggle tutor without mouse
25. **Add `aria-live="polite"` region** for tooltip text so screen readers announce explanations

---

## 11. Priority Action Plan

```
IMMEDIATE (blocks basic usage)
├── Fix API key input UI (window.prompt → inline password field)
├── Fix server.js model name (gpt-5-mini → gpt-4o-mini)
├── Add 'tts' message handler in background.ts
└── Fix the broken test (activeProvider: 'openai' → 'groq')

SHORT TERM (cleanup)
├── Delete src/background/, src/content/, src/popup/ legacy folders
├── Delete src/providers/providers.ts (dead code)
├── Delete root manifest.json duplicate
├── Remove webpack.config.js
├── Fix tooltip scroll offset bug (fixed + scrollX conflict)
└── Add chrome.storage.onChanged for live config reload

MEDIUM TERM (security + quality)
├── Move API keys to chrome.storage.local
├── Add server.js authentication
├── Fix localStorage bff_url → chrome.storage
├── Fix tooltip clearTimeout memory leak
├── Fix Object URL cache leak
├── Add ProviderKey union type
└── Move devDependencies out of dependencies

LONG TERM (feature completeness)
├── Implement Analytics tab
├── Add Claude provider to background.ts
├── Add /api/tts to server.js
├── Add keyboard shortcut
├── Add aria-live region for accessibility
└── Support iframe forms
```

---

*Audit performed by reviewing 18 source files, ~2,500 lines of TypeScript/JavaScript/CSS/JSON/HTML. All findings are based on static analysis of actual code.*
