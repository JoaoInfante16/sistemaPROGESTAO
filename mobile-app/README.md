# 📱 Netrios News - Mobile App (Flutter)

Aplicativo mobile de monitoramento de notícias de crime para usuários finais.

---

## Plataformas Suportadas

| Plataforma | Status |
|------------|--------|
| Android    | Suportado (MVP) |
| iOS        | Nao suportado no MVP. Firebase e push notifications nao estao configurados para iOS. Planejado para versao futura. |

---

## 🚀 Quick Start

### 1. Instalar Flutter

```bash
# Verifique se Flutter está instalado
flutter --version

# Se não estiver, instale: https://flutter.dev/docs/get-started/install
```

### 2. Configurar Ambiente

Crie o arquivo `lib/core/config/env.dart`:

```dart
class Env {
  // Backend API
  static const apiUrl = 'http://localhost:3000'; // ou IP local

  // Supabase (copie do backend/.env)
  static const supabaseUrl = 'https://xxx.supabase.co';
  static const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
}
```

**⚠️ IMPORTANTE:**
- **Emulador Android/iOS**: Use `http://localhost:3000`
- **Celular físico**: Use IP local da máquina (ex: `http://192.168.1.10:3000`)

**Para descobrir seu IP local:**
```bash
# Windows
ipconfig | findstr "IPv4"

# Linux/Mac
ifconfig | grep "inet " | grep -v "127.0.0.1"
```

### 3. Instalar Dependências

```bash
flutter pub get
```

### 4. Rodar App

**No emulador:**
```bash
flutter run
```

**No celular (USB conectado):**
```bash
# Habilite "Depuração USB" no celular
flutter devices  # Verifique se celular aparece
flutter run
```

---

## 🏗️ Build para Produção

### Build APK (Android)

```bash
# APK universal (~50MB)
flutter build apk --release

# Split APKs por arquitetura (~20-25MB cada)
flutter build apk --release --split-per-abi
```

**Use o script automatizado:**
```bash
cd ..
./scripts/build-flutter-apk.sh
```

**APK gerado em:**
```
build/app/outputs/flutter-apk/app-release.apk
```

---

## 🎨 Features

- 📰 Feed infinito de notícias
- ⭐ Sistema de favoritos
- 🔍 Busca com filtros avançados
- 👆 Swipe actions (favoritar/marcar como lida)
- 🔔 Push notifications (Firebase)
- 🎨 Badges coloridos por tipo de crime
- 📍 Localização detalhada (cidade + bairro + rua)
- 🔗 Links para fontes clicáveis
- 📱 Material Design 3

---

## 📂 Estrutura

```
lib/
├── main.dart
├── core/
│   ├── config/env.dart         # 🔑 Você cria!
│   ├── models/news_item.dart
│   └── services/
│       ├── api_service.dart
│       ├── auth_service.dart
│       ├── local_db_service.dart
│       └── push_service.dart
└── features/
    ├── auth/screens/login_screen.dart
    ├── feed/
    │   ├── screens/
    │   │   ├── main_screen.dart
    │   │   ├── feed_screen.dart
    │   │   └── favorites_screen.dart
    │   └── widgets/
    │       ├── news_card.dart
    │       └── news_detail_sheet.dart
    ├── search/screens/
    │   ├── search_screen.dart
    │   └── manual_search_screen.dart
    └── settings/screens/settings_screen.dart
```

---

## 🧪 Testes

```bash
# Rodar todos os testes
flutter test

# Análise estática
flutter analyze

# Formatar código
flutter format lib/
```

---

## 🐛 Troubleshooting

### App não conecta com backend

**Solução:**
1. Backend e celular na **mesma rede Wi-Fi**
2. Use **IP local** (não `localhost`)
3. Verifique firewall (libere porta 3000)
4. Android: adicione `android:usesCleartextTraffic="true"` em `AndroidManifest.xml`

### Build APK falha

```bash
flutter clean
flutter pub get
flutter build apk --release
```

---

## 📚 Docs

- [Backend README](../backend/README.md)
- [Admin Panel README](../admin-panel/README.md)
- [Scripts README](../scripts/README.md)
- [MANUAL.md](../MANUAL.md)

---

**Para rodar local:** Use `../scripts/dev-local.sh` na raiz do projeto!

**Última atualização**: 2026-02-09
