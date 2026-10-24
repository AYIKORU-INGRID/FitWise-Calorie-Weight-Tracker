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

## Settings and Premium

Signed-in users can save an appearance preference, weight units, and a daily
water goal in the Settings tab. The settings are stored with the user's private
tracker record; weight values continue to be stored in kilograms and are
converted for display when pounds are selected.

Premium photo scanning is an optional UGX 2,000 monthly Flutterwave
subscription. To enable purchases:

1. Create a monthly UGX 2,000 payment plan in Flutterwave. Flutterwave recurring
   payment plans require card payments.
2. In the Flutterwave dashboard, set the webhook URL to
   `https://your-app.example/api/flutterwave/webhook` and configure a random
   webhook secret hash.
3. Set these server environment variables (never put these secrets in browser
   code or commit them):

   ```text
   APP_URL=https://your-app.example
   FLW_SECRET_KEY=your-flutterwave-secret-key
   FLW_SECRET_HASH=the-webhook-secret-hash
   FLW_PLAN_ID=your-flutterwave-plan-id
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

4. Ensure photo scanning is enabled with an AI provider key, then restart the
   server. Run the updated [`supabase/schema.sql`](./supabase/schema.sql) in the
   Supabase SQL editor so server-side billing records and the subscription
   activation function are available.

Checkout stays disabled until the required configuration and photo-scanning
service are available. The server verifies payments with Flutterwave before
activating Premium, and signed webhooks handle renewals and cancellations.
Test with Flutterwave test credentials and a test payment plan before accepting
live payments.

## Going online

See `DEPLOY.md` for hosting on Render, the Supabase address settings, and the privacy checklist. Fill in the placeholders in `privacy.html` and `terms.html` first.