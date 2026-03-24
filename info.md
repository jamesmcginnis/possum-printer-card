# 🐾 Possum Printer Card

A Home Assistant Dashboard card that displays printer ink and toner levels as smooth animated circular progress rings — with smart plug control, boot-state feedback, offline detection, and tap-to-inspect popups.

---

<p align="center">
  <img src="https://raw.githubusercontent.com/jamesmcginnis/possum-printer-card/main/preview1.png" alt="Possum Printer Card preview" width="380">
  &nbsp;
  <img src="https://raw.githubusercontent.com/jamesmcginnis/possum-printer-card/main/preview2.png" alt="Possum Printer Card popup" width="380">
</p>

---

## ✨ What it does

- **Four animated rings** showing Black, Cyan, Magenta, and Yellow ink/toner levels with a breathing glow effect
- **Status pill** — Idle, Printing, Ready, Sleep, Error — with a colour-coded dot
- **Offline mode** — all rings grey out and show `--` when the printer is unavailable
- **Smart plug control** — link any `switch.*` entity to the status pill; tap to power the printer on when Offline or off when Idle
- **Boot flash** — after powering on, the pill flashes amber *Starting…* until the printer comes back online, so you always know the command worked
- **Tap a ring** for a detailed popup: level badge, entity attributes, and last-updated time
- **Long-press a ring** to open the native Home Assistant More Info panel
- **Tap the status pill or printer name** for a full printer status popup
- **Visual editor** with smart entity detection — printers, ink sensors, and compatible smart plugs all surfaced automatically with ★ suggestions

---

## 🔌 Smart Plug Control

Enable the smart plug option in the visual editor and link any switch or plug entity. The status pill then acts as a contextual power button:

| Pill state | Tap action |
|---|---|
| **Offline** | Turns plug **on** — pill flashes amber *Starting…* until printer responds |
| **Idle** | Turns plug **off** — brief *Turning off…* confirmation |
| Printing / Ready / Error / other | Opens the status info popup |

Works with Shelly, Tasmota, TP-Link Kasa, Sonoff, Wemo, IKEA, Philips Hue, and any other `switch.*` entity.

---

## 🚀 Quick Start

After downloading through HACS, add the resource and drop the card into your dashboard via the UI or YAML:

```yaml
type: custom:possum-printer-card
printer_entity: sensor.my_printer_status
ink_black_entity: sensor.my_printer_black_ink
ink_cyan_entity: sensor.my_printer_cyan_ink
ink_magenta_entity: sensor.my_printer_magenta_ink
ink_yellow_entity: sensor.my_printer_yellow_ink
friendly_name: Office Printer
smart_plug_enabled: true
smart_plug_entity: switch.printer_plug
```

---

## ➕ Add to Home Assistant

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=possum-printer-card&category=plugin">
    <img
      src="https://my.home-assistant.io/badges/hacs_repository.svg"
      alt="Open your Home Assistant instance and open a repository inside the Home Assistant Community Store."
      style="height:48px;"
    />
  </a>
</p>

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=possum-printer-card&category=plugin">
 

---
