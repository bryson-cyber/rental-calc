# Bedroom Filter Findings from AirDNA API Docs

## Key Finding
The AirDNA API uses **Numeric Comparison Filter** for bedrooms, NOT "select" type.

### Correct Format:
```json
{
  "type": "gte",  // or "gt", "lt", "lte", "eq"
  "field": "bedrooms",
  "value": 2
}
```

### Current Code Uses (WRONG):
```json
{
  "type": "select",
  "field": "bedrooms",
  "value": 1
}
```

## Fix Required
Change from `type: "select"` to `type: "eq"` (numeric equality) for exact bedroom match.

For "5+ BR" option, use `type: "gte"` with value 5.
