import { date, integer, pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { phonicsProfilesTable } from "./phonics-profiles";

export const phonicsSkillProgressTable = pgTable(
  "phonics_skill_progress",
  {
    profileId: text("profile_id").notNull().references(() => phonicsProfilesTable.id, { onDelete: "cascade" }),
    skillId: text("skill_id").notNull(),
    attempts: integer("attempts").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    firstTry: integer("first_try").notNull().default(0),
    hints: integer("hints").notNull().default(0),
    transfer: integer("transfer").notNull().default(0),
    spelling: integer("spelling").notNull().default(0),
    reviewAttempts: integer("review_attempts").notNull().default(0),
    reviewCorrect: integer("review_correct").notNull().default(0),
    heldAfterBreak: integer("held_after_break").notNull().default(0),
    lastPracticed: date("last_practiced", { mode: "string" }),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.skillId] })],
);

export const insertPhonicsSkillProgressSchema = createInsertSchema(phonicsSkillProgressTable);
export type InsertPhonicsSkillProgress = z.infer<typeof insertPhonicsSkillProgressSchema>;
export type PhonicsSkillProgress = typeof phonicsSkillProgressTable.$inferSelect;