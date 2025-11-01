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

async function testInsert() {
  try {
    console.log('Testing insert of active downtime...');
    
    const { data, error } = await supabase
      .from('downtimes')
      .insert({
        machine_id: 'm1',
        operator_id: 'TEST',
        start_time: new Date().toISOString(),
        duration: 0,
        comment: 'Test insert',
        date: new Date().toISOString().split('T')[0],
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Insert error:', error);
      return;
    }
    
    console.log('✅ Insert successful:', data);
    
    // Now check if it appears in active downtimes
    const { data: activeData, error: activeError } = await supabase
      .from('downtimes')
      .select('*')
      .eq('is_active', true);
    
    if (activeError) {
      console.error('Query error:', activeError);
      return;
    }
    
    console.log('✅ Active downtimes after insert:', activeData.length);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testInsert();