# NMC Christmas Prep List

Congregation-friendly Christmas contribution list for Ngculwini Miracle Center.

## Features
- Public list shows item name, description, and availability only.
- Contribution names and private notes are stored server-side in encrypted form.
- Admin-only private register and Excel export with `Taken` and `Not Taken` sheets.
- Admin item add/remove, cancellation approval, and reset controls.
- Netlify Function API with server-side authentication; no admin password in frontend code.
- Existing green/gold NMC design and motto retained.

## Required Netlify setup before real data is entered

This repository is **not production-ready until these steps are complete and verified**.

1. Deploy this repository to Netlify with the Netlify Functions feature enabled. Build settings should use the repository root as the publish directory. `netlify.toml` configures the functions directory.
2. In Netlify Site configuration / Environment variables, set these three variables for the production deploy context:
   - `NMC_ADMIN_PASSWORD`: a long, unique administrator password (at least 16 characters recommended). Do not reuse another account password.
   - `NMC_SESSION_SECRET`: a randomly generated secret with at least 32 characters.
   - `NMC_ENCRYPTION_SECRET`: a separate randomly generated secret with at least 32 characters. **Keep this secret safe: changing or losing it makes existing encrypted register data unreadable.**
3. Generate secrets locally using a trusted password manager or a local cryptographic random generator. Never put these values in GitHub, HTML, chat, screenshots, or public files.
4. Redeploy after setting the variables. The API deliberately returns HTTP 503 until all required environment variables are present.
5. Test in a private/incognito browser: the public list must not show contributor names or notes; wrong admin passwords must fail; correct login must allow private records and Excel export; logout must close admin access.
6. Verify Netlify function logs and the live site after deployment. Do not enter real contributor information until all tests pass.

## Data and security notes
- Register data is stored in Netlify Blobs using AES-GCM encryption at the application layer. Netlify Blobs is also a managed hosted storage service; account/site administrators may still have infrastructure-level access.
- The browser only receives the public item fields unless the server validates the administrator session.
- Excel files downloaded by an administrator contain personal data. Store them in an encrypted folder and do not commit them to this repository.
- Keep separate secure backups of both the encrypted register and the encryption secret. Do not change the encryption secret without a migration plan.
- The storage API uses a single encrypted JSON register and is suitable only for a small, low-concurrency list. Netlify Blobs is key/value storage and concurrent simultaneous claims can race; this is not a relational database or an immutable audit ledger.
- Public claims are anonymous by design, so avoid collecting sensitive personal information. For higher-risk or larger-scale use, use an authenticated form or a database with transactional writes and audit logs.
- Netlify's free plan has usage limits. Check the current Netlify dashboard and plan limits; no third-party hosting service can be guaranteed free at every traffic level.
- The old browser-only demo data is not automatically migrated. Do not assume any names stored in a browser's previous localStorage have been copied into the shared register.

## Initial list
Rice (10 kg), Chicken, Cooking oil, Soft drinks, Bottled water, Vegetables, Bread rolls, Paper plates and cups, Napkins, Cleaning supplies, Christmas decorations, Dessert or cake.
