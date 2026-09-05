import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  phonicsProfilesTable,
  phonicsSkillProgressTable,
  phonicsQuestProgressTable,
  phonicsAttemptsTable,
} from "@workspace/db";
import type { AttemptInput, ProfileInitializeInput } from "@workspace/api-zod";

export const PHONICS_SKILLS = [
  "awareness",
  "short-vowels",
  "long-vowels",
  "blends",
  "syllables",
  "encoding",
  "tricky-words",
  "reading",
] as const;

export const PHONICS_QUESTS = [
  "lantern",
  "short-vowels",
  "ink-and-quill",
  "whispering-trees",
  "moonbridge",
  "mossy-hollow",
  "trickster-tower",
  "story-lantern",
] as const;

const scryptAsync = promisify(scrypt);
const pinHashPrefix = "scrypt";

type Evidence = {
  attempts: number;
  correct: number;
  firstTry: number;
  hints: number;
  transfer: number;
  spelling: number;
  reviewAttempts: number;
  reviewCorrect: number;
  heldAfterBreak: number;
  lastPracticed: string | null;
};

const blankEvidence = (): Evidence => ({
  attempts: 0,
  correct: 0,
  firstTry: 0,
  hints: 0,
  transfer: 0,
  spelling: 0,
  reviewAttempts: 0,
  reviewCorrect: 0,
  heldAfterBreak: 0,
  lastPracticed: null,
});

const isReady = (evidence: Evidence) =>
  evidence.attempts >= 3 &&
  evidence.firstTry >= 3 &&
  evidence.correct / evidence.attempts >= 0.67 &&
  evidence.transfer + evidence.spelling >= 1;

const dateOnly = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const daysBetween = (previous: string | null, current: string) => {
  if (!previous) return 99;
  return Math.floor(
    (new Date(`${current}T00:00:00`).getTime() -
      new Date(`${previous}T00:00:00`).getTime()) /
      86400000,
  );
};

const integer = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;

const today = () => new Date().toISOString().slice(0, 10);

function normalizeEvidence(
  value:
    | (Partial<Omit<Evidence, "lastPracticed">> & { lastPracticed?: Date | string | null })
    | undefined,
): Evidence {
  return {
    attempts: integer(value?.attempts),
    correct: integer(value?.correct),
    firstTry: integer(value?.firstTry),
    hints: integer(value?.hints),
    transfer: integer(value?.transfer),
    spelling: integer(value?.spelling),
    reviewAttempts: integer(value?.reviewAttempts),
    reviewCorrect: integer(value?.reviewCorrect),
    heldAfterBreak: integer(value?.heldAfterBreak),
    lastPracticed: dateOnly(value?.lastPracticed),
  };
}

