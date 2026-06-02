// supabase-client.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gebmcaeyglqnnqghhfhv.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYm1jYWV5Z2xxbm5xZ2hoZmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzQzMTgsImV4cCI6MjA4OTg1MDMxOH0.4e1QImVGFa6SmE5jtoOMtkRZiH54GU-3ovOEYqXhD70';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;