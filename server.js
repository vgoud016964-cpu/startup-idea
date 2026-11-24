
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "20kb" }));

let database;

app.get("/", (req, res) => {
  res.json({
    message: "SOLOCARE API is running",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing");
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    database = client.db("SOLOCARE");

    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`SOLOCARE API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
