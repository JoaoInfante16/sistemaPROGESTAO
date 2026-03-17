@echo off
REM ============================================
REM Netrios News - Dev Local (Backend + Admin Panel)
REM ============================================

echo ================================================================
echo   NETRIOS NEWS - Dev Local
echo ================================================================
echo.

set "ROOT=%~dp0.."

REM Verificar .env do backend
if not exist "%ROOT%\backend\.env" (
  echo [ERRO] backend\.env nao encontrado!
  echo Crie usando backend\.env.example como referencia.
  pause
  exit /b 1
)

REM Verificar .env.local do admin panel
if not exist "%ROOT%\admin-panel\.env.local" (
  echo [ERRO] admin-panel\.env.local nao encontrado!
  echo Crie usando admin-panel\.env.local.example como referencia.
  pause
  exit /b 1
)

echo [OK] Arquivos .env encontrados
echo.

REM Instalar dependencias se necessario
if not exist "%ROOT%\backend\node_modules" (
  echo Instalando dependencias do backend...
  cd /d "%ROOT%\backend"
  npm install
)

if not exist "%ROOT%\admin-panel\node_modules" (
  echo Instalando dependencias do admin panel...
  cd /d "%ROOT%\admin-panel"
  npm install
)

echo Iniciando Backend (porta 3000) + Admin Panel (porta 3001)...
echo.
echo ================================================================
echo   Backend:     http://localhost:3000
echo   Admin Panel: http://localhost:3001
echo   Health:      http://localhost:3000/health
echo ================================================================
echo.
echo Duas janelas vao abrir. Feche ambas para parar.
echo.

REM Abre backend em janela separada
start "Netrios Backend" /D "%ROOT%\backend" cmd /k npm run dev

REM Aguarda 3 segundos para backend iniciar primeiro
timeout /t 3 /nobreak >nul

REM Abre admin panel em janela separada
start "Netrios Admin" /D "%ROOT%\admin-panel" cmd /k npm run dev

echo [OK] Backend e Admin Panel iniciados!
echo.
echo Pressione qualquer tecla para fechar ESTA janela.
echo (Backend e Admin continuam rodando nas outras janelas)
echo.
pause
