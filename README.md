# NMC Christmas Prep List — Demo

A responsive static preview for Ngculwini Miracle Center's Christmas preparation goods list.

## Features in this preview
- Search and filter items by availability
- Simulate claiming an available item with a demo name
- Add/remove items and simulate approving a cancellation
- Export the current browser's register as CSV
- Responsive layout and NMC motto

## Important privacy and deployment note
This is a **front-end demo only**. It uses the current browser's `localStorage`, so changes are not shared between visitors, and the admin preview is not protected by authentication. **Do not enter real names or use this as the live congregation register.** Before real use, connect a shared database and server-enforced admin authentication so claimant names and notes are only available to authorized admins. A static site alone cannot guarantee that privacy.

## Deploy on Netlify
1. Import this repository from GitHub into Netlify.
2. Leave build command empty and publish directory as `.`.
3. Deploy. The site is a static HTML demo and needs no build step.

## Project
Repository: https://github.com/mpumelelo810/NMC-Christmas-Prep-List
