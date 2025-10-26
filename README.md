
# Auto Login Controller

This project customises the ZaUI Coffee template into a single-screen controller that drives the Google Sheet based auto-login flow.

## Prerequisites

- Node.js 18+
- A Google Service Account with access to the target Google Sheet
- Zalo Mini App CLI (`zmp-cli`)

## Installation

```bash
npm install
```

## Environment

Create a `.env` file based on the template below:

```
APP_ID=<your-mini-app-id>
ZMP_TOKEN=<your-zmp-token>
VITE_SHEET_WEBAPP_URL=http://localhost:4000/sheet
GOOGLE_SERVICE_ACCOUNT_B64=<base64 service account json>
GOOGLE_SHEET_ID=<sheet-id>
GOOGLE_SHEET_NAME=Login_NhutPT
```

Encode the service account JSON with:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

## Running

Start the sheet proxy API:

```bash
npm run dev:api
```

Launch the Mini App dev server in a new terminal:

```bash
npm run start
```

## Screen Overview

- **RUN LOGIN** writes `RUN` to cell `A2`.
- Captcha image previews the value from cell `C2`.
- The captcha input pushes a three-digit value into cell `D2`.
- The log panel shows all messages from column `E`.
- Polling begins only after pressing **RUN LOGIN**, refreshes every 2 seconds, and stops automatically once `A2` is no longer `RUN`.

## Troubleshooting

- Check the API console logs (terminal running `npm run dev:api`) for Google Sheet errors.
- Confirm `VITE_SHEET_WEBAPP_URL` points to the correct API URL.
- If the captcha does not render, ensure cell `C2` contains either a valid URL or raw base64 string.
