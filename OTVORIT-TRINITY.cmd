@echo off
title TRINITY OMNI-CORE // COMMAND CENTER
color 0A
cls

echo ==========================================================
echo    TRINITY OMNI-CORE // MULTI-AGENT GOOGLE ADK ENGINE
echo ==========================================================
echo [1] Overujem pracovny priestor: C:\Users\saboi\
echo [2] Spustam lokalny bridgetunnel a API server...
echo.

cd /d C:\Users\saboi\
if exist "Trinity" (
    cd Trinity
    echo [✔] Vstup do zlozky Trinity uspesny.
) else (
    echo [i] Inicializujem korenovy adresar projektov...
)

echo.
echo ==========================================================
echo  TRINITY JE ONLINE. Zadaj prikaz alebo spust npm run dev.
echo ==========================================================
cmd /k