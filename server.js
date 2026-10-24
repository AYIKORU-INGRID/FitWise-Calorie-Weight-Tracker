const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
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

const HOST = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const PORT = Number(process.env.PORT || 3000);
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
// Server-only secret. Never put this in App.js, index.html or any file the browser can load.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_PROVIDER = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai")).toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const FREE_SCANS_PER_DAY = intEnv("FREE_SCANS_PER_DAY", 2);
const PREMIUM_SCANS_PER_DAY = intEnv("PREMIUM_SCANS_PER_DAY", 30);
const ALLOW_UNLIMITED_SCANS = process.env.ALLOW_UNLIMITED_SCANS === "true";
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_SECRET_HASH = process.env.FLW_SECRET_HASH;
const FLW_PLAN_ID = process.env.FLW_PLAN_ID;
const APP_URL = process.env.APP_URL;
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/App.js": ["App.js", "text/javascript; charset=utf-8"],
  "/app.js": ["App.js", "text/javascript; charset=utf-8"],
    "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/privacy": ["privacy.html", "text/html; charset=utf-8"],
  "/privacy.html": ["privacy.html", "text/html; charset=utf-8"],
  "/terms": ["terms.html", "text/html; charset=utf-8"],
  "/terms.html": ["terms.html", "text/html; charset=utf-8"],
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
  if (!user || typeof user.id !== "string") {
    const error = new Error("Supabase returned an invalid sign-in response.");
    error.status = 502;
    throw error;
  }
  return user;
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

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function aiConfigured() {
  return AI_PROVIDER === "gemini" ? Boolean(GEMINI_API_KEY) : Boolean(API_KEY);
}

/* ---- plans and daily scan limits (Supabase, using the server-only service key) ---- */
function adminFetch(restPath, options = {}) {
  return fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${restPath}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
}

function planError(cause) {
  console.error("Plan check failed:", cause && cause.message);
  const error = new Error("Could not check your plan. Please try again.");
  error.status = 502;
  return error;
}

