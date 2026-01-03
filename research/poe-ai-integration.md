# Poe AI Integration Research

## Key Findings from Documentation

### Overview
- External applications connect to Poe via a user's API key
- Uses Poe API to query Poe bots and models on behalf of that user
- Points are charged to the account associated with the API key

### Getting Started
1. Get API Key from: https://poe.com/api_key
2. Install: `pip install fastapi-poe`

### Python Usage (Sync)
```python
import fastapi_poe as fp

api_key = "<api_key>"
message = fp.ProtocolMessage(role="user", content="Hello world")

for partial in fp.get_bot_response_sync(messages=[message], bot_name="GPT-5", api_key=api_key):
    print(partial)
```

### Python Usage (Async)
```python
import asyncio
import fastapi_poe as fp

async def get_response():
    api_key = "<api_key>"
    message = fp.ProtocolMessage(role="user", content="Hello world")
    async for partial in fp.get_bot_response(messages=[message], bot_name="GPT-5", api_key=api_key):
        print(partial)
```

### OpenAI Compatible API
Poe also offers an OpenAI-compatible API endpoint:
- Base URL: `https://api.poe.com/v1`
- Can use standard OpenAI client library

```python
import os, openai

client = openai.OpenAI(
    api_key=os.getenv("POE_API_KEY"),
    base_url="https://api.poe.com/v1",
)

chat = client.chat.completions.create(
    model="Claude-Opus-4.1",
    messages=[{"role": "user", "content": "Hello"}],
)
print(chat.choices[0].message.content)
```

### Rate Limits
- 500 requests per minute per user

### Available Models (via bot_name)
- GPT-5
- Claude-Sonnet-4.5
- Claude-Opus-4.1
- Imagen-4 (for images)
- Many more bots available on Poe

### Custom Parameters
Can pass model-specific parameters:
- `thinking_budget` for Claude models
- `reasoning_effort` for GPT models
- `aspect_ratio` for image generation

## Integration Plan for Rental Calculator

### Option 1: Use fastapi_poe library (Python)
- Would need to create a Python service or use subprocess
- More complex but native Poe integration

### Option 2: Use OpenAI-compatible API (Recommended)
- Can use existing OpenAI client patterns in TypeScript/Node.js
- Just change base_url to `https://api.poe.com/v1`
- Use POE_API_KEY instead of OPENAI_API_KEY
- Model names are Poe bot names (e.g., "Claude-Sonnet-4.5")

### Implementation Steps
1. Request POE_API_KEY from user via webdev_request_secrets
2. Create poe-ai.ts service using OpenAI-compatible API
3. Replace Gemini calls with Poe AI calls
4. Test with Claude-Sonnet-4.5 or GPT-5
