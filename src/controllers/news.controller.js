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
    console.log("File received in news controller:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    try {
      const isApk = req.file.originalname.toLowerCase().endsWith(".apk") || 
                    req.file.mimetype === "application/vnd.android.package-archive" ||
                    req.file.mimetype === "application/octet-stream";

      console.log("isApk check:", isApk);

      if (isApk) {
        // Сохраняем APK локально в папку uploads
        const safeName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
        const filePath = path.join(__dirname, "../../uploads", safeName);
        console.log("Full save path:", filePath);
        
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
      console.error("Detailed File upload error:", uploadError);
      return res.status(400).json({ error: "Failed to upload file", details: uploadError.message });
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

export const updateNewsPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const { userId } = getAuth(req);

  const user = await User.findOne({ clerkId: userId });
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Only admins can edit news" });
  }

  const post = await NewsPost.findById(postId);
  if (!post) {
    return res.status(404).json({ error: "News post not found" });
  }

  if (content) post.content = content.trim();
  await post.save();

  const populated = await post.populate(
    "author",
    "username firstName lastName profilePicture isAdmin"
  );

  res.status(200).json({ post: populated });
});

export const deleteNewsPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { userId } = getAuth(req);

  const user = await User.findOne({ clerkId: userId });
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Only admins can delete news" });
  }

  const post = await NewsPost.findById(postId);
  if (!post) {
    return res.status(404).json({ error: "News post not found" });
  }

  // Delete associated file if it exists
  if (post.fileUrl) {
    if (post.fileUrl.includes("/uploads/")) {
      // Local APK
      try {
        const fileName = post.fileUrl.split("/").pop();
        const filePath = path.join(__dirname, "../../uploads", fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Error deleting local APK:", err);
      }
    } else if (post.fileUrl.includes("cloudinary.com")) {
      // Cloudinary image
      try {
        const urlParts = post.fileUrl.split("/");
        const fileNameWithExt = urlParts.pop();
        const publicId = fileNameWithExt.split(".")[0];
        // The folder was 'news_files'
        await cloudinary.uploader.destroy(`news_files/${publicId}`);
      } catch (err) {
        console.error("Error deleting Cloudinary file:", err);
      }
    }
  }

  await NewsPost.findByIdAndDelete(postId);
  res.status(200).json({ message: "News post deleted successfully" });
});


