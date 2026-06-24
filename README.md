# BFHL Challenge App

Node.js / JavaScript implementation for the Chitkara Full Stack Engineering Challenge.

## Features

- `POST /bfhl` API with CORS enabled
- Node hierarchy processing with invalid-entry, duplicate-edge, cycle, and depth handling
- Single-page frontend served from the same app
- Environment-based identity fields for submission

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env` file from `.env.example` and replace the identity fields with your actual credentials.

3. Start the app:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000`.

## API

`POST /bfhl`

Request body:

```json
{
  "data": ["A->B", "A->C", "B->D"]
}
```

## Environment variables

- `BFHL_FULL_NAME`
- `BFHL_DOB_DDMMYYYY`
- `BFHL_EMAIL_ID`
- `BFHL_ROLL_NUMBER`
- `PORT`

## Validation

Use the `/health` route for a quick server check and submit the sample input from the frontend to verify the hierarchy output.