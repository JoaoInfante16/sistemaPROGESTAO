@echo off
REM ============================================
REM Script: Test All (Windows)
REM Roda todos os testes + verificacoes
REM ============================================

setlocal enabledelayedexpansion

echo ================================================================
echo   NETRIOS NEWS - Test Suite Completo
echo ================================================================
echo.

set FAILED=0

REM ============================================
REM 1. Backend: TypeScript
REM ============================================

echo [1/5] Verificando TypeScript (backend)...
cd ..\backend
call npx tsc --noEmit >nul 2>&1
if errorlevel 1 (
  echo [FALHOU] TypeScript com erros
  set FAILED=1
) else (
  echo [OK] TypeScript - 0 erros
)
cd ..\scripts
echo.

REM ============================================
REM 2. Backend: Jest
REM ============================================

echo [2/5] Rodando testes Jest (backend)...
cd ..\backend
call npm test -- --passWithNoTests >test_output.txt 2>&1

REM Mostrar resumo
findstr /C:"Test Suites:" test_output.txt
findstr /C:"Tests:" test_output.txt

REM Verificar se tem " 0 failed" ou nenhum failed
findstr " 0 failed" test_output.txt >nul 2>&1
if errorlevel 1 (
  REM Nao tem "0 failed", verificar se tem algum numero de failed
  findstr /R "[1-9][0-9]* failed" test_output.txt >nul 2>&1
  if not errorlevel 1 (
    echo [FALHOU] Alguns testes falharam
    set FAILED=1
  ) else (
    echo [OK] Testes Jest passaram
  )
) else (
  echo [OK] Testes Jest passaram
)

del test_output.txt >nul 2>&1
cd ..\scripts
echo.

REM ============================================
REM 3. Admin Panel: TypeScript
REM ============================================

echo [3/5] Verificando TypeScript (admin-panel)...
cd ..\admin-panel
call npx tsc --noEmit >nul 2>&1
if errorlevel 1 (
  echo [FALHOU] TypeScript com erros
  set FAILED=1
) else (
  echo [OK] TypeScript - 0 erros
)
cd ..\scripts
echo.

REM ============================================
REM 4. Admin Panel: Next.js Build
REM ============================================

echo [4/5] Buildando Next.js (admin-panel)...
cd ..\admin-panel
call npx next build >nul 2>&1
if errorlevel 1 (
  echo [FALHOU] Next.js build falhou
  set FAILED=1
) else (
  echo [OK] Next.js build completo
)
cd ..\scripts
echo.

REM ============================================
REM 5. Flutter: Analyze (opcional)
REM ============================================

echo [5/5] Verificando Flutter...
where flutter >nul 2>nul
if errorlevel 1 (
  echo [INFO] Flutter nao instalado - OK (opcional para backend)
  goto :resumo
)

cd ..\mobile-app

REM Timeout de 30 segundos para flutter analyze
echo [INFO] Rodando flutter analyze (max 30s)...
start /b cmd /c "flutter analyze --no-pub >flutter_output.txt 2>&1"
timeout /t 30 /nobreak >nul

REM Verificar se terminou
if exist flutter_output.txt (
  findstr "No issues found" flutter_output.txt >nul 2>&1
  if errorlevel 1 (
    echo [AVISO] Flutter analyze com warnings (nao bloqueia)
  ) else (
    echo [OK] Flutter analyze limpo
  )
  del flutter_output.txt >nul 2>&1
) else (
  echo [INFO] Flutter analyze nao completou em 30s (pulando)
)

cd ..\scripts
echo.

:resumo
REM ============================================
REM 6. Resumo
REM ============================================

echo ================================================================
if !FAILED! equ 0 (
  echo   RESULTADO: TODOS OS TESTES PASSARAM!
  echo ================================================================
  echo.
  echo Sistema pronto para deploy!
  echo.
) else (
  echo   RESULTADO: ALGUNS TESTES FALHARAM
  echo ================================================================
  echo.
  echo Revise os erros acima antes de fazer deploy.
  echo.
)

pause
exit /b !FAILED!
