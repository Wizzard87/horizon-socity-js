import { Message } from "../models/message.model.js";
import { Conversation } from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";
import { Expo } from "expo-server-sdk";
import cloudinary from "../config/cloudinary.js";

const expo = new Expo();

// Send a new message or create a conversation if it doesn't exist
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const imageFile = req.file;
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });
    const senderId = user._id;

    if (!receiverId || (!text && !imageFile)) {
      return res.status(400).json({ message: "Receiver ID and text or image are required" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    let imageUrl = "";

    // upload image to Cloudinary if provided
    if (imageFile) {
      try {
        const base64Image = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString("base64")}`;
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
          folder: "direct_messages",
          resource_type: "image",
          transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto" },
            { format: "auto" },
          ],
        });
        imageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(400).json({ message: "Failed to upload image" });
      }
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      sender: senderId,
      text: text || "",
      image: imageUrl,
    });

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    res.status(201).json(newMessage);

    // Dispatch Expo Push Notification
    try {
      const receiverUser = await User.findById(receiverId);
      if (receiverUser && receiverUser.pushToken && Expo.isExpoPushToken(receiverUser.pushToken)) {
        const pushBody = imageUrl ? "📷 Sent a photo" : text;
        const pushMessages = [{
          to: receiverUser.pushToken,
          sound: "default",
          title: `New message from ${user.firstName}`,
          body: pushBody,
          data: { conversationId: conversation._id },
        }];
        await expo.sendPushNotificationsAsync(pushMessages);
      }
    } catch (pushError) {
      console.error("Failed to send Expo Push Notification:", pushError);
    }

  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a message (text only, sender only)
export const updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }

    message.text = text;
    await message.save();

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in updateMessage:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a message (sender only)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    const conversationId = message.conversationId;
    await Message.findByIdAndDelete(messageId);

    // Update lastMessage on conversation if this was the last message
    const conversation = await Conversation.findById(conversationId);
    if (conversation && conversation.lastMessage?.toString() === messageId) {
      const latestMessage = await Message.findOne({ conversationId }).sort({ createdAt: -1 });
      conversation.lastMessage = latestMessage ? latestMessage._id : null;
      await conversation.save();
    }

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all conversations for the current user
export const getConversations = async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });
    const userId = user._id;
    
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "firstName lastName username profilePicture verified bio")
      .populate("lastMessage", "text image createdAt")
      .sort({ updatedAt: -1 });

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in getConversations:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all messages for a specific conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });
    const userId = user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ message: "Not authorized to view these messages" });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error);
    res.status(500).json({ message: "Server error" });
  }
};
