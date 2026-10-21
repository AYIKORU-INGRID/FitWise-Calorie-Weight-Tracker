# WEIGHT-TRACKER
A weight loss tracker and calorie tracker.

## Run

The tracker uses a small Node.js server for AI meal-photo analysis and its
optional coaching chat. Node.js 18 or newer is required. The app has no
external npm dependencies.

1. Create an API key in your OpenAI account.
2. In PowerShell, open this folder and set the key for this terminal:

   ```powershell
   $env:OPENAI_API_KEY = "your-api-key"
   npm start
   ```

3. Open <http://localhost:3000> in your browser.

The key stays on the server and must not be added to `index.html` or `App.js`.
The coach sends your messages to OpenAI to generate replies; chat history is
kept only in the current browser page. Photo scanning sends the selected image
to OpenAI for analysis; the app does not save the photo. These AI features
require internet access and may incur API charges. You can use the tracker
without configuring a key, but the AI features will be unavailable.

Run `npm run check` to check the JavaScript syntax.
