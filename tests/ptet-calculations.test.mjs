import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../assets/js/ptetEstimator.js', import.meta.url), 'utf8');

const context = {
  window: {
    location: { hash: '', origin: 'https://mshfinance.com', pathname: '/ptet/results/' },
    history: { replaceState() {} }
  },
  document: {
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  localStorage: {
    getItem() { return null; },
    setItem() {}
  },
  navigator: {},
  Intl,
  Number,
  Array,
  Math,
  JSON,
  Date,
  RegExp,
  Object,
  Promise,
  Error,
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value) => Buffer.from(value, 'base64').toString('binary')
};

vm.createContext(context);
vm.runInContext(script, context);

const estimator = context.window.MSHPTETEstimator;
const federal = JSON.parse(readFileSync(new URL('../config/2026/federal.json', import.meta.url), 'utf8'));
const ny = JSON.parse(readFileSync(new URL('../config/2026/ny-ptet.json', import.meta.url), 'utf8'));
const nyc = JSON.parse(readFileSync(new URL('../config/2026/nyc-ptet.json', import.meta.url), 'utf8'));
const nj = JSON.parse(readFileSync(new URL('../config/2026/nj-bait.json', import.meta.url), 'utf8'));
const tool = JSON.parse(readFileSync(new URL('../config/2026/ptet-tool.json', import.meta.url), 'utf8'));
const config = { federal, ny, nyc, nj, tool };

function baseInputs(entityOverrides = {}, overrides = {}) {
  return {
    filingStatus: 'single',
    nycResident: 'no',
    nysResident: 'full_year',
    njResident: 'no',
    magiBucket: '500_650',
    wages: 0,
    investments: 0,
    otherIncome: 0,
    propertyTax: 20000,
    personalSalt: 20000,
    mortgageInterest: 0,
    charity: 0,
    qbi: 'no',
    sstb: 'no',
    entities: [
      {
        nickname: 'Test Entity',
        type: 'partnership',
        operatesIn: 'NY',
        ownership: 1,
        profit: 500000,
        userProfit: 500000,
        mixedOwners: 'no',
        njOwners: 'no',
        tieredOwners: 'no',
        specialAllocations: 'no',
        nySourcePercent: 1,
        njSourcePercent: 0,
        nycResidentPercent: 0,
        ownerRosterComplexity: 'simple',
        ...entityOverrides
      }
    ],
    ...overrides
  };
}

test('validates required 2026 config shape', () => {
  assert.equal(estimator.validateConfigShape(config), true);
});

test('calculates 2026 SALT cap and MFS phaseout floor', () => {
  assert.equal(estimator.calcSALTCap('single', 400000, federal), 40400);
  assert.equal(estimator.calcSALTCap('single', 600000, federal), 11900);
  assert.equal(estimator.calcSALTCap('single', 800000, federal), 10000);
  assert.equal(estimator.calcSALTCap('married_filing_separately', 300000, federal), 5950);
  assert.equal(estimator.calcSALTCap('married_filing_separately', 400000, federal), 5000);
});

test('computes federal tax schedule boundaries', () => {
  assert.equal(estimator.calcFederalTax(12400, 'single', federal), 1240);
  assert.equal(estimator.calcFederalTax(50400, 'single', federal), 5800);
  assert.equal(estimator.calcFederalTax(110700, 'single', federal), 19166);
});

test('computes NY PTET rate table boundaries', () => {
  assert.equal(estimator.calcProgressiveTax(2000000, ny.rateTable), 137000);
  assert.equal(Math.round(estimator.calcProgressiveTax(3000000, ny.rateTable)), 233500);
  assert.equal(Math.round(estimator.calcProgressiveTax(26000000, ny.rateTable)), 2595500);
});

