const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://whupwklynoawiebodgbv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodXB3a2x5bm9hd2llYm9kZ2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg3ODUsImV4cCI6MjA3NzA2NDc4NX0.12kONNgGpcoPfQvM_n6b3USbOKjRTb7RHezEZ0RcPWQ'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🔍 Testowanie połączenia z Supabase...')
  
  try {
    // Test połączenia
    const { data: testData, error: testError } = await supabase
      .from('downtimes')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('❌ Błąd połączenia:', testError.message)
      return
    }
    
    console.log('✅ Połączenie z Supabase działa')
    
    // Sprawdź strukturę tabeli downtimes
    const { data: downtimes, error: downtimesError } = await supabase
      .from('downtimes')
      .select('*')
      .limit(5)
    
    if (downtimesError) {
      console.error('❌ Błąd pobierania downtimes:', downtimesError.message)
    } else {
      console.log('📊 Dane z tabeli downtimes:', downtimes)
      console.log('📊 Liczba rekordów:', downtimes.length)
    }
    
    // Sprawdź strukturę tabeli machines
    const { data: machines, error: machinesError } = await supabase
      .from('machines')
      .select('*')
      .limit(5)
    
    if (machinesError) {
      console.error('❌ Błąd pobierania machines:', machinesError.message)
    } else {
      console.log('🔧 Dane z tabeli machines:', machines)
      console.log('🔧 Liczba maszyn:', machines.length)
    }
    
  } catch (error) {
    console.error('❌ Błąd ogólny:', error.message)
  }
}

testConnection()