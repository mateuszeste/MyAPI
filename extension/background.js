// MyAPI Credentials Extension - Background Service Worker

const PROVIDERS = {
  claude: {
    name: "Claude Pro",
    domain: "claude.ai",
    envKeys: ["CLAUDE_SESSION_COOKIE", "CLAUDE_ORG_ID", "CLAUDE_DEVICE_ID"],
  },
  chatgpt: {
    name: "ChatGPT Codex",
    domain: "chatgpt.com",
    envKeys: ["CHATGPT_AUTH_TOKEN", "CHATGPT_SESSION_COOKIE"],
  },
  ollama: {
    name: "Ollama Cloud",
    domain: "ollama.com",
    envKeys: ["OLLAMA_SESSION_COOKIE"],
  },
  openrouter: {
    name: "OpenRouter",
    domain: "openrouter.ai",
    envKeys: ["OPENROUTER_API_KEY"],
  },
  kilocode: {
    name: "Kilo Code",
    domain: "app.kilo.ai",
    envKeys: ["KILO_SESSION_COOKIE"],
  },
  googleone: {
    name: "Google One",
    domain: "google.com",
    envKeys: ["GOOGLE_ONE_COOKIES"],
  },
  aws: {
    name: "Amazon Bedrock",
    domain: "amazon.com",
    envKeys: ["AWS_SESSION_COOKIE"],
  },
};

// Extract cookies using chrome.cookies API
async function extractCookies(provider) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const query = config.url ? { url: config.url } : { domain: config.domain };
  if (provider === "googleone") {
    query.name = "SAPISID";
  }
  const cookies = await chrome.cookies.getAll(query);
  if (chrome.runtime.lastError) {
    console.warn("Cookie access denied for", provider, ":", chrome.runtime.lastError.message);
    return { cookies: {}, config };
  }

  const cookieMap = {};
  cookies.forEach((cookie) => {
    cookieMap[cookie.name] = cookie.value;
  });

  return { cookies: cookieMap, config };
}

// Format cookies as .env.local snippet
function formatEnvSnippet(provider, cookieData, jwtToken = null) {
  const config = PROVIDERS[provider];
  const lines = [];

  if (provider === "claude") {
    const sessionCookie = Object.entries(cookieData)
      .find(([name]) => name.includes("session"))?.[1];
    const orgId = Object.entries(cookieData)
      .find(([name]) => name.includes("org"))?.[1];
    const deviceId = Object.entries(cookieData)
      .find(([name]) => name.includes("device"))?.[1];

    if (sessionCookie) lines.push(`CLAUDE_SESSION_COOKIE=${sessionCookie}`);
    if (orgId) lines.push(`CLAUDE_ORG_ID=${orgId}`);
    if (deviceId) lines.push(`CLAUDE_DEVICE_ID=${deviceId}`);
  } else if (provider === "chatgpt") {
    const sessionCookie = Object.entries(cookieData)
      .find(([name]) =>
        ["sessionid", "cf_clearance", "__cf_bm"].includes(name)
      )?.[1];
    if (jwtToken) lines.push(`CHATGPT_AUTH_TOKEN=${jwtToken}`);
    if (sessionCookie) lines.push(`CHATGPT_SESSION_COOKIE=${sessionCookie}`);
  } else if (provider === "ollama") {
    const allCookies = Object.entries(cookieData)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    if (allCookies) {
      lines.push(`OLLAMA_SESSION_COOKIE="${allCookies}"`);
    }
  } else if (provider === "openrouter") {
    const apiKey = Object.entries(cookieData)
      .find(([name]) => name.includes("api") || name.includes("key"))?.[1];
    if (apiKey) lines.push(`OPENROUTER_API_KEY=${apiKey}`);
  } else if (provider === "kilocode") {
    // Extract all cookies as the full Cookie header value
    const allCookies = Object.entries(cookieData)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    if (allCookies) {
      lines.push(`KILO_SESSION_COOKIE="${allCookies}"`);
    }
  } else if (provider === "googleone") {
    const googleOneNames = ["SAPISID", "APISID", "SSID", "HSID"];
    const filteredCookies = Object.entries(cookieData)
      .filter(([name]) => googleOneNames.includes(name))
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    if (filteredCookies) {
      lines.push(`GOOGLE_ONE_COOKIES="${filteredCookies}"`);
    }
  } else if (provider === "aws") {
    const allCookies = Object.entries(cookieData)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    if (allCookies) {
      lines.push(`AWS_SESSION_COOKIE="${allCookies}"`);
    }
  }

  if (lines.length === 0) {
    return `# No credentials found for ${config.name}`;
  }

  return [
    `# ─── ${config.name} ─────────────────────────────────────────`,
    ...lines,
  ].join("\n");
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "extract") {
        const { provider, jwtToken } = message;
        
        const { cookies } = await extractCookies(provider);
        
        const envSnippet = formatEnvSnippet(provider, cookies, jwtToken);

        await chrome.storage.local.set({
          lastExtracted: {
            provider,
            timestamp: Date.now(),
            hasCredentials: Object.keys(cookies).length > 0,
          },
        });

        sendResponse({ success: true, snippet: envSnippet, hasCookies: Object.keys(cookies).length });
      } else if (message.type === "copy-clipboard") {
        sendResponse({ error: "Credential snippets are not stored. Use the provider Copy action again." });
      } else if (message.type === "get-last") {
        const result = await chrome.storage.local.get("lastExtracted");
        sendResponse(result.lastExtracted || null);
      } else if (message.type === "get-providers") {
        const status = {};
        for (const [key, config] of Object.entries(PROVIDERS)) {
          const query = config.url ? { url: config.url } : { domain: config.domain };
          const cookies = await chrome.cookies.getAll(query);
          status[key] = {
            name: config.name,
            hasCookies: cookies.length > 0,
            count: cookies.length,
          };
        }
        sendResponse({ providers: status });
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("MyAPI Credentials extension installed:", details.reason);
});
