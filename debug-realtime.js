const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  
  // Test połączenia
  const { data: testData, error: testError } = await supabase
    .from('downtimes')
    .select('count')
    .limit(1);
    
  if (testError) {
    console.error('❌ Connection error:', testError);
    return;
  }
  
  console.log('✅ Database connected');
  
  // Sprawdź strukturę tabeli - pomijamy to na razie
    
  // Sprawdź aktywne postoje
  const today = new Date().toISOString().split('T')[0];
  const { data: activeData, error: activeError } = await supabase
    .from('downtimes')
    .select('*')
    .eq('date', today)
    .eq('is_active', true);
    
  console.log('📊 Active downtimes today:', activeData?.length || 0);
  if (activeData && activeData.length > 0) {
    console.log('Active downtimes:', activeData);
  }
  
  // Sprawdź wszystkie postoje dzisiaj
  const { data: allData, error: allError } = await supabase
    .from('downtimes')
    .select('*')
    .eq('date', today);
    
  console.log('📈 Total downtimes today:', allData?.length || 0);
  if (allData && allData.length > 0) {
    console.log('All downtimes today:', allData);
  }
  
  // Test real-time
  console.log('🔄 Testing real-time subscription...');
  const subscription = supabase
    .channel('test-downtimes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'downtimes' },
      (payload) => {
        console.log('📡 Real-time update received:', payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });
    
  // Test insert
  console.log('🧪 Testing insert...');
  const { data: insertData, error: insertError } = await supabase
    .from('downtimes')
    .insert({
      machine_id: 'TEST_MACHINE',
      operator_id: 'TEST_OPERATOR',
      start_time: new Date().toISOString(),
      date: today,
      is_active: true,
      comment: null,
      end_time: null,
      duration: null
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
  
  setTimeout(() => {
    subscription.unsubscribe();
    console.log('👋 Test completed');
    process.exit(0);
  }, 3000);
}

testDatabase().catch(console.error);