# Manus Prompt: Model Routing for `rental-calc`

**Objective:** When working on the `rental-calc` repository, you MUST use a hybrid model strategy. Use this document as the single source of truth for deciding whether to use the high-reasoning model (**Opus 4.6**) or the fast, efficient model (**Sonnet 4.6**) for any given task. The file `server/llm-provider.ts` is designed to handle this routing via the `model: 'pro'` (Opus) and `model: 'flash'` (Sonnet) options.

## Guiding Principle

- **Use Opus 4.6 (`model: 'pro'`) for:** Complex, multi-step reasoning, deep analysis, autonomous agentic tasks, and generating the final, client-facing narrative reports. These are high-value, low-frequency tasks where reasoning quality is paramount.
- **Use Sonnet 4.6 (`model: 'flash'`) for:** Routine data processing, simple Q&A, user-facing interactive features, and internal content generation. These are high-frequency, low-latency tasks where speed and cost-efficiency are critical.

--- 

## Feature-to-Model Mapping

| Feature / Task | File(s) Involved | Recommended Model | Justification |
| :--- | :--- | :--- | :--- |
| **Deep Analysis & Narrative Reports** | `deep-analysis.ts`, `gemini-analyzer-enhanced.ts`, `sop-reports.ts` | **Opus 4.6 (`pro`)** | This is the core value proposition. It requires synthesizing dozens of data points (AirDNA, comps, financials) into a persuasive investment thesis. This task directly maps to Opus's strengths in `Graduate-level reasoning` and `Novel problem-solving`. **Quality is non-negotiable here.** |
| **Agentic Deal Finding** | `deal-alert-agent.ts`, `opportunity-finder.ts` | **Opus 4.6 (`pro`)** | These are autonomous agents that must perform complex web searches (Zillow, Redfin), analyze the results, and make decisions. This requires the superior `Agentic search` and `Agentic computer use` capabilities of Opus to be reliable. |
| **Market Research & Regulation Tracking** | `market-research-v2.ts`, `regulation-tracker.ts` | **Opus 4.6 (`pro`)** | These tasks involve agentic web browsing and synthesizing information from unstructured legal and news sources. Opus's stronger reasoning is required to accurately interpret complex regulatory language and market news. |
| **AI Advisor (Complex & Multi-Step Queries)** | `ai-advisor-enhanced.ts`, `ai-advisor.ts` | **Opus 4.6 (`pro`)** | When the user asks a complex, open-ended question that requires the AI to call multiple tools, compare markets, or form a strategy, Opus must be used. This is for the "enhanced" or "pro" level of the advisor. |
| **AI Advisor (Simple, Single-Tool Queries)** | `ai-advisor.ts` | **Sonnet 4.6 (`flash`)** | For simple, factual questions that can be answered with a single function call to the AirDNA API (e.g., "What is the occupancy rate in Austin?"). Sonnet is faster, cheaper, and perfectly capable of this. |
| **Financial Calculations & Summaries** | `export-excel.ts`, `AmortizationSchedule.tsx`, `BreakEvenCalculator.tsx` | **Sonnet 4.6 (`flash`)** | Sonnet **outperforms** Opus on `Agentic financial analysis` and `Office tasks`. Any task involving summarizing numbers, filling out a spreadsheet, or performing structured financial calculations should use Sonnet. |
| **Content & Video Script Generation** | `content-studio.ts`, `newsletter-content-generator.ts`, `video-generation.ts` | **Sonnet 4.6 (`flash`)** | These are creative writing tasks. While the data inputs may be complex, the final output is text generation. Sonnet is highly capable, fast, and cost-effective for generating marketing copy, scripts, and newsletters. |
| **Language Translation** | `translation-service.ts`, `GlobalAutoTranslator.tsx` | **Sonnet 4.6 (`flash`)** | The performance of Sonnet and Opus on `Multilingual Q&A` is nearly identical (89.3% vs 91.1%). There is no justification for using the more expensive model. Use Sonnet for all translation tasks. |
| **Data Extraction from Scrapers** | `hasdata-zillow.ts`, `hasdata-redfin.ts`, `airbnb-scraper.ts` | **Sonnet 4.6 (`flash`)** | The task here is to extract structured data from a semi-structured HTML or JSON input. This is a pattern-matching and data-formatting task, not a deep reasoning problem. Sonnet is the efficient choice. |
| **Generating UI Text & Summaries** | `gemini.ts` (most functions) | **Sonnet 4.6 (`flash`)** | Generating short descriptions, UI labels, or simple summaries of data for display in components like `PropertyCard` or `MarketInsightsPanel` should always use Sonnet for speed. |

## Implementation Rules

1.  **Default to Sonnet 4.6 (`flash`).** Unless a task explicitly requires deep, multi-step reasoning or high-stakes agentic action, use the faster, cheaper model.
2.  **Identify High-Reasoning Tasks.** Before making an LLM call, evaluate the task. Does it involve creating a final, client-facing analytical report? Does it require the AI to act autonomously on the web? Does it involve synthesizing more than 5-7 distinct data sources into a novel conclusion? If yes, use **Opus 4.6 (`pro`)**.
3.  **Use the `model` Parameter.** When calling `callLLM` or `callLLMMax` in `llm-provider.ts`, explicitly pass `model: 'pro'` for Opus or `model: 'flash'` for Sonnet. This is the designated mechanism for routing.

**Example Code Modification in `server/routers/ai.ts`:**

```typescript
// For a simple, fast query
const simpleResult = await callLLM(prompt, { model: 'flash' });

// For a deep, analytical report
const deepResult = await callLLM(prompt, { model: 'pro', thinkingLevel: 'high' });
```
