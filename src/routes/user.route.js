import express from "express";
import {
  followUser,
  getCurrentUser,
  getUserProfile,
  syncUser,
  updateProfile,
  searchUsers,
  registerPushToken,
  getOnlineStats,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// public route
router.get("/profile/:username", getUserProfile);

// protected routes
router.get("/search", protectRoute, searchUsers);
router.post("/sync", protectRoute, syncUser);
router.get("/me", protectRoute, getCurrentUser);
router.put("/profile", protectRoute, updateProfile);
router.put("/push-token", protectRoute, registerPushToken);
router.get("/online-stats", protectRoute, getOnlineStats);
router.post("/follow/:targetUserId", protectRoute, followUser);

export default router;
