# Questbound v0.4.0 — Spark-only / $0-hardened build

Questbound is a mobile-first family Life RPG PWA for routines, independence, rewards, and parent-approved bonuses.

This build is intentionally designed to stay on Firebase's **Spark** plan with **no billing account attached**.

## What changed from v0.3

- Removed Cloud Functions entirely.
- Removed Firebase Hosting and Firebase CLI deployment requirements.
- Removed cloud-sent push notification infrastructure.
- Uses only:
  - GitHub Pages for the frontend.
  - Firebase Authentication (Email/Password) for the shared family login.
  - Cloud Firestore for shared progress/data.
- Parent PIN verification is performed in the client using a PBKDF2 hash stored in Firestore.
- Both parent and kid devices use the same family email/password once, then the app opens in Kid Mode by default.
- Parent Controls remain behind the gear menu and Parent PIN.
- Parent PIN is still required for Caught It / Self Correction and manually verified bosses.
- Firestore local persistence is enabled where the browser supports it.

## Important security tradeoff

This is a family app, not a financial system. Because the Spark-only version has no private server, parent-only controls are enforced by the app rather than a trusted backend. A technically skilled person with developer tools and the family Firebase login could bypass those client-side checks.

For a child routine tracker this is usually a reasonable tradeoff for having a hard no-billing setup.

## Cost guardrail

To keep this build incapable of charging you:

1. Keep the Firebase project on **Spark**.
2. Do **not** attach a Google Cloud billing account.
3. Do **not** upgrade to Blaze.
4. Do not add paid Google Cloud services.

If a Spark quota is exhausted, the affected Firebase service stops working until the quota resets rather than billing you.

## Hosting

Read **SETUP_GITHUB_DESKTOP.md**. It walks through the entire process using GitHub Desktop and the Firebase web console. No command line and no Firebase CLI are required.

## Local debug

Install Node.js, then double-click:

`START_LOCAL.bat`

It binds only to:

`127.0.0.1:5173`

Closing the terminal stops the local server. Nothing is installed as a Windows service or background daemon.

If Firebase has not been configured, Questbound automatically runs in local demo mode. Demo-mode Parent PIN: `1234`.

## GitHub Pages repository path

This package is preconfigured for the existing repository name:

`Questbound`

The production base path is therefore:

`/Questbound/`

If you ever rename the repository, update `vite.config.js` to match the new repository name.
