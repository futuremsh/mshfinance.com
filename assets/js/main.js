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

  const rotator = document.querySelector('[data-question-rotator]');
  if (rotator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const questions = Array.from(rotator.querySelectorAll('.question-item'));
    if (questions.length > 1) {
      const questionDisplayMs = 4000;
      const questionFadeMs = 520;

      for (let i = questions.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        if (i !== j) {
          rotator.insertBefore(questions[j], questions[i]);
          questions.splice(i, 0, questions.splice(j, 1)[0]);
        }
      }

      let activeIndex = questions.findIndex(function (question) {
        return question.classList.contains('active');
      });
      if (activeIndex < 0) {
        activeIndex = 0;
          questions[0].classList.add('active');
      }

      function showNextQuestion() {
        questions[activeIndex].classList.remove('active');
        window.setTimeout(function () {
          activeIndex = (activeIndex + 1) % questions.length;
          questions[activeIndex].classList.add('active');
          window.setTimeout(showNextQuestion, questionDisplayMs);
        }, questionFadeMs);
      }

      window.setTimeout(showNextQuestion, questionDisplayMs);
    }
  }

  const form = document.querySelector('[data-contact-form]');
  const statusEl = document.querySelector('[data-form-status]');

  if (!form || !statusEl) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const tool = params.get('tool');
  const message = document.getElementById('message');
  const serviceInterestFields = Array.from(document.querySelectorAll('input[name="service_interest"]'));
  const serviceInterestGroup = document.querySelector('[data-service-interest-group]');

  function validateServiceInterest() {
    if (!serviceInterestFields.length) return true;
    const hasSelection = serviceInterestFields.some(function (field) {
      return field.checked;
    });
    serviceInterestFields.forEach(function (field) {
      field.setCustomValidity(hasSelection ? '' : 'Please select at least one service interest.');
    });
    if (serviceInterestGroup) {
      serviceInterestGroup.classList.toggle('error-field', !hasSelection);
    }
    return hasSelection;
  }

  if (tool && message) {
    const toolLabels = {
      'cash-flow': '13-Week Cash Flow Forecast Tool',
      's-corp': 'S-Corp Election Savings Calculator',
      'ptet-bait': 'PTET / NJ BAIT Election Analyzer',
      'tax-notice': 'Tax Notice Decoder',
      'sales-tax': 'Sales Tax Exposure Estimator',
    };
    message.value =
      'I used the ' +
      (toolLabels[tool] || 'website calculator') +
      ' and would like to talk to a CPA.';
    if (serviceInterestFields.length) {
      let selectedValue;
      if (tool === 'sales-tax') {
        selectedValue = 'sales_tax';
      } else if (tool === 'tax-notice') {
        selectedValue = 'tax_notice';
      } else if (tool === 'ptet-bait') {
        selectedValue = 'ptet_bait';
      } else {
        selectedValue = tool === 'cash-flow' ? 'cfo' : 'tax';
      }
      serviceInterestFields.forEach(function (field) {
        field.checked = field.value === selectedValue;
      });
      validateServiceInterest();
    }
  }

  serviceInterestFields.forEach(function (field) {
    field.addEventListener('change', validateServiceInterest);
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    statusEl.className = 'form-status';
    statusEl.hidden = false;

    validateServiceInterest();

    if (!form.checkValidity()) {
      form.reportValidity();
      statusEl.classList.add('error');
      statusEl.textContent = 'Please complete the required fields before sending.';
      return;
    }

    statusEl.textContent = 'Sending your message...';

    const formData = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: form.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(formData).toString()
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
