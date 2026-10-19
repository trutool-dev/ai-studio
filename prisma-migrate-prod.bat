@echo off
rem SEC-26 (SA-02): la cadena de conexion NUNCA se versiona; se lee del entorno.
rem Uso: set DATABASE_URL=^<url de Railway produccion^> y despues prisma-migrate-prod.bat
if "%DATABASE_URL%"=="" (
  echo ERROR: la variable de entorno DATABASE_URL no esta definida.
  echo Definela en esta consola con la URL de Railway PRODUCCION antes de ejecutar el script.
  echo No la escribas en este archivo ni en ningun otro archivo versionado.
  exit /b 1
)
echo Ejecutando migracion de Prisma en Railway PRODUCCION...
echo.
echo ATENCION: Esto aplica migraciones en la base de datos de PRODUCCION.
echo Pulsa Ctrl+C para cancelar o cualquier tecla para continuar.
pause
echo.
cd /d "%~dp0projects\healthy\backend"
npx prisma migrate deploy
echo.
echo Listo! Pulsa cualquier tecla para cerrar.
pause
