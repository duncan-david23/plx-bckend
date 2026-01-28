import express from "express";
import { createOrder, getOrders, getOrdersAdmin, updateOrderStatusAdmin, createCustomOrder, getCustomOrdersAdmin, updateCustomOrderStatusAdmin, getCustomOrders   } from "../controllers/OrdersController.js";

const router = express.Router();

router.post("/create-order", createOrder);
router.get('/orders', getOrders);
router.get('/admin/orders', getOrdersAdmin);
router.put('/admin/orders/status/', updateOrderStatusAdmin);

// CUSTOM ORDER ROUTE
router.post("/create-custom-order", createCustomOrder);
router.get('/admin/custom-orders', getCustomOrdersAdmin);
router.put('/admin/custom-orders/status/', updateCustomOrderStatusAdmin);
router.get('/custom-orders', getCustomOrders);


export default router;