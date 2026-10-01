'use strict';

var exec = require('cordova/exec');

var service = 'IpsuDeeplink';
var callbacks = [];
var subscribed = false;

// URL captured before app code registered onOpenUrl().
var jsPendingUrl = '';

// One logical deeplink must be delivered only once, even if iOS sends it through
// both cold-start storage and the live callback path.
var lastHandledUrl = '';
var lastHandledAt = 0;
var DUPLICATE_WINDOW_MS = 5000;

function nowMs() {
  return Date.now ? Date.now() : new Date().getTime();
}

function isRecentDuplicate(url) {
  if (!url) {
    return false;
  }
  return url === lastHandledUrl && (nowMs() - lastHandledAt) < DUPLICATE_WINDOW_MS;
}

function markHandled(url) {
  if (!url) {
    return;
  }
  lastHandledUrl = url;
  lastHandledAt = nowMs();
}

function dispatchToCallbacks(url) {
  callbacks.slice().forEach(function (cb) {
    try {
      cb(url);
    } catch (e) {
      setTimeout(function () {
        throw e;
      }, 0);
    }
  });
}

function deliver(url) {
  if (!url) {
    return false;
  }

  // If nobody is listening yet, keep it as pending instead of marking it handled.
  // This lets the first onOpenUrl() or getInitialUrlPromise() consume it later.
  if (!callbacks.length) {
    jsPendingUrl = url;
    return false;
  }

  if (isRecentDuplicate(url)) {
    return false;
  }

  markHandled(url);

  if (jsPendingUrl === url) {
    jsPendingUrl = '';
  }

  dispatchToCallbacks(url);
  return true;
}

function consumeInitialUrl(url) {
  var finalUrl = url || jsPendingUrl || '';

  if (!finalUrl) {
    return '';
  }

  // If onOpenUrl() already handled the same cold-start URL, do not make
  // getInitialUrlPromise() return it again.
  if (isRecentDuplicate(finalUrl)) {
    if (jsPendingUrl === finalUrl) {
      jsPendingUrl = '';
    }
    return '';
  }

  markHandled(finalUrl);

  if (jsPendingUrl === finalUrl) {
    jsPendingUrl = '';
  }

  // Clear native storage too. This is best effort; do not block resolving.
  exec(function () {}, function () {}, service, 'clearInitialUrl', []);

  return finalUrl;
}

// Cordova iOS built-in CDVHandleOpenURL can call window.handleOpenURL(url).
// Keep this fallback, but de-duplicate it against our native plugin callback.
var previousHandleOpenURL = (typeof window !== 'undefined') ? window.handleOpenURL : null;
if (typeof window !== 'undefined') {
  window.handleOpenURL = function (url) {
    if (url) {
      jsPendingUrl = url;
      deliver(url);
    }

    if (typeof previousHandleOpenURL === 'function') {
      try {
        previousHandleOpenURL(url);
      } catch (e) {
        setTimeout(function () { throw e; }, 0);
      }
    }
  };
}

function ensureNativeSubscription() {
  if (subscribed) {
    return;
  }

  subscribed = true;

  exec(function (url) {
    deliver(url);
  }, function (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[IpsuDeeplink] native subscription failed:', err);
    }
  }, service, 'subscribe', []);
}

module.exports = {
  onOpenUrl: function (callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('IpsuDeeplink.onOpenUrl requires a callback function');
    }

    callbacks.push(callback);
    ensureNativeSubscription();

    // Flush a URL captured by window.handleOpenURL before app code subscribed.
    if (jsPendingUrl) {
      setTimeout(function () {
        deliver(jsPendingUrl);
      }, 0);
    }

    return function unsubscribe() {
      callbacks = callbacks.filter(function (cb) {
        return cb !== callback;
      });
    };
  },

  getInitialUrl: function (success, error) {
    exec(function (url) {
      success && success(consumeInitialUrl(url));
    }, function (err) {
      if (jsPendingUrl) {
        success && success(consumeInitialUrl(jsPendingUrl));
      } else if (error) {
        error(err);
      }
    }, service, 'getInitialUrl', []);
  },

  getInitialUrlPromise: function () {
    return new Promise(function (resolve, reject) {
      exec(function (url) {
        resolve(consumeInitialUrl(url));
      }, function (err) {
        if (jsPendingUrl) {
          resolve(consumeInitialUrl(jsPendingUrl));
        } else {
          reject(err);
        }
      }, service, 'getInitialUrl', []);
    });
  },

  clearInitialUrl: function (success, error) {
    jsPendingUrl = '';
    exec(success || function () {}, error || function () {}, service, 'clearInitialUrl', []);
  },

  // Debug helper. Safe to remove from production usage.
  _debugState: function () {
    return {
      subscribed: subscribed,
      callbacks: callbacks.length,
      jsPendingUrl: jsPendingUrl,
      lastHandledUrl: lastHandledUrl,
      lastHandledAt: lastHandledAt
    };
  }
};
