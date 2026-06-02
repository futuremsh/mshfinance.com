# MSH Finance Group Website

Static website for MSH Finance Group at `mshfinance.com`.

## Deploy

This site is designed for Netlify.

- Build command: none
- Publish directory: `.`
- Production domain: `mshfinance.com`

The deploy intentionally excludes `quickfire-cpa/`, `MSH FG/`, local system files, tests, and launch notes.

## Launch Note

Before relying on the contact form in production, replace the placeholder Formspree endpoint in `contact.html`:

```html
https://formspree.io/f/your-form-id
```

The current JavaScript blocks placeholder submissions and shows a setup-needed message.
