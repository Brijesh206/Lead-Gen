import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

      // Proxy the request to your external Oracle backend
      // Note: Adjust the path '/api/generate-leads' if your Oracle server uses a different endpoint
      const oracleBackendUrl = "http://141.148.217.84:3001/api/generate-leads";
      
      const response = await fetch(oracleBackendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ industry, location, count }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Oracle server responded with ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // Normalize response to ensure it matches the { leads: [...] } format expected by the frontend
      const leads = Array.isArray(data) ? data : (data.leads || []);
      
      res.json({ leads });
    } catch (error: any) {
      console.error("Error proxying to Oracle backend:", error);
      res.status(500).json({ error: error.message || "Failed to generate leads from Oracle backend" });
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
