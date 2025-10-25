(function () {
  const ROOT_SELECTOR = '[data-installments]';

  if (typeof window === 'undefined') return;

  const activeInstances = new WeakMap();

  function parseConfig(element) {
    const rawConfig = element.getAttribute('data-installments-config');

    if (!rawConfig) {
      return [];
    }

    try {
      return JSON.parse(rawConfig);
    } catch (error) {
      console.warn('Unable to parse installments configuration', error);
      return [];
    }
  }

  function formatMoney(cents, format) {
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, format);
    }

    const value = (cents / 100).toFixed(2);
    return format ? format.replace('{{amount}}', value) : value;
  }

  function toggleTable(element, expanded) {
    const button = element.querySelector('[data-installments-toggle]');
    const showLabel = element.querySelector('[data-installments-toggle-label-show]');
    const hideLabel = element.querySelector('[data-installments-toggle-label-hide]');
    const tableWrapper = element.querySelector('[data-installments-table-wrapper]');

    const shouldExpand = typeof expanded === 'boolean' ? expanded : tableWrapper.hasAttribute('hidden');

    if (shouldExpand) {
      tableWrapper.removeAttribute('hidden');
    } else {
      tableWrapper.setAttribute('hidden', 'true');
    }

    button?.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    showLabel?.toggleAttribute('hidden', shouldExpand);
    hideLabel?.toggleAttribute('hidden', !shouldExpand);
  }

  function getSummaryTemplate(element) {
    return element.getAttribute('data-summary-template') || '';
  }

  function updateSummary({
    element,
    option,
    perInstallmentValue,
    moneyFormat,
  }) {
    const summaryText = element.querySelector('[data-installments-summary]');
    const summaryFootnote = element.querySelector('[data-installments-summary-footnote]');
    const disclaimer = element.querySelector('[data-installments-disclaimer]');
    const template = getSummaryTemplate(element);

    if (!summaryText) return;

    const formattedValue = formatMoney(perInstallmentValue, moneyFormat);
    const summary = template
      .replace('%count%', option.count)
      .replace('%value%', formattedValue);

    summaryText.textContent = summary;

    const shouldShowFootnote = !!option.interest;
    summaryFootnote?.toggleAttribute('hidden', !shouldShowFootnote);
    disclaimer?.toggleAttribute('hidden', !shouldShowFootnote);
  }

  function createRow({ element, option, perInstallmentValue, moneyFormat, highlight }) {
    const interestLabel = element.getAttribute('data-interest-label') || '';
    const noInterestLabel = element.getAttribute('data-no-interest-label') || '';

    const row = document.createElement('tr');
    row.className = 'installments-table__row';

    if (highlight && Number(highlight) === option.count) {
      row.classList.add('installments-table__row--highlight');
    }

    const installmentCell = document.createElement('th');
    installmentCell.scope = 'row';
    installmentCell.className = 'installments-table__installment';
    installmentCell.textContent = `${option.count}x`;

    const interestSpan = document.createElement('span');
    interestSpan.className = 'installments-table__interest';
    interestSpan.textContent = option.interest ? interestLabel : noInterestLabel;
    installmentCell.appendChild(interestSpan);

    const valueCell = document.createElement('td');
    valueCell.className = 'installments-table__value';
    valueCell.textContent = formatMoney(perInstallmentValue, moneyFormat);

    if (option.interest) {
      const footnote = document.createElement('span');
      footnote.className = 'installments__summary-footnote';
      footnote.textContent = '*';
      valueCell.appendChild(footnote);
    }

    row.appendChild(installmentCell);
    row.appendChild(valueCell);

    return row;
  }

  function calculatePerInstallment(price, option) {
    const total = option.interest ? Math.round(price * (1 + Number(option.rate))) : price;
    return Math.round(total / option.count);
  }

  function updateTable(element, price) {
    const config = parseConfig(element);
    const tableBody = element.querySelector('[data-installments-table-body]');
    const moneyFormat = element.getAttribute('data-money-format') || '';
    const highlight = element.getAttribute('data-highlight-installment');

    if (!Array.isArray(config) || !config.length || !tableBody) {
      return;
    }

    tableBody.innerHTML = '';

    config.forEach((option) => {
      const perInstallmentValue = calculatePerInstallment(price, option);
      const row = createRow({
        element,
        option,
        perInstallmentValue,
        moneyFormat,
        highlight,
      });
      tableBody.appendChild(row);
    });

    const lastOption = config[config.length - 1];
    const summaryValue = calculatePerInstallment(price, lastOption);
    updateSummary({
      element,
      option: lastOption,
      perInstallmentValue: summaryValue,
      moneyFormat,
    });
  }

  function handleVariantChange(element, price) {
    if (!price) return;

    updateTable(element, price);
  }

  function initialize(element) {
    if (!element || element.dataset.installmentsInitialized === 'true') {
      return;
    }

    const config = parseConfig(element);
    if (!Array.isArray(config) || !config.length) return;

    element.dataset.installmentsInitialized = 'true';

    const moneyFormat = element.getAttribute('data-money-format');
    const tableHeadingInstallments = element.getAttribute('data-table-heading-installments');
    const tableHeadingValue = element.getAttribute('data-table-heading-value');
    const initialPriceAttribute = element.getAttribute('data-initial-price');
    const parsedInitialPrice = Number(initialPriceAttribute);
    const initialPrice = Number.isFinite(parsedInitialPrice) ? parsedInitialPrice : 0;
    const tableHeadingInstallmentsEl = element.querySelector('[data-installments-table-heading-installments]');
    const tableHeadingValueEl = element.querySelector('[data-installments-table-heading-value]');
    const toggleButton = element.querySelector('[data-installments-toggle]');

    tableHeadingInstallmentsEl && (tableHeadingInstallmentsEl.textContent = tableHeadingInstallments || '');
    tableHeadingValueEl && (tableHeadingValueEl.textContent = tableHeadingValue || '');

    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        toggleTable(element);
      });
    }

    const sectionId = element.getAttribute('data-section');

    updateTable(element, initialPrice);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      const unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
        if (!data || data.sectionId !== sectionId) return;
        const variantPrice = data.variant?.price;
        handleVariantChange(element, variantPrice ?? initialPrice);
      });

      activeInstances.set(element, () => {
        unsubscribe?.();
      });
    }
  }

  function cleanup(element) {
    if (!element) return;
    const dispose = activeInstances.get(element);
    dispose?.();
    activeInstances.delete(element);
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
