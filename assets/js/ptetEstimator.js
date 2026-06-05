(function () {
  const STORAGE_KEY = 'msh_ptet_2026_estimate';
  // Source metadata lives in /config/2026/*.json so tax assumptions can be reviewed annually without editing UI copy.
  const CONFIG_PATHS = [
    '/config/2026/federal.json',
    '/config/2026/ny-ptet.json',
    '/config/2026/nyc-ptet.json',
    '/config/2026/nj-bait.json',
    '/config/2026/ptet-tool.json'
  ];
  const RESULT_OPTIONS = {
    recommendation: ['Needs CPA review', 'Likely beneficial (estimate)', 'Likely not beneficial (estimate)'],
    confidence: ['Low', 'Medium', 'High'],
    complexity: ['Simple', 'Moderate', 'Complex'],
    regimes: ['NY PTET', 'NYC PTET', 'NJ BAIT']
  };
  const FALLBACK_CONFIDENCE_REASONS = ['Known ownership facts.', 'Known residency/sourcing inputs.', 'Known QBI response.'];
  const FALLBACK_CHANGE_FACTORS = [
    'Owner residency and sourcing details.',
    'Special allocations, guaranteed payments, or tiered ownership.',
    'QBI deduction treatment and SSTB status.',
    'Current-year election/payment deadlines and cash flow.'
  ];
  const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value) {
    return moneyFormatter.format(value || 0);
  }

  function loadConfig() {
    return Promise.all(CONFIG_PATHS.map(function (path) {
      return fetch(path).then(function (response) {
        if (!response.ok) throw new Error('Unable to load ' + path);
        return response.json();
      });
    })).then(function (items) {
      const config = {
        federal: items[0],
        ny: items[1],
        nyc: items[2],
        nj: items[3],
        tool: items[4]
      };
      validateConfigShape(config);
      return config;
    });
  }

  function validateConfigShape(config) {
    if (!config.federal || !config.federal.saltCap || !config.federal.taxSchedules) {
      throw new Error('Federal 2026 config is missing required tax tables.');
    }
    if (!config.ny || !Array.isArray(config.ny.rateTable)) {
      throw new Error('NY PTET 2026 config is missing a rate table.');
    }
    if (!config.nyc || typeof config.nyc.rate !== 'number') {
      throw new Error('NYC PTET 2026 config is missing a rate.');
    }
    if (!config.nj || !Array.isArray(config.nj.rateTable)) {
      throw new Error('NJ BAIT 2026 config is missing a rate table.');
    }
    if (!config.tool || !config.tool.disclaimer) {
      throw new Error('PTET tool metadata is missing a disclaimer.');
    }
    return true;
  }

  function calcSALTCap(filingStatus, magi, federalConfig) {
    const key = filingStatus || 'single';
    const cfg = federalConfig.saltCap[key] || federalConfig.saltCap.single;
    const reduction = Math.max(0, magi - cfg.phaseoutStartMAGI) * cfg.reductionRate;
    return Math.max(cfg.floor, cfg.cap - reduction);
  }

  function calcFederalTax(taxableIncome, filingStatus, federalConfig) {
    const schedule = federalConfig.taxSchedules[filingStatus] || federalConfig.taxSchedules.single;
    const bracket = schedule.reduce(function (current, next) {
      return taxableIncome >= next.over ? next : current;
    }, schedule[0]);
    return Math.max(0, bracket.baseTax + (taxableIncome - bracket.over) * bracket.rate);
  }

  function calcProgressiveTax(income, table) {
    const row = table.find(function (item) {
      return item.upTo === null || income <= item.upTo;
    }) || table[table.length - 1];
    if (typeof row.base === 'number') {
      return row.base + Math.max(0, income - row.over) * row.rate;
    }
    return income * row.rate;
  }

  function getMarginalRate(taxableIncome, filingStatus, federalConfig) {
    const schedule = federalConfig.taxSchedules[filingStatus] || federalConfig.taxSchedules.single;
    const bracket = schedule.reduce(function (current, next) {
      return taxableIncome >= next.over ? next : current;
    }, schedule[0]);
    return bracket.rate;
  }

  function estimateMAGI(bucket, wages, investments, otherIncome, passThroughIncome) {
    const bucketDefaults = {
      under_250: 200000,
      '250_500': 375000,
      '500_650': 575000,
      '650_1m': 800000,
      over_1m: 1200000
    };
    return Math.max(bucketDefaults[bucket] || 250000, wages + investments + otherIncome + passThroughIncome);
  }

  function mapEntity(raw, advanced) {
    const ownership = num(raw.ownership_percent) / 100;
    const guaranteedPayments = num(raw.guaranteed_payments);
    const profit = num(raw.profit) + guaranteedPayments;
    const nySourcePercent = num(raw.ny_source_percent || raw.ny_source) / 100;
    const njSourcePercent = num(raw.nj_source_percent || raw.nj_source) / 100;
    return {
      nickname: raw.nickname || 'Entity',
      type: raw.type || 'partnership',
      operatesIn: raw.operates_in || 'NY',
      ownership,
      profit,
      userProfit: profit * ownership,
      mixedOwners: raw.mixed_owners || 'no',
      njOwners: raw.nj_owners || 'not_sure',
      tieredOwners: raw.tiered_owners || 'no',
      specialAllocations: raw.special_allocations || 'no',
      nySourcePercent: nySourcePercent || (raw.operates_in === 'NY' || raw.operates_in === 'NYC' ? 1 : 0),
      njSourcePercent: njSourcePercent || (raw.operates_in === 'NJ' ? 1 : 0),
      nycResidentPercent: advanced ? num(raw.nyc_resident_percent) / 100 : (raw.operates_in === 'NYC' ? ownership : 0),
      guaranteedPayments,
      ownerRosterComplexity: raw.owner_roster_complexity || 'simple'
    };
  }

  function collectQuickForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const entities = [];
    $all('[data-entity-row]', form).forEach(function (row, index) {
      entities.push(mapEntity({
        nickname: $('[name="entity_nickname_' + index + '"]', row).value,
        type: $('[name="entity_type_' + index + '"]', row).value,
        operates_in: $('[name="entity_operates_' + index + '"]', row).value,
        ownership_percent: $('[name="entity_ownership_' + index + '"]', row).value,
        profit: $('[name="entity_profit_' + index + '"]', row).value,
        mixed_owners: $('[name="entity_mixed_' + index + '"]', row).value,
        ny_source_percent: $('[name="entity_ny_source_' + index + '"]', row).value,
        nj_owners: $('[name="entity_nj_owners_' + index + '"]', row).value,
        tiered_owners: $('[name="entity_tiered_' + index + '"]', row).value,
        special_allocations: $('[name="entity_specials_' + index + '"]', row).value
      }));
    });
    return {
      mode: 'quick',
      filingStatus: data.filing_status,
      nycResident: data.nyc_resident,
      nysResident: data.nys_resident,
      njResident: data.nj_resident,
      magiBucket: data.magi_bucket,
      wages: num(data.wages),
      investments: num(data.investment_income),
      otherIncome: num(data.other_income),
      propertyTax: num(data.property_tax),
      personalSalt: num(data.personal_salt),
      mortgageInterest: num(data.mortgage_interest),
      charity: num(data.charity),
      qbi: data.qbi,
      sstb: data.sstb,
      entities
    };
  }

  function collectAdvancedForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const entities = [];
    $all('[data-advanced-entity-row]', form).forEach(function (row, index) {
      entities.push(mapEntity({
        nickname: $('[name="entity_nickname_' + index + '"]', row).value,
        type: $('[name="entity_type_' + index + '"]', row).value,
        operates_in: $('[name="entity_operates_' + index + '"]', row).value,
        ownership_percent: $('[name="entity_ownership_' + index + '"]', row).value,
        profit: $('[name="entity_profit_' + index + '"]', row).value,
        mixed_owners: $('[name="entity_mixed_' + index + '"]', row).value,
        ny_source_percent: $('[name="entity_ny_source_' + index + '"]', row).value,
        nj_source_percent: $('[name="entity_nj_source_' + index + '"]', row).value,
        nyc_resident_percent: $('[name="entity_nyc_resident_' + index + '"]', row).value,
        guaranteed_payments: $('[name="entity_guaranteed_' + index + '"]', row).value,
        tiered_owners: $('[name="entity_tiered_' + index + '"]', row).value,
        special_allocations: $('[name="entity_specials_' + index + '"]', row).value,
        owner_roster_complexity: $('[name="entity_roster_' + index + '"]', row).value
      }, true));
    });
    return {
      mode: 'advanced',
      filingStatus: data.filing_status,
      nycResident: data.nyc_resident,
      nysResident: data.nys_resident,
      njResident: data.nj_resident,
      magiBucket: data.magi_bucket,
      wages: num(data.wages),
      investments: num(data.investment_income),
      otherIncome: num(data.other_income),
      propertyTax: num(data.property_tax),
      personalSalt: num(data.personal_salt),
      mortgageInterest: num(data.mortgage_interest),
      charity: num(data.charity),
      qbi: data.qbi,
      sstb: data.sstb,
      entities
    };
  }

  function estimatePTET(inputs, config) {
    const passThroughIncome = inputs.entities.reduce(function (sum, entity) {
      return sum + entity.userProfit;
    }, 0);
    const magi = estimateMAGI(inputs.magiBucket, inputs.wages, inputs.investments, inputs.otherIncome, passThroughIncome);
    const saltCap = calcSALTCap(inputs.filingStatus, magi, config.federal);
    const baselineSalt = inputs.personalSalt + inputs.propertyTax;
    const baselineItemized = Math.max(config.federal.standardDeduction[inputs.filingStatus] || 0, Math.min(saltCap, baselineSalt) + inputs.mortgageInterest + inputs.charity);

    let entityTax = 0;
    let relevantRegimes = [];
    const details = [];

    inputs.entities.forEach(function (entity) {
      let entityBase = 0;
      let entityTaxItem = 0;
      const regimes = [];
      if (['NY', 'NYC', 'NY and NJ'].includes(entity.operatesIn)) {
        entityBase += entity.profit * (entity.mixedOwners === 'yes' ? entity.nySourcePercent : 1);
        entityTaxItem += calcProgressiveTax(Math.max(0, entityBase), config.ny.rateTable);
        regimes.push('NY PTET');
      }
      if (entity.operatesIn === 'NYC' || inputs.nycResident === 'full_year') {
        const nycBase = entity.profit * Math.max(entity.nycResidentPercent, inputs.nycResident === 'full_year' ? entity.ownership : 0);
        entityTaxItem += nycBase * config.nyc.rate;
        regimes.push('NYC PTET');
      }
      if (['NJ', 'NY and NJ'].includes(entity.operatesIn) || inputs.njResident === 'full_year') {
        const njBase =
          entity.type === 'partnership'
            ? entity.profit * (inputs.njResident === 'full_year' ? entity.ownership : entity.njSourcePercent)
            : entity.profit * entity.njSourcePercent;
        entityTaxItem += calcProgressiveTax(Math.max(0, njBase), config.nj.rateTable);
        regimes.push('NJ BAIT');
      }
      entityTax += entityTaxItem;
      relevantRegimes = relevantRegimes.concat(regimes);
      details.push({ name: entity.nickname, regimes, estimatedEntityTax: entityTaxItem });
    });

    const taxableBaseline = Math.max(0, magi - baselineItemized);
    const qbiGiveback = inputs.qbi === 'yes' ? entityTax * 0.2 : inputs.qbi === 'not_sure' ? entityTax * 0.1 : 0;
    const taxableWithElection = Math.max(0, magi - entityTax + qbiGiveback - baselineItemized);
    const federalBaseline = calcFederalTax(taxableBaseline, inputs.filingStatus, config.federal);
    const federalWithElection = calcFederalTax(taxableWithElection, inputs.filingStatus, config.federal);
    const pointEstimate = Math.max(0, federalBaseline - federalWithElection);
    const low = Math.max(0, pointEstimate * (inputs.qbi === 'not_sure' ? 0.55 : 0.75));
    const high = pointEstimate * (inputs.qbi === 'not_sure' ? 1.15 : 1.05);
    const marginalRate = getMarginalRate(taxableBaseline, inputs.filingStatus, config.federal);

    const confidenceFlags = [];
    inputs.entities.forEach(function (entity) {
      if (['yes', 'not_sure'].includes(entity.tieredOwners)) confidenceFlags.push('Tiered or corporate owners require review.');
      if (['yes', 'not_sure'].includes(entity.specialAllocations)) confidenceFlags.push('Special allocations or guaranteed payments can change pools.');
      if (entity.mixedOwners !== 'no' && !entity.nySourcePercent) confidenceFlags.push('Mixed residency requires reliable sourcing.');
      if (entity.ownerRosterComplexity !== 'simple') confidenceFlags.push('Owner roster details add complexity.');
    });
    if (inputs.qbi === 'not_sure') confidenceFlags.push('QBI treatment is not known.');
    if (inputs.sstb === 'not_sure') confidenceFlags.push('SSTB status is not known.');

    const confidence = confidenceFlags.length >= 3 ? 'Low' : confidenceFlags.length ? 'Medium' : 'High';
    const complexity = confidence === 'Low' || inputs.entities.length > 2 ? 'Complex' : confidence === 'Medium' ? 'Moderate' : 'Simple';
    const recommendation = confidence === 'Low' ? 'Needs CPA review' : pointEstimate > 1500 ? 'Likely beneficial (estimate)' : 'Likely not beneficial (estimate)';

    return {
      recommendation,
      confidence,
      confidenceReasons: confidenceFlags.length ? confidenceFlags.slice(0, 3) : ['Known ownership facts.', 'Known residency/sourcing inputs.', 'Known QBI response.'],
      complexity,
      savingsRange: { low, high },
      pointEstimate,
      marginalRate,
      saltCap,
      entityTax,
      qbiGiveback,
      relevantRegimes: Array.from(new Set(relevantRegimes)),
      details,
      whatCouldChange: [
        'Owner residency and sourcing details.',
        'Special allocations, guaranteed payments, or tiered ownership.',
        'QBI deduction treatment and SSTB status.',
        'Current-year election/payment deadlines and cash flow.'
      ]
    };
  }

  function saveEstimate(inputs, result) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputs, result, savedAt: new Date().toISOString() }));
  }

  function encodeEstimate(saved) {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(saved))));
    } catch (error) {
      return '';
    }
  }

  function decodeEstimate(encoded) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(encoded))));
    } catch (error) {
      return null;
    }
  }

  function finiteAmount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(parsed, 1000000000));
  }

  function knownValue(value, options) {
    return options.includes(value) ? value : '';
  }

  function cleanResultText(value, maxLength) {
    if (typeof value !== 'string') return '';
    const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!text || /[<>]/.test(text)) return '';
    return text.slice(0, maxLength);
  }

  function cleanTextList(values, fallback) {
    if (!Array.isArray(values)) return fallback.slice();
    const cleaned = values.map(function (value) {
      return cleanResultText(value, 180);
    }).filter(Boolean).slice(0, 5);
    return cleaned.length ? cleaned : fallback.slice();
  }

  function normalizeSavedEstimate(saved) {
    if (!saved || typeof saved !== 'object' || !saved.result || typeof saved.result !== 'object') {
      return null;
    }

    const result = saved.result;
    const recommendation = knownValue(result.recommendation, RESULT_OPTIONS.recommendation);
    const confidence = knownValue(result.confidence, RESULT_OPTIONS.confidence);
    const complexity = knownValue(result.complexity, RESULT_OPTIONS.complexity);
    const savingsRange = result.savingsRange && typeof result.savingsRange === 'object' ? result.savingsRange : null;

    if (!recommendation || !confidence || !complexity || !savingsRange) {
      return null;
    }

    return {
      result: {
        recommendation,
        confidence,
        confidenceReasons: cleanTextList(result.confidenceReasons, FALLBACK_CONFIDENCE_REASONS),
        complexity,
        savingsRange: {
          low: finiteAmount(savingsRange.low),
          high: finiteAmount(savingsRange.high)
        },
        pointEstimate: finiteAmount(result.pointEstimate),
        marginalRate: finiteAmount(result.marginalRate),
        saltCap: finiteAmount(result.saltCap),
        entityTax: finiteAmount(result.entityTax),
        qbiGiveback: finiteAmount(result.qbiGiveback),
        relevantRegimes: Array.isArray(result.relevantRegimes)
          ? result.relevantRegimes.filter(function (regime) {
            return RESULT_OPTIONS.regimes.includes(regime);
          }).slice(0, RESULT_OPTIONS.regimes.length)
          : [],
        whatCouldChange: cleanTextList(result.whatCouldChange, FALLBACK_CHANGE_FACTORS)
      }
    };
  }

  function loadEstimate() {
    try {
      const hashMatch = window.location.hash.match(/estimate=([^&]+)/);
      if (hashMatch) {
        const fromHash = normalizeSavedEstimate(decodeEstimate(hashMatch[1]));
        if (fromHash) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
          return fromHash;
        }
      }
      return normalizeSavedEstimate(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    } catch (error) {
      return null;
    }
  }

  function appendText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function appendMetric(list, label, value) {
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = label + ':';
    item.appendChild(strong);
    item.appendChild(document.createTextNode(' ' + value));
    list.appendChild(item);
  }

  function appendTextList(parent, heading, items) {
    appendText(parent, 'h3', heading);
    const list = document.createElement('ul');
    list.className = 'outcome-list';
    items.forEach(function (item) {
      appendText(list, 'li', item);
    });
    parent.appendChild(list);
  }

  function renderSavedResult(mount, saved) {
    const result = saved.result;
    const prominent = result.confidence === 'Low' || result.recommendation === 'Needs CPA review';
    const beneficial = result.recommendation.indexOf('Likely beneficial') === 0;
    const section = document.createElement('section');
    section.className = 'result-card';

    const resultHead = document.createElement('div');
    resultHead.className = 'result-head';
    appendText(resultHead, 'h2', result.recommendation);
    appendText(resultHead, 'span', result.confidence + ' confidence', 'risk-badge risk-' + (prominent ? 'critical' : beneficial ? 'high' : 'medium'));
    section.appendChild(resultHead);

    const metrics = document.createElement('ul');
    metrics.className = 'calc-breakdown';
    appendMetric(metrics, 'Estimated federal savings range', money(result.savingsRange.low) + ' - ' + money(result.savingsRange.high));
    appendMetric(metrics, 'Complexity meter', result.complexity);
    appendMetric(metrics, 'Estimated entity-level PTET/BAIT expense', money(result.entityTax));
    appendMetric(metrics, 'QBI give-back estimate', money(result.qbiGiveback));
    appendMetric(metrics, 'Regimes indicated', result.relevantRegimes.join(', ') || 'None obvious');
    section.appendChild(metrics);

    appendTextList(section, 'Top confidence reasons', result.confidenceReasons);
    appendTextList(section, 'What could change this result', result.whatCouldChange);
    appendText(section, 'h3', 'What we did / what we did not do');
    appendText(section, 'p', 'We modeled a simplified federal baseline versus entity-level PTET/BAIT expense using 2026 config assumptions. We did not perform a full state return calculation, basis analysis, QBI limitation analysis, or formal election recommendation.');

    const ctaStrip = document.createElement('div');
    ctaStrip.className = 'cta-strip';
    const contactLink = document.createElement('a');
    contactLink.className = 'btn btn-primary';
    contactLink.href = '/contact';
    contactLink.textContent = 'Talk to a CPA';
    ctaStrip.appendChild(contactLink);
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-secondary';
    saveButton.type = 'button';
    saveButton.setAttribute('data-save-result', '');
    saveButton.textContent = 'Save my results';
    ctaStrip.appendChild(saveButton);
    const printButton = document.createElement('button');
    printButton.className = 'btn btn-secondary';
    printButton.type = 'button';
    printButton.setAttribute('data-print-result', '');
    printButton.textContent = 'Print result';
    ctaStrip.appendChild(printButton);
    section.appendChild(ctaStrip);

    mount.textContent = '';
    mount.appendChild(section);
  }

  function renderEntityRows(container, count, advanced) {
    container.innerHTML = Array.from({ length: count }, function (_, index) {
      const attr = advanced ? 'data-advanced-entity-row' : 'data-entity-row';
      const extra = advanced
        ? '<div><label>NJ-source %<input name="entity_nj_source_' + index + '" type="number" min="0" max="100" step="1" value="0"></label></div><div><label>NYC resident owner %<input name="entity_nyc_resident_' + index + '" type="number" min="0" max="100" step="1" value="0"></label></div><div><label>Primary owner type<select name="entity_owner_type_' + index + '"><option>Individual</option><option>Trust</option><option>Estate</option><option>Corporation</option><option>Partnership</option><option>Disregarded entity</option></select></label></div><div><label>NY resident owner >= half-year?<select name="entity_ny_owner_half_' + index + '"><option>Yes</option><option>No</option><option>Not sure</option></select></label></div><div><label>NYC resident owner >= half-year?<select name="entity_nyc_owner_half_' + index + '"><option>No</option><option>Yes</option><option>Not sure</option></select></label></div><div><label>NJ resident owner?<select name="entity_nj_owner_' + index + '"><option>No</option><option>Yes</option><option>Not sure</option></select></label></div><div><label>Profit/loss allocation %<input name="entity_allocation_' + index + '" type="number" min="0" max="100" step="1" value="100"></label></div><div><label>Guaranteed payments, if separate<input name="entity_guaranteed_' + index + '" type="number" min="0" step="1000" value="0"></label></div><div><label>Owner roster complexity<select name="entity_roster_' + index + '"><option value="simple">Mostly individual owners</option><option value="mixed">Mixed owner types</option><option value="complex">Trusts/entities/tiered ownership</option></select></label></div>'
        : '<div><label>Any NJ resident owners?<select name="entity_nj_owners_' + index + '"><option value="not_sure">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></label></div>';
      return (
        '<fieldset class="week-panel" ' + attr + '><legend>Entity ' + (index + 1) + '</legend><div class="form-row">' +
        '<div><label>Nickname<input name="entity_nickname_' + index + '" type="text" value="Entity ' + (index + 1) + '" required></label></div>' +
        '<div><label>Type<select name="entity_type_' + index + '"><option value="partnership">Partnership</option><option value="s_corp">S corp</option></select></label></div>' +
        '<div><label>Operates in<select name="entity_operates_' + index + '"><option>NY</option><option>NYC</option><option>NJ</option><option>NY and NJ</option><option>Other</option></select></label></div>' +
        '<div><label>Ownership %<input name="entity_ownership_' + index + '" type="number" min="0" max="100" step="1" value="100" required></label></div>' +
        '<div><label>Total entity profit estimate<input name="entity_profit_' + index + '" type="number" min="0" step="1000" required></label></div>' +
        '<div><label>Mixed NY resident/nonresident owners?<select name="entity_mixed_' + index + '"><option value="no">No</option><option value="yes">Yes</option><option value="not_sure">Not sure</option></select></label></div>' +
        '<div><label>NY-source % if mixed<input name="entity_ny_source_' + index + '" type="number" min="0" max="100" step="1" value="100"></label></div>' +
        extra +
        '<div><label>Tiered/corporate owners?<select name="entity_tiered_' + index + '"><option value="no">No</option><option value="yes">Yes</option><option value="not_sure">Not sure</option></select></label></div>' +
        '<div><label>Special allocations / guaranteed payments?<select name="entity_specials_' + index + '"><option value="no">No</option><option value="yes">Yes</option><option value="not_sure">Not sure</option></select></label></div>' +
        '</div></fieldset>'
      );
    }).join('');
  }

  function initWizard(advanced) {
    const form = advanced ? $('[data-ptet-wizard="advanced"]') : $('[data-ptet-wizard="quick"]');
    if (!form) return;
    const rows = $('[data-ptet-entities]', form);
    const count = $('[data-entity-count]', form);
    function syncRows() {
      renderEntityRows(rows, Math.max(1, Math.min(5, num(count.value))), advanced);
    }
    count.addEventListener('change', syncRows);
    syncRows();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      loadConfig().then(function (config) {
        const inputs = advanced ? collectAdvancedForm(form) : collectQuickForm(form);
        const result = estimatePTET(inputs, config);
        saveEstimate(inputs, result);
        window.location.href = '/ptet/results/';
      }).catch(function () {
        alert('Unable to load the 2026 estimator config. Please refresh and try again.');
      });
    });
  }

  function initResults() {
    const mount = $('[data-ptet-results]');
    if (!mount) return;
    const saved = loadEstimate();
    if (!saved) {
      mount.innerHTML = '<div class="result-card"><h2>No saved estimate yet</h2><p>Start with the quick estimator, then return here for results.</p><a class="btn btn-primary" href="/ptet/">Start Quick Mode</a></div>';
      return;
    }
    renderSavedResult(mount, saved);

    const packageForm = $('[data-report-package]');
    const status = $('[data-report-status]');
    if (packageForm && status) {
      packageForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!packageForm.checkValidity()) {
          packageForm.reportValidity();
          return;
        }
        const consent = validateReportConsent(
          $('[name="email"]', packageForm).value,
          $('[name="reportConsent"]', packageForm).checked,
          $('[name="marketingConsent"]', packageForm).checked
        );
        if (!consent.valid) {
          status.hidden = false;
          status.className = 'form-status error';
          status.textContent = consent.message;
          return;
        }
        // TODO: Send report email via transactional provider. Store only email, consent flags, timestamp, and source.
        status.hidden = false;
        status.className = 'form-status success';
        status.textContent = 'Report package request validated locally. Connect email provider to send the branded PDF package.';
      });
    }
    mount.addEventListener('click', function (event) {
      if (event.target.matches('[data-save-result]')) {
        const encoded = encodeEstimate(saved);
        if (encoded) {
          const url = window.location.origin + window.location.pathname + '#estimate=' + encoded;
          window.history.replaceState(null, '', url);
          navigator.clipboard && navigator.clipboard.writeText(url);
          event.target.textContent = 'Client-side result link copied';
        } else {
          event.target.textContent = 'Saved in this browser';
        }
      }
      if (event.target.matches('[data-print-result]')) {
        window.print();
      }
    });
  }

  function validateReportConsent(email, reportConsent, marketingConsent) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, canSendReport: false, canSendMarketing: false, message: 'Enter a valid email address.' };
    }
    if (!reportConsent) {
      return { valid: false, canSendReport: false, canSendMarketing: false, message: 'Check the report consent box to receive the report package.' };
    }
    return {
      valid: true,
      canSendReport: true,
      canSendMarketing: Boolean(marketingConsent),
      message: 'Consent accepted.'
    };
  }

  window.MSHPTETEstimator = {
    calcSALTCap,
    calcFederalTax,
    calcProgressiveTax,
    validateConfigShape,
    validateReportConsent,
    normalizeSavedEstimate,
    loadEstimate,
    estimatePTET,
    initWizard,
    initResults
  };

  document.addEventListener('DOMContentLoaded', function () {
    initWizard(false);
    if ($('[data-ptet-wizard="advanced"]')) initWizard(true);
    initResults();
  });
})();
