# Questbound v0.4.0 — Complete GitHub Desktop + Firebase Spark Setup

This guide assumes the existing GitHub repository is:

`maxwellmgraves-cmd/Questbound`

The goal is:

- GitHub Pages hosts the app.
- Firebase Spark stores the shared family save.
- No billing account is attached.
- No Cloud Functions, Firebase Hosting, or Firebase CLI are used.

---

# PART A — Replace the repository using GitHub Desktop

## 1. Extract Questbound_v0.4.0.zip

Extract the ZIP somewhere easy to find, for example:

`Documents\Questbound_v0.4.0`

Do not edit the ZIP itself.

## 2. Open GitHub Desktop

Sign into the same GitHub account that owns:

`maxwellmgraves-cmd/Questbound`

## 3. Clone the existing Questbound repository

In GitHub Desktop:

1. **File → Clone repository**
2. Select the **GitHub.com** tab.
3. Select `maxwellmgraves-cmd/Questbound`.
4. Choose a local path, for example `Documents\GitHub\Questbound`.
5. Click **Clone**.

## 4. Replace the old project files

In File Explorer, open the local repository folder GitHub Desktop just cloned.

Copy **the contents inside** the extracted `Questbound_v0.4.0` folder into the cloned `Questbound` repository folder.

Allow Windows to replace matching files.

Delete old v0.3-only files if they still exist, especially:

- `functions\`
- `DEPLOY_FIREBASE.bat`
- `firebase.json`
- `.firebaserc.example`
- `public\firebase-messaging-sw.js`
- `scripts\generate-fcm-sw.mjs`

The v0.4 ZIP does not contain those files.

## 5. Commit the v0.4 update

Return to GitHub Desktop.

You should see many changed files.

In the Summary box enter:

`Questbound v0.4.0 Spark-only build`

Click:

**Commit to main**

Then click:

**Push origin**

Do not worry if the site is still in local-demo mode. Firebase is configured next.

---

# PART B — Keep Firebase absolutely no-billing

## 6. Create or open a Firebase project

Open the Firebase Console and create a new project named something like:

`Questbound`

You can disable Google Analytics. Questbound does not need it.

### Critical

Leave the project on the **Spark** plan.

Do not attach a billing account.

Do not click Upgrade / Blaze.

## 7. Create a Firebase Web App

From the Firebase project overview:

1. Click the **Web** icon (`</>`).
2. App nickname: `Questbound Web`.
3. Do **not** enable Firebase Hosting.
4. Register the app.

Firebase displays a config object similar to:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
}
```

Keep that page open.

These web-app config values are public application identifiers. Do not put your Firebase account password or Questbound Parent PIN into the source code.

## 8. Enable Email/Password Authentication

Firebase Console:

1. Open **Authentication**.
2. Click **Get started** if prompted.
3. Open **Sign-in method**.
4. Enable **Email/Password**.
5. Save.

Do not enable phone authentication. It is unnecessary.

## 9. Create Firestore

Firebase Console:

1. Open **Firestore Database**.
2. Click **Create database**.
3. Choose the normal/Standard Firestore database.
4. Choose **Production mode**.
5. Pick a nearby US region. The exact region is not important for this tiny family app.
6. Create the database.

## 10. Install the Questbound Firestore rules

In Firebase Console:

1. Open **Firestore Database → Rules**.
2. Open the local file `firestore.rules` from the v0.4 package in Notepad.
3. Copy the entire contents.
4. Replace everything in the Firebase Rules editor with it.
5. Click **Publish**.

The rules deliberately allow a signed-in family account to access only the family document whose ID equals that Firebase user's UID.

Do this before creating your Questbound family save.

---

# PART C — Put your Firebase config into Questbound

## 11. Edit src/firebase-config.js

In your cloned repository folder open:

`src\firebase-config.js`

It starts like this:

```js
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
}
```

Copy the corresponding values from the Firebase Web App configuration.

Example shape:

```js
export const firebaseConfig = {
  apiKey: 'AIza....',
  authDomain: 'questbound-example.firebaseapp.com',
  projectId: 'questbound-example',
  storageBucket: 'questbound-example.firebasestorage.app',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456'
}
```

Save the file.

## 12. Commit the Firebase config with GitHub Desktop

