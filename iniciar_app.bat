@echo off
title E-REDES PowerScope
chcp 65001 >nul
cls
echo =========================================================================
echo               E-REDES PowerScope - Analisador de Diagramas de Carga
echo =========================================================================
echo.
echo A iniciar o servidor local e a abrir o navegador em http://localhost:3333 ...
echo.
echo Para fechar a aplicacao, basta fechar esta janela.
echo.
start http://localhost:3333
python serve.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Nota] A abrir diretamente no navegador via ficheiro HTML...
    start index.html
)
pause
