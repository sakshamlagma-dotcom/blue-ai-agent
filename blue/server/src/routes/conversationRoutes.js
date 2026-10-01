import { Router } from "express";
import {
  getAllConversations,
  getOneConversation,
  patchConversation,
  removeConversation,
} from "../controllers/conversationController.js";

const router = Router();
router.get("/conversations", getAllConversations);
router.get("/conversations/:id", getOneConversation);
router.patch("/conversations/:id", patchConversation);
router.delete("/conversations/:id", removeConversation);

export default router;
