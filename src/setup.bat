@echo off

echo Installing backend
cd backend
call npm install

if not exist .env (
    copy .env.example .env
)

cd ..

echo Installing frontend
cd frontend\alexide-frontend
call npm install

if not exist .env (
    copy .env.example .env
)

cd ..\..

echo Setup complete!
echo.
echo To start the application:
echo   docker-compose up --build
echo.
echo Then open http://localhost:3001

