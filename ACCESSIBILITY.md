# Accessibility

CSES Better is a browser based practice workspace with problem statements, an editor, test results, account flows, and optional embedded or external services. Accessibility is part of the project’s expected behavior. The project does not claim conformance to a particular WCAG level; support can vary between browsers, assistive technologies, embedded tools, and upstream CSES content.

## What contributors should preserve

- Make every interactive control usable by keyboard, with a visible focus indicator and a sensible focus order. Menus and dialogs should open, dismiss, and return focus predictably.
- Give controls clear names, use semantic elements, and expose state changes such as expanded menus, selected tabs, loading, errors, and completed actions to assistive technology.
- Keep text readable at browser zoom and on narrow screens. Do not convey status or meaning through color alone; preserve contrast in supported themes.
- Respect reduced-motion preferences where animation is nonessential. Avoid flashing content and unexpected focus changes.
- Keep validation and recovery instructions close to the control or result they describe. Announce important asynchronous results without moving focus unnecessarily.
- Keep editor actions and test results available without requiring a pointer. Embedded compiler and external provider accessibility may depend on those services.

## How to check a change

For interface changes, include the relevant checks in the pull request description. When practical, try keyboard-only navigation, browser zoom, a narrow viewport, and a screen reader or other assistive technology available to you. Check focus visibility, control names, error and success feedback, and whether the task can be completed without a mouse. Automated checks are useful but do not replace these checks.

If you find a barrier, open a [bug report](https://github.com/codewithpom/cses-better/issues/new?template=bug.yml) with the page or problem URL, steps to reproduce, browser and operating system, input method, and assistive technology and version if applicable. Describe what you expected and what happened instead. Do not include account passwords, session cookies, tokens, private code, or personal data. If the report itself contains sensitive security details, follow [SECURITY.md](SECURITY.md) rather than posting them publicly.

Accessibility suggestions are welcome through the [feature request form](https://github.com/codewithpom/cses-better/issues/new?template=feature.yml). See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and pull request guidance.
