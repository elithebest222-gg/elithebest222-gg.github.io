// ===============================
// Universal SDK Loader
// ===============================

// Default config (can be overridden by SDK.init)
window.SDK_CONFIG = {
  installProviders: ["adinplay", "cpmstar", "local"],
  videoAdPriorities: ["adinplay", "cpmstar"],
  bannerAdPriorities: ["adinplay", "cpmstar", "local"],
  providerScriptPath: (provider) => `ads/adapters/${provider}-ads.js`, // can be replaced
};

// Update globals
const ENABLE_ADS = true;
const DEBUG_MODE = window.location.href.includes("test");
const IS_MOBILE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ===============================
// Provider Loader
// ===============================
function loadProviderScript(provider, pathFunc) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = pathFunc(provider);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${provider}`));
    document.head.appendChild(script);
  });
}

async function loadProviders() {
  for (const provider of SDK_CONFIG.installProviders) {
    try {
      await loadProviderScript(provider, SDK_CONFIG.providerScriptPath);
      if (DEBUG_MODE) console.log(`[sdk.js] Loaded provider: ${provider}`);
    } catch (e) {
      console.warn(`[sdk.js] Could not load provider ${provider}:`, e.message);
    }
  }
}

// ===============================
// Safe Unity messaging
// ===============================
function safeUnitySend(msg, val) {
  if (typeof window.unityInstance !== "undefined") {
    unityInstance.SendMessage("SDKManager", msg, val);
  } else if (DEBUG_MODE) {
    console.log(`[sdk.js] Unity message skipped: ${msg}=${val}`);
  }
}

// ===============================
// Public SDK API
// ===============================
window.SDK = {
  _isInitialized: false,
  _pendingBannerQueue: [],

  init(config = {}) {
    // merge config
    Object.assign(SDK_CONFIG, config);

    if (DEBUG_MODE) console.log("[sdk.js] Initializing SDK with config:", SDK_CONFIG);

    return loadProviders().then(() => {
      this._isInitialized = true;
      if (DEBUG_MODE) console.log("[sdk.js] SDK initialized, providers loaded");
      this._processQueuedBanners?.();
      this.loadingStart();
    });
  },

  gameplayStart() {
    if (DEBUG_MODE) console.log("[sdk.js] Gameplay started");
  },

  gameplayEnd() {
    if (DEBUG_MODE) console.log("[sdk.js] Gameplay ended");
  },

  loadingStart() {
    if (DEBUG_MODE) console.log("[sdk.js] Loading started");
  },

  loadingEnd() {
    if (DEBUG_MODE) console.log("[sdk.js] Loading finished");
  },

  showMidroll() {
    if (ENABLE_ADS) {
      showAd("midroll");
    } else {
      safeUnitySend("OnVideoAdEnded", "true");
    }
  },

  showRewarded() {
    if (ENABLE_ADS) {
      showAd("rewarded");
    } else {
      safeUnitySend("OnVideoAdEnded", "true");
    }
  },

  // banners handled by your existing SetBanner logic
};

// ===============================
// Example: showAd with safe fallback
// ===============================
function showAd(adType) {
  let idx = 0;
  const priorities = SDK_CONFIG.videoAdPriorities;

  function tryNext() {
    if (idx >= priorities.length) {
      safeUnitySend("OnVideoAdEnded", "false");
      return;
    }

    const providerName = priorities[idx++];
    const provider = window.videoAdProviders?.[providerName];
    if (!provider) return tryNext();

    const fn = adType === "rewarded" ? "showRewarded" : "showMidroll";

    provider[fn](
      () => safeUnitySend("OnVideoAdEnded", "true"),
      () => tryNext()
    );
  }

  tryNext();
}
