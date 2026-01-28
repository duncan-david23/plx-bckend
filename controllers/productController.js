import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";
import {supabaseAsosCustomer, supabaseAsos} from '../utils/supabaseClients.js'
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Multer (in-memory)
const upload = multer({ storage: multer.memoryStorage() });
export const uploadMiddleware = upload.array("product_images", 6); // up to 6

const supabase = createClient(
  process.env.ADMIN_SUPABASE_URL,
  process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY
);

export const addProduct = async (req, res) => {
  try {
    // 1️⃣ Check for Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    
    // 2️⃣ Validate User Token
    const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid or expired token:", userError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 4️⃣ Extract product details
    const {
      skuid,
      product_name,
      product_description,
      product_price,
      sales_price,
      product_discount,
      product_discount_type,
      product_stock,
      status,
      product_categories,
      product_sizes,
      product_colors,
      gender,
    } = req.body;

    // 5️⃣ Upload product images (if any)
    const uploadedUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });
        uploadedUrls.push(result.secure_url);
      }
    }

    // 6️⃣ Insert product into Supabase (RLS will apply)
    const { data, error: insertError } = await supabaseAsos
      .from("products")
      .insert([
        {
          user_id: user.id, // this matches your RLS policy condition
          skuid,
          product_name,
          product_description,
          product_price: parseFloat(product_price),
          sales_price: sales_price ? parseFloat(sales_price) : null,
          product_discount: product_discount
            ? parseInt(product_discount)
            : null,
          product_discount_type,
          product_stock: product_stock ? parseInt(product_stock) : 0,
          status: status || "In Stock",
          product_categories: product_categories
            ? JSON.parse(product_categories)
            : [],
          product_sizes: product_sizes ? JSON.parse(product_sizes) : [],
          product_colors: product_colors ? JSON.parse(product_colors) : [],
          gender,
          product_images: uploadedUrls,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(400).json({ error: insertError.message });
    }

    // 7️⃣ Success response
    return res
      .status(201)
      .json({ message: "Product created successfully", product: data });
  } catch (err) {
    console.error("Unexpected error in addProduct:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




// PUT /api/ecommerce/products/:id

export const updateProduct = async (req, res) => {
  try {
    // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 3. Extract product id
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Product ID required" });
    }

    // 4. Extract product details
    const {
      skuid,
      product_name,
      product_description,
      product_price,
      sales_price,
      product_discount,
      product_discount_type,
      product_stock,
      status,
      product_categories,
      product_sizes,
      gender,

    } = req.body;

    // ✅ Parse existing_images safely
    let existingImages = [];
    if (req.body.existing_images) {
      try {
        existingImages = JSON.parse(req.body.existing_images);
      } catch (e) {
        console.error("⚠️ Invalid existing_images JSON:", req.body.existing_images);
      }
    }

  

    // 6. Upload new images (if provided)
    let uploadedImageUrls = [];

if (req.files && req.files.length > 0) {
  for (const file of req.files) {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `products/${public_key}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(file.buffer); // send buffer
    });

    uploadedImageUrls.push(uploadResult.secure_url); // ✅ use the resolved result
  }
}

    // ✅ Merge old + new images
    const finalImages = [...existingImages, ...uploadedImageUrls];

    // 7. Update product in DB
    const { data, error } = await supabaseAsos
      .from("products")
      .update({
        skuid,
        product_name,
        product_description,
        product_price: parseFloat(product_price),
        sales_price: sales_price ? parseFloat(sales_price) : null,
        product_discount: product_discount ? parseInt(product_discount) : null,
        product_discount_type,
        product_stock: parseInt(product_stock),
        status: status || "In Stock",
        gender,
        product_categories: product_categories
          ? JSON.parse(product_categories)
          : [],
        product_sizes: product_sizes ? JSON.parse(product_sizes) : [],
        product_images: finalImages, // ✅ merged array
        updated_at: new Date(),
      })
      .eq("id", id)
      .eq("user_id", user.id) // RLS compliance
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "✅ Product updated successfully", product: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};






// Get products for Admin User
export const getAdminProducts = async (req, res) => {
  try {

   // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }


    // Query only this user's products using user ID
    const { data, error } = await supabaseAsos
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ products: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


export const getUserProducts = async (req, res) => {
  try {

   // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsosCustomer.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }


    // Query only this user's products using user ID
    const { data, error } = await supabaseAsos
      .from("products")
      .select("*")
      .eq("user_id", process.env.ADMIN_ID_KEY)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ products: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




// DELETE /api/ecommerce/products/:id
export const deleteProduct = async (req, res) => {
  try {

     // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    
    const { ids } = req.body; // array of product ids

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: "No product IDs provided" });
    }

    const { error } = await supabaseAsos
      .from("products")
      .delete()
      .in("id", ids);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Products deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting products:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};















// LOGICS FOR PLAIN PRODUCTS ONLY BELOW



export const addPlainProduct = async (req, res) => {
  try {
    // 1️⃣ Check for Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    
    // 2️⃣ Validate User Token
    const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid or expired token:", userError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 4️⃣ Extract product details
    const {
      skuid,
      product_name,
      product_description,
      product_price,
      // sales_price,
      // product_discount,
      // product_discount_type,
      product_stock,
      status,
      product_categories,
      product_sizes,
      product_colors,
      gender,
    } = req.body;

    // 5️⃣ Upload product images (if any)
    const uploadedUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });
        uploadedUrls.push(result.secure_url);
      }
    }

    // 6️⃣ Insert product into Supabase (RLS will apply)
    const { data, error: insertError } = await supabaseAsos
      .from("plain_products")
      .insert([
        {
          user_id: user.id, // this matches your RLS policy condition
          skuid,
          product_name,
          product_description,
          product_price: parseFloat(product_price),
          // sales_price: sales_price ? parseFloat(sales_price) : null,
          // product_discount: product_discount
          //   ? parseInt(product_discount)
          //   : null,
          // product_discount_type,
          product_stock: product_stock ? parseInt(product_stock) : 0,
          status: status || "In Stock",
          product_categories: product_categories
            ? JSON.parse(product_categories)
            : [],
          product_sizes: product_sizes ? JSON.parse(product_sizes) : [],
          product_colors: product_colors ? JSON.parse(product_colors) : [],
          gender,
          product_images: uploadedUrls,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(400).json({ error: insertError.message });
    }

    // 7️⃣ Success response
    return res
      .status(201)
      .json({ message: "Product created successfully", product: data });
  } catch (err) {
    console.error("Unexpected error in addProduct:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




// PUT /api/ecommerce/products/:id

export const updatePlainProduct = async (req, res) => {
  try {
    // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 3. Extract product id
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Product ID required" });
    }

    // 4. Extract product details
    const {
      skuid,
      product_name,
      product_description,
      product_price,
      // sales_price,
      // product_discount,
      // product_discount_type,
      product_stock,
      status,
      product_categories,
      product_sizes,
      gender,

    } = req.body;

    // ✅ Parse existing_images safely
    let existingImages = [];
    if (req.body.existing_images) {
      try {
        existingImages = JSON.parse(req.body.existing_images);
      } catch (e) {
        console.error("⚠️ Invalid existing_images JSON:", req.body.existing_images);
      }
    }

  

    // 6. Upload new images (if provided)
    let uploadedImageUrls = [];

if (req.files && req.files.length > 0) {
  for (const file of req.files) {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `products/${user.id}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(file.buffer); // send buffer
    });

    uploadedImageUrls.push(uploadResult.secure_url); // ✅ use the resolved result
  }
}

    // ✅ Merge old + new images
    const finalImages = [...existingImages, ...uploadedImageUrls];

    // 7. Update product in DB
    const { data, error } = await supabaseAsos
      .from("plain_products")
      .update({
        skuid,
        product_name,
        product_description,
        product_price: parseFloat(product_price),
        // sales_price: sales_price ? parseFloat(sales_price) : null,
        // product_discount: product_discount ? parseInt(product_discount) : null,
        // product_discount_type,
        product_stock: parseInt(product_stock),
        status: status || "In Stock",
        gender,
        product_categories: product_categories
          ? JSON.parse(product_categories)
          : [],
        product_sizes: product_sizes ? JSON.parse(product_sizes) : [],
        product_images: finalImages, // ✅ merged array
        updated_at: new Date(),
      })
      .eq("id", id)
      .eq("user_id", user.id) // RLS compliance
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "✅ Product updated successfully", product: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};






// Get products for Admin User
export const getAdminPlainProducts = async (req, res) => {
  try {

   // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }


    // Query only this user's products using user ID
    const { data, error } = await supabaseAsos
      .from("plain_products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ products: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


export const getUserPlainProducts = async (req, res) => {
  try {

   // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsosCustomer.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }


    // Query only this user's products using user ID
    const { data, error } = await supabaseAsos
      .from("plain_products")
      .select("*")
      .eq("user_id", process.env.ADMIN_ID_KEY)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ products: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




// DELETE /api/ecommerce/products/:id
export const deletePlainProduct = async (req, res) => {
  try {

     // 1. Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    

    // 2. Validate user token
   const { data: { user }, error: userError } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    
    const { ids } = req.body; // array of product ids

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: "No product IDs provided" });
    }

    const { error } = await supabaseAsos
      .from("plain_products")
      .delete()
      .in("id", ids);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Products deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting products:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
