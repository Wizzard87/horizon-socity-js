import asyncHandler from "express-async-handler";
import NewsPost from "../models/newsPost.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";
import { Expo } from "expo-server-sdk";
import cloudinary from "../config/cloudinary.js";

const expo = new Expo();

export const getNewsPosts = asyncHandler(async (req, res) => {
  const posts = await NewsPost.find()
    .sort({ createdAt: -1 })
    .populate("author", "username firstName lastName profilePicture isAdmin");

  res.status(200).json({ posts });
});

export const createNewsPost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Content is required" });
  }

  const user = await User.findOne({ clerkId: userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.isAdmin) {
    return res.status(403).json({ error: "Only admins can post news" });
  }

  let fileUrl = "";
  let fileName = "";

  if (req.file) {
    try {
      const base64File = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const uploadResponse = await cloudinary.uploader.upload(base64File, {
        folder: "news_files",
        resource_type: "raw",
      });
      fileUrl = uploadResponse.secure_url;
      fileName = req.file.originalname || "file.apk";
    } catch (uploadError) {
      console.error("Cloudinary file upload error:", uploadError);
      return res.status(400).json({ error: "Failed to upload file" });
    }
  }

  const post = await NewsPost.create({
    content: content.trim(),
    author: user._id,
    fileUrl,
    fileName,
  });

  const populated = await post.populate(
    "author",
    "username firstName lastName profilePicture isAdmin"
  );

  res.status(201).json({ post: populated });

  // Broadcast push notification to all users (non-blocking)
  try {
    const usersWithTokens = await User.find({
      pushToken: { $ne: "" },
    }).select("pushToken");

    const pushMessages = usersWithTokens
      .filter((u) => Expo.isExpoPushToken(u.pushToken))
      .map((u) => ({
        to: u.pushToken,
        sound: "default",
        title: "Horizon News",
        body: content.trim().length > 100 ? content.trim().slice(0, 100) + "…" : content.trim(),
        data: { type: "news", postId: post._id },
      }));

    if (pushMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(pushMessages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
    }
  } catch (pushError) {
    console.error("Failed to send news push notifications:", pushError);
  }
});


