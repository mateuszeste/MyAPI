// Google One (Antigravity) content script - notifies background to extract cookies

(function () {
  if (window.__myapiExtensionLoaded) return;
  window.__myapiExtensionLoaded = true;

  function createButton() {
    const btn = document.createElement("button");
    btn.id = "myapi-copy-btn";
    btn.textContent = "Copy to .env";
    btn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      padding: 10px 16px;
      background: #4285F4;
      color: white;
      border: none;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
    `;

    btn.addEventListener("click", async () => {
      btn.textContent = "Copying...";
      btn.disabled = true;

      try {
        const response = await chrome.runtime.sendMessage({
          type: "extract",
          provider: "googleone",
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
