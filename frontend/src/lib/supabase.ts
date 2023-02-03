import {createClient} from "@supabase/supabase-js";

const supabaseClientConfig = {
  url: import.meta.env.SUPABASE_PUBLIC_URL,
  key: import.meta.env.SUPABASE_ANON_KEY,
};

const { url, key } = supabaseClientConfig;
export const supabase = createClient(url, key);
