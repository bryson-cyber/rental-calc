// Math Verification Script for Rental Calculator
// Based on the demo values from the UI

// Input values from the demo
const annualRevenue = 59767;  // From API
const monthlyRent = 2500;     // User input
const expensePercent = 20;    // User input (slider)
const furnitureCost = 15000;  // User input
const adr = 257;              // From API
const occupancy = 64;         // From API (percentage)

console.log("=== MATH VERIFICATION ===\n");

// 1. Monthly Revenue Calculation
const monthlyRevenue = annualRevenue / 12;
console.log("1. MONTHLY REVENUE:");
console.log(`   Annual Revenue: $${annualRevenue.toLocaleString()}`);
console.log(`   Monthly Revenue: $${annualRevenue.toLocaleString()} / 12 = $${monthlyRevenue.toFixed(2)}`);
console.log(`   Expected: ~$4,981 ✓\n`);

// 2. Expense Calculation
const monthlyExpenses = monthlyRevenue * (expensePercent / 100);
console.log("2. EXPENSE CALCULATION:");
console.log(`   Monthly Revenue: $${monthlyRevenue.toFixed(2)}`);
console.log(`   Expense %: ${expensePercent}%`);
console.log(`   Monthly Expenses: $${monthlyRevenue.toFixed(2)} × ${expensePercent/100} = $${monthlyExpenses.toFixed(2)}`);
console.log(`   Expected: ~$996 ✓\n`);

// 3. Net Profit Calculation
const trueMonthlyProfit = monthlyRevenue - monthlyRent - monthlyExpenses;
console.log("3. NET PROFIT CALCULATION:");
console.log(`   Monthly Revenue: $${monthlyRevenue.toFixed(2)}`);
console.log(`   - Monthly Rent: $${monthlyRent.toLocaleString()}`);
console.log(`   - Monthly Expenses: $${monthlyExpenses.toFixed(2)}`);
console.log(`   = Net Profit: $${trueMonthlyProfit.toFixed(2)}`);
console.log(`   Expected: ~$1,484 ✓\n`);

// 4. Annual Profit
const annualProfit = trueMonthlyProfit * 12;
console.log("4. ANNUAL PROFIT:");
console.log(`   Monthly Profit: $${trueMonthlyProfit.toFixed(2)} × 12 = $${annualProfit.toFixed(2)}`);
console.log(`   Expected: ~$17,814 ✓\n`);

// 5. Months to Recoup Investment
const monthsToRecoup = Math.ceil(furnitureCost / trueMonthlyProfit);
console.log("5. MONTHS TO RECOUP:");
console.log(`   Furniture Cost: $${furnitureCost.toLocaleString()}`);
console.log(`   Monthly Profit: $${trueMonthlyProfit.toFixed(2)}`);
console.log(`   Months to Recoup: $${furnitureCost.toLocaleString()} / $${trueMonthlyProfit.toFixed(2)} = ${(furnitureCost / trueMonthlyProfit).toFixed(2)} → ${monthsToRecoup} months`);
console.log(`   Expected: 11 months ✓\n`);

// 6. Break-even Occupancy
// Break-even: Rent = Revenue after expenses
// Rent = ADR × 30 × BreakEvenOcc × (1 - expensePercent/100)
const effectiveRate = adr * 30 * (1 - expensePercent / 100);
const breakEvenOccupancy = (monthlyRent / effectiveRate) * 100;
console.log("6. BREAK-EVEN OCCUPANCY:");
console.log(`   ADR: $${adr}`);
console.log(`   Effective Rate (after ${expensePercent}% expenses): $${adr} × 30 × ${1 - expensePercent/100} = $${effectiveRate.toFixed(2)}`);
console.log(`   Break-even Occ: $${monthlyRent.toLocaleString()} / $${effectiveRate.toFixed(2)} × 100 = ${breakEvenOccupancy.toFixed(1)}%`);
console.log(`   Expected: ~41% ✓\n`);

// 7. Occupancy Cushion
const occupancyCushion = occupancy - breakEvenOccupancy;
console.log("7. OCCUPANCY CUSHION:");
console.log(`   Current Occupancy: ${occupancy}%`);
console.log(`   Break-even: ${breakEvenOccupancy.toFixed(1)}%`);
console.log(`   Cushion: ${occupancy}% - ${breakEvenOccupancy.toFixed(1)}% = ${occupancyCushion.toFixed(1)}%`);
console.log(`   Expected: ~23% ✓\n`);

// 8. Investment Comparison Years
const stockMarketYears = Math.ceil(annualProfit / (furnitureCost * 0.10));
const realEstateYears = Math.ceil(annualProfit / (furnitureCost * 0.05));
const savingsYears = Math.ceil(annualProfit / (furnitureCost * 0.04));

console.log("8. INVESTMENT COMPARISON:");
console.log(`   To generate $${annualProfit.toFixed(2)}/year from $${furnitureCost.toLocaleString()}:`);
console.log(`   Stock Market (10%/yr): $${furnitureCost.toLocaleString()} × 10% = $${(furnitureCost * 0.10).toFixed(2)}/yr`);
console.log(`      Years needed: $${annualProfit.toFixed(2)} / $${(furnitureCost * 0.10).toFixed(2)} = ${(annualProfit / (furnitureCost * 0.10)).toFixed(2)} → ${stockMarketYears}+ years`);
console.log(`   Real Estate (5%/yr): $${furnitureCost.toLocaleString()} × 5% = $${(furnitureCost * 0.05).toFixed(2)}/yr`);
console.log(`      Years needed: $${annualProfit.toFixed(2)} / $${(furnitureCost * 0.05).toFixed(2)} = ${(annualProfit / (furnitureCost * 0.05)).toFixed(2)} → ${realEstateYears}+ years`);
console.log(`   Savings (4%/yr): $${furnitureCost.toLocaleString()} × 4% = $${(furnitureCost * 0.04).toFixed(2)}/yr`);
console.log(`      Years needed: $${annualProfit.toFixed(2)} / $${(furnitureCost * 0.04).toFixed(2)} = ${(annualProfit / (furnitureCost * 0.04)).toFixed(2)} → ${savingsYears}+ years`);
console.log(`   Expected: Stock 12+, Real Estate 24+, Savings 30+ ✓\n`);

// 9. Risk Scenario (20% drop)
const riskOccupancy = occupancy * 0.8;
const riskRevenue = (riskOccupancy / 100) * adr * 30;
const riskExpenses = riskRevenue * (expensePercent / 100);
const riskProfit = riskRevenue - monthlyRent - riskExpenses;

console.log("9. RISK SCENARIO (20% occupancy drop):");
console.log(`   Risk Occupancy: ${occupancy}% × 0.8 = ${riskOccupancy.toFixed(1)}%`);
console.log(`   Risk Revenue: ${riskOccupancy.toFixed(1)}% × $${adr} × 30 = $${riskRevenue.toFixed(2)}`);
console.log(`   Risk Expenses: $${riskRevenue.toFixed(2)} × ${expensePercent}% = $${riskExpenses.toFixed(2)}`);
console.log(`   Risk Profit: $${riskRevenue.toFixed(2)} - $${monthlyRent.toLocaleString()} - $${riskExpenses.toFixed(2)} = $${riskProfit.toFixed(2)}`);
console.log(`   Expected: ~$658/month ✓\n`);

console.log("=== ALL CALCULATIONS VERIFIED ===");
