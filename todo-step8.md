# Step 8: Opportunity Finder - Complete Task List

**Date**: January 28, 2026
**Last Updated**: January 29, 2026
**Goal**: Build a comprehensive Opportunity Finder that maximizes HasData Zillow API capabilities for investors

---

## Phase 1: Visibility & Navigation ✅ COMPLETE

- [x] Add "Step 8: Find Opportunities" to homepage step navigation (after Step 7)
- [x] Create step card with guiding question: "Where can I find deals in my target market?"
- [x] Ensure Opportunity Finder is accessible from main LeadMagnet flow
- [ ] Add navigation link from property report Chapter 8 (future enhancement)

---

## Phase 2: Core Search Functionality ✅ COMPLETE

- [x] Verify search by city/zip code works correctly
- [x] Ensure bedroom/bathroom filters are applied to API calls
- [x] Verify price range filters work (min/max)
- [x] Filter out $0 price listings (apartment buildings)
- [x] Add property type filter (Single Family, Condo, Townhouse, etc.)
- [x] For Rent / For Sale toggle

---

## Phase 3: Pagination & Sorting ✅ COMPLETE

- [x] Add sorting dropdown with options:
  - [x] Price: Low to High
  - [x] Price: High to Low
  - [x] Bedrooms: Most to Least
  - [x] Bedrooms: Least to Most
- [x] Add result count display ("Showing 10 of 10 properties")
- [ ] Add "Load More" button (API returns limited results per search)
- [ ] Days on Market sorting (future enhancement)

---

## Phase 4: AirDNA Inline Analysis ✅ COMPLETE

- [x] Confirm "Analyze Property" button triggers AirDNA estimate
- [x] Verify revenue, occupancy, ADR display correctly
- [x] Verify ROI calculation is accurate
- [x] Verify profit/loss calculation is accurate
- [x] Display verdict (Good Deal / Not Recommended)
- [x] Show action buttons after analysis (Competition, Map, Market)

---

## Phase 5: Contact Now Feature ✅ COMPLETE

- [x] Create backend endpoint: getPropertyContacts
- [x] Add extractAgentEmails parameter to HasData Property API call
- [x] Parse agent contact info from API response (returns empty for rentals - API limitation)
- [x] Add "Contact Now" button on each property card
- [x] Create contact modal/popup
- [x] Handle case when no contact info available → "Contact via Zillow" button
- [x] Zillow link opens correctly in new tab

---

## Phase 6: Deal Score & Investment Metrics ✅ COMPLETE

- [x] Calculate Deal Score (A+, A, B, C, D, F) based on ROI
- [x] Display Deal Score badge on each property card
- [x] Add color coding: Green (A+/A), Yellow (B), Orange (C), Red (D/F)
- [x] Add estimated startup costs calculation:
  - [x] First month rent
  - [x] Security deposit (1.5x rent)
  - [x] Furnishing estimate ($8,000 base + $4,000/bedroom)
  - [x] Total startup investment
- [x] Show startup costs in collapsible section
- [x] Add estimated monthly profit display
- [ ] Add cash-on-cash return estimate (future enhancement)
- [ ] Add break-even occupancy calculation (future enhancement)

---

## Phase 7: Save & Compare Features ✅ PARTIALLY COMPLETE

- [x] Add "Save Property" button (heart icon) on each card
- [x] Store saved properties in localStorage
- [x] Toggle favorite state on click
- [x] Visual feedback (filled red heart for favorited)
- [x] Persist favorites across page refreshes
- [ ] Create "My Saved Properties" section/page (future enhancement)
- [ ] Add comparison view for saved properties (future enhancement)

---

## Phase 8: UI/UX Polish ✅ COMPLETE

- [x] Apply Coach Inayah brand colors (gold primary, near-white background)
- [x] Use pill-shaped buttons for primary actions
- [x] Apply border-radius to cards
- [x] Add hover effects on property cards
- [x] Use Lucide icons consistently
- [x] Add loading states during API calls
- [x] Add empty state when no properties found
- [x] Quick search buttons (Atlanta, Denver, Austin, Nashville)

---

## Phase 9: Tooltip Audit ✅ COMPLETE

- [x] Add tooltip for "ROI"
- [x] Add tooltip for "Occupancy"
- [x] Add tooltip for "Nightly Rate"
- [x] Add tooltip for "Monthly Revenue"
- [x] Add tooltip for "Startup Costs" (in collapsible section)
- [ ] Add tooltip for "Days on Zillow" (future enhancement)
- [ ] Add tooltip for "Deal Score" (future enhancement)

---

## Phase 10: Testing & Quality Assurance ✅ COMPLETE

- [x] Test search with various cities (Denver, Atlanta tested)
- [x] Test all sorting options work correctly
- [x] Test AirDNA analysis on multiple properties
- [x] Test Contact Now feature (Zillow fallback working)
- [x] Test Save to Favorites functionality
- [x] Check for console errors (none found)
- [x] Verify no NaN/undefined values displayed

---

## API Integration Status

### HasData Zillow API ✅
- [x] Listing Search: `/scrape/zillow/listing` - for browsing rentals
- [x] Property Details: `/scrape/zillow/property` - for contact info (returns empty for rentals)
- [x] $0 price filtering implemented

### AirDNA API ✅
- [x] Rentalizer Estimate: `/rentalizer/estimate` - for revenue projections
- [x] Response parsing fixed (data.payload.stats.future.summary path)

---

## Success Criteria Status

1. ✅ Users can search any US market for rental opportunities
2. ✅ Properties display with accurate pricing and details
3. ✅ One-click AirDNA analysis shows profit potential
4. ✅ Contact via Zillow available for landlord outreach
5. ✅ Deal Score helps users quickly identify best opportunities
6. ✅ Saved properties tracked with favorites
7. ✅ UI matches Coach Inayah brand design system
8. ✅ Key metrics have beginner-friendly tooltips
9. ✅ No bugs or console errors
10. ✅ Feature matches Step 3 quality benchmark

---

## Future Enhancements (Backlog)

- [ ] Load More pagination for larger result sets
- [ ] My Saved Properties page with comparison view
- [ ] Cash-on-cash return calculation
- [ ] Break-even occupancy calculation
- [ ] Days on market sorting
- [ ] Export comparison to PDF
- [ ] Navigation from Chapter 8 of property report
