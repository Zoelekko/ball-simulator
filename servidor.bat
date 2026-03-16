@echo off
title Ball Simulator - Servidor Local
echo.
echo  Iniciando servidor local para Ball Simulator...
echo  Abre en tu navegador: http://localhost:8080
echo  Presiona Ctrl+C para cerrar.
echo.

cd /d "%~dp0"
python -m http.server 8080 --bind 127.0.0.1
pause
