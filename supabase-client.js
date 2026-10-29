// supabase-client.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;
