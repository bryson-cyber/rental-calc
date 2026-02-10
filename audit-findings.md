# cc-optimize Audit Findings

## Bundle Size (CRITICAL)
- Main chunk: 7,114 KB (1,473 KB gzipped) — far exceeds 200KB target
- Heavy dependencies: mermaid (408KB), cytoscape (442KB), html2canvas (202KB), wolfram (262KB)
- No code splitting — everything in one chunk
- Server bundle: 1.5MB

## Large Files (Code Smell)
- server/airdna.ts: 8,249 lines (should be split)
- server/routers.ts: 7,880 lines (should be split into feature routers)
- client/src/pages/LeadMagnet.tsx: 6,570 lines (monolithic component)
- server/sop-reports.ts: 4,300 lines
- server/gemini-analyzer.ts: 4,262 lines

## Database
- 0 indexes defined in schema.ts (1,811 lines of schema)
- Missing indexes on frequently queried columns

## Quick Wins to Apply
1. Add lazy loading / code splitting for heavy pages
2. Add database indexes for common queries
3. These are long-term refactors — not blocking the agentic features
