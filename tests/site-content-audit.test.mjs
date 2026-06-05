import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.');
const ignoredDirs = new Set(['.git', 'quickfire-cpa', 'MSH FG', 'node_modules']);
const textExts = new Set(['.html', '.js', '.css', '.md', '.xml', '.txt', '.toml']);
const educationalDisclaimer =
  'For educational and screening purposes only. These tools do not constitute legal, tax, accounting, or financial advice and do not create a CPA-client relationship. Review any results with a qualified professional before taking action.';
const resourcesDescription =
  'Free tax, cash flow, and compliance screening tools for NY and NJ business owners and individuals.';
const cpaFirmDisclosure =
  'MSH Finance Group LLC is a tax, accounting and advisory firm. While individual members or employees of MSH Finance Group LLC may hold individual Certified Public Accountant (CPA) licenses in NY and/or NJ, MSH Finance Group LLC is not registered as a CPA firm in NJ and does not offer attest services (e.g. audits or review engagements).';
const homepageRotatorQuestions = [
  'Can I afford to hire someone, buy equipment, open a new location, or should I calm down first?',
  'I got a letter from the IRS. Should I panic now or after you read it?',
  'Are we making money on this project?',
  'What does it mean to ‘close the month,’ and does it involve actually locking anything?',
  'Oh, I was supposed to be collecting sales tax? On everything?!',
  'How can I be profitable but still not have enough cash to pay myself?',
  'The IRS says I owe more than I think I owe. How do we figure out who’s right?',
  'Can I deduct this meal if we talked about business for at least 30 seconds?',
  'Can you explain my financial statements in plain English instead of accounting hieroglyphics?',
  'I saw an Instagram post about a tax strategy that the IRS doesn’t want us to know about...',
  'What are my options if I can’t pay my full tax balance?',
  'What should I be looking at each month to know whether my business is healthy?',
  'Do I really have to collect sales tax in other states if I’ve never physically been there?',
  'What happens if I haven’t filed sales tax returns in a few months… or maybe longer?'
];

async function walk(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry)) continue;
    const absolute = path.join(dir, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      files.push(...await walk(absolute));
    } else if (textExts.has(path.extname(entry))) {
      files.push(absolute);
    }
  }
  return files;
}

async function textFiles() {
  return walk(root);
}

async function htmlFiles() {
  return (await textFiles()).filter((file) => file.endsWith('.html'));
}

async function readRelative(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function relative(file) {
  return path.relative(root, file);
}

describe('site content audit', () => {
  it('uses only approved firm-name forms', async () => {
    const offenders = [];
    for (const file of await textFiles()) {
      const content = await readFile(file, 'utf8');
      const match = content.match(/MSH Finance(?! Group LLC)/);
      if (match || content.includes('MSH Finance Group, LLC')) offenders.push(relative(file));
    }
    assert.deepEqual(offenders, []);
  });

  it('removes worker and household audience language and mixed geographic naming', async () => {
    const offenders = [];
    for (const file of await textFiles()) {
      const content = await readFile(file, 'utf8');
      if (
        /\bworkers?\b/i.test(content) ||
        /\bhouseholds?\b/i.test(content) ||
        /NYC\s*(?:and|\+|\/)\s*(?:New Jersey|NJ)/i.test(content) ||
        /NY\/NJ/i.test(content) ||
        /NY\s*\+\s*NJ/i.test(content) ||
        /NY,\s*NYC,\s*and\s*NJ/i.test(content) ||
        /NYC\/NYS\/NJ/i.test(content) ||
        /IRS\/NYS\/NJ\/NYC/i.test(content)
      ) {
        offenders.push(relative(file));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('has favicon links on every html page', async () => {
    const missing = [];
    for (const file of await htmlFiles()) {
      const content = await readFile(file, 'utf8');
      if (!content.includes('rel="icon"') || !content.includes('/assets/images/favicon-32x32.png')) {
        missing.push(relative(file));
      }
    }
    assert.deepEqual(missing, []);
  });

  it('uses extensionless canonical urls', async () => {
    const offenders = [];
    for (const file of await htmlFiles()) {
      const content = await readFile(file, 'utf8');
      const canonical = content.match(/<link rel="canonical" href="([^"]+)">/);
      if (canonical && canonical[1].endsWith('.html')) {
        offenders.push(`${relative(file)} -> ${canonical[1]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('removes public editorial placeholders from about page', async () => {
    const about = await readRelative('about.html');
    assert.equal(about.includes('Add a founder headshot and final biography before launch'), false);
    assert.equal(about.includes('Publish only memberships and credentials'), false);
  });

  it('shows approved partner bios on the about page', async () => {
    const about = await readRelative('about.html');
    assert.equal(about.includes('Meet Jacqueline Srour and Morris Shalom'), true);
    assert.equal(about.includes('<h1>Expert guidance for decisions that need context</h1>'), true);
    assert.equal(about.includes('brings tax, accounting, compliance, and operating finance experience together'), true);
    assert.equal(about.includes('CPA-led guidance for New York and New Jersey'), false);
    assert.equal(about.includes('<h2>Without Further Ado, Meet the Leadership Team</h2>'), true);
    assert.equal(about.includes('<h2>Partner Bios</h2>'), false);
    assert.equal(about.includes('Partner-led guidance for decisions that need context'), false);
    assert.equal(about.includes('<h3>Jacqueline Srour</h3>'), true);
    assert.equal(about.includes('<h3>Morris Shalom</h3>'), true);
    assert.equal(about.includes('licensed attorney in New York and New Jersey'), true);
    assert.equal(about.includes('licensed CPA in both New York and New Jersey'), true);
    assert.equal(about.includes('placeholder'), false);
  });

  it('updates services FAQ answer and resources descriptions', async () => {
    const services = await readRelative('services.html');
    assert.equal(services.includes('MSH works with clients across the country for fractional CFO and advisory services, bookkeeping, and federal tax matters.'), true);
    assert.equal(services.includes('This site is now focused on'), false);
    assert.equal(services.includes('<section class="page-hero services-hero section">'), true);
    assert.equal(services.includes('<h1>Services that turn financial details into better decisions</h1>'), true);
    assert.equal(services.includes('use financial information before decisions get expensive'), true);
    assert.equal(services.includes('Services for New York and'), false);

    for (const resourcePage of ['resources.html', 'resources/index.html']) {
      const content = await readRelative(resourcePage);
      assert.equal(content.includes(`property="og:description" content="${resourcesDescription}"`), true, resourcePage);
    }
  });

  it('keeps standard page heroes clear of the oversized header logo', async () => {
    for (const page of ['about.html', 'contact.html', 'resources.html', 'resources/index.html', 'privacy-policy/index.html', 'privacy/index.html']) {
      const content = await readRelative(page);
      assert.equal(content.includes('<section class="page-hero logo-clear-hero section">'), true, page);
    }
  });

  it('shows educational disclaimer on individual tool pages', async () => {
    const toolPages = [
      'resources/13-week-cash-flow-forecast/index.html',
      'resources/s-corp-election-calculator/index.html',
      'resources/ptet-bait-election-analyzer/index.html',
      'ptet/index.html',
      'ptet/advanced/index.html',
      'resources/tax-notice-decoder/index.html',
      'resources/sales-tax-exposure-estimator/index.html'
    ];
    const missing = [];
    for (const page of toolPages) {
      const content = await readRelative(page);
      if (!content.includes(educationalDisclaimer)) missing.push(page);
    }
    assert.deepEqual(missing, []);
  });

  it('standardizes requested CTA labels', async () => {
    const banned = [
      'Request a Financial Review',
      'request a financial review',
      'Request a Review',
      'Request a Service Fit Review',
      'Talk Through Your Situation',
      'Request a Consultation',
      'Meet the Founder',
      'Schedule consult'
    ];
    const offenders = [];
    for (const file of await textFiles()) {
      const content = await readFile(file, 'utf8');
      const found = banned.filter((label) => content.includes(label));
      if (found.length) offenders.push(`${relative(file)} -> ${found.join(', ')}`);
    }
    assert.deepEqual(offenders, []);
  });

  it('keeps the header primary CTA readable', async () => {
    const styles = await readRelative('assets/css/styles.css');
    assert.match(styles, /\.nav-links\s+a\.btn-primary[^{]*\{[^}]*color:\s*#fff/s);
    assert.match(styles, /\.nav-links\s+a\.btn-primary:hover[^{]*\{[^}]*color:\s*#fff/s);
  });

  it('uses CPA firm status disclosure only in footer and common questions', async () => {
    const oldPhrases = [
      'MSH Finance Group LLC is not a registered CPA firm',
      'MSH Finance Group LLC is an advisory and consulting firm led by Morris Shalom, CPA. MSH Finance Group LLC is not a registered CPA firm.',
      'Advisory and consulting firm led by Morris Shalom, CPA.'
    ];
    const offenders = [];
    for (const file of await htmlFiles()) {
      const content = await readFile(file, 'utf8');
      for (const phrase of oldPhrases) {
        if (content.includes(phrase)) offenders.push(`${relative(file)} -> ${phrase}`);
      }
      if (content.includes('site-footer') && !content.includes(`<p class="small legal-disclosure">${cpaFirmDisclosure}</p>`)) {
        offenders.push(`${relative(file)} -> missing footer disclosure`);
      }
    }

    const services = await readRelative('services.html');
    assert.equal(services.includes(`<p>${cpaFirmDisclosure}</p>`), true);
    assert.deepEqual(offenders, []);
  });

  it('points Talk to a CPA html ctas at /contact', async () => {
    const offenders = [];
    for (const file of await htmlFiles()) {
      const content = await readFile(file, 'utf8');
      const matches = content.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>\s*Talk to a CPA\s*<\/a>/g);
      for (const match of matches) {
        if (match[1] !== '/contact') offenders.push(`${relative(file)} -> ${match[1]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('updates the contact form fields, sensitive-info warnings, and honeypot', async () => {
    const contact = await readRelative('contact.html');
    assert.equal(contact.includes('name="preferred_contact"'), false);
    assert.equal(contact.includes('id="phone"'), false);
    assert.equal(contact.includes('name="phone"'), false);
    assert.equal(contact.includes('name="client_type"'), false);
    assert.equal(contact.includes('I am a *'), false);
    assert.equal(contact.includes('name="bot-field"'), true);
    assert.equal(contact.includes('data-netlify="true"'), true);
    assert.equal(contact.includes('name="form-name" value="contact"'), true);
    assert.equal(contact.includes('name="subject" value="New MSH Finance Group LLC contact form submission"'), true);
    assert.equal(contact.includes('data-service-interest-group'), true);
    assert.equal((contact.match(/name="service_interest"/g) || []).length >= 6, true);
    assert.equal(contact.includes('name="mailing_list_opt_in"'), true);
    assert.equal(contact.includes('No spam, no selling your data, no nonsense.'), true);
    assert.equal(contact.includes('Please do not submit sensitive information through this form'), true);
    assert.equal(contact.includes('Please keep sensitive details out of this box.'), true);
    assert.equal(contact.includes('We proudly serve clients throughout the U.S. remotely and at our offices in Oakhurst and Red Bank, NJ.'), true);
    assert.equal(contact.includes('We will reach out to schedule a virtual or in-person meeting in Red Bank, NJ'), true);

    const styles = await readRelative('assets/css/styles.css');
    assert.match(styles, /\.netlify-honeypot\s*\{[^}]*display:\s*none/s);
    assert.match(styles, /\.nav-links\s*\{[^}]*top:\s*calc\(\(var\(--header-h\) \* 2\) \+ 12px\)/s);
  });

  it('only references live resources tools on the homepage', async () => {
    const home = await readRelative('index.html');
    const resources = await readRelative('resources/index.html');
    for (const missingTool of ['W-2 Take-Home Snapshot', 'Rent Burden Planner', 'Cash Runway Calculator', 'Worker Withholding Review']) {
      assert.equal(home.includes(missingTool), false, missingTool);
    }
    for (const liveTool of ['13-Week Cash Flow Forecast', 'S-Corp Election Calculator', 'PTET / NJ BAIT Estimator', 'Tax Notice Decoder', 'Sales Tax Exposure Estimator']) {
      assert.equal(home.includes(liveTool), true, liveTool);
      assert.equal(resources.includes(liveTool), true, liveTool);
    }
  });

  it('updates homepage hero, rotating questions, and service details link', async () => {
    const home = await readRelative('index.html');
    const mainScript = await readRelative('assets/js/main.js');
    assert.equal(home.includes('<span class="hero-kicker">Financial clarity, <em>before</em> the numbers get complicated.</span>'), true);
    assert.equal(home.includes('<h1>Numbers you can understand. Decisions you can stand behind.</h1>'), true);
    assert.equal(home.includes('Tax, books, and advisory that work from the same set of facts.'), false);
    assert.equal(home.includes('Three disciplines, one coordinated financial picture.'), false);
    assert.equal(
      home.includes('MSH Finance Group LLC helps individuals and business owners understand their numbers, plan ahead, and make proactive financial decisions before taxes are due or cash pressure hits.'),
      true
    );
    assert.equal(home.includes('Try our Free Tools'), true);
    assert.equal(home.includes('Try our free tools'), false);
    assert.equal(home.includes('Try the NY and NJ Tools'), false);
    assert.equal(home.includes('data-question-rotator'), true);
    assert.equal(home.includes('Do you have questions like this?'), true);
    assert.equal(mainScript.includes('const questionDisplayMs = 4000;'), true);
    assert.equal(mainScript.includes('4520'), false);
    for (const question of homepageRotatorQuestions) {
      assert.equal(home.includes(question), true, question);
    }
    assert.equal(home.includes('<a class="btn btn-primary" href="/services">View Service Details</a>'), true);
    assert.equal(home.includes('service-details-link'), false);
    assert.equal(home.includes('class="hero-points"'), false);
    assert.equal(home.includes('class="metric-grid"'), false);
    assert.equal(home.includes('class="signal-list"'), false);
    assert.equal(home.includes('How a review works'), false);
    assert.equal(home.includes('Practical help for the moments where money gets complicated'), false);
    assert.equal(home.includes('Start with the free finance and tax tools'), true);
    assert.equal(home.includes('Start with the free NY and NJ planning tools'), false);
    assert.equal(home.includes("Don't know where to start? Well, we do."), true);
    assert.equal(home.includes('Specializing in NY and NJ individuals and businesses'), false);
    assert.equal(home.includes('Focused on New York and New Jersey individuals'), false);
    const trustBand = home.match(/<div class="trust-band reveal">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/)?.[1] ?? '';
    assert.equal((trustBand.match(/<a class="btn btn-light" href="\/contact">Talk to a CPA<\/a>/g) || []).length, 1);
  });

  it('moves the three service lanes onto the services page', async () => {
    const services = await readRelative('services.html');
    assert.equal(services.includes('Three disciplines, one coordinated financial picture.'), true);
    for (const lane of ['Tax', 'Bookkeeping &amp; Accounting', 'Fractional CFO and Advisory']) {
      assert.equal(services.includes(lane), true, lane);
    }
    assert.equal(services.includes('Tax Planning'), false);
    assert.equal(services.includes('Advisory + CFO Support'), false);
    assert.equal(services.includes('Engagement models'), false);
    assert.equal(services.includes('<h2>Who this is for</h2>'), false);
  });

  it('adds privacy policy page and footer link', async () => {
    const policy = await readRelative('privacy-policy/index.html');
    assert.equal(policy.includes('Effective date: June 5, 2026'), true);
    assert.equal(policy.includes('info@mshfinance.com'), true);
    assert.equal(policy.includes('No analytics tools are currently active on this site.'), true);
    assert.equal(policy.includes('MSH collects'), false);
    assert.equal(policy.includes('MSH uses'), false);
    assert.equal(policy.includes('Mailing-list consent is optional'), true);
    assert.equal(policy.includes('not sold or shared with third parties for their own marketing purposes'), true);
    assert.equal(policy.includes('secure portal link'), true);

    const missingFooterLink = [];
    for (const file of await htmlFiles()) {
      const content = await readFile(file, 'utf8');
      if (content.includes('site-footer') && !content.includes('href="/privacy-policy/"')) {
        missingFooterLink.push(relative(file));
      }
    }
    assert.deepEqual(missingFooterLink, []);

    const toolPages = [
      'resources/13-week-cash-flow-forecast/index.html',
      'resources/s-corp-election-calculator/index.html',
      'resources/ptet-bait-election-analyzer/index.html',
      'resources/tax-notice-decoder/index.html',
      'resources/sales-tax-exposure-estimator/index.html'
    ];
    for (const page of toolPages) {
      const content = await readRelative(page);
      assert.equal(content.includes('class="site-footer"'), true, page);
      assert.equal(content.includes('href="/privacy-policy/"'), true, page);
    }
  });
});
