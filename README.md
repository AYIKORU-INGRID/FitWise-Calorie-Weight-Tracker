# FitWise
A weight and calorie tracker with Supabase authentication and private per-user storage.

## Run

Node.js 18 or newer is required.

1. Create a Supabase project.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
   The table uses row-level security so signed-in users can only access their
   own tracker row.
3. In Supabase **Authentication → URL Configuration**, set the site URL to
   `http://localhost:3000` and allow that URL for email confirmation redirects.
4. In PowerShell, open this folder, set the Supabase project URL and its
   publishable (or legacy `anon`) key, and start the server:

   ```powershell
   $env:SUPABASE_URL = "https://your-project.supabase.co"
   $env:SUPABASE_ANON_KEY = "your-supabase-publishable-or-anon-key"
   npm start
   ```

5. Open <http://localhost:3000>, create an account, and sign in. If you want
   to copy existing tracker data from this browser, select the import option
   before signing in or creating an account.

The Supabase publishable/anon key is intended for browser use; row-level
security in the SQL schema protects tracker data. Never use a Supabase
`service_role` or secret key in the app. Keep the project URL and key in the
server terminal environment, and restart the server after changing them.

The server listens on this computer only by default. To let other people or
devices use it, deploy the Node app behind HTTPS, set `HOST` to `0.0.0.0` in
the hosting environment, and add the deployed HTTPS origin to Supabase
Authentication URL settings. The coach and photo-scan endpoints also require
a valid signed-in Supabase session.

AI meal-photo scanning and coaching are optional. To enable them, also set
`OPENAI_API_KEY` in the server terminal before running `npm start`. These
features send the selected photo or coach messages to OpenAI and may incur API
charges. Tracker data is stored in Supabase; the coach chat history remains
only in the current browser page.

Run `npm run check` to check the JavaScript syntax.
