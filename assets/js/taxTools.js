(function () {
  const config = window.MSHTaxToolConfig;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback || 0;
  }

  function money(value) {
    return formatter.format(value || 0);
  }

  function percent(value) {
    return Number(value || 0).toFixed(1) + '%';
  }

  function daysUntil(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / 86400000);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function renderError(output, message) {
    output.innerHTML = '<p class="error" role="alert">' + message + '</p>';
  }

  function riskBadge(label, level) {
    return '<span class="risk-badge risk-' + level + '">' + label + '</span>';
  }

  function resultList(items) {
    return (
      '<ul class="calc-breakdown">' +
      items
        .map(function (item) {
          return '<li><strong>' + item.label + ':</strong> ' + item.value + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function checklist(items) {
    return (
      '<ul class="outcome-list">' +
      items
        .map(function (item) {
          return '<li>' + item + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function renderResult(output, options) {
    output.innerHTML =
      '<section class="result-card" aria-live="polite">' +
      '<div class="result-head">' +
      '<h2>' +
      options.title +
      '</h2>' +
      riskBadge(options.badgeLabel, options.badgeLevel) +
      '</div>' +
      (options.summary ? '<p>' + options.summary + '</p>' : '') +
      (options.metrics ? resultList(options.metrics) : '') +
      (options.customHtml || '') +
      '<div class="cta-strip">' +
      '<a class="btn btn-primary" href="' +
      options.ctaHref +
      '">' +
      options.ctaLabel +
      '</a>' +
      '<button class="btn btn-secondary" type="button" data-print-result>Print / Save</button>' +
      '<button class="btn btn-secondary" type="button" data-start-over>Start over</button>' +
      '</div>' +
      '<p class="assumption-note">' +
      config.disclaimers.standard +
      '</p>' +
      '</section>';
  }

  function bindResultActions(form, output) {
    output.addEventListener('click', function (event) {
      if (event.target.matches('[data-print-result]')) {
        window.print();
      }
      if (event.target.matches('[data-start-over]')) {
        form.reset();
        output.innerHTML = '';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function validateNonNegative(values, output) {
    const invalid = values.some(function (value) {
      return Number.isNaN(value) || value < 0;
    });
    if (invalid) {
      renderError(output, 'Enter valid non-negative numbers before calculating.');
      return false;
    }
    return true;
  }

  function ensureFormIsValid(form) {
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }

  function initLeadCapture() {
    $all('[data-lead-capture-container]').forEach(function (container) {
      const issue = container.getAttribute('data-default-issue') || '';
      const issueOptions = config.leadIssues
        .map(function (option) {
          return '<option value="' + option + '"' + (option === issue ? ' selected' : '') + '>' + option + '</option>';
        })
        .join('');

      container.innerHTML =
        '<form class="lead-capture" data-lead-capture novalidate>' +
        '<h2>Get a professional review</h2>' +
        '<p class="small">Share your contact details and the issue you want reviewed. Do not include SSNs, EINs, bank information, passwords, or confidential documents. This MVP validates the lead form in-browser; CRM/email integration is the next production step.</p>' +
        '<div class="form-row">' +
        '<div><label for="lead_name">First name *</label><input id="lead_name" name="name" type="text" autocomplete="given-name" required></div>' +
        '<div><label for="lead_email">Email *</label><input id="lead_email" name="email" type="email" autocomplete="email" required></div>' +
        '</div>' +
        '<div class="form-row">' +
        '' +
        '<div><label for="lead_business">Business name</label><input id="lead_business" name="business_name" type="text" autocomplete="organization"></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div><label for="lead_state">State / region *</label><select id="lead_state" name="state" required><option value="">Select one</option><option>NYC</option><option>NY</option><option>NJ</option><option>NY and NJ</option><option>Multi-state</option><option>Other</option></select></div>' +
        '<div><label for="lead_issue">What best describes your issue? *</label><select id="lead_issue" name="issue" required><option value="">Select one</option>' +
        issueOptions +
        '</select></div>' +
        '</div>' +
        '<label class="checkbox-row"><input name="consent" type="checkbox" required> I understand this tool is educational and does not create a CPA-client relationship.</label>' +
        '<button class="btn btn-primary" type="submit">Talk to a CPA</button>' +
        '<div class="form-status" data-lead-status role="status" aria-live="polite" hidden></div>' +
        '</form>';
    });

    $all('[data-lead-capture]').forEach(function (form) {
      const status = $('[data-lead-status]', form);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        // TODO: Connect this validated payload to CRM/email automation.
        form.reset();
        status.className = 'form-status success';
        status.hidden = false;
        status.textContent =
          'Thanks. Your information was captured in this browser session. Connect CRM/email integration before production lead routing.';
      });
    });
  }

  function initWeeklyGrid() {
    const grid = $('[data-weekly-grid]');
    if (!grid) return;

    const inflows = [
      ['customerReceipts', 'Customer receipts'],
      ['newSales', 'New sales collections'],
      ['funding', 'Loan/funding inflows'],
      ['ownerContributions', 'Owner contributions'],
      ['otherInflows', 'Other inflows']
    ];
    const outflows = [
      ['payroll', 'Payroll'],
      ['rent', 'Rent'],
      ['vendors', 'Vendor payments'],
      ['debt', 'Debt payments'],
      ['creditCards', 'Credit card payments'],
      ['taxes', 'Taxes'],
      ['insurance', 'Insurance/benefits'],
      ['ownerDraws', 'Owner draws'],
      ['otherExpenses', 'Other expenses']
    ];

    grid.innerHTML = Array.from({ length: 13 }, function (_, index) {
      const week = index + 1;
      const inputs = inflows.concat(outflows).map(function (field) {
        return (
          '<label>' +
          field[1] +
          '<input name="week' +
          week +
          '_' +
          field[0] +
          '" type="number" min="0" step="0.01" value="0"></label>'
        );
      });
      return '<fieldset class="week-panel"><legend>Week ' + week + '</legend><div class="weekly-input-grid">' + inputs.join('') + '</div></fieldset>';
    }).join('');
  }

  function initCashFlowTool() {
    const form = $('[data-tool="cash-flow"]');
    if (!form) return;
    const output = $('#cash-flow-output');
    bindResultActions(form, output);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!ensureFormIsValid(form)) return;
      const data = formData(form);
      const startingCash = num(data.current_bank_balance) + num(data.undeposited_funds);
      const minimumReserve = num(data.minimum_reserve);
      const loc = num(data.available_loc);

      if (!validateNonNegative([startingCash, minimumReserve, loc], output)) return;

      let beginningCash = startingCash;
      let weeksBelowReserve = 0;
      let firstNegative = null;
      let firstBelowReserve = null;
      let lowestCash = startingCash;
      let totalDebt = 0;
      let totalPayroll = 0;
      let totalTaxes = 0;
      let totalOwnerDraws = 0;
      let totalOutflows = 0;
      const rows = [];

      for (let week = 1; week <= 13; week += 1) {
        const inflows =
          num(data['week' + week + '_customerReceipts']) +
          num(data['week' + week + '_newSales']) +
          num(data['week' + week + '_funding']) +
          num(data['week' + week + '_ownerContributions']) +
          num(data['week' + week + '_otherInflows']);
        const payroll = num(data['week' + week + '_payroll']);
        const debt = num(data['week' + week + '_debt']);
        const taxes = num(data['week' + week + '_taxes']);
        const draws = num(data['week' + week + '_ownerDraws']);
        const outflows =
          payroll +
          num(data['week' + week + '_rent']) +
          num(data['week' + week + '_vendors']) +
          debt +
          num(data['week' + week + '_creditCards']) +
          taxes +
          num(data['week' + week + '_insurance']) +
          draws +
          num(data['week' + week + '_otherExpenses']);
        const net = inflows - outflows;
        const ending = beginningCash + net;
        const variance = ending - minimumReserve;

        if (ending < minimumReserve) {
          weeksBelowReserve += 1;
          if (!firstBelowReserve) firstBelowReserve = week;
        }
        if (ending < 0 && !firstNegative) firstNegative = week;
        lowestCash = Math.min(lowestCash, ending);
        totalDebt += debt;
        totalPayroll += payroll;
        totalTaxes += taxes;
        totalOwnerDraws += draws;
        totalOutflows += outflows;

        rows.push({ week, beginningCash, inflows, outflows, net, ending, variance });
        beginningCash = ending;
      }

      const issues = [];
      if (firstNegative) issues.push('Cash goes negative in week ' + firstNegative + '.');
      if (weeksBelowReserve > 0) issues.push(weeksBelowReserve + ' weeks project below minimum reserve.');
      if (totalPayroll > 0 && firstBelowReserve) issues.push('Payroll weeks may pressure reserve levels.');
      if (totalDebt > totalOutflows * 0.15) issues.push('Debt payments are a meaningful cash-flow driver.');
      if (totalTaxes === 0) issues.push('No tax payments were included in the 13-week forecast.');
      if (['Net 60+', 'Milestone/project-based'].includes(data.collection_cycle)) issues.push('Collection timing may create an AR cash gap.');
      if (totalOwnerDraws > totalOutflows * 0.1 && weeksBelowReserve > 0) issues.push('Owner draws may need rules while cash is tight.');

      const topIssues = issues.slice(0, 3);
      const level = firstNegative ? 'critical' : weeksBelowReserve >= config.riskThresholds.cashFlow.tightWeeksBelowReserve ? 'high' : weeksBelowReserve ? 'medium' : 'low';
      const label = firstNegative ? 'Critical' : weeksBelowReserve >= 4 ? 'Tight' : weeksBelowReserve ? 'Watch closely' : 'Healthy';
      const csv = ['Week,Beginning Cash,Inflows,Outflows,Net Cash Flow,Ending Cash,Variance From Reserve']
        .concat(rows.map(function (row) {
          return [row.week, row.beginningCash, row.inflows, row.outflows, row.net, row.ending, row.variance].join(',');
        }))
        .join('\n');
      const csvHref = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

      const table =
        '<div class="table-wrap"><table class="variance-table"><thead><tr><th>Week</th><th>Begin</th><th>Inflows</th><th>Outflows</th><th>Net</th><th>Ending</th><th>Reserve variance</th></tr></thead><tbody>' +
        rows
          .map(function (row) {
            return '<tr><td>' + row.week + '</td><td>' + money(row.beginningCash) + '</td><td>' + money(row.inflows) + '</td><td>' + money(row.outflows) + '</td><td>' + money(row.net) + '</td><td>' + money(row.ending) + '</td><td>' + money(row.variance) + '</td></tr>';
          })
          .join('') +
        '</tbody></table></div>';
      const chart =
        '<div class="mini-chart">' +
        rows
          .map(function (row) {
            const height = Math.max(8, Math.min(100, Math.abs(row.ending) / Math.max(Math.abs(lowestCash), startingCash, 1) * 100));
            return '<span title="Week ' + row.week + ': ' + money(row.ending) + '" style="height:' + height + '%" class="' + (row.ending < minimumReserve ? 'bar-warn' : 'bar-ok') + '"></span>';
          })
          .join('') +
        '</div>';

      renderResult(output, {
        title: '13-week cash outlook',
        badgeLabel: label,
        badgeLevel: level,
        summary: 'Lowest projected cash is ' + money(lowestCash) + '. Available liquidity including line of credit is roughly ' + money(lowestCash + loc) + ' at the low point.',
        metrics: [
          { label: 'Weeks below reserve', value: String(weeksBelowReserve) },
          { label: 'First week below reserve', value: firstBelowReserve ? 'Week ' + firstBelowReserve : 'None indicated' },
          { label: 'First week negative', value: firstNegative ? 'Week ' + firstNegative : 'None indicated' },
          { label: 'Top issues detected', value: topIssues.length ? topIssues.join(' ') : 'No major pressure indicators from entries' }
        ],
        customHtml:
          chart +
          table +
          '<div class="cta-strip"><a class="btn btn-secondary" download="13-week-cash-flow-forecast.csv" href="' +
          csvHref +
          '">Download CSV</a></div>' +
          '<h3>Recommended next steps</h3>' +
          checklist(['Build or update the weekly cash process.', 'Reconcile AR/AP and verify collection timing.', 'Review payroll, debt, tax, and owner distribution timing.']) +
          '<h3>What to gather before speaking with us</h3>' +
          checklist(['Current bank balances.', 'AR aging and AP aging.', 'Payroll schedule.', 'Upcoming tax, debt, rent, and vendor obligations.']),
        ctaHref: '/contact',
        ctaLabel: config.cta.cashFlow
      });
    });
  }

  function initSCorpTool() {
    const form = $('[data-tool="s-corp"]');
    if (!form) return;
    const output = $('#s-corp-output');
    bindResultActions(form, output);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!ensureFormIsValid(form)) return;
      const data = formData(form);
      const profit = num(data.net_profit);
      const salary = num(data.owner_salary);
      const payrollRate = num(data.payroll_tax_rate, config.assumptions.sCorp.payrollTaxRate) / 100;
      const seRate = num(data.self_employment_tax_rate, config.assumptions.sCorp.selfEmploymentTaxRate) / 100;
      const complianceCost =
        num(data.payroll_provider_cost) +
        num(data.s_corp_return_cost) +
        num(data.bookkeeping_cleanup_cost) +
        num(data.state_filing_cost) +
        num(data.advisory_cost);

      if (!validateNonNegative([profit, salary, payrollRate, seRate, complianceCost], output)) return;

      const currentSE = profit * seRate;
      const sCorpPayroll = salary * payrollRate;
      const grossSavings = Math.max(currentSE - sCorpPayroll, 0);
      const netBenefit = grossSavings - complianceCost;
      const breakEvenProfit = seRate > 0 ? (sCorpPayroll + complianceCost) / seRate : 0;
      const opportunity =
        netBenefit < config.riskThresholds.opportunity.marginal ? ['Not likely worth exploring yet', 'low'] :
          netBenefit < config.riskThresholds.opportunity.review ? ['Possible but marginal', 'medium'] :
            netBenefit < config.riskThresholds.opportunity.strong ? ['Worth reviewing', 'high'] :
              ['Strong candidate for review', 'critical'];
      const warnings = [
        'Owner salary must be reasonable for the services performed.',
        'Payroll setup and a separate business return are generally part of S-corp administration.',
        'Bookkeeping must be clean enough to track salary, distributions, basis, and reimbursements.',
        'NY and NJ treatment can complicate the analysis.'
      ];
      if (data.clean_books !== 'Yes') warnings.push('Messy or uncertain books increase implementation risk.');
      if (data.owner_active !== 'Yes') warnings.push('Owner involvement affects the reasonable compensation conversation.');

      renderResult(output, {
        title: 'S-Corp screening estimate',
        badgeLabel: opportunity[0],
        badgeLevel: opportunity[1],
        summary: 'This simplified screen estimates whether an S-corp election may deserve professional review. It does not decide whether an election is appropriate.',
        metrics: [
          { label: 'Current SE tax exposure estimate', value: money(currentSE) },
          { label: 'S-Corp payroll tax estimate', value: money(sCorpPayroll) },
          { label: 'Gross payroll/SE tax savings estimate', value: money(grossSavings) },
          { label: 'Added annual compliance costs', value: money(complianceCost) },
          { label: 'Estimated net opportunity', value: money(netBenefit) },
          { label: 'Rough break-even profit level', value: money(breakEvenProfit) }
        ],
        customHtml:
          '<h3>Warnings to review</h3>' +
          checklist(warnings) +
          '<h3>Common mistakes we see</h3>' +
          checklist(['Using an unrealistic salary.', 'Making the election without clean books.', 'Ignoring payroll and state filing requirements.', 'Treating distributions casually.']) +
          '<h3>What to gather before speaking with us</h3>' +
          checklist(['Current-year P&L.', 'Prior year business return.', 'Payroll and owner draw history.', 'Entity formation documents.', 'Bookkeeping status summary.']) +
          '<p class="assumption-note">' +
          config.assumptions.sCorp.breakEvenNote +
          '</p>',
        ctaHref: '/contact',
        ctaLabel: config.cta.sCorp
      });
    });
  }

  function initPtetTool() {
    const form = $('[data-tool="ptet-bait"]');
    if (!form) return;
    const output = $('#ptet-output');
    bindResultActions(form, output);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!ensureFormIsValid(form)) return;
      const data = formData(form);
      const income = num(data.entity_income);
      const owners = num(data.owner_count);
      const deadlineDays = daysUntil(data.deadline_date);
      let score = 0;

      if (['Partnership', 'Multi-member LLC taxed as partnership', 'S-corporation'].includes(data.entity_type)) score += 25;
      if (income > 0) score += income >= config.assumptions.ptetBait.highIncomeMarker ? 20 : 10;
      if (['NY', 'NYC', 'NJ', 'NY and NJ', 'Multi-state'].includes(data.state_connection)) score += 15;
      if (data.has_nyc_owners === 'Yes' || data.has_ny_owners === 'Yes' || data.has_nj_owners === 'Yes') score += 10;
      if (data.prior_elections !== 'Yes') score += 8;
      if (data.quarterly_estimates !== 'Yes') score += 8;
      if (data.books_current !== 'Yes') score += 10;
      if (data.cash_flow_concern === 'Very tight') score += 8;
      if (deadlineDays !== null && deadlineDays <= 30) score += 12;
      if (owners > 1) score += 4;

      const level = score >= config.riskThresholds.ptet.urgent ? ['Urgent review', 'critical'] :
        score >= config.riskThresholds.ptet.high ? ['High priority', 'high'] :
          score >= config.riskThresholds.ptet.moderate ? ['Moderate priority', 'medium'] : ['Low priority', 'low'];
      const regimes = [];
      if (['NY', 'NYC', 'NY and NJ', 'Multi-state'].includes(data.state_connection)) regimes.push('NY PTET');
      if (data.state_connection === 'NYC' || data.has_nyc_owners === 'Yes') regimes.push('NYC PTET');
      if (['NJ', 'NY and NJ', 'Multi-state'].includes(data.state_connection)) regimes.push('NJ BAIT');
      if (!regimes.length) regimes.push('None obvious based on inputs; needs review if facts differ.');

      renderResult(output, {
        title: 'Election review priority',
        badgeLabel: level[0],
        badgeLevel: level[1],
        summary: 'This screen flags whether NY PTET, NYC PTET, or NJ BAIT may deserve review based on entity type, owner profile, income, books, estimates, and timing.',
        metrics: [
          { label: 'Priority score', value: score + '/100+' },
          { label: 'Potential regimes to review', value: regimes.join(', ') },
          { label: 'Deadline timing', value: deadlineDays === null ? 'No date entered' : deadlineDays < 0 ? 'Date appears past' : deadlineDays + ' days away' },
          { label: 'Estimated entity income', value: money(income) }
        ],
        customHtml:
          '<h3>Potential planning benefits</h3>' +
          checklist(['Possible federal SALT workaround benefit.', 'Owner-level credit mechanics.', 'Estimated tax planning.', 'Entity cash-flow planning.']) +
          '<h3>Potential issues</h3>' +
          checklist(['Wrong entity type.', 'Owner residency complexity.', 'Missed election timing.', 'Underpayment or cash-flow strain.', 'Multi-state allocation complexity.']) +
          '<h3>What to gather before speaking with us</h3>' +
          checklist(['Prior year entity return.', 'Current-year P&L.', 'Owner residency information.', 'K-1s.', 'Prior PTET/BAIT filings.', 'Estimated tax payments.', 'Ownership agreement.']) +
          '<p class="assumption-note">' +
          config.assumptions.ptetBait.sourceNote +
          '</p>',
        ctaHref: '/contact',
        ctaLabel: config.cta.ptet
      });
    });
  }

  function initNoticeTool() {
    const form = $('[data-tool="notice"]');
    if (!form) return;
    const output = $('#notice-output');
    bindResultActions(form, output);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!ensureFormIsValid(form)) return;
      const data = formData(form);
      const amount = num(data.notice_amount);
      const remainingDays = daysUntil(data.deadline_date);
      let score = 0;

      if (remainingDays !== null && remainingDays <= config.assumptions.notice.urgentDays) score += 25;
      if (remainingDays !== null && remainingDays < 0) score += 30;
      if (data.collection_language === 'Yes') score += 22;
      if (data.audit_language === 'Yes') score += 18;
      if (data.category === 'Levy/garnishment/collection') score += 25;
      if (data.category === 'Missing return') score += 15;
      if (['Payroll tax', 'Sales tax'].includes(data.tax_type)) score += 18;
      if (amount >= config.assumptions.notice.highBalance) score += 15;
      else if (amount >= config.assumptions.notice.moderateBalance) score += 8;
      if (data.already_responded === 'Yes' && data.agree_notice !== 'Yes') score += 8;
      if (data.returns_filed !== 'Yes') score += 10;
      if (data.payment_records !== 'Yes') score += 8;

      const level = score >= config.riskThresholds.notice.urgent ? ['Urgent', 'critical'] :
        score >= config.riskThresholds.notice.high ? ['High priority', 'high'] :
          score >= config.riskThresholds.notice.attention ? ['Needs attention', 'medium'] : ['Routine review', 'low'];
      const doFirst = [
        'Verify the notice is legitimate.',
        'Identify the agency, tax period, notice date, and response deadline.',
        'Compare the notice to the filed return and payment records.',
        'Gather supporting documents.',
        'Do not ignore the deadline.',
        'Do not automatically pay if you disagree or do not understand the issue.'
      ];
      const getHelp = [
        'Levy, garnishment, or collection language appears.',
        'The balance is large or involves multiple years.',
        'The issue involves sales tax or payroll tax.',
        'The notice references audit or examination.',
        'The deadline is within 14 days or already passed.',
        'You disagree with a proposed adjustment.'
      ];

      renderResult(output, {
        title: 'Tax notice urgency screen',
        badgeLabel: level[0],
        badgeLevel: level[1],
        summary: 'This does not mean you are in trouble, but it does mean the issue deserves review. The biggest mistake is ignoring the notice or guessing.',
        metrics: [
          { label: 'Likely notice category', value: data.category || 'Not sure' },
          { label: 'Agency', value: data.agency || 'Not sure' },
          { label: 'Tax type', value: data.tax_type || 'Not sure' },
          { label: 'Amount shown', value: money(amount) },
          { label: 'Deadline timing', value: remainingDays === null ? 'No date entered' : remainingDays < 0 ? 'Date appears past' : remainingDays + ' days away' }
        ],
        customHtml:
          '<h3>Do first</h3>' +
          checklist(doFirst) +
          '<h3>Get help immediately if</h3>' +
          checklist(getHelp) +
          '<h3>What to gather before speaking with us</h3>' +
          checklist(['Copy of notice.', 'Relevant tax return.', 'Proof of payment.', 'Account transcript if available.', 'Payroll/sales tax filings if applicable.', 'Bookkeeping reports.', 'Correspondence history.']),
        ctaHref: '/contact',
        ctaLabel: config.cta.notice
      });
    });
  }

  function initSalesTaxTool() {
    const form = $('[data-tool="sales-tax"]');
    if (!form) return;
    const output = $('#sales-tax-output');
    bindResultActions(form, output);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!ensureFormIsValid(form)) return;
      const data = formData(form);
      const monthlySales = num(data.monthly_sales);
      const taxablePercent = num(data.taxable_percent);
      const salesTaxRate = num(data.sales_tax_rate, config.assumptions.salesTax.defaultRate);
      const months = num(data.noncompliance_months);

      if (!validateNonNegative([monthlySales, taxablePercent, salesTaxRate, months], output)) return;

      const taxableSales = monthlySales * (taxablePercent / 100) * months;
      const baseExposure = taxableSales * (salesTaxRate / 100);
      const lowAddon = baseExposure * (config.assumptions.salesTax.lowPenaltyInterestAddon / 100);
      const highAddon = baseExposure * (config.assumptions.salesTax.highPenaltyInterestAddon / 100);
      let score = 0;

      if (data.returns_filed !== 'Yes, but may be wrong') score += 12;
      if (['Yes', 'Sometimes'].includes(data.tax_collected)) score += 20;
      if (!['None', 'Not sure'].includes(data.notices_received)) score += 18;
      if (months > config.assumptions.salesTax.stalePeriodMonths) score += 12;
      if (baseExposure >= config.riskThresholds.salesTax.urgent) score += 25;
      else if (baseExposure >= config.riskThresholds.salesTax.high) score += 18;
      else if (baseExposure >= config.riskThresholds.salesTax.moderate) score += 10;
      if (data.marketplace_sales === 'Yes') score += 8;
      if (data.exempt_customers === 'Yes') score += 8;
      if (data.multi_state_sales === 'Yes') score += 10;
      if (data.sales_tax_payable === 'Yes') score += 12;

      const level = score >= 75 ? ['Urgent', 'critical'] : score >= 50 ? ['High', 'high'] : score >= 25 ? ['Moderate', 'medium'] : ['Low', 'low'];
      const nextSteps = [
        'Quantify the exposure from sales reports and filed returns.',
        'Reconcile sales tax payable in the books.',
        'Identify registration, filing, collection, and remittance gaps.'
      ];

      renderResult(output, {
        title: 'Sales tax exposure estimate',
        badgeLabel: level[0] + ' risk indicator',
        badgeLevel: level[1],
        summary: 'A cleanup plan starts with quantifying the exposure. Sales tax problems usually get more expensive when they sit unresolved.',
        metrics: [
          { label: 'Estimated taxable sales', value: money(taxableSales) },
          { label: 'Estimated base tax exposure', value: money(baseExposure) },
          { label: 'Illustrative low add-on', value: money(lowAddon) },
          { label: 'Illustrative high add-on', value: money(highAddon) },
          { label: 'Estimated total exposure range', value: money(baseExposure + lowAddon) + ' - ' + money(baseExposure + highAddon) }
        ],
        customHtml:
          '<h3>Top recommended next steps</h3>' +
          checklist(nextSteps) +
          '<h3>Common mistakes we see</h3>' +
          checklist(['Collecting tax and not remitting it.', 'Assuming marketplace sales solve every filing issue.', 'Ignoring exemption certificate documentation.', 'Letting QuickBooks sales tax payable sit unreconciled.']) +
          '<h3>What to gather before speaking with us</h3>' +
          checklist(['Sales reports.', 'POS reports.', 'Shopify/Amazon/marketplace reports if applicable.', 'Filed sales tax returns.', 'QuickBooks sales tax payable detail.', 'Exemption certificates.', 'Bank statements if needed.']) +
          '<p class="assumption-note">Penalty and interest add-ons are illustrative only, not an actual agency calculation.</p>',
        ctaHref: '/contact',
        ctaLabel: config.cta.salesTax
      });
    });
  }

  initWeeklyGrid();
  initLeadCapture();
  initCashFlowTool();
  initSCorpTool();
  initPtetTool();
  initNoticeTool();
  initSalesTaxTool();
})();
