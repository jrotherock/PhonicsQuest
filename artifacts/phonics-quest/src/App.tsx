import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import {
  BookMarked, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp,
  Flame, Headphones, Lightbulb, LockKeyhole, Map, RotateCcw, Sparkles,
  Star, Trophy, UserRound, Volume2, VolumeX, WandSparkles
} from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  initializePhonicsProfile,
  recordPhonicsAttempt,
  setPhonicsParentPin,
  updatePhonicsProfileSettings,
  verifyPhonicsParentPin,
  type ProfileState,
} from '@workspace/api-client-react';

type SkillId = 'awareness' | 'short-vowels' | 'long-vowels' | 'blends' | 'syllables' | 'encoding' | 'tricky-words' | 'reading';
type QuestStatus = 'open' | 'locked' | 'complete';
type ChallengeType = 'choice' | 'build' | 'reading';
type Level = 'foundation' | 'growing' | 'stretch';
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
type Progress = {
  streak: number;
  stars: number;
  mastered: number;
  minutes: number;
  recentSkill: string;
  sessions: number;
  lastActiveDate: string | null;
  skills: Record<SkillId, Evidence>;
};
type Quest = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  skill: SkillId;
  accent: string;
  gated?: boolean;
  status: QuestStatus;
  progress: number;
};
type CurriculumStage = {
  id: string;
  questId: string;
  skill: SkillId;
  label: string;
  outcome: string;
  why: string;
  example: string;
};
type Challenge = {
  id: string;
  type: ChallengeType;
  skill: SkillId;
  prompt: string;
  target?: string;
  choices?: string[];
  answer: string;
  hint: string;
  level: Level;
  transfer?: boolean;
  passage?: string;
  marked?: string;
};
type SavedState = { version: 2; profileId: string; quests: Quest[]; progress: Progress; audioEnabled: boolean; parentPinConfigured: boolean };
const profileStorageKey = 'phonics-quest-profile-id';

const skillIds: SkillId[] = ['awareness', 'short-vowels', 'long-vowels', 'blends', 'syllables', 'encoding', 'tricky-words', 'reading'];
const skillNames: Record<SkillId, string> = {
  awareness: 'Sound detective work',
  'short-vowels': 'Short vowels',
  'long-vowels': 'Long vowels and silent-e',
  blends: 'Blends, digraphs, and trigraphs',
  syllables: 'Syllables and word parts',
  encoding: 'Spelling and encoding',
  'tricky-words': 'Tricky high-frequency words',
  reading: 'Decodable reading',
};
const skillColors: Record<SkillId, string> = {
  awareness: 'hsl(177 54% 66%)',
  'short-vowels': 'hsl(39 96% 67%)',
  'long-vowels': 'hsl(278 67% 75%)',
  blends: 'hsl(11 84% 68%)',
  syllables: 'hsl(164 54% 64%)',
  encoding: 'hsl(45 90% 72%)',
  'tricky-words': 'hsl(23 83% 71%)',
  reading: 'hsl(194 71% 72%)',
};

function blankEvidence(): Evidence {
  return { attempts: 0, correct: 0, firstTry: 0, hints: 0, transfer: 0, spelling: 0, reviewAttempts: 0, reviewCorrect: 0, heldAfterBreak: 0, lastPracticed: null };
}
function blankSkills(): Record<SkillId, Evidence> {
  return skillIds.reduce((all, skill) => ({ ...all, [skill]: blankEvidence() }), {} as Record<SkillId, Evidence>);
}
const initialProgress: Progress = { streak: 0, stars: 0, mastered: 0, minutes: 0, recentSkill: 'sound detective work', sessions: 0, lastActiveDate: null, skills: blankSkills() };
const initialQuests: Quest[] = [
  { id: 'lantern', title: 'The Lantern Library', subtitle: 'Blend, segment, and find the first, middle, and final sounds.', category: 'Sound detective work', skill: 'awareness', status: 'open', progress: 0, accent: skillColors.awareness },
  { id: 'short-vowels', title: 'The Velvet Garden', subtitle: 'Wake the five short vowels hiding in the garden gates.', category: 'Short vowels', skill: 'short-vowels', status: 'open', progress: 0, accent: skillColors['short-vowels'] },
  { id: 'moonbridge', title: 'Moonbridge Crossing', subtitle: 'Stretch long vowels and unlock the silent-e bridge.', category: 'Long vowels', skill: 'long-vowels', status: 'open', progress: 0, accent: skillColors['long-vowels'] },
  { id: 'whispering-trees', title: 'Whispering Trees', subtitle: 'Tell apart a team of consonants from one shared sound.', category: 'Blends and letter teams', skill: 'blends', status: 'open', progress: 0, accent: skillColors.blends },
  { id: 'mossy-hollow', title: 'Mossy Hollow', subtitle: 'Tap syllables, split words, and notice their useful parts.', category: 'Syllables', skill: 'syllables', status: 'open', progress: 0, accent: skillColors.syllables },
  { id: 'ink-and-quill', title: 'Ink and Quill', subtitle: 'Build the words you hear, one sound at a time.', category: 'Spelling and encoding', skill: 'encoding', status: 'open', progress: 0, accent: skillColors.encoding },
  { id: 'trickster-tower', title: 'Trickster Tower', subtitle: 'Meet common words with one part that does not play fair.', category: 'Tricky words', skill: 'tricky-words', status: 'open', progress: 0, accent: skillColors['tricky-words'] },
  { id: 'story-lantern', title: 'The Story Lantern', subtitle: 'Read a short decodable story, then talk about what happened.', category: 'Reading and meaning', skill: 'reading', gated: true, status: 'locked', progress: 0, accent: skillColors.reading },
];
const curriculum: CurriculumStage[] = [
  { id: 'hear-it', questId: 'lantern', skill: 'awareness', label: 'Hear and move sounds', outcome: 'Notice, stretch, blend, and change sounds in spoken words.', why: 'Children need to hear the parts of a word before letters can represent them.', example: 'map → /m/ /ă/ /p/' },
  { id: 'short-vowels', questId: 'short-vowels', skill: 'short-vowels', label: 'Short vowels in simple words', outcome: 'Read and recognize the five short-vowel sounds in CVC words.', why: 'Short-vowel words give her a reliable first set of words to blend and read.', example: 'cat · pig · sun' },
  { id: 'encode-it', questId: 'ink-and-quill', skill: 'encoding', label: 'Spell what she hears', outcome: 'Connect each sound to a letter or letter team when spelling.', why: 'Spelling makes the sound-to-letter connection stronger than recognition alone.', example: '/s/ /ŭ/ /n/ → sun' },
  { id: 'letter-teams', questId: 'whispering-trees', skill: 'blends', label: 'Blends and digraphs', outcome: 'Read consonant blends and letter teams as they appear in new words.', why: 'These patterns expand the words she can decode while keeping attention on sound structure.', example: 'stop · ship · match' },
  { id: 'long-vowels', questId: 'moonbridge', skill: 'long-vowels', label: 'Long vowels and silent-e', outcome: 'Notice long-vowel patterns, including silent-e and vowel teams.', why: 'Once short-vowel words are stable, contrasting vowel patterns become easier to notice.', example: 'kit → kite · rain' },
  { id: 'word-parts', questId: 'mossy-hollow', skill: 'syllables', label: 'Syllables and word parts', outcome: 'Tap, split, and use syllables to approach longer words.', why: 'Word parts help her carry the same decoding habits into bigger words.', example: 'rab-bit · re-mem-ber' },
  { id: 'tricky-words', questId: 'trickster-tower', skill: 'tricky-words', label: 'Tricky high-frequency words', outcome: 'Read common words whose unusual parts need special attention.', why: 'A small bank of high-frequency words supports smoother connected reading.', example: 'said · have · what' },
  { id: 'read-and-think', questId: 'story-lantern', skill: 'reading', label: 'Decodable reading and meaning', outcome: 'Read a short decodable passage and explain what happened.', why: 'Reading for meaning is the destination: apply the patterns, then make sense of text.', example: 'read · reread · explain' },
];

