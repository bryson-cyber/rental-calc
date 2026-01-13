# Comprehensive Debugging Plan - Rental Calculator

## Overview
Systematic testing approach to identify bugs, edge cases, and error scenarios across all 4 tools and features.

---

## STEP 1: See Real Revenue - Edge Cases & Error Scenarios

### Input Validation Tests
- [ ] Select state but don't select city → click Search → should show error or prevent search
- [ ] Select state + city but don't select neighborhood → click Search → should work or show message
- [ ] Select state + city + neighborhood but no zip code → click Search → should work
- [ ] Select only zip code without state/city → should show error
- [ ] Try searching with incomplete selections → verify error handling

### Data Validation Tests
- [ ] Search for a state with very few listings (e.g., Wyoming) → verify results display
- [ ] Search for a state with massive data (e.g., California) → verify performance
- [ ] Search for a small neighborhood → verify results accuracy
- [ ] Search for a large metro area → verify results accuracy
- [ ] Search for a zip code with no Airbnb listings → verify error message

### UI/UX Tests
- [ ] Verify "What's Working" shows all bedroom types (1BR, 2BR, 3BR, 4BR) even if count is 0
- [ ] Verify seasonality chart displays correctly with 12 months
- [ ] Verify market metrics are accurate (revenue, occupancy, ADR)
- [ ] Verify "Save Market" button works and persists
- [ ] Verify "Find Opportunities" button navigates to Step 2 with pre-filled location

### Performance Tests
- [ ] Measure time to load results for small market (< 5 seconds expected)
- [ ] Measure time to load results for large market (< 10 seconds expected)
- [ ] Verify no timeout errors occur
- [ ] Verify no memory leaks with repeated searches

---

## STEP 2: Explore Listings - Edge Cases & Error Scenarios

### Input Validation Tests
- [ ] Enter invalid address (e.g., "xyz123") → verify error handling
- [ ] Enter address with special characters → verify handling
- [ ] Enter very long address string → verify truncation/handling
- [ ] Leave address empty and click Search → should show error
- [ ] Enter address that doesn't exist → verify error message
- [ ] Enter international address → verify handling

### Filter Tests
- [ ] Select 0 bedrooms → verify results
- [ ] Select 5+ bedrooms → verify results
- [ ] Select "Any" bedrooms → verify all results display
- [ ] Change search radius to 1 km → verify fewer results
- [ ] Change search radius to 25 km → verify more results
- [ ] Change sort order and verify results re-sort correctly

### Property Card Tests
- [ ] Verify all property cards display stats correctly
- [ ] Click "View Listing" button → verify Airbnb link opens
- [ ] Click "View Listing" on multiple properties → verify all links work
- [ ] Click "Save Property" → verify property is saved
- [ ] Save 50+ properties → verify performance
- [ ] Try to save same property twice → verify duplicate handling

