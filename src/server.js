import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import 'dotenv/config';
import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import commentRoutes from "./routes/comment.route.js";
import notificationRoutes from "./routes/notification.route.js";
import messageRoutes from "./routes/message.route.js";
import newsRoutes from "./routes/news.route.js";

import { connectDB } from "./config/db.js";
import { arcjetMiddleware } from "./middleware/arcjet.middleware.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// раздаем статику из папки uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// жестко задаем порт
const PORT = 3000;
const NODE_ENV = process.env.NODE_ENV || "production";

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
app.use(clerkMiddleware());
app.use(arcjetMiddleware);

// тестовый роут
app.get("/", (req, res) => res.send("Hello from server"));

// подключаем маршруты
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/news", newsRoutes);

// обработка ошибок
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const startServer = async () => {
  try {
    // подключаем базу
    await connectDB();

    // запускаем сервер
    app.listen(PORT, () => {
      console.log(`Server is up and running on PORT: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

// экспортируем для Vercel или других платформ
export default app;