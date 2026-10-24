const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
// Load a local .env file (KEY=value per line) without overriding variables already set.
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith("#")) continue;
    let value = match[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
} catch {}

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/App.js": ["App.js", "text/javascript; charset=utf-8"],
  "/app.js": ["App.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/logo.png": ["logo.png", "image/png"]
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

async function requireAuthenticatedUser(request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const error = new Error("Supabase is not configured on the server.");
    error.status = 503;
    throw error;
  }
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) {
    const error = new Error("Sign in to use this feature.");
    error.status = 401;
    throw error;
  }
  let response;
  try {
    response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authorization
      },
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    const error = new Error("Could not verify your sign-in with Supabase. Try again.");
    error.status = 502;
    throw error;
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error("Your sign-in has expired. Sign in again to continue.");
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error("Could not verify your sign-in with Supabase. Try again.");
    error.status = 502;
    throw error;
  }
  let user;
  try {
    user = await response.json();
  } catch {
    const error = new Error("Supabase returned an invalid sign-in response.");
    error.status = 502;
    throw error;
  }
  if (!user || typeof user.id !== "string") {
    const error = new Error("Supabase returned an invalid sign-in response.");
    error.status = 502;
    throw error;
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      request.resume();
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request must contain valid JSON.");
    error.status = 400;
    throw error;
  }
}

function parseImage(value) {
  if (typeof value !== "string" || value.length > MAX_REQUEST_BYTES) {
    const error = new Error("Choose a smaller photo and try again.");
    error.status = 400;
    throw error;
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) {
    const error = new Error("The photo could not be read. Choose a JPEG-compatible image.");
    error.status = 400;
    throw error;
  }
  const image = Buffer.from(match[1], "base64");
  if (
    image.length < 3 ||
    image.length > MAX_IMAGE_BYTES ||
    image[0] !== 0xff ||
    image[1] !== 0xd8 ||
    image[2] !== 0xff
  ) {
    const error = new Error("The photo is invalid or too large. Choose another image.");
    error.status = 400;
    throw error;
  }
  return value;
}

function validateAnalysis(value) {
  if (!value || !Array.isArray(value.foods) || value.foods.length > 10) {
    throw new Error("The AI returned an invalid food list.");
  }
  const foods = value.foods.map((food) => {
    if (
      !food ||
      typeof food.name !== "string" ||
      !food.name.trim() ||
      food.name.length > 80 ||
      typeof food.portion !== "string" ||
      !food.portion.trim() ||
      food.portion.length > 80 ||
      !Number.isInteger(food.calories) ||
      food.calories < 1 ||
      food.calories > 5000
    ) {
      throw new Error("The AI returned invalid food details.");
    }
    return {
      name: food.name.trim(),
      portion: food.portion.trim(),
      calories: food.calories
    };
  });
  return {
    foods,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 300) : ""
  };
}

async function scanImage(image) {
  if (!API_KEY) {
    const error = new Error("Photo scanning is not configured. Set OPENAI_API_KEY in the server terminal and restart it.");
    error.status = 503;
    throw error;
  }

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Estimate foods and portions visible in a meal photo for a personal food diary. Do not claim certainty. Return only a JSON object with this shape: {\"foods\":[{\"name\":\"food name\",\"portion\":\"estimated portion\",\"calories\":123}],\"notes\":\"short uncertainty note\"}. Give one entry per identifiable food, estimate calories for the visible portion, use integer calories from 1 to 5000, and return an empty foods array if no food is identifiable. Do not infer ingredients that are not visible."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the visible foods and estimate calories for the portions shown." },
              { type: "image_url", image_url: { url: image, detail: "high" } }
            ]
          }
        ]
      })
    });
  } catch (error) {
    const failure = new Error(
      error.name === "TimeoutError"
        ? "The AI scan timed out. Try again."
        : "Could not reach the AI service. Check your internet connection and try again."
    );
    failure.status = error.name === "TimeoutError" ? 504 : 502;
    throw failure;
  }

  if (!upstream.ok) {
    if (upstream.status === 401) {
      const error = new Error("OpenAI rejected the API key. Check OPENAI_API_KEY in the server terminal.");
      error.status = 502;
      throw error;
    }
    if (upstream.status === 429) {
      const error = new Error("The AI service is rate-limited or out of API credit. Check your OpenAI account and try again.");
      error.status = 503;
      throw error;
    }
    const error = new Error(`The AI service could not analyze this photo (HTTP ${upstream.status}).`);
    error.status = 502;
    throw error;
  }

  let completion;
  try {
    completion = await upstream.json();
    const content = completion.choices[0].message.content;
    return validateAnalysis(JSON.parse(content));
  } catch (error) {
    if (error.status) throw error;
    console.error("Invalid analysis response from OpenAI:", error.message);
    const failure = new Error("The AI returned an unreadable result. Try another photo.");
    failure.status = 502;
    throw failure;
  }
}

function validateChatMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
    const error = new Error("Send between 1 and 12 chat messages.");
    error.status = 400;
    throw error;
  }
  const messages = value.map((message) => {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > 1200
    ) {
      const error = new Error("A chat message is invalid or too long.");
      error.status = 400;
      throw error;
    }
    return { role: message.role, content: message.content.trim() };
  });
  if (messages[messages.length - 1].role !== "user") {
    const error = new Error("Your latest chat message must be from you.");
    error.status = 400;
    throw error;
  }
  return messages;
}

function validateChatContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("Tracker context is missing or invalid.");
    error.status = 400;
    throw error;
  }
  const validNumber = (number, min, max) =>
    typeof number === "number" && Number.isFinite(number) && number >= min && number <= max;
  if (
    !validNumber(value.dailyCalories, 800, 6000) ||
    !validNumber(value.caloriesEaten, 0, 100000) ||
    !validNumber(value.waterGlasses, 0, 40) ||
    (value.latestWeight !== null && !validNumber(value.latestWeight, 20, 400)) ||
    (value.goalWeight !== null && !validNumber(value.goalWeight, 20, 400))
  ) {
    const error = new Error("Tracker context contains invalid values.");
    error.status = 400;
    throw error;
  }
  return {
    dailyCalories: value.dailyCalories,
    caloriesEaten: value.caloriesEaten,
    waterGlasses: value.waterGlasses,
    latestWeight: value.latestWeight,
    goalWeight: value.goalWeight
  };
}

async function chat(messages, context) {
  if (!API_KEY) {
    const error = new Error("The coach is not configured. Set OPENAI_API_KEY in the server terminal and restart it.");
    error.status = 503;
    throw error;
  }

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "You are a friendly, practical in-app coach for a calorie and weight tracker. Keep answers under 120 words, concise, encouraging, and non-judgmental. Focus on this app, food, fitness, and sustainable healthy habits; consider foods familiar in Uganda when useful. Give general guidance only, not diagnoses or individualized medical advice. Never suggest very low-calorie diets, extreme fasting, meal skipping, purging, or unsafe exercise. If the user mentions an eating disorder, health condition, pregnancy, concerning symptoms, or feeling unwell, kindly suggest they consult a doctor or dietitian. Do not ask for sensitive personal information. The following tracker values are an approximate snapshot supplied by the app; use them only when relevant and do not infer information that is not included: " +
              JSON.stringify(context)
          },
          ...messages
        ]
      })
    });
  } catch (error) {
    const failure = new Error(
      error.name === "TimeoutError"
        ? "The coach took too long to respond. Please try again."
        : "Could not reach the AI service. Check your internet connection and try again."
    );
    failure.status = error.name === "TimeoutError" ? 504 : 502;
    throw failure;
  }

  if (!upstream.ok) {
    if (upstream.status === 401) {
      const error = new Error("OpenAI rejected the API key. Check OPENAI_API_KEY in the server terminal.");
      error.status = 502;
      throw error;
    }
    if (upstream.status === 429) {
      const error = new Error("The AI service is rate-limited or out of API credit. Check your OpenAI account and try again.");
      error.status = 503;
      throw error;
    }
    const error = new Error(`The AI service could not answer this message (HTTP ${upstream.status}).`);
    error.status = 502;
    throw error;
  }

  try {
    const completion = await upstream.json();
    const reply = completion.choices[0].message.content;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("Missing chat response.");
    return { reply: reply.trim().slice(0, 4000) };
  } catch (error) {
    console.error("Invalid chat response from OpenAI:", error.message);
    const failure = new Error("The coach returned an unreadable response. Please try again.");
    failure.status = 502;
    throw failure;
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${HOST}`).pathname;
  if (request.method === "GET" && pathname === "/api/config") {
    sendJson(response, 200, {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
    });
    return;
  }
  if (request.method === "POST" && pathname === "/api/chat") {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Send chat messages as JSON." });
      return;
    }
    try {
      await requireAuthenticatedUser(request);
      const body = await readJson(request);
      const messages = validateChatMessages(body && body.messages);
      const context = validateChatContext(body && body.context);
      sendJson(response, 200, await chat(messages, context));
    } catch (error) {
      if (error.status >= 500) console.error("Coach chat failed:", error.message);
      sendJson(response, error.status || 500, { error: error.message || "Coach chat failed." });
    }
    return;
  }
  if (request.method === "POST" && pathname === "/api/scan") {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Send the photo as JSON." });
      return;
    }
    try {
      await requireAuthenticatedUser(request);
      const body = await readJson(request);
      const image = parseImage(body && body.image);
      sendJson(response, 200, await scanImage(image));
    } catch (error) {
      if (error.status >= 500) console.error("Photo scan failed:", error.message);
      sendJson(response, error.status || 500, { error: error.message || "Photo scan failed." });
    }
    return;
  }

  const file = STATIC_FILES[pathname];
  if (request.method !== "GET" || !file) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  const filePath = path.join(__dirname, file[0]);
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      console.error("Could not serve app file:", error.message);
      sendJson(response, 500, { error: "Could not load the app." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(contents);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Weight tracker ready at http://${HOST}:${PORT}`);
  if (!API_KEY) {
    console.warn("AI features are disabled. Set OPENAI_API_KEY and restart the server.");
  }
});
