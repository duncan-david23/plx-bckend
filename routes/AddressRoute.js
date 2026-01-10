import express from "express";
import { userDeliveryAddress, getUserAddresses, deleteUserAddress, updateUserAddress } from "../controllers/AddressController.js";

const router = express.Router();

router.post("/user-address", userDeliveryAddress);
router.get('/user-address', getUserAddresses);
router.patch('/user-address/:id', updateUserAddress);
router.delete('/user-address/:id', deleteUserAddress);


export default router;