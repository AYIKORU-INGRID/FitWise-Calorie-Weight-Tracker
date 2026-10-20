# WEIGHT-TRACKER
A weight loss tracker and calorie tracker.

## Run

The tracker uses a small Node.js server for AI photo analysis. Node.js 18 or
newer is required. The app has no external npm dependencies.

1. Create an API key in your OpenAI account.
2. In PowerShell, open this folder and set the key for this terminal:

   ```powershell
   $env:OPENAI_API_KEY = "your-api-key"
   npm start
   ```

3. Open <http://localhost:3000> in your browser.

The key stays on the server and must not be added to `index.html` or `App.js`.
Photo scanning sends the selected image to OpenAI for analysis; the app does
not save the photo. Scanning requires internet access and may incur API charges.
You can still use the tracker without configuring a key, but photo scanning
will be unavailable.

Run `npm run check` to check the JavaScript syntax.
