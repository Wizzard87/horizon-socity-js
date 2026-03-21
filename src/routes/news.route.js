import express from "express";
import { getNewsPosts, createNewsPost } from "../controllers/news.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// public — anyone can read news
router.get("/", getNewsPosts);

// protected — only admins can post (checked in controller)
router.post("/", protectRoute, createNewsPost);

export default router;
