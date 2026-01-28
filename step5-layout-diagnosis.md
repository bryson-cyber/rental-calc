# Step 5 Layout Diagnosis - Root Cause Analysis

## Problem Summary
The user reports:
1. Entire page is stuck in "vertical mode" - appears too narrow
2. Table columns are stacking/truncating (not showing all columns)
3. Step 5 should be able to break out of its container constraints

## Root Cause Analysis

### Issue 1: Container Width Constraint
**Location:** `LeadMagnet.tsx` line 1430
```tsx
<div className="container max-w-4xl mx-auto">
```

**Problem:** The tools section wrapper has `max-w-4xl` (896px max width), which constrains ALL tabs including the Map tab. This is appropriate for forms but too narrow for a full-width map experience.

**Impact:** MapFirstLayout is rendered inside this 896px container, making the entire map and table appear in "vertical mode" even on wide desktop screens.

### Issue 2: MapFirstLayout Uses `container` Class
**Location:** `MapFirstLayout.tsx` lines 1493, 1508, 1568, 1709
```tsx
<div className="container">
```

**Problem:** The `container` class in Tailwind is customized in this project to auto-center and add responsive padding. Combined with the parent `max-w-4xl`, this double-constrains the content.

### Issue 3: Table Layout
**Location:** `MapFirstLayout.tsx` table section (around line 1709)

**Problem:** The table is inside a `container` class within the already-constrained parent. The table cells have `truncate` and small widths, causing columns to appear stacked or cut off.

## Solution Plan

### Fix 1: Break MapFirstLayout Out of Container
In `LeadMagnet.tsx`, render the Map tab OUTSIDE the `max-w-4xl` container:
- Move the `{activeTab === 'map' && ...}` block outside the constrained container
- Give MapFirstLayout full viewport width

### Fix 2: Remove Nested Container Classes
In `MapFirstLayout.tsx`, replace `container` classes with explicit padding:
- Use `px-4 md:px-6 lg:px-8` instead of `container`
- This allows the content to use full available width

### Fix 3: Redesign Table for Full Width
- Remove truncation constraints on property names
- Use responsive column widths that scale with viewport
- Show all columns on desktop without horizontal scroll

### Fix 4: Add Property Marker on Map
- Add a distinct marker icon (different from competitor markers) for user's property
- Use a home icon or different color to distinguish from revenue-colored markers
