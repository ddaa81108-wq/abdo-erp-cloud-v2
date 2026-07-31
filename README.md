<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/347119cc-42bf-45c0-b559-a5f3077f17ae

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase production projects

The application intentionally uses two explicit Firebase projects:

- Hosting: `abdocash121`
- Authentication, Firestore data, and Firestore Rules: `abdonew-3dd25`

Do not run a generic `firebase deploy`. Use only these guarded commands:

- `npm run deploy:hosting` — build and publish Hosting only.
- `npm run deploy:rules` — publish Firestore Rules to the data project only.
- `npm run deploy:production` — build, publish Hosting, then publish Rules to their correct projects.

Run `npm run verify:firebase-projects` at any time to detect an accidental project mismatch before deployment.
