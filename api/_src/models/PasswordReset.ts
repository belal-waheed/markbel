import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 } // Auto TTL delete after 15 minutes
});

export default mongoose.models.PasswordReset || mongoose.model("PasswordReset", PasswordResetSchema);
