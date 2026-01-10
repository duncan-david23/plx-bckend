import express from "express";
import {  userProfile, getUserProfile } from "../controllers/ProfileSettingsController.js";

const router = express.Router();

router.put("/account-profile", userProfile);
router.get('/account-profile', getUserProfile);


export default router;