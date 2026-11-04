import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ReaderModal } from "./modals/ReaderModal";
import { CommandPalette } from "./modals/CommandPalette";
import { LocalBookmark } from "../db/db";

function createMockBookmark(overrides: Partial<LocalBookmark> = {}): LocalBookmark {
  return {
    id: "bm-reader-1",
    userId: "user-1",
    url: "https://engineering.google/posts/architecture-invariants/",
    title: "Engineering Architecture Invariants",
    description: "Deep dive into defensive software architecture and system boundaries.",
    group: "Engineering",
    siteName: "Google Engineering",
    author: "DeepMind Systems Team",
    publishedAt: "2026-10-15T12:00:00Z",
    contentType: "article",
    readingTime: 6,
    wordCount: 1200,
    articleContent: "<h2>Introduction</h2><p>Defensive design protects system invariants across network boundaries.</p>",
    isRead: false,
    isPinned: true,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

describe("ReaderModal & CommandPalette Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. ReaderModal Component", () => {
    it("returns null when isOpen is false", () => {
      const html = renderToString(
        React.createElement(ReaderModal, {
          isOpen: false,
          bookmark: createMockBookmark(),
          onClose: vi.fn(),
        })
      );
      expect(html).toBe("");
    });

    it("returns null when bookmark is null", () => {
      const html = renderToString(
        React.createElement(ReaderModal, {
          isOpen: true,
          bookmark: null,
          onClose: vi.fn(),
        })
      );
      expect(html).toBe("");
    });

    it("renders article header metadata, typography toggles, and formatted HTML content", () => {
      const bm = createMockBookmark();
      const rawHtml = renderToString(
        React.createElement(ReaderModal, {
          isOpen: true,
          bookmark: bm,
          onClose: vi.fn(),
          onToggleRead: vi.fn(),
        })
      );
      const html = rawHtml.replace(/<!-- -->/g, "");

      // Title & Domain
      expect(html).toContain("Engineering Architecture Invariants");
      expect(html).toContain("Google Engineering");
      expect(html).toContain("engineering.google");

      // Badges
      expect(html).toContain("DeepMind Systems Team");
      expect(html).toContain("6 min read");
      expect(html).toContain("1200 words");

      // Typography Controls
      expect(html).toContain("Sans");
      expect(html).toContain("Serif");
      expect(html).toContain("SM");
      expect(html).toContain("BASE");
      expect(html).toContain("LG");
      expect(html).toContain("XL");

      // Content
      expect(html).toContain("Defensive design protects system invariants");
      expect(html).toContain("<h2>Introduction</h2>");

      // Actions
      expect(html).toContain("Mark Read");
      expect(html).toContain('role="dialog"');
      expect(html).toContain('role="progressbar"');
    });

    it("renders download prompt when articleContent is absent", () => {
      const bm = createMockBookmark({ articleContent: "" });
      const html = renderToString(
        React.createElement(ReaderModal, {
          isOpen: true,
          bookmark: bm,
          onClose: vi.fn(),
        })
      );

      expect(html).toContain("No Offline Article Content Saved");
      expect(html).toContain("Download Article Content");
    });
  });

  describe("2. CommandPalette Component", () => {
    it("returns null when isOpen is false", () => {
      const html = renderToString(
        React.createElement(CommandPalette, {
          isOpen: false,
          onClose: vi.fn(),
          bookmarks: [],
          onOpenAddModal: vi.fn(),
          onTriggerSync: vi.fn(),
          onSelectGroup: vi.fn(),
        })
      );
      expect(html).toBe("");
    });

    it("renders Quick Commands and Jump to Group options", () => {
      const bookmarks = [createMockBookmark()];
      const rawHtml = renderToString(
        React.createElement(CommandPalette, {
          isOpen: true,
          onClose: vi.fn(),
          bookmarks,
          groups: ["Dev", "Research"],
          onOpenAddModal: vi.fn(),
          onTriggerSync: vi.fn(),
          onSelectGroup: vi.fn(),
          onNavigateSettings: vi.fn(),
        })
      );
      const html = rawHtml.replace(/<!-- -->/g, "");

      // Commands
      expect(html).toContain("Add Bookmark");
      expect(html).toContain("Trigger Sync");
      expect(html).toContain("View Unread");
      expect(html).toContain("View Pinned");
      expect(html).toContain("View Archive");
      expect(html).toContain("View Settings");

      // Groups
      expect(html).toContain("Jump to Group: Dev");
      expect(html).toContain("Jump to Group: Research");

      // Bookmarks Section
      expect(html).toContain("Bookmarks (1)");
      expect(html).toContain("Engineering Architecture Invariants");

      // Palette hints
      expect(html).toContain("Markbel Universal Palette");
      expect(html).toContain("Type a command or search bookmarks...");
    });
  });
});
