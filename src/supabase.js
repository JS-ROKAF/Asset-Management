import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cimhudgptrmxcgmjgbxl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbWh1ZGdwdHJteGNnbWpnYnhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDQ4NDMsImV4cCI6MjA5MDQyMDg0M30.LCD5KTdzLdSxLBduDvYnKDOHhRe0beuOwyl-X86ps-g";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);