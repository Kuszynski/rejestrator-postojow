const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local file manually
let supabaseUrl, supabaseAnonKey;
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('Error reading .env.local file:', error.message);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  try {
    const { error } = await supabase
      .from('downtimes')
      .delete()
      .eq('operator_id', 'TEST');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('✅ Test records cleaned up');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

cleanup();