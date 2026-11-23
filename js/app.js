/**
 * ==========================================================================
 * AETHER CHRONO-X — js/app.js
 * Hardware Interaction & Customization Studio Controller
 * ==========================================================================
 * Features:
 * 1. Interactive Color & Finish Studio Switcher
 * 2. Hardware Specification Category Tab Switcher
 * 3. Dynamic Real-Time Pre-Order Price Calculator & Receipt Modal
 * 4. Lucide Icon Re-hydration and Mobile Navigation
 * 5. Smooth Anchor Scrolling & Rain Curtain Initialization
 * ==========================================================================
 */

(function () {
  'use strict';

  // State Management
  const configState = {
    size: '41mm',
    basePrice: 399,
    connectivity: 'gps',
    connectivityPrice: 0,
    strap: 'braided',
    strapPrice: 0,
    finish: 'obsidian',
    finishName: 'Cosmic Obsidian',
  };

  const finishImages = {
    obsidian: {
      name: 'Cosmic Obsidian',
      desc: 'DLC Matte Black Titanium with Charcoal Braided Loop',
      src: 'assets/images/finish_obsidian.jpg',
      badge: 'STEALTH MATTE'
    },
    titanium: {
      name: 'Stellar Titanium',
      desc: 'Satin Brushed Natural Aerospace Titanium with Silver Mesh',
      src: 'assets/images/finish_titanium.jpg',
      badge: 'AEROSPACE GRADE 5'
    },
    lavender: {
      name: 'Polar Lavender',
      desc: 'Micro-blasted Pale Titanium with Ethereal Lavender Woven Band',
      src: 'assets/images/finish_lavender.jpg',
      badge: 'LIMITED CELESTIAL EDITION'
    }
  };

  /**
   * 1. Interactive Color Studio
   */
  function initColorStudio() {
    const swatches = document.querySelectorAll('.color-swatch');
    const previewImg = document.getElementById('studio-preview-img');
    const finishLabel = document.getElementById('studio-finish-name');
    const finishDesc = document.getElementById('studio-finish-desc');
    const finishBadge = document.getElementById('studio-finish-badge');

    if (!swatches.length || !previewImg) return;

    swatches.forEach((swatch) => {
      swatch.addEventListener('click', function () {
        const finishKey = this.getAttribute('data-finish');
        if (!finishImages[finishKey]) return;

        swatches.forEach((s) => s.classList.remove('active'));
        this.classList.add('active');

        const data = finishImages[finishKey];
        configState.finish = finishKey;
        configState.finishName = data.name;

        // Smooth image transition
        previewImg.style.opacity = '0';
        previewImg.style.transform = 'scale(0.97)';
        
        setTimeout(() => {
          previewImg.src = data.src;
          if (finishLabel) finishLabel.textContent = data.name;
          if (finishDesc) finishDesc.textContent = data.desc;
          if (finishBadge) finishBadge.textContent = data.badge;
          previewImg.style.opacity = '1';
          previewImg.style.transform = 'scale(1)';
        }, 180);

        // Synchronize in purchase drawer
        const buySwatch = document.querySelector(`.buy-swatch[data-finish="${finishKey}"]`);
        if (buySwatch) {
          document.querySelectorAll('.buy-swatch').forEach((b) => b.classList.remove('active'));
          buySwatch.classList.add('active');
        }
        updatePriceSummary();
      });
    });
  }

  /**
   * 2. Specifications Category Tabs
   */
  function initSpecsTabs() {
    const tabBtns = document.querySelectorAll('.specs-tab-btn');
    const tabPanels = document.querySelectorAll('.specs-panel');

    if (!tabBtns.length) return;

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', function () {
        const targetTab = this.getAttribute('data-tab');

        tabBtns.forEach((b) => b.classList.remove('active'));
        tabPanels.forEach((p) => p.classList.remove('active'));

        this.classList.add('active');
        const activePanel = document.getElementById(`specs-${targetTab}`);
        if (activePanel) {
          activePanel.classList.add('active');
        }
      });
    });
  }

  /**
   * 3. Interactive Purchase Customizer & Dynamic Total
   */
  function initCustomizer() {
    const sizeOptions = document.querySelectorAll('.config-size-btn');
    const connOptions = document.querySelectorAll('.config-conn-btn');
    const strapOptions = document.querySelectorAll('.config-strap-btn');
    const buySwatches = document.querySelectorAll('.buy-swatch');

    // Size selection
    sizeOptions.forEach((btn) => {
      btn.addEventListener('click', function () {
        sizeOptions.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        configState.size = this.getAttribute('data-size');
        configState.basePrice = parseInt(this.getAttribute('data-price'), 10) || 399;
        updatePriceSummary();
      });
    });

    // Connectivity selection
    connOptions.forEach((btn) => {
      btn.addEventListener('click', function () {
        connOptions.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        configState.connectivity = this.getAttribute('data-conn');
        configState.connectivityPrice = parseInt(this.getAttribute('data-price'), 10) || 0;
        updatePriceSummary();
      });
    });

    // Strap selection
    strapOptions.forEach((btn) => {
      btn.addEventListener('click', function () {
        strapOptions.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        configState.strap = this.getAttribute('data-strap');
        configState.strapPrice = parseInt(this.getAttribute('data-price'), 10) || 0;
        updatePriceSummary();
      });
    });

    // Finish in purchase section
    buySwatches.forEach((swatch) => {
      swatch.addEventListener('click', function () {
        const finishKey = this.getAttribute('data-finish');
        buySwatches.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');

        if (finishImages[finishKey]) {
          configState.finish = finishKey;
          configState.finishName = finishImages[finishKey].name;
        }

        // Also sync with color studio preview
        const studioSwatch = document.querySelector(`.color-swatch[data-finish="${finishKey}"]`);
        if (studioSwatch) studioSwatch.click();

        updatePriceSummary();
      });
    });

    // Modal interactions
    const preOrderBtn = document.getElementById('preorder-submit-btn');
    const modal = document.getElementById('order-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalDismiss = document.getElementById('modal-dismiss-btn');

    if (preOrderBtn && modal) {
      preOrderBtn.addEventListener('click', function (e) {
        e.preventDefault();
        populateModalReceipt();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    function closeModal() {
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modalDismiss) modalDismiss.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }
  }

  function updatePriceSummary() {
    const total = configState.basePrice + configState.connectivityPrice + configState.strapPrice;
    const priceDisplay = document.getElementById('config-total-price');
    const subtotalDisplay = document.getElementById('config-subtotal');
    const monthlyDisplay = document.getElementById('config-monthly-price');

    if (priceDisplay) priceDisplay.textContent = `$${total}`;
    if (subtotalDisplay) subtotalDisplay.textContent = `$${total}`;
    if (monthlyDisplay) {
      const monthly = Math.round(total / 12);
      monthlyDisplay.textContent = `or $${monthly}/mo. for 12 mo.`;
    }

    const summaryText = document.getElementById('config-summary-text');
    if (summaryText) {
      summaryText.textContent = `${configState.size} • ${configState.finishName} • ${configState.connectivity.toUpperCase()} • ${capitalize(configState.strap)} Band`;
    }
  }

  function populateModalReceipt() {
    const total = configState.basePrice + configState.connectivityPrice + configState.strapPrice;
    const rSize = document.getElementById('modal-receipt-size');
    const rFinish = document.getElementById('modal-receipt-finish');
    const rConn = document.getElementById('modal-receipt-conn');
    const rStrap = document.getElementById('modal-receipt-strap');
    const rTotal = document.getElementById('modal-receipt-total');

    if (rSize) rSize.textContent = configState.size;
    if (rFinish) rFinish.textContent = configState.finishName;
    if (rConn) rConn.textContent = configState.connectivity === 'cellular' ? 'Cellular + Satellite SOS (+ $100)' : 'GPS + Wi-Fi';
    if (rStrap) rStrap.textContent = `${capitalize(configState.strap)} Band ${configState.strapPrice ? '(+$' + configState.strapPrice + ')' : ''}`;
    if (rTotal) rTotal.textContent = `$${total} USD`;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 4. Smooth Anchor Scrolling & Mobile Nav
   */
  function initNav() {
    const navToggle = document.getElementById('nav-toggle');
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            const yOffset = -70;
            const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });

            if (navToggle && navToggle.checked) {
              navToggle.checked = false;
            }
          }
        }
      });
    });
  }

  /**
   * 5. Lucide Icons
   */
  function initIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  /**
   * 6. Application Lifecycle
   */
  function init() {
    initIcons();
    initNav();
    initColorStudio();
    initSpecsTabs();
    initCustomizer();
    updatePriceSummary();

    if (typeof window.initRainCurtain === 'function') {
      window.initRainCurtain();
    }

    setTimeout(initIcons, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
