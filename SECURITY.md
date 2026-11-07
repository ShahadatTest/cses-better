# Reporting a security issue

Do not publish exploitable details, credentials, or user data in a public issue. Use the repository's private vulnerability reporting option if enabled: https://github.com/codewithpom/cses-better/security/advisories/new.

If private reporting is unavailable, open an issue requesting a private contact without including sensitive details. Include affected versions, a minimal reproduction, and impact only after a private channel is established.

Maintainers: rotate any working bot credentials previously committed before public launch. Removing a credential from current source does not revoke it or remove it from Git history. Configure deployment secrets separately; never commit `.env.local`.

## Launch dependency review

The November 7, 2026 local `npm audit --omit=dev` reported production advisories affecting Next.js, its nested PostCSS, DOMPurify, Monaco, and KaTeX. Some fixes require dependency upgrades outside this interface pass. A compatible DOMPurify update did not resolve the reported advisories. Re-run the audit and validate dependency remediation before promoting this deployment; passing tests and builds do not establish that these advisories are resolved.
