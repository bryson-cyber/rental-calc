# Claude 4.6 Migration Notes (from official docs)

## Model IDs
- Opus 4.6: `claude-opus-4-6`
- Sonnet 4.6: `claude-sonnet-4-6`

## Adaptive Thinking (RECOMMENDED)
- OLD: `thinking: {type: "enabled", budget_tokens: N}` — DEPRECATED
- NEW: `thinking: {type: "adaptive"}` + effort parameter
- Effort is now GA (no beta header needed)
- Use `output_config: {effort: "medium"}` for balanced quality/cost

## Breaking Changes
- No prefilling assistant messages (returns 400)
- Use only temperature OR top_p, not both

## API Call Pattern
```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=16384,
    thinking={"type": "adaptive"},
    output_config={"effort": "medium"},
    messages=[...]
)
```
