import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Robustly load .env from the exact directory where server.ts lives
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("CRITICAL ERROR: GEMINI_API_KEY is undefined. The .env file was not loaded correctly.");
        return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is missing." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Find ${count} real business leads for the industry "${industry}" in "${location}". 
      Use Google Search to find actual, real-world businesses.
      For each business, provide the business name, email address (if available, otherwise null), mobile/phone number (if available, otherwise null), website URL (if available, otherwise null), and full physical address.
      Return the data as a JSON array of objects.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                business_name: { type: Type.STRING },
                email: { type: Type.STRING, nullable: true },
                mobile: { type: Type.STRING, nullable: true },
                website: { type: Type.STRING, nullable: true },
                address: { type: Type.STRING, nullable: true },
              },
              required: ["business_name"],
            },
          },
        },
      });

      const text = response.text;
      if (!text) {
         throw new Error("No response from AI");
      }

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
