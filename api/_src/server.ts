import express, { Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { connectToDatabase } from "./db.js";
import User from "./models/User.js";
import Bookmark from "./models/Bookmark.js";
import Group from "./models/Group.js";
import PasswordReset from "./models/PasswordReset.js";
import syncRoutes from "./routes/sync.js";
import deviceRoutes from "./routes/device.js";
import notificationRoutes from "./routes/notifications.js";
import metadataRoutes from "./routes/metadata.js";

import { authMiddleware, AuthRequest } from "./middleware/auth.js";
import { scrapeBookmarkMetadata } from "./scraper.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_local_dev";

const CRON_SECRET = process.env.CRON_SECRET || "fallback_cron_secret";

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow all origins, including 'null' (Electron file://) or undefined (server-to-server)
    callback(null, true);
  }, 
  credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE MIDDLEWARE (Ensure connected before any queries)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err: any) {
    console.error("[DB connection failed]:", err);
    res
      .status(500)
      .json({ error: "Database connection failed: " + err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.use("/api/sync", syncRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/metadata", metadataRoutes);

// PWA Share Target POST Handler
app.post("/share", (req, res) => {
  const { title = "", text = "", url = "" } = req.body || {};
  let targetUrl = String(url || "").trim();
  if (!targetUrl && text) {
    const urlMatch = String(text).match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      targetUrl = urlMatch[0];
    }
  }

  if (targetUrl) {
    targetUrl = targetUrl.replace(/[),.;]+$/, "");
  }

  const queryParams = new URLSearchParams();
  if (targetUrl) queryParams.set("url", targetUrl);
  if (title) queryParams.set("title", String(title));
  if (text) queryParams.set("text", String(text));

  const queryString = queryParams.toString();
  res.redirect(303, queryString ? `/share?${queryString}` : "/share");
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER AUTH ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/users/signup
app.post("/api/users/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      res
        .status(409)
        .json({ error: "An account with this email already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const payload = {
      name,
      email,
      avatar: avatar || "",
      id: crypto.randomUUID(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    const user = new User(payload);
    await user.save();

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toJSON();

    res.cookie("markbel_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ token, user: userObj });
  } catch (err: any) {
    console.error("[API Signup] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/users/login
app.post("/api/users/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "No account found with this email" });
      return;
    }

    if (!user.password) {
      res.status(401).json({ error: "User account has no password set" });
      return;
    }

    let isValid = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      isValid = bcrypt.compareSync(password, user.password);
    } else {
      console.warn(
        `[Security Warning] User ${user.email} logged in using legacy plaintext password. Upgrading to hash now...`
      );
      isValid = user.password === password;
      if (isValid) {
        user.password = bcrypt.hashSync(password, SALT_ROUNDS);
        await user.save();
      }
    }

    if (!isValid) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toJSON();

    res.cookie("markbel_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token, user: userObj });
  } catch (err: any) {
    console.error("[API Login] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/users/logout
app.post("/api/users/logout", (req, res) => {
  res.clearCookie("markbel_token");
  res.json({ message: "Logged out successfully" });
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).lean();

    if (!user) {
      res.json({ success: true, message: "If an account exists, a reset code has been sent." });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordReset.deleteMany({ email: normalizedEmail });
    await PasswordReset.create({
      email: normalizedEmail,
      token: code,
      expiresAt,
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Markbel Security <auth@markbel.app>",
            to: [normalizedEmail],
            subject: "Markbel Password Reset Code",
            html: `<div style="font-family: sans-serif; padding: 20px; color: #111;">
              <h2>Password Reset Request</h2>
              <p>Your 6-digit verification code is:</p>
              <h1 style="letter-spacing: 4px; color: #0284c7; font-size: 32px;">${code}</h1>
              <p>This code will expire in 15 minutes.</p>
            </div>`,
          }),
        });
      } catch (err) {
        console.error("[Resend Error]:", err);
      }
    } else {
      console.log(`[Dev Password Reset Code for ${normalizedEmail}]: ${code}`);
    }

    res.json({
      success: true,
      message: "If an account exists, a reset code has been sent.",
      devCode: !resendKey ? code : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Email, reset code, and new password are required" });
      return;
    }

    if (newPassword.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters long" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const resetRecord = await PasswordReset.findOne({
      email: normalizedEmail,
      token: code.trim(),
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      res.status(400).json({ error: "Invalid or expired verification code" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.updateOne({ email: normalizedEmail }, { $set: { password: hashedPassword } });
    await PasswordReset.deleteMany({ email: normalizedEmail });

    res.json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/users/me (Get profile)
app.get("/api/users/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ id: req.userId }).lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { password, _id, __v, ...safeUser } = user as any;
    res.json(safeUser);
  } catch (err: any) {
    console.error("[API User Me] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS CRUD ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


// GET /api/bookmarks
app.get("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query: any = { userId: req.userId };
    // We now always return archived bookmarks so the frontend Dexie database has a complete local copy
    const bookmarks = await Bookmark.find(query).lean();
    res.json(bookmarks);
  } catch (err: any) {
    console.error("[API Bookmarks GET] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUPS CRUD ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/groups
app.get("/api/groups", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query: any = { userId: req.userId, deletedAt: null };
    const groups = await Group.find(query).lean();
    res.json(groups);
  } catch (err: any) {
    console.error("[API Groups GET] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/groups
app.post("/api/groups", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const group = new Group({
      id: crypto.randomUUID(),
      userId: req.userId,
      name: name.trim(),
      color: color || 'cyan',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await group.save();
    res.status(201).json(group.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PUT /api/groups
app.put("/api/groups", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id, name, color } = req.body;
    if (!id) return res.status(400).json({ error: "Group ID is required" });

    const group = await Group.findOne({ id, userId: req.userId });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const oldName = group.name;
    if (name) group.name = name.trim();
    if (color) group.color = color;
    group.version += 1;
    group.updatedAt = new Date().toISOString();
    await group.save();

    if (name && oldName !== group.name) {
      await Bookmark.updateMany(
        { userId: req.userId, group: oldName },
        { $set: { group: group.name, updatedAt: new Date().toISOString() } }
      );
    }
    res.json(group.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// DELETE /api/groups
app.delete("/api/groups", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "Group ID is required" });

    const group = await Group.findOne({ id, userId: req.userId });
    if (!group) return res.status(404).json({ error: "Group not found" });

    group.deletedAt = new Date().toISOString();
    group.version += 1;
    await group.save();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/bookmarks
app.post("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    let { title, url, description, image, group, isRead, readAt, isPinned, remindAt, isArchived, archiveGroup } = req.body;
    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    url = url.trim();
    let finalTitle = title ? title.trim() : "";
    let finalImage = image ? image.trim() : "";
    let finalDescription = description ? description.trim() : "";

    const shouldScrapeTitle = !finalTitle || finalTitle === url;
    const shouldScrapeImage = !finalImage;
    const shouldScrapeDesc = !finalDescription;

    // Set initial title fallback if none is provided
    let initialTitle = finalTitle;
    if (!initialTitle) {
      try {
        const parsedUrl = new URL(url);
        initialTitle = parsedUrl.hostname;
      } catch {
        initialTitle = url;
      }
    }

    const payload = {
      title: initialTitle,
      url,
      description: finalDescription,
      image: finalImage,
      group: group || "Unsorted",
      isRead: Boolean(isRead),
      readAt: readAt || "",
      isPinned: Boolean(isPinned),
      remindAt: remindAt || "",
      isArchived: Boolean(isArchived),
      archiveGroup: archiveGroup || "",
      userId: req.userId,
      id: req.body.id || crypto.randomUUID(),
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: req.body.updatedAt || new Date().toISOString(),
    };

    const bookmark = new Bookmark(payload);
    await bookmark.save();

    // Respond immediately to the client
    res.status(201).json(bookmark.toJSON());

    // Notify other clients about the creation

    // Perform scraping in the background asynchronously
    scrapeBookmarkMetadata({
      id: payload.id,
      url: payload.url,
      title: payload.title,
      image: payload.image,
      description: payload.description,
      userId: payload.userId,
    }).catch(err => {
      console.error("[Server Auto-Scrape Background] Unhandled error:", err);
    });
  } catch (err: any) {
    console.error("[API Bookmarks POST] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PUT /api/bookmarks (Uses query ?id=xxx)
app.put("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }

    const incomingData = req.body || {};
    delete incomingData._id;

    const existingBookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!existingBookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }

    const incomingTime = new Date(
      incomingData.updatedAt || new Date().toISOString(),
    ).getTime();
    const serverTime = new Date(
      existingBookmark.updatedAt || new Date().toISOString(),
    ).getTime();
    if (incomingTime < serverTime) {
      res.status(409).json(existingBookmark.toJSON());
      return;
    }

    Object.assign(existingBookmark, incomingData);
    existingBookmark.updatedAt = new Date().toISOString();
    await existingBookmark.save();

    res.json(existingBookmark.toJSON());

    // Notify clients of modification
  } catch (err: any) {
    console.error("[API Bookmarks PUT] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});



// DELETE /api/bookmarks (Uses query ?id=xxx)
app.delete("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }

    const result = await Bookmark.deleteOne({ id, userId: req.userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Bookmark not found or already deleted" });
      return;
    }

    res.json({ success: true });

    // Notify clients of deletion
  } catch (err: any) {
    console.error("[API Bookmarks DELETE] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARK LIFECYCLE & DISCOVERY ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/bookmarks/stats
app.get("/api/bookmarks/stats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const all = await Bookmark.find({ userId: req.userId, isArchived: { $ne: true } }).lean();
    const total = all.length;
    const unread = all.filter((b) => !b.isRead).length;
    const read = total - unread;
    const pinnedCount = all.filter((b) => b.isPinned).length;
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const savedThisWeek = all.filter((b) => b.createdAt >= oneWeekAgo).length;

    const archivedCount = await Bookmark.countDocuments({ userId: req.userId, isArchived: true });

    res.json({ total, read, unread, savedThisWeek, pinnedCount, archivedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/bookmarks/due
app.get("/api/bookmarks/due", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();
    const dueBookmarks = await Bookmark.find({
      userId: req.userId,
      isArchived: { $ne: true },
      isRead: { $ne: true },
      remindAt: { $ne: "", $lte: now },
    }).lean();
    res.json(dueBookmarks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/bookmarks/random
app.get("/api/bookmarks/random", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const count = parseInt(req.query.count as string) || 3;
    const unread = await Bookmark.find({
      userId: req.userId,
      isArchived: { $ne: true },
      isRead: { $ne: true },
    }).lean();

    const shuffled = unread.sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, count));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/bookmarks/archived
app.get("/api/bookmarks/archived", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const archived = await Bookmark.find({ userId: req.userId, isArchived: true }).lean();
    res.json(archived);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/read?id=xxx
app.patch("/api/bookmarks/read", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    const newIsRead = req.body.isRead !== undefined ? req.body.isRead : !bookmark.isRead;
    bookmark.isRead = newIsRead;
    bookmark.readAt = newIsRead ? new Date().toISOString() : "";
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/pin?id=xxx
app.patch("/api/bookmarks/pin", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    bookmark.isPinned = req.body.isPinned !== undefined ? req.body.isPinned : !bookmark.isPinned;
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/archive?id=xxx
app.patch("/api/bookmarks/archive", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    bookmark.isArchived = true;
    bookmark.archiveGroup = req.body.archiveGroup || bookmark.archiveGroup || "archive-general";
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/unarchive?id=xxx
app.patch("/api/bookmarks/unarchive", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    bookmark.isArchived = false;
    bookmark.archiveGroup = "";
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});





// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINK METADATA SCRAPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/bookmarks/meta?url=xxx
app.get(
  "/api/bookmarks/meta",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const urlStr = req.query.url as string;
      if (!urlStr) {
        res.status(400).json({ error: "URL is required" });
        return;
      }

      const parsedUrl = new URL(urlStr);

      // Check for YouTube URLs to extract the video ID
      let ytId: string | null = null;
      if (parsedUrl.hostname.includes("youtube.com")) {
        if (parsedUrl.pathname.startsWith("/watch")) {
          ytId = parsedUrl.searchParams.get("v");
        } else if (parsedUrl.pathname.startsWith("/embed/")) {
          ytId = parsedUrl.pathname.split("/")[2];
        } else if (parsedUrl.pathname.startsWith("/shorts/")) {
          ytId = parsedUrl.pathname.split("/")[2];
        }
      } else if (parsedUrl.hostname.includes("youtu.be")) {
        ytId = parsedUrl.pathname.slice(1);
      }

      let title = "";
      let description = "";
      let image = ytId
        ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
        : "";

      // Attempt to fetch page content, failing gracefully
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        let userAgent =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
        if (parsedUrl.hostname.includes("instagram.com")) {
          userAgent =
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)";
        }

        const response = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent": userAgent,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();

          const getMetaTag = (property: string) => {
            const regex = new RegExp(
              `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
              "i",
            );
            const match = html.match(regex);
            if (match) return match[1];
            const altRegex = new RegExp(
              `<meta[^]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
              "i",
            );
            const altMatch = html.match(altRegex);
            return altMatch ? altMatch[1] : "";
          };

          const getTitle = () => {
            const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            return match ? match[1] : "";
          };

          title =
            getMetaTag("og:title") || getMetaTag("twitter:title") || getTitle();
          description =
            getMetaTag("og:description") ||
            getMetaTag("twitter:description") ||
            "";

          if (!ytId) {
            image = getMetaTag("og:image") || getMetaTag("twitter:image") || "";
            if (image && !image.startsWith("http")) {
              image = new URL(image, parsedUrl.origin).toString();
            }
          }
        }
      } catch (fetchErr) {
        console.warn(
          "[API Meta Fetch Warning] Failed to fetch external page details:",
          fetchErr,
        );
      }

      const decodeHtml = (str: string) => {
        return str
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      };

      const finalTitle = title
        ? decodeHtml(title.trim())
        : ytId
          ? "YouTube Video"
          : parsedUrl.hostname;
      const finalDesc = description ? decodeHtml(description.trim()) : "";

      res.json({
        title: finalTitle,
        description: finalDesc,
        image: image.trim(),
      });
    } catch (err: any) {
      console.error("[API Bookmarks Meta GET] Error:", err);
      res.json({ title: "", description: "", image: "" }); // Fail gracefully
    }
  },
);

// Start server local
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Markbel Server] Running on http://localhost:${PORT}`);
  });
}

// vercel
export default app;
