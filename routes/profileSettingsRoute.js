import express from "express";
import {  userProfile, getUserProfile, deleteUserAccount } from "../controllers/ProfileSettingsController.js";

const router = express.Router();

router.put("/account-profile", userProfile);
router.get('/account-profile', getUserProfile);
router.delete('/delete-account-profile', deleteUserAccount);

export default router;