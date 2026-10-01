import { Router } from "express";
import { runAgentTurn } from "../controllers/chatController.js";

const router = Router();
router.post("/chat", runAgentTurn);
router.post("/agent/run", runAgentTurn);

export default router;
