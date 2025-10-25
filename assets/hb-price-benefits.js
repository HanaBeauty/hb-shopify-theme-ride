(() => {
  const RATES = { 7: 0.0748, 8: 0.081, 9: 0.0872, 10: 0.0917, 11: 0.0979, 12: 0.1042 };
  const formatBRL = (() => {
    try {
      const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      });
      return (cents) => formatter.format((Number(cents) || 0) / 100);
    } catch (error) {
      return (cents) => {
        const value = (Number(cents) || 0) / 100;
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
      };
    }
  })();

  function compute(priceCents, count) {
    const rate = count <= 6 ? 0 : RATES[count] || 0;
    const total = Math.round(priceCents * (1 + rate));
    const per = Math.round(total / count);
    return { count, rate, per, total };
  }

  function renderTable(tbody, priceCents) {
    if (!tbody) return;
    tbody.innerHTML = '';

    for (let count = 1; count <= 12; count += 1) {
      const { rate, per, total } = compute(priceCents, count);
      const tr = document.createElement('tr');
      if (count === 6) {
        tr.classList.add('hb-benefits__row--highlight');
      }

      const tdCount = document.createElement('td');
      tdCount.textContent = `${count}x`;
      tr.appendChild(tdCount);

      const tdPer = document.createElement('td');
      tdPer.textContent = formatBRL(per);
      tr.appendChild(tdPer);

      const tdTotal = document.createElement('td');
      tdTotal.textContent = formatBRL(total);
      tr.appendChild(tdTotal);

      const tdRate = document.createElement('td');
      tdRate.textContent = rate === 0 ? 'sem juros' : `${(rate * 100).toFixed(2).replace('.', ',')}%`;
      tr.appendChild(tdRate);

      tbody.appendChild(tr);
    }
  }

  function renderSummary(root, priceCents) {
    const priceEl = root.querySelector('.hb-benefits__price');
    const installmentsEl = root.querySelector('.hb-benefits__installments');
    const pointsEl = root.querySelector('.hb-benefits__points');

    const six = Math.round(priceCents / 6);
    const points = Math.floor(priceCents / 100);

    if (priceEl) priceEl.textContent = formatBRL(priceCents);
    if (installmentsEl) installmentsEl.textContent = ` ou 6x de ${formatBRL(six)}`;
    if (pointsEl) pointsEl.textContent = ` e ganhe ${points} pontos`;
  }

  function update(root, priceCents) {
    const normalized = Number(priceCents);
    if (Number.isNaN(normalized)) return;

    root.dataset.hbPrice = String(normalized);
    renderSummary(root, normalized);
    renderTable(root.querySelector('[data-hb-table-body]'), normalized);
  }

  function attachVariantListeners(root) {
    const handler = (event) => {
      const variant = event?.detail?.variant;
      if (variant && typeof variant.price === 'number') {
        update(root, variant.price);
      }
    };

    document.addEventListener('variant:change', handler);
    document.addEventListener('theme:variant:change', handler);
    document.addEventListener('product:variant-change', handler);
  }

  function init(root) {
    if (!root) return;

    const priceCents = Number(root.dataset.hbPrice || 0) || 0;
    update(root, priceCents);
    attachVariantListeners(root);
  }

  const start = () => document.querySelectorAll('[data-hb-benefits]').forEach(init);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
