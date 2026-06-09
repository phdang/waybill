import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country"),
  baseCurrency: text("base_currency"),
  status: text("status").$type<"active" | "completed">().notNull().default("active"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").references(() => trips.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  category: text("category").$type<"food" | "hotel" | "transport" | "ticket" | "shopping" | "entertainment" | "medical" | "other">().notNull(),
  description: text("description").notNull(),
  note: text("note"),
  sourceType: text("source_type").$type<"text" | "image" | "voice" | "manual">().notNull().default("manual"),
  expenseDate: timestamp("expense_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
