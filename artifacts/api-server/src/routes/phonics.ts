import { Router, type IRouter } from "express";
import {
  GetPhonicsProfileParams,
  GetPhonicsProfileResponse,
  InitializePhonicsProfileBody,
  InitializePhonicsProfileParams,
  InitializePhonicsProfileResponse,
  UpdatePhonicsProfileSettingsBody,
  UpdatePhonicsProfileSettingsParams,
  UpdatePhonicsProfileSettingsResponse,
  RecordPhonicsAttemptBody,
  RecordPhonicsAttemptParams,
  RecordPhonicsAttemptResponse,
  SetPhonicsParentPinBody,
  SetPhonicsParentPinParams,
  SetPhonicsParentPinResponse,
  VerifyPhonicsParentPinBody,
  VerifyPhonicsParentPinParams,
  VerifyPhonicsParentPinResponse,
} from "@workspace/api-zod";
import {
  initializePhonicsProfile,
  readPhonicsProfile,
  recordPhonicsAttempt,
  setPhonicsParentPin,
  updatePhonicsSettings,
  PHONICS_QUESTS,
  validateProfileId,
  verifyPhonicsParentPin,
} from "../lib/phonics";

const router: IRouter = Router();

function profileIdFrom(params: unknown): string | null {
  const parsed = GetPhonicsProfileParams.safeParse(params);
  if (!parsed.success || !validateProfileId(parsed.data.profileId)) return null;
  return parsed.data.profileId;
}

router.get("/profiles/:profileId", async (req, res): Promise<void> => {
  const profileId = profileIdFrom(req.params);
  if (!profileId) {
    res.status(400).json({ error: "profileId must be a UUID" });
    return;
  }
  const profile = await readPhonicsProfile(profileId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetPhonicsProfileResponse.parse(profile));
});

router.put("/profiles/:profileId", async (req, res): Promise<void> => {
  const params = InitializePhonicsProfileParams.safeParse(req.params);
  const body = InitializePhonicsProfileBody.safeParse(req.body);
  if (!params.success || !validateProfileId(params.data?.profileId ?? "")) {
    res.status(400).json({ error: "profileId must be a UUID" });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const profile = await initializePhonicsProfile(params.data.profileId, body.data);
  res.json(InitializePhonicsProfileResponse.parse(profile));
});

router.patch("/profiles/:profileId/settings", async (req, res): Promise<void> => {
  const params = UpdatePhonicsProfileSettingsParams.safeParse(req.params);
  const body = UpdatePhonicsProfileSettingsBody.safeParse(req.body);
  if (!params.success || !validateProfileId(params.data?.profileId ?? "")) {
    res.status(400).json({ error: "profileId must be a UUID" });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const profile = await updatePhonicsSettings(params.data.profileId, body.data.audioEnabled);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(UpdatePhonicsProfileSettingsResponse.parse(profile));
});

router.post("/profiles/:profileId/attempts", async (req, res): Promise<void> => {
  const params = RecordPhonicsAttemptParams.safeParse(req.params);
  const body = RecordPhonicsAttemptBody.safeParse(req.body);
  if (!params.success || !validateProfileId(params.data?.profileId ?? "")) {
    res.status(400).json({ error: "profileId must be a UUID" });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!PHONICS_QUESTS.includes(body.data.questId as (typeof PHONICS_QUESTS)[number])) {
    res.status(400).json({ error: "Unknown phonics quest" });
    return;
  }
  const profile = await recordPhonicsAttempt(params.data.profileId, body.data);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(RecordPhonicsAttemptResponse.parse(profile));
});

router.put("/profiles/:profileId/pin", async (req, res): Promise<void> => {
  const params = SetPhonicsParentPinParams.safeParse(req.params);
  const body = SetPhonicsParentPinBody.safeParse(req.body);
  if (!params.success || !validateProfileId(params.data?.profileId ?? "")) {
    res.status(400).json({ error: "profileId must be a UUID" });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const profile = await setPhonicsParentPin(params.data.profileId, body.data.pinHash);
  if (!profile) {
    const existing = await readPhonicsProfile(params.data.profileId);
    res.status(existing ? 409 : 404).json({
      error: existing ? "A parent PIN is already configured" : "Profile not found",
    });
    return;
  }
  res.json(SetPhonicsParentPinResponse.parse(profile));
});

router.post("/profiles/:profileId/pin/verify", async (req, res): Promise<void> => {
  const params = VerifyPhonicsParentPinParams.safeParse(req.params);
  const body = VerifyPhonicsParentPinBody.safeParse(req.body);
  if (!params.success || !validateProfileId(params.data?.profileId ?? "")) {
    res.status(400).json({ error: "profileId must be a UUID" });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const result = await verifyPhonicsParentPin(params.data.profileId, body.data.pinHash);
  if (!result) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(VerifyPhonicsParentPinResponse.parse(result));
});

export default router;