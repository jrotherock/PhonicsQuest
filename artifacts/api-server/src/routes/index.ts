import { Router, type IRouter } from "express";
import {
  GetFamilyAccessStatusResponse,
  UnlockFamilyAccessBody,
} from "@workspace/api-zod";
import {
  attemptFamilyAccess,
  familyAccessIsConfigured,
  hasFamilyAccess,
  requireFamilyAccess,
  setFamilyAccessCookie,
} from "../lib/family-access";
import healthRouter from "./health";
import phonicsRouter from "./phonics";

const router: IRouter = Router();

router.use(healthRouter);
router.get("/family-access/status", (req, res) => {
  res.json(GetFamilyAccessStatusResponse.parse({
    unlocked: familyAccessIsConfigured() && hasFamilyAccess(req),
  }));
});
router.post("/family-access/unlock", (req, res) => {
  const body = UnlockFamilyAccessBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter the family access phrase." });
    return;
  }
  const result = attemptFamilyAccess(req, body.data.code);
  if (!result.ok) {
    const message = result.status === 429
      ? "Too many attempts. Please wait a little before trying again."
      : result.status === 503
        ? "Family access is not configured."
        : "That phrase did not open the family lantern.";
    res.status(result.status).json({ error: message });
    return;
  }
  setFamilyAccessCookie(res);
  res.json(GetFamilyAccessStatusResponse.parse({ unlocked: true }));
});
router.use(requireFamilyAccess);
router.use(phonicsRouter);

export default router;
