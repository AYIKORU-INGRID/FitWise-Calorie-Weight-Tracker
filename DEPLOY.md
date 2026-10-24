

## 1. Put the code on GitHub

1. Create a free GitHub account and a new **private** repository.
2. Upload these files: `App.js`, `index.html`, `style.css`, `server.js`,
   `privacy.html`, `terms.html`, `package.json`, `package-lock.json`,
   `.gitignore` and the `supabase` folder.
3. **Never upload `.env`.** The `.gitignore` file only protects you if you use
   Git. If you use the web "Upload files" button, choose the files yourself.

## 2. Create the web service on Render

1. Sign in at render.com with GitHub. Choose **New > Web Service** and pick the repo.
2. Settings:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Free**
   - Advanced > Health Check Path: `/healthz`
3. Under **Environment**, add the same values as your `.env`:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `FREE_SCANS_PER_DAY`,
   `PREMIUM_SCANS_PER_DAY`, and `NODE_VERSION` = `22`.
4. Create the service. Render gives you an address like `https://yourapp.onrender.com`.

## 3. Tell Supabase about the new address

In Supabase go to **Authentication > URL Configuration**:
- Set **Site URL** to your Render address.
- Add the same address under **Redirect URLs** (keep `http://localhost:3000` too).

## 4. Test it

1. Open `https://yourapp.onrender.com/healthz`. It should show `{"ok":true}`.
2. Open the address, create an account (tick the consent box), log a meal.
3. Open `/privacy` and `/terms` and check they load.
4. Check the row appears in Supabase > Table Editor > `tracker_data`.

## 5. Before real users sign up

- Fill every `[PLACEHOLDER]` in `privacy.html` and `terms.html` (name, email,
  date, hosting provider, Supabase region, refund policy).
- Registration with the Personal Data Protection Office (PDPO, at NITA-U) is
  required for people who collect personal data in Uganda. Check the current
  process and any exemptions on the NITA-U website.
- Have a Ugandan lawyer review the policy and terms. These are templates, not legal advice.
- Build account deletion and data export (the policy currently asks users to email you).

## Updating the app later

Change the files in GitHub. Render redeploys by itself. Changes to environment
variables are made in Render's Environment tab.