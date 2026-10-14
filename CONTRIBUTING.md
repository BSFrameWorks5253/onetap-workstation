# Contributing to UniDesk Studio

Thank you for your interest in contributing to **UniDesk Studio**! We welcome community contributions, bug fixes, performance improvements, and workflow enhancements.

---

## 🛠️ Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BSFrameWorks5253/onetap-workstation.git
   cd onetap-workstation
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development workstation:**
   ```bash
   npm run dev
   ```

4. **Run TypeScript type checks:**
   ```bash
   npx tsc --noEmit
   ```

5. **Build the production bundle:**
   ```bash
   npm run build
   ```

---

## 🌿 Branching & Git Conventions

- `main`: Production release branch. All commits must pass type-checking and automated CI.
- `feature/<feature-name>`: New capabilities or modules.
- `fix/<bug-name>`: Targeted bug fixes.
- `perf/<optimization>`: Rendering or cache engine performance optimizations.

### Conventional Commit Format
Follow conventional commits:
```
<type>(<scope>): <subject>

[optional body describing changes, bugs fixed, features added]
```
Examples:
- `feat(title-adder): support sequential multi-batch queue reordering`
- `fix(task-tracker): resolve window freeze on rapid workflow status toggle`
- `docs(readme): add interactive animated architecture diagram`

---

## 🧠 Codebase Analysis Cache

UniDesk Studio features an incremental SHA-256 token-saving cache system. When you add or modify source files, synchronize the knowledge base:
```bash
npm run analyze:cache
```

---

## 📜 Pull Request Process

1. Fork or branch from `main`.
2. Ensure `npx tsc --noEmit` and `npm run build` both succeed with exit code `0`.
3. Open a Pull Request referencing the related issue.
4. Once CI passes and review is approved, your PR will be squashed and merged into `main`.
