/* HB: oculta o aviso "Frete calculado no checkout" se detectar calculadora na PDP */
(() => {
  const NOTE_SELECTOR = '[data-shipping-note], .product__tax.caption.rte'; // fallback
  // Lista de seletores possíveis de calculadora (ajuste conforme o tema/app)
  const CALC_SELECTORS = [
    '#ShippingCalculator',
    '[data-shipping-calculator]',
    '[data-component="shipping-estimator"]',
    '.shipping-estimator',
    '.shipping-calculator',
    '#EstimateShipping',
    'form[action*="shipping_rates"]',
    'form[data-shipping-estimator]',
    // campos típicos de CEP/ZIP:
    'input[name="zip"]',
    'input[name="postal_code"]',
    'input[name="cep"]'
  ];

  function hasCalculator(root = document) {
    return CALC_SELECTORS.some(sel => root.querySelector(sel));
  }

  function toggleNote() {
    const note = document.querySelector(NOTE_SELECTOR);
    if (!note) return;
    if (hasCalculator()) {
      note.style.display = 'none';
    } else {
      note.style.display = ''; // segue o CSS normal
    }
  }

  // Run once
  document.addEventListener('DOMContentLoaded', toggleNote);

  // Observe late injections (apps/sections dinâmicas)
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(() => toggleNote());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
