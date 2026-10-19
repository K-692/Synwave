# Contributing to Synwave

First off, thank you for considering contributing to **Synwave**! 🎉

> *"Synwave is an evolving open-source project, and I know it still has bugs and areas that need improvement. Contributions, bug reports, suggestions, and pull requests are very welcome. Help me fix the existing issues and turn Synwave into a polished, reliable product!"*

---

## 🛠️ Development Setup

Please refer to the [Installation & Development Setup](README.md#-installation--development-setup) section of the README for complete instructions on setting up:
1. Node.js dependencies (`npm install`)
2. Python virtual environment (`python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`)
3. YouTube Data API v3 configuration (`.env` or in-app gate)

---

## 📋 Pull Request Process

1. **Create an Issue:** If you are proposing a new feature or fixing a non-trivial bug, open an issue first to discuss the implementation approach.
2. **Branch Naming:** Use clear branch names:
   - `fix/youtube-sync-drift`
   - `feat/laser-strobe-patterns`
   - `docs/setup-guide-windows`
3. **Run Type Checks & Build:**
   Before pushing, ensure that all TypeScript checks and builds pass without errors:
   ```bash
   npm run build
   npm run lint
   ```
4. **Document Visual Changes:** If your pull request affects lighting, camera kinematics, or shaders, please attach a short screen recording or screenshot in the PR description.
5. **No Secrets or Private Files:** Never commit API keys, personal audio files, or secrets into source control.

---

## 🎨 Code Style & Architectural Conventions

- **TypeScript Strictness:** Maintain strict typing without `any` where possible.
- **Three.js Resource Cleanup:** When implementing visual effects, always clean up geometries, materials, and textures in `dispose()` methods to prevent WebGL memory leaks.
- **Comments for Non-Obvious Math:** Explain trigonometric equations, frequency mapping curves, and kinematic formulas with inline comments for future referencing.
- **Documentation:** If modifying architecture or stage routing parameters, remember to update `README.md` and `flow.md`.

---

Thank you for helping make Synwave the best open-source 3D concert stage simulator! 🚀