const challengeBank: Record<string, Challenge[]> = {
  lantern: [
    { id: 'aware-1', type: 'choice', skill: 'awareness', prompt: 'Slide the sounds together: /m/ /ă/ /p/. What word did you make?', target: 'm · ă · p', choices: ['map', 'mat', 'mop', 'nap'], answer: 'map', hint: 'Start slowly, then let the sounds touch: m-a-p.', level: 'foundation' },
    { id: 'aware-2', type: 'choice', skill: 'awareness', prompt: 'Which sound starts the word “fish”?', target: 'fish', choices: ['/f/', '/ĭ/', '/sh/', '/s/'], answer: '/f/', hint: 'Say fish slowly. Listen before the vowel.', level: 'foundation' },
    { id: 'aware-3', type: 'choice', skill: 'awareness', prompt: 'Change the /m/ in “map” to /t/. What word now?', target: 'map → _ap', choices: ['tap', 'tip', 'cap', 'nap'], answer: 'tap', hint: 'Keep -ap. Swap only the first sound.', level: 'growing', transfer: true },
    { id: 'aware-4', type: 'choice', skill: 'awareness', prompt: 'Say “camp” slowly. Which sound is last?', target: 'camp', choices: ['/k/', '/ă/', '/m/', '/p/'], answer: '/p/', hint: 'Stretch the ending: cam-p.', level: 'growing', transfer: true },
    { id: 'aware-5', type: 'choice', skill: 'awareness', prompt: 'Which word has three sounds: /s/ /l/ /ĭ/ /p/?', target: 'Listen, then blend', choices: ['sip', 'slip', 'ship', 'lip'], answer: 'slip', hint: 'There are four sounds, and the first two stay separate.', level: 'stretch', transfer: true },
  ],
  'short-vowels': [
    { id: 'short-1', type: 'choice', skill: 'short-vowels', prompt: 'Which middle sound opens the word?', target: 'c _ t', choices: ['ă', 'ĕ', 'ĭ', 'ŏ'], answer: 'ă', hint: 'A cat has the mouth-open /ă/ sound.', level: 'foundation' },
    { id: 'short-2', type: 'choice', skill: 'short-vowels', prompt: 'Which vowel belongs in “p _ g”?', target: 'p _ g', choices: ['ă', 'ĕ', 'ĭ', 'ŭ'], answer: 'ĭ', hint: 'A pig has a quick /ĭ/ in the middle.', level: 'foundation' },
    { id: 'short-3', type: 'choice', skill: 'short-vowels', prompt: 'Which word has a short o?', target: 'Choose the word you hear', choices: ['hop', 'hope', 'hup', 'heap'], answer: 'hop', hint: 'Short o is quick in hop. The e at the end of hope changes it.', level: 'growing', transfer: true },
    { id: 'short-4', type: 'choice', skill: 'short-vowels', prompt: 'Find the short u in this set.', target: 'One word has /ŭ/', choices: ['sun', 'seen', 'sign', 'stone'], answer: 'sun', hint: 'The /ŭ/ in sun is a relaxed, quick sound.', level: 'stretch', transfer: true },
  ],
  moonbridge: [
    { id: 'long-1', type: 'choice', skill: 'long-vowels', prompt: 'Which word has a long a?', target: 'Hear the vowel name', choices: ['rain', 'rag', 'ran', 'rack'], answer: 'rain', hint: 'In rain, the a says its name.', level: 'foundation' },
    { id: 'long-2', type: 'choice', skill: 'long-vowels', prompt: 'What does silent-e help “kit” become?', target: 'kit → kit_', choices: ['kite', 'kitt', 'kote', 'kute'], answer: 'kite', hint: 'The e is quiet, but it helps i say its name.', level: 'foundation' },
    { id: 'long-3', type: 'choice', skill: 'long-vowels', prompt: 'Which word is split with a silent-e pattern?', target: 'Pick a VCe word', choices: ['cube', 'crab', 'step', 'dress'], answer: 'cube', hint: 'Look for one vowel, one consonant, then a quiet e.', level: 'growing', transfer: true },
    { id: 'long-4', type: 'choice', skill: 'long-vowels', prompt: 'Which word has a long i?', target: 'Choose the word with /ī/', choices: ['shine', 'ship', 'shut', 'shell'], answer: 'shine', hint: 'The e at the end lets i say its name.', level: 'stretch', transfer: true },
    { id: 'long-5', type: 'choice', skill: 'long-vowels', prompt: 'Which word has an r-controlled vowel?', target: 'Listen for /ər/', choices: ['bird', 'bead', 'bid', 'bad'], answer: 'bird', hint: 'The r changes the vowel sound in bird. The vowel is not short or long.', level: 'stretch', transfer: true },
  ],
  'whispering-trees': [
    { id: 'blend-1', type: 'choice', skill: 'blends', prompt: 'In “stop,” which letters are a blend?', target: 's t o p', choices: ['st', 'op', 'to', 'p'], answer: 'st', hint: 'In a blend, each consonant keeps its own sound.', level: 'foundation' },
    { id: 'blend-2', type: 'choice', skill: 'blends', prompt: 'Which team makes one new sound in “ship”?', target: 's h i p', choices: ['sh', 'hi', 'ip', 'ship'], answer: 'sh', hint: 'Two letters share one sound: /sh/.', level: 'foundation' },
    { id: 'blend-3', type: 'choice', skill: 'blends', prompt: 'Which word ends with a three-letter consonant team?', target: 'Find a trigraph', choices: ['match', 'black', 'ship', 'frog'], answer: 'match', hint: 'The letters tch work as one team at the end of match.', level: 'growing', transfer: true },
    { id: 'blend-4', type: 'choice', skill: 'blends', prompt: 'Choose the word with a consonant blend, not a digraph.', target: 'Listen for two sounds', choices: ['flag', 'thin', 'chat', 'when'], answer: 'flag', hint: 'You can hear both /f/ and /l/ in flag.', level: 'stretch', transfer: true },
  ],
  'mossy-hollow': [
    { id: 'syll-1', type: 'choice', skill: 'syllables', prompt: 'How many beats are in “rabbit”?', target: 'rab-bit', choices: ['1', '2', '3', '4'], answer: '2', hint: 'Tap rab-bit. Your mouth opens twice.', level: 'foundation' },
    { id: 'syll-2', type: 'choice', skill: 'syllables', prompt: 'Where can you divide “sunset”?', target: 'sunset', choices: ['sun / set', 's / unset', 'sunse / t', 'su / nset'], answer: 'sun / set', hint: 'Two closed syllables make two small words here.', level: 'foundation' },
    { id: 'syll-3', type: 'choice', skill: 'syllables', prompt: 'How many syllables are in “napkin”?', target: 'napkin', choices: ['1', '2', '3', '4'], answer: '2', hint: 'Say nap-kin and tap twice.', level: 'growing', transfer: true },
    { id: 'syll-4', type: 'choice', skill: 'syllables', prompt: 'Which word has three syllables?', target: 'Count the mouth beats', choices: ['rabbit', 'sunshine', 'remember', 'stamp'], answer: 'remember', hint: 'Re-mem-ber has three clear beats.', level: 'stretch', transfer: true },
  ],
  'ink-and-quill': [
    { id: 'encode-1', type: 'build', skill: 'encoding', prompt: 'Build the word you hear: /s/ /ŭ/ /n/.', target: 'A bright thing in the sky', answer: 'sun', hint: 'Say each sound, then write the letters that match.', level: 'foundation', transfer: true },
    { id: 'encode-2', type: 'build', skill: 'encoding', prompt: 'Build the word: /sh/ /ĭ/ /p/.', target: 'A boat on water', answer: 'ship', hint: 'The first two sounds share one team: sh.', level: 'foundation', transfer: true },
    { id: 'encode-3', type: 'build', skill: 'encoding', prompt: 'Spell the word with silent-e: /k/ /ī/ /t/.', target: 'A bird you might fly', answer: 'kite', hint: 'The quiet e helps i say its name.', level: 'growing', transfer: true },
    { id: 'encode-4', type: 'build', skill: 'encoding', prompt: 'Spell the word with a blend: /f/ /l/ /ă/ /g/.', target: 'It can wave in the wind', answer: 'flag', hint: 'Listen for both f and l at the start.', level: 'stretch', transfer: true },
  ],
  'trickster-tower': [
    { id: 'tricky-1', type: 'choice', skill: 'tricky-words', prompt: 'Which part of “said” is tricky?', target: 's a i d', choices: ['s', 'ai', 'd', 'all of it'], answer: 'ai', hint: 'The letters ai do not make their usual sound in said.', level: 'foundation', transfer: true, marked: 's[ai]d' },
    { id: 'tricky-2', type: 'choice', skill: 'tricky-words', prompt: 'Choose the word that completes the sentence.', target: 'I ___ a red hat.', choices: ['have', 'hav', 'hafe', 'hove'], answer: 'have', hint: 'Have is a heart word: remember the a-e part as one special team.', level: 'foundation', transfer: true, marked: 'h[ave]' },
    { id: 'tricky-3', type: 'choice', skill: 'tricky-words', prompt: 'Which word has a part to remember by heart?', target: 'Spot the tricky part', choices: ['what', 'when', 'whip', 'with'], answer: 'what', hint: 'The a in what does not use the sound you might expect.', level: 'growing', transfer: true, marked: 'wh[a]t' },
    { id: 'tricky-4', type: 'choice', skill: 'tricky-words', prompt: 'Complete the sentence: “They ___ to the park.”', target: 'Pick the high-frequency word', choices: ['went', 'want', 'wint', 'wented'], answer: 'went', hint: 'Went is a word to remember as a whole, with the e doing something unexpected.', level: 'stretch', transfer: true, marked: 'w[e]nt' },
  ],
  'story-lantern': [
    { id: 'read-1', type: 'reading', skill: 'reading', prompt: 'Read the little story. What did Sam put in the sack?', passage: 'Sam had a red sack. He put a shell and a snack in the sack. Then Sam sat on the grass.', choices: ['A shell and a snack', 'A flag and a kite', 'A book and a hat', 'A frog and a twig'], answer: 'A shell and a snack', hint: 'Look back at the second sentence. Readers can reread.', level: 'foundation', transfer: true },
    { id: 'read-2', type: 'reading', skill: 'reading', prompt: 'What is the best way to describe the little fox?', passage: 'The little fox can hop. It spots a log and naps in the sun. The fox is snug.', choices: ['Snug', 'Noisy', 'Lost', 'Wet'], answer: 'Snug', hint: 'The last sentence gives a clue about how the fox feels.', level: 'growing', transfer: true },
    { id: 'read-3', type: 'reading', skill: 'reading', prompt: 'Why did Mina grab a coat?', passage: 'Mina saw dark clouds. The wind got cold, so she got her coat before she went out.', choices: ['The wind got cold', 'She wanted a snack', 'She found a shell', 'The sun was hot'], answer: 'The wind got cold', hint: 'Connect the cold wind to what Mina needed.', level: 'stretch', transfer: true },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function safeEvidence(value: unknown): Evidence {
  const item = isRecord(value) ? value : {};
  return {
    attempts: numberOr(item.attempts, 0), correct: numberOr(item.correct, 0), firstTry: numberOr(item.firstTry, 0),
    hints: numberOr(item.hints, 0), transfer: numberOr(item.transfer, 0), spelling: numberOr(item.spelling, 0),
    reviewAttempts: numberOr(item.reviewAttempts, 0), reviewCorrect: numberOr(item.reviewCorrect, 0),
    heldAfterBreak: numberOr(item.heldAfterBreak, 0), lastPracticed: typeof item.lastPracticed === 'string' ? item.lastPracticed : null,
  };
}
function getProfileId(): string {
  try {
    const stored = localStorage.getItem(profileStorageKey);
    if (stored) return stored;
    const profileId = crypto.randomUUID();
    localStorage.setItem(profileStorageKey, profileId);
    return profileId;
  } catch {
    return crypto.randomUUID();
  }
}
function loadState(profileId: string): SavedState {
  const fallback = { version: 2 as const, profileId, quests: initialQuests, progress: initialProgress, audioEnabled: true, parentPinConfigured: false };
  try {
    const stored = localStorage.getItem('phonics-quest-state');
    if (!stored) return fallback;
    const raw: unknown = JSON.parse(stored);
    if (!isRecord(raw)) return fallback;
    if (typeof raw.profileId === 'string' && raw.profileId !== profileId) return fallback;
    const oldProgress = isRecord(raw.progress) ? raw.progress : {};
    const oldQuests = Array.isArray(raw.quests) ? raw.quests : [];
    const quests = initialQuests.map((quest) => {
      const old = oldQuests.find((item) => isRecord(item) && item.id === quest.id);
      if (!isRecord(old)) return quest;
      const status = old.status === 'complete' || old.status === 'locked' || old.status === 'open' ? old.status : quest.status;
      return { ...quest, status, progress: Math.max(0, Math.min(100, numberOr(old.progress, quest.progress))) };
    });
    const rawSkills = isRecord(oldProgress.skills) ? oldProgress.skills : {};
    const skills = skillIds.reduce((all, skill) => ({ ...all, [skill]: safeEvidence(rawSkills[skill]) }), {} as Record<SkillId, Evidence>);
    const progress: Progress = {
      ...initialProgress,
      streak: numberOr(oldProgress.streak, 0), stars: numberOr(oldProgress.stars, 0), mastered: numberOr(oldProgress.mastered, 0),
      minutes: numberOr(oldProgress.minutes, 0), sessions: numberOr(oldProgress.sessions, 0),
      recentSkill: typeof oldProgress.recentSkill === 'string' ? oldProgress.recentSkill : initialProgress.recentSkill,
      lastActiveDate: typeof oldProgress.lastActiveDate === 'string' ? oldProgress.lastActiveDate : null, skills,
    };
    return { version: 2, profileId, quests, progress, audioEnabled: typeof raw.audioEnabled === 'boolean' ? raw.audioEnabled : true, parentPinConfigured: false };
  } catch {
    return fallback;
  }
}
async function hashParentPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`phonics-quest-parent:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function stateFromProfile(profile: ProfileState, previous: SavedState): SavedState {
  const serverQuestProgress = new globalThis.Map(profile.questProgress.map((quest) => [quest.id, quest]));
  const quests = initialQuests.map((quest) => {
    const saved = serverQuestProgress.get(quest.id);
    return saved
      ? { ...quest, status: saved.status, progress: saved.progress }
      : quest;
  });
  const skills = skillIds.reduce((all, skill) => ({
    ...all,
    [skill]: profile.progress.skills[skill] ?? blankEvidence(),
  }), {} as Record<SkillId, Evidence>);
  return {
    ...previous,
    profileId: profile.profileId,
    quests,
    audioEnabled: profile.audioEnabled,
    parentPinConfigured: profile.parentPinConfigured,
    progress: {
      ...profile.progress,
      skills,
    },
  };
}
function today() { return new Date().toISOString().slice(0, 10); }
function daysBetween(previous: string | null, current: string): number {
  if (!previous) return 99;
  return Math.floor((new Date(`${current}T00:00:00`).getTime() - new Date(`${previous}T00:00:00`).getTime()) / 86400000);
}
function hasTransferEvidence(evidence: Evidence): boolean {
  return evidence.transfer + evidence.spelling >= 1;
}
function isReady(evidence: Evidence): boolean {
  return evidence.attempts >= 3 && evidence.firstTry >= 3 && evidence.correct / evidence.attempts >= .67 && hasTransferEvidence(evidence);
}
function questProgress(quest: Quest, evidence: Evidence): number {
  if (!evidence.attempts) return quest.progress;
  return Math.min(100, Math.round((evidence.correct / evidence.attempts) * 65 + Math.min(35, evidence.firstTry * 10)));
}
function stageSignal(evidence: Evidence, ready: boolean): { label: string; copy: string; tone: 'waiting' | 'practice' | 'prove' | 'ready' | 'held' } {
  if (ready && evidence.heldAfterBreak > 0) return { label: 'held after review', copy: 'She remembered this after a break.', tone: 'held' };
  if (ready) return { label: 'ready for the next lantern', copy: 'Independent success and transfer are showing.', tone: 'ready' };
  if (!evidence.attempts) return { label: 'waiting to glow', copy: 'Start here when this lantern calls.', tone: 'waiting' };
  if (evidence.firstTry < 3) return { label: 'practice the pattern', copy: 'Keep trying independently; clues are okay.', tone: 'practice' };
  if (!hasTransferEvidence(evidence)) return { label: 'show it in a new word', copy: 'One transfer or spelling win will light the way.', tone: 'prove' };
  return { label: 'gathering evidence', copy: 'A little more practice will make this glow.', tone: 'practice' };
}
function getVisibleQuests(state: SavedState): Quest[] {
  const readyCount = skillIds.filter((skill) => isReady(state.progress.skills[skill])).length;
  return state.quests.map((quest) => ({
    ...quest,
    progress: questProgress(quest, state.progress.skills[quest.skill]),
    status: quest.status === 'complete' ? 'complete' : quest.gated && readyCount < 3 ? 'locked' : 'open',
  }));
}
function getCurriculumRoute(state: SavedState) {
  const quests = getVisibleQuests(state);
  const firstIncomplete = curriculum.findIndex((stage) => !isReady(state.progress.skills[stage.skill]));
  const currentIndex = firstIncomplete === -1 ? curriculum.length - 1 : firstIncomplete;
  return curriculum.map((stage, index) => {
    const evidence = state.progress.skills[stage.skill];
    return {
      ...stage,
      index,
      evidence,
      ready: isReady(evidence),
      progress: questProgress({ progress: 0 } as Quest, evidence),
      quest: quests.find((quest) => quest.id === stage.questId),
      signal: stageSignal(evidence, isReady(evidence)),
      status: isReady(evidence) ? 'complete' as const : index === currentIndex ? 'current' as const : 'upcoming' as const,
    };
  });
}
function getLessonChallenges(quest: Quest, state: SavedState): Array<Challenge & { review: boolean }> {
  const bank = challengeBank[quest.id] ?? [];
  const ready = isReady(state.progress.skills[quest.skill]);
  const picked = ready
    ? bank
    : bank.filter((challenge) => challenge.level === 'foundation' || (challenge.transfer && challenge.level === 'growing'));
  const base = picked.length ? picked : bank.slice(0, 2);
  const review = quest.status === 'complete' || state.progress.skills[quest.skill].attempts > 0;
  return base.map((challenge, index) => ({ ...challenge, review: review && (index > 0 || quest.status === 'complete') }));
}
function Logo() {
  return <Link href="/" className="brand-mark" data-testid="link-home"><span className="brand-icon"><WandSparkles size={21} /></span><span className="brand-name">Phonics <span>Quest</span></span></Link>;
}
function Shell({ children, audioEnabled, onToggleAudio }: { children: ReactNode; audioEnabled: boolean; onToggleAudio: () => void }) {
  return <div className="app-shell"><div className="shell-inner"><header className="topbar"><Logo /><div className="topbar-actions"><button className={`audio-toggle ${audioEnabled ? 'on' : ''}`} type="button" onClick={onToggleAudio} aria-pressed={audioEnabled} data-testid="button-toggle-audio">{audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}<span>{audioEnabled ? 'Listen on' : 'Listen off'}</span></button><Link href="/grown-up" className="grownup-link" data-testid="link-grown-up"><UserRound size={14} /> Grown-up view</Link></div></header>{children}</div></div>;
}
function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .82;
  window.speechSynthesis.speak(utterance);
}
function getTrailPath(bounds: DOMRect, nodes: Element[]): string {
  const points = nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: ((rect.left + rect.width / 2 - bounds.left) / bounds.width) * 100,
      y: ((rect.top + rect.height / 2 - bounds.top) / bounds.height) * 1000,
    };
  });
  if (!points.length) return '';
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const distance = point.y - previous.y;
    const direction = index % 2 === 0 ? -1 : 1;
    const sway = Math.min(19, Math.max(11, bounds.width / 62)) * direction;
    return `${path} C ${previous.x + sway} ${previous.y + distance * .36}, ${point.x + sway} ${point.y - distance * .36}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}
function LanternTrail({ route, onSelect }: { route: ReturnType<typeof getCurriculumRoute>; onSelect: (id: string) => void }) {
  const trailRef = useRef<HTMLDivElement>(null);
  const [trailPath, setTrailPath] = useState('');
  useEffect(() => {
    const trail = trailRef.current;
    if (!trail) return;
    const updatePath = () => {
      const bounds = trail.getBoundingClientRect();
      const nodes = Array.from(trail.querySelectorAll('.lantern-node'));
      if (bounds.width && bounds.height && nodes.length) setTrailPath(getTrailPath(bounds, nodes));
    };
    updatePath();
    const observer = new ResizeObserver(updatePath);
    observer.observe(trail);
    return () => observer.disconnect();
  }, [route.length]);
  return <section className="trail-section reveal" aria-labelledby="trail-heading" data-testid="section-lantern-trail">
    <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> The main story path</div><h2 id="trail-heading">Follow the lantern trail</h2><p>The next glowing lantern is the best place to play. Side paths stay open for review and curiosity.</p></div><Map size={22} color="hsl(177 54% 66%)" /></div>
    <div className="trail-guide"><Sparkles size={15} /><span><strong>How the trail moves:</strong> practice independently, use the skill in a new word, then let review show what holds.</span></div>
    <div className="lantern-trail" ref={trailRef}>
      <div className="trail-path" aria-hidden="true"><svg viewBox="0 0 100 1000" preserveAspectRatio="none"><path className="trail-path-shadow" d={trailPath} /><path className="trail-path-lane" d={trailPath} /><path className="trail-path-line" d={trailPath} /></svg></div>
      {route.map((stage) => {
        const isRight = stage.index % 2 === 1;
        const quest = stage.quest;
        const card = <div className="trail-card"><div className="trail-card-top"><span>Step {stage.index + 1}</span><span className={`trail-signal ${stage.signal.tone}`}>{stage.status === 'complete' ? <Check size={11} /> : stage.status === 'current' ? <Sparkles size={11} /> : null}{stage.status === 'complete' && stage.signal.tone === 'held' ? 'held' : stage.status === 'complete' ? 'ready' : stage.status === 'current' ? 'play this next' : 'upcoming'}</span></div><h3>{stage.label}</h3><p>{stage.outcome}</p><div className="trail-card-bottom"><span>{stage.signal.copy}</span><span>{stage.progress}%</span></div><div className="trail-progress"><span style={{ width: `${stage.progress}%` }} /></div></div>;
        const node = <button type="button" className={`lantern-node ${stage.status} ${stage.signal.tone}`} disabled={!quest || quest.status === 'locked'} onClick={() => quest && onSelect(quest.id)} aria-label={`${stage.label}: ${stage.signal.label}`} data-testid={`button-trail-${stage.id}`}><span className="lantern-glow"><Sparkles size={19} /></span></button>;
        return <div className={`trail-stop ${isRight ? 'right' : 'left'} ${stage.status}`} key={stage.id}>{isRight ? <span className="trail-spacer" /> : card}{node}{isRight ? card : <span className="trail-spacer" />}</div>;
      })}
    </div>
  </section>;
}
function Hub({ state, onSelect, onToggleAudio }: { state: SavedState; onSelect: (id: string) => void; onToggleAudio: () => void }) {
  const quests = getVisibleQuests(state);
  const readyCount = skillIds.filter((skill) => isReady(state.progress.skills[skill])).length;
  const route = getCurriculumRoute(state);
  const recommended = route.find((stage) => stage.status === 'current') ?? route[route.length - 1];
  const recommendedQuest = recommended?.quest;
  const sideQuests = quests.filter((quest) => quest.id !== recommendedQuest?.id);
  return <Shell audioEnabled={state.audioEnabled} onToggleAudio={onToggleAudio}><main>
    <section className="hero-row"><div className="reveal"><div className="eyebrow"><span className="eyebrow-line" /> Your next discovery</div><h1 className="page-title">Ready to follow the <em>glow?</em></h1><p className="page-lede">Every sound is a tiny key. Follow the next lantern, listen closely, and build words that help the story unfold.</p><div className="hero-constellation"><p className="constellation-copy"><strong>{recommended?.label ?? 'A sound path'}</strong> is waiting nearby. The map keeps the next learning step bright while every foundation remains available for practice.</p><div className="star-cluster"><i /><i /><i /><i /></div></div></div><aside className="progress-card reveal reveal-delay" data-testid="card-child-progress"><div className="progress-card-head"><span>Tonight’s trail</span><Flame size={16} /></div><div className="progress-number" data-testid="text-stars">{state.progress.stars}<small>discovery stars</small></div><div className="progress-rail"><div className="progress-fill" style={{ width: `${Math.min(100, state.progress.stars * 8)}%` }} /></div><p className="progress-note">{readyCount} skills growing strong · {state.progress.streak} day streak</p></aside></section>
    <LanternTrail route={route} onSelect={onSelect} />
    <section aria-labelledby="quest-heading"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Side paths</div><h2 id="quest-heading">Explore and review</h2><p>These rooms stay open for practice, replay, and curiosity. The trail above remains the recommended route.</p></div><Map size={22} color="hsl(177 54% 66%)" /></div><div className="quest-grid side-quest-grid">{sideQuests.map((quest, index) => <button key={quest.id} type="button" disabled={quest.status === 'locked'} className={`quest-card ${index === 0 ? 'featured' : ''} ${quest.status}`} style={{ '--quest-accent': quest.accent } as CSSProperties} onClick={() => onSelect(quest.id)} data-testid={`button-quest-${quest.id}`}><div className="quest-card-top"><span className="quest-badge">{quest.status === 'complete' ? <Check size={12} /> : quest.status === 'locked' ? <LockKeyhole size={12} /> : <Sparkles size={12} />} {quest.status === 'complete' ? 'discovered' : quest.category}</span>{quest.status === 'locked' ? <LockKeyhole size={16} className="quest-status" /> : <ChevronRight size={17} className="quest-status" />}</div><div><h3>{quest.title}</h3><p>{quest.subtitle}</p></div><div className="quest-card-bottom">{quest.status === 'locked' ? <span className="locked-note"><LockKeyhole size={12} /> Explore three growing skills to open this story</span> : <span className="mini-progress"><span className="mini-rail"><span style={{ width: `${quest.progress}%` }} /></span>{quest.progress}%</span>}{quest.status !== 'locked' && <span className="quest-arrow"><ChevronRight size={16} strokeWidth={2.5} /></span>}</div></button>)}</div></section>
    <div className="hub-footer"><Sparkles size={14} color="hsl(40 94% 68%)" /><span><strong>Practice cue:</strong> talk about what a new word means, not just how it sounds.</span></div>
  </main></Shell>;
}

function Lesson({ quest, state, onBack, onRecord, onHint, onToggleAudio }: { quest: Quest; state: SavedState; onBack: () => void; onRecord: (quest: Quest, challenge: Challenge & { review: boolean }, correct: boolean, firstTry: boolean, hinted: boolean, finalChallenge: boolean) => void; onHint: (skill: SkillId) => void; onToggleAudio: () => void }) {
  const challenges = useRef(getLessonChallenges(quest, state)).current;
  const [mode, setMode] = useState<'intro' | 'challenge' | 'complete'>('intro');
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const current = (challenges[challengeIndex] ?? challenges[0])!;
  const resetChallenge = () => { setFeedback(null); setSelected(null); setResponse(''); setHintShown(false); };
  const submit = (value: string) => {
    if (feedback === 'correct') return;
    if (!value.trim()) return;
    const isCorrect = value.trim().toLowerCase() === current.answer.toLowerCase();
    const firstTry = attempts === 0;
    setAttempts((valueNow) => valueNow + 1);
    setSelected(value);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      setSessionCorrect((valueNow) => valueNow + 1);
      onRecord(quest, current, true, firstTry, hintShown, challengeIndex === challenges.length - 1);
    } else {
      onRecord(quest, current, false, false, hintShown, false);
    }
  };
  const next = () => {
    if (challengeIndex >= challenges.length - 1) setMode('complete');
    else { setChallengeIndex((value) => value + 1); setAttempts(0); resetChallenge(); }
  };
  const showHint = () => { const nextValue = !hintShown; setHintShown(nextValue); if (nextValue) onHint(current.skill); };
  const listenText = current.type === 'reading' ? current.passage ?? current.prompt : current.answer;
  if (mode === 'intro') return <LessonFrame onBack={onBack} audioEnabled={state.audioEnabled} onToggleAudio={onToggleAudio}><div className="lesson-card lesson-intro reveal"><div className="lesson-icon"><BookOpen size={33} /></div><div className="lesson-kicker">{quest.category} · a sound story</div><h1>Into the <em>{quest.title.replace('The ', '')}</em></h1><p className="lesson-intro-copy">{quest.subtitle} We will notice, build, and talk about words. A clue is a tool, not a penalty.</p><div className="intro-facts"><div className="intro-fact"><strong>{challenges.length}</strong>sound stops</div><div className="intro-fact"><strong>listen</strong>optional audio</div><div className="intro-fact"><strong>your pace</strong>no timer</div></div><button className="primary-button large" type="button" onClick={() => setMode('challenge')} data-testid="button-start-lesson">Start the journey <ChevronRight size={16} /></button></div></LessonFrame>;
  if (mode === 'complete') return <LessonFrame onBack={onBack} audioEnabled={state.audioEnabled} onToggleAudio={onToggleAudio}><div className="lesson-card complete-wrap reveal"><div className="lesson-icon"><Trophy size={34} /></div><div className="lesson-kicker">path discovered</div><h1>You found the <em>glow!</em></h1><p className="complete-copy">You stayed with the sounds and made meaning from them. That is strong reading practice.</p><div className="reward-card"><div className="reward-item"><Star size={21} fill="currentColor" /><strong>new</strong><span>discovery</span></div><div className="reward-item"><Check size={21} /><strong>{sessionCorrect}</strong><span>sound keys</span></div><div className="reward-item"><Flame size={21} /><strong>{state.progress.streak || 1}</strong><span>day rhythm</span></div></div><div className="button-row"><button type="button" className="secondary-button" onClick={() => { setMode('intro'); setChallengeIndex(0); setAttempts(0); setSessionCorrect(0); resetChallenge(); }} data-testid="button-replay-lesson"><RotateCcw size={15} /> Explore again</button><button type="button" className="primary-button" onClick={onBack} data-testid="button-return-hub">Back to map <Map size={15} /></button></div></div></LessonFrame>;
  return <LessonFrame onBack={onBack} audioEnabled={state.audioEnabled} onToggleAudio={onToggleAudio}><div className="lesson-head"><div><div className="eyebrow"><span className="eyebrow-line" /> {quest.title}</div><h1>Follow the clue</h1></div><p>Notice the sound, try it, and tell the story in your own way.</p></div><div className="lesson-card reveal"><div className="lesson-progress"><span>key {challengeIndex + 1} of {challenges.length}</span><div className="lesson-progress-rail"><span style={{ width: `${((challengeIndex + 1) / challenges.length) * 100}%` }} /></div></div><div className="challenge-meta"><span className="meta-pill active">{current.level} path</span>{current.review && <span className="meta-pill"><RotateCcw size={11} /> review trail</span>}{(current.transfer || current.type === 'build' || current.type === 'reading') && <span className="meta-pill"><Sparkles size={11} /> use it</span>}</div><div className="lesson-kicker">{current.type === 'build' ? 'spell it' : current.type === 'reading' ? 'read and think' : skillNames[current.skill]}</div><h2 className="lesson-prompt">{current.prompt}</h2>{current.type === 'reading' ? <div className="story-card"><p>{current.passage}</p></div> : <div className="lesson-target" data-testid="text-challenge-target">{current.target}</div>}{current.marked && <p className="lesson-target" aria-label="Tricky part highlighted"><MarkedWord value={current.marked} /> <small>the highlighted part is the tricky bit</small></p>}{current.type === 'build' ? <form className="build-form" onSubmit={(event) => { event.preventDefault(); submit(response); }}><input className="build-input" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="write the word" aria-label="Write your answer" data-testid="input-word-answer" autoCapitalize="none" /><button className="primary-button" type="submit" disabled={feedback === 'correct'} data-testid="button-check-word">Check word <Check size={15} /></button></form> : <div className="choices" role="group" aria-label="Answer choices">{(current.choices ?? []).map((choice) => <button key={choice} type="button" disabled={feedback === 'correct'} className={`choice ${selected === choice && feedback === 'correct' ? 'correct' : ''} ${selected === choice && feedback === 'incorrect' ? 'wrong' : ''}`} onClick={() => submit(choice)} data-testid={`button-choice-${choice.replace(/[^a-z0-9]/gi, '-')}`}>{choice}</button>)}</div>}<div><button type="button" className="listen-button" onClick={() => speak(listenText, state.audioEnabled)} disabled={!state.audioEnabled} data-testid="button-listen"><Headphones size={15} /> {state.audioEnabled ? 'Listen to it' : 'Turn listening on'}</button><button type="button" className="hint-button" onClick={showHint} aria-expanded={hintShown} data-testid="button-show-hint"><Lightbulb size={15} /> {hintShown ? 'Hide my clue' : 'Need a little clue?'}</button></div>{hintShown && <div className="hint-box" data-testid="text-hint">{current.hint}</div>}{feedback && <div className={`feedback ${feedback}`} data-testid={`status-answer-${feedback}`}><div className="feedback-copy">{feedback === 'correct' ? <Check size={18} /> : <CircleHelp size={18} />}<div><strong>{feedback === 'correct' ? 'That clue opened the door.' : 'Good try. Your brain is listening.'}</strong><span>{feedback === 'correct' ? 'You can move on, or listen and notice why it works.' : 'Try again, say the word slowly, or use the clue.'}</span></div></div>{feedback === 'correct' ? <button type="button" className="feedback-action" onClick={next} data-testid="button-next-challenge">{challengeIndex === challenges.length - 1 ? 'Finish path' : 'Next clue'} <ChevronRight size={16} /></button> : <button type="button" className="feedback-action" onClick={resetChallenge} data-testid="button-retry-challenge">Try again</button>}</div>}</div></LessonFrame>;
}
function LessonFrame({ children, onBack, audioEnabled, onToggleAudio }: { children: ReactNode; onBack: () => void; audioEnabled: boolean; onToggleAudio: () => void }) {
  return <main className="lesson-shell"><div className="lesson-top-tools"><button className={`audio-toggle ${audioEnabled ? 'on' : ''}`} type="button" onClick={onToggleAudio} aria-pressed={audioEnabled} data-testid="button-toggle-audio"><Volume2 size={14} /> {audioEnabled ? 'Listen on' : 'Listen off'}</button></div><button className="back-link" type="button" onClick={onBack} data-testid="button-back-hub"><ChevronLeft size={15} /> Back to the map</button>{children}</main>;
}
function MarkedWord({ value }: { value: string }) {
  const start = value.indexOf('[');
  const end = value.indexOf(']');
  if (start < 0 || end < 0) return <>{value}</>;
  return <>{value.slice(0, start)}<mark>{value.slice(start + 1, end)}</mark>{value.slice(end + 1)}</>;
}

