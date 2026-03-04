import openpyxl
from collections import defaultdict
from datetime import datetime

# ============================================
# 1. LOAD AIRDNA DASHBOARD DATA (spreadsheet)
# ============================================
wb = openpyxl.load_workbook('/home/ubuntu/rental-calculator/api-usage-analysis.xlsx')
ws = wb.active

airdna_monthly = defaultdict(int)
airdna_by_endpoint = defaultdict(lambda: defaultdict(int))

for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0] is None:
        continue
    date = row[0]
    endpoint = row[2]
    count = int(row[4]) if row[4] else 0
    month_key = date.strftime('%Y-%m') if isinstance(date, datetime) else str(date)[:7]
    airdna_monthly[month_key] += count
    airdna_by_endpoint[month_key][endpoint] += count

print("=" * 90)
print("CROSS-REFERENCE: AirDNA Dashboard vs Our App's Internal Tracking")
print("=" * 90)
print()

# ============================================
# 2. PRINT AIRDNA DASHBOARD TOTALS
# ============================================
print("AirDNA Dashboard (your spreadsheet) — Monthly Totals:")
airdna_grand = 0
for month in sorted(airdna_monthly.keys()):
    total = airdna_monthly[month]
    airdna_grand += total
    print(f"  {month}: {total:>10,} API calls")
print(f"  TOTAL:   {airdna_grand:>10,} API calls")
print()

# ============================================
# 3. COMPARE WITH OUR APP'S INTERNAL DATA
# ============================================
# Our app's api_usage_summary (from DB query above):
# Feb 2026 daily totals from api_usage_summary
our_feb_daily = {
    '2026-02-04': 719, '2026-02-05': 203, '2026-02-06': 711,
    '2026-02-07': 50, '2026-02-08': 50, '2026-02-09': 538,
    '2026-02-10': 2720, '2026-02-11': 1709, '2026-02-12': 4281,
    '2026-02-13': 1030, '2026-02-14': 1345, '2026-02-15': 179,
    '2026-02-16': 2227, '2026-02-17': 667, '2026-02-18': 372,
    '2026-02-19': 763, '2026-02-20': 155, '2026-02-21': 1326,
    '2026-02-22': 1024, '2026-02-23': 1036, '2026-02-24': 1012,
    '2026-02-25': 1098, '2026-02-26': 1233, '2026-02-27': 1217,
    '2026-02-28': 1044,
}
our_feb_total = sum(our_feb_daily.values())

# March 2026 (today's count from rate limiter)
our_mar_total = 482  # from the rate limiter sync log

print("Our App's Internal Tracking (api_usage_summary table):")
print(f"  2026-02: {our_feb_total:>10,} API calls (our app tracked)")
print(f"  2026-03: {our_mar_total:>10,} API calls (rate limiter count today)")
print()

print("COMPARISON:")
print(f"  {'Month':<10} {'AirDNA Dashboard':>18} {'Our App Tracked':>18} {'Difference':>12} {'Match?':>10}")
print(f"  {'-'*10} {'-'*18} {'-'*18} {'-'*12} {'-'*10}")

# Feb comparison
airdna_feb = airdna_monthly.get('2026-02', 0)
diff_feb = airdna_feb - our_feb_total
pct_feb = (diff_feb / airdna_feb * 100) if airdna_feb else 0
print(f"  {'2026-02':<10} {airdna_feb:>18,} {our_feb_total:>18,} {diff_feb:>+12,} {'~' if abs(pct_feb) < 20 else 'NO':>10}")

# Mar comparison
airdna_mar = airdna_monthly.get('2026-03', 0)
diff_mar = airdna_mar - our_mar_total
pct_mar = (diff_mar / airdna_mar * 100) if airdna_mar else 0
print(f"  {'2026-03':<10} {airdna_mar:>18,} {our_mar_total:>18,} {diff_mar:>+12,} {'~' if abs(pct_mar) < 30 else 'NO':>10}")
print()

# ============================================
# 4. KEY OBSERVATIONS
# ============================================
print("=" * 90)
print("KEY OBSERVATIONS")
print("=" * 90)
print()

# Sept-Dec 2025 — before our app had internal tracking
print("1. SEPT-DEC 2025 (Pre-Internal Tracking):")
for m in ['2025-09', '2025-10', '2025-11', '2025-12']:
    if m in airdna_monthly:
        print(f"   {m}: {airdna_monthly[m]:,} calls — development/testing period")
print(f"   Total pre-2026: {sum(airdna_monthly.get(m, 0) for m in ['2025-09','2025-10','2025-11','2025-12']):,}")
print()

# Jan 2026 — massive spike
jan_total = airdna_monthly.get('2026-01', 0)
print(f"2. JANUARY 2026 SPIKE: {jan_total:,} calls")
jan_top = sorted(airdna_by_endpoint.get('2026-01', {}).items(), key=lambda x: x[1], reverse=True)[:5]
print("   Top endpoints:")
for ep, cnt in jan_top:
    print(f"     {ep:<50} {cnt:>8,}  ({cnt/jan_total*100:.1f}%)")
print("   This was the month of heaviest feature development (submarket, listing, market data)")
print()

# Feb 2026 — our tracking started
print(f"3. FEBRUARY 2026: AirDNA says {airdna_feb:,}, our app tracked {our_feb_total:,}")
print(f"   Difference: {diff_feb:+,} ({abs(pct_feb):.1f}%)")
if our_feb_total > airdna_feb:
    print("   Our app tracked MORE than AirDNA dashboard — this is expected because:")
    print("   - Our app counts every outgoing request (including retries, cache misses)")
    print("   - AirDNA dashboard may aggregate differently or exclude certain call types")
    print("   - Our rate limiter counts include failed/rejected calls")
elif abs(pct_feb) < 10:
    print("   Numbers are very close — tracking is consistent")
else:
    print("   Our app tracked LESS than AirDNA dashboard — possible reasons:")
    print("   - Our internal tracking started mid-Feb (Feb 4)")
    print("   - Some calls may have been made before tracking was active")
    print("   - Direct API testing outside the app wouldn't be tracked internally")
print()

# March 2026 — current
print(f"4. MARCH 2026 (today): AirDNA says {airdna_mar:,}, our rate limiter says {our_mar_total:,}")
print(f"   Difference: {diff_mar:+,}")
if abs(diff_mar) < 250:
    print("   Close match — numbers are consistent")
else:
    print("   Difference likely due to timing of AirDNA dashboard refresh vs real-time rate limiter")
print()

# Total API spend
print("5. TOTAL API USAGE SINCE INCEPTION:")
print(f"   Grand total: {airdna_grand:,} API calls across {len(airdna_monthly)} months")
print(f"   Average per month: {airdna_grand // len(airdna_monthly):,} calls/month")
print()

# Cache effectiveness
print("6. CACHE EFFECTIVENESS (from api_cache table):")
print(f"   Total cached entries: 2,683")
print(f"   Cache entries in Feb: 2,340")
print(f"   Cache entries in Mar: 332")
print(f"   Without caching, API usage would be significantly higher")
print()

# Rentalizer specific
print("7. RENTALIZER (Step 2) USAGE TREND:")
for m in sorted(airdna_by_endpoint.keys()):
    rent = airdna_by_endpoint[m].get('rentalizer_estimate', 0)
    if rent > 0:
        print(f"   {m}: {rent:,} rentalizer calls")
total_rent = sum(airdna_by_endpoint[m].get('rentalizer_estimate', 0) for m in airdna_by_endpoint)
print(f"   Total rentalizer calls: {total_rent:,} ({total_rent/airdna_grand*100:.1f}% of all calls)")
