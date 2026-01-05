# Browser Use Skills API Reference

## Overview
Skills are reusable API endpoints that you create once and call repeatedly.
- Generation: FREE
- Execution: $0.01 per call

## Endpoints

### Create Skill
```
POST /api/v2/skills
Headers: X-Browser-Use-API-Key: <apiKey>
Body: {
  "goal": "string (required, <=1000 chars)",
  "agentPrompt": "string (required, >=10 chars)",
  "title": "string (optional)",
  "description": "string (optional)"
}
Response (202): { "id": "uuid" }
```

### Get Skill
```
GET /api/v2/skills/{skill_id}
Headers: X-Browser-Use-API-Key: <apiKey>
Response: {
  "id": "uuid",
  "status": "created" | "generating" | "finished" | "failed",
  "parameters": { ... },  // JSON schema for input parameters
  "outputSchema": { ... } // JSON schema for output
}
```

### Execute Skill
```
POST /api/v2/skills/{skill_id}/execute
Headers: X-Browser-Use-API-Key: <apiKey>
Body: {
  "parameters": { ... }  // Optional, matches skill's parameter schema
}
Response (200): {
  "success": boolean,
  "error": "string" | null,
  "stderr": "string" | null,
  "latencyMs": number | null
}
```

### List Skills
```
GET /api/v2/skills
Headers: X-Browser-Use-API-Key: <apiKey>
Response: { "items": [...], "totalItems": number }
```

### Refine Skill
```
POST /api/v2/skills/{skill_id}/refine
Headers: X-Browser-Use-API-Key: <apiKey>
Body: {
  "feedback": "string"  // Describe what to improve
}
```

## Workflow
1. Create skill with goal and agentPrompt
2. Poll status until "finished"
3. Execute skill with parameters
4. If execution fails, refine with feedback

## Notes
- Skills build asynchronously (may take 1-5 minutes)
- Once built, execution is instant
- Skills can be reused across multiple requests
- Each execution is independent (no session conflicts)
