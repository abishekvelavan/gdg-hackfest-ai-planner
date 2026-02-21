# Fix Google OAuth "Error 403: access_denied"

This error usually means **your Google account is not allowed** to sign in because the OAuth app is in **Testing** mode.

## Fix in Google Cloud Console

1. Open **[Google Cloud Console](https://console.cloud.google.com/)** → select your project.
2. Go to **APIs & Services** → **OAuth consent screen**.
3. If **Publishing status** is **Testing**:
   - Scroll to **Test users**.
   - Click **+ ADD USERS**.
   - Add the **exact Google account** you use to sign in (e.g. `yourname@gmail.com`).
   - Save.
4. Try connecting again in the app (Connect with Google).

## Also check

- **Authorized redirect URIs** (APIs & Services → Credentials → your OAuth 2.0 Client):
  - For local backend: `http://localhost:8000/api/google/callback`
  - Must match **exactly** (no trailing slash, same scheme and port).
- **OAuth consent screen**: App name and User support email must be set.

After adding yourself as a test user, wait a few seconds and retry; no backend restart needed.

---

# Fix "400 Bad Request" on token (oauth2.googleapis.com/token)

If you see **Connection failed** with a 400 when exchanging the code for tokens:

1. **Redirect URI must match exactly**
   - In Google Cloud Console → Credentials → your OAuth client → **Authorized redirect URIs**, the value must be exactly what the backend uses, e.g. `http://localhost:8000/api/google/callback` (no trailing slash).
   - Set `BACKEND_URL` in `.env` to the same base URL (e.g. `http://localhost:8000`); the backend strips trailing slashes.

2. **Web application client needs client secret**
   - If the OAuth client type is **Web application**, you must set **GOOGLE_CLIENT_SECRET** in `backend/day_planner/.env` (copy from the same client in Google Cloud Console). Desktop app clients can work without it.

3. **Use the error message**
   - The callback page now shows Google’s error (e.g. `redirect_uri_mismatch`, `invalid_grant`). Use it to fix the config and retry.
