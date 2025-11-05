# tsinglan_network_acportalbrute

A lightweight Tampermonkey userscript for testing (brute-forcing) account/password logins on AcPortal-like captive portals. The script provides a compact UI, uses RC4-based password encryption compatible with the portal, and supports features such as randomized device info, drag-to-move panel, export of successful accounts (with passwords), and configurable delay.

---

## Features

- Small, floating UI with toggle and animated expand/collapse
- Test a range of numeric accounts with a primary password and an auto-generated secondary password (Tls#<last4>)
- RC4-based password encryption matching portal requirements
- Optional randomization of MAC and other client info per request
- Adjustable delay between attempts and auto-open option
- Export successful accounts (account,password per line) to clipboard or file
- Drag to reposition panel; settings saved to localStorage
- Keyboard shortcut: Ctrl + Shift + T

---

## Quick Start

1. Install a userscript manager (Tampermonkey / Violentmonkey) in your browser.
2. Add the `main.user.js` script to your manager.
3. Visit the captive portal page (e.g. `http://4.3.2.1/*`) and use the floating "Brute" button to open the panel.
4. Configure start/end accounts, password, delay, and optional randomization, then click Start.

---

## Configuration & Notes

- Primary password: enter the most-likely password to test (e.g. `123456`).
- Secondary password: `Tls#<last4>` is automatically tried for each account.
- Delay (ms): controls how long the script waits between attempts; increase to be polite to the portal.
- Randomize MAC & Info: when enabled, each request may appear from a different device.
- Export: successful account list is exported as `account,password` per line. The UI hides passwords but they are stored internally for export.

---

## Security & Ethics

This tool is intended for legitimate testing on systems you own or have explicit permission to test. Unauthorized access or brute-forcing of accounts is illegal and unethical. Use responsibly.

---

## Installation

Install (placeholder): 
[Install (Github Source)](https://github.com/ShihanWu1029/tsinglan_network_acportalbrute/raw/refs/heads/main/main.user.js)

Replace the above placeholder with the actual script installation link or local path when ready.