function ParentGate({ profileId, hasPin, audioEnabled, onToggleAudio, onBack, onUnlock, onProfile }: {
  profileId: string;
  hasPin: boolean;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onBack: () => void;
  onUnlock: () => void;
  onProfile: (profile: ProfileState) => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('Please enter four numbers.');
      return;
    }
    if (!hasPin && pin !== confirmation) {
      setError('Those PINs do not match yet.');
      return;
    }
    setBusy(true);
    try {
      const enteredHash = await hashParentPin(pin);
      if (hasPin) {
          const result = await verifyPhonicsParentPin(profileId, { pinHash: enteredHash });
          if (!result.valid) {
          setError('That PIN did not open the grown-up view.');
          setPin('');
          return;
        }
        onUnlock();
        return;
      }
        const profile = await setPhonicsParentPin(profileId, { pinHash: enteredHash });
        onProfile(profile);
      onUnlock();
    } catch {
        setError('The PIN could not be saved or checked right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <Shell audioEnabled={audioEnabled} onToggleAudio={onToggleAudio}><main className="parent-gate-page"><section className="parent-gate-card" aria-labelledby="parent-gate-heading"><div className="lesson-icon parent-gate-icon"><LockKeyhole size={30} /></div><div className="eyebrow parent-gate-eyebrow"><span className="eyebrow-line" /> A grown-up checkpoint</div><h1 id="parent-gate-heading">{hasPin ? <>Enter the <em>lantern PIN.</em></> : <>Create a <em>lantern PIN.</em></>}</h1><p className="parent-gate-copy">{hasPin ? 'This keeps the progress map tucked away while a child is playing.' : 'Choose four numbers to keep the progress map tucked away while a child is playing.'}</p><form className="parent-gate-form" onSubmit={submit}><label className="pin-field"><span>{hasPin ? 'Grown-up PIN' : 'Choose a 4-digit PIN'}</span><input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus aria-describedby={error ? 'parent-gate-error' : 'parent-gate-note'} /></label>{!hasPin && <label className="pin-field"><span>Enter it again</span><input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>}{error && <p className="parent-gate-error" id="parent-gate-error" role="alert">{error}</p>}<button className="primary-button large" type="submit" disabled={busy}>{busy ? 'Checking…' : hasPin ? 'Open grown-up view' : 'Save PIN and continue'} <ChevronRight size={16} /></button></form><p className="parent-gate-note" id="parent-gate-note">Only a one-way PIN hash is stored with this learner profile. It is a privacy step, not an online account.</p><button className="secondary-button parent-gate-back" type="button" onClick={onBack}><ChevronLeft size={15} /> Back to the map</button></section></main></Shell>;
}

function GrownUp({ state, onToggleAudio }: { state: SavedState; onToggleAudio: () => void }) {
  const quests = getVisibleQuests(state);
  const route = getCurriculumRoute(state);
  const nextStage = route.find((stage) => stage.status === 'current') ?? route[route.length - 1];
  const skills = useMemo(() => skillIds.map((skill) => {
    const evidence = state.progress.skills[skill];
    return { id: skill, label: skillNames[skill], progress: questProgress({ progress: 0 } as Quest, evidence), evidence, ready: isReady(evidence) };
  }), [state.progress]);
  const bars = [18, 35, 11, 54, 30, 72, Math.min(86, 18 + state.progress.sessions * 8)];
  const reviewed = skills.filter((skill) => skill.evidence.reviewAttempts > 0).slice(0, 4);
  return <Shell audioEnabled={state.audioEnabled} onToggleAudio={onToggleAudio}><main className="grownup-page"><section className="grownup-hero"><div className="eyebrow"><span className="eyebrow-line" /> A quieter corner of the quest</div><h1>Her trail, at a <em>glance.</em></h1><p>Progress is more than a score. This view separates accuracy, independent tries, helpful clues, transfer into spelling and reading, and how skills hold up in review.</p></section><section className="stats-grid"><div className="stat-card highlight" data-testid="card-streak"><label>Current rhythm</label><strong>{state.progress.streak} days</strong><small>Short, steady practice is welcome.</small></div><div className="stat-card" data-testid="card-total-stars"><label>Discoveries</label><strong>{state.progress.stars}</strong><small>storybook rewards</small></div><div className="stat-card" data-testid="card-mastered"><label>Ready to grow</label><strong>{skills.filter((skill) => skill.ready).length}</strong><small>of {skills.length} skill paths</small></div><div className="stat-card" data-testid="card-minutes"><label>Practice time</label><strong>{state.progress.minutes}</strong><small>minutes together</small></div></section><section className="panel roadmap-panel" data-testid="panel-learning-roadmap"><div className="roadmap-heading"><div><h2>The learning route</h2><p className="panel-subtitle">The app recommends this order because each step prepares the next one.</p></div><span className="roadmap-rule">evidence-led</span></div><div className="roadmap-list">{route.map((stage) => <div className={`roadmap-step ${stage.status}`} key={stage.id} data-testid={`roadmap-step-${stage.id}`}><div className="roadmap-marker">{stage.status === 'complete' ? <Check size={14} /> : stage.status === 'current' ? <Sparkles size={14} /> : <span>{stage.index + 1}</span>}</div><div className="roadmap-step-body"><div className="roadmap-step-top"><span>Step {stage.index + 1}</span><span>{stage.status === 'complete' ? 'ready for the next step' : stage.status === 'current' ? 'recommended now' : 'upcoming'}</span></div><h3>{stage.label}</h3><p className="roadmap-outcome"><strong>Outcome:</strong> {stage.outcome}</p><p className="roadmap-why"><strong>Why here:</strong> {stage.why}</p><div className="roadmap-step-footer"><span>{stage.example}</span><span>{stage.progress}% evidence</span></div><div className="skill-track"><span style={{ width: `${stage.progress}%`, '--skill-color': skillColors[stage.skill] } as CSSProperties} /></div>{stage.status === 'current' && stage.quest && <Link className="roadmap-link" href={`/quest/${stage.quest.id}`} data-testid={`link-roadmap-${stage.id}`}>Preview this path <ChevronRight size={13} /></Link>}</div></div>)}</div><div className="roadmap-note"><strong>How advancement works</strong><p>A path becomes ready after at least 3 accurate first-try successes with roughly 67% overall accuracy plus at least one transfer or spelling success. A later review can show that the skill held, while review and exploration remain available. This is learning guidance, not a diagnosis.</p></div></section><div className="progress-layout"><section className="panel"><h2>Evidence by skill</h2><p className="panel-subtitle">A useful snapshot, not a diagnosis.</p>{skills.map((skill) => <div className="skill-row" key={skill.id}><div className="skill-row-head"><span>{skill.label}</span><span>{skill.ready ? 'ready for a stretch' : `${skill.progress}% evidence gathered`}</span></div><div className="skill-track"><span style={{ width: `${skill.progress}%`, '--skill-color': skillColors[skill.id] } as CSSProperties} /></div><div className="evidence-grid"><div className="evidence-item"><strong>{skill.evidence.correct}/{skill.evidence.attempts}</strong><span>accurate tries</span></div><div className="evidence-item"><strong>{skill.evidence.firstTry}</strong><span>independent first tries</span></div><div className="evidence-item"><strong>{skill.evidence.hints}</strong><span>clues used</span></div><div className="evidence-item"><strong>{skill.evidence.transfer + skill.evidence.spelling}</strong><span>transfer or spelling wins</span></div></div></div>)}<div className="recommendation"><strong>Next recommended path: {nextStage?.label}</strong><p>{nextStage?.outcome} The app chose it as the first unfinished step in the route, not because it has the most points.</p>{nextStage?.quest && <Link href={`/quest/${nextStage.quest.id}`} data-testid="link-recommended-quest">Visit this path <ChevronRight size={13} /></Link>}</div></section><section className="panel"><h2>Review and rhythm</h2><p className="panel-subtitle">Skills come back later so we can notice what holds.</p><div className="week-chart" aria-label="Practice minutes for the last seven days">{bars.map((height, index) => <div className="day-bar-wrap" key={index}><div className={`day-bar ${index === 6 ? 'today' : ''}`} style={{ height: `${height}%` }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></div>)}</div><div className="retention-list">{reviewed.length ? reviewed.map((skill) => <div className="retention-row" key={skill.id}><div><strong>{skill.label}</strong><small>{skill.evidence.reviewCorrect} of {skill.evidence.reviewAttempts} review tries</small></div><span className="retention-badge">{skill.evidence.heldAfterBreak ? 'held after a break' : 'reviewing'}</span></div>) : <div className="empty-progress"><BookMarked size={18} /><p>Review trails will appear after a skill has been visited once. They are a calm way to see what sticks later.</p></div>}</div><div className="tip-box"><strong>Try this together</strong><p>Ask what a new word means, use it in a silly sentence, and celebrate the thinking even when a clue helps.</p></div></section></div><div className="footer-note">Saved on this device · no account needed · app guidance is not a diagnosis</div></main></Shell>;
}
function NotFound({ audioEnabled, onToggleAudio }: { audioEnabled: boolean; onToggleAudio: () => void }) {
  return <Shell audioEnabled={audioEnabled} onToggleAudio={onToggleAudio}><main className="not-found"><div className="lesson-icon"><CircleHelp size={30} /></div><h1 className="page-title">That path is still <em>unwritten.</em></h1><p className="page-lede" style={{ marginInline: 'auto' }}>Return to the map and choose a story that is ready to glow.</p><Link className="primary-button" href="/" data-testid="link-not-found-home">Back to the map <Map size={15} /></Link></main></Shell>;
}

function AppRouter() {
  const [, setLocation] = useLocation();
  const [profileId] = useState(() => getProfileId());
  const [state, setState] = useState<SavedState>(() => loadState(profileId));
  const [syncStatus, setSyncStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const syncQueue = useRef(Promise.resolve());

  const applyProfile = (profile: ProfileState) => {
    setState((current) => stateFromProfile(profile, current));
    setSyncStatus('ready');
  };

  useEffect(() => {
    let active = true;
    const legacy = state;
    initializePhonicsProfile(profileId, {
      audioEnabled: legacy.audioEnabled,
      legacyProgress: legacy.progress,
      completedQuestIds: legacy.quests.filter((quest) => quest.status === 'complete').map((quest) => quest.id),
    }).then((profile) => {
      if (!active) return;
      applyProfile(profile);
      try { localStorage.removeItem('phonics-quest-state'); } catch { /* migration cleanup is best effort */ }
    }).catch(() => {
      if (active) setSyncStatus('offline');
    });
    return () => { active = false; };
  }, [profileId]);

  const reportSyncError = () => setSyncStatus('offline');
  const queueProfileUpdate = (operation: () => Promise<ProfileState>) => {
    const next = syncQueue.current.then(operation, operation);
    syncQueue.current = next.then(() => undefined, () => undefined);
    next.then(applyProfile).catch(reportSyncError);
  };
  const toggleAudio = () => {
    const audioEnabled = !state.audioEnabled;
    setState((current) => ({ ...current, audioEnabled }));
    queueProfileUpdate(() => updatePhonicsProfileSettings(profileId, { audioEnabled }));
  };
  const recordHint = (_skill: SkillId) => {};
  const recordAnswer = (quest: Quest, challenge: Challenge & { review: boolean }, correct: boolean, firstTry: boolean, hinted: boolean, finalChallenge: boolean) => {
    setState((current) => {
    const before = current.progress.skills[challenge.skill];
    const gap = daysBetween(before.lastPracticed, today());
    const after: Evidence = {
      ...before, attempts: before.attempts + 1, correct: before.correct + (correct ? 1 : 0),
      firstTry: before.firstTry + (correct && firstTry && !hinted ? 1 : 0),
      transfer: before.transfer + (correct && challenge.transfer ? 1 : 0),
      spelling: before.spelling + (correct && challenge.type === 'build' ? 1 : 0),
      reviewAttempts: before.reviewAttempts + (challenge.review ? 1 : 0),
      reviewCorrect: before.reviewCorrect + (challenge.review && correct ? 1 : 0),
      heldAfterBreak: before.heldAfterBreak + (challenge.review && correct && gap > 1 ? 1 : 0),
      lastPracticed: today(),
    };
    const skills = { ...current.progress.skills, [challenge.skill]: after };
    const firstCompletion = finalChallenge && quest.status !== 'complete';
    const readyCount = skillIds.filter((skill) => isReady(skills[skill])).length;
    const lastActiveDate = today();
    return {
      ...current,
      progress: { ...current.progress, skills, mastered: readyCount, recentSkill: skillNames[challenge.skill], stars: current.progress.stars + (firstCompletion ? 4 : 0), minutes: current.progress.minutes + (firstCompletion ? 3 : 0), sessions: current.progress.sessions + (firstCompletion ? 1 : 0), streak: firstCompletion ? Math.max(1, current.progress.streak + (current.progress.lastActiveDate === lastActiveDate ? 0 : 1)) : current.progress.streak, lastActiveDate },
      quests: current.quests.map((item) => item.id === quest.id ? { ...item, progress: finalChallenge ? 100 : Math.min(90, item.progress + 18), status: finalChallenge ? 'complete' : item.status } : item),
    };
    });
    queueProfileUpdate(() => recordPhonicsAttempt(profileId, {
      questId: quest.id,
      challengeId: challenge.id,
      skill: challenge.skill,
      correct,
      firstTry,
      hinted,
      transfer: Boolean(challenge.transfer),
      spelling: challenge.type === 'build',
      review: challenge.review,
      finalChallenge,
    }));
  };

  if (syncStatus === 'loading') {
    return <main className="not-found"><div className="lesson-icon"><Sparkles size={30} /></div><h1 className="page-title">Waking the <em>lantern trail.</em></h1><p className="page-lede" style={{ marginInline: 'auto' }}>Your progress is coming back from its storybook shelf.</p></main>;
  }
  return <><Switch><Route path="/grown-up">{parentUnlocked ? <GrownUp state={state} onToggleAudio={toggleAudio} /> : <ParentGate profileId={profileId} hasPin={state.parentPinConfigured} audioEnabled={state.audioEnabled} onToggleAudio={toggleAudio} onBack={() => setLocation('/')} onUnlock={() => setParentUnlocked(true)} onProfile={applyProfile} />}</Route><Route path="/quest/:id">{(params) => { const quest = getVisibleQuests(state).find((item) => item.id === params.id); return quest ? <Lesson quest={quest} state={state} onBack={() => setLocation('/')} onRecord={recordAnswer} onHint={recordHint} onToggleAudio={toggleAudio} /> : <NotFound audioEnabled={state.audioEnabled} onToggleAudio={toggleAudio} />; }}</Route><Route path="/"><Hub state={state} onSelect={(id) => setLocation(`/quest/${id}`)} onToggleAudio={toggleAudio} /></Route><Route><NotFound audioEnabled={state.audioEnabled} onToggleAudio={toggleAudio} /></Route></Switch>{syncStatus === 'offline' && <div className="sync-warning" role="status" data-testid="status-sync-offline">The lantern shelf is offline. New progress is only on this screen until the connection returns.</div>}</>;
}
function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRouter /></WouterRouter>;
}
export default App;