# Contributing to AI Credits Dashboard

Thanks for your interest! Here's how to get started.

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

## Chrome Extension (Development Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. After loading, review **Site access** in extension details — extension requests `host_permissions` for each provider domain you wish to extract credentials from. Grant access when prompted.

## Code Quality

- **Lint:** `npm run lint`
- **Tests:** `npm test`
- **Build:** `npm run build`

Please ensure all checks pass before submitting a PR.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): description`
- `fix(scope): description`
- `chore(scope): description`
- `refactor(scope): description`
- `docs(scope): description`

## Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes with clear commits
4. Ensure `npm run lint`, `npm test`, and `npm run build` all pass
5. Open a PR with a clear description of the change
