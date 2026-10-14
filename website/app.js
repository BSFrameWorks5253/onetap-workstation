/**
 * Uni Desk — Official Website & Download Portal Logic
 * BS Framework (c) 2026
 */

const CONFIG = {
  appName: "Uni Desk",
  defaultVersion: "26.10.2",
  defaultReleaseDate: "2026-10-05",
  publisher: "BS.Framework",
  
  // Download URLs - Relative paths for local serving, with CDN/GitHub mirror fallbacks
  downloads: {
    installer: {
      fileName: "Uni_Desk_Setup_V26.10.2.exe",
      size: "91.3 MB",
      sha256: "8cb6e4338d4814ce8b52bea4af076c05e385c1fe895e7504f8554e440426fca0",
      url: "./Uni_Desk_Setup_V26.10.2.exe",
      fallbackUrl: "https://releases.bsframework.com/onetap/Uni_Desk_Setup_V26.10.2.exe"
    },
    portable: {
      fileName: "Uni Desk_V26.10.0.exe",
      size: "90.8 MB",
      sha256: "b9c03de9a32c256247c458cbf855b3eb09cbeff09ba551608688e404b901fc63",
      url: "../release/Uni Desk_V26.10.0.exe",
      fallbackUrl: "https://releases.bsframework.com/onetap/Uni%20Desk_V26.10.0.exe"
    },
    zip: {
      fileName: "Uni Desk-26.10.0-win.zip",
      size: "124.5 MB",
      sha256: "e34ba12c7d9a38f3706059d08e5033c4b7264a9712a8069ceb0222feee9a3d46",
      url: "../release/Uni Desk-26.10.0-win.zip",
      fallbackUrl: "https://releases.bsframework.com/onetap/Uni%20Desk-26.10.0-win.zip"
    },
    linux: {
      fileName: "UniDesk_Linux_V26.9.22.AppImage",
      size: "125.6 MB",
      url: "../release/Uni Desk_Linux_V26.9.22.AppImage",
      fallbackUrl: "https://releases.bsframework.com/onetap/UniDesk_Linux_V26.9.22.AppImage"
    }
  },

  // Microsoft Store Configuration
  microsoftStore: {
    productId: "9NBSFRAMEWORK", // Replace with your Microsoft Partner Center Product ID when assigned
    webUrl: "https://apps.microsoft.com/detail/9NBSFRAMEWORK?mode=direct",
    deepLink: "ms-windows-store://pdp/?productid=9NBSFRAMEWORK"
  }
};

const UniDeskApp = {
  releases: [],
  activeFilter: 'all',
  searchQuery: '',

  init() {
    this.fetchReleases();
    this.setupListeners();
  },

  async fetchReleases() {
    try {
      const response = await fetch('data/updates.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        this.releases = data;
        this.updateHeaderAndHero(data[0]);
      } else {
        this.useFallbackReleases();
      }
    } catch (err) {
      console.warn('Could not fetch data/updates.json, using bundled manifest:', err);
      this.useFallbackReleases();
    }
    this.renderChangelog();
  },

  useFallbackReleases() {
    this.releases = [
      {
        version: CONFIG.defaultVersion,
        date: CONFIG.defaultReleaseDate,
        whats_new: "• Linux & Windows Cross-Platform Release Studio: Complete automated release pipeline engine (make_exe_cross.py) supporting compilation across both Windows and Linux, generating production Windows executables (.exe), NSIS installers, and Linux packages.\n• Modern 4-Tab CustomTkinter Studio UI: Redesigned the developer compilation hub with clean Segmented Architecture.\n• Live Obsidian Build Console: Real-time high-contrast terminal console streaming live compilation logs.\n• Interactive Toolchain Diagnostics with Dynamic Re-Scan for Node, NPM, Git, NSIS, ISCC, and Wine.\n• Smart Release Notes & Markdown Composer with auto-bullets and one-click auto-compile changelog.",
        release_notes: "• Linux & Windows Cross-Platform Release Engine\n• Modern 4-Tab CustomTkinter Studio UI with Real-Time Obsidian Terminal\n• Fixed Persistent False-Positive Update Prompt on Workstation Startup\n• Built-in NSIS v3.04 Engine & Multi-Directory Auto-Discovery\n• Smart Release Notes Composer with Auto-Bullets & Markdown Preview\n• Dedicated Google Sheets Client Email Notification Center",
        bugs_fixed: "• Fixed Persistent False-Positive Startup Update Prompt: Corrected semver comparison logic.\n• Fixed Missing Makensis Dependency Detection: Added multi-directory fallback resolution.\n• Fixed IDE Import Squiggly Underlines on customtkinter stubs.\n• Fixed Release Studio Console Squishing in nested scroll layouts.",
        improvements: "• Persistent Docked Action Center with target version badges and live status LED.\n• Streamlined Email Broadcast Management with live browser previews.\n• One-Click Quick Version Bumpers (+ Patch, + Minor).\n• Standalone Studio Executable Compiler (compile_studio.bat)."
      },
      {
        version: "26.9.23",
        date: "2026-09-23",
        whats_new: "• Nikah Ceremony Automation & Mango Group Photo Ripple Placement in Premiere Pro CEP.\n• Lightning-Fast XML Sequence Locator across Premiere Pro CEP Extensions (<1ms).\n• Zero-Click Domino Pipeline: Title Adder auto-chaining into Converter Rename & Move.\n• Batch Completion Audio Chimes & Native Windows Desktop Notifications.",
        bugs_fixed: "• Fixed Nikah Marker Prefix Shadowing (_01M morning session tags).\n• Fixed EBUSY / File-Locking Dialogs during Media Encoder log tailing.\n• Fixed Archive Vault Column Resizing null references."
      }
    ];
    this.updateHeaderAndHero(this.releases[0]);
  },

  updateHeaderAndHero(latest) {
    const versionStr = `v${latest.version}`;
    const announceEl = document.getElementById('announce-version');
    const heroTagEl = document.getElementById('hero-version-tag');
    const dlCardVerEl = document.getElementById('dl-card-version');
    const dlCardDateEl = document.getElementById('dl-card-date');
    const dlCardSizeEl = document.getElementById('dl-card-size');
    const dlHeroFilename = document.getElementById('hero-dl-filename');

    if (announceEl) announceEl.textContent = versionStr;
    if (heroTagEl) heroTagEl.textContent = versionStr;
    if (dlCardVerEl) dlCardVerEl.textContent = latest.version;
    if (dlCardDateEl) dlCardDateEl.textContent = latest.date || CONFIG.defaultReleaseDate;
    if (dlCardSizeEl) dlCardSizeEl.textContent = CONFIG.downloads.installer.size;
    if (dlHeroFilename) dlHeroFilename.textContent = `Uni Desk_Setup_V${latest.version}.exe`;
  },

  renderChangelog() {
    const container = document.getElementById('changelog-content');
    if (!container) return;

    if (!this.releases || this.releases.length === 0) {
      container.innerHTML = '<p class="text-muted">No release records available.</p>';
      return;
    }

    let itemsToDisplay = [];
    if (this.activeFilter === 'history') {
      itemsToDisplay = this.releases;
    } else {
      itemsToDisplay = [this.releases[0]];
    }

    // Apply search filter if active
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      itemsToDisplay = this.releases.filter(rel => {
        return (
          (rel.version && rel.version.toLowerCase().includes(q)) ||
          (rel.whats_new && rel.whats_new.toLowerCase().includes(q)) ||
          (rel.release_notes && rel.release_notes.toLowerCase().includes(q)) ||
          (rel.bugs_fixed && rel.bugs_fixed.toLowerCase().includes(q)) ||
          (rel.improvements && rel.improvements.toLowerCase().includes(q))
        );
      });
    }

    if (itemsToDisplay.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted)">
          <p>No changelog matches found for "${this.escapeHtml(this.searchQuery)}".</p>
        </div>
      `;
      return;
    }

    let html = '';
    itemsToDisplay.forEach((rel, idx) => {
      const isLatest = idx === 0;
      html += `
        <div class="release-entry">
          <div class="release-meta-bar">
            <div class="version-pill">
              <span>v${this.escapeHtml(rel.version)}</span>
              ${isLatest ? '<span class="release-tag-chip">LATEST PRODUCTION</span>' : ''}
            </div>
            <div class="release-date">${this.escapeHtml(rel.date || 'Release')}</div>
          </div>
      `;

      // Filter sections based on active tab
      if ((this.activeFilter === 'all' || this.activeFilter === 'whats_new' || this.activeFilter === 'history') && rel.whats_new) {
        html += `
          <div class="cl-section-block">
            <div class="cl-section-title">What's New &amp; Key Features</div>
            <ul class="cl-list">
              ${this.formatBulletPoints(rel.whats_new)}
            </ul>
          </div>
        `;
      }

      if ((this.activeFilter === 'all' || this.activeFilter === 'bugs_fixed' || this.activeFilter === 'history') && rel.bugs_fixed) {
        html += `
          <div class="cl-section-block">
            <div class="cl-section-title" style="color: #f87171;">Bug Fixes &amp; Stability</div>
            <ul class="cl-list">
              ${this.formatBulletPoints(rel.bugs_fixed)}
            </ul>
          </div>
        `;
      }

      if ((this.activeFilter === 'all' || this.activeFilter === 'improvements' || this.activeFilter === 'history') && rel.improvements) {
        html += `
          <div class="cl-section-block">
            <div class="cl-section-title" style="color: var(--accent-gold);">Improvements &amp; Architecture</div>
            <ul class="cl-list">
              ${this.formatBulletPoints(rel.improvements)}
            </ul>
          </div>
        `;
      }

      html += '</div>';
    });

    container.innerHTML = html;
  },

  formatBulletPoints(text) {
    if (!text) return '';
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Strip leading bullets or hyphens
        const cleaned = line.replace(/^[\s•\*\-\d\.\)]+/, '').trim();
        return `<li class="cl-item">${this.escapeHtml(cleaned)}</li>`;
      })
      .join('');
  },

  filterChangelog(filterName, btnElement) {
    this.activeFilter = filterName;
    document.querySelectorAll('.cl-tab').forEach(tab => tab.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    this.renderChangelog();
  },

  searchChangelog(query) {
    this.searchQuery = query.trim();
    this.renderChangelog();
  },

  triggerDownload(formatKey) {
    const item = CONFIG.downloads[formatKey] || CONFIG.downloads.installer;
    
    // Create hidden anchor element to initiate direct browser download
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Provide visual toast/notification
    console.log(`[UniDesk] Initiating download for ${item.fileName}`);
  },

  handleFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const studio = document.getElementById('user-studio').value.trim();
    const usage = document.getElementById('user-usage').value;
    const optIn = document.getElementById('user-optin-updates').checked;

    // Save lead capture locally
    const lead = {
      name,
      email,
      studio,
      usage,
      optIn,
      timestamp: new Date().toISOString()
    };

    try {
      const stored = JSON.parse(localStorage.getItem('unidesk_leads') || '[]');
      stored.push(lead);
      localStorage.setItem('unidesk_leads', JSON.stringify(stored));
    } catch (e) {
      console.warn('Could not store lead to localStorage:', e);
    }

    // Show success alert
    const successBanner = document.getElementById('form-success-banner');
    if (successBanner) {
      successBanner.style.display = 'flex';
      setTimeout(() => {
        successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }

    // Auto-trigger the executable download
    this.triggerDownload('installer');
  },

  copyChecksum() {
    const hash = CONFIG.downloads.installer.sha256;
    const btnText = document.getElementById('copy-status-text');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(hash).then(() => {
        if (btnText) {
          btnText.textContent = "Copied!";
          setTimeout(() => { btnText.textContent = "Copy Hash"; }, 2500);
        }
      });
    } else {
      // Fallback
      const input = document.createElement('textarea');
      input.value = hash;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      if (btnText) {
        btnText.textContent = "Copied!";
        setTimeout(() => { btnText.textContent = "Copy Hash"; }, 2500);
      }
    }
  },

  openMicrosoftStore(event) {
    event.preventDefault();
    // Try launching Microsoft Store app directly via Windows Protocol
    const deepLink = CONFIG.microsoftStore.deepLink;
    
    // Attempt deep link protocol, then fallback to web if needed
    window.location.href = deepLink;
    
    // Also provide fallback information modal after short delay
    setTimeout(() => {
      this.openStoreGuideModal();
    }, 1200);
  },

  openStoreGuideModal() {
    const modal = document.getElementById('store-guide-modal');
    if (modal) modal.classList.add('active');
  },

  closeStoreGuideModal() {
    const modal = document.getElementById('store-guide-modal');
    if (modal) modal.classList.remove('active');
  },

  handleModalBackdrop(event) {
    if (event.target.id === 'store-guide-modal') {
      this.closeStoreGuideModal();
    }
  },

  toggleFaq(itemElement) {
    itemElement.classList.toggle('open');
  },

  setupListeners() {
    // ESC key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeStoreGuideModal();
      }
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  UniDeskApp.init();
});
