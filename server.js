const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const API_KEY = process.env.OPENAI_API_KEY;
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/App.js": ["App.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"]
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
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

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${HOST}`).pathname;
  if (request.method === "POST" && pathname === "/api/scan") {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Send the photo as JSON." });
      return;
    }
    try {
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
    console.warn("Photo scanning is disabled. Set OPENAI_API_KEY and restart the server.");
  }
});
