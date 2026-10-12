@echo off
cd /d "C:\Users\Antonio\Documents\ai-studio"

echo Eliminando lock si existe...
if exist .git\index.lock del .git\index.lock

echo Staging de cambios...
git add -A

set /p MSG="Mensaje del commit: "
git commit -m "%MSG%"

echo Subiendo a GitHub...
git push origin develop

echo.
echo Listo!
pause
