(function () {
  const ROOT_SELECTOR = '[data-installments]';

  if (typeof window === 'undefined') return;

  const cleanupRegistry = new WeakMap();

  function parseConfig(element) {
    const script = element.querySelector('script[data-installments-config]');

    if (!script) {
      return [];
    }

    try {
      const raw = script.textContent?.trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Unable to parse installments configuration', error);
      return [];
    }
  }

  function formatMoney(cents, format) {
    const amount = Math.round(Number(cents) || 0);

    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(amount, format);
    }

    const value = (amount / 100).toFixed(2);
    return format ? format.replace('{{amount}}', value) : value;
  }

  function calculateTotals(price, option) {
    const basePrice = Math.round(Number(price) || 0);
    const rate = Number(option?.rate) || 0;
    const count = Number(option?.count) || 1;
    const hasInterest = Boolean(option?.interest && rate);

    const total = hasInterest ? Math.round(basePrice * (1 + rate)) : basePrice;
    const perInstallment = count > 0 ? Math.round(total / count) : total;

    return {
      total,
      perInstallment,
      hasInterest,
      count,
      rate,
    };
  }

  function getSummaryTemplate(element, hasInterest) {
    if (hasInterest) {
      const interestTemplate = element.getAttribute('data-summary-template-interest');
      if (interestTemplate) return interestTemplate;
    }

    return element.getAttribute('data-summary-template') || '';
  }

  function updateSummary(element, optionTotals, moneyFormat) {
    const summaryEl = element.querySelector('[data-installments-summary]');
    const footnoteEl = element.querySelector('[data-installments-summary-footnote]');

    if (!summaryEl || !optionTotals) return;

    const template = getSummaryTemplate(element, optionTotals.hasInterest);
    const formattedValue = formatMoney(optionTotals.perInstallment, moneyFormat);

    const summaryText = template
      .replace('%count%', optionTotals.count)
      .replace('%value%', formattedValue);

    summaryEl.textContent = summaryText;

    if (footnoteEl) {
      footnoteEl.toggleAttribute('hidden', !optionTotals.hasInterest);
    }
  }

  function updatePoints(element, price) {
    const pointsEl = element.querySelector('[data-installments-points]');
    if (!pointsEl) return;

    const template = element.getAttribute('data-points-template') || pointsEl.textContent || '';
    const points = Math.max(0, Math.floor((Number(price) || 0) / 100));

    if (template.includes('%points%')) {
      pointsEl.textContent = template.replace('%points%', points);
    } else {
      pointsEl.textContent = template;
    }
  }

  function formatRate(rate) {
    if (!Number.isFinite(rate) || rate <= 0) return '';

    return (rate * 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function createRow({ element, option, totals, moneyFormat, highlight }) {
    const interestLabel = element.getAttribute('data-interest-label') || 'Com juros';
    const noInterestLabel = element.getAttribute('data-no-interest-label') || 'Sem juros';

    const row = document.createElement('tr');
    row.className = 'installments-table__row';

    if (Number(highlight) === totals.count) {
      row.classList.add('installments-table__row--highlight');
    }

    row.dataset.installmentCount = totals.count;

    const installmentCell = document.createElement('th');
    installmentCell.scope = 'row';
    installmentCell.className = 'installments-table__installment';
    installmentCell.textContent = `${totals.count}x`;

    const interestSpan = document.createElement('span');
    interestSpan.className = 'installments-table__interest';

    if (totals.hasInterest) {
      const rateText = formatRate(totals.rate);
      const label = interestLabel;
      interestSpan.dataset.installmentInterest = 'true';
      if (rateText) {
        interestSpan.dataset.installmentRate = rateText;
        interestSpan.textContent = `${label} (${rateText}%)`;
      } else {
        interestSpan.textContent = label;
      }
    } else {
      interestSpan.textContent = noInterestLabel;
    }

    installmentCell.appendChild(interestSpan);

    const valueCell = document.createElement('td');
    valueCell.className = 'installments-table__value';
    valueCell.dataset.installmentValue = '';
    valueCell.textContent = formatMoney(totals.perInstallment, moneyFormat);

    if (totals.hasInterest) {
      const footnote = document.createElement('span');
      footnote.className = 'installments-table__footnote';
      footnote.textContent = '*';
      valueCell.appendChild(footnote);
    }

    row.appendChild(installmentCell);
    row.appendChild(valueCell);

    return row;
  }

  function updateTable(element, price, config) {
    const tbody = element.querySelector('[data-installments-table-body]');
    if (!tbody) return;

    const moneyFormat = element.getAttribute('data-money-format') || '';
    const highlight = Number(element.getAttribute('data-highlight-installment'));

    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    config.forEach((option) => {
      const totals = calculateTotals(price, option);
      const row = createRow({
        element,
        option,
        totals,
        moneyFormat,
        highlight,
      });
      fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
  }

  function updateDisclaimer(element, config) {
    const disclaimer = element.querySelector('[data-installments-disclaimer]');
    if (!disclaimer) return;

    const hasInterest = config.some((option) => option && option.interest);
    disclaimer.toggleAttribute('hidden', !hasInterest);
  }

  function getSummaryOption(config, highlightCount) {
    if (!Array.isArray(config) || !config.length) return null;

    const highlightOption = config.find((option) => Number(option?.count) === highlightCount);
    return highlightOption || config[config.length - 1];
  }

  function updateInstallments(element, price, config) {
    if (!Array.isArray(config) || !config.length) {
      return;
    }

    const moneyFormat = element.getAttribute('data-money-format') || '';
    const highlightCount = Number(element.getAttribute('data-highlight-installment')) || 0;
    const summaryOption = getSummaryOption(config, highlightCount);
    const summaryTotals = calculateTotals(price, summaryOption);

    updateSummary(element, summaryTotals, moneyFormat);
    updatePoints(element, price);
    updateTable(element, price, config);
    updateDisclaimer(element, config);
  }

  function handleVariantChange(element, config, fallbackPrice, payload) {
    if (!payload || !payload.data) return;
    const { data } = payload;

    if (data.sectionId !== element.getAttribute('data-section')) {
      return;
    }

    const variantPrice = data.variant?.price;
    const price = Number.isFinite(Number(variantPrice)) ? variantPrice : fallbackPrice;
    updateInstallments(element, price, config);
  }

  function initialize(element) {
    if (!element || element.dataset.installmentsInitialized === 'true') {
      return;
    }

    const config = parseConfig(element);
    if (!config.length) return;

    element.dataset.installmentsInitialized = 'true';

    const initialPriceAttr = element.getAttribute('data-initial-price');
    const initialPrice = Number.isFinite(Number(initialPriceAttr)) ? Number(initialPriceAttr) : 0;

    updateInstallments(element, initialPrice, config);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      const handler = (payload) => handleVariantChange(element, config, initialPrice, payload);
      const unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, handler);

      cleanupRegistry.set(element, () => {
        unsubscribe?.();
      });
    }
  }

  function cleanup(element) {
    if (!element) return;

    const disposer = cleanupRegistry.get(element);
    disposer?.();
    cleanupRegistry.delete(element);
    delete element.dataset.installmentsInitialized;
  }

  function initAll(scope = document) {
    scope.querySelectorAll(ROOT_SELECTOR).forEach((element) => initialize(element));
  }

  initAll();

  document.addEventListener('product-info:loaded', ({ target }) => {
    initAll(target);
  });

  document.addEventListener('shopify:section:load', ({ target }) => {
    initAll(target);
  });

  document.addEventListener('shopify:section:unload', ({ target }) => {
    target.querySelectorAll(ROOT_SELECTOR).forEach((element) => {
      cleanup(element);
    });
  });
})();
