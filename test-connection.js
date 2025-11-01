const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test machines table
    console.log('\n1. Testing machines table...');
    const { data: machines, error: machinesError } = await supabase
      .from('machines')
      .select('*')
      .limit(5);
    
    if (machinesError) {
      console.error('Machines error:', machinesError);
    } else {
      console.log('Machines found:', machines?.length || 0);
      if (machines && machines.length > 0) {
        console.log('First machine:', machines[0]);
      }
    }

    // Test user_passwords table
    console.log('\n2. Testing user_passwords table...');
    const { data: users, error: usersError } = await supabase
      .from('user_passwords')
      .select('user_id')
      .limit(5);
    
    if (usersError) {
      console.error('Users error:', usersError);
    } else {
      console.log('Users found:', users?.length || 0);
      if (users && users.length > 0) {
        console.log('Users:', users.map(u => u.user_id));
      }
    }

    // Test downtimes table
    console.log('\n3. Testing downtimes table...');
    const { data: downtimes, error: downtimesError } = await supabase
      .from('downtimes')
      .select('*')
      .limit(5);
    
    if (downtimesError) {
      console.error('Downtimes error:', downtimesError);
    } else {
      console.log('Downtimes found:', downtimes?.length || 0);
    }

  } catch (error) {
    console.error('Connection test failed:', error);
  }
}

testConnection();