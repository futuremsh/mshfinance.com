# MSHFinance.com Launch Instructions

This is a static website. Launch only the root site files, not the `quickfire-cpa/` folder.

## 1. Pre-Launch Setup

1. Create a Formspree form at `https://formspree.io`.
2. Copy the endpoint that looks like `https://formspree.io/f/xxxxxxxx`.
3. In `contact.html`, replace:

```html
https://formspree.io/f/your-form-id
```

with the real endpoint.

4. Submit the contact form once from a local preview and approve/confirm the Formspree email if prompted.
5. Confirm the contact form delivers to the right inbox.

## 2. Local Preview

Run this from the site folder:

```bash
cd "/Users/morrisshalom/Desktop/MSH landing page"
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Check these pages:

```text
http://localhost:8080/
http://localhost:8080/services.html
http://localhost:8080/about.html
http://localhost:8080/resources/
http://localhost:8080/resources/13-week-cash-flow-forecast/
http://localhost:8080/resources/s-corp-election-calculator/
http://localhost:8080/ptet/
http://localhost:8080/ptet/advanced/
http://localhost:8080/ptet/results/
http://localhost:8080/ptet/learn/
http://localhost:8080/resources/tax-notice-decoder/
http://localhost:8080/resources/sales-tax-exposure-estimator/
http://localhost:8080/privacy/
http://localhost:8080/terms/
http://localhost:8080/unsubscribe/
http://localhost:8080/contact.html
```

Run the lightweight calculation tests:

```bash
node --test tests/ptet-calculations.test.mjs
```

Review/edit 2026 PTET assumptions here:

```text
config/2026/federal.json
config/2026/ny-ptet.json
config/2026/nyc-ptet.json
config/2026/nj-bait.json
config/2026/ptet-tool.json
```

## 3. Launch Files

Upload these files and folders to the web root:

```text
index.html
services.html
about.html
resources.html
resources/
ptet/
privacy/
terms/
unsubscribe/
config/
contact.html
404.html
robots.txt
sitemap.xml
_headers
assets/
```

Do not upload:

```text
quickfire-cpa/
LAUNCH.md
mshlandinglogo.png
```

The active logo is already copied to:

```text
assets/images/mshlandinglogo.png
```

## 4. Recommended Hosting Paths

### Netlify

1. Drag the launch files/folders into Netlify Drop, or connect a Git repo.
2. Set publish directory to the site root.
3. No build command is needed.
4. Add custom domain `mshfinance.com`.
5. Point DNS to Netlify as instructed.
6. Enable HTTPS.

### Vercel

1. Import the folder as a static project.
2. No framework preset is needed.
3. No build command is needed.
4. Output directory should be the root folder.
5. Add custom domain `mshfinance.com`.
6. Enable HTTPS.

### cPanel / Traditional Hosting

1. Open File Manager.
2. Go to `public_html`.
3. Upload the launch files/folders listed above.
4. Confirm `index.html` is directly inside `public_html`.
5. Confirm `https://mshfinance.com/resources/` loads.

## 5. DNS Checklist

Use the host's exact DNS instructions. Typical records are one of these:

```text
A record: @ -> host IP address
CNAME: www -> host domain
```

or:

```text
CNAME: @ -> host target
CNAME: www -> host target
```

After DNS changes, allow up to 24 hours for propagation.

## 6. Post-Launch QA

1. Open `https://mshfinance.com`.
2. Confirm every nav link works.
3. Confirm `/resources/` and all five dedicated tool pages work.
4. Confirm `/ptet/`, `/ptet/advanced/`, `/ptet/results/`, and `/ptet/learn/` load.
5. Run a sample PTET estimate and confirm results appear without entering email.
6. Confirm optional report consent requires the report checkbox and does not require marketing opt-in.
7. Confirm calculator CTAs prefill the contact form.
8. Submit a real contact form test.
9. Confirm mobile menu works.
10. Confirm HTTPS lock appears in the browser.
11. Confirm `https://mshfinance.com/sitemap.xml` loads.
12. Confirm `https://mshfinance.com/robots.txt` loads.

## 7. Search Console

1. Add `mshfinance.com` to Google Search Console.
2. Verify ownership using DNS or HTML file upload.
3. Submit sitemap:

```text
https://mshfinance.com/sitemap.xml
```

4. Request indexing for:

```text
https://mshfinance.com/
https://mshfinance.com/resources/
https://mshfinance.com/resources/13-week-cash-flow-forecast/
https://mshfinance.com/resources/s-corp-election-calculator/
https://mshfinance.com/ptet/
https://mshfinance.com/ptet/advanced/
https://mshfinance.com/ptet/learn/
https://mshfinance.com/resources/tax-notice-decoder/
https://mshfinance.com/resources/sales-tax-exposure-estimator/
https://mshfinance.com/privacy/
https://mshfinance.com/terms/
https://mshfinance.com/contact.html
```

## 8. Morning Review Options

Use these as the next decision list after reviewing the live site:

1. Replace the founder placeholder with a real headshot and bio.
2. Add a Calendly link if direct booking becomes preferable to form-only intake.
3. Add backend lead capture integration for the reusable lead forms.
4. Add downloadable PDF reports and XLSX templates.
5. Add Google Analytics or Plausible analytics.
6. Add approved testimonials or anonymized case studies.
7. Add a downloadable NYC/NJ tax checklist PDF.
8. Connect an email provider suppression list for `/unsubscribe/`.
9. Have a CPA/legal reviewer approve PTET assumptions and all compliance copy before paid traffic.