async function getPlan(userId) {
  if (!SUPABASE_SERVICE_KEY) {
    return { configured: false, premium: false, premiumUntil: null, limit: FREE_SCANS_PER_DAY };
  }
  let rows;
  try {
    const res = await adminFetch(`subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=premium_until,subscription_status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = await res.json();
  } catch (cause) {
    throw planError(cause);
  }
  const until = rows && rows[0] && rows[0].premium_until ? new Date(rows[0].premium_until) : null;
  const premium = Boolean(until) && until.getTime() > Date.now();
  return {
    configured: true,
    premium,
    premiumUntil: premium ? until.toISOString() : null,
    subscriptionStatus: rows && rows[0] ? rows[0].subscription_status || "active" : null,
    limit: premium ? PREMIUM_SCANS_PER_DAY : FREE_SCANS_PER_DAY
  };
}

async function scansUsedToday(userId) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
  try {
    const res = await adminFetch(`scan_usage?user_id=eq.${encodeURIComponent(userId)}&day=eq.${day}&select=count`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    return rows && rows[0] ? Number(rows[0].count) || 0 : 0;
  } catch (cause) {
    throw planError(cause);
  }
}

async function useScan(userId, limit) {
  try {
    const res = await adminFetch("rpc/use_scan", { method: "POST", body: JSON.stringify({ p_user: userId, p_limit: limit }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) === true;
  } catch (cause) {
    throw planError(cause);
  }
}

async function refundScan(userId) {
  try {
    await adminFetch("rpc/refund_scan", { method: "POST", body: JSON.stringify({ p_user: userId }) });
  } catch (cause) {
    console.error("Could not refund a scan:", cause.message);
  }
}

function appOrigin() {
  try {
    const url = new URL(APP_URL);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function purchaseConfigured() {
  return Boolean(SUPABASE_SERVICE_KEY && FLW_SECRET_KEY && FLW_SECRET_HASH &&
    /^\d+$/.test(FLW_PLAN_ID || "") && Number.isSafeInteger(Number(FLW_PLAN_ID)) &&
    Number(FLW_PLAN_ID) > 0 && appOrigin());
}

function purchaseError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeSecretEqual(value, expected) {
  if (typeof value !== "string" || !expected) return false;
  const received = Buffer.from(value);
  const secret = Buffer.from(expected);
  return received.length === secret.length && crypto.timingSafeEqual(received, secret);
}

async function flutterwaveRequest(pathname, options = {}) {
  let response;
  try {
    response = await fetch(`https://api.flutterwave.com/v3/${pathname}`, {
      ...options,
      headers: {
        Authorization: "Bearer " + FLW_SECRET_KEY,
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(15000)
    });
  } catch (cause) {
    console.error("Flutterwave request failed:", cause.message);
    throw purchaseError("Could not reach Flutterwave. Please try again.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw purchaseError("Flutterwave returned an invalid response.");
  }
  if (!response.ok || result.status !== "success") {
    console.error("Flutterwave API error:", response.status, result.message || "unknown error");
    throw purchaseError("Flutterwave could not process the request. Please try again.");
  }
  return result.data;
}

async function getCheckout(txRef) {
  const response = await adminFetch(`flutterwave_checkouts?tx_ref=eq.${encodeURIComponent(txRef)}&select=tx_ref,user_id,email,amount,currency,plan_id,status`);
  if (!response.ok) throw purchaseError("Could not load the payment record.");
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getPendingCheckout(userId) {
  const response = await adminFetch(`flutterwave_checkouts?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&select=tx_ref,checkout_url&order=created_at.desc&limit=1`);
  if (!response.ok) throw purchaseError("Could not check your pending payment.");
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function markCheckoutFailed(txRef) {
  const response = await adminFetch(`flutterwave_checkouts?tx_ref=eq.${encodeURIComponent(txRef)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "failed" })
  });
  if (!response.ok) console.error("Could not mark Flutterwave checkout as failed:", txRef);
}

async function recordPremiumPayment(checkout, transactionId, tx) {
  const paidEmail = tx.customer && typeof tx.customer.email === "string" ? tx.customer.email.toLowerCase() : "";
  if (tx.status !== "successful" || tx.tx_ref !== checkout.tx_ref ||
      tx.currency !== "UGX" || !Number.isFinite(Number(tx.amount)) || Number(tx.amount) < 2000 ||
      (paidEmail && paidEmail !== checkout.email.toLowerCase()) ||
      (tx.payment_plan && String(tx.payment_plan) !== String(FLW_PLAN_ID))) {
    throw purchaseError("The payment details did not match this subscription.", 400);
  }
  const response = await adminFetch("rpc/activate_flutterwave_payment", {
    method: "POST",
    body: JSON.stringify({
      p_transaction_id: String(transactionId),
      p_tx_ref: checkout.tx_ref,
      p_user_id: checkout.user_id,
      p_email: checkout.email.toLowerCase(),
      p_plan_id: String(FLW_PLAN_ID),
      p_amount: Number(tx.amount),
      p_currency: tx.currency
    })
  });
  if (!response.ok) throw purchaseError("Could not activate Premium. Please contact support.");
  const update = await adminFetch(`flutterwave_checkouts?tx_ref=eq.${encodeURIComponent(checkout.tx_ref)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "paid", transaction_id: String(transactionId) })
  });
  if (!update.ok) throw purchaseError("Payment was received, but its status could not be saved. Please contact support.");
}

async function verifyFlutterwaveTransaction(transactionId) {
  return flutterwaveRequest(`transactions/${encodeURIComponent(transactionId)}/verify`);
}

async function processFlutterwaveWebhook(payload) {
  const data = payload && payload.data;
  if (!data) return;
  if (payload.event === "subscription.cancelled") {
    const email = data.customer && data.customer.email;
    const planId = data.plan && data.plan.id;
    if (!email || String(planId) !== String(FLW_PLAN_ID)) return;
    const response = await adminFetch(`subscriptions?email=eq.${encodeURIComponent(email.toLowerCase())}&provider_plan_id=eq.${encodeURIComponent(String(FLW_PLAN_ID))}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ subscription_status: "cancelled", updated_at: new Date().toISOString() })
    });
    if (!response.ok) throw purchaseError("Could not save the subscription cancellation.");
    return;
  }
  if (payload.event !== "charge.completed" || data.status !== "successful" ||
      (typeof data.id !== "string" && typeof data.id !== "number") || !/^\d{1,20}$/.test(String(data.id))) return;
  const tx = await verifyFlutterwaveTransaction(data.id);
  const txRef = typeof tx.tx_ref === "string" ? tx.tx_ref : "";
  const checkout = txRef ? await getCheckout(txRef) : null;
  if (checkout) {
    await recordPremiumPayment(checkout, data.id, tx);
    return;
  }
  const planId = tx.payment_plan || tx.plan_id || (tx.meta && tx.meta.payment_plan);
  const email = tx.customer && typeof tx.customer.email === "string" ? tx.customer.email.toLowerCase() : "";
  if (!email || String(planId) !== String(FLW_PLAN_ID) || tx.status !== "successful" ||
      tx.currency !== "UGX" || !Number.isFinite(Number(tx.amount)) || Number(tx.amount) < 2000) {
    console.warn("Ignoring Flutterwave renewal without matching verified subscription details:", data.id);
    return;
  }
  const response = await adminFetch(`subscriptions?email=eq.${encodeURIComponent(email)}&provider_plan_id=eq.${encodeURIComponent(String(FLW_PLAN_ID))}&select=user_id,email`);
  if (!response.ok) throw purchaseError("Could not find the subscription for a renewal.");
  const rows = await response.json();
  const subscription = Array.isArray(rows) ? rows[0] : null;
  if (!subscription) return;
  await recordPremiumPayment({
    tx_ref: txRef,
    user_id: subscription.user_id,
    email: subscription.email
  }, data.id, tx);
}

/* ---- photo scan providers ---- */
const SCAN_SYSTEM_PROMPT = "Estimate foods and portions visible in a meal photo for a personal food diary. Do not claim certainty. Return only a JSON object with this shape: {\"foods\":[{\"name\":\"food name\",\"portion\":\"estimated portion\",\"calories\":123}],\"notes\":\"short uncertainty note\"}. Give one entry per identifiable food, estimate calories for the visible portion, use integer calories from 1 to 5000, and return an empty foods array if no food is identifiable. Do not infer ingredients that are not visible. Foods may be East African dishes such as matooke, posho, rolex, beans, luwombo or katogo.";

async function scanImage(image) {
  return AI_PROVIDER === "gemini" ? scanImageGemini(image) : scanImageOpenAI(image);
}

async function scanImageGemini(image) {
  if (!GEMINI_API_KEY) {
    const error = new Error("Photo scanning is not configured. Set GEMINI_API_KEY in .env and restart the server.");
    error.status = 503;
    throw error;
  }
  const data = image.slice(image.indexOf(",") + 1);
  let upstream;
  try {
    upstream = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SCAN_SYSTEM_PROMPT }] },
        contents: [{
          role: "user",
          parts: [
            { text: "Identify the visible foods and estimate calories for the portions shown." },
            { inlineData: { mimeType: "image/jpeg", data } }
          ]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800, responseMimeType: "application/json" }
      })
    });
  } catch (cause) {
    const failure = new Error(
      cause.name === "TimeoutError"
        ? "The AI scan timed out. Try again."
        : "Could not reach the AI service. Check your internet connection and try again."
    );
    failure.status = cause.name === "TimeoutError" ? 504 : 502;
    throw failure;
  }
  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => "")).slice(0, 300);
    console.error(`Gemini returned HTTP ${upstream.status}: ${detail}`);
    const error = new Error(
      upstream.status === 429
        ? "The free AI quota is used up for now. Try again later, or search the food list."
        : upstream.status === 400 || upstream.status === 401 || upstream.status === 403 || upstream.status === 404
          ? "Google rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL in .env."
          : `The AI service could not analyze this photo (HTTP ${upstream.status}).`
    );
    error.status = upstream.status === 429 ? 503 : 502;
    throw error;
  }
  try {
    const completion = await upstream.json();
    const parts = completion.candidates[0].content.parts;
    const text = parts.map((part) => part.text || "").join("").replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
    return validateAnalysis(JSON.parse(text));
  } catch (cause) {
    if (cause.status) throw cause;
    console.error("Invalid analysis response from Gemini:", cause.message);
    const failure = new Error("The AI returned an unreadable result. Try another photo.");
    failure.status = 502;
    throw failure;
  }
}
async function scanImageOpenAI(image) {
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
  if (request.method === "GET" && pathname === "/healthz") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method === "GET" && pathname === "/api/config") {
    sendJson(response, 200, {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
    });
    return;
  }
  if (request.method === "POST" && pathname === "/api/purchase/checkout") {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Send checkout requests as JSON." });
      return;
    }
    try {
      if (!purchaseConfigured()) throw purchaseError("Purchases are not configured on this server.", 503);
      if (!aiConfigured()) throw purchaseError("Photo scanning is not enabled on this server yet.", 503);
      const user = await requireAuthenticatedUser(request);
      if (!user.email) throw purchaseError("Your account needs an email address to subscribe.", 400);
      const plan = await getPlan(user.id);
      if (plan.premium) throw purchaseError("Your Premium subscription is already active.", 409);
      const expiredAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const expireOldCheckouts = await adminFetch(`flutterwave_checkouts?user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending&created_at=lt.${encodeURIComponent(expiredAt)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed" })
      });
      if (!expireOldCheckouts.ok) throw purchaseError("Could not expire an old checkout attempt.");
      const pendingCheckout = await getPendingCheckout(user.id);
      if (pendingCheckout) {
        if (pendingCheckout.checkout_url) {
          sendJson(response, 200, { checkoutUrl: pendingCheckout.checkout_url });
          return;
        }
        throw purchaseError("A checkout is already being prepared. Please try again shortly.", 409);
      }
      const txRef = `fitwise-${crypto.randomUUID()}`;
      const checkoutInsert = await adminFetch("flutterwave_checkouts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          tx_ref: txRef,
          user_id: user.id,
          email: user.email.toLowerCase(),
          amount: 2000,
          currency: "UGX",
          plan_id: String(FLW_PLAN_ID),
          status: "pending"
        })
      });
      if (!checkoutInsert.ok) {
        console.error("Could not create Flutterwave checkout record:", checkoutInsert.status);
        const pending = await getPendingCheckout(user.id);
        if (pending && pending.checkout_url) {
          sendJson(response, 200, { checkoutUrl: pending.checkout_url });
          return;
        }
        if (pending) throw purchaseError("A checkout is already being prepared. Please try again shortly.", 409);
        throw purchaseError("Could not prepare your subscription. Please try again.");
      }
      let checkout;
      try {
        checkout = await flutterwaveRequest("payments", {
          method: "POST",
          body: JSON.stringify({
            tx_ref: txRef,
            amount: 2000,
            currency: "UGX",
            payment_plan: Number(FLW_PLAN_ID),
            payment_options: "card",
            session_duration: 60,
            redirect_url: `${appOrigin()}/`,
            customer: { email: user.email, name: user.user_metadata && user.user_metadata.full_name || user.email },
            customizations: {
              title: "FitWise Premium",
              description: "Monthly photo-scanning subscription"
            },
            meta: { tx_ref: txRef, user_id: user.id }
          })
        });
      } catch (error) {
        await markCheckoutFailed(txRef);
        throw error;
      }
      let checkoutUrl;
      try {
        checkoutUrl = new URL(checkout.link);
      } catch {
        await markCheckoutFailed(txRef);
        throw purchaseError("Flutterwave returned an invalid checkout URL.");
      }
      if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.flutterwave.com") {
        await markCheckoutFailed(txRef);
        throw purchaseError("Flutterwave returned an invalid checkout URL.");
      }
      const savedCheckout = await adminFetch(`flutterwave_checkouts?tx_ref=eq.${encodeURIComponent(txRef)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ checkout_url: checkoutUrl.toString() })
      });
      if (!savedCheckout.ok) console.error("Could not save Flutterwave checkout URL for:", txRef);
      sendJson(response, 200, { checkoutUrl: checkoutUrl.toString() });
    } catch (error) {
      if (error.status >= 500) console.error("Premium checkout failed:", error.message);
      sendJson(response, error.status || 500, { error: error.message || "Could not start checkout." });
    }
    return;
  }
  if (request.method === "POST" && pathname === "/api/purchase/verify") {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Send payment verification requests as JSON." });
      return;
    }
    try {
      if (!purchaseConfigured()) throw purchaseError("Purchases are not configured on this server.", 503);
      const user = await requireAuthenticatedUser(request);
      const body = await readJson(request);
      const txRef = body && body.txRef;
      const transactionId = body && body.transactionId;
      if (typeof txRef !== "string" || !/^fitwise-[0-9a-f-]{36}$/.test(txRef) ||
          (typeof transactionId !== "string" && typeof transactionId !== "number") ||
          !/^\d{1,20}$/.test(String(transactionId))) {
        throw purchaseError("Invalid payment reference.", 400);
      }
      const checkout = await getCheckout(txRef);
      if (!checkout) throw purchaseError("Could not find this payment attempt.", 404);
      if (checkout.user_id !== user.id) throw purchaseError("This payment belongs to another account.", 403);
      const tx = await verifyFlutterwaveTransaction(transactionId);
      await recordPremiumPayment(checkout, transactionId, tx);
      sendJson(response, 200, { premium: true });
    } catch (error) {
      if (error.status >= 500) console.error("Premium payment verification failed:", error.message);
      sendJson(response, error.status || 500, { error: error.message || "Could not verify payment." });
    }
    return;
  }
  if (request.method === "POST" && pathname === "/api/flutterwave/webhook") {
    if (!FLW_SECRET_HASH || !safeSecretEqual(request.headers["verif-hash"], FLW_SECRET_HASH)) {
      sendJson(response, 401, { error: "Invalid webhook signature." });
      return;
    }
    try {
      const payload = await readJson(request);
      await processFlutterwaveWebhook(payload);
      sendJson(response, 200, { received: true });
    } catch (error) {
      console.error("Flutterwave webhook processing failed:", error.message);
      sendJson(response, error.status && error.status < 500 ? error.status : 500, { error: "Webhook could not be processed." });
    }
    return;
  }
  if (request.method === "GET" && pathname === "/api/plan") {
    try {
      const user = await requireAuthenticatedUser(request);
      const plan = await getPlan(user.id);
      const used = plan.configured ? await scansUsedToday(user.id) : 0;
      sendJson(response, 200, {
        configured: plan.configured && aiConfigured(),
        premium: plan.premium,
        premiumUntil: plan.premiumUntil,
        subscriptionStatus: plan.subscriptionStatus,
        purchaseConfigured: purchaseConfigured() && aiConfigured(),
        limit: plan.limit,
        used,
        left: Math.max(plan.limit - used, 0)
      });
    } catch (error) {
      if (error.status >= 500) console.error("Plan lookup failed:", error.message);
      sendJson(response, error.status || 500, { error: error.message || "Plan lookup failed." });
    }
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
            const user = await requireAuthenticatedUser(request);
      const body = await readJson(request);
      const image = parseImage(body && body.image);
      if (!aiConfigured()) {
        const error = new Error("Photo scanning is not switched on for this app. You can search the food list instead.");
        error.status = 503;
        throw error;
      }
      const plan = await getPlan(user.id);
      if (plan.configured) {
        if (!(await useScan(user.id, plan.limit))) {
          const error = new Error("You have used today’s photo scans. They reset at midnight (Kampala time). You can still search the food list.");
          error.status = 429;
          throw error;
        }
      } else if (!ALLOW_UNLIMITED_SCANS) {
        const error = new Error("Photo scanning is off until scan limits are set up on the server.");
        error.status = 503;
        throw error;
      }
      try {
        sendJson(response, 200, await scanImage(image));
      } catch (scanError) {
        if (plan.configured) await refundScan(user.id);
        throw scanError;
      }
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
    if (!aiConfigured()) {
    console.warn(`Photo scanning is off. Set ${AI_PROVIDER === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} in .env and restart the server.`);
  } else if (!SUPABASE_SERVICE_KEY && !ALLOW_UNLIMITED_SCANS) {
    console.warn("Photo scanning stays off until scan limits are set up. Add SUPABASE_SERVICE_ROLE_KEY to .env (see README).");
  }
});
