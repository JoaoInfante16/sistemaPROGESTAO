@echo off
REM Gera AAB assinado para upload na Play Store.
REM Requer: android/simeops-release.jks + android/key.properties
flutter clean
flutter build appbundle --dart-define-from-file=env/prod.json
echo.
echo ================================================================
echo AAB producao em: build\app\outputs\bundle\release\app-release.aab
echo ================================================================
