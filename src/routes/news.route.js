import express from "express";
import multer from "multer";
import { getNewsPosts, createNewsPost } from "../controllers/news.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Custom multer for APK / any file uploads in news
const newsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for APKs
});

// public — anyone can read news
router.get("/", getNewsPosts);

// protected — only admins can post (checked in controller)
router.post("/", protectRoute, newsUpload.single("file"), createNewsPost);

export default router;
