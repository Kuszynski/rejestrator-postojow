const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://whupwklynoawiebodgbv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ'
);

async function test() {
  const today = new Date().toISOString().split('T')[0];
  
  // Sprawdź aktywne postoje
  const { data: active } = await supabase
    .from('downtimes')
    .select('*')
    .eq('date', today)
    .eq('is_active', true);
    
  console.log('Aktywne postoje:', active?.length || 0);
  if (active?.length > 0) {
    console.log(active);
  }
  
  // Dodaj testowy aktywny postój
  const { data: test, error } = await supabase
    .from('downtimes')
    .insert({
      machine_id: 'TEST_PHONE',
      operator_id: 'TEST_USER',
      start_time: new Date().toISOString(),
      date: today,
      is_active: true,
      duration: 0
    })
    .select()
    .single();
    
  if (error) {
    console.error('Błąd:', error);
  } else {
    console.log('Dodano testowy postój:', test.id);
    
    // Usuń po 5 sekundach
    setTimeout(async () => {
      await supabase.from('downtimes').delete().eq('id', test.id);
      console.log('Usunięto test');
      process.exit(0);
    }, 5000);
  }
}

test();