import { Message } from "../models/message.model.js";
import { Conversation } from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

// Send a new message or create a conversation if it doesn't exist
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });
    const senderId = user._id;

    if (!receiverId || !text) {
      return res.status(400).json({ message: "Receiver ID and text are required" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      sender: senderId,
      text,
    });

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    res.status(201).json(newMessage);

    // Dispatch Expo Push Notification
    try {
      const receiverUser = await User.findById(receiverId);
      if (receiverUser && receiverUser.pushToken && Expo.isExpoPushToken(receiverUser.pushToken)) {
        const pushMessages = [{
          to: receiverUser.pushToken,
          sound: "default",
          title: `New message from ${user.firstName}`,
          body: text,
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

// Get all conversations for the current user
export const getConversations = async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ message: "User not found" });
    const userId = user._id;
    
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "firstName lastName username profilePicture verified bio")
      .populate("lastMessage", "text createdAt")
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
