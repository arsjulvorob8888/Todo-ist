# ToDO-AKA

Офлайн-планировщик: задачи, проекты, метки, помидор и тайминг. Один интерфейс для телефона и компьютера. Данные сначала сохраняются на устройстве, а при появлении сети сходятся в аккаунт.

Тариф сейчас один: **BETA FREE**.

Имя репозитория не связано с товарным знаком Todoist. Похожи только привычные вещи: входящие, проекты и метки.

## Локально

```bash
npm install
npm run dev
```

Открой http://localhost:8080

## Render

1. Зайди на https://dashboard.render.com и войди через GitHub.
2. New → Blueprint. Укажи репозиторий `arsjulvorob8888/Todo-ist`. Render прочитает `render.yaml`.
3. После первого адреса сайта открой сервис → Environment и поставь `BETTER_AUTH_URL` = `https://твой-адрес.onrender.com` (без слэша в конце).
4. Manual Deploy ещё раз, чтобы адрес попал в сборку входа.
5. Открой сайт → Кабинет → создай аккаунт. Тот же аккаунт на телефоне и на компьютере синхронизирует задачи.
6. Вход через Google (Gmail): в [Google Cloud Console](https://console.cloud.google.com/apis/credentials) создай OAuth-клиент типа **Web application**. Authorized JavaScript origin: `https://poryadok-1xfe.onrender.com`. Authorized redirect URI: `https://poryadok-1xfe.onrender.com/api/auth/callback/google`. В Environment сервиса Render добавь `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`, сохрани и сделай **Manual Deploy**.

Бесплатный Render засыпает. Первый заход после паузы может занять около минуты. Пока сервер спит, приложение на уже открытом устройстве продолжает работать локально.

## App Store и Google Play

Сейчас это устанавливаемое веб-приложение. Для магазинов тот же интерфейс оборачивается Capacitor (конфиг уже лежит в `capacitor.config.json`):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npm run build
npx cap copy
```

Дальше архив отдаётся в App Store Connect и Google Play Console. Нужны аккаунты разработчика Apple и Google.
