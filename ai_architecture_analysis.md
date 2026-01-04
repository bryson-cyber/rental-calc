# AI Architecture Analysis - Rental Calculator

## Current Setup

The app currently uses **Gemini 2.0 Flash** via direct API for:
- Function calling (AI advisor)
- Narrative report generation
- Image analysis

And **Poe API** (Claude Sonnet 4, Gemini 3 Pro) for:
- Enhanced narrative reports
- Vision/image analysis

## Gemini API Rate Limits (from ai.google.dev)

### Free Tier
- Very limited (for testing only)
- Not suitable for production

### Tier 1 (Paid billing account linked)
- Gemini 2.0 Flash: 10,000,000 batch enqueued tokens
- Higher RPM/TPM limits than free tier

### Tier 2 (>$250 spend + 30 days)
- Higher limits

### Tier 3 (>$1,000 spend + 30 days)
- Highest limits

### Key Points:
- Rate limits are per PROJECT, not per API key
- RPD (requests per day) resets at midnight Pacific time
- Gemini 2.0 Flash is a "flash" model - optimized for speed, NOT quality
- For expert-level output, need Gemini Pro or Claude models

## Model Quality Comparison

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| Gemini 2.0 Flash | Fast | Medium | Function calling, quick tasks |
| Gemini 2.5 Pro | Slower | High | Complex analysis, expert writing |
| Claude Sonnet 4 | Medium | High | Expert narrative writing |
| Claude Opus 4.1 | Slower | Highest | Best quality writing |

## Current Problem

The app uses **Gemini 2.0 Flash** for narrative generation - this is a SPEED-optimized model, not a QUALITY-optimized model. This explains why the output isn't "expert level."

## Poe API Findings (from creator.poe.com)

### Rate Limits
- **500 requests per minute (RPM)** - very generous!
- Uses subscription points (no per-request billing)
- Add-on points available if subscription isn't enough

### Available Models via Poe
| Model | Quality | Notes |
|-------|---------|-------|
| Claude Opus 4.5 | Highest | Best for expert writing |
| Claude Opus 4.1 | Very High | Great for narratives |
| Claude Sonnet 4.5 | High | Good balance |
| Claude Sonnet 4 | High | Currently used |
| Claude Haiku 4.5 | Medium | Fast, cheaper |
| Gemini 3 Pro | High | Via OpenAI-compatible API |

### Key Benefits
- Use existing Poe subscription points
- Drop-in replacement for Anthropic API
- 500 RPM is MORE than enough for this app
- Access to Claude Opus (highest quality writing)

### Pricing
- Subscriptions start at $4.99/month
- Points work across web and API
- Can purchase add-on points as needed


## Current Architecture Analysis

### What's Using What:

| Component | Current AI | Purpose |
|-----------|-----------|---------|
| AI Advisor (function calling) | Gemini 2.0 Flash | Tool orchestration |
| Basic Narrative Report | Gemini 2.0 Flash | Quick summaries |
| Enhanced Narrative Report | Poe (Claude Sonnet 4) | Expert analysis |
| Image Analysis | Poe (Gemini 3 Pro) | Photo evaluation |

### The Problem
- Gemini 2.0 Flash is used for the **basic narrative report** which feeds into the Market Intelligence card
- This is a SPEED model, not a QUALITY model
- The enhanced narrative uses Claude Sonnet 4 via Poe, which is better but still not the highest quality

---

## RECOMMENDATION

### Option 1: Consolidate on Poe (RECOMMENDED)
**Upgrade the enhanced narrative to use Claude Opus 4.1 or 4.5**

Pros:
- Claude Opus is the HIGHEST quality writing model available
- 500 RPM is more than enough (you'd need ~8 requests per analysis max)
- Single billing through Poe subscription
- Already have Poe API key configured

Cons:
- Slightly higher point cost per request
- Slower than Sonnet (but quality is worth it)

### Option 2: Add Direct Anthropic API
Get a separate Anthropic API key for Claude Opus access.

Pros:
- Direct access, no middleman

Cons:
- Additional API key to manage
- Separate billing
- No real advantage over Poe

### Option 3: Upgrade Gemini to Pro
Use Gemini 2.5 Pro instead of 2.0 Flash.

Pros:
- Better quality than Flash
- Same API key

Cons:
- Still not as good as Claude Opus for writing
- Higher cost per token
- Need to upgrade tier for higher limits

---

## IMPLEMENTATION PLAN (If choosing Option 1)

1. **Change model in poe-narrative.ts** from `Claude-Sonnet-4` to `Claude-Opus-4.1`
2. **Increase maxTokens** from 1024 to 2048 for more comprehensive output
3. **Keep Gemini 2.0 Flash** for function calling (it's good at that)
4. **Remove basic narrative generation** from Gemini - use Poe for all narratives

### Cost Estimate
- Poe subscription: $4.99-$19.99/month
- Each analysis uses ~1-2 Poe points for the narrative
- At 100 analyses/day = 100-200 points/day
- Standard subscription should cover this easily

