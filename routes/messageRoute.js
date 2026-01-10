import express from "express";
import {
  addMessage,
  getMessages,
  markMessageAsRead,
  deleteMessage,
} from "../controllers/messageController.js";



const router = express.Router();

// POST /api/messages
router.post("/messages/add-message", addMessage);

// GET /api/messages
router.get("/messages/get-messages", getMessages);

// PUT /api/messages/read
router.put("/messages/read-message", markMessageAsRead);

// DELETE /api/messages/:id
router.delete("/messages/delete-message/:messageId", deleteMessage);

export default router;