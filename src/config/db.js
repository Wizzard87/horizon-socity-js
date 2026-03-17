import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(ENV.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to DB SUCCESSFULLY ✅");
  } catch (error) {
    console.error("Error connecting to MONGODB ❌");
    console.error(error); // <-- вот тут мы выводим реальную причину
    process.exit(1);
  }
};