### Data Display Tests
- [ ] Verify property rank badges are sequential (#1, #2, #3, etc.)
- [ ] Verify financial stats are formatted correctly (currency, decimals)
- [ ] Verify occupancy percentages are between 0-100%
- [ ] Verify revenue values are positive numbers
- [ ] Verify no properties show $0 revenue (should be filtered out)

### Edge Cases
- [ ] Search for location with only 1 property → verify single card displays
- [ ] Search for location with 1000+ properties → verify pagination/performance
- [ ] Search for location with no Airbnb listings → verify empty state message
- [ ] Search for location where all properties have same revenue → verify sorting works

---

## STEP 3: Validate the Deal - Edge Cases & Error Scenarios

### Input Validation Tests
- [ ] Enter invalid address → verify error message
- [ ] Leave address empty → should show error
- [ ] Enter $0 rent → verify handling (should be invalid)
- [ ] Enter negative rent → should show error
- [ ] Enter very high rent ($50,000/month) → verify calculation accuracy
- [ ] Enter very low rent ($1/month) → verify calculation accuracy
- [ ] Enter non-numeric rent → should show error
- [ ] Select 0 bedrooms → verify handling
- [ ] Select 10+ bedrooms → verify handling

### Calculation Tests
- [ ] Verify monthly profit = expected revenue - monthly rent
- [ ] Verify annual revenue = monthly revenue × 12
- [ ] Verify occupancy percentage is realistic (0-100%)
- [ ] Verify nightly rate calculation is accurate
- [ ] Verify revenue forecast adds up correctly
- [ ] Test with different bedroom/bathroom combinations

### Comparison Tests
- [ ] Verify market ranking shows correct percentile
- [ ] Verify comparable properties are actually comparable
- [ ] Verify comps have similar bedroom counts
- [ ] Verify comps are in same market area
- [ ] Verify comps show realistic revenue ranges

### UI/UX Tests
- [ ] Verify revenue forecast chart displays 12 months
- [ ] Verify chart shows seasonal trends
- [ ] Verify comparable properties list shows 5-10 properties
- [ ] Verify "Use in Step 4" button works
- [ ] Verify form validation shows clear error messages

### Edge Cases
- [ ] Search for property in market with no comps → verify error handling
- [ ] Search for property with very high revenue → verify calculations
- [ ] Search for property with very low revenue → verify calculations
- [ ] Search for property in rural area with sparse data → verify results

---

## STEP 4: Find the Best Deal - Edge Cases & Error Scenarios

### Input Validation Tests
- [ ] Add 1 property and click "Find Winner" → should show error (need 2+)
- [ ] Add 2 properties → verify comparison works
- [ ] Add 5 properties → verify all comparisons display
- [ ] Add 10 properties → verify performance
- [ ] Try to add duplicate property → verify handling
- [ ] Remove property from comparison → verify list updates
- [ ] Leave rent field empty on one property → should show error

### Comparison Tests
- [ ] Verify "winner" is correctly identified (highest profit)
- [ ] Verify all metrics are displayed for each property
- [ ] Verify properties are sorted by profit correctly
- [ ] Verify ROI calculations are accurate
- [ ] Verify market ranking is displayed for each property

### UI/UX Tests
- [ ] Verify winner is highlighted/emphasized
- [ ] Verify comparison table is readable and well-formatted
- [ ] Verify "Add Another Property" button works multiple times
- [ ] Verify "Remove Property" button works
- [ ] Verify form validation shows errors clearly

### Edge Cases
- [ ] Compare properties with identical metrics → verify tie-breaking logic
- [ ] Compare properties with vastly different metrics → verify calculations
- [ ] Compare properties in different markets → verify results
- [ ] Compare properties with 0 expected revenue → verify handling

---

## SAVED ITEMS & FEATURES - Edge Cases & Error Scenarios

### Save Functionality Tests
- [ ] Save market from Step 1 → verify it appears in Saved Items
- [ ] Save property from Step 2 → verify it appears in Saved Items
- [ ] Save 50+ properties → verify performance
- [ ] Save same property twice → verify duplicate handling
- [ ] Refresh page → verify saved items persist
- [ ] Clear browser cache → verify saved items still exist

### Notes Functionality Tests
- [ ] Add note to saved market → verify it saves
- [ ] Add note to saved property → verify it saves
- [ ] Edit note → verify changes save
- [ ] Delete note → verify it's removed
- [ ] Add very long note (1000+ characters) → verify handling
- [ ] Add special characters in note → verify handling

### PDF Export Tests
- [ ] Export with 1 saved item → verify PDF generates
- [ ] Export with 50+ saved items → verify PDF generates
- [ ] Verify PDF includes all saved items
- [ ] Verify PDF includes notes
- [ ] Verify PDF formatting is correct
- [ ] Verify PDF file downloads correctly
- [ ] Open PDF and verify content is readable

### Multi-Select Tests
- [ ] Select 2 properties → verify "Compare in Step 4" button appears
- [ ] Select 1 property → verify button doesn't appear
- [ ] Select 5 properties → verify all selected
- [ ] Deselect property → verify count updates
- [ ] Click "Compare in Step 4" → verify Step 4 form pre-fills
- [ ] Verify pre-filled properties are correct

### Use in Step 3 Tests
- [ ] Click "Use in Step 3" on saved property → verify Step 3 form pre-fills
- [ ] Verify address is filled correctly
- [ ] Verify bedrooms/bathrooms are filled correctly
- [ ] Verify form switches to Step 3 tab
- [ ] Try on multiple properties → verify each pre-fills correctly

---

## CROSS-TOOL TESTS

### Navigation Tests
- [ ] Step 1 → Step 2 (Find Opportunities) → verify location pre-filled
- [ ] Step 2 → Step 3 (Validate Deal) → verify property pre-filled
- [ ] Step 3 → Step 4 (Compare) → verify property pre-filled
- [ ] Use back button → verify form data persists
- [ ] Use browser back button → verify state is maintained

### Data Consistency Tests
- [ ] Search same location in Step 1 and Step 2 → verify same results
- [ ] Validate same property in Step 3 twice → verify same results
- [ ] Compare same properties in Step 4 twice → verify same results

### Performance Tests
- [ ] Run all 4 steps sequentially → verify no performance degradation
- [ ] Save 100+ items → verify app still responsive
- [ ] Export large PDF → verify no timeout
- [ ] Perform 50 searches → verify no memory leaks

---

## BROWSER COMPATIBILITY TESTS

### Desktop Tests
- [ ] Chrome - all tools
- [ ] Firefox - all tools
- [ ] Safari - all tools
- [ ] Edge - all tools

### Mobile Tests
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (iPad)
- [ ] Verify responsive design

---

## ACCESSIBILITY TESTS

### Keyboard Navigation
- [ ] Tab through all form fields
- [ ] Use Enter to submit forms
- [ ] Use Escape to close dropdowns
- [ ] Verify focus indicators are visible

### Screen Reader Tests
- [ ] Verify form labels are announced
- [ ] Verify button purposes are clear
- [ ] Verify error messages are announced
- [ ] Verify results are announced

---

## SECURITY TESTS

### Input Sanitization
- [ ] Try SQL injection in address field
- [ ] Try XSS attacks in notes field
- [ ] Try very long strings (10,000+ characters)
- [ ] Verify all inputs are sanitized

### Data Privacy
- [ ] Verify saved items are stored locally (not sent to server)
- [ ] Verify no sensitive data in URLs
- [ ] Verify no sensitive data in browser console
- [ ] Verify HTTPS is used for all API calls

---

## KNOWN ISSUES TO INVESTIGATE

1. **Dropdown Selection** - Verify state/city dropdown selection works correctly on all browsers
2. **API Timeouts** - Test behavior when AirDNA API is slow or times out
3. **Missing Data** - Test behavior when market has incomplete data
4. **Large Datasets** - Test performance with markets having 1000+ properties
5. **Mobile Responsiveness** - Verify all forms work on mobile devices
6. **Saved Items Limit** - Test what happens when user saves 1000+ items
7. **PDF Export Size** - Test PDF generation with 100+ saved items
8. **Browser Storage Limit** - Test when localStorage is full

---

## TESTING PRIORITY

### High Priority (Must Test)
- Input validation and error handling
- Data accuracy and calculations
- Navigation between steps
- Saved items persistence
- PDF export functionality

### Medium Priority (Should Test)
- Performance with large datasets
- Browser compatibility
- Mobile responsiveness
- Accessibility features

### Low Priority (Nice to Test)
- Security edge cases
- Extreme input scenarios
- Stress testing

---

## BUG TRACKING

As bugs are found, document them here with:
- **Bug ID**: Unique identifier
- **Tool**: Which step/feature
- **Description**: What happens
- **Steps to Reproduce**: How to trigger it
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Severity**: Critical/High/Medium/Low
- **Status**: Open/In Progress/Fixed/Verified

