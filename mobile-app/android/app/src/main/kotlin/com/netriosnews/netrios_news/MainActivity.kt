package com.netriosnews.netrios_news

import io.flutter.embedding.android.FlutterFragmentActivity

/**
 * 🚨 `FlutterFragmentActivity`, e NAO `FlutterActivity`.
 *
 * O `local_auth` usa `androidx.biometric.BiometricPrompt`, que so sabe se
 * hospedar numa `FragmentActivity`. Com a `FlutterActivity` comum o plugin nem
 * chega a tentar: `LocalAuthPlugin.java:112` testa
 * `activity instanceof FragmentActivity` e devolve `NOT_FRAGMENT_ACTIVITY`
 * antes de qualquer dialogo aparecer.
 *
 * Isso quer dizer que o desbloqueio pelo celular **nunca funcionou** neste app
 * — nem no primeiro acesso, nem no login. O erro voltava como `false`, que o
 * app le como "a pessoa cancelou", entao a tela dizia *"Desbloqueio cancelado.
 * Nada foi alterado."* e ninguem tinha motivo pra desconfiar do Android.
 *
 * Achado em 16/08 lendo o fonte do plugin, depois de o Joao dizer que o botao
 * "nao existe".
 */
class MainActivity : FlutterFragmentActivity()
