// backend/supabase-client.js
const { createClient } = require('@supabase/supabase-js');

// REMPLACEZ PAR VOS IDENTIFIANTS SUPABASE
const supabaseUrl = 'https://gebmcaeyglqnnqghhfhv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYm1jYWV5Z2xxbm5xZ2hoZmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzQzMTgsImV4cCI6MjA4OTg1MDMxOH0.4e1QImVGFa6SmE5jtoOMtkRZiH54GU-3ovOEYqXhD70ANON-PUBLIC';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;