import {supabaseAsosCustomer, supabaseAsos} from '../utils/supabaseClients.js'


export const addMessage = async (req, res) => {
  try {

        // 1️⃣ Check for Authorization Header
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

    const { name, email, subject, message } = req.body;

    // 1. Validate required fields
    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    // Prepare data
    const newMessage = {
      name: name || null,
      email,
      subject: subject || null,
      message,
      read: false, // default unread
      user_id: user.id,
    };

    // 2. Insert into Supabase
    const { data, error } = await supabaseAsos
      .from("messages")
      .insert(newMessage)
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      message: "✅ Message sent successfully",
      data,
    });
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


export const getMessages = async (req, res) => {
  try {
    // 1️⃣ Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2️⃣ Validate User Token
    const {
      data: { user },
      error: userError,
    } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid or expired token:", userError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = user.id;

    // 3️⃣ Fetch messages for this user only
    const { data, error } = await supabaseAsos
      .from("messages")
      .select("*")
      .eq("user_id", userId) // filter by user_id column
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: "✅ Messages fetched successfully",
      data,
    });

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};













// PUT /api/messages/mark-as-read

export const markMessageAsRead = async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { messageId } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
     const {
      data: { user },
      error: userError,
    } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid or expired token:", userError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = user.id;


    const { data, error } = await supabaseAsos
      .from("messages")
      .update({ read: true })
      .eq("id", messageId)
      .eq("user_id", userId)
      .select();

    if (error || !data || data.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Update failed or unauthorized",
        error: error?.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message marked as read",
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};



// DELETE /api/messages/:id
// Function to delete a message 
export const deleteMessage = async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { messageId } = req.params;

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabaseAsos.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid or expired token:", userError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = user.id;

    const { data, error } = await supabaseAsos
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("user_id", userId)
      .select();

    if (error || !data || data.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Delete failed or unauthorized",
        error: error?.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
