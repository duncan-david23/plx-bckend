import express from "express";
import {  getVendorProfile, updateVendorProfile, addVendorProduct, getVendorProducts, uploadMiddleware, deleteVendorProduct, getAllVendorProducts } from "../controllers/VendorController.js";

const router = express.Router();

router.put("/add-vendor-profile", updateVendorProfile);
router.get('/vendor-profile', getVendorProfile);

// vendor products route
router.get('/vendor-products', getVendorProducts);
router.post('/add-vendor-product', uploadMiddleware, addVendorProduct);
// router.put('/update-vendor-product/:productId', updateVendorProduct);
router.delete('/delete-vendor-product/:product_id', deleteVendorProduct);

router.get('/all-vendor-products', getAllVendorProducts);

export default router;