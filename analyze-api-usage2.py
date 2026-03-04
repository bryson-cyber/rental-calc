import openpyxl
from collections import defaultdict
from datetime import datetime

wb = openpyxl.load_workbook('/home/ubuntu/rental-calculator/api-usage-analysis.xlsx')
ws = wb.active

# Parse all data
# Headers: date, account_id, endpoint, status_code, count
data = []
for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
    if row[0] is None:
        continue
    date = row[0]
    account_id = row[1]
    endpoint = row[2]
    status_code = int(row[3]) if row[3] else 0
    count = int(row[4]) if row[4] else 0
    data.append({
        'date': date,
        'account_id': account_id,
        'endpoint': endpoint,
        'status_code': status_code,
        'count': count
    })

print(f"Total rows: {len(data)}")
print()

# Group by month
monthly_totals = defaultdict(int)
monthly_by_endpoint = defaultdict(lambda: defaultdict(int))
monthly_errors = defaultdict(int)
monthly_success = defaultdict(int)

for d in data:
    month_key = d['date'].strftime('%Y-%m') if isinstance(d['date'], datetime) else str(d['date'])[:7]
    monthly_totals[month_key] += d['count']
    monthly_by_endpoint[month_key][d['endpoint']] += d['count']
    if d['status_code'] == 200:
        monthly_success[month_key] += d['count']
    else:
        monthly_errors[month_key] += d['count']

print("=" * 80)
print("MONTHLY API USAGE TOTALS")
print("=" * 80)
grand_total = 0
for month in sorted(monthly_totals.keys()):
    total = monthly_totals[month]
    success = monthly_success.get(month, 0)
    errors = monthly_errors.get(month, 0)
    grand_total += total
    print(f"  {month}: {total:>10,} calls  (success: {success:,}, errors: {errors:,})")
print(f"  {'GRAND TOTAL':>10}: {grand_total:>10,} calls")
print()

# Top endpoints by total usage
print("=" * 80)
print("TOP ENDPOINTS BY TOTAL USAGE (ALL TIME)")
print("=" * 80)
endpoint_totals = defaultdict(int)
for d in data:
    endpoint_totals[d['endpoint']] += d['count']

sorted_endpoints = sorted(endpoint_totals.items(), key=lambda x: x[1], reverse=True)
for endpoint, count in sorted_endpoints:
    pct = (count / grand_total) * 100
    print(f"  {endpoint:<50} {count:>10,}  ({pct:.1f}%)")
print()

# Monthly breakdown by endpoint category
print("=" * 80)
print("MONTHLY BREAKDOWN BY ENDPOINT")
print("=" * 80)
for month in sorted(monthly_by_endpoint.keys()):
    print(f"\n  --- {month} ---")
    sorted_eps = sorted(monthly_by_endpoint[month].items(), key=lambda x: x[1], reverse=True)
    month_total = monthly_totals[month]
    for endpoint, count in sorted_eps:
        pct = (count / month_total) * 100
        print(f"    {endpoint:<50} {count:>8,}  ({pct:.1f}%)")

# March 2026 (current month) detail
print()
print("=" * 80)
print("MARCH 2026 (CURRENT MONTH) DETAIL")
print("=" * 80)
march_data = [d for d in data if isinstance(d['date'], datetime) and d['date'].month == 3 and d['date'].year == 2026]
if march_data:
    march_total = sum(d['count'] for d in march_data)
    print(f"  Total calls this month: {march_total:,}")
    march_eps = defaultdict(int)
    for d in march_data:
        march_eps[d['endpoint']] += d['count']
    for ep, count in sorted(march_eps.items(), key=lambda x: x[1], reverse=True):
        print(f"    {ep:<50} {count:>8,}")
else:
    print("  No March 2026 data found")

# Error analysis
print()
print("=" * 80)
print("ERROR ANALYSIS (non-200 status codes)")
print("=" * 80)
error_data = [d for d in data if d['status_code'] != 200]
if error_data:
    error_by_code = defaultdict(int)
    error_by_endpoint = defaultdict(lambda: defaultdict(int))
    for d in error_data:
        error_by_code[d['status_code']] += d['count']
        error_by_endpoint[d['endpoint']][d['status_code']] += d['count']
    
    print("  By status code:")
    for code, count in sorted(error_by_code.items()):
        print(f"    HTTP {code}: {count:,}")
    
    print("\n  By endpoint:")
    for ep in sorted(error_by_endpoint.keys()):
        codes = error_by_endpoint[ep]
        total_err = sum(codes.values())
        code_str = ", ".join(f"{c}:{v}" for c, v in sorted(codes.items()))
        print(f"    {ep:<50} {total_err:>6,}  ({code_str})")
else:
    print("  No errors found")

# Rentalizer-specific analysis
print()
print("=" * 80)
print("RENTALIZER ENDPOINT ANALYSIS (core of Step 2)")
print("=" * 80)
rentalizer_data = [d for d in data if 'rentalizer' in d['endpoint']]
for month in sorted(set(d['date'].strftime('%Y-%m') if isinstance(d['date'], datetime) else str(d['date'])[:7] for d in rentalizer_data)):
    month_rent = [d for d in rentalizer_data if (d['date'].strftime('%Y-%m') if isinstance(d['date'], datetime) else str(d['date'])[:7]) == month]
    for d in month_rent:
        print(f"  {month} | {d['endpoint']:<40} | HTTP {d['status_code']} | {d['count']:>6,} calls")
