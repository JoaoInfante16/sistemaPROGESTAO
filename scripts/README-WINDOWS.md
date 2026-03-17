# Netrios News - Comandos Windows

## Dev Local (Backend + Admin Panel)

```cmd
cd "C:\Projetos\Netrios News\scripts"
dev-local.bat
```

Abre 2 janelas:
- Backend em http://localhost:3000
- Admin Panel em http://localhost:3001

---

## Build APK Flutter

Copie e cole no CMD:

```cmd
cd "C:\Projetos\Netrios News\mobile-app" && flutter pub get && flutter build apk --release
```

APK gerado em:

```
mobile-app\build\app\outputs\flutter-apk\app-release.apk
```

Para instalar no celular via USB:

```cmd
cd "C:\Projetos\Netrios News\mobile-app" && flutter install
```

---

## Testes

```cmd
cd "C:\Projetos\Netrios News\scripts"
test-all.bat
```
