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

  /// Sair. **`clearCredentials` separa querer sair de ser expulso.**
  ///
  /// 🚨 Veio da `main` (fix de produção) e a `staging` não tinha. Sem o
  /// parâmetro, o `AuthGate` chamava o mesmo `signOut()` quando o token
  /// **expirava** — e apagava o cofre de quem não pediu para sair. A pessoa
  /// abria o app no dia seguinte e tinha que redigitar tudo, sem nada ter
  /// acontecido de errado.
  ///
  /// - `true` — logout manual: a pessoa quis sair, o atalho vai junto.
  /// - `false` — expiração de token: a sessão morreu, o atalho continua e o
  ///   `_tryAutoLogin` reentra sozinho.
  ///
  /// ⚠️ O `try` em volta do `signOut()` do Supabase também é da `main`: sem
  /// rede, a chamada levanta **depois** de a sessão local já ter sido limpa, e
  /// a exceção subia para a tela como se o logout tivesse falhado — quando ele
  /// tinha funcionado.
  Future<void> signOut({bool clearCredentials = true}) async {
    if (clearCredentials) await clearSavedCredentials();
    try {
      await _client.auth.signOut();
    } catch (e) {
      debugPrint('[Auth] signOut remoto falhou (sessão local já limpa): $e');
    }
  }

  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  // ── Autenticação local (padrão/PIN/digital/face do device) ──

  /// Checa se o device tem algum método de autenticação configurado.
  ///
  /// ⚠️ O `catch` **fala** agora. Ele engolia o motivo em silêncio, e o efeito
  /// era um botão que simplesmente não nascia na tela: sem log, sem erro, sem
  /// nada pra investigar — em 16/08 o João relatou exatamente isso ("o botão
  /// não existe") e não havia uma linha de saída pra ler. Falha que se
  /// manifesta como ausência é a mais cara de achar; ela precisa deixar rastro.
  Future<bool> isDeviceAuthAvailable() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isSupported = await _localAuth.isDeviceSupported();
      debugPrint(
        '[Auth] deviceAuth canCheckBiometrics=$canCheck isDeviceSupported=$isSupported',
      );
      return canCheck || isSupported;
    } catch (e) {
      debugPrint('[Auth] isDeviceAuthAvailable error: $e');
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

  /// Faz login usando credenciais salvas (após confirmar com device auth)
  Future<void> signInWithDeviceAuth() async {
    final email = await _secureStorage.read(key: _keyEmail);
    final password = await _secureStorage.read(key: _keyPassword);
    if (email == null || password == null) {
      throw Exception('Credenciais não encontradas. Faça login com senha.');
    }
    await signIn(email, password);
  }

  /// Limpa credenciais salvas (logout, troca de senha manual, etc)
  Future<void> clearSavedCredentials() async {
    await _secureStorage.delete(key: _keyEmail);
    await _secureStorage.delete(key: _keyPassword);
    await _secureStorage.delete(key: _keyUseBiometric);
  }
}
