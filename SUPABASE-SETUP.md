# Supabase shared account and forum setup

The site is hosted as static files, so shared users and posts need a hosted database. These steps connect the page to Supabase.

## 1. Create a Supabase project

Create a project at https://supabase.com and wait for it to finish provisioning.

## 2. Create the tables and security policies

In the Supabase dashboard, open **SQL Editor**, create a query, paste all of `supabase-schema.sql`, and run it. The schema makes forum posts readable by everyone, while only signed-in members can post, comment, and delete their own posts. User profile rows are private to their owner. It also adds a restricted lookup function used to verify recovery phrases without exposing profile rows.

## 3. Configure the public browser keys

In **Project Settings > API**, copy the **Project URL** and the **publishable key** (or legacy `anon` key). Put them in `supabase-config.js`:

```js
window.CAFFEINE_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};
```

Never put the `service_role` key in this file or in GitHub. The publishable/anon key is intended for browser use; the SQL row-level security policies enforce access.

## 4. Configure email authentication

In **Authentication > URL Configuration**, set the GitHub Pages site URL as the Site URL and add it to the Redirect URLs. The site uses email/password registration. If email confirmation is enabled, members must confirm their email before they can sign in.

## 5. Publish all site files

Upload `index.html`, `logic.js`, `styles.css`, `supabase-config.js`, and `supabase-schema.sql` to the repository. The schema file is run in Supabase SQL Editor; GitHub Pages does not execute SQL files.

At signup, members create a recovery phrase of at least eight characters. The page stores a PBKDF2 hash, never the phrase itself. ID lookup and password reset both require the registered name and phrase. In shared mode, a successful password-reset check sends a reset link to the account email.

After deployment, sign up two test accounts from separate browsers/devices. Posts and comments are stored in Supabase and update on other open pages through Realtime.

## Existing local data

The old localStorage accounts and caffeine logs remain on their original browsers and are not automatically migrated. Members with older accounts can sign in on that browser and set a recovery phrase in the account dialog. The new shared auth accounts and forum are stored in Supabase. Caffeine intake logs remain local to each browser in this version.
