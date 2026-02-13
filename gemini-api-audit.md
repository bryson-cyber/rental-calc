# Gemini API Compliance Audit Report

**Project:** Coach Inayah Turnkey Tool (rental-calculator)
**Date:** February 12, 2026
**Audit Standard:** `gemini-api-dev` Skill Guidelines

---

## Executive Summary

The codebase has **12 server-side files** that interact with the Gemini API. One file (`gemini.ts`) has been properly upgraded to Gemini 3 models and follows current best practices. However, **8 other files still use deprecated models and/or the deprecated SDK**, creating an inconsistent and non-compliant state. The audit identified **3 critical issues**, **2 moderate issues**, and **2 minor issues**.

---

## What's Going RIGHT

These areas are fully compliant with the `gemini-api-dev` skill guidelines.

### 1. `gemini.ts` — Fully Compliant (Gold Standard)

This is the primary Gemini service file and it follows every guideline correctly:

| Criterion | Status | Details |
|-----------|--------|---------|
| Model names | Correct | Uses `gemini-3-pro-preview` and `gemini-3-flash-preview` |
| API version | Correct | Uses `v1beta` endpoint |
| Thinking config | Correct | Uses `thinkingLevel` with appropriate levels (`high` for complex analysis, `medium` for chat, `low` for simple tasks) |
| Temperature | Correct | Uses `1.0` as recommended by Gemini 3 docs for reasoning |
| Model selection | Correct | Pro for complex reasoning, Flash for fast chat |
| Direct REST API | Acceptable | Uses `fetch()` against REST endpoint (valid alternative to SDK) |
| API key handling | Correct | Server-side only via `ENV.geminiApiKey`, never exposed to client |
| PTCF prompting | Correct | Comments reference Persona, Task, Context, Format framework |

### 2. Server-Side Only API Calls

All Gemini API calls are made exclusively from server-side code. No client-side files import or call the Gemini API directly. This is correct — API keys are never exposed to the browser.

### 3. API Version (`v1beta`)

Every file that makes direct REST API calls uses the `v1beta` endpoint, which is the correct version per the skill guidelines. The SDKs also target `v1beta` by default.

### 4. Function Calling Pattern (`ai-advisor.ts`)

The function calling implementation in `ai-advisor.ts` uses the correct Gemini-native format with `functionDeclarations`, `functionCall`, and `functionResponse` — not the OpenAI-style format. The multi-turn function calling loop (call → execute → return results → call again) is implemented correctly.

### 5. Google Search Grounding (`regulation-tracker.ts`)

The regulation tracker correctly uses the `google_search` tool via the REST API, which is a valid Gemini capability for grounding responses with real-time web data.

### 6. `invokeLLM` Helper (Manus Built-in)

The `_core/llm.ts` helper routes through the Manus Forge API proxy, which handles model routing internally. Files using `invokeLLM` (`behavior-engine.ts`, `deal-alert-agent.ts`, `deep-analysis.ts`) are correctly delegating model selection to the platform.

---

## What Needs Fixing

### CRITICAL: Deprecated SDK (`@google/generative-ai`)

> The skill explicitly warns: *"Legacy SDKs `google-generativeai` (Python) and `@google/generative-ai` (JS) are deprecated. Migrate to the new SDKs above urgently."*

**Current state:** The project uses `@google/generative-ai` v0.24.1. The new SDK `@google/genai` is **not installed**.

| File | Import | Issue |
|------|--------|-------|
| `gemini-streaming.ts` | `import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'` | Deprecated SDK |
| `newsletter-content-generator.ts` | `import { GoogleGenerativeAI } from '@google/generative-ai'` | Deprecated SDK |
| `package.json` | `"@google/generative-ai": "^0.24.1"` | Deprecated dependency |

**Impact:** These two files are the only ones using the SDK (all other files use direct `fetch()` REST calls). The deprecated SDK may stop receiving updates, security patches, and eventually break when Google removes legacy API support.

**Fix:** Install `@google/genai`, migrate both files to the new SDK pattern (`GoogleGenAI` class with `ai.models.generateContent()`), then remove `@google/generative-ai` from `package.json`.

---

### CRITICAL: Deprecated Model Names (8 Files)

> The skill states: *"Models like `gemini-2.5-*`, `gemini-2.0-*`, `gemini-1.5-*` are legacy and deprecated. Use the new models above."*

The current models are `gemini-3-pro-preview` and `gemini-3-flash-preview`. The following files use deprecated model names:

