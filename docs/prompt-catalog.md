# Prompt Catalog — Files Requiring Claude Optimization

## Files that make direct Gemini API calls (need both prompt update AND callLLM migration)

### 1. gemini.ts (7 functions) — ALREADY migrated to callLLM
- generatePropertyNarrative
- generateEnhancedMarketReport
- generateMarketTrendNarrative
- getInvestmentAdvice
- generateComprehensivePropertyAdvice
- generateMaxPropertyAdvice / generateMaxMarketAdvice
- generateFullReportSummary

### 2. gemini-analyzer.ts (~12 functions) — Still uses direct Gemini fetch
- callGeminiWithSchema (core function)
- analyzePropertyPhotos
- generatePropertyInsights
- generateCompetitorPatterns
- generateInvestmentVerdict
- generatePricingStrategy
- generateRiskAssessment
- generateLaunchRoadmap
- generateFullAnalysis
- generateRegulationInfo
- generateBeginner* functions (3)
- generateHistoricalAnalysis
- generateComprehensiveReport

### 3. gemini-analyzer-enhanced.ts — Still uses direct Gemini fetch
- generateEnhancedAnalysis (main function)

### 4. gemini-streaming.ts — Still uses direct Gemini fetch (streaming)
- streamGeminiChat (SSE streaming — special case)

### 5. ai-advisor.ts — Still uses direct Gemini fetch
- Main chat function with tool calling

### 6. ai-fallback.ts — Still uses direct Gemini fetch
- generateFallbackSummary

### 7. content-studio.ts — Still uses direct Gemini fetch
- generateContent (lesson/deep-dive generation)

### 8. newsletter-content-generator.ts — Still uses direct Gemini fetch
- generateNewsletterContent

### 9. regulation-tracker.ts — Still uses direct Gemini fetch
- callGeminiForRegulations
- Research prompts

### 10. deep-analysis.ts — Uses invokeLLM (built-in helper)
- callAI (6+ prompts)

### 11. opportunity-finder.ts — Browser scraping prompts (not LLM)
- createRentalScrapingPrompt (browser automation, not LLM)

### 12. market-research.ts / market-research-v2.ts — Browser scraping prompts
- buildComprehensivePrompt (browser automation, not LLM)

## Anti-patterns to fix (from Claude best practices):
1. "IMPORTANT:" prefix — replace with XML tags or clear structure
2. "DO NOT" repeated — consolidate into <constraints> block
3. "Be thorough" / "Be comprehensive" — anti-laziness, remove
4. "Make sure to" — vague, replace with explicit instructions
5. "You are a..." without clear task — add explicit task description
6. Persona mixed with instructions — separate into <persona> and <task>
7. Missing output format specification — add <output_format> tags