function profileIdFromRequest(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function validateProfileId(value: string): boolean {
  return profileIdFromRequest(value) !== null;
}

export async function readPhonicsProfile(profileId: string) {
  const [profile] = await db
    .select()
    .from(phonicsProfilesTable)
    .where(eq(phonicsProfilesTable.id, profileId));
  if (!profile) return null;

  const skillRows = await db
    .select()
    .from(phonicsSkillProgressTable)
    .where(eq(phonicsSkillProgressTable.profileId, profileId));
  const skills = Object.fromEntries(
    PHONICS_SKILLS.map((skill) => {
      const row = skillRows.find((item) => item.skillId === skill);
      return [
        skill,
        {
          attempts: row?.attempts ?? 0,
          correct: row?.correct ?? 0,
          firstTry: row?.firstTry ?? 0,
          hints: row?.hints ?? 0,
          transfer: row?.transfer ?? 0,
          spelling: row?.spelling ?? 0,
          reviewAttempts: row?.reviewAttempts ?? 0,
          reviewCorrect: row?.reviewCorrect ?? 0,
          heldAfterBreak: row?.heldAfterBreak ?? 0,
          lastPracticed: row?.lastPracticed ?? null,
        },
      ];
    }),
  );
  const questRows = await db
    .select()
    .from(phonicsQuestProgressTable)
    .where(eq(phonicsQuestProgressTable.profileId, profileId));

  return {
    profileId: profile.id,
    audioEnabled: profile.audioEnabled,
    parentPinConfigured: Boolean(profile.parentPinHash),
    progress: {
      streak: profile.streak,
      stars: profile.stars,
      mastered: profile.mastered,
      minutes: profile.minutes,
      recentSkill: profile.recentSkill,
      sessions: profile.sessions,
      lastActiveDate: profile.lastActiveDate,
      skills,
    },
    questProgress: questRows.map((row) => ({
      id: row.questId,
      status: row.status === "complete" ? "complete" : "open",
      progress: row.progress,
    })),
  };
}

export async function initializePhonicsProfile(
  profileId: string,
  input: ProfileInitializeInput,
) {
  const legacy = input.legacyProgress;
  const evidence = Object.fromEntries(
    PHONICS_SKILLS.map((skill) => [skill, normalizeEvidence(legacy?.skills?.[skill])]),
  ) as Record<(typeof PHONICS_SKILLS)[number], Evidence>;
  const mastered = PHONICS_SKILLS.filter((skill) => isReady(evidence[skill])).length;

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(phonicsProfilesTable)
      .values({
        id: profileId,
        audioEnabled: input.audioEnabled,
        streak: integer(legacy?.streak),
        stars: integer(legacy?.stars),
        mastered,
        minutes: integer(legacy?.minutes),
        recentSkill: typeof legacy?.recentSkill === "string" ? legacy.recentSkill : "sound detective work",
        sessions: integer(legacy?.sessions),
        lastActiveDate: dateOnly(legacy?.lastActiveDate),
      })
      .onConflictDoNothing({ target: phonicsProfilesTable.id })
      .returning({ id: phonicsProfilesTable.id });

    // Another tab may have initialized this profile first. In that case the
    // existing profile is already authoritative and must not be overwritten
    // by a second legacy migration payload.
    if (!inserted) return;

    await tx.insert(phonicsSkillProgressTable).values(
      PHONICS_SKILLS.map((skill) => ({
      profileId,
        skillId: skill,
        ...evidence[skill],
      })),
    );

    const completedQuestIds = new Set(input.completedQuestIds ?? []);
    const completedRows = PHONICS_QUESTS.filter((questId) => completedQuestIds.has(questId)).map(
      (questId) => ({
        profileId,
        questId,
        status: "complete",
        progress: 100,
        completedAt: new Date(),
      }),
    );
    if (completedRows.length) {
      await tx.insert(phonicsQuestProgressTable).values(completedRows);
    }
  });

  return readPhonicsProfile(profileId);
}

export async function updatePhonicsSettings(profileId: string, audioEnabled: boolean) {
  const [profile] = await db
    .update(phonicsProfilesTable)
    .set({ audioEnabled, updatedAt: new Date() })
    .where(eq(phonicsProfilesTable.id, profileId))
    .returning({ id: phonicsProfilesTable.id });
  return profile ? readPhonicsProfile(profileId) : null;
}