| File | Deprecated Model | Should Be |
|------|-----------------|-----------|
| `ai-advisor.ts` | `gemini-2.5-pro` | `gemini-3-pro-preview` |
| `ai-advisor-enhanced.ts` | `gemini-2.5-pro` | `gemini-3-pro-preview` |
| `gemini-analyzer.ts` | `gemini-2.5-pro` | `gemini-3-pro-preview` |
| `gemini-analyzer-enhanced.ts` | `gemini-2.5-pro` | `gemini-3-pro-preview` |
| `ai-fallback.ts` (Gemini Direct) | `gemini-2.0-flash` | `gemini-3-flash-preview` |
| `ai-fallback.ts` (Forge) | `gemini-2.5-flash` | `gemini-3-flash-preview` |
| `gemini-streaming.ts` | `gemini-2.0-flash` | `gemini-3-flash-preview` |
| `newsletter-content-generator.ts` (3 calls) | `gemini-2.0-flash` | `gemini-3-flash-preview` |
| `regulation-tracker.ts` | `gemini-2.5-flash` | `gemini-3-flash-preview` |

**Impact:** Deprecated models may be removed by Google at any time, causing all AI features in these files to break simultaneously. The `gemini-2.0-flash` model is two generations behind.

**Fix:** Update all `GEMINI_API_URL` constants and `MODEL_NAME` values to use `gemini-3-pro-preview` (for complex analysis) or `gemini-3-flash-preview` (for fast/simple tasks).

---

### CRITICAL: Missing Thinking Configuration (7 Files)

The `gemini.ts` file correctly uses `thinkingConfig` with appropriate levels. However, **none of the other files that make direct Gemini API calls** include thinking configuration, even though they use models that support it.

| File | Has thinkingConfig? | Recommended |
|------|-------------------|-------------|
| `gemini.ts` | Yes | Already correct |
| `ai-advisor.ts` | No | `high` (complex function calling + analysis) |
| `ai-advisor-enhanced.ts` | No | `high` (enhanced analysis) |
| `gemini-analyzer.ts` | No | `high` (property analysis) |
| `gemini-analyzer-enhanced.ts` | No | `high` (enhanced narrative reports) |
| `ai-fallback.ts` | No | `medium` (fallback, speed matters) |
| `regulation-tracker.ts` | No | `medium` (search + analysis) |

**Impact:** Without thinking enabled, Gemini 3 models produce lower-quality reasoning. The skill recommends `thinkingLevel: 'high'` for complex analysis tasks.

---

### MODERATE: Fragile JSON Parsing (No Structured Output)

The `gemini-analyzer.ts` file has **12 instances** of regex-based JSON extraction (`response.match(/\{[\s\S]*\}/)` or `response.match(/\[[\s\S]*\]/)`) followed by `JSON.parse()`. This is fragile — if the model includes any text before/after the JSON, or nests JSON objects, the regex can fail.

**Current pattern (fragile):**
```typescript
const response = await callGemini(prompt);
const jsonMatch = response.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  return JSON.parse(jsonMatch[0]);
}
throw new Error('Could not parse JSON');
```

**Recommended pattern (Gemini structured output):**
```typescript
// Use responseMimeType: "application/json" with responseSchema
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: { /* your schema */ }
}
```

The `newsletter-content-generator.ts` already uses `responseMimeType: 'application/json'` correctly, but without a `responseSchema` to enforce structure. The `gemini-analyzer.ts` uses it in one place (the `callGeminiStructured` function) but not in the 12 other functions that parse JSON manually.

---

### MODERATE: Inconsistent API Key Access

Three different patterns are used to access the Gemini API key:

| Pattern | Files | Correct? |
|---------|-------|----------|
| `ENV.geminiApiKey` | `gemini.ts`, `gemini-analyzer.ts`, `ai-advisor.ts`, `ai-fallback.ts`, `regulation-tracker.ts` | Yes (centralized) |
| `process.env.GEMINI_API_KEY` | `gemini-streaming.ts`, `newsletter-content-generator.ts` | Inconsistent |
| `process.env.GEMINI_API_KEY` (check only) | `newsletter-router.ts` | Acceptable for health check |

**Fix:** All files should use `ENV.geminiApiKey` from `_core/env.ts` for consistency and to ensure the value is validated at startup.

---

### MINOR: System Prompt Workaround

Both `gemini-streaming.ts` and `regulation-tracker.ts` use a workaround to simulate system prompts by injecting them as fake user/model message pairs:

```typescript
// Workaround pattern
history.push({
  role: 'user',
  parts: [{ text: `System Instructions: ${systemPrompt}` }],
});
history.push({
  role: 'model',
  parts: [{ text: 'I understand...' }],
});
```

The Gemini API natively supports system instructions via the `systemInstruction` field in the request body. Using the native field is more reliable and doesn't consume input tokens with fake conversation turns.

---

### MINOR: Temperature Not Updated for Gemini 3

Several files use low temperature values (0.1–0.3) which were common for older models. The Gemini 3 documentation recommends `temperature: 1.0` for optimal reasoning performance. While lower temperatures are acceptable for deterministic outputs, the files should be reviewed to ensure the temperature choice is intentional.

| File | Temperature | Context |
|------|------------|---------|
| `regulation-tracker.ts` | 0.1 | Structured data extraction — low temp is appropriate |
| `gemini-analyzer.ts` | 0.3 | Structured output — low temp is appropriate |
| `newsletter-content-generator.ts` | 0.6–0.8 | Creative content — could benefit from 1.0 |
| `gemini.ts` | 1.0 | Already correct per Gemini 3 guidelines |

---

## File-by-File Compliance Summary

| File | SDK | Model | Thinking | Structured Output | API Key | Overall |
|------|-----|-------|----------|-------------------|---------|---------|
| `gemini.ts` | REST (OK) | gemini-3-* ✅ | Yes ✅ | N/A | ENV ✅ | **COMPLIANT** |
| `ai-advisor.ts` | REST (OK) | gemini-2.5-pro ❌ | No ❌ | N/A | ENV ✅ | Needs update |
| `ai-advisor-enhanced.ts` | REST (OK) | gemini-2.5-pro ❌ | No ❌ | N/A | ENV ✅ | Needs update |
| `gemini-analyzer.ts` | REST (OK) | gemini-2.5-pro ❌ | No ❌ | Fragile ⚠️ | ENV ✅ | Needs update |
| `gemini-analyzer-enhanced.ts` | REST (OK) | gemini-2.5-pro ❌ | No ❌ | N/A | ENV ✅ | Needs update |
| `ai-fallback.ts` | REST (OK) | gemini-2.0/2.5 ❌ | No ❌ | N/A | ENV ✅ | Needs update |
| `gemini-streaming.ts` | Deprecated ❌ | gemini-2.0-flash ❌ | No ❌ | N/A | process.env ⚠️ | Needs migration |
| `newsletter-content-generator.ts` | Deprecated ❌ | gemini-2.0-flash ❌ | No ❌ | Partial ⚠️ | process.env ⚠️ | Needs migration |
| `regulation-tracker.ts` | REST (OK) | gemini-2.5-flash ❌ | No ❌ | N/A | ENV ✅ | Needs update |
| `behavior-engine.ts` | invokeLLM ✅ | Delegated ✅ | N/A | Yes ✅ | N/A ✅ | **COMPLIANT** |
| `deal-alert-agent.ts` | invokeLLM ✅ | Delegated ✅ | N/A | N/A | N/A ✅ | **COMPLIANT** |
| `deep-analysis.ts` | invokeLLM ✅ | Delegated ✅ | N/A | N/A | N/A ✅ | **COMPLIANT** |

---

## Recommended Fix Priority

1. **Update all model names** to `gemini-3-pro-preview` or `gemini-3-flash-preview` (8 files, ~15 min)
2. **Migrate deprecated SDK** from `@google/generative-ai` to `@google/genai` (2 files, ~30 min)
3. **Add thinkingConfig** to direct API calls (6 files, ~20 min)
4. **Standardize API key access** to use `ENV.geminiApiKey` everywhere (2 files, ~5 min)
5. **Replace regex JSON parsing** with `responseMimeType` + `responseSchema` (12 call sites, ~1 hr)
6. **Use native systemInstruction** instead of fake message pairs (2 files, ~10 min)

---

## Note on `invokeLLM` Helper

The Manus built-in `invokeLLM` helper in `_core/llm.ts` defaults to `model: 'gemini-2.5-flash'` (line 283). This is technically a deprecated model name, but since it routes through the Manus Forge API proxy which may handle model aliasing internally, this is a **platform-level concern** rather than a codebase concern. The files using `invokeLLM` are considered compliant because they delegate model selection to the platform.