GitHub Desktop should now show `src/firebase-config.js` as changed.

Summary:

`Configure Firebase Spark sync`

Click:

**Commit to main**

Then:

**Push origin**

That push automatically triggers the included GitHub Pages workflow.

---

# PART D — Turn on GitHub Pages

## 13. Enable Pages from GitHub Actions

In a normal browser, open the GitHub repository:

`maxwellmgraves-cmd/Questbound`

Go to:

**Settings → Pages**

Under **Build and deployment** set:

**Source: GitHub Actions**

The repository already contains:

`.github/workflows/deploy.yml`

You do not need to create another workflow.

## 14. Watch the deployment

Go to the repository's **Actions** tab.

Open the newest **Deploy Questbound** run.

Wait for all steps to turn green:

- Checkout
- Setup Node
- Install dependencies
- Build Questbound
- Setup Pages
- Upload site
- Deploy

The site should be available at:

`https://maxwellmgraves-cmd.github.io/Questbound/`

If you see an older cached build, hard-refresh the browser or clear the site's data once.

---

# PART E — Create the shared family save

## 15. Open Questbound on your device first

Open:

`https://maxwellmgraves-cmd.github.io/Questbound/`

Choose:

**Create Family Save**

Enter:

- Family / guild name
- Your son's adventurer name
- Parent PIN
- Email
- Password

### Important

The email/password is the Firebase family account used to synchronize devices.

The Parent PIN is separate. It unlocks Parent Controls and approves Caught It/manual-boss rewards.

Use a real email you control and a unique password. Do not give your son the account password if you do not want him signing in on additional devices himself.

After creation, Questbound opens in Kid Mode by default.

## 16. Parent Controls

On any signed-in device:

1. Tap the **gear** in the upper-right.
2. Tap **Parent Controls**.
3. Enter the Parent PIN.

Parent mode contains quest editing, reward management, progress, and activity history.

Leaving Parent Controls returns the app to Kid Mode.

---

# PART F — Install on Android

## 17. Sign in on your son's Android

On his Android phone/tablet:

1. Open Chrome.
2. Go to the Questbound GitHub Pages URL.
3. Choose **Sign In**.
4. Enter the same family email/password.
5. Confirm his progress appears.

Then use Chrome's menu:

**Add to Home screen** or **Install app**

Questbound will launch like an app.

You only need to sign in once unless browser/app data is cleared.

---

# PART G — Install on iPhone

## 18. Sign in on your iPhone

1. Open the Questbound URL in Safari.
2. Sign in with the same family email/password.
3. Tap Safari's **Share** button.
4. Choose **Add to Home Screen**.

Both devices now watch the same Firestore data in real time.

If he checks an objective on Android, your iPhone should update shortly afterward.

---

# PART H — Verify sync before relying on it

## 19. Run a 60-second sync test

Put both devices next to each other.

On his device:

1. Mark one Daily Bonus complete.

On yours:

1. Open Parent Controls.
2. Confirm the XP/progress changes.

Then do the reverse:

1. Edit a quest title slightly on the parent device.
2. Return to the kid device.
3. Confirm the new text appears.

Once both directions work, the cloud save is correctly configured.

---

# PART I — Rules for staying completely free

Keep these rules and this build will not have a billing path:

1. Firebase project stays on **Spark**.
2. Do **not** attach a Cloud Billing account.
3. Do **not** upgrade to Blaze.
4. Do not add Cloud Functions.
5. Do not add paid Google Cloud services.
6. GitHub Pages continues to host the frontend.
7. Use only Authentication + Firestore as configured here.

Questbound's family-scale traffic should be tiny compared with Firestore's Spark quota. If the quota were somehow exceeded, the service would stop until quota resets instead of charging a card because no billing account is attached.

---

# What this free build does NOT do

To keep the hard $0 boundary, v0.4 intentionally does not use a backend Cloud Function.

That means:

- Parent PIN enforcement is client-side rather than bank-grade server-side security.
- Questbound cannot send scheduled cloud push messages while every copy of the app is fully closed.
- Reminder notifications work while the PWA is running and has notification permission.

The shared Firestore save, parent/kid UI, XP, coins, routines, bosses, reward requests, and live cross-device progress all remain.
