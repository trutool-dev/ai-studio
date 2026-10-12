@echo off
echo Ejecutando migracion de Prisma en Railway staging...
cd /d "C:\Users\Antonio\Documents\ai-studio\projects\healthy\backend"
set DATABASE_URL=postgresql://postgres:QDPwtSHILsHFwOpaYaQsAKjvtsxdClhK@thomas.proxy.rlwy.net:44480/railway
npx prisma migrate deploy
echo.
echo Listo! Pulsa cualquier tecla para cerrar.
pause
