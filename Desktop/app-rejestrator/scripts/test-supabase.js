// Test połączenia z Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Testowanie połączenia z Supabase...');
  
  try {
    // Test 1: Sprawdź wszystkich użytkowników
    console.log('\n📋 Wszyscy użytkownicy w tabeli:');
    const { data: allUsers, error: allError } = await supabase
      .from('user_passwords')
      .select('*');
    
    if (allError) {
      console.error('❌ Błąd pobierania użytkowników:', allError);
    } else {
      console.log('✅ Znaleziono użytkowników:', allUsers);
    }

    // Test 2: Sprawdź konkretnego użytkownika
    console.log('\n🔍 Szukanie użytkownika "Dag":');
    const { data: dagUser, error: dagError } = await supabase
      .from('user_passwords')
      .select('user_id, password_hash')
      .eq('user_id', 'Dag')
      .single();
    
    if (dagError) {
      console.error('❌ Błąd szukania Dag:', dagError);
    } else {
      console.log('✅ Znaleziono Dag:', dagUser);
      
      // Test 3: Sprawdź hasło
      const testPassword = 'test123';
      const isMatch = testPassword === dagUser.password_hash;
      console.log(`🔐 Hasło "${testPassword}" pasuje:`, isMatch);
    }

    // Test 4: Sprawdź strukturę tabeli
    console.log('\n📊 Struktura tabeli:');
    const { data: structure, error: structError } = await supabase
      .from('user_passwords')
      .select('*')
      .limit(1);
    
    if (structure && structure.length > 0) {
      console.log('✅ Kolumny tabeli:', Object.keys(structure[0]));
    }

  } catch (error) {
    console.error('💥 Błąd połączenia:', error);
  }
}

testConnection();