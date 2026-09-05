import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { phonicsProfilesTable } from "./phonics-profiles";

export const phonicsQuestProgressTable = pgTable(
  "phonics_quest_progress",
  {
    profileId: text("profile_id").notNull().references(() => phonicsProfilesTable.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    status: text("status").notNull().default("open"),
    progress: integer("progress").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.questId] })],
);

export const insertPhonicsQuestProgressSchema = createInsertSchema(phonicsQuestProgressTable);
export type InsertPhonicsQuestProgress = z.infer<typeof insertPhonicsQuestProgressSchema>;
export type PhonicsQuestProgress = typeof phonicsQuestProgressTable.$inferSelect;