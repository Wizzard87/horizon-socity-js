import asyncHandler from "express-async-handler";
import NewsPost from "../models/newsPost.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";

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

  const post = await NewsPost.create({
    content: content.trim(),
    author: user._id,
  });

  const populated = await post.populate(
    "author",
    "username firstName lastName profilePicture isAdmin"
  );

  res.status(201).json({ post: populated });
});
