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

async function checkActiveDowntimes() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('Checking active downtimes for today:', today);
    
    const { data, error } = await supabase
      .from('downtimes')
      .select('*')
      .eq('date', today)
      .eq('is_active', true)
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Active downtimes found:', data.length);
    if (data.length > 0) {
      data.forEach(downtime => {
        const startTime = new Date(downtime.start_time);
        const now = new Date();
        const duration = Math.floor((now - startTime) / 60000);
        
        console.log(`- ID: ${downtime.id}, Machine: ${downtime.machine_id}, Operator: ${downtime.operator_id}, Duration: ${duration} min`);
      });
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkActiveDowntimes();