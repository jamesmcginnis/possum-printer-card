# 🐾 Possum Printer Card

A Lovelace card for Home Assistant that displays printer ink and toner levels as smooth animated circular progress rings.

---

<p align="center">
  <img src="https://raw.githubusercontent.com/jamesmcginnis/possum-printer-card/main/preview1.png" alt="Possum Printer Card preview" width="380">
  &nbsp;
  <img src="https://raw.githubusercontent.com/jamesmcginnis/possum-printer-card/main/preview2.png" alt="Possum Printer Card popup" width="380">
</p>

---

## ✨ What it does

- **Four animated rings** showing Black, Cyan, Magenta, and Yellow ink/toner levels
- **Status pill** — Idle, Printing, Ready, Sleep, Error — with a colour-coded dot
- **Offline mode** — all rings grey out and show *Offline* when the printer is unavailable
- **Tap a ring** to see a detailed popup for that ink colour, including a level badge and entity attributes
- **Long-press a ring** to open the native Home Assistant More Info panel
- **Tap the status pill or printer name** for a full printer status popup
- **Visual editor** with smart entity detection — likely printers and ink sensors are surfaced first

---

## 🚀 Installation

After downloading through HACS, add the resource to your Lovelace dashboard and add the card via the UI or YAML.

```yaml
type: custom:possum-printer-card
printer_entity: sensor.my_printer_status
ink_black_entity: sensor.my_printer_black_ink
ink_cyan_entity: sensor.my_printer_cyan_ink
ink_magenta_entity: sensor.my_printer_magenta_ink
ink_yellow_entity: sensor.my_printer_yellow_ink
friendly_name: Office Printer
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
    <img
      src="https://img.shields.io/badge/Add%20to%20Home%20Assistant-%231880d9?style=for-the-badge&logo=home-assistant&logoColor=white&labelColor=%231880d9"
      alt="Add to Home Assistant"
      style="height:44px;"
    />
  </a>
</p>

---

<p align="center">
  <a href="https://github.com/jamesmcginnis/possum-printer-card">
    <img src="https://img.shields.io/github/stars/jamesmcginnis/possum-printer-card?style=for-the-badge&logo=github&label=GitHub" alt="GitHub">
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge" alt="HACS Custom">
  &nbsp;
  <img src="https://img.shields.io/badge/HA-2023.1%2B-blue?style=for-the-badge" alt="Home Assistant 2023.1+">
</p>