test('uses NYC PTET configured rate in entity estimate', () => {
  const result = estimator.estimatePTET(
    baseInputs({ operatesIn: 'NYC', profit: 100000, userProfit: 100000, nycResidentPercent: 1 }, { nycResident: 'full_year', magiBucket: 'under_250' }),
    config
  );
  assert.ok(result.relevantRegimes.includes('NYC PTET'));
  assert.equal(Math.round(result.details[0].estimatedEntityTax), 10726);
});

test('models NJ BAIT base differently for partnership and S corp', () => {
  const partnership = estimator.estimatePTET(
    baseInputs({ type: 'partnership', operatesIn: 'NJ', profit: 1000000, userProfit: 500000, ownership: 0.5, njSourcePercent: 0.4 }, { njResident: 'full_year' }),
    config
  );
  const sCorp = estimator.estimatePTET(
    baseInputs({ type: 's_corp', operatesIn: 'NJ', profit: 1000000, userProfit: 500000, ownership: 0.5, njSourcePercent: 0.4 }, { njResident: 'full_year' }),
    config
  );
  assert.equal(Math.round(partnership.details[0].estimatedEntityTax), 32600);
  assert.equal(Math.round(sCorp.details[0].estimatedEntityTax), 26080);
});

test('downgrades confidence for complex ownership and unknown QBI', () => {
  const simple = estimator.estimatePTET(baseInputs(), config);
  const complex = estimator.estimatePTET(
    baseInputs({ tieredOwners: 'yes', specialAllocations: 'yes', ownerRosterComplexity: 'complex' }, { qbi: 'not_sure', sstb: 'not_sure' }),
    config
  );
  assert.equal(simple.confidence, 'High');
  assert.equal(complex.confidence, 'Low');
  assert.equal(complex.recommendation, 'Needs CPA review');
});

test('rejects crafted PTET result links before storing saved estimate data', () => {
  const malicious = {
    result: {
      recommendation: '<img src=x onerror=alert(1)>',
      confidence: 'High',
      complexity: 'Simple',
      savingsRange: { low: 1, high: 2 },
      entityTax: 0,
      qbiGiveback: 0,
      relevantRegimes: ['NY PTET'],
      confidenceReasons: ['Known ownership facts.'],
      whatCouldChange: ['Owner residency and sourcing details.']
    }
  };
  const encoded = Buffer.from(JSON.stringify(malicious), 'utf8').toString('base64');
  let stored = null;

  context.window.location.hash = '#estimate=' + encoded;
  context.localStorage = {
    getItem() { return null; },
    setItem(key, value) { stored = { key, value }; }
  };

  assert.equal(estimator.loadEstimate(), null);
  assert.equal(stored, null);
  context.window.location.hash = '';
});

test('normalizes saved PTET estimate text before result rendering', () => {
  const result = estimator.estimatePTET(baseInputs(), config);
  result.confidenceReasons = ['Known ownership facts.', '<img src=x onerror=alert(1)>'];
  result.whatCouldChange = ['<svg onload=alert(1)>', 'QBI deduction treatment and SSTB status.'];
  result.relevantRegimes = ['NY PTET', '<script>alert(1)</script>'];

  const normalized = estimator.normalizeSavedEstimate({ result });

  assert.equal(normalized.result.recommendation, result.recommendation);
  assert.deepEqual(normalized.result.confidenceReasons, ['Known ownership facts.']);
  assert.deepEqual(normalized.result.whatCouldChange, ['QBI deduction treatment and SSTB status.']);
  assert.deepEqual(normalized.result.relevantRegimes, ['NY PTET']);
});

test('separates report consent from marketing consent', () => {
  assert.equal(estimator.validateReportConsent('owner@example.com', true, false).canSendReport, true);
  assert.equal(estimator.validateReportConsent('owner@example.com', true, false).canSendMarketing, false);
  assert.equal(estimator.validateReportConsent('owner@example.com', true, true).canSendMarketing, true);
  assert.equal(estimator.validateReportConsent('owner@example.com', false, true).valid, false);
  assert.equal(estimator.validateReportConsent('bad-email', true, true).valid, false);
});
