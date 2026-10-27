# NMC Christmas Planning Register

A live, shared Christmas contribution register for Ngculwini Miracle Center.

**Live site:** https://nmc-christmas-planning.netlify.app/

## Current features
- Public contribution list with item counts and available/taken filters.
- Available items are shown before already-taken items.
- Public visitors can claim an available contribution by entering a name and optional note.
- Contributor names and notes are returned only by the admin API after server-side authentication.
- Admin can add items, approve cancellations, remove items, and export an Excel workbook with `Taken` and `Not Taken` sheets.
- Netlify Function backend and Netlify Blobs storage.

## Important production security notes

This project is deployed and is being used as a real congregation register. Do not treat it as a disposable demo, and do not reset or replace its data without explicit approval.

The current backend implementation has important limitations that must be addressed before describing the system as fully production-hardened:

1. **Storage is not encrypted by the application right now.** The current `encrypt()` function serializes JSON directly, despite the name. Do not claim application-layer encryption at rest until authenticated encryption is implemented and deployed with a securely configured key.
2. **The admin password has an insecure fallback.** If `NMC_ADMIN_PASSWORD` is not configured, the backend falls back to `12345`. Set a strong, unique `NMC_ADMIN_PASSWORD` in Netlify environment variables and redeploy. Never put secrets in GitHub, source code, chat, or screenshots.
3. **Password change support exists in the API but not in the admin interface.** A secure admin password should be configured through Netlify before normal operation; the UI should not imply that password management is complete.
4. **No login rate limiting or lockout is implemented.** A wrong password is rejected, but repeated attempts are not throttled by this application.
5. **Netlify Blobs uses a single JSON register.** Simultaneous claims can race because the app does not use a transactional database or atomic compare-and-set operation. This is acceptable only for low-concurrency use and should be tested carefully.
6. **Backups and restore procedures must be arranged separately.** Export the private register securely as needed; Excel exports contain contributor names and notes and must not be committed to this repository.
7. **Hosting cost is not guaranteed to remain zero.** Check the current Netlify plan and usage limits. Do not assume that any hosted service is unlimited or permanently free.

## Safe operational rules
- Never use reset or seed operations against the live register as a test.
- Never test claims by submitting real items on the live site.
- Never publish contributor names or notes.
- Test changes in a separate staging deployment with synthetic data where possible.
- Before backend or storage migrations, make a verified backup and document a rollback plan.
- Keep the public site usable on mobile and on slower connections.

## Current register snapshot

The live page was inspected on 27 October 2026. At the time of inspection it displayed 29 items: 11 available and 18 taken. These counts are a snapshot, not a hard-coded guarantee; the shared register may change as congregants make contributions.

## Deployment
- Netlify publishes the repository root.
- Netlify Functions are in `netlify/functions`.
- `netlify.toml` configures the build and response headers.
- The API endpoint is `/.netlify/functions/api`.

Review the live deployment after each change. A successful GitHub commit does not by itself prove that the Netlify production deploy completed or that all workflows work.
