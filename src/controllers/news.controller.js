import asyncHandler from "express-async-handler";
import NewsPost from "../models/newsPost.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";
import { Expo } from "expo-server-sdk";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const isApk = req.file.originalname.toLowerCase().endsWith(".apk") || 
                    req.file.mimetype === "application/vnd.android.package-archive" ||
                    req.file.mimetype === "application/octet-stream";

      if (isApk) {
        // Сохраняем APK локально в папку uploads
        const safeName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
        const filePath = path.join(__dirname, "../../uploads", safeName);
        
        fs.writeFileSync(filePath, req.file.buffer);
        
        // Формируем URL. Используем заголовок host, чтобы работало и локально, и на домене.
        const host = req.get("host");
        const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
        fileUrl = `${protocol}://${host}/uploads/${safeName}`;
        fileName = req.file.originalname;
        console.log("APK saved locally:", fileUrl);
      } else {
        // Картинки по-прежнему грузим в Cloudinary
        const base64File = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const uploadResponse = await cloudinary.uploader.upload(base64File, {
          folder: "news_files",
          resource_type: "auto", // auto handles images/videos
        });
        fileUrl = uploadResponse.secure_url;
        fileName = req.file.originalname || "image";
        console.log("Image uploaded to Cloudinary:", fileUrl);
      }
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
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


