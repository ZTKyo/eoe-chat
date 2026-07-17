# Security Policy

## Supported version

Only the latest commit on `main` is supported during the Private Text Beta.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this
repository. Do not open a public issue containing API keys, access passwords,
provider responses, private conversations, or exploit details.

## Secrets

- Never commit `.env.local` or provider credentials.
- Provider keys belong in server-side hosting environment variables.
- Values prefixed with `NEXT_PUBLIC_` are exposed to browsers and must never
  contain secrets.
- If a credential is exposed, revoke it at the provider before removing it
  from Git history.

## Deployment boundary

The included password gate and signed-cookie daily quota are intended for a
single-user private Beta. They are not a substitute for durable identity,
distributed rate limiting, or abuse prevention in an anonymous public service.
