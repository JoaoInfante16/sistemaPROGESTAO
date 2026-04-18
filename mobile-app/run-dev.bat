@echo off
REM Roda o app em device fisico LAN ou emulador apontando pro backend local.
REM Ajuste env/dev.json com seu IP local antes de usar.
flutter run --dart-define-from-file=env/dev.json %*
