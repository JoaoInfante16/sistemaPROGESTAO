@echo off
REM Build APK pra producao (Render Starter). Antes de usar, garanta que
REM env/prod.json tem SENTRY_DSN preenchida (gerar no sentry.io → project mobile).
flutter clean
flutter build apk --dart-define-from-file=env/prod.json
echo.
echo ================================================================
echo APK producao em: build\app\outputs\flutter-apk\app-release.apk
echo ================================================================
