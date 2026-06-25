(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const url = args[0];
      if (typeof url === 'string' && (url.includes('/wham/usage') || url.includes('/backend-api/'))) {
        let auth = null;
        if (args[1] && args[1].headers) {
          const h = args[1].headers;
          auth = (h instanceof Headers) ? h.get('authorization') : (h['Authorization'] || h['authorization']);
        }
        if (auth && auth.startsWith('Bearer ')) {
          window.postMessage({ type: 'MYAPI_JWT', jwt: auth.substring(7) }, '*');
        }
      }
    } catch(_) {}
    return originalFetch.apply(this, args);
  };
})();
