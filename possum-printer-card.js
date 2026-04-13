/**
 * Possum Printer Card
 * Displays printer ink/toner levels as circular progress rings with status information.
 * For Home Assistant — https://github.com/jamesmcginnis/possum-printer-card
 */

// ═══════════════════════════════════════════════════════════════════
//  CARD
// ═══════════════════════════════════════════════════════════════════

class PossumPrinterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._longPressTimers    = {};
    this._longPressFired     = {};
    this._popupOverlay       = null;
    this._pillFlashState     = null;   // 'on' | 'off' | null
    this._pillFlashInterval  = null;
  }

  static getConfigElement() {
    return document.createElement('possum-printer-card-editor');
  }

  static getStubConfig() {
    return {
      printer_entity:       '',
      ink_black_entity:     '',
      ink_cyan_entity:      '',
      ink_magenta_entity:   '',
      ink_yellow_entity:    '',
      friendly_name:        '',
      show_name:            true,
      card_bg:              '#1c1c1e',
      card_bg_opacity:      80,
      text_color:           '#ffffff',
      ink_black_color:      '#000000',
      ink_cyan_color:       '#00ffff',
      ink_magenta_color:    '#ff00ff',
      ink_yellow_color:     '#ffff00',
      pct_text_color:       '#ffffff',
      smart_plug_enabled:   false,
      smart_plug_entity:    '',
    };
  }

  setConfig(config) {
    this._config = { ...PossumPrinterCard.getStubConfig(), ...config };
    if (this.shadowRoot.innerHTML) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) this._render();
    else this._updateCard();
  }

  connectedCallback() {}
  disconnectedCallback() { this._stopPillFlash(); }

  // ── Render ─────────────────────────────────────────────────────────

  _render() {
    if (!this._config) return;
    const cfg  = this._config;
    const circ = 2 * Math.PI * 34;

    const hexBg = cfg.card_bg || '#1c1c1e';
    let r = 28, g = 28, b = 30, op = (parseInt(cfg.card_bg_opacity) || 80) / 100;
    try {
      r = parseInt(hexBg.slice(1,3),16);
      g = parseInt(hexBg.slice(3,5),16);
      b = parseInt(hexBg.slice(5,7),16);
      // 8-digit hex (#rrggbbaa) — alpha channel overrides the opacity slider
      if (/^#[0-9a-fA-F]{8}$/.test(hexBg)) {
        op = parseInt(hexBg.slice(7,9),16) / 255;
      }
    } catch(e) {}
    const bgCss = `rgba(${r},${g},${b},${op.toFixed(3)})`;
    const tc    = cfg.text_color || '#ffffff';

    const INK = [
      { key: 'black',   label: 'Black',   colorKey: 'ink_black_color',   def: '#000000' },
      { key: 'cyan',    label: 'Cyan',    colorKey: 'ink_cyan_color',    def: '#00ffff' },
      { key: 'magenta', label: 'Magenta', colorKey: 'ink_magenta_color', def: '#ff00ff' },
      { key: 'yellow',  label: 'Yellow',  colorKey: 'ink_yellow_color',  def: '#ffff00' },
    ];

    const showName = cfg.show_name !== false;

    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :host { display: block; }

        ha-card {
          background: ${bgCss} !important;
          backdrop-filter: blur(40px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(40px) saturate(180%) !important;
          color: ${tc} !important;
          border-radius: 20px !important;
          border: 1px solid rgba(255,255,255,0.11) !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.45) !important;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
        }

        .pp-inner {
          padding: 14px 16px 18px;
        }

        /* ── Header ───────────────────────────────── */
        .pp-header {
          display: flex;
          align-items: center;
          justify-content: ${showName ? 'space-between' : 'flex-end'};
          margin-bottom: 14px;
          gap: 8px;
          min-height: 28px;
        }

        .pp-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.80);
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
          letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .pp-title:hover { color: rgba(255,255,255,1); }

        .pp-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 11px 4px 7px;
          border-radius: 20px;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.14);
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s, border-color 0.3s;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.80);
          letter-spacing: 0.04em;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pp-status-pill:hover { background: rgba(255,255,255,0.15); }
        .pp-status-pill:active { background: rgba(255,255,255,0.18); }

        .pp-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
          flex-shrink: 0;
          transition: background 0.35s;
        }

        /* ── Rings row ────────────────────────────── */
        .pp-rings {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          gap: 2px;
        }

        .pp-ink-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          flex: 1;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          position: relative;
        }

        .pp-ring-block {
          position: relative;
          width: 70px;
          height: 70px;
        }

        .pp-ring-block svg {
          display: block;
        }

        .pp-ring-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .pp-pct {
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.5px;
          transition: color 0.4s;
        }

        .pp-pct-unit {
          font-size: 8px;
          font-weight: 500;
          color: rgba(255,255,255,0.32);
          line-height: 1;
          margin-top: 1px;
          transition: opacity 0.3s;
        }

        .pp-offline-text {
          font-size: 8px;
          font-weight: 700;
          color: rgba(255,255,255,0.28);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: none;
          line-height: 1.2;
          text-align: center;
        }

        .pp-colour-label {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255,255,255,0.38);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* Offline state */
        .pp-rings.is-offline .pp-pct,
        .pp-rings.is-offline .pp-pct-unit { display: none; }
        .pp-rings.is-offline .pp-offline-text { display: block; }

        /* Breathing glow on rings */
        @keyframes ppBreath {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.72; }
        }
        @keyframes ppGlow {
          0%, 100% { filter: drop-shadow(0 0 2px var(--pp-ring-color, rgba(255,255,255,0.2))); }
          50%       { filter: drop-shadow(0 0 6px var(--pp-ring-color, rgba(255,255,255,0.2))); }
        }
        .pp-ring-block {
          animation: ppBreath 3.5s ease-in-out infinite, ppGlow 3.5s ease-in-out infinite;
        }
        .pp-rings.is-offline .pp-ring-block {
          animation: none;
        }
      </style>

      <ha-card>
        <div class="pp-inner">

          <!-- Header -->
          <div class="pp-header">
            ${showName ? `<span class="pp-title" id="pp-title">${cfg.friendly_name || 'Printer'}</span>` : ''}
            <div class="pp-status-pill" id="pp-status-pill">
              <span class="pp-status-dot" id="pp-status-dot"></span>
              <span id="pp-status-text">--</span>
            </div>
          </div>

          <!-- Ink rings -->
          <div class="pp-rings" id="pp-rings">
            ${INK.map(ink => {
              const color = cfg[ink.colorKey] || ink.def;
              return `
              <div class="pp-ink-col" id="pp-ink-col-${ink.key}" data-ink="${ink.key}">
                <div class="pp-ring-block" style="--pp-ring-color:${color}">
                  <svg viewBox="0 0 88 88" width="70" height="70">
                    <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5.5"/>
                    <circle id="pp-arc-${ink.key}" cx="44" cy="44" r="34" fill="none"
                      stroke="${color}"
                      stroke-width="5.5"
                      stroke-linecap="round"
                      style="stroke-dasharray:${circ.toFixed(2)};stroke-dashoffset:${circ.toFixed(2)};
                             transform:rotate(-90deg);transform-origin:44px 44px;
                             transition:stroke-dashoffset 0.9s cubic-bezier(0.34,1,0.64,1),stroke 0.4s ease;"/>
                  </svg>
                  <div class="pp-ring-center">
                    <span class="pp-pct" id="pp-pct-${ink.key}" style="color:${cfg.pct_text_color || '#ffffff'}">--</span>
                    <span class="pp-pct-unit">%</span>
                    <span class="pp-offline-text">--</span>
                  </div>
                </div>
                <span class="pp-colour-label">${ink.label}</span>
              </div>`;
            }).join('')}
          </div>

        </div>
      </ha-card>`;

    this._setupInteractions();
    this._updateCard();
  }

  // ── Update ─────────────────────────────────────────────────────────

  _updateCard() {
    if (!this._hass || !this._config) return;
    const cfg  = this._config;
    const hass = this._hass;
    const root = this.shadowRoot;
    const circ = 2 * Math.PI * 34;

    const INK = [
      { key: 'black',   entityKey: 'ink_black_entity',   colorKey: 'ink_black_color',   def: '#000000' },
      { key: 'cyan',    entityKey: 'ink_cyan_entity',    colorKey: 'ink_cyan_color',    def: '#00ffff' },
      { key: 'magenta', entityKey: 'ink_magenta_entity', colorKey: 'ink_magenta_color', def: '#ff00ff' },
      { key: 'yellow',  entityKey: 'ink_yellow_entity',  colorKey: 'ink_yellow_color',  def: '#ffff00' },
    ];

    // ── Ink availability helpers (used to detect boot/shutdown completion) ──
    const configuredInkEntities = [
      cfg.ink_black_entity, cfg.ink_cyan_entity,
      cfg.ink_magenta_entity, cfg.ink_yellow_entity,
    ].filter(Boolean);

    // At least one ink entity has a valid numeric reading → printer is up
    const inkAvailable = configuredInkEntities.length > 0 &&
      configuredInkEntities.some(id => {
        const s = hass.states[id]?.state;
        return s && !['unavailable','unknown'].includes(s) && !isNaN(parseFloat(s));
      });

    // Every configured ink entity is unavailable/unknown/missing → printer is down
    const inkAllUnavailable = configuredInkEntities.length === 0 ||
      configuredInkEntities.every(id => {
        const s = hass.states[id]?.state;
        return !s || ['unavailable','unknown'].includes(s) || isNaN(parseFloat(s));
      });

    // Every configured ink entity has a valid numeric reading → all rings are showing
    const inkAllAvailable = configuredInkEntities.length > 0 &&
      configuredInkEntities.every(id => {
        const s = hass.states[id]?.state;
        return s && !['unavailable','unknown'].includes(s) && !isNaN(parseFloat(s));
      });

    // ── Printer status pill ──
    const printerStateObj = cfg.printer_entity ? hass.states[cfg.printer_entity] : null;
    const statusRaw  = printerStateObj?.state || '';
    const statusInfo = this._getStatusInfo(statusRaw);
    const isOffline  = !!cfg.printer_entity &&
      (!printerStateObj || ['unavailable','unknown'].includes(statusRaw) || statusRaw.toLowerCase() === 'offline');

    // Resolve flash state: stop when the expected condition is met
    // 'on'  — wait until ALL ink entities are showing values (all rings populated)
    if (this._pillFlashState === 'on'  && inkAllAvailable)    this._stopPillFlash();
    if (this._pillFlashState === 'off' && inkAllUnavailable)  this._stopPillFlash();

    // Only update pill DOM when not mid-flash (flash loop owns those elements)
    if (!this._pillFlashState) {
      const statusTextEl = root.getElementById('pp-status-text');
      const statusDotEl  = root.getElementById('pp-status-dot');
      const statusPillEl = root.getElementById('pp-status-pill');
      if (statusTextEl) statusTextEl.textContent = statusInfo.label;
      if (statusDotEl)  statusDotEl.style.background = statusInfo.dotColor;
      if (statusPillEl) statusPillEl.style.borderColor = `${statusInfo.color}66`;
    }

    // ── Offline class on rings container ──
    const ringsEl = root.getElementById('pp-rings');
    if (ringsEl) ringsEl.classList.toggle('is-offline', isOffline);

    // ── Individual ink rings ──
    INK.forEach(ink => {
      const entityId  = cfg[ink.entityKey];
      const ringColor = cfg[ink.colorKey] || ink.def;
      const offColor  = 'rgba(255,255,255,0.18)';
      const dispColor = isOffline ? offColor : ringColor;

      const arcEl  = root.getElementById(`pp-arc-${ink.key}`);
      const pctEl  = root.getElementById(`pp-pct-${ink.key}`);
      const blkEl  = root.querySelector(`#pp-ink-col-${ink.key} .pp-ring-block`);

      let pct = null;
      if (!isOffline && entityId && hass.states[entityId]) {
        const n = parseFloat(hass.states[entityId].state);
        if (!isNaN(n)) pct = Math.min(100, Math.max(0, n));
      }

      if (arcEl) {
        arcEl.style.stroke = dispColor;
        if (isOffline) {
          arcEl.style.strokeDashoffset = (circ * 0.72).toFixed(2);
        } else if (pct !== null) {
          arcEl.style.strokeDashoffset = (circ * (1 - pct / 100)).toFixed(2);
        } else {
          arcEl.style.strokeDashoffset = circ.toFixed(2);
        }
      }

      if (pctEl) {
        pctEl.textContent = pct !== null ? Math.round(pct) : '--';
        pctEl.style.color = isOffline ? 'rgba(255,255,255,0.18)' : (cfg.pct_text_color || '#ffffff');
      }

      if (blkEl) {
        blkEl.style.setProperty('--pp-ring-color', dispColor);
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _getStatusInfo(state) {
    if (!state) return { label: '--', color: 'rgba(255,255,255,0.3)', dotColor: 'rgba(255,255,255,0.22)' };
    const s = state.toLowerCase();
    if (['unavailable','unknown','offline'].includes(s))
      return { label: 'Offline',    color: 'rgba(255,255,255,0.28)', dotColor: 'rgba(255,255,255,0.2)' };
    if (['printing','printing_paused'].includes(s))
      return { label: 'Printing',   color: '#34C759', dotColor: '#34C759' };
    if (['ready','online'].includes(s))
      return { label: 'Ready',      color: '#34C759', dotColor: '#34C759' };
    if (s === 'idle')
      return { label: 'Idle',       color: 'rgba(255,255,255,0.65)', dotColor: '#999' };
    if (['processing','warming_up','initializing'].includes(s))
      return { label: 'Processing', color: '#007AFF', dotColor: '#007AFF' };
    if (['error','stopped','jam','cover_open'].includes(s))
      return { label: s === 'jam' ? 'Paper Jam' : s === 'cover_open' ? 'Cover Open' : 'Error', color: '#FF3B30', dotColor: '#FF3B30' };
    if (['sleep','sleeping','standby','power_save'].includes(s))
      return { label: 'Sleep',      color: '#FF9500', dotColor: '#FF9500' };
    if (s === 'cancelled')
      return { label: 'Cancelled',  color: '#FF9500', dotColor: '#FF9500' };
    const fmt = state.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return { label: fmt, color: 'rgba(255,255,255,0.65)', dotColor: '#999' };
  }

  _timeAgo(isoStr) {
    if (!isoStr) return '--';
    const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    if (mins < 1440) return `${Math.floor(mins/60)}h ago`;
    return `${Math.floor(mins/1440)}d ago`;
  }

  // ── Interactions ───────────────────────────────────────────────────

  _setupInteractions() {
    const root     = this.shadowRoot;
    const INK_KEYS = ['black', 'cyan', 'magenta', 'yellow'];

    INK_KEYS.forEach(key => {
      const col = root.getElementById(`pp-ink-col-${key}`);
      if (!col) return;

      this._longPressTimers[key] = null;
      this._longPressFired[key]  = false;

      const startPress = () => {
        this._longPressFired[key] = false;
        this._longPressTimers[key] = setTimeout(() => {
          this._longPressFired[key] = true;
          const entityId = this._config[`ink_${key}_entity`];
          if (entityId) this._fireMoreInfo(entityId);
        }, 600);
      };
      const cancelPress = () => clearTimeout(this._longPressTimers[key]);

      col.addEventListener('mousedown',   startPress);
      col.addEventListener('touchstart',  startPress, { passive: true });
      col.addEventListener('mouseup',     cancelPress);
      col.addEventListener('mouseleave',  cancelPress);
      col.addEventListener('touchend',    cancelPress);
      col.addEventListener('touchcancel', cancelPress);
      col.addEventListener('click', () => {
        if (!this._longPressFired[key]) this._openInkPopup(key);
      });
    });

    // Status pill click
    const pill = root.getElementById('pp-status-pill');
    if (pill) pill.addEventListener('click', () => this._handlePillClick());

    // Title click
    const title = root.getElementById('pp-title');
    if (title) title.addEventListener('click', () => this._openStatusPopup());
  }

  _handlePillClick() {
    const cfg     = this._config;
    const hass    = this._hass;
    const plugId  = cfg.smart_plug_entity;
    const enabled = cfg.smart_plug_enabled;

    if (!enabled || !plugId) {
      this._openStatusPopup();
      return;
    }

    const printerStateObj = cfg.printer_entity ? hass?.states[cfg.printer_entity] : null;
    const statusRaw = (printerStateObj?.state || '').toLowerCase();
    const isOffline = !printerStateObj ||
      ['unavailable', 'unknown', 'offline'].includes(statusRaw);

    if (isOffline) {
      // Printer is off — confirm before turning smart plug ON
      this._openPlugConfirmPopup('on');
    } else if (statusRaw === 'idle') {
      // Printer is idle — confirm before turning smart plug OFF
      this._openPlugConfirmPopup('off');
    } else {
      // Any other state — just show the info popup
      this._openStatusPopup();
    }
  }

  _openPlugConfirmPopup(mode) {
    // mode: 'on' | 'off'
    const cfg      = this._config;
    const hass     = this._hass;
    const plugId   = cfg.smart_plug_entity;
    const name     = cfg.friendly_name || 'Printer';

    const isTurningOn = mode === 'on';
    const accentColor = isTurningOn ? '#34C759' : '#FF9500';
    const iconEmoji   = isTurningOn ? '🖨️' : '⚡';

    const titleText   = isTurningOn ? 'Turn On Printer?' : 'Turn Off Printer?';
    const messageText = isTurningOn
      ? `Ready to wake up ${name}? The printer will power on and warm up — this may take a moment.`
      : `Done printing? Turning off ${name} will cut power to the smart plug and save energy.`;
    const confirmLabel = isTurningOn ? 'Yes, Turn On' : 'Yes, Turn Off';
    const cancelLabel  = 'Cancel';

    const popup = this._createPopupBase(isTurningOn ? 'Power On' : 'Power Off');
    if (!popup) return;

    // Hero icon + title
    const hero = document.createElement('div');
    hero.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:18px;';
    hero.innerHTML = `
      <div style="width:56px;height:56px;border-radius:16px;background:${accentColor}1a;border:1.5px solid ${accentColor}44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:26px;">
        ${iconEmoji}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.2;margin-bottom:6px;">${titleText}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.50);line-height:1.4;">${messageText}</div>
      </div>`;
    popup.appendChild(hero);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:20px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.cssText = `
      flex:1;padding:12px 0;border-radius:14px;border:1px solid rgba(255,255,255,0.15);
      background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.70);
      font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;
      transition:background 0.15s;`;
    cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = 'rgba(255,255,255,0.14)'; });
    cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'rgba(255,255,255,0.08)'; });
    cancelBtn.addEventListener('click', () => this._closePopup());

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = confirmLabel;
    confirmBtn.style.cssText = `
      flex:1;padding:12px 0;border-radius:14px;border:1.5px solid ${accentColor}66;
      background:${accentColor}22;color:${accentColor};
      font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
      transition:background 0.15s,border-color 0.15s;`;
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.background    = `${accentColor}38`;
      confirmBtn.style.borderColor   = `${accentColor}99`;
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.background    = `${accentColor}22`;
      confirmBtn.style.borderColor   = `${accentColor}66`;
    });
    confirmBtn.addEventListener('click', () => {
      this._closePopup();
      if (isTurningOn) {
        hass.callService('homeassistant', 'turn_on', { entity_id: plugId });
        this._startPillFlash('on');
      } else {
        hass.callService('homeassistant', 'turn_off', { entity_id: plugId });
        this._startPillFlash('off');
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    popup.appendChild(btnRow);
  }

  _startPillFlash(mode) {
    // mode: 'on' (powering up) | 'off' (powering down)
    this._stopPillFlash();
    this._pillFlashState = mode;

    const root   = this.shadowRoot;
    const textEl = root.getElementById('pp-status-text');
    const dotEl  = root.getElementById('pp-status-dot');
    const pillEl = root.getElementById('pp-status-pill');
    if (!textEl || !dotEl || !pillEl) return;

    const LABEL  = mode === 'on' ? 'Powering On' : 'Powering Off';
    const YELLOW = '#FF9500';
    let flash    = true;

    const apply = () => {
      if (!this._pillFlashState) return;
      textEl.textContent       = LABEL;
      dotEl.style.background   = flash ? YELLOW : 'rgba(255,255,255,0.15)';
      pillEl.style.borderColor = flash ? `${YELLOW}88` : 'rgba(255,255,255,0.08)';
      pillEl.style.color       = flash ? YELLOW : 'rgba(255,255,255,0.30)';
      flash = !flash;
    };

    apply();
    this._pillFlashInterval = setInterval(apply, 600);
  }

  _stopPillFlash() {
    if (this._pillFlashInterval) {
      clearInterval(this._pillFlashInterval);
      this._pillFlashInterval = null;
    }
    this._pillFlashState = null;

    // Clear inline styles so _updateCard can take over cleanly
    const root   = this.shadowRoot;
    const pillEl = root.getElementById('pp-status-pill');
    if (pillEl) {
      pillEl.style.color       = '';
      pillEl.style.borderColor = '';
    }
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      bubbles: true, composed: true, detail: { entityId }
    }));
  }

  // ── Popups ─────────────────────────────────────────────────────────

  _closePopup() {
    if (!this._popupOverlay) return;
    const ov = this._popupOverlay;
    ov.style.transition = 'opacity 0.18s ease';
    ov.style.opacity = '0';
    setTimeout(() => { ov.parentNode?.removeChild(ov); }, 185);
    this._popupOverlay = null;
  }

  _createPopupBase(titleText) {
    if (this._popupOverlay) return null;

    const cfg   = this._config;
    const hexBg = cfg.card_bg || '#1c1c1e';
    let r = 22, g = 22, b = 24;
    try {
      r = Math.max(0, parseInt(hexBg.slice(1,3),16) - 8);
      g = Math.max(0, parseInt(hexBg.slice(3,5),16) - 8);
      b = Math.max(0, parseInt(hexBg.slice(5,7),16) - 8);
    } catch(e) {}
    const op  = Math.min(1, (parseInt(cfg.card_bg_opacity)||80)/100 + 0.14);
    const bg  = `rgba(${r},${g},${b},${op})`;
    const tc  = cfg.text_color || '#ffffff';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:16px;
      background:rgba(0,0,0,0.6);
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      animation:ppFadeIn 0.2s ease;`;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes ppFadeIn  { from{opacity:0}                                            to{opacity:1} }
      @keyframes ppSlideUp { from{transform:translateY(20px) scale(0.97);opacity:0}    to{transform:none;opacity:1} }
      .pp-popup  { animation: ppSlideUp 0.28s cubic-bezier(0.34,1.28,0.64,1); }
      .pp-info-row { display:flex;align-items:flex-start;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07); }
      .pp-info-row:last-child { border-bottom:none; }
      .pp-info-label { font-size:12px;color:rgba(255,255,255,0.40);font-weight:500;flex-shrink:0;padding-right:14px; }
      .pp-info-value { font-size:12px;font-weight:600;color:rgba(255,255,255,0.88);text-align:right;word-break:break-all; }
      .pp-close-btn:hover { background:rgba(255,255,255,0.22)!important; }
      .pp-close-btn:active { background:rgba(255,255,255,0.28)!important; }
    `;
    overlay.appendChild(style);
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closePopup(); });

    const popup = document.createElement('div');
    popup.className = 'pp-popup';
    popup.style.cssText = `
      background:${bg};
      backdrop-filter:blur(40px) saturate(180%);
      -webkit-backdrop-filter:blur(40px) saturate(180%);
      border:1px solid rgba(255,255,255,0.14);
      border-radius:24px;
      box-shadow:0 24px 64px rgba(0,0,0,0.65);
      padding:20px;
      width:100%;max-width:380px;max-height:88vh;overflow-y:auto;
      font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;
      color:${tc};`;
    popup.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    popup.addEventListener('click', e => e.stopPropagation());

    // Header row
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
    hdr.innerHTML = `
      <span style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.40);">${titleText}</span>
      <button class="pp-close-btn" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.6);font-size:15px;padding:0;transition:background 0.15s;flex-shrink:0;font-family:inherit;">✕</button>`;
    hdr.querySelector('.pp-close-btn').addEventListener('click', () => this._closePopup());
    popup.appendChild(hdr);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    this._popupOverlay = overlay;
    return popup;
  }

  _addInfoRow(parent, label, value) {
    const row = document.createElement('div');
    row.className = 'pp-info-row';
    row.innerHTML = `<span class="pp-info-label">${label}</span><span class="pp-info-value">${String(value)}</span>`;
    parent.appendChild(row);
  }

  _openInkPopup(inkKey) {
    const INK_META = {
      black:   { label: 'Black',   entityKey: 'ink_black_entity',   colorKey: 'ink_black_color',   def: '#000000' },
      cyan:    { label: 'Cyan',    entityKey: 'ink_cyan_entity',    colorKey: 'ink_cyan_color',    def: '#00ffff' },
      magenta: { label: 'Magenta', entityKey: 'ink_magenta_entity', colorKey: 'ink_magenta_color', def: '#ff00ff' },
      yellow:  { label: 'Yellow',  entityKey: 'ink_yellow_entity',  colorKey: 'ink_yellow_color',  def: '#ffff00' },
    };

    const meta     = INK_META[inkKey];
    const cfg      = this._config;
    const hass     = this._hass;
    const entityId = cfg[meta.entityKey];
    const color    = cfg[meta.colorKey] || meta.def;
    const circ     = 2 * Math.PI * 34;

    const popup = this._createPopupBase(`${meta.label} Ink`);
    if (!popup) return;

    let pct      = null;
    let stateObj = entityId ? hass?.states[entityId] : null;
    if (stateObj) {
      const n = parseFloat(stateObj.state);
      if (!isNaN(n)) pct = Math.min(100, Math.max(0, n));
    }

    const arcOffset  = pct !== null ? (circ * (1 - pct / 100)).toFixed(2) : circ.toFixed(2);
    const levelLabel = pct === null ? 'No data'
      : pct >= 70 ? 'Good level'
      : pct >= 30 ? 'Running low'
      : 'Replace soon';
    const levelColor = pct === null ? 'rgba(255,255,255,0.35)'
      : pct >= 70 ? '#34C759'
      : pct >= 30 ? '#FF9500'
      : '#FF3B30';

    // Hero ring + label
    const hero = document.createElement('div');
    hero.style.cssText = 'display:flex;align-items:center;gap:18px;margin-bottom:20px;';
    hero.innerHTML = `
      <div style="position:relative;width:80px;height:80px;flex-shrink:0;">
        <svg viewBox="0 0 88 88" width="80" height="80" style="display:block;">
          <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5.5"/>
          <circle cx="44" cy="44" r="34" fill="none" stroke="${color}" stroke-width="5.5" stroke-linecap="round"
            style="stroke-dasharray:${circ.toFixed(2)};stroke-dashoffset:${arcOffset};transform:rotate(-90deg);transform-origin:44px 44px;"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span style="font-size:19px;font-weight:700;color:${cfg.pct_text_color || '#ffffff'};line-height:1;">${pct !== null ? Math.round(pct) : '--'}</span>
          <span style="font-size:9px;color:rgba(255,255,255,0.32);margin-top:1px;">%</span>
        </div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:8px;line-height:1;">${meta.label} Ink</div>
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.04em;background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44;">${levelLabel}</span>
      </div>`;
    popup.appendChild(hero);

    // Info rows
    const table = document.createElement('div');
    table.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);padding-top:4px;';
    popup.appendChild(table);

    if (stateObj) {
      const attrs = stateObj.attributes || {};
      if (attrs.friendly_name)     this._addInfoRow(table, 'Name', attrs.friendly_name);
      const unit = attrs.unit_of_measurement || '';
      this._addInfoRow(table, 'Level', pct !== null ? `${Math.round(pct)}${unit}` : stateObj.state);
      this._addInfoRow(table, 'Entity ID',    entityId);
      this._addInfoRow(table, 'Last Changed', this._timeAgo(stateObj.last_changed));
      this._addInfoRow(table, 'Last Updated', this._timeAgo(stateObj.last_updated));

      const skip = new Set(['friendly_name','unit_of_measurement','icon','device_class','state_class','restored']);
      Object.entries(attrs).forEach(([k, v]) => {
        if (skip.has(k)) return;
        if (typeof v === 'string' || typeof v === 'number') {
          this._addInfoRow(table, k.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()), v);
        }
      });
    } else {
      this._addInfoRow(table, 'Status', entityId ? 'Entity not found in Home Assistant' : 'No entity configured');
      if (entityId) this._addInfoRow(table, 'Entity ID', entityId);
    }
  }

  _openStatusPopup() {
    const cfg  = this._config;
    const hass = this._hass;
    const name = cfg.friendly_name || 'Printer';

    const popup = this._createPopupBase(name);
    if (!popup) return;

    const printerStateObj = cfg.printer_entity ? hass?.states[cfg.printer_entity] : null;
    const statusRaw  = printerStateObj?.state || '';
    const statusInfo = this._getStatusInfo(statusRaw);

    // Hero
    const hero = document.createElement('div');
    hero.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:20px;';
    hero.innerHTML = `
      <div style="width:52px;height:52px;border-radius:50%;background:${statusInfo.color}1a;border:2px solid ${statusInfo.color}55;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <div style="width:18px;height:18px;border-radius:50%;background:${statusInfo.dotColor};"></div>
      </div>
      <div>
        <div style="font-size:24px;font-weight:700;color:${statusInfo.color};line-height:1;margin-bottom:6px;">${statusInfo.label}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.38);">${name}</div>
      </div>`;
    popup.appendChild(hero);

    const table = document.createElement('div');
    table.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);padding-top:4px;';
    popup.appendChild(table);

    if (printerStateObj) {
      const attrs = printerStateObj.attributes || {};
      if (attrs.friendly_name) this._addInfoRow(table, 'Printer Name', attrs.friendly_name);
      this._addInfoRow(table, 'Status',       printerStateObj.state);
      this._addInfoRow(table, 'Entity ID',    cfg.printer_entity);
      this._addInfoRow(table, 'Last Changed', this._timeAgo(printerStateObj.last_changed));
      this._addInfoRow(table, 'Last Updated', this._timeAgo(printerStateObj.last_updated));

      const skip = new Set(['friendly_name','unit_of_measurement','icon','device_class','state_class','restored']);
      Object.entries(attrs).forEach(([k, v]) => {
        if (skip.has(k)) return;
        if (typeof v === 'string' || typeof v === 'number') {
          this._addInfoRow(table, k.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()), v);
        }
      });
    } else {
      this._addInfoRow(table, 'Status', cfg.printer_entity ? 'Entity not found in Home Assistant' : 'No printer entity configured');
      if (cfg.printer_entity) this._addInfoRow(table, 'Entity ID', cfg.printer_entity);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════════════

class PossumPrinterCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...PossumPrinterCard.getStubConfig(), ...config };
    if (this.shadowRoot.innerHTML) this.updateUI();
    else this.connectedCallback();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) this.connectedCallback();
  }

  connectedCallback() {
    if (!this._hass) return;
    this._buildEditor();
  }

  _updateConfig(key, value) {
    if (!this._config) return;
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config }, bubbles: true, composed: true
    }));
  }

  updateUI() {
    const root = this.shadowRoot;
    const cfg  = this._config;

    const setVal = (id, val) => { const el = root.getElementById(id); if (el) el.value = val ?? ''; };
    const setChk = (id, val) => { const el = root.getElementById(id); if (el) el.checked = !!val; };

    setVal('printer_entity',     cfg.printer_entity     || '');
    setVal('ink_black_entity',   cfg.ink_black_entity   || '');
    setVal('ink_cyan_entity',    cfg.ink_cyan_entity    || '');
    setVal('ink_magenta_entity', cfg.ink_magenta_entity || '');
    setVal('ink_yellow_entity',  cfg.ink_yellow_entity  || '');
    setVal('friendly_name',      cfg.friendly_name      || '');
    setVal('card_bg_opacity',    cfg.card_bg_opacity    ?? 80);
    setVal('smart_plug_entity',  cfg.smart_plug_entity  || '');
    setChk('show_name',          cfg.show_name !== false);
    setChk('smart_plug_enabled', cfg.smart_plug_enabled === true);

    const plugSection = root.getElementById('smart_plug_entity_row');
    if (plugSection) plugSection.style.display = cfg.smart_plug_enabled ? '' : 'none';

    const opLabel = root.getElementById('opacity-val');
    if (opLabel) opLabel.textContent = `${cfg.card_bg_opacity ?? 80}%`;

    for (const field of this._getColourFields()) {
      const card = root.querySelector(`.colour-card[data-key="${field.key}"]`);
      if (!card) continue;
      const val     = cfg[field.key] || field.default;
      const preview = card.querySelector('.colour-swatch-preview');
      const dot     = card.querySelector('.colour-dot');
      const hexIn   = card.querySelector('.colour-hex');
      const picker  = card.querySelector('input[type=color]');
      if (preview) preview.style.background = val;
      if (dot)     dot.style.background     = val;
      if (hexIn)   hexIn.value              = val;
      if (picker && /^#[0-9a-fA-F]{6}$/.test(val)) picker.value = val;
    }
  }

  _getColourFields() {
    return [
      { key: 'ink_black_color',   label: 'Black Ink',       desc: 'Ring colour for black / K',                                   default: '#000000', maxlen: 7 },
      { key: 'ink_cyan_color',    label: 'Cyan Ink',        desc: 'Ring colour for cyan / C',                                    default: '#00ffff', maxlen: 7 },
      { key: 'ink_magenta_color', label: 'Magenta Ink',     desc: 'Ring colour for magenta / M',                                 default: '#ff00ff', maxlen: 7 },
      { key: 'ink_yellow_color',  label: 'Yellow Ink',      desc: 'Ring colour for yellow / Y',                                  default: '#ffff00', maxlen: 7 },
      { key: 'pct_text_color',    label: 'Percentage Text', desc: 'Number shown inside each ring',                               default: '#ffffff', maxlen: 7 },
      { key: 'card_bg',           label: 'Card Background', desc: '#00000000 = glass transparent · 8-digit hex sets opacity e.g. #1c1c1e80', default: '#1c1c1e', maxlen: 9 },
      { key: 'text_color',        label: 'Text',            desc: 'Primary text colour',                                         default: '#ffffff', maxlen: 7 },
    ];
  }

  _buildEditor() {
    const hass = this._hass;
    const cfg  = this._config;

    // ── Smart entity detection ──────────────────────────────────────

    const allEntities = Object.keys(hass.states).sort();
    const allSensors  = allEntities.filter(e => e.startsWith('sensor.'));

    const getName = e => hass.states[e]?.attributes?.friendly_name || e;

    const scoreEntity = (id, friendlyName, keywords) => {
      const id2   = id.toLowerCase();
      const name2 = friendlyName.toLowerCase();
      return keywords.reduce((s, k) => s + (id2.includes(k) || name2.includes(k) ? 1 : 0), 0);
    };

    // Printer: broad — any entity type — look for printer brand / status keywords
    const printerKws = ['printer','print','epson','hp_','canon','brother','xerox','lexmark','ricoh','kyocera','oki','samsung_print'];
    const inkKws     = ['ink','toner','cartridge','level'];
    const blackKws   = [...inkKws, 'black','bk','_k_','mono','pigment'];
    const cyanKws    = [...inkKws, 'cyan','_c_','cb'];
    const magentaKws = [...inkKws, 'magenta','_m_','mag'];
    const yellowKws  = [...inkKws, 'yellow','_y_','yel'];
    const plugKws    = ['plug','socket','outlet','switch','power','tasmota','shelly','tp_link','kasa','sonoff','wemo','hue_plug','ikea_outlet','smart_plug'];

    // Score every entity for printer likelihood; keep those with score > 0 plus some numeric-looking ones
    const printerCandidates = allEntities
      .map(e => ({ e, score: scoreEntity(e, getName(e), printerKws) }))
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score || a.e.localeCompare(b.e))
      .slice(0, 15);

    const makeSensorCandidates = (kws) => allSensors
      .map(e => ({ e, score: scoreEntity(e, getName(e), kws) }))
      .sort((a,b) => b.score - a.score || a.e.localeCompare(b.e));

    const blackCandidates   = makeSensorCandidates(blackKws);
    const cyanCandidates    = makeSensorCandidates(cyanKws);
    const magentaCandidates = makeSensorCandidates(magentaKws);
    const yellowCandidates  = makeSensorCandidates(yellowKws);

    // Smart plug: switch.* and input_boolean.* domains, scored by plug keywords
    // Also boost anything whose name/id shares a word with the printer friendly name
    const printerName = (cfg.printer_entity ? (hass.states[cfg.printer_entity]?.attributes?.friendly_name || cfg.printer_entity) : '').toLowerCase();
    const allSwitches = allEntities.filter(e => e.startsWith('switch.') || e.startsWith('input_boolean.'));
    const plugCandidates = allSwitches
      .map(e => {
        const id2   = e.toLowerCase();
        const name2 = getName(e).toLowerCase();
        let score   = plugKws.reduce((s, k) => s + (id2.includes(k) || name2.includes(k) ? 1 : 0), 0);
        // Bonus if it shares a meaningful word with the printer name
        if (printerName) {
          printerName.split(/\W+/).filter(w => w.length > 3).forEach(w => {
            if (id2.includes(w) || name2.includes(w)) score += 2;
          });
        }
        return { e, score };
      })
      .sort((a, b) => b.score - a.score || a.e.localeCompare(b.e));

    // Auto-select if not yet configured
    const autoSelect = (cfgKey, candidates) => {
      if (!cfg[cfgKey] && candidates.length && candidates[0].score > 0) {
        cfg[cfgKey] = candidates[0].e;
        this._updateConfig(cfgKey, cfg[cfgKey]);
      }
    };
    autoSelect('printer_entity',     printerCandidates);
    autoSelect('ink_black_entity',   blackCandidates);
    autoSelect('ink_cyan_entity',    cyanCandidates);
    autoSelect('ink_magenta_entity', magentaCandidates);
    autoSelect('ink_yellow_entity',  yellowCandidates);
    // Don't auto-select smart plug — too risky to switch something on/off without explicit user choice

    // Build <option> HTML with suggested items first
    const buildOptions = (candidates, pool, selectedVal) => {
      const candSet   = new Set(candidates.map(c => c.e));
      const suggested = candidates.map(({ e, score }) => {
        const nm = getName(e);
        return `<option value="${e}" ${e === selectedVal ? 'selected' : ''}>${score > 0 ? '★ ' : ''}${nm} (${e})</option>`;
      }).join('');
      const rest = pool.filter(e => !candSet.has(e)).map(e => {
        const nm = getName(e);
        return `<option value="${e}" ${e === selectedVal ? 'selected' : ''}>${nm} (${e})</option>`;
      }).join('');
      const divider = suggested && rest ? `<option disabled>──────────────────</option>` : '';
      return `<option value="">— None —</option>${suggested}${divider}${rest}`;
    };

    const printerOpts = buildOptions(printerCandidates, allEntities, cfg.printer_entity     || '');
    const blackOpts   = buildOptions(blackCandidates,   allSensors,  cfg.ink_black_entity   || '');
    const cyanOpts    = buildOptions(cyanCandidates,    allSensors,  cfg.ink_cyan_entity    || '');
    const magentaOpts = buildOptions(magentaCandidates, allSensors,  cfg.ink_magenta_entity || '');
    const yellowOpts  = buildOptions(yellowCandidates,  allSensors,  cfg.ink_yellow_entity  || '');
    const plugOpts    = buildOptions(plugCandidates,    allSwitches, cfg.smart_plug_entity  || '');

    const COLOUR_FIELDS = this._getColourFields();

    // ── Build editor HTML ───────────────────────────────────────────
    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        .container { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 8px; }

        .section-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: #888; margin-bottom: 4px;
        }
        .card-block {
          background: var(--card-background-color, #1c1c1e);
          border: 1px solid rgba(128,128,128,0.18);
          border-radius: 12px; overflow: hidden;
        }
        .select-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
        .select-row label { font-size: 13px; font-weight: 600; color: var(--primary-text-color, #fff); }
        .hint { font-size: 11px; color: #888; margin-top: 1px; }

        .entity-search {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
          color: var(--primary-text-color, #fff);
          border: 1px solid rgba(128,128,128,0.2);
          border-radius: 8px 8px 0 0; border-bottom: none;
          padding: 8px 12px; font-size: 12px; width: 100%; outline: none; font-family: inherit;
        }
        .entity-search::placeholder { color: rgba(128,128,128,0.55); }
        .entity-search + select { border-radius: 0 0 8px 8px; }

        select, input[type="text"], input[type="number"] {
          width: 100%;
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
          color: var(--primary-text-color, #fff);
          border: 1px solid rgba(128,128,128,0.2);
          border-radius: 8px; padding: 9px 12px; font-size: 13px;
          -webkit-appearance: none; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
        }
        input[type="text"], input[type="number"] {
          background-image: none; padding-right: 12px; cursor: text;
        }

        /* Ink entity rows — coloured accent bar */
        .ink-select-row {
          padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;
          border-left: 4px solid transparent;
        }
        .ink-select-row label { font-size: 13px; font-weight: 600; color: var(--primary-text-color, #fff); }
        .ink-sep { height: 1px; background: rgba(128,128,128,0.12); }
        .ink-black   { border-left-color: #555; }
        .ink-cyan    { border-left-color: #00b8b8; }
        .ink-magenta { border-left-color: #c400c4; }
        .ink-yellow  { border-left-color: #b8a000; }

        /* Toggle switches */
        .toggle-list { display: flex; flex-direction: column; }
        .toggle-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px; border-bottom: 1px solid rgba(128,128,128,0.1); min-height: 52px;
        }
        .toggle-item:last-child { border-bottom: none; }
        .toggle-label  { font-size: 14px; font-weight: 500; flex: 1; padding-right: 12px; }
        .toggle-sub    { font-size: 11px; color: #888; margin-top: 1px; }
        .toggle-switch { position: relative; width: 51px; height: 31px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute; inset: 0; background: rgba(120,120,128,0.35);
          border-radius: 31px; transition: background 0.2s; cursor: pointer;
        }
        .toggle-slider::before {
          content: ''; position: absolute; height: 27px; width: 27px; left: 2px; bottom: 2px;
          background: #fff; border-radius: 50%; transition: transform 0.22s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .toggle-switch input:checked + .toggle-slider { background: #34C759; }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }

        /* Friendly name input */
        .input-row { padding: 0 16px 14px; }
        .input-row input {
          width: 100%; background: var(--secondary-background-color, rgba(0,0,0,0.06));
          color: var(--primary-text-color, #fff); border: 1px solid rgba(128,128,128,0.2);
          border-radius: 8px; padding: 9px 12px; font-size: 13px; outline: none; font-family: inherit;
          background-image: none;
        }
        .input-row input::placeholder { color: rgba(128,128,128,0.55); }

        /* ── Colour pickers — leopard style ── */
        .colour-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 10px;
        }
        .colour-card {
          border: 1px solid var(--divider-color, rgba(128,128,128,0.18));
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s;
          position: relative;
        }
        .colour-card:hover {
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
          border-color: var(--primary-color, #007AFF);
        }
        .colour-swatch {
          height: 44px; width: 100%;
          display: block; position: relative;
        }
        .colour-swatch input[type="color"] {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          opacity: 0; cursor: pointer; border: none; padding: 0;
        }
        .colour-swatch-preview { position: absolute; inset: 0; pointer-events: none; }
        .colour-swatch::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          opacity: 0.3; pointer-events: none;
        }
        .colour-info {
          padding: 6px 8px 7px;
          background: var(--card-background-color, #1c1c1e);
        }
        .colour-label {
          font-size: 11px; font-weight: 700;
          color: var(--primary-text-color, #fff); letter-spacing: 0.02em; margin-bottom: 1px;
        }
        .colour-desc {
          font-size: 10px; color: var(--secondary-text-color, #888);
          margin-bottom: 4px; line-height: 1.3;
        }
        .colour-hex-row { display: flex; align-items: center; gap: 4px; }
        .colour-dot {
          width: 12px; height: 12px; border-radius: 50%;
          border: 1px solid rgba(128,128,128,0.25); flex-shrink: 0;
        }
        .colour-hex {
          flex: 1; font-size: 11px; font-family: monospace;
          border: none; background: none;
          color: var(--secondary-text-color, #888);
          padding: 0; width: 0; min-width: 0;
        }
        .colour-hex:focus { outline: none; color: var(--primary-text-color, #fff); }
        .colour-edit-icon {
          opacity: 0; transition: opacity 0.15s;
          color: var(--secondary-text-color, #888); font-size: 13px; line-height: 1;
        }
        .colour-card:hover .colour-edit-icon { opacity: 1; }

        /* Opacity slider */
        .opacity-row {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px;
        }
        .opacity-row label { font-size: 13px; font-weight: 500; color: var(--primary-text-color, #fff); flex-shrink: 0; }
        .opacity-row input[type=range] { flex: 1; accent-color: var(--primary-color, #007AFF); }
        .opacity-val { font-size: 12px; color: #888; width: 38px; text-align: right; flex-shrink: 0; }
      </style>

      <div class="container">

        <!-- Printer Entity -->
        <div>
          <div class="section-title">Printer</div>
          <div class="card-block">
            <div class="select-row">
              <label for="printer_entity">Status Entity</label>
              <input class="entity-search" type="text" id="printer_search" placeholder="Search…">
              <select id="printer_entity">${printerOpts}</select>
              <span class="hint">★ = likely printer entities are listed first</span>
            </div>
          </div>
        </div>

        <!-- Ink / Toner Entities -->
        <div>
          <div class="section-title">Ink / Toner Level Sensors</div>
          <div class="card-block">

            <div class="ink-select-row ink-black">
              <label for="ink_black_entity">⬛ Black / K</label>
              <input class="entity-search" type="text" id="black_search" placeholder="Search sensors…">
              <select id="ink_black_entity">${blackOpts}</select>
            </div>
            <div class="ink-sep"></div>

            <div class="ink-select-row ink-cyan">
              <label for="ink_cyan_entity">🟦 Cyan / C</label>
              <input class="entity-search" type="text" id="cyan_search" placeholder="Search sensors…">
              <select id="ink_cyan_entity">${cyanOpts}</select>
            </div>
            <div class="ink-sep"></div>

            <div class="ink-select-row ink-magenta">
              <label for="ink_magenta_entity">🟪 Magenta / M</label>
              <input class="entity-search" type="text" id="magenta_search" placeholder="Search sensors…">
              <select id="ink_magenta_entity">${magentaOpts}</select>
            </div>
            <div class="ink-sep"></div>

            <div class="ink-select-row ink-yellow">
              <label for="ink_yellow_entity">🟨 Yellow / Y</label>
              <input class="entity-search" type="text" id="yellow_search" placeholder="Search sensors…">
              <select id="ink_yellow_entity">${yellowOpts}</select>
            </div>

          </div>
        </div>

        <!-- Display Options -->
        <div>
          <div class="section-title">Display</div>
          <div class="card-block">
            <div class="toggle-list">
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Show Printer Name</div>
                  <div class="toggle-sub">Display friendly name on the card</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="show_name" ${cfg.show_name !== false ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div class="input-row" id="friendly_name_row" style="${cfg.show_name !== false ? '' : 'display:none'}">
              <input type="text" id="friendly_name" placeholder="e.g. Office Printer" value="${cfg.friendly_name || ''}">
            </div>
          </div>
        </div>

        <!-- Smart Plug -->
        <div>
          <div class="section-title">Smart Plug</div>
          <div class="card-block">
            <div class="toggle-list">
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Enable Smart Plug Control</div>
                  <div class="toggle-sub">Tap pill to turn on/off when Idle or Offline</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="smart_plug_enabled" ${cfg.smart_plug_enabled ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div id="smart_plug_entity_row" style="${cfg.smart_plug_enabled ? '' : 'display:none'}">
              <div class="select-row" style="padding-top:0;">
                <label for="smart_plug_entity">Plug / Switch Entity</label>
                <input class="entity-search" type="text" id="plug_search" placeholder="Search switches…">
                <select id="smart_plug_entity">${plugOpts}</select>
                <span class="hint">★ = likely smart plugs listed first · switches &amp; input booleans only</span>
                <span class="hint" style="margin-top:2px;">Idle pill → turns plug <strong>off</strong> &nbsp;|&nbsp; Offline pill → turns plug <strong>on</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Colours -->
        <div>
          <div class="section-title">Colours</div>
          <div class="card-block">
            <div id="pp-colour-grid"></div>
          </div>
        </div>

        <!-- Opacity -->
        <div>
          <div class="section-title">Card Background Opacity</div>
          <div class="card-block">
            <div class="opacity-row">
              <label>Opacity</label>
              <input type="range" id="card_bg_opacity" min="0" max="100" value="${cfg.card_bg_opacity ?? 80}">
              <span class="opacity-val" id="opacity-val">${cfg.card_bg_opacity ?? 80}%</span>
            </div>
          </div>
        </div>

      </div>`;

    // ── Build colour picker cards (leopard style) ──────────────────
    const grid = this.shadowRoot.getElementById('pp-colour-grid');
    for (const field of COLOUR_FIELDS) {
      const savedVal  = cfg[field.key] || '';
      const swatchVal = savedVal || field.default;
      const pickerHex = /^#[0-9a-fA-F]{6}$/.test(swatchVal) ? swatchVal : swatchVal.substring(0, 7);

      const card = document.createElement('div');
      card.className   = 'colour-card';
      card.dataset.key = field.key;
      card.innerHTML = `
        <label class="colour-swatch">
          <div class="colour-swatch-preview" style="background:${swatchVal}"></div>
          <input type="color" value="${pickerHex}">
        </label>
        <div class="colour-info">
          <div class="colour-label">${field.label}</div>
          <div class="colour-desc">${field.desc}</div>
          <div class="colour-hex-row">
            <div class="colour-dot" style="background:${swatchVal}"></div>
            <input class="colour-hex" type="text" value="${savedVal}"
              maxlength="${field.maxlen}" placeholder="${field.default}" spellcheck="false">
            <span class="colour-edit-icon">✎</span>
          </div>
        </div>`;

      const picker  = card.querySelector('input[type=color]');
      const hexIn   = card.querySelector('.colour-hex');
      const preview = card.querySelector('.colour-swatch-preview');
      const dot     = card.querySelector('.colour-dot');

      const apply = val => {
        preview.style.background = val;
        dot.style.background     = val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) picker.value = val;
        hexIn.value = val;
        this._updateConfig(field.key, val);
      };

      picker.addEventListener('input',  () => apply(picker.value));
      picker.addEventListener('change', () => apply(picker.value));
      hexIn.addEventListener('input', () => {
        const v = hexIn.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{8}$/.test(v)) apply(v);
      });
      hexIn.addEventListener('blur', () => {
        const cur = this._config[field.key] || field.default;
        if (!/^#[0-9a-fA-F]{6,8}$/.test(hexIn.value.trim())) hexIn.value = cur;
      });
      hexIn.addEventListener('keydown', e => { if (e.key === 'Enter') hexIn.blur(); });

      grid.appendChild(card);
    }

    this._setupListeners();

    // ── Wire live search for each dropdown ─────────────────────────
    const root2 = this.shadowRoot;

    const wireSearch = (searchId, selectId, allData) => {
      const searchEl = root2.getElementById(searchId);
      const selectEl = root2.getElementById(selectId);
      if (!searchEl || !selectEl) return;

      searchEl.addEventListener('input', () => {
        const term    = searchEl.value.toLowerCase().trim();
        const current = selectEl.value;
        const matches = term
          ? allData.filter(d => d.id.toLowerCase().includes(term) || d.name.toLowerCase().includes(term))
          : allData;

        const suggested = matches.filter(d => d.suggested);
        const rest      = matches.filter(d => !d.suggested);
        const divider   = suggested.length && rest.length ? `<option disabled>──────────────────</option>` : '';

        selectEl.innerHTML = `<option value="">— None —</option>` +
          suggested.map(d => `<option value="${d.id}" ${d.id === current ? 'selected' : ''}>★ ${d.name} (${d.id})</option>`).join('') +
          divider +
          rest.map(d => `<option value="${d.id}" ${d.id === current ? 'selected' : ''}>${d.name} (${d.id})</option>`).join('');
      });
    };

    const makeData = (candidates, pool) => {
      const candSet   = new Set(candidates.map(c => c.e));
      const suggested = candidates.map(({ e, score }) => ({ id: e, name: getName(e), suggested: score > 0 }));
      const rest      = pool.filter(e => !candSet.has(e)).map(e => ({ id: e, name: getName(e), suggested: false }));
      return [...suggested, ...rest];
    };

    wireSearch('printer_search', 'printer_entity',     makeData(printerCandidates, allEntities));
    wireSearch('black_search',   'ink_black_entity',   makeData(blackCandidates,   allSensors));
    wireSearch('cyan_search',    'ink_cyan_entity',    makeData(cyanCandidates,    allSensors));
    wireSearch('magenta_search', 'ink_magenta_entity', makeData(magentaCandidates, allSensors));
    wireSearch('yellow_search',  'ink_yellow_entity',  makeData(yellowCandidates,  allSensors));
    wireSearch('plug_search',    'smart_plug_entity',  makeData(plugCandidates,    allSwitches));
  }

  _setupListeners() {
    const root = this.shadowRoot;
    const get  = id => root.getElementById(id);

    get('printer_entity').onchange     = e => this._updateConfig('printer_entity',     e.target.value);
    get('ink_black_entity').onchange   = e => this._updateConfig('ink_black_entity',   e.target.value);
    get('ink_cyan_entity').onchange    = e => this._updateConfig('ink_cyan_entity',    e.target.value);
    get('ink_magenta_entity').onchange = e => this._updateConfig('ink_magenta_entity', e.target.value);
    get('ink_yellow_entity').onchange  = e => this._updateConfig('ink_yellow_entity',  e.target.value);

    get('friendly_name').oninput = e => this._updateConfig('friendly_name', e.target.value);

    get('show_name').onchange = e => {
      this._updateConfig('show_name', e.target.checked);
      const nameRow = root.getElementById('friendly_name_row');
      if (nameRow) nameRow.style.display = e.target.checked ? '' : 'none';
    };

    get('smart_plug_entity').onchange = e => this._updateConfig('smart_plug_entity', e.target.value);

    get('smart_plug_enabled').onchange = e => {
      this._updateConfig('smart_plug_enabled', e.target.checked);
      const plugRow = root.getElementById('smart_plug_entity_row');
      if (plugRow) plugRow.style.display = e.target.checked ? '' : 'none';
    };

    get('card_bg_opacity').oninput = e => {
      const val = parseInt(e.target.value);
      root.getElementById('opacity-val').textContent = val + '%';
      this._updateConfig('card_bg_opacity', val);
    };
  }
}


// ── Registration ──────────────────────────────────────────────────

if (!customElements.get('possum-printer-card')) {
  customElements.define('possum-printer-card', PossumPrinterCard);
}
if (!customElements.get('possum-printer-card-editor')) {
  customElements.define('possum-printer-card-editor', PossumPrinterCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'possum-printer-card')) {
  window.customCards.push({
    type: 'possum-printer-card',
    name: 'Possum Printer Card',
    preview: true,
    description: 'Displays printer ink/toner levels as circular progress rings with status pill and popup details.',
  });
}
