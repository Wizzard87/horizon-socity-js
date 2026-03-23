import mongoose from "mongoose";

const siteStatsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "global",
  },
  peakOnline: {
    type: Number,
    default: 0,
  },
  peakOnlineAt: {
    type: Date,
    default: null,
  },
});

const SiteStats = mongoose.model("SiteStats", siteStatsSchema);

export default SiteStats;
