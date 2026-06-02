(function () {
  window.MSHTaxToolConfig = {
    disclaimers: {
      standard:
        'This is an educational screening tool only. It is not legal, tax, accounting, or financial advice and does not create a CPA-client relationship. Results are estimates based on your entries and simplified assumptions.',
      sensitiveData:
        'Do not enter Social Security numbers, EINs, taxpayer IDs, bank account numbers, passwords, full notice scans, or other sensitive documents into this public tool.'
    },
    cta: {
      cashFlow: 'Book a Cash Flow Review',
      sCorp: 'Book an S-Corp Election Review',
      ptet: 'Book a PTET / BAIT Election Review',
      notice: 'Book a Tax Notice Review',
      salesTax: 'Book a Sales Tax Exposure Review'
    },
    jurisdictions: ['NYC', 'NY', 'NJ', 'NY + NJ', 'Multi-state', 'Other'],
    riskThresholds: {
      cashFlow: { watchWeeksBelowReserve: 1, tightWeeksBelowReserve: 4 },
      opportunity: { marginal: 2500, review: 7500, strong: 15000 },
      ptet: { moderate: 35, high: 60, urgent: 80 },
      notice: { attention: 25, high: 50, urgent: 75 },
      salesTax: { moderate: 5000, high: 25000, urgent: 75000 }
    },
    assumptions: {
      sCorp: {
        selfEmploymentTaxRate: 15.3,
        payrollTaxRate: 15.3,
        defaultComplianceCost: 4500,
        breakEvenNote:
          'Break-even is simplified and does not model QBI, retirement plans, health insurance, basis, NYC/NYS/NJ treatment, or reasonable compensation analysis.'
      },
      ptetBait: {
        sourceNote:
          'PTET/BAIT election rules, timing, owner treatment, and payment mechanics change. Confirm current-year deadlines and rules before acting.',
        highIncomeMarker: 250000
      },
      notice: {
        urgentDays: 14,
        highBalance: 25000,
        moderateBalance: 5000
      },
      salesTax: {
        defaultRate: 8.875,
        lowPenaltyInterestAddon: 10,
        highPenaltyInterestAddon: 35,
        stalePeriodMonths: 12
      }
    },
    noticeCategories: [
      'Balance due',
      'Missing return',
      'Proposed adjustment',
      'Penalty notice',
      'Audit/examination',
      'Levy/garnishment/collection',
      'Identity verification',
      'Sales tax notice',
      'Payroll tax notice',
      'Business tax notice',
      'Other / not sure'
    ],
    leadIssues: [
      'Cash flow or forecasting',
      'S-Corp election review',
      'PTET / NJ BAIT planning',
      'Tax notice or controversy',
      'Sales tax compliance',
      'Bookkeeping cleanup',
      'Other NYC/NJ tax or finance issue'
    ]
  };
})();
