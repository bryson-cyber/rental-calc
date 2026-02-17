# Claude Prompting Best Practices (Opus 4.6 / Sonnet 4.6)

## Key Takeaways for Our Report Narratives

### 1. Be Explicit
- Describe exactly what you want in the output
- Use modifiers: "Go beyond the basics to create a fully-featured implementation"
- Request specific features explicitly (e.g., animations, interactive elements)

### 2. Add Context / Motivation
- Explain WHY instructions matter (e.g., "this report will be shown to potential investors")
- Claude generalizes from explanations

### 3. Be Vigilant with Examples
- Claude pays close attention to details and examples
- Ensure examples align with desired behaviors

### 4. Communication Style (4.6 models)
- More direct and grounded
- Fact-based progress reports rather than self-celebratory
- More conversational, less machine-like
- Less verbose unless prompted otherwise

### 5. Format Control
- Tell Claude what TO DO (not what NOT to do)
- Use XML format indicators for structure
- Match prompt style to desired output style
- Use `<avoid_excessive_markdown_and_bullet_points>` tags for prose output

### 6. Remove Anti-Laziness Prompts
- Remove "be thorough", "think carefully", "do not be lazy"
- These amplify already-proactive behavior on 4.6 models
- Use effort parameter as primary control lever instead

### 7. Thinking / Adaptive Thinking
- Opus 4.6 uses adaptive thinking: `thinking: {type: "adaptive"}`
- Use effort parameter: "high" for quality, "medium" for balance, "low" for speed
- Set large max_tokens (64k recommended) at medium/high effort
- For our Max reports (large context), use "high" effort for comprehensive analysis
- For quick reports and chat, use "medium" or "low" effort

### 8. Avoid Overengineering
- Keep solutions simple and focused
- Don't add features beyond what was asked

### 9. Minimize Hallucinations
- Ground answers in provided data
- Never speculate about data not provided

### 10. No Prefilled Responses on 4.6
- Prefills on last assistant turn deprecated
- Use direct instructions instead
- Use structured outputs for JSON schemas

## API Configuration for Our Use Case

```python
# For narrative report generation (~5K input, ~8K output)
client.messages.create(
    model="claude-sonnet-4-6",  # primary model for all reports
    max_tokens=16384,
    thinking={"type": "adaptive"},
    output_config={"effort": "medium"},  # medium for balance of quality/cost
    messages=[
        {"role": "user", "content": "..."}
    ],
)
```

## Recommended Model Strings
- Sonnet 4.6: `claude-sonnet-4-6` (used for ALL calls — reports, chat, everything)
- Opus 4.6: `claude-opus-4-6` (available but not used)
- Haiku 4.5: `claude-haiku-4-5` (available but not used)
