# Contributing

Start with an issue describing the problem and expected behavior. For small fixes, a pull request with a clear explanation is welcome.

Participation follows the [Code of Conduct](CODE_OF_CONDUCT.md). For interface work, read the project’s [Accessibility guidance](ACCESSIBILITY.md). Report security issues using [SECURITY.md](SECURITY.md), not a public issue.

## Local setup

Use Node.js 22 and npm. Run `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Use your own service configuration; never commit credentials or personal data.

## Before opening a pull request

Run `npx tsc --noEmit`, `npm test`, and `npm run build`. Explain the user-visible change and how you verified it. Include screenshots for interface changes and regression tests for behavior fixes.

Keep changes focused. Preserve guest data, offline behavior, keyboard access, and existing problem links. Do not attach account tokens, private code, or passwords to reports.

Good starting points include documentation corrections, reproducible interface bugs, accessibility improvements, and language starter fixes.
