import { supabaseAsosCustomer, supabaseAsosCustomerServiceRole } from '../utils/supabaseClients.js';
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";






export const getVendorProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user
    const {
      data: { user },
      error: authError,
    } = await supabaseAsosCustomer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // USE SERVICE ROLE TO BYPASS RLS
    const { data, error } = await supabaseAsosCustomerServiceRole
      .from("vendor_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching vendor profile:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Vendor profile fetched successfully",
      profile: data,
    });
  } catch (err) {
    console.error("Vendor profile fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

export const updateVendorProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user
    const {
      data: { user },
      error: authError,
    } = await supabaseAsosCustomer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { store_name, store_description, store_phone } = req.body;

    if (!store_name) {
      return res.status(400).json({ error: "Store name is required" });
    }

    console.log("Updating vendor profile for user:", user.id);
    console.log("Data:", { store_name, store_description, store_phone });

    // USE SERVICE ROLE TO BYPASS RLS
    // First, try to update
    let { data, error } = await supabaseAsosCustomerServiceRole
      .from("vendor_profile")
      .update({
        store_name,
        store_description: store_description || '',
        store_phone: store_phone || '',
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    // If no rows updated (profile doesn't exist), insert
    if (error && error.code === 'PGRST116') {
      console.log("No existing profile, creating new one...");
      const { data: insertData, error: insertError } = await supabaseAsosCustomerServiceRole
        .from("vendor_profile")
        .insert({
          user_id: user.id,
          store_name,
          store_description: store_description || '',
          store_phone: store_phone || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return res.status(400).json({ error: insertError.message });
      }
      data = insertData;
    } else if (error) {
      console.error("Update error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Vendor profile saved successfully",
      vendor: data,
    });
  } catch (err) {
    console.error("Vendor profile update error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};



// vendor products



export const getVendorProducts = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user
    const {
      data: { user },
      error: authError,
    } = await supabaseAsosCustomer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // USE SERVICE ROLE TO BYPASS RLS
    const { data, error } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching vendor products:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Vendor products fetched successfully",
      products: data,
    });
  } catch (err) {
    console.error("Vendor products fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};






cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Multer (in-memory)
const upload = multer({ storage: multer.memoryStorage() });
export const uploadMiddleware = upload.array("product_images", 3); // up to 3

// add vendor product

export const addVendorProduct = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user
    const {
      data: { user },
      error: authError,
    } = await supabaseAsosCustomer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get vendor profile to get vendor_id
    const { data: vendorProfile, error: vendorError } = await supabaseAsosCustomerServiceRole
      .from("vendor_profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (vendorError || !vendorProfile) {
      return res.status(400).json({ error: "Vendor profile not found. Please set up your store first." });
    }

    const { 
      product_name, 
      product_description, 
      product_price, 
      category, 
      sizes 
    } = req.body;

    if (!product_name || !product_price) {
      return res.status(400).json({ error: "Product name and price are required" });
    }

    // Upload images to Cloudinary
    const uploadedUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { 
                folder: "vendor_products",
                resource_type: "image",
                transformation: [
                  { width: 800, height: 800, crop: "limit" },
                  { quality: "auto" }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });
          uploadedUrls.push(result.secure_url);
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          return res.status(400).json({ error: "Failed to upload images. Please try again." });
        }
      }
    }

    // Parse sizes if provided
    let sizesArray = ['One Size'];
    if (sizes && sizes.trim()) {
      sizesArray = sizes.split(',').map(s => s.trim()).filter(s => s);
    }

    // Insert product into vendor_products
    const { data, error } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .insert({
        user_id: user.id,
        vendor_id: vendorProfile.id,
        item_name: product_name,
        item_description: product_description || '',
        item_price: parseFloat(product_price),
        item_images: uploadedUrls,
        category: category || 'General',
        item_sizes: sizesArray,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: "Vendor product added successfully",
      product: data,
    });
  } catch (err) {
    console.error("Vendor product add error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




// Delete vendor product
export const deleteVendorProduct = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user
    const {
      data: { user },
      error: authError,
    } = await supabaseAsosCustomer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { product_id } = req.params;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Check if product belongs to user
    const { data: existingProduct, error: checkError } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .select("id, item_images")
      .eq("id", product_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError || !existingProduct) {
      return res.status(404).json({ error: "Product not found or unauthorized" });
    }

    // Delete images from Cloudinary (optional)
    if (existingProduct.item_images && existingProduct.item_images.length > 0) {
      for (const imageUrl of existingProduct.item_images) {
        try {
          // Extract public_id from URL
          const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (cloudinaryError) {
          console.error("Cloudinary delete error:", cloudinaryError);
          // Continue even if cloudinary delete fails
        }
      }
    }

    // Delete product
    const { error } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .delete()
      .eq("id", product_id);

    if (error) {
      console.error("Supabase delete error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Vendor product deleted successfully",
    });
  } catch (err) {
    console.error("Vendor product delete error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


// Fetch all products 

// Get all products from all vendors with vendor profile data
export const getAllVendorProducts = async (req, res) => {
  try {
    // Fetch all products with vendor profile data using a join
    const { data, error } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .select(`
        *,
        vendor_profile:vendor_id (
          id,
          store_name,
          store_phone,
          store_description,
          user_id
        )
      `)
      .eq("status", "active") // Only get active products
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching all vendor products:", error);
      return res.status(400).json({ error: error.message });
    }

    // Transform data for frontend
    const formattedProducts = data.map(product => ({
      id: product.id,
      name: product.item_name,
      price: parseFloat(product.item_price),
      description: product.item_description || '',
      images: product.item_images || [],
      category: product.category || 'General',
      sizes: product.item_sizes || ['One Size'],
      status: product.status || 'active',
      featured: product.featured || false,
      vendor: {
        id: product.vendor_profile?.id,
        name: product.vendor_profile?.store_name || 'Unknown Vendor',
        phone: product.vendor_profile?.store_phone || '',
        description: product.vendor_profile?.store_description || '',
      },
      created_at: product.created_at,
      updated_at: product.updated_at,
    }));

    return res.status(200).json({
      message: "All vendor products fetched successfully",
      products: formattedProducts,
      count: formattedProducts.length,
    });
  } catch (err) {
    console.error("Get all vendor products error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};



// update the featured status of a product
export const updateProductFeaturedStatus = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user
    const {
      data: { user },
      error: authError,
    } = await supabaseAsosCustomer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { product_id } = req.params;
    const { featured } = req.body;

    if (typeof featured !== 'boolean') {
      return res.status(400).json({ error: "Featured status must be a boolean" });
    }

    // Check if product belongs to user
    const { data: existingProduct, error: checkError } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .select("id, featured, featured_expires_at")
      .eq("id", product_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError || !existingProduct) {
      return res.status(404).json({ error: "Product not found or unauthorized" });
    }

    // Prepare update data
    const updateData = {
      featured,
      updated_at: new Date().toISOString()
    };

    // If setting to featured (true), set expiration to 7 days from now
    if (featured === true) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      updateData.featured_expires_at = expiresAt.toISOString();
    } else {
      // If removing from featured, clear the expiration
      updateData.featured_expires_at = null;
    }

    // Update featured status for this specific product
    const { data, error } = await supabaseAsosCustomerServiceRole
      .from("vendor_products")
      .update(updateData)
      .eq("id", product_id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: featured ? "Product featured for 7 days" : "Product removed from featured",
      product: data,
    });
  } catch (err) {
    console.error("Update product featured status error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

