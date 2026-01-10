import {supabaseAsosCustomer} from '../utils/supabaseClients.js'


export const userProfile = async (req, res) => {
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

    const { full_name, phone_number, email } = req.body;

    if (!full_name && !phone_number && !email) {
      return res.status(400).json({ error: "No data provided" });
    }

    // UPSERT (UPDATE IF EXISTS, INSERT IF NOT)
    const { data, error } = await supabaseAsosCustomer
      .from("customer_profile")
      .upsert(
        {
          user_id: user.id,
          full_name,
          phone_number,
          email,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: "Profile saved successfully",
      profile: data,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};




export const getUserProfile = async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.replace("Bearer ", "").trim();
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify user
    const { data: { user }, error } = await supabaseAsosCustomer.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseAsosCustomer
      .from("customer_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // If profile exists, return it
    if (profile) {
      return res.json({
        full_name: profile.full_name || user.email?.split('@')[0] || "username",
        email: profile.email || user.email,
        phone_number: profile.phone_number,
        profile_image: profile.profile_image
      });
    }

    // If no profile exists, return basic user info
    return res.json({
      full_name: user.email?.split('@')[0] || "username",
      email: user.email,
      phone_number: null,
      profile_image: null
    });

  } catch (err) {
    console.error("Error fetching profile:", err);
    return res.status(500).json({ error: "Server error" });
  }
};