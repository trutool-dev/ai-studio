@echo off
echo Ejecutando migracion de Prisma en Railway PRODUCCION...
echo.
echo ATENCION: Esto aplica migraciones en la base de datos de PRODUCCION.
echo Pulsa Ctrl+C para cancelar o cualquier tecla para continuar.
pause
echo.
cd /d "C:\Users\Antonio\Documents\ai-studio\projects\healthy\backend"
set DATABASE_URL=postgresql://postgres:uafKvfChkeiZYylgsppDWifuNAYjsdPx@thomas.proxy.rlwy.net:25732/railway
npx prisma migrate deploy
echo.
echo Listo! Pulsa cualquier tecla para cerrar.
pause
