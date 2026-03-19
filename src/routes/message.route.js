import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { sendMessage, getConversations, getMessages } from "../controllers/message.controller.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", sendMessage);
router.get("/conversations", getConversations);
router.get("/:conversationId", getMessages);

export default router;
