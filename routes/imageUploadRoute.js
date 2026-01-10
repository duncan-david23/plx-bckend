import express from "express";
import {  uploadImageMiddleware, cloudImageUpload } from "../controllers/imageUploadController.js";

const router = express.Router();

router.post("/upload-image", uploadImageMiddleware, cloudImageUpload);


export default router;