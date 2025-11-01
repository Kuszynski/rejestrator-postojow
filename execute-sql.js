const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL() {
  console.log('🔧 Fixing duration column...');
  
  try {
    // Wykonaj SQL bezpośrednio
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE downtimes ALTER COLUMN duration DROP NOT NULL;'
    });
    
    if (error) {
      console.error('❌ SQL Error:', error);
    } else {
      console.log('✅ Duration column fixed');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  // Test insert ponownie
  console.log('🧪 Testing insert again...');
  const today = new Date().toISOString().split('T')[0];
  const { data: insertData, error: insertError } = await supabase
    .from('downtimes')
    .insert({
      machine_id: 'TEST_MACHINE_2',
      operator_id: 'TEST_OPERATOR_2',
      start_time: new Date().toISOString(),
      date: today,
      is_active: true,
      comment: null,
      end_time: null,
      duration: 0
    })
    .select()
    .single();
    
  if (insertError) {
    console.error('❌ Insert error:', insertError);
  } else {
    console.log('✅ Insert successful:', insertData);
    
    // Usuń test
    await supabase
      .from('downtimes')
      .delete()
      .eq('id', insertData.id);
    console.log('🗑️ Test record deleted');
  }
  
  process.exit(0);
}

executeSQL().catch(console.error);