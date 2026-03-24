# 🐾 Possum Printer Card

A Home Assistant Lovelace card that shows your printer's ink and toner levels as smooth animated circular progress rings — with offline detection, a status pill, and tap-to-inspect popups.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
![HA Version](https://img.shields.io/badge/HA-2023.1%2B-blue?style=for-the-badge)

---

## ✨ Features

- **Four ink/toner rings** — Black, Cyan, Magenta, and Yellow progress arcs with animated glow and smooth arc transitions
- **Status pill** — shows Idle, Printing, Ready, Sleep, Error, and more with a matching colour-coded dot
- **Offline detection** — all rings grey out and display *Offline* when the printer is unavailable
- **Tap a ring** — opens a polished popup with level badge (Good / Running Low / Replace Soon), entity attributes, and last-updated time
- **Long-press a ring** — opens the native Home Assistant More Info dialog for that entity
- **Tap the status pill or printer name** — opens a detailed printer status popup
- **Optional friendly name** — displayed in the card header
- **Full visual editor** — smart entity detection, per-ink colour pickers, hex input, and background opacity slider

---

## 📸 Preview

<p align="center">
  <img src="preview1.png" alt="Possum Printer Card — normal view" width="380">
  &nbsp;&nbsp;
  <img src="preview2.png" alt="Possum Printer Card — ink popup" width="380">
</p>

<p align="center">
  <img src="preview3.png" alt="Possum Printer Card — status popup" width="380">
  &nbsp;&nbsp;
  <img src="preview4.png" alt="Possum Printer Card — offline state" width="380">
</p>

---

## 🚀 Installation

### Via HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=possum-printer-card&category=plugin)

1. Click the button above, or open HACS → **Frontend** → **⋮** → **Custom repositories**
2. Add `https://github.com/jamesmcginnis/possum-printer-card` as a **Lovelace** repository
3. Find **Possum Printer Card** and click **Download**
4. Reload your browser

### Manual

1. Download `possum-printer-card.js` from the [latest release](https://github.com/jamesmcginnis/possum-printer-card/releases/latest)
2. Copy it to `/config/www/possum-printer-card.js`
3. In Home Assistant, go to **Settings → Dashboards → Resources** and add:
   ```
   URL:  /local/possum-printer-card.js
   Type: JavaScript module
   ```
4. Reload your browser

---

## ⚙️ Configuration

### Visual Editor

The card ships with a full visual editor. Open any Lovelace dashboard, click **Add Card**, search for **Possum Printer Card**, and configure everything without touching YAML.

The editor automatically detects likely printer entities and ink/toner sensors, surfacing them at the top of each dropdown with a ★.

### YAML

```yaml
type: custom:possum-printer-card
printer_entity: sensor.my_printer_status
ink_black_entity: sensor.my_printer_black_ink
ink_cyan_entity: sensor.my_printer_cyan_ink
ink_magenta_entity: sensor.my_printer_magenta_ink
ink_yellow_entity: sensor.my_printer_yellow_ink
friendly_name: Office Printer
show_name: true
card_bg: "#1c1c1e"
card_bg_opacity: 80
text_color: "#ffffff"
ink_black_color: "#000000"
ink_cyan_color: "#00ffff"
ink_magenta_color: "#ff00ff"
ink_yellow_color: "#ffff00"
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `printer_entity` | `string` | — | Entity ID for printer status (any domain) |
| `ink_black_entity` | `string` | — | Sensor entity for black / K ink level (0–100) |
| `ink_cyan_entity` | `string` | — | Sensor entity for cyan / C ink level (0–100) |
| `ink_magenta_entity` | `string` | — | Sensor entity for magenta / M ink level (0–100) |
| `ink_yellow_entity` | `string` | — | Sensor entity for yellow / Y ink level (0–100) |
| `friendly_name` | `string` | `"Printer"` | Name shown in the card header |
| `show_name` | `boolean` | `true` | Show or hide the friendly name |
| `card_bg` | `string` | `#1c1c1e` | Card background colour (hex) |
| `card_bg_opacity` | `number` | `80` | Background opacity 0–100 |
| `text_color` | `string` | `#ffffff` | Primary text colour |
| `ink_black_color` | `string` | `#000000` | Ring colour for black ink |
| `ink_cyan_color` | `string` | `#00ffff` | Ring colour for cyan ink |
| `ink_magenta_color` | `string` | `#ff00ff` | Ring colour for magenta ink |
| `ink_yellow_color` | `string` | `#ffff00` | Ring colour for yellow ink |

---

## 🎨 Ink Ring Interactions

| Action | Result |
|---|---|
| **Tap** a ring | Opens a custom info popup for that ink colour |
| **Long-press** a ring | Opens the native HA More Info dialog |
| **Tap** the status pill | Opens printer status popup |
| **Tap** the printer name | Opens printer status popup |

---

## 🖨️ Supported Printer Integrations

Any integration that exposes ink or toner levels as sensor entities with a numeric state (0–100) will work, including:

- [Brother Printer](https://www.home-assistant.io/integrations/brother/)
- [IPP (Internet Printing Protocol)](https://www.home-assistant.io/integrations/ipp/)
- Custom SNMP/REST sensors

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">Made with 🐾 by <a href="https://github.com/jamesmcginnis">jamesmcginnis</a></p>
