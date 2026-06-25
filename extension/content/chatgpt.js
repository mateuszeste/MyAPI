// ChatGPT content script - extracts JWT auth token and session cookie

(function () {
  if (window.__myapiExtensionLoaded) return;
  window.__myapiExtensionLoaded = true;

  let capturedJwt = null;

  function interceptJwt() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/chatgpt-inject.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }

  window.addEventListener('message', (event) => {
    if (event.source === window && event.data && event.data.type === 'MYAPI_JWT') {
      capturedJwt = event.data.jwt;
    }
  });


  function createButton() {
    const btn = document.createElement("button");
    btn.id = "myapi-copy-btn";
    btn.classList.add("myapi-btn-chatgpt");
    btn.textContent = "Copy to .env";

    btn.addEventListener("click", async () => {
      btn.textContent = "Copying...";
      btn.disabled = true;

      try {
        let activeJwt = capturedJwt;
        if (!activeJwt) {
          try {
            const res = await window.fetch("https://chatgpt.com/api/auth/session");
            if (res.ok) {
              const data = await res.json();
              if (data && data.accessToken) {
                activeJwt = data.accessToken;
              }
            }
          } catch (_e) {
             // Ignore fallback failures; the background script can still extract cookies.
          }
        }

        const response = await chrome.runtime.sendMessage({
          type: "extract",
          provider: "chatgpt",
          jwtToken: activeJwt,
        });

        if (response?.success && response?.hasCookies > 0) {
          const text = response.snippet || "# No data";
          try {
            await navigator.clipboard.writeText(text);
          } catch(_e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy to .env"), 2000);
        } else if (response?.hasCookies === 0) {
          btn.textContent = "No cookies";
          setTimeout(() => (btn.textContent = "Copy to .env"), 3000);
        } else {
          btn.textContent = response?.error || "Failed";
          setTimeout(() => (btn.textContent = "Copy to .env"), 3000);
        }
      } catch (e) {
        btn.textContent = "Error: " + e.message;
        setTimeout(() => (btn.textContent = "Copy to .env"), 3000);
      } finally {
        btn.disabled = false;
      }
    });

    return btn;
  }

  function init() {
    interceptJwt();
    const existing = document.getElementById("myapi-copy-btn");
    if (existing) existing.remove();

    const btn = createButton();
    document.body.appendChild(btn);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
