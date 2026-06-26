import express from 'express';
import cors from 'cors';
import imageUploadRoute from './routes/imageUploadRoute.js';
import profileSettingsRoute from './routes/profileSettingsRoute.js';
import AddressRoute from './routes/AddressRoute.js';
import OrdersRoute from './routes/OrdersRoute.js';
import productRoute from './routes/productRoute.js';
import VendorRoute from './routes/VendorRoute.js';
// import messageRoute from './routes/messageRoute.js';



const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', imageUploadRoute);
app.use('/api/users', profileSettingsRoute);
app.use('/api/users', AddressRoute);
app.use('/api/users', OrdersRoute);
app.use('/api/users', productRoute);
app.use('/api/users', VendorRoute);
// app.use('/api/users', messageRoute);


// Sample route
app.get('/', (req, res) => {
  res.send('Hello from the backend server!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});