export async function recordPhonicsAttempt(profileId: string, input: AttemptInput) {
  if (!PHONICS_QUESTS.includes(input.questId as (typeof PHONICS_QUESTS)[number])) {
    throw new Error("Unknown phonics quest");
  }

  const recorded = await db.transaction(async (tx) => {
    const [profile] = await tx
      .select()
      .from(phonicsProfilesTable)
      .where(eq(phonicsProfilesTable.id, profileId))
      .for("update");
    if (!profile) return false;

    const currentDate = today();
    const [before] = await tx
      .select()
      .from(phonicsSkillProgressTable)
      .where(
        and(
          eq(phonicsSkillProgressTable.profileId, profileId),
          eq(phonicsSkillProgressTable.skillId, input.skill),
        ),
      );
    const previous = before ?? {
      profileId,
      skillId: input.skill,
      ...blankEvidence(),
    };
    const gap = daysBetween(previous.lastPracticed, currentDate);
    const after: Evidence = {
      attempts: previous.attempts + 1,
      correct: previous.correct + (input.correct ? 1 : 0),
      firstTry: previous.firstTry + (input.correct && input.firstTry && !input.hinted ? 1 : 0),
      hints: previous.hints + (input.hinted ? 1 : 0),
      transfer: previous.transfer + (input.correct && input.transfer ? 1 : 0),
      spelling: previous.spelling + (input.correct && input.spelling ? 1 : 0),
      reviewAttempts: previous.reviewAttempts + (input.review ? 1 : 0),
      reviewCorrect: previous.reviewCorrect + (input.review && input.correct ? 1 : 0),
      heldAfterBreak: previous.heldAfterBreak + (input.review && input.correct && gap > 1 ? 1 : 0),
      lastPracticed: currentDate,
    };

    await tx
      .insert(phonicsSkillProgressTable)
      .values({ profileId, skillId: input.skill, ...after })
      .onConflictDoUpdate({
        target: [phonicsSkillProgressTable.profileId, phonicsSkillProgressTable.skillId],
        set: after,
      });
    await tx.insert(phonicsAttemptsTable).values({
      profileId,
      questId: input.questId,
      challengeId: input.challengeId,
      skillId: input.skill,
      correct: input.correct,
      firstTry: input.firstTry,
      hinted: input.hinted,
      transfer: input.transfer,
      spelling: input.spelling,
      review: input.review,
    });

    const [quest] = await tx
      .select()
      .from(phonicsQuestProgressTable)
      .where(
        and(
          eq(phonicsQuestProgressTable.profileId, profileId),
          eq(phonicsQuestProgressTable.questId, input.questId),
        ),
      );
    const firstCompletion = input.finalChallenge && quest?.status !== "complete";
    const nextQuestProgress = input.finalChallenge
      ? { status: "complete", progress: 100, completedAt: new Date() }
      : {
          status: quest?.status === "complete" ? "complete" : "open",
          progress: quest?.status === "complete" ? 100 : Math.min(90, (quest?.progress ?? 0) + 18),
          completedAt: quest?.completedAt ?? null,
        };
    await tx
      .insert(phonicsQuestProgressTable)
      .values({ profileId, questId: input.questId, ...nextQuestProgress })
      .onConflictDoUpdate({
        target: [phonicsQuestProgressTable.profileId, phonicsQuestProgressTable.questId],
        set: nextQuestProgress,
      });

    const skillRows = await tx
      .select()
      .from(phonicsSkillProgressTable)
      .where(eq(phonicsSkillProgressTable.profileId, profileId));
    const readyCount = PHONICS_SKILLS.filter((skill) => {
      const row = skillRows.find((item) => item.skillId === skill);
      return row ? isReady(normalizeEvidence(row)) : false;
    }).length;
    const sameDay = profile.lastActiveDate === currentDate;
    await tx
      .update(phonicsProfilesTable)
      .set({
        mastered: readyCount,
        recentSkill: input.skill,
        lastActiveDate: currentDate,
        stars: profile.stars + (firstCompletion ? 4 : 0),
        minutes: profile.minutes + (firstCompletion ? 3 : 0),
        sessions: profile.sessions + (firstCompletion ? 1 : 0),
        streak: firstCompletion ? Math.max(1, profile.streak + (sameDay ? 0 : 1)) : profile.streak,
        updatedAt: new Date(),
      })
      .where(eq(phonicsProfilesTable.id, profileId));
    return true;
  });

  if (!recorded) return null;
  return readPhonicsProfile(profileId);
}

export async function setPhonicsParentPin(profileId: string, pinHash: string) {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(pinHash, salt, 32)) as Buffer;
  const storedHash = `${pinHashPrefix}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
  const [profile] = await db
    .update(phonicsProfilesTable)
    .set({ parentPinHash: storedHash, updatedAt: new Date() })
    .where(and(eq(phonicsProfilesTable.id, profileId), isNull(phonicsProfilesTable.parentPinHash)))
    .returning({ id: phonicsProfilesTable.id });
  return profile ? readPhonicsProfile(profileId) : null;
}

export async function verifyPhonicsParentPin(profileId: string, pinHash: string) {
  const [profile] = await db
    .select({ parentPinHash: phonicsProfilesTable.parentPinHash })
    .from(phonicsProfilesTable)
    .where(eq(phonicsProfilesTable.id, profileId));
  if (!profile) return null;
  if (!profile.parentPinHash) return { valid: false };

  const [prefix, encodedSalt, encodedHash] = profile.parentPinHash.split("$");
  if (prefix !== pinHashPrefix || !encodedSalt || !encodedHash) {
    // Support hashes created before server-side salting and transparently
    // upgrade them after a successful verification.
    const expected = Buffer.from(profile.parentPinHash, "hex");
    const candidate = Buffer.from(pinHash, "hex");
    const valid = expected.length === candidate.length && timingSafeEqual(expected, candidate);
    if (valid) {
      const salt = randomBytes(16);
      const derived = (await scryptAsync(pinHash, salt, 32)) as Buffer;
      await db
        .update(phonicsProfilesTable)
        .set({
          parentPinHash: `${pinHashPrefix}$${salt.toString("base64url")}$${derived.toString("base64url")}`,
          updatedAt: new Date(),
        })
        .where(eq(phonicsProfilesTable.id, profileId));
    }
    return { valid };
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const expected = Buffer.from(encodedHash, "base64url");
  const candidate = (await scryptAsync(pinHash, salt, expected.length)) as Buffer;
  return { valid: candidate.length === expected.length && timingSafeEqual(candidate, expected) };
}