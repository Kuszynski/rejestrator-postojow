const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPasswords() {
  console.log('Sprawdzam hasła użytkowników...\n');
  
  try {
    const { data: users, error } = await supabase
      .from('user_passwords')
      .select('user_id, password_hash');
    
    if (error) {
      console.error('Błąd:', error);
      return;
    }

    console.log('Użytkownicy i ich hasła:');
    console.log('========================');
    users.forEach(user => {
      console.log(`${user.user_id}: "${user.password_hash}"`);
    });

    console.log('\n🔍 Sprawdzenie:');
    console.log('- Jeśli hasło to "temp" - użyj tego do logowania');
    console.log('- Jeśli hasło to coś innego - użyj tego hasła');
    console.log('- System może poprosić o utworzenie nowego hasła przy pierwszym logowaniu');

  } catch (error) {
    console.error('Błąd połączenia:', error);
  }
}

checkPasswords();