/**
 * ANYTHING ECOSYSTEM UNIVERSAL AUTH CLIENT
 * Universal module for Child Apps (MediaFlow Studio, One Tap, DocuFlow, etc.)
 * Allows child apps to automatically inherit the master user login from Anything!
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    exports.AnythingEcosystemAuth = factory();
  } else {
    root.AnythingEcosystemAuth = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function resolveSessionPath() {
    if (typeof process === 'undefined' || !process.env) return null;

    // 1. CLI Arg Override
    for (let i = 0; i < (process.argv || []).length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith('--ecosystem-session=')) {
        return arg.split('=')[1];
      }
    }

    // 2. Environment Variable
    if (process.env.ANYTHING_ECOSYSTEM_SESSION_PATH) {
      return process.env.ANYTHING_ECOSYSTEM_SESSION_PATH;
    }

    // 3. Known APPDATA Paths (Windows)
    try {
      const path = require('path');
      const fs = require('fs');
      const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : '');
      const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : '');

      const candidates = [
        appData ? path.join(appData, 'Anything', 'ecosystem_session.json') : null,
        appData ? path.join(appData, 'anything', 'ecosystem_session.json') : null,
        localAppData ? path.join(localAppData, 'anything', 'ecosystem_session.json') : null,
      ].filter(Boolean);

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
    } catch (e) {}

    return null;
  }

  function getEcosystemSession() {
    // A. Check Node.js filesystem in Electron Main/Preload
    const filePath = resolveSessionPath();
    if (filePath) {
      try {
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.warn('[EcosystemAuth] Failed to read session file:', e);
      }
    }

    // B. Check Environment Variables
    if (typeof process !== 'undefined' && process.env && process.env.ANYTHING_USER_ID) {
      return {
        user: {
          id: process.env.ANYTHING_USER_ID,
          email: process.env.ANYTHING_USER_EMAIL || '',
          name: process.env.ANYTHING_USER_NAME || '',
          role: process.env.ANYTHING_USER_ROLE || 'member',
          avatar: null,
        },
        supabase: {
          url: process.env.VITE_SUPABASE_URL || '',
          anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
        },
        syncedAt: new Date().toISOString(),
      };
    }

    // C. Check Browser / Electron Renderer localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('anything_ecosystem_session_v1');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }

    return null;
  }

  function getEcosystemUser() {
    const session = getEcosystemSession();
    return session?.user || null;
  }

  function isEcosystemAuthenticated() {
    return Boolean(getEcosystemUser());
  }

  return {
    getEcosystemSession,
    getEcosystemUser,
    isEcosystemAuthenticated,
  };
});
