import express from 'express';
import { addProduct, updateProduct, uploadMiddleware, getAdminProducts, getUserProducts , deleteProduct,addPlainProduct, updatePlainProduct,deletePlainProduct, getUserPlainProducts, getAdminPlainProducts  } from '../controllers/productController.js';


const router = express.Router();

router.get('/admin-products', getAdminProducts);
router.get('/users-products', getUserProducts);
router.post('/products/add-product', uploadMiddleware, addProduct);
router.put('/products/:id', uploadMiddleware, updateProduct);
router.delete('/products', deleteProduct);

// Plain product routes
router.get('/admin-plain-products', getAdminPlainProducts);
router.get('/users-plain-products', getUserPlainProducts);
router.post('/products/add-plain-product', uploadMiddleware, addPlainProduct);
router.put('/products/plain-product/:id', uploadMiddleware, updatePlainProduct);
router.delete('/products/plain-product/', deletePlainProduct);

export default router;
