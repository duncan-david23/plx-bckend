import { createClient } from '@supabase/supabase-js';

const supabaseAsosAdmin = createClient(
  process.env.ADMIN_SUPABASE_URL,
  process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY 
);


const supabaseAsos = createClient(
  process.env.ADMIN_SUPABASE_URL,
  process.env.ADMIN_SUPABASE_ANON_KEY
);





const supabaseAsosCustomer = createClient(
  process.env.CUSTOMER_SUPABASE_URL,
  process.env.CUSTOMER_SUPABASE_ANON_KEY    
);





export { supabaseAsosAdmin, supabaseAsosCustomer, supabaseAsos };
