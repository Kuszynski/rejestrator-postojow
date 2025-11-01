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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('downtimes')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Database connection error:', testError);
      return;
    }
    
    console.log('✅ Database connection successful');
    
    // Check if is_active column exists
    const { data: activeData, error: activeError } = await supabase
      .from('downtimes')
      .select('is_active')
      .limit(1);
    
    if (activeError) {
      console.error('❌ is_active column does not exist:', activeError);
      console.log('Please run the SQL script: supabase_realtime_setup.sql');
      return;
    }
    
    console.log('✅ is_active column exists');
    
    // Check for active downtimes today
    const today = new Date().toISOString().split('T')[0];
    const { data: activeDowntimes, error: activeDowntimesError } = await supabase
      .from('downtimes')
      .select('*')
      .eq('date', today)
      .eq('is_active', true);
    
    if (activeDowntimesError) {
      console.error('Error checking active downtimes:', activeDowntimesError);
      return;
    }
    
    console.log(`✅ Found ${activeDowntimes.length} active downtimes today`);
    if (activeDowntimes.length > 0) {
      console.log('Active downtimes:', activeDowntimes);
    }
    
    // Check all downtimes today
    const { data: allDowntimes, error: allDowntimesError } = await supabase
      .from('downtimes')
      .select('*')
      .eq('date', today)
      .order('start_time', { ascending: false });
    
    if (allDowntimesError) {
      console.error('Error checking all downtimes:', allDowntimesError);
      return;
    }
    
    console.log(`✅ Found ${allDowntimes.length} total downtimes today`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDatabase();