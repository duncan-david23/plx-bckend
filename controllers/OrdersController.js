import {supabaseAsosCustomer, supabaseAsos} from '../utils/supabaseClients.js'

// Simple, guaranteed unique order ID generator
const generateOrderId = () => {
  const timestamp = Date.now().toString(); // Current timestamp in milliseconds
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Random 3 digits
  // Combine timestamp + random for extra uniqueness
  return `PLX${timestamp.slice(-9)}${random}`;
  // Result example: PLX589642123456 (PLX + last 9 of timestamp + random 3)
};

export const createOrder = async (req, res) => {
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

    // Get order data from request body
    const { order_items, order_total, item_count } = req.body;

    if (!order_items || !Array.isArray(order_items) || order_items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    // Fetch customer profile information
    const { data: profileData, error: profileError } = await supabaseAsosCustomer
      .from("customer_profile")
      .select("full_name, phone_number, email")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return res.status(400).json({ error: "Customer profile not found" });
    }

    // Fetch default address
    const { data: addressData, error: addressError } = await supabaseAsosCustomer
      .from("customer_addresses")
      .select("address")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single();

    let customerAddress = "";
    
    if (addressError) {
      console.warn("Default address not found, trying to get any address:", addressError);
      
      // Fallback: get the first address if no default is set
      const { data: fallbackAddress, error: fallbackError } = await supabaseAsosCustomer
        .from("customer_addresses")
        .select("address")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      if (!fallbackError && fallbackAddress) {
        customerAddress = fallbackAddress.address;
      }
    } else {
      customerAddress = addressData.address;
    }

    // Generate unique order number
    const orderNumber = generateOrderId();

    // Double-check uniqueness (extremely rare but safe)
    let finalOrderNumber = orderNumber;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const { data: existingOrder } = await supabaseAsosCustomer
        .from("orders")
        .select("order_number")
        .eq("order_number", finalOrderNumber)
        .maybeSingle();
      
      if (!existingOrder) {
        break; // Number is unique
      }
      
      // Regenerate if collision occurs
      finalOrderNumber = generateOrderId();
      attempts++;
      
      if (attempts === maxAttempts) {
        console.error("Failed to generate unique order number after", maxAttempts, "attempts");
        return res.status(500).json({ error: "Failed to generate unique order number" });
      }
    }

    // Insert the new order with customer details
    const { data, error } = await supabaseAsosCustomer
      .from("orders")
      .insert({
        user_id: user.id,
        items: order_items,
        order_total,
        status: 'pending',
        customer_name: profileData.full_name || '',
        customer_email: profileData.email || '',
        customer_phone: profileData.phone_number || '',
        customer_address: customerAddress,
        item_count,
        order_id: finalOrderNumber, // Add the unique order number
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: "Order created successfully",
      order: data, // Now includes order_number field
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};




//  fetch orders for customers
export const getOrders = async (req, res) => {
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

    // Get query parameters for filtering
    const { 
      order_id, 
      status, 
      start_date, 
      end_date, 
      limit = 10, 
      page = 1 
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the query
    let query = supabaseAsosCustomer
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (order_id) {
      query = query.eq('order_id', order_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    // Execute query
    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Get total count for pagination info (without limit)
    const { count: totalCount } = await supabaseAsosCustomer
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: orders || [],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_count: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};









export const getOrderById = async (req, res) => {
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

    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Get the order
    const { data: order, error } = await supabaseAsosCustomer
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Order retrieved successfully",
      order
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};








// Optional: Get orders by status
export const getOrdersByStatus = async (req, res) => {
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

    const { status } = req.params;
    const { limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    // Get orders by status
    const { data: orders, error } = await supabaseAsosCustomer
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Get total count for this status
    const { count: totalCount } = await supabaseAsosCustomer
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', status);

    return res.status(200).json({
      message: `Orders with status '${status}' retrieved successfully`,
      orders: orders || [],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_count: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};







// ADMIN LOGICS

export const getOrdersAdmin = async (req, res) => {
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
    } = await supabaseAsos.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get query parameters for filtering
    const { 
      order_id, 
      status, 
      start_date, 
      end_date, 
      limit = 10, 
      page = 1 
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the query
    let query = supabaseAsosCustomer
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (order_id) {
      query = query.eq('order_id', order_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    // Execute query
    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Get total count for pagination info (without limit)
    const { count: totalCount } = await supabaseAsosCustomer
      .from('orders')
      .select('*', { count: 'exact', head: true })

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: orders || [],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_count: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// Update order status (Admin)
export const updateOrderStatusAdmin = async (req, res) => {
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
    } = await supabaseAsos.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

   const { status, orderId } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: "Order ID and new status are required" });
    }

    // Update the order status
    const { data, error } = await supabaseAsosCustomer
      .from('orders')
      .update({ status })
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Order status updated successfully",
      order: data
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};








// ORDER LOGICS FOR CUSTOM PRODUCTS FROM PLANGEX


const generateCustomOrderId = () => {
  const timestamp = Date.now().toString(); // Current timestamp in milliseconds
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Random 3 digits
  // Combine timestamp + random for extra uniqueness
  return `CSPLX${timestamp.slice(-9)}${random}`;
  // Result example: CSPLX589642123456 (CSPLX + last 9 of timestamp + random 3)
};

export const createCustomOrder = async (req, res) => {
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

    // Get order data from request body
    const { order_items, order_total, item_count } = req.body;

    if (!order_items || !Array.isArray(order_items) || order_items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    // Fetch customer profile information
    const { data: profileData, error: profileError } = await supabaseAsosCustomer
      .from("customer_profile")
      .select("full_name, phone_number, email")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return res.status(400).json({ error: "Customer profile not found" });
    }

    // Fetch default address
    const { data: addressData, error: addressError } = await supabaseAsosCustomer
      .from("customer_addresses")
      .select("address")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single();

    let customerAddress = "";
    
    if (addressError) {
      console.warn("Default address not found, trying to get any address:", addressError);
      
      // Fallback: get the first address if no default is set
      const { data: fallbackAddress, error: fallbackError } = await supabaseAsosCustomer
        .from("customer_addresses")
        .select("address")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      if (!fallbackError && fallbackAddress) {
        customerAddress = fallbackAddress.address;
      }
    } else {
      customerAddress = addressData.address;
    }

    // Generate unique order number
    const orderNumber = generateCustomOrderId();

    // Double-check uniqueness (extremely rare but safe)
    let finalOrderNumber = orderNumber;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const { data: existingOrder } = await supabaseAsosCustomer
        .from("custom_orders")
        .select("order_number")
        .eq("order_number", finalOrderNumber)
        .maybeSingle();
      
      if (!existingOrder) {
        break; // Number is unique
      }
      
      // Regenerate if collision occurs
      finalOrderNumber = generateCustomOrderId();
      attempts++;
      
      if (attempts === maxAttempts) {
        console.error("Failed to generate unique order number after", maxAttempts, "attempts");
        return res.status(500).json({ error: "Failed to generate unique order number" });
      }
    }

    // Insert the new order with customer details
    const { data, error } = await supabaseAsosCustomer
      .from("custom_orders")
      .insert({
        user_id: user.id,
        items: order_items,
        order_total,
        status: 'pending',
        customer_name: profileData.full_name || '',
        customer_email: profileData.email || '',
        customer_phone: profileData.phone_number || '',
        customer_address: customerAddress,
        item_count,
        order_id: finalOrderNumber, // Add the unique order number
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: "Order created successfully",
      order: data, // Now includes order_number field
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// fetch custom orders for admin


export const getCustomOrdersAdmin = async (req, res) => {
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
    } = await supabaseAsos.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get query parameters for filtering
    const { 
      order_id, 
      status, 
      start_date, 
      end_date, 
      limit = 10, 
      page = 1 
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the query
    let query = supabaseAsosCustomer
      .from('custom_orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (order_id) {
      query = query.eq('order_id', order_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    // Execute query
    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Get total count for pagination info (without limit)
    const { count: totalCount } = await supabaseAsosCustomer
      .from('custom_orders')
      .select('*', { count: 'exact', head: true })

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: orders || [],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_count: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const updateCustomOrderStatusAdmin = async (req, res) => {
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
    } = await supabaseAsos.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

   const { status, orderId } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: "Order ID and new status are required" });
    }

    // Update the order status
    const { data, error } = await supabaseAsosCustomer
      .from('custom_orders')
      .update({ status })
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Order status updated successfully",
      order: data
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};








export const getCustomOrders = async (req, res) => {
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

    // Get query parameters for filtering
    const { 
      order_id, 
      status, 
      start_date, 
      end_date, 
      limit = 10, 
      page = 1 
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the query
    let query = supabaseAsosCustomer
      .from('custom_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (order_id) {
      query = query.eq('order_id', order_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    // Execute query
    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Get total count for pagination info (without limit)
    const { count: totalCount } = await supabaseAsosCustomer
      .from('custom_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: orders || [],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_count: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};