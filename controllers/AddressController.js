import {supabaseAsosCustomer} from '../utils/supabaseClients.js'

export const userDeliveryAddress = async (req, res) => {
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

    // Get data directly from request body
    const { address, is_default } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: "Valid address is required" });
    }

    // If this address is being set as default, 
    // first update all other addresses to is_default = false
    if (is_default) {
      await supabaseAsosCustomer
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    // Insert the new address
    const { data, error } = await supabaseAsosCustomer
      .from("customer_addresses")
      .insert({
        user_id: user.id,
        address: address.trim(),
        is_default: is_default || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: "Address saved successfully",
      profile: data, // This includes the database ID
    });
  } catch (err) {
    console.error("Address update error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


export const getUserAddresses = async (req, res) => {
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

    // Fetch all addresses for this user
    const { data, error } = await supabaseAsosCustomer
      .from("customer_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false }) // Default addresses first
      .order("created_at", { ascending: false }); // Newest first

    if (error) {
      console.error("Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Addresses fetched successfully",
      addresses: data || []
    });
  } catch (err) {
    console.error("Error fetching addresses:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


// DELETINE AN ADDRESS


export const deleteUserAddress = async (req, res) => {
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

    const { id } = req.params; // Address ID from URL

    if (!id) {
      return res.status(400).json({ error: "Address ID is required" });
    }

    // First, check if the address exists and belongs to the user
    const { data: existingAddress, error: fetchError } = await supabaseAsosCustomer
      .from("customer_addresses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "Address not found" });
    }

    // Delete the address
    const { error: deleteError } = await supabaseAsosCustomer
      .from("customer_addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // Security: ensure user owns this address

    if (deleteError) {
      console.error("Database delete error:", deleteError);
      return res.status(400).json({ error: deleteError.message });
    }

    // If the deleted address was default and there are other addresses,
    // set the most recent one as default
    if (existingAddress.is_default) {
      // Find the most recent address (excluding the deleted one)
      const { data: remainingAddresses } = await supabaseAsosCustomer
        .from("customer_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (remainingAddresses && remainingAddresses.length > 0) {
        // Set the most recent address as default
        await supabaseAsosCustomer
          .from("customer_addresses")
          .update({ is_default: true })
          .eq("id", remainingAddresses[0].id)
          .eq("user_id", user.id);
      }
    }

    return res.status(200).json({
      message: "Address deleted successfully",
      deletedAddress: existingAddress
    });
  } catch (err) {
    console.error("Error deleting address:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




// UPDATE TO SET ADDRESS TO DEFAULT

export const updateUserAddress = async (req, res) => {
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

    const { id } = req.params; // Address ID from URL
    const { is_default, address } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Address ID is required" });
    }

    // Check if the address exists and belongs to the user
    const { data: existingAddress, error: fetchError } = await supabaseAsosCustomer
      .from("customer_addresses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "Address not found" });
    }

    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    // Update address text if provided
    if (address !== undefined) {
      if (typeof address !== 'string' || !address.trim()) {
        return res.status(400).json({ error: "Valid address text is required" });
      }
      updateData.address = address.trim();
    }

    // Handle setting as default
    if (is_default === true) {
      // First, set all other addresses to is_default = false
      await supabaseAsosCustomer
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", id); // Don't update the current address yet
      
      updateData.is_default = true;
    } else if (is_default === false) {
      updateData.is_default = false;
    }

    // Update the address
    const { data: updatedAddress, error: updateError } = await supabaseAsosCustomer
      .from("customer_addresses")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id) // Security: ensure user owns this address
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({
      message: "Address updated successfully",
      address: updatedAddress
    });
  } catch (err) {
    console.error("Error updating address:", err);
    return res.status(500).json({ error: "Server error" });
  }
};