(() => {
  const RATES = {
    7: 0.0748,
    8: 0.081,
    9: 0.0872,
    10: 0.0917,
    11: 0.0979,
    12: 0.1042,
  };

  function decodeHTMLEntities(str) {
    if (!str) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }

  function getMoneyFormat(root) {
    const fallback = 'R$ {{amount_with_comma_separator}}';
    const fromAttr = root?.dataset?.hbMoneyFormat;
    if (!fromAttr) {
      return window?.theme?.moneyFormat || fallback;
    }

    try {
      return decodeHTMLEntities(fromAttr);
    } catch (error) {
      console.warn('[hb-benefits] Erro ao decodificar money_format', error);
      return window?.theme?.moneyFormat || fallback;
    }
  }

  function formatMoney(cents, moneyFormat) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents, moneyFormat);
    }

    const value = (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
    return moneyFormat.replace('{{amount_with_comma_separator}}', value);
  }

  function computeInstallment(priceCents, count) {
    const rate = count <= 6 ? 0 : RATES[count] || 0;
    const total = Math.round(priceCents * (1 + rate));
    const per = Math.round(total / count);
    return { count, per, total, rate };
  }

  function renderTable(tbody, priceCents, moneyFormat) {
    if (!tbody) return;

    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }

    for (let count = 1; count <= 12; count += 1) {
      const installment = computeInstallment(priceCents, count);
      const tr = document.createElement('tr');
      if (count === 6) {
        tr.classList.add('hb-benefits__row--highlight');
      }

      const tdCount = document.createElement('td');
      tdCount.textContent = `${installment.count}x`;
      tr.appendChild(tdCount);

      const tdPer = document.createElement('td');
      tdPer.textContent = formatMoney(installment.per, moneyFormat);
      tr.appendChild(tdPer);

      const tdTotal = document.createElement('td');
      tdTotal.textContent = formatMoney(installment.total, moneyFormat);
      tr.appendChild(tdTotal);

      const tdRate = document.createElement('td');
      if (installment.rate === 0) {
        tdRate.textContent = 'sem juros';
      } else {
        tdRate.textContent = `${(installment.rate * 100).toFixed(2).replace('.', ',')}%`;
      }
      tr.appendChild(tdRate);

      tbody.appendChild(tr);
    }
  }

  function renderSummary(root, priceCents, moneyFormat) {
    if (!root) return;

    const priceEl = root.querySelector('.hb-benefits__price');
    const installmentsEl = root.querySelector('.hb-benefits__installments');
    const pointsEl = root.querySelector('.hb-benefits__points');

    const sixInstallment = Math.round(priceCents / 6);
    const points = Math.floor(priceCents / 100);

    if (priceEl) {
      priceEl.textContent = formatMoney(priceCents, moneyFormat);
    }

    if (installmentsEl) {
      installmentsEl.textContent = ` ou 6x de ${formatMoney(sixInstallment, moneyFormat)}`;
    }

    if (pointsEl) {
      pointsEl.textContent = ` e ganhe ${points} pontos`;
    }
  }

  function updateInterface(root, priceCents, moneyFormat, tableBody) {
    const normalized = Number(priceCents);
    if (Number.isNaN(normalized)) return;

    root.dataset.hbPrice = String(normalized);
    renderSummary(root, normalized, moneyFormat);
    renderTable(tableBody, normalized, moneyFormat);
  }

  function setupVariantListeners(root, moneyFormat, tableBody) {
    const handler = (event) => {
      const variant = event?.detail?.variant;
      if (variant && typeof variant.price === 'number') {
        updateInterface(root, variant.price, moneyFormat, tableBody);
      }
    };

    document.addEventListener('variant:change', handler);
    document.addEventListener('theme:variant:change', handler);
    document.addEventListener('product:variant-change', handler);

    const priceNode = document.querySelector(
      '[data-product-price],[data-product-price-target],[itemprop="price"]'
    );

    if (priceNode && 'MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        const fromDataset = Number(root.dataset.hbPrice);
        if (!Number.isNaN(fromDataset)) {
          updateInterface(root, fromDataset, moneyFormat, tableBody);
        }
      });

      observer.observe(priceNode, { childList: true, subtree: true, characterData: true });
    }
  }

  function init(root) {
    if (!root) return;

    const moneyFormat = getMoneyFormat(root);
    const priceCents = Number(root.dataset.hbPrice || 0);
    const tableBody = root.querySelector('[data-hb-table-body]');

    updateInterface(root, priceCents, moneyFormat, tableBody);
    setupVariantListeners(root, moneyFormat, tableBody);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-hb-benefits]').forEach(init);
    });
  } else {
    document.querySelectorAll('[data-hb-benefits]').forEach(init);
  }
})();
