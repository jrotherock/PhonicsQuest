import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const phonicsProfilesTable = pgTable("phonics_profiles", {
  id: text("id").primaryKey(),
  audioEnabled: boolean("audio_enabled").notNull().default(true),
  parentPinHash: text("parent_pin_hash"),
  streak: integer("streak").notNull().default(0),
  stars: integer("stars").notNull().default(0),
  mastered: integer("mastered").notNull().default(0),
  minutes: integer("minutes").notNull().default(0),
  recentSkill: text("recent_skill").notNull().default("sound detective work"),
  sessions: integer("sessions").notNull().default(0),
  lastActiveDate: date("last_active_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPhonicsProfileSchema = createInsertSchema(phonicsProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPhonicsProfile = z.infer<typeof insertPhonicsProfileSchema>;
export type PhonicsProfile = typeof phonicsProfilesTable.$inferSelect;