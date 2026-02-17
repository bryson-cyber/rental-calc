# Claude Effort Parameter API Notes

## API Usage
```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=4096,
    output_config={"effort": "medium"},
    thinking={"type": "adaptive"},  # recommended with effort
    messages=[...]
)
```

## Effort Levels
- `max`: Absolute maximum capability (Opus 4.6 only)
- `high`: Default. Complex reasoning, coding, agentic tasks
- `medium`: Balanced speed/cost/performance. Recommended for most Sonnet 4.6 use cases
- `low`: Most efficient. Simple tasks, speed-sensitive

## Key Facts
- effort is in `output_config.effort` (NOT top-level)
- No beta header required (GA)
- Works with or without thinking enabled
- At high/max effort, Claude almost always thinks
- At lower effort, may skip thinking for simpler problems

## Mapping to our thinkingLevel
- thinkingLevel 'high' → effort 'high' (complex analysis)
- thinkingLevel 'low' → effort 'medium' (balanced, simple tasks)
- Flash model → effort 'low' (fast responses)
