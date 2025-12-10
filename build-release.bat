@echo off
echo ============================================
echo Tutorial Maker Release Build Script
echo ============================================
echo.

echo [Step 1/3] Building product app (app.exe)...
call npm run tauri:build:product
if %errorlevel% neq 0 (
    echo ERROR: Failed to build product app
    exit /b 1
)

echo.
echo [Step 2/3] Copying app.exe to resources folder...
copy /Y "src-tauri\target\release\app.exe" "src-tauri\resources\product-template.exe"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy app.exe
    exit /b 1
)

echo.
echo [Step 3/3] Building Tutorial Maker...
call npm run tauri:build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Tutorial Maker
    exit /b 1
)

echo.
echo ============================================
echo BUILD COMPLETE!
echo ============================================
echo.
echo Output files:
echo   - Tutorial Maker: src-tauri\target\release\Tutorial Maker.exe
echo   - Bundled template: src-tauri\resources\product-template.exe
echo.
