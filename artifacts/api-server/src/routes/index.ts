import { Router, type IRouter } from "express";
import healthRouter from "./health";
import phonicsRouter from "./phonics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(phonicsRouter);

export default router;
