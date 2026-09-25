import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const guests = sqliteTable("guests", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  importKey: text("import_key"),
  displayName: text("display_name").notNull(),
  email: text("email"),
  partyLimit: integer("party_limit").notNull().default(1),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, table => [uniqueIndex("guests_token_hash_unique").on(table.tokenHash), uniqueIndex("guests_import_key_unique").on(table.importKey)]);

export const rsvps = sqliteTable("rsvps", {
  id: text("id").primaryKey(),
  guestId: text("guest_id").notNull().references(() => guests.id),
  attendance: text("attendance").notNull(),
  partySize: integer("party_size").notNull().default(1),
  guestNames: text("guest_names"),
  dietary: text("dietary"),
  message: text("message"),
  ...timestamps,
}, table => [uniqueIndex("rsvps_guest_unique").on(table.guestId)]);

export const gifts = sqliteTable("gifts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  recipientCategory: text("recipient_category").notNull(),
  imageUrl: text("image_url"),
  purchaseUrl: text("purchase_url"),
  priceLabel: text("price_label"),
  status: text("status").notNull().default("available"),
  reservedByGuestId: text("reserved_by_guest_id").references(() => guests.id),
  reservedAt: text("reserved_at"),
  purchasedAt: text("purchased_at"),
  shippingRequired: integer("shipping_required", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, table => [index("gifts_category_idx").on(table.recipientCategory), index("gifts_status_idx").on(table.status)]);

export const giftReservations = sqliteTable("gift_reservations", {
  id: text("id").primaryKey(),
  giftId: text("gift_id").notNull().references(() => gifts.id),
  guestId: text("guest_id").notNull().references(() => guests.id),
  surprise: integer("surprise", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("reserved"),
  reservedAt: text("reserved_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  releasedAt: text("released_at"),
  purchasedAt: text("purchased_at"),
});

export const archiveEntries = sqliteTable("archive_entries", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  entryDate: text("entry_date"),
  location: text("location"),
  excerpt: text("excerpt"),
  story: text("story"),
  mediaUrl: text("media_url"),
  metadata: text("metadata"),
  tags: text("tags"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  featuredOrder: integer("featured_order"),
  visibility: text("visibility").notNull().default("guests"),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, table => [uniqueIndex("archive_slug_unique").on(table.slug), index("archive_featured_idx").on(table.featured, table.featuredOrder)]);

export const guestMarks = sqliteTable("guest_marks", {
  id: text("id").primaryKey(),
  guestId: text("guest_id").notNull().references(() => guests.id),
  authorName: text("author_name").notNull(),
  message: text("message"),
  drawingKey: text("drawing_key"),
  style: text("style").notNull().default("classic"),
  visibility: text("visibility").notNull().default("private"),
  moderationStatus: text("moderation_status").notNull().default("pending"),
  ...timestamps,
}, table => [index("marks_moderation_idx").on(table.moderationStatus, table.visibility), index("marks_guest_idx").on(table.guestId)]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mutationLimits = sqliteTable("mutation_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(0),
});
