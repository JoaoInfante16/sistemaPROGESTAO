import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService extends ChangeNotifier {
  final SupabaseClient _client = Supabase.instance.client;
  final LocalAuthentication _localAuth = LocalAuthentication();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  static const _keyEmail = 'simeops_email';
  static const _keyPassword = 'simeops_password';
  static const _keyUseBiometric = 'simeops_use_device_auth';

  User? get currentUser => _client.auth.currentUser;
  Session? get session => _client.auth.currentSession;
  bool get isAuthenticated => session != null;
  String get accessToken => session?.accessToken ?? '';

  AuthService() {
    _client.auth.onAuthStateChange.listen((data) {
      notifyListeners();
    });
  }

  Future<void> signIn(String email, String password) async {
    await _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut({bool clearCredentials = true}) async {
    // clearCredentials=true em logout manual (usuário quis sair).
    // clearCredentials=false em expiração de token (401) — assim _tryAutoLogin
    // re-autentica automaticamente sem o usuário precisar redigitar a senha.
    if (clearCredentials) await clearSavedCredentials();
    await _client.auth.signOut();
  }

  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  // ── Autenticação local (padrão/PIN/digital/face do device) ──

  /// Checa se o device tem algum método de autenticação configurado
  Future<bool> isDeviceAuthAvailable() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isSupported = await _localAuth.isDeviceSupported();
      return canCheck || isSupported;
    } catch (_) {
      return false;
    }
  }

  /// Pede pro user confirmar identidade usando o sistema do device
  Future<bool> authenticateWithDevice() async {
    try {
      final result = await _localAuth.authenticate(
        localizedReason: 'Confirme sua identidade para continuar',
        biometricOnly: false,
      );
      debugPrint('[Auth] authenticateWithDevice result: $result');
      return result;
    } catch (e) {
      debugPrint('[Auth] authenticateWithDevice error: $e');
      return false;
    }
  }

  /// Salva credenciais no secure storage para login via device auth
  Future<void> saveCredentials(String email, String password) async {
    await _secureStorage.write(key: _keyEmail, value: email);
    await _secureStorage.write(key: _keyPassword, value: password);
    await _secureStorage.write(key: _keyUseBiometric, value: 'true');
  }

  /// Checa se o user já configurou login via device auth
  Future<bool> hasDeviceAuthEnabled() async {
    final flag = await _secureStorage.read(key: _keyUseBiometric);
    return flag == 'true';
  }

  /// Retorna credenciais salvas sem fazer login (para preencher o formulário)
  Future<({String email, String password})?> getSavedCredentials() async {
    final email = await _secureStorage.read(key: _keyEmail);
    final password = await _secureStorage.read(key: _keyPassword);
    if (email == null || password == null) return null;
    return (email: email, password: password);
  }

  /// Faz login usando credenciais salvas
  Future<void> signInWithDeviceAuth() async {
    final creds = await getSavedCredentials();
    if (creds == null) throw Exception('Credenciais não encontradas. Faça login com senha.');
    await signIn(creds.email, creds.password);
  }

  /// Limpa credenciais salvas (logout, troca de senha manual, etc)
  Future<void> clearSavedCredentials() async {
    await _secureStorage.delete(key: _keyEmail);
    await _secureStorage.delete(key: _keyPassword);
    await _secureStorage.delete(key: _keyUseBiometric);
  }
}
