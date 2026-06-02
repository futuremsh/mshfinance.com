(function () {
  const progress = document.createElement('div');
  const progressBar = document.createElement('span');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.appendChild(progressBar);
  document.body.appendChild(progress);

  function updateProgress() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progressPercent = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
    progressBar.style.width = Math.min(progressPercent, 100) + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      navMenu.classList.toggle('open');
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.setAttribute('aria-expanded', 'false');
        navMenu.classList.remove('open');
      });
    });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    document.querySelectorAll('.reveal').forEach(function (node) {
      observer.observe(node);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (node) {
      node.classList.add('visible');
    });
  }

  const form = document.querySelector('[data-contact-form]');
  const statusEl = document.querySelector('[data-form-status]');

  if (!form || !statusEl) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const tool = params.get('tool');
  const message = document.getElementById('message');
  const serviceInterest = document.getElementById('service_interest');

  if (tool && message) {
    const toolLabels = {
      readiness: 'NYC/NJ Financial Readiness Score',
      'cash-flow': '13-Week Cash Flow Forecast Tool',
      runway: 'Cash Flow Runway Calculator',
      self_tax: 'Self-Employment Tax Snapshot',
      cfo_roi: 'Fractional CFO ROI Estimator',
      's-corp': 'S-Corp Election Savings Calculator',
      scorp: 'S-Corp Tax Savings Estimator',
      'ptet-bait': 'PTET / NJ BAIT Election Analyzer',
      'tax-notice': 'IRS / NY / NJ Tax Notice Decoder',
      'sales-tax': 'Sales Tax Exposure Estimator',
      w2: 'W-2 Take-Home Snapshot',
      rent: 'Rent Burden Planner'
    };
    message.value =
      'I used the ' +
      (toolLabels[tool] || 'website calculator') +
      ' and would like a personalized NYC/NJ review.';
    if (serviceInterest) {
      if (tool === 'sales-tax') {
        serviceInterest.value = 'sales_tax';
      } else if (tool === 'tax-notice') {
        serviceInterest.value = 'tax_notice';
      } else if (tool === 'ptet-bait') {
        serviceInterest.value = 'ptet_bait';
      } else {
        serviceInterest.value = tool === 'cfo_roi' || tool === 'runway' || tool === 'cash-flow' ? 'cfo' : 'tax';
      }
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    statusEl.className = 'form-status';
    statusEl.hidden = false;

    if (!form.checkValidity()) {
      form.reportValidity();
      statusEl.classList.add('error');
      statusEl.textContent = 'Please complete the required fields before sending.';
      return;
    }

    if (form.action.includes('your-form-id')) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Launch setup needed: replace the Formspree placeholder endpoint before this form can send.';
      return;
    }

    statusEl.textContent = 'Sending your message...';

    const formData = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: form.method,
        headers: {
          Accept: 'application/json'
        },
        body: formData
      });

      if (response.ok) {
        form.reset();
        statusEl.classList.add('success');
        statusEl.textContent = 'Thanks. Your message was sent successfully. We will respond shortly.';
      } else {
        statusEl.classList.add('error');
        statusEl.textContent = 'We could not submit the form right now. Please email info@mshfinance.com.';
      }
    } catch (error) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Network error. Please try again or email info@mshfinance.com.';
    }
  });
})();
