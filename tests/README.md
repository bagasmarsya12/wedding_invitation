# Verification entry points

Run the scripts advertised in `package.json` for current unit, HTTP integration and admin coverage. Both integration scripts create and remove their own isolated local databases. Build the Worker first.

The `.py` visual scripts in this folder are historical, manually invoked harnesses from previous design passes. In particular, `garden-visual-qa.py`, `cinematic-hero-qa.py`, `destination-transition-qa.py`, `deployment-qa.py`, `closing-performance-qa.py`, `profiles-qa.py`, `archive-table-qa.py` and `gifts-scene-qa.py` include superseded renderer, visible-profile or placeholder-collection assumptions. Do not use them as acceptance criteria for the October design polish. The live renderer portal unit test is restored and runs in the supported unit suite.

Current envelope and CMS release verification is documented in `../docs/PRODUCTION.md`. Both integration suites migrate all current SQL files into isolated stores. Admin coverage includes private keepsake notes, owner-controlled labels and QR check-in. Browser verification used the native in-app browser; no historical browser harness was run during this pass.
