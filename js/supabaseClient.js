import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The anon key is safe to ship client-side: it only grants what Postgres
// Row Level Security policies allow, and every table here is scoped to
// auth.uid(). See README.md for the RLS setup.
const SUPABASE_URL = "https://kmnonsjbawulpsditiwy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imttbm9uc2piYXd1bHBzZGl0aXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjI1NzcsImV4cCI6MjEwNTU5ODU3N30.Y33XVddlb9cyQPF44NtNuBkf9vfZiQMcrPpwgs95W3c";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
