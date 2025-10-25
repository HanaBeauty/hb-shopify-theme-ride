(function () {
  const ROOT_SELECTOR = '[data-installments]';

  if (typeof window === 'undefined') return;

  const activeInstances = new WeakMap();

  function normaliseConfigValue(value) {
    if (typeof value !== 'string') return '';

    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#x22;/gi, '"')
      .trim();
  }

  function ensureArray(config) {
    if (!config) return [];

    return Array.isArray(config) ? config : [config];
  }

  function parseConfig(element) {
    const scriptConfig = element.querySelector('script[data-installments-config]');

    if (scriptConfig) {
      const scriptValue = scriptConfig.textContent?.trim();

      if (scriptValue) {
        try {
          return ensureArray(JSON.parse(scriptValue));
        } catch (error) {
          console.warn('Unable to parse installments configuration from script', error);
        }
      }
    }

    const rawConfig = normaliseConfigValue(
      element.getAttribute('data-installments-config') ||
        element.dataset.installmentsConfig,
    );

    if (!rawConfig) {
      return [];
    }

    try {
      return ensureArray(JSON.parse(rawConfig));
    } catch (error) {
      try {
        return ensureArray(JSON.parse(normaliseConfigValue(rawConfig)));
      } catch (fallbackError) {
        console.warn('Unable to parse installments configuration', fallbackError);
        return [];
      }
    }
  }

  function getConfig(element) {
    if (!element) return [];

    if (!element.__installmentsConfig) {
      element.__installmentsConfig = parseConfig(element);
    }

    return element.__installmentsConfig;
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

    if (!tableWrapper) return;

    const isCurrentlyHidden = tableWrapper.hidden || tableWrapper.hasAttribute('hidden');
    const shouldExpand =
      typeof expanded === 'boolean' ? expanded : isCurrentlyHidden;

    tableWrapper.hidden = !shouldExpand;

    if (shouldExpand) {
      tableWrapper.removeAttribute('hidden');
    } else {
      tableWrapper.setAttribute('hidden', 'true');
    }

    button?.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    showLabel?.toggleAttribute('hidden', shouldExpand);
    hideLabel?.toggleAttribute('hidden', !shouldExpand);
  }

  function getSummaryTemplate(element, option) {
    const hasInterest = !!option?.interest;
    if (hasInterest) {
      const interestTemplate = element.getAttribute('data-summary-template-interest');
      if (interestTemplate) {
        return interestTemplate;
      }
    }

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
    const template = getSummaryTemplate(element, option);

    if (!summaryText) return;

    const formattedValue = formatMoney(perInstallmentValue, moneyFormat);
    const summary = template
      .replace('%count%', option.count)
      .replace('%value%', formattedValue);

    summaryText.textContent = summary;

    const shouldShowFootnote = !!option.interest;
    summaryFootnote?.toggleAttribute('hidden', !shouldShowFootnote);
  }

  function updatePoints(element, price) {
    const pointsElement = element.querySelector('[data-installments-points]');

    if (!pointsElement) return;

    const template =
      pointsElement.getAttribute('data-installments-points-template') ||
      'Pontos: ganhe %points% pontos';
    const points = Number.isFinite(price) ? Math.floor(Number(price) / 100) : 0;
    const text = template.includes('%points%')
      ? template.replace('%points%', points)
      : template;

    pointsElement.textContent = text;
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
    const fallbackInterestLabel = interestLabel || 'Com juros';
    const fallbackNoInterestLabel = noInterestLabel || 'Sem juros';

    const interestRate = Number(option.rate);
    if (option.interest) {
      const formattedRate = Number.isFinite(interestRate)
        ? (interestRate * 100).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null;
      const label = interestLabel || fallbackInterestLabel;
      const rateLabel = formattedRate ? ` (${formattedRate}%)` : '';
      interestSpan.textContent = `${label}${rateLabel}`.trim() || rateLabel.trim();
    } else {
      interestSpan.textContent = fallbackNoInterestLabel;
    }
    installmentCell.appendChild(interestSpan);

    const valueCell = document.createElement('td');
    valueCell.className = 'installments-table__value';
    valueCell.textContent = formatMoney(perInstallmentValue, moneyFormat);

    if (option.interest) {
      const footnote = document.createElement('span');
      footnote.className = 'installments-table__footnote';
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
    const config = getConfig(element);
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

    const highlightInstallment = Number(highlight);
    const summaryOption = Number.isFinite(highlightInstallment)
      ? config.find((option) => Number(option.count) === highlightInstallment)
      : undefined;
    const fallbackOption = config[config.length - 1];
    const optionForSummary = summaryOption || fallbackOption;
    const summaryValue = calculatePerInstallment(price, optionForSummary);
    const disclaimer = element.querySelector('[data-installments-disclaimer]');
    const hasInterestOption = config.some((installment) => !!installment.interest);

    updateSummary({
      element,
      option: optionForSummary,
      perInstallmentValue: summaryValue,
      moneyFormat,
    });

    disclaimer?.toggleAttribute('hidden', !hasInterestOption);

    updatePoints(element, price);
  }

  function handleVariantChange(element, price) {
    if (!price) return;

    updateTable(element, price);
  }

  function initialize(element) {
    if (!element || element.dataset.installmentsInitialized === 'true') {
      return;
    }

    const config = getConfig(element);
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
    const tableWrapper = element.querySelector('[data-installments-table-wrapper]');

    tableHeadingInstallmentsEl && (tableHeadingInstallmentsEl.textContent = tableHeadingInstallments || '');
    tableHeadingValueEl && (tableHeadingValueEl.textContent = tableHeadingValue || '');

    if (tableWrapper) {
      tableWrapper.hidden = false;
      tableWrapper.removeAttribute('hidden');
    }

    const initiallyExpanded = tableWrapper && !tableWrapper.hasAttribute('hidden');
    toggleTable(element, initiallyExpanded);

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
    delete element.__installmentsConfig;
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
