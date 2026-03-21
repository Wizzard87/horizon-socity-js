import mongoose from "mongoose";

const newsPostSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      maxLength: 1000,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const NewsPost = mongoose.model("NewsPost", newsPostSchema);

export default NewsPost;
