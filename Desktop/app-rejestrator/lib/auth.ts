import { supabase } from './supabase';

// Prosta funkcja hashowania (w produkcji użyj bcrypt)
export const hashPassword = (password: string): string => {
  // Dla uproszczenia używamy prostego hashowania
  // W produkcji użyj bcrypt lub podobnej biblioteki
  return btoa(password); // Base64 encoding
};

export const verifyPassword = (password: string, hash: string): boolean => {
  return btoa(password) === hash;
};

// Funkcja do sprawdzania użytkownika w Supabase
export const authenticateUser = async (username: string, password: string) => {
  try {
    console.log('Authenticating user:', username);
    console.log('Supabase client:', !!supabase);
    
    const { data, error } = await supabase
      .from('user_passwords')
      .select('user_id, password_hash')
      .eq('user_id', username)
      .single();

    console.log('Supabase query result:', { data, error });

    if (error || !data) {
      console.log('User not found or error:', error);
      return { success: false, error: 'Użytkownik nie znaleziony: ' + (error?.message || 'No data') };
    }

    console.log('Found user data:', data);
    console.log('Comparing passwords:', { provided: password, stored: data.password_hash });

    // Sprawdź hasło - najpierw spróbuj z hashowaniem, potem bez
    const isValidHashed = verifyPassword(password, data.password_hash);
    const isValidPlain = password === data.password_hash;

    console.log('Password validation:', { isValidHashed, isValidPlain });

    if (isValidHashed || isValidPlain) {
      return { success: true, userId: data.user_id };
    } else {
      return { success: false, error: 'Nieprawidłowe hasło' };
    }
  } catch (err) {
    console.error('Authentication error:', err);
    return { success: false, error: 'Błąd serwera: ' + (err as Error).message };
  }
};

// Funkcja do dodawania użytkownika (dla testów)
export const addUser = async (userId: string, password: string) => {
  try {
    const { data, error } = await supabase
      .from('user_passwords')
      .insert([
        { user_id: userId, password_hash: password }
      ]);

    if (error) {
      console.error('Error adding user:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Add user error:', err);
    return { success: false, error: 'Błąd serwera' };
  }
};