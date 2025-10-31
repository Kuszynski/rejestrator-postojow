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
    const { data, error } = await supabase
      .from('user_passwords')
      .select('user_id, password_hash')
      .eq('user_id', username)
      .single();

    if (error || !data) {
      return { success: false, error: 'Użytkownik nie znaleziony' };
    }

    // Sprawdź hasło - najpierw spróbuj z hashowaniem, potem bez
    const isValidHashed = verifyPassword(password, data.password_hash);
    const isValidPlain = password === data.password_hash;

    if (isValidHashed || isValidPlain) {
      return { success: true, userId: data.user_id };
    } else {
      return { success: false, error: 'Nieprawidłowe hasło' };
    }
  } catch (err) {
    console.error('Authentication error:', err);
    return { success: false, error: 'Błąd serwera' };
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