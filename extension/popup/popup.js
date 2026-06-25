// Popup script - shows provider status and allows copying

document.addEventListener("DOMContentLoaded", async () => {
  const providersContainer = document.getElementById("providers");

  const providerMeta = {
    claude: { name: "Claude Pro", color: "#dc2626" },
    chatgpt: { name: "ChatGPT", color: "#10a37f" },
    ollama: { name: "Ollama Cloud", color: "#ff5722" },
    openrouter: { name: "OpenRouter", color: "#6366f1" },
    kilocode: { name: "Kilo Code", color: "#8b5cf6" },
    googleone: { name: "Google One", color: "#4285F4" },
    aws: { name: "Amazon Bedrock", color: "#FF9900" },
  };

  try {
    const response = await chrome.runtime.sendMessage({ type: "get-providers" });
    const providers = response?.providers || {};

    providersContainer.innerHTML = Object.entries(providerMeta)
      .map(([id, meta]) => {
        const status = providers[id];
        const isActive = status?.hasCookies;
        return `
          <div class="provider" data-provider="${id}">
            <div class="provider-info">
              <div class="provider-dot ${isActive ? "" : "inactive"}"></div>
              <div>
                <div class="provider-name">${meta.name}</div>
                <div class="provider-status">${isActive ? `${status.count} cookies` : "Not logged in"}</div>
              </div>
            </div>
            <button class="copy-btn" data-provider="${id}" ${!isActive ? 'disabled' : ''}>
              Copy
            </button>
          </div>
        `;
      })
      .join("");

    // Add click handlers for copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider;
        btn.textContent = "Loading...";
        
        try {
          const extractRes = await chrome.runtime.sendMessage({ 
            type: "extract", 
            provider 
          });
          
          if (extractRes?.success && extractRes?.snippet) {
            try {
              await navigator.clipboard.writeText(extractRes.snippet);
            } catch (_clipErr) {
              // Fallback: show in alert for manual copy
              prompt("Copy this to .env.local:", extractRes.snippet);
            }
            btn.textContent = "Copied!";
            setTimeout(() => btn.textContent = "Copy", 2000);
          } else {
            btn.textContent = "Failed";
            setTimeout(() => btn.textContent = "Copy", 2000);
          }
        } catch (_e) {
          btn.textContent = "Error";
          setTimeout(() => btn.textContent = "Copy", 2000);
        }
      });
    });
  } catch (_e) {
    providersContainer.innerHTML = '<div class="provider"><div class="provider-name">Error loading status</div></div>';
  }
});
