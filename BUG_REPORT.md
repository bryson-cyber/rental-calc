# Bug Report - Rental Calculator

## Testing Session: January 13, 2026

---

## STEP 1: See Real Revenue - Test Results

### Test 1.1: Try clicking Search without selecting any state
**Status**: COMPLETED
**Expected**: Should show error message or prevent search
**Actual**: Clicking Search button without selecting state does nothing - no error shown, form remains unchanged. This could be a BUG if user expects feedback.
**Severity**: LOW - The app prevents the search but doesn't inform the user why

### Test 1.2: Select state but don't select city, then click Search
**Status**: PENDING
**Expected**: Should show error or require city selection
**Actual**: TBD

### Test 1.3: Search for Wyoming (small market)
**Status**: PENDING
**Expected**: Should display results even if limited
**Actual**: TBD

### Test 1.4: Verify "What's Working" shows all bedroom types
**Status**: PENDING
**Expected**: Should show 1BR, 2BR, 3BR, 4BR even if count is 0
**Actual**: TBD

---

## STEP 2: Explore Listings - Test Results

### Test 2.1: Enter invalid address
**Status**: PENDING
**Expected**: Should show error message
**Actual**: TBD

### Test 2.2: Leave address empty and click Search
**Status**: PENDING
**Expected**: Should show error
**Actual**: TBD

### Test 2.3: Save 50+ properties
**Status**: PENDING
**Expected**: Should handle large number of saves
**Actual**: TBD

### Test 2.4: Try to save same property twice
**Status**: PENDING
**Expected**: Should prevent duplicate or show message
**Actual**: TBD

---

## STEP 3: Validate the Deal - Test Results

### Test 3.1: Enter $0 rent
**Status**: PENDING
**Expected**: Should show error (invalid input)
**Actual**: TBD

### Test 3.2: Enter negative rent
**Status**: PENDING
**Expected**: Should show error
**Actual**: TBD

### Test 3.3: Enter very high rent ($50,000/month)
**Status**: PENDING
**Expected**: Should calculate correctly
**Actual**: TBD

### Test 3.4: Verify calculations are accurate
**Status**: PENDING
**Expected**: Monthly profit = revenue - rent
**Actual**: TBD

---

## STEP 4: Find the Best Deal - Test Results

### Test 4.1: Add 1 property and click Find Winner
**Status**: PENDING
**Expected**: Should show error (need 2+)
**Actual**: TBD

### Test 4.2: Add 5 properties
**Status**: PENDING
**Expected**: Should display all comparisons
**Actual**: TBD

### Test 4.3: Try to add duplicate property
**Status**: PENDING
**Expected**: Should prevent or show message
**Actual**: TBD

---

## SAVED ITEMS - Test Results

### Test S1: Save market from Step 1
**Status**: PENDING
**Expected**: Should appear in Saved Items
**Actual**: TBD

### Test S2: Save property from Step 2
**Status**: PENDING
**Expected**: Should appear in Saved Items
**Actual**: TBD

### Test S3: Add note to saved item
**Status**: PENDING
**Expected**: Should persist after refresh
**Actual**: TBD

### Test S4: Export PDF
**Status**: PENDING
**Expected**: Should generate and download PDF
**Actual**: TBD

---

## CRITICAL BUGS FOUND

**BUG #3 - Cities Not Loading After State Selection**
- After selecting California, the City/Metro dropdown shows "City/Metro" but cities are not loading
- Expected: Should show list of California cities (Los Angeles, San Francisco, San Diego, etc.)
- Actual: Dropdown remains empty or shows loading state indefinitely
- Impact: Users cannot proceed past state selection
- Severity: CRITICAL

---

## MEDIUM BUGS FOUND

(To be updated as bugs are discovered)

---

## LOW PRIORITY ISSUES

(To be updated as bugs are discovered)



---

## SUMMARY OF BUGS FOUND

### Critical Issues (Block Functionality)
1. **BUG #1**: Silent failure when clicking Search without state selection - no error feedback
2. **BUG #3**: Cities not loading after state selection - Step 1 completely broken

### Medium Issues (Degrade UX)
(To be identified)

### Low Priority Issues (Polish)
(To be identified)

---

## NEXT STEPS

1. **FIX BUG #3 IMMEDIATELY** - Cities dropdown not loading is blocking Step 1 entirely
2. Add error handling and user feedback for empty searches (BUG #1)
3. Continue testing Steps 2, 3, 4 after fixing Step 1
4. Test edge cases and error scenarios for all steps

