# Security Policy

## Threat Model

This project is a private, self-hosted dashboard for AI provider usage and credit balances.
It aggregates live provider credentials, session cookies, refresh tokens, and account usage behind a single dashboard login.

Do not run this as a shared or public instance. Anyone who can access your deployed dashboard can see usage data and may be able to trigger server-side requests authenticated as your provider accounts.

## Required Deployment Posture

- Keep all provider credentials server-side in environment variables.
- Set `ADMIN_PASSWORD` in every production deployment. Production auth fails closed when it is missing.
- Use a strong, unique `ADMIN_PASSWORD` and rotate it immediately if repository history or deployment logs leak.
- Prefer least-privilege API keys where providers support scopes or restricted permissions.
- Do not commit `.env*` files, cookies, HAR files, page dumps, screenshots with real account data, or provider response logs.

## Provider Terms

Some integrations use web-session cookies or authenticated scraping when no stable public usage API exists. Use this project only with accounts you control, respect each provider's terms, and be prepared for providers to change or block private endpoints.

## Reporting Vulnerabilities

Open a private security advisory or contact the maintainer privately. Do not paste secrets, cookies, tokens, HAR files, or full provider responses into public issues.
