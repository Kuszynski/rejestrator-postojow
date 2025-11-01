const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('Sprawdzam strukturę tabeli downtimes...\n');
  
  try {
    // Sprawdź czy kolumna photo_url istnieje
    const { data, error } = await supabase
      .from('downtimes')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Błąd:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Kolumny w tabeli downtimes:');
      console.log(Object.keys(data[0]));
      
      if ('photo_url' in data[0]) {
        console.log('✅ Kolumna photo_url istnieje');
      } else {
        console.log('❌ Kolumna photo_url NIE istnieje - uruchom add_photos_column.sql');
      }
    } else {
      console.log('Tabela jest pusta - nie można sprawdzić kolumn');
    }

  } catch (error) {
    console.error('Błąd połączenia:', error);
  }
}

checkDatabase();