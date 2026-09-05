import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { phonicsProfilesTable } from "./phonics-profiles";

export const phonicsAttemptsTable = pgTable("phonics_attempts", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => phonicsProfilesTable.id, { onDelete: "cascade" }),
  questId: text("quest_id").notNull(),
  challengeId: text("challenge_id").notNull(),
  skillId: text("skill_id").notNull(),
  correct: boolean("correct").notNull(),
  firstTry: boolean("first_try").notNull(),
  hinted: boolean("hinted").notNull(),
  transfer: boolean("transfer").notNull(),
  spelling: boolean("spelling").notNull(),
  review: boolean("review").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPhonicsAttemptSchema = createInsertSchema(phonicsAttemptsTable).omit({
  id: true,
  occurredAt: true,
});
export type InsertPhonicsAttempt = z.infer<typeof insertPhonicsAttemptSchema>;
export type PhonicsAttempt = typeof phonicsAttemptsTable.$inferSelect;