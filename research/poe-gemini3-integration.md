# Poe Gemini 3 Integration for Photo Analysis

## Key Findings from Poe API Documentation

### Available Models
- `Gemini-3-Pro` - Google's Gemini 3 Pro model (multimodal, supports images)
- `Gemini-2.5-Pro` - Google's Gemini 2.5 Pro model
- `Claude-Opus-4.1` - Already using for narratives
- `Claude-Sonnet-4` - Alternative Claude model

### Image Input Support
Poe API supports image inputs in two ways:

1. **Base64-encoded data URLs**:
```python
with open("test_image.jpeg", "rb") as f:
    base64_image = base64.b64encode(f.read()).decode("utf-8")

messages=[{
    "role": "user",
    "content": [
        {"type": "text", "text": "Analyze this image"},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
    ]
}]
```

2. **Publicly accessible URLs**:
```python
messages=[{
    "role": "user",
    "content": [
        {"type": "text", "text": "Please describe these attachments."},
        {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
    ]
}]
```

### Model for Photo Analysis
- Use `Gemini-3-Pro` for photo analysis (multimodal support)
- Set `stream=False` for media bots for optimal performance

### Implementation Plan
1. Add `callPoeVision` function to poe-ai.ts
2. Support both URL and base64 image inputs
3. Use Gemini-3-Pro model for image analysis
4. Update photo analysis in sop-reports.ts to use Poe instead of direct Gemini API
