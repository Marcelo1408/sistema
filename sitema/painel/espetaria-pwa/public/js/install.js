// INSTALL_JS v50 - caixa de instalar aparece AO ENTRAR (PC + celular)
// arquivo isolado: NAO afeta o cardapio. 100% ASCII no source.
(function () {
  var DISMISS_KEY = 'pwa_dismiss_ts';
  var INSTALLED_KEY = 'pwa_installed';
  var DISMISS_MS = 3 * 24 * 60 * 60 * 1000;
  var banner = null, deferredPrompt = null, shown = false;
  var isIOS = false, isAndroid = false, wired = false;

  function $(id) { return document.getElementById(id); }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function detect() {
    var ua = navigator.userAgent || '';
    isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    isAndroid = /android/i.test(ua);
  }
  function isDismissed() { var ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10); return ts > 0 && (Date.now() - ts) < DISMISS_MS; }
  function setDismissed() { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} }
  function markInstalled() { try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {} }
  function isInstalled() { return isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1'; }
  function isForce() { return /[?&]testinstall=1/.test(location.search); }

  function injectCSS() {
    if (document.getElementById('installGuideCSS')) return;
    var s = document.createElement('style');
    s.id = 'installGuideCSS';
    s.textContent = '' +
      '.ib-steps{margin-top:12px}' +
      '.ib-bar{position:relative;display:flex;align-items:center;gap:7px;background:#f1f1f3;border:1px solid #e3e3e6;border-radius:12px;padding:9px 10px;margin-bottom:12px}' +
      '.ib-bar-dot{width:8px;height:8px;border-radius:50%;background:#c9c9cf;flex-shrink:0}' +
      '.ib-bar-url{flex:1;min-width:0;font-size:11px;color:#6b6b72;font-weight:600;background:#fff;border-radius:8px;padding:6px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ib-bar-kebab{position:relative;flex-shrink:0;color:#2b2b2b;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#fff;box-shadow:0 0 0 2px #EA1D2C;animation:ibPulse 1.6s ease-in-out infinite}' +
      '@keyframes ibPulse{0%,100%{box-shadow:0 0 0 2px #EA1D2C,0 0 0 0 rgba(234,29,44,.45)}50%{box-shadow:0 0 0 2px #EA1D2C,0 0 0 8px rgba(234,29,44,0)}}' +
      '.ib-arrow{position:absolute;right:-2px;top:-22px;width:22px;height:22px;color:#EA1D2C;animation:ibWiggle 1.3s ease-in-out infinite;transform-origin:80% 80%;pointer-events:none}' +
      '@keyframes ibWiggle{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(2px,-3px) rotate(8deg)}}' +
      '.ib-steps-t{font-size:13px;font-weight:800;color:#2b2b2b;margin:0 0 7px;letter-spacing:.01em}' +
      '.ib-steps-list{margin:0;padding-left:20px}' +
      '.ib-steps-list li{font-size:14px;color:#444;line-height:1.5;margin-bottom:6px}' +
      '.ib-steps-list li b{color:#202020}' +
      '.ib-kebab-mini{display:inline-grid;place-items:center;vertical-align:-5px;width:20px;height:20px;border-radius:6px;background:#f1f1f3;color:#2b2b2b;margin:0 1px}' +
      '.ib-kebab-mini svg{width:14px;height:14px}' +
      '.ib-steps-list svg{vertical-align:-3px}';
    (document.head || document.documentElement).appendChild(s);
  }

  function registrarSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { try { r.update(); } catch (e) {} });
      }).catch(function () {});
      navigator.serviceWorker.register('sw.js').catch(function () {});
    } catch (e) {}
  }

  function fitBottom() {
    if (!banner) return;
    var bar = $('barraSacola');
    var vis = bar && bar.classList && !bar.classList.contains('oculto');
    if (vis && bar.offsetHeight) banner.style.bottom = (bar.offsetHeight + 12) + 'px';
    else banner.style.bottom = 'calc(12px + env(safe-area-inset-bottom))';
  }
  function syncIcon() {
    var logo = $('logoLoja'); var icon = $('installIcon'); if (!logo || !icon) return;
    var s = logo.getAttribute('src') || ''; if (s && s.indexOf('icon.svg') === -1 && s.indexOf('icon-192') === -1) icon.src = s;
  }

  var KEBAB = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  var SHARE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><rect x="4" y="13" width="16" height="8" rx="2.5"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4c9 0 14 5 15 14"/><path d="M13 18h6v-6"/></svg>';

  function guiaBarra() {
    return '' +
      '<div class="ib-bar" aria-hidden="true">' +
        '<span class="ib-bar-dot"></span><span class="ib-bar-dot"></span><span class="ib-bar-dot"></span>' +
        '<span class="ib-bar-url">espetarianabrasa.giize.com</span>' +
        '<span class="ib-bar-kebab">' + KEBAB + '<span class="ib-arrow">' + ARROW + '</span></span>' +
      '</div>' +
      '<p class="ib-steps-t">Instale em 2 toques:</p>' +
      '<ol class="ib-steps-list">' +
        '<li>Toque nos <b>3 pontinhos</b> <span class="ib-kebab-mini">' + KEBAB + '</span> no canto de cima.</li>' +
        '<li>Toque em <b>Instalar app</b> (ou <b>Adicionar &#224; tela inicial</b>).</li>' +
      '</ol>';
  }
  function guiaIOS() {
    return '' +
      '<p class="ib-steps-t">Instale em 3 toques (Safari):</p>' +
      '<ol class="ib-steps-list">' +
        '<li>Toque em <b>Compartilhar</b> ' + SHARE + '.</li>' +
        '<li>Role e toque em <b>Adicionar &#224; Tela de In&#237;cio</b> ' + PLUS + '.</li>' +
        '<li>Confirme em <b>Adicionar</b>. Pronto!</li>' +
      '</ol>';
  }

  function applyContent() {
    var steps = $('installIosSteps'); var btn = $('btnInstall'); var gen = $('installGeneric');
    if (gen) gen.hidden = true;
    if (isIOS) {
      if (steps) { steps.className = 'ib-steps'; steps.innerHTML = guiaIOS(); steps.hidden = false; }
      if (btn) btn.style.display = 'none';
      return;
    }
    if (deferredPrompt) {
      if (steps) { steps.hidden = true; steps.innerHTML = ''; }
      if (btn) { btn.style.display = ''; btn.disabled = false; }
      return;
    }
    if (steps) { steps.className = 'ib-steps'; steps.innerHTML = guiaBarra(); steps.hidden = false; }
    if (btn) btn.style.display = 'none';
  }

  function wire() {
    if (wired) return; banner = $('installBanner'); if (!banner) return; wired = true;
    var btn = $('btnInstall'); var close = $('btnInstallClose');
    if (btn) btn.addEventListener('click', onInstallClick);
    if (close) close.addEventListener('click', onCloseClick);
    var bar = $('barraSacola');
    if (bar && window.MutationObserver) new MutationObserver(fitBottom).observe(bar, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', fitBottom);
    var logo = $('logoLoja');
    if (logo && window.MutationObserver) new MutationObserver(syncIcon).observe(logo, { attributes: true, attributeFilter: ['src'] });
  }

  function showBanner() {
    if (shown || !banner) return;
    if (isInstalled()) return;
    syncIcon();
    applyContent();
    shown = true; fitBottom();
    requestAnimationFrame(function () { requestAnimationFrame(function () { banner.classList.add('visivel'); }); });
  }
  function hideBanner() { if (banner) banner.classList.remove('visivel'); }

  function onInstallClick() {
    var btn = $('btnInstall'); if (!deferredPrompt) return; if (btn) btn.disabled = true;
    try {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') { markInstalled(); hideBanner(); } else { setDismissed(); hideBanner(); }
        deferredPrompt = null; if (btn) btn.disabled = false;
      }).catch(function () { deferredPrompt = null; if (btn) btn.disabled = false; });
    } catch (e) { deferredPrompt = null; if (btn) btn.disabled = false; }
  }
  function onCloseClick() { setDismissed(); hideBanner(); }

  window.addEventListener('beforeinstallprompt', function (e) {
    try { e.preventDefault(); } catch (err) {}
    deferredPrompt = e;
    if (shown && !isIOS) applyContent();
    else if (!isInstalled() && !isDismissed()) showBanner();
  });
  window.addEventListener('appinstalled', function () { markInstalled(); hideBanner(); });

  function start() {
    detect(); injectCSS(); registrarSW(); wire();
    if (isInstalled()) return;
    if (!isForce() && isDismissed()) return;
    setTimeout(function () { showBanner(); }, isForce() ? 500 : 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();