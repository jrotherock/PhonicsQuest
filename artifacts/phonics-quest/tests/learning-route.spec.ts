import { expect, test, type Page } from '@playwright/test';

type SkillId =
  | 'awareness'
  | 'short-vowels'
  | 'encoding'
  | 'blends'
  | 'long-vowels'
  | 'syllables'
  | 'tricky-words'
  | 'reading';

type EvidenceSeed = {
  attempts?: number;
  correct?: number;
  firstTry?: number;
  transfer?: number;
  spelling?: number;
};

type SeededSkills = Partial<Record<SkillId, EvidenceSeed>>;

const readySkill: EvidenceSeed = { attempts: 3, correct: 3, firstTry: 3, transfer: 1 };

async function openHub(page: Page, skills: SeededSkills = {}) {
  await page.addInitScript((seed) => {
    window.localStorage.setItem(
      'phonics-quest-state',
      JSON.stringify({ version: 2, progress: { skills: seed } }),
    );
  }, skills);
  await page.goto('/');
  await expect(page.getByTestId('section-lantern-trail')).toBeVisible();
}

test('shows the initial recommendation and plays it from the child hub', async ({ page }) => {
  await openHub(page);

  const recommendation = page.locator('.trail-stop.current');
  await expect(recommendation.locator('h3')).toHaveText('Hear and move sounds');
  await expect(recommendation.locator('button')).toBeEnabled();

  await recommendation.locator('button').click({ force: true });

  await expect(page).toHaveURL(/\/quest\/lantern\/?$/);
  await expect(
    page.getByRole('heading', { name: 'Into the Lantern Library' }),
  ).toBeVisible();
});

test('advances after independent first-try evidence', async ({ page }) => {
  await openHub(page, {
    awareness: { attempts: 1, correct: 1, firstTry: 1 },
  });

  await expect(page.locator('.trail-stop.current').locator('h3')).toHaveText(
    'Hear and move sounds',
  );
  await page.locator('.trail-stop.current button').click({ force: true });
  await page.getByTestId('button-start-lesson').click();

  await page.getByRole('button', { name: 'map', exact: true }).click();
  await expect(page.getByTestId('status-answer-correct')).toBeVisible();
  await page.getByTestId('button-next-challenge').click();

  await page.getByRole('button', { name: '/f/', exact: true }).click();
  await expect(page.getByTestId('status-answer-correct')).toBeVisible();
  await page.getByTestId('button-next-challenge').click();
  await page.getByRole('button', { name: 'tap', exact: true }).click();
  await expect(page.getByTestId('status-answer-correct')).toBeVisible();
  await page.getByTestId('button-next-challenge').click();
  await page.getByRole('button', { name: '/p/', exact: true }).click();
  await expect(page.getByTestId('status-answer-correct')).toBeVisible();
  await page.getByTestId('button-next-challenge').click();
  await expect(
    page.getByRole('heading', { name: /You found the glow!/ }),
  ).toBeVisible();

  await page.getByTestId('button-return-hub').click();
  await expect(page).toHaveURL(/\/?$/);
  await expect(page.locator('.trail-stop.current').locator('h3')).toHaveText(
    'Short vowels in simple words',
  );
  await expect(page.getByTestId('button-quest-lantern')).toHaveClass(/complete/);
});

test('keeps reading locked until three skills are ready', async ({ page }) => {
  await openHub(page, {
    awareness: readySkill,
    'short-vowels': readySkill,
  });

  const readingQuest = page.getByTestId('button-quest-story-lantern');
  await expect(readingQuest).toBeDisabled();
  await expect(readingQuest).toContainText('Explore three growing skills to open this story');
});

test('opens reading and keeps the grown-up route aligned with the child hub', async ({ page }) => {
  await openHub(page, {
    awareness: readySkill,
    'short-vowels': readySkill,
    encoding: readySkill,
  });

  const childRecommendation = page.locator('.trail-stop.current');
  const childLabel = await childRecommendation.locator('h3').innerText();
  const childOutcome = await childRecommendation.locator('p').innerText();

  await expect(page.getByTestId('button-quest-story-lantern')).toBeEnabled();
  await page.getByTestId('button-quest-story-lantern').click();
  await expect(
    page.getByRole('heading', { name: 'Into the Story Lantern' }),
  ).toBeVisible();

  await page.getByTestId('button-back-hub').click();
  await page.getByTestId('link-grown-up').click();
  await expect(page).toHaveURL(/\/grown-up\/?$/);
  await expect(page.getByRole('heading', { name: /Create a lantern PIN/ })).toBeVisible();
  await page.getByLabel('Choose a 4-digit PIN').fill('1234');
  await page.getByLabel('Enter it again').fill('1234');
  await page.getByRole('button', { name: /Save PIN and continue/ }).click();
  await expect(page.getByRole('heading', { name: /Her trail, at a glance/ })).toBeVisible();

  const currentRoadmapStep = page.locator('.roadmap-step.current');
  await expect(currentRoadmapStep.locator('h3')).toHaveText(childLabel);
  await expect(currentRoadmapStep.locator('.roadmap-outcome')).toContainText(childOutcome);
});

test('requires the grown-up PIN after the first setup', async ({ page }) => {
  await openHub(page);
  await page.goto('/grown-up');

  await page.getByLabel('Choose a 4-digit PIN').fill('2468');
  await page.getByLabel('Enter it again').fill('2468');
  await page.getByRole('button', { name: /Save PIN and continue/ }).click();
  await expect(page.getByRole('heading', { name: /Her trail, at a glance/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Enter the lantern PIN/ })).toBeVisible();
  await page.getByLabel('Grown-up PIN').fill('0000');
  await page.getByRole('button', { name: /Open grown-up view/ }).click();
  await expect(page.getByRole('alert')).toHaveText('That PIN did not open the grown-up view.');
  await page.getByLabel('Grown-up PIN').fill('2468');
  await page.getByRole('button', { name: /Open grown-up view/ }).click();
  await expect(page.getByRole('heading', { name: /Her trail, at a glance/ })).toBeVisible();
});