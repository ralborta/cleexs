/**
 * Tracking de visitantes de landings marketing (cleexs.net).
 * Dispara pageview a la API Cleexs para el embudo de conversión interno.
 *
 * Path:
 * - window.__CLEEXS_LANDING_PATH__ si la landing lo define (ej. "/linkedin")
 * - "/" por defecto (home)
 */
(function () {
  try {
    var API = 'https://cleexsapi-production.up.railway.app/api/public/track/pageview';
    var COOKIE = 'cleexs_vid';
    var STORAGE = 'cleexs_vid';
    var ATTR_KEY = 'cleexs_diagnostic_attribution';

    function landingPath() {
      try {
        var override = window.__CLEEXS_LANDING_PATH__;
        if (typeof override === 'string' && override.trim()) {
          var p = override.trim();
          if (p.charAt(0) !== '/') p = '/' + p;
          return p.replace(/\/+$/, '') || '/';
        }
      } catch (e) {}
      return '/';
    }

    function readCookie(name) {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    }

    function writeCookie(name, value) {
      document.cookie =
        name +
        '=' +
        encodeURIComponent(value) +
        '; Domain=.cleexs.net; Path=/; Max-Age=31536000; SameSite=Lax; Secure';
    }

    function getVisitorId() {
      var id = readCookie(COOKIE);
      if (!id) {
        try {
          id = window.localStorage.getItem(STORAGE) || '';
        } catch (e) {}
      }
      if (!id) {
        id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      }
      writeCookie(COOKIE, id);
      try {
        window.localStorage.setItem(STORAGE, id);
      } catch (e) {}
      return id;
    }

    function attribution() {
      var sp = new URLSearchParams(window.location.search);
      var ref = sp.get('ref') || sp.get('ref_code') || '';
      var utmSource = sp.get('utm_source') || '';
      var utmMedium = sp.get('utm_medium') || '';
      var utmCampaign = sp.get('utm_campaign') || '';
      if (!ref && !utmSource && !utmMedium && !utmCampaign) {
        try {
          var raw = sessionStorage.getItem(ATTR_KEY);
          if (raw) {
            var a = JSON.parse(raw);
            ref = a.ref || a.refCode || '';
            utmSource = a.utm_source || a.utmSource || '';
            utmMedium = a.utm_medium || a.utmMedium || '';
            utmCampaign = a.utm_campaign || a.utmCampaign || '';
          }
        } catch (e) {}
      }
      if (!ref) {
        try {
          ref = readCookie('cleexs_ref') || '';
        } catch (e) {}
      }
      return {
        refCode: ref || undefined,
        utmSource: utmSource || undefined,
        utmMedium: utmMedium || undefined,
        utmCampaign: utmCampaign || undefined,
        sourceChannel: 'web',
      };
    }

    function fire() {
      var body = Object.assign(
        {
          path: landingPath(),
          visitorId: getVisitorId(),
        },
        attribution()
      );
      // Quitar undefined
      Object.keys(body).forEach(function (k) {
        if (body[k] == null || body[k] === '') delete body[k];
      });
      var payload = JSON.stringify(body);
      try {
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          mode: 'cors',
          keepalive: true,
          credentials: 'omit',
        }).catch(function () {});
      } catch (e) {}
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fire);
    } else {
      fire();
    }
  } catch (e) {
    // never break the page
  }
})();
