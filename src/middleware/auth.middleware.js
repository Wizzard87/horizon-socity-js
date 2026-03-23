import { getAuth } from "@clerk/express";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - you must be logged in" });
    }

    // Update lastActive asynchronously so we don't block the request
    User.findOneAndUpdate({ clerkId: userId }, { lastActive: new Date() }).catch(err => 
      console.error("Error updating lastActive:", err)
    );

    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized - invalid token" });
  }
};
