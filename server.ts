import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Robustly load .env from the exact directory where server.ts lives
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";

async function startServer() {
  const app = express();
  // AI Studio requires 3000 for the preview to work. 
  // Change this to 3001 when running on your Oracle server!
  const PORT = 3000;

  // Enable CORS so your Vercel frontend can call this Oracle backend directly if needed
  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-leads", async (req, res) => {
    try {
      const { industry, location, count } = req.body;

      if (!industry || !location || !count) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        console.error("CRITICAL ERROR: NVIDIA_API_KEY is undefined. The .env file was not loaded correctly.");
        return res.status(500).json({ error: "Server configuration error: NVIDIA_API_KEY is missing." });
      }

      const prompt = `Find ${count} real business leads for the industry "${industry}" in "${location}". 
      Provide actual, real-world businesses based on your knowledge.
      For each business, provide the business name, email address (if available, otherwise null), mobile/phone number (if available, otherwise null), website URL (if available, otherwise null), and full physical address.
      You MUST return ONLY a valid JSON array of objects. Do not include markdown formatting like \`\`\`json.
      
      Example format:
      [
        {
          "business_name": "Example Corp",
          "email": "contact@example.com",
          "mobile": "+1234567890",
          "website": "https://example.com",
          "address": "123 Main St, City, Country"
        }
      ]`;

      const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages: [
            { 
              role: "system", 
              content: "You are a helpful lead generation assistant. You only respond with valid JSON arrays containing the requested data. Do not include any conversational text." 
            },
            { 
              role: "user", 
              content: prompt 
            }
          ],
          temperature: 0.2,
          max_tokens: 2048,
        })
      });

      if (!nvidiaResponse.ok) {
        const errorText = await nvidiaResponse.text();
        throw new Error(`NVIDIA API Error: ${nvidiaResponse.status} - ${errorText}`);
      }

      const data = await nvidiaResponse.json();
      let text = data.choices[0].message.content;

      // Clean up markdown formatting if the model includes it
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      const leads = JSON.parse(text);
      res.json({ leads });
    } catch (error: any) {
      console.error("Error generating leads:", error);
      res.status(500).json({ error: error.message || "Failed to generate leads" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
