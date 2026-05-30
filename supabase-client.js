// supabase-client.js - Version sécurisée avec variables d'environnement
const { createClient } = require('@supabase/supabase-js');

// Utiliser les variables d'environnement (Vercel)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Vérifier que les variables sont définies
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERREUR: Variables d\'environnement Supabase non définies');
  console.error('Veuillez configurer SUPABASE_URL et SUPABASE_ANON_KEY dans Vercel');
  // Fallback pour développement local uniquement
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Utilisation des valeurs par défaut pour développement local');
    const supabaseUrlFallback = 'https://gebmcaeyglqnnqghhfhv.supabase.co';
    const supabaseAnonKeyFallback = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYm1jYWV5Z2xxbm5xZ2hoZmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzQzMTgsImV4cCI6MjA4OTg1MDMxOH0.4e1QImVGFa6SmE5jtoOMtkRZiH54GU-3ovOEYqXhD70';
    const supabase = createClient(supabaseUrlFallback, supabaseAnonKeyFallback);
    module.exports = supabase;
    return;
  }
  throw new Error('Configuration Supabase manquante');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;