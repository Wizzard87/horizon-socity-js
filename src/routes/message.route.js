import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { sendMessage, getConversations, getMessages, updateMessage, deleteMessage } from "../controllers/message.controller.js";
import upload from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(protectRoute);

router.post("/", upload.single("image"), sendMessage);
router.get("/conversations", getConversations);
router.get("/:conversationId", getMessages);
router.put("/:messageId", updateMessage);
router.delete("/:messageId", deleteMessage);

export default router;
