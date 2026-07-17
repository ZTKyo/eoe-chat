# Hosted Private Beta Deployment

This guide deploys EOE Chat as a password-protected, installable PWA. It does
not enable M3, Adaptive Progression, or image input.

## Recommended host

Vercel is the reference host because this Next.js application uses the
server-side `POST /api/chat` route. GitHub Pages is not a full application
host for this repository.

## Required production environment

Configure these as server-side environment variables in Vercel. Mark secrets
as sensitive and never prefix them with `NEXT_PUBLIC_`.

```dotenv
EOE_EXECUTION_MODE=production
EOE_ALLOW_LIVE_PROVIDER=true
USE_MOCK_PROVIDER=false

GLM_API_KEY=<set in Vercel>
DEEPSEEK_API_KEY=<set in Vercel>
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
DEEPSEEK_BASE_URL=https://api.deepseek.com
PRIMARY_MODEL=glm-4.7
FALLBACK_MODEL=deepseek-v4-flash
PROVIDER_TIMEOUT_MS=30000

EOE_ENABLED=true
EOE_FIXED_LEVEL=2
EOE_DEVELOPER_MODE=false
EOE_ENABLE_IMAGE_INPUT=false

EOE_ACCESS_PASSWORD=<set directly in Vercel>
EOE_ACCESS_SESSION_SECRET=<random value of at least 32 characters>
EOE_DAILY_REQUEST_LIMIT=50
```

Production provider use is fail-closed. Real providers are selected only when
`EOE_EXECUTION_MODE=production`, `EOE_ALLOW_LIVE_PROVIDER=true`, and
`USE_MOCK_PROVIDER=false` are all explicit and both provider keys are present.

## Password and quota boundary

The password gate creates an HTTP-only signed access cookie. The daily request
limit is stored in another server-signed cookie and resets by UTC date. This
is suitable for the current single-user private Beta, but it is not durable
distributed abuse protection: a user who knows the password can clear cookies
and sign in again. Before anonymous or multi-user access, replace it with
account-based authentication and a durable Redis/KV rate limiter.

## PWA verification

After deployment:

1. An unauthenticated visit redirects to `/access`.
2. A wrong password is rejected without revealing configuration.
3. A correct password opens the chat.
4. A real text request returns a GLM or DeepSeek response.
5. `/manifest.webmanifest`, `/sw.js`, `/icons/192`, and `/icons/512` return
   successfully.
6. Chrome or Edge offers installation; iOS Safari can use Add to Home Screen.
7. Reloading the installed app keeps IndexedDB conversation history.
8. Image input and Developer Mode remain unavailable.

## Rollback

Use Vercel's deployment history to promote the previous known-good deployment.
If provider spend or abuse is suspected, first set
`EOE_ALLOW_LIVE_PROVIDER=false` and redeploy; production then fails closed
rather than silently exposing live credentials.
