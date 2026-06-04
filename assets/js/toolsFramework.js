(function () {
  const DISCLAIMER =
    'For educational and screening purposes only. These tools do not constitute legal, tax, accounting, or financial advice and do not create a CPA-client relationship. Review any results with a qualified professional before taking action.';

  function buildEmailSignup(source) {
    return (
      '<form class="tool-email-signup" data-tools-email-signup novalidate>' +
      '<label>Email list option<input name="email" type="email" placeholder="you@example.com" required></label>' +
      '<label class="checkbox-row"><input name="marketingConsent" type="checkbox"> Send me occasional NY and NJ tax tips. Unsubscribe anytime.</label>' +
      '<button class="btn btn-secondary" type="submit">Join Email List</button>' +
      '<p class="small">No spam. Unsubscribe anytime. We do not sell your data.</p>' +
      '<input type="hidden" name="source" value="' +
      source +
      '">' +
      '<div class="form-status" data-tools-email-status role="status" aria-live="polite" hidden></div>' +
      '</form>'
    );
  }

  function initToolsFramework() {
    const page = document.body.getAttribute('data-tools-page');
    if (!page) return;

    const banner = document.createElement('div');
    banner.className = 'tool-disclaimer-banner';
    banner.textContent = DISCLAIMER;
    document.body.prepend(banner);

    const sticky = document.createElement('a');
    sticky.className = 'sticky-consult-cta';
    sticky.href = '/contact';
    sticky.textContent = 'Talk to a CPA';
    document.body.appendChild(sticky);

    const footer = document.createElement('section');
    footer.className = 'tool-framework-footer';
    footer.innerHTML =
      '<div class="container split">' +
      '<div><h2>Need a professional read?</h2><p>' +
      DISCLAIMER +
      '</p><div class="cta-strip"><a class="btn btn-primary" href="/contact">Talk to a CPA</a></div></div>' +
      '<div>' +
      buildEmailSignup(page) +
      '</div>' +
      '</div>';
    document.querySelector('main').appendChild(footer);

    document.querySelectorAll('[data-tools-email-signup]').forEach(function (form) {
      const status = form.querySelector('[data-tools-email-status]');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        // TODO: Send { email, marketingConsent, timestamp, source } to email provider only.
        status.hidden = false;
        status.className = 'form-status success';
        status.textContent = 'Thanks. Email signup is validated locally. Connect the email provider before production capture.';
        form.reset();
      });
    });
  }

  window.MSHToolsFramework = {
    disclaimer: DISCLAIMER,
    init: initToolsFramework,
    buildEmailSignup: buildEmailSignup
  };

  initToolsFramework();
})();
