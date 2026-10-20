# WEIGHT-TRACKER
A weight loss tracker and calorie tracker.

## Run

The tracker uses a small Node.js server for AI photo analysis. Node.js 18 or
newer is required; no npm packages are needed.

1. Create an API key in your OpenAI account.
2. In PowerShell, open this folder and set the key for this terminal:

   ```powershell
   $env:OPENAI_API_KEY = "your-api-key"
   node .\server.js
   ```

3. Open <http://localhost:3000> in your browser.

The key stays on the server and must not be added to `index.html` or `App.js`.
Photo scanning sends the selected image to OpenAI for analysis; the app does
not save the photo. Scanning requires internet access and may incur API charges.
You can still use the tracker without configuring a key, but photo scanning
will be unavailable.
