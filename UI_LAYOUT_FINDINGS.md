# StartWithProperty UI Layout Findings

## Current Behavior
- StartWithProperty is rendered ONCE in LeadMagnet.tsx at line 2252, inside `<div className="mb-12">` 
- It sits ABOVE the tab navigation, so it's always visible regardless of which tab/step the user is on
- When a property is set, it collapses to a summary card but still takes up space above every step
- The BackToPropertyButton component is rendered inside individual tabs (e.g., line 2640 in 'prove' tab)

## Problem
- The StartWithProperty form persists visually above all steps, creating confusion
- Users see property details when navigating to steps where it's not relevant (like reading the guide)
- The collapsed property card + tab content creates a cluttered layout

## Solution Options
1. **Only show on Step 1 (validate)** - Hide it when user navigates to other tabs
2. **Move it into a collapsible sidebar/drawer** - Property context available but not always visible
3. **Show compact property pill in header** - Small indicator showing which property is set, with full form only on relevant steps
4. **Conditional rendering** - Show full form only on property-relevant steps (validate, prove, explore, map), hide on others (guide, regulations)

## Recommended Approach
- Show the full StartWithProperty form ONLY when no tab is active or on the first visit
- Once a property is set, show a small compact "property pill" in the step header area (not a full card)
- The pill shows address + bedrooms and has edit/clear buttons
- Full form is accessible via the pill's edit button
- On steps where property isn't relevant (guide, regulations), don't show the pill at all

## Tab Types in LeadMagnet
- ebook (guide) - NOT property-relevant
- regulations - NOT property-relevant  
- prove (market research) - Property-relevant (uses location)
- find (find property) - Property-relevant
- explore (competitors) - Property-relevant
- validate (deal validation) - Property-relevant (core use)
- compare (favorites) - Property-relevant
- map - Property-relevant
- market-advisor - Property-relevant
- ai-advisor - Property-relevant
