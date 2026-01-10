import express from "express";
import { createOrder, getOrders, getOrdersAdmin, updateOrderStatusAdmin    } from "../controllers/OrdersController.js";

const router = express.Router();

router.post("/create-order", createOrder);
router.get('/orders', getOrders);
router.get('/admin/orders', getOrdersAdmin);
router.put('/admin/orders/status/', updateOrderStatusAdmin);

export default router;