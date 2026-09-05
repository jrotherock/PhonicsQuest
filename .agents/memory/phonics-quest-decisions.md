---
name: Phonics Quest decisions
description: Product decisions that shape the first phonics game experience.
---

The first version keeps instant-start and avoids accounts, while server-side PostgreSQL stores progress behind a browser-generated anonymous learner profile ID.

**Why:** The initial value is a low-friction, playful practice loop; introducing account setup before the child sees the game would undermine that goal, while server storage enables durable progress and PIN persistence.

**How to apply:** When adding new practice content or parent features, preserve instant start, keep the anonymous profile ID as the only browser identity state, and treat PostgreSQL as the source of truth.

Progress should be described as a set of evidence signals—accuracy, independent first tries, hint use, transfer into spelling/reading, and later retention—not as a single score.

**Why:** A game reward can show engagement, but it cannot by itself show whether a child can use a phonics pattern independently in unfamiliar words and remember it later.

**How to apply:** Any new skill or challenge family should contribute to the same evidence model and remain explicitly non-diagnostic in the grown-up view.

The child experience uses one shared, evidence-led curriculum route: sound awareness → short vowels → encoding → blends/digraphs → long vowels → syllables → tricky words → decodable reading.

**Why:** A visible next step reduces child choice overload while the grown-up view explains the outcome and prerequisite logic behind the recommendation.

**How to apply:** Keep the child’s primary recommendation and the grown-up roadmap derived from the same route data; free exploration and review can remain available without changing the recommended sequence.

Phonics Quest is installable as a root-path PWA with a production-only service worker and server-backed progress.

**Why:** Families need the same instant-start experience on phones and iPads, while server storage keeps progress and the grown-up PIN durable beyond one tab or device cache.

**How to apply:** Preserve the root scope/start URL, branded icon set, anonymous profile ID, and graceful loading/offline behavior when changing routing or deployment configuration.

The child’s primary map is a winding lantern trail; the quest cards are secondary side paths for review and curiosity.

**Why:** A visual trail makes the recommended phonics sequence understandable without asking a child to choose the curriculum, while preserving agency through optional exploration.

**How to apply:** Keep the glowing lantern focused on the first unfinished stage; use side paths for replay and review rather than competing recommendations.

The browser regression suite should run against the installed system Chromium rather than downloading a second browser, and its Vite server must receive both a port and the root base path.

**Why:** The Replit environment provides Chromium centrally, while the app’s Vite configuration intentionally fails fast when `PORT` or `BASE_PATH` is absent.

**How to apply:** Keep the browser test configuration’s executable-path override and server environment setup when extending the route suite or running it in this workspace.

Anonymous profile IDs are a deliberate privacy boundary, not authentication, and the grown-up PIN is only a local privacy checkpoint.

**Why:** The product avoids accounts, so anyone who obtains a profile ID can read or mutate that profile; a four-digit PIN cannot provide account-level security. The server therefore stores a salted, slow-derived PIN verifier and does not permit replacing an existing PIN through the setup endpoint.

**How to apply:** Do not describe the PIN as protecting an online account or sensitive data. If cross-device or stronger family access is added later, introduce an explicit identity/authentication design rather than extending the profile ID.

All profile initialization and attempt recording must be transactional, and attempt updates should lock the profile row while deriving counters.

**Why:** Initialization has multiple related inserts, and concurrent tabs or retries can otherwise leave partial rows or lose increments when both requests read the same previous values.

**How to apply:** Keep new progress mutations inside the same transaction as their evidence, attempt, quest, and profile-counter updates.