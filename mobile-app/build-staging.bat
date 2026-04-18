@echo off
REM Build APK apontando pro backend staging (Render free).
REM Sentry NAO ativa em staging (DSN vazia em env/staging.json).
flutter clean
flutter build apk --dart-define-from-file=env/staging.json
echo.
echo ================================================================
echo APK staging em: build\app\outputs\flutter-apk\app-release.apk
echo ================================================================
