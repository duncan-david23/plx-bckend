import {supabaseAsosCustomer} from '../utils/supabaseClients.js'
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for  image
const upload = multer({ storage: multer.memoryStorage() });
export const uploadImageMiddleware = upload.single("product_image");

export const cloudImageUpload = async (req, res)=> {
    try {
    // 1️⃣ Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2️⃣ Validate User Token
    const { data: { user }, error: userError } = await supabaseAsosCustomer.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid or expired token:", userError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const public_key = user.id
    
    // 4. Upload an image if provided
    let productImageUrl = null;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `product_images/${public_key}` },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      productImageUrl = uploadResult.secure_url;
    }
   
     
   
    // 4️⃣ Return image path
    return res.status(200).json(productImageUrl);

  } catch (err) {
    console.error("Unexpected error in getUserProfile:", err);
    return res.status(500).json({ error: "Server error" });
  }
}