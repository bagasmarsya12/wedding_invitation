import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex, primaryKey, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const guests = sqliteTable("guests", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  invitationTokenEnc: text("invitation_token_enc"),
  importKey: text("import_key"),
  displayName: text("display_name").notNull(),
  email: text("email"),
  partyLimit: integer("party_limit").notNull().default(1),
  status: text("status").notNull().default("active"),
  guestGroup: text("guest_group").notNull().default("unassigned"),
  invitationSentAt: text("invitation_sent_at"),
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

export const guestPasses = sqliteTable("guest_passes", {
  id: text("id").primaryKey(),
  guestId: text("guest_id").notNull().references(() => guests.id),
  tokenHash: text("token_hash").notNull(),
  ...timestamps,
}, table => [uniqueIndex("guest_passes_guest_unique").on(table.guestId)]);

export const guestCheckins = sqliteTable("guest_checkins", {
  guestId: text("guest_id").primaryKey().references(() => guests.id),
  passId: text("pass_id").notNull(),
  partySize: integer("party_size").notNull(),
  checkedInAt: text("checked_in_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  checkedInBy: text("checked_in_by").notNull(),
  checkinMethod: text("checkin_method").notNull().default("qr"),
});

export const staffUsers = sqliteTable("staff_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  credential: text("credential").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, table => [uniqueIndex("staff_users_username_unique").on(table.username)]);

export const staffSessions = sqliteTable("staff_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("staff_sessions_staff_idx").on(table.staffId), index("staff_sessions_expiry_idx").on(table.expiresAt)]);

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
  sortOrder: integer("sort_order").notNull().default(0),
  published: integer("published", {mode:'boolean'}).notNull().default(true),
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
}, table => [uniqueIndex("gift_reservations_one_active").on(table.giftId).where(sql`${table.status} IN ('reserved', 'purchased')`)]);

export const giftMedia = sqliteTable("gift_media", {
  giftId: text("gift_id").primaryKey().references(() => gifts.id),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
  font: text("font").notNull().default("hand"),
  visibility: text("visibility").notNull().default("private"),
  moderationStatus: text("moderation_status").notNull().default("pending"),
  ...timestamps,
}, table => [index("marks_moderation_idx").on(table.moderationStatus, table.visibility), index("marks_guest_idx").on(table.guestId)]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const photoComments = sqliteTable('photo_comments', {
  id:text('id').primaryKey(),photoKey:text('photo_key').notNull(),
  parentId:text('parent_id').references(():AnySQLiteColumn=>photoComments.id),
  guestId:text('guest_id').references(()=>guests.id),authorKind:text('author_kind').notNull(),authorName:text('author_name').notNull(),
  message:text('message').notNull(),moderationStatus:text('moderation_status').notNull().default('pending'),removedAt:text('removed_at'),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
},table=>[index('photo_comments_thread_idx').on(table.photoKey,table.parentId,table.moderationStatus,table.createdAt,table.id),index('photo_comments_moderation_idx').on(table.moderationStatus,table.createdAt,table.id)]);
export const photoCommentHearts=sqliteTable('photo_comment_hearts',{
  commentId:text('comment_id').notNull().references(()=>photoComments.id,{onDelete:'cascade'}),guestId:text('guest_id').notNull().references(()=>guests.id),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
},table=>[primaryKey({columns:[table.commentId,table.guestId]})]);
export const photoCommentSettings=sqliteTable('photo_comment_settings',{
  photoKey:text('photo_key').primaryKey(),enabled:integer('enabled',{mode:'boolean'}).notNull().default(true),updatedAt:text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mutationLimits = sqliteTable("mutation_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(0),
});

export const pageVisits = sqliteTable("page_visits", {
  id: text("id").primaryKey(),
  guestId: text("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  sessionHash: text("session_hash").notNull(),
  deviceHash: text("device_hash"),
  page: text("page").notNull(),
  views: integer("views").notNull().default(1),
  firstAt: text("first_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastAt: text("last_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("page_visits_guest_idx").on(table.guestId), index("page_visits_last_idx").on(table.lastAt)]);
