abstract class Env {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://uywvrkiujzcmfmoxbwna.supabase.co',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d3Zya2l1anpjbWZtb3hid25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Mjk1MzcsImV4cCI6MjA4NjEwNTUzN30.YJWzQcYbiIRm_rw-dHnZMVFOEpUDen7pACG_teFOPIE',
  );

  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://192.168.1.3:3000', // LAN IP - celular e PC na mesma WiFi
  );
}
