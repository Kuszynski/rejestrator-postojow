// Skrypt do dodania użytkownika testowego
// Uruchom: node scripts/add-test-user.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTestUsers() {
  console.log('Dodawanie użytkowników testowych...');
  
  const users = [
    { user_id: 'Dag', password_hash: 'test123' },
    { user_id: 'operator', password_hash: 'operator123' },
    { user_id: 'admin', password_hash: 'admin123' }
  ];

  for (const user of users) {
    try {
      // Sprawdź czy użytkownik już istnieje
      const { data: existing } = await supabase
        .from('user_passwords')
        .select('user_id')
        .eq('user_id', user.user_id)
        .single();

      if (existing) {
        console.log(`Użytkownik ${user.user_id} już istnieje, aktualizuję hasło...`);
        
        const { error: updateError } = await supabase
          .from('user_passwords')
          .update({ password_hash: user.password_hash })
          .eq('user_id', user.user_id);

        if (updateError) {
          console.error(`Błąd aktualizacji ${user.user_id}:`, updateError);
        } else {
          console.log(`✅ Zaktualizowano ${user.user_id}`);
        }
      } else {
        console.log(`Dodawanie nowego użytkownika: ${user.user_id}`);
        
        const { error: insertError } = await supabase
          .from('user_passwords')
          .insert([user]);

        if (insertError) {
          console.error(`Błąd dodawania ${user.user_id}:`, insertError);
        } else {
          console.log(`✅ Dodano ${user.user_id}`);
        }
      }
    } catch (error) {
      console.error(`Błąd dla ${user.user_id}:`, error);
    }
  }

  console.log('Zakończono!');
}

addTestUsers();