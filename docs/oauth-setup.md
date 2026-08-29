# Registering the OAuth apps

Sign-in uses GitHub and Google. Neither provider's registration lives in this
repository, so this is the record of what was set up and how to redo it.

Callback paths, given the route handler at `app/api/auth/[...nextauth]/route.ts`:

```
http://localhost:3000/api/auth/callback/github
http://localhost:3000/api/auth/callback/google
https://my-movies-plum.vercel.app/api/auth/callback/github
https://my-movies-plum.vercel.app/api/auth/callback/google
```

## Variable names are the same everywhere

Auth.js v5 infers `AUTH_{PROVIDER}_{ID|SECRET}` from the provider's id, so the
GitHub provider reads exactly `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` and
`providers: [GitHub, Google]` needs no arguments. A name that encodes the
environment — `AUTH_GITHUB_PROD_ID` — is read by nothing and fails silently.

The name never changes between environments. Only the value does, scoped by
where it is stored: `.env.local` locally, Vercel's environment targets remotely.

## GitHub — two apps

GitHub's OAuth App form takes a single authorization callback URL, so there is
one app per environment. This also keeps the production secret out of
`.env.local`, which is what `docker run --env-file` reads.

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. For the local app: name `My Movies (local)`, homepage `http://localhost:3000`,
   callback `http://localhost:3000/api/auth/callback/github`. Leave Device Flow off.
3. Copy the **Client ID**, then **Generate a new client secret** and copy it —
   GitHub shows a secret once and never again.
4. Repeat with the production homepage and callback URL for the second app.

No scope configuration; the provider requests what it needs at sign-in.

## Google — one client

Google's form accepts a list of redirect URIs, so a single client covers both
environments.

1. https://console.cloud.google.com → new project.
2. **Google Auth Platform** (older layouts: **APIs & Services → OAuth consent
   screen**): app name, support email, **External** audience, contact email.
3. While publishing status is **Testing**, add your own account under **Test
   users**. Without this, sign-in fails with `access_denied` even though
   everything else is correct.
4. **Clients** → **Create client** → **Web application**. Authorized JavaScript
   origins: both origins above. Authorized redirect URIs: both Google callback
   URLs above.
5. Copy the client ID and secret. Unlike GitHub, the secret stays retrievable
   from the client's detail page.

No API needs enabling in the library; OpenID Connect sign-in works without one.

Console menu labels drift between redesigns. The redirect URIs are the part that
must be exact.

## Where the values go

`.env.local` — `AUTH_SECRET` (`openssl rand -base64 33`), `AUTH_URL`, the
**local** GitHub pair, and the Google pair.

Vercel — the same five names, with a different `AUTH_SECRET` and the
**production** GitHub pair. All five are stored as Sensitive and target
**Production and Preview**. Sensitive variables cannot target Development at
all, which is fine: local development reads `.env.local`.

They belong on Preview even though sign-in cannot work there, because
`SiteHeader` calls `auth()` on every route and Auth.js throws when `AUTH_SECRET`
is missing — without them a preview returns 500 on every page rather than
rendering as signed-out.

Extending an existing variable to another environment is a dashboard operation:
Settings → Environment Variables → Edit → tick the environments. The CLI cannot
do it — `vercel env add` takes one environment per call and needs the value
again, and `vercel env update` changes only the value, not the targets. A
Sensitive value cannot be read back, so for the production GitHub pair the
dashboard is the only option that does not mean regenerating the secret.

Environment variable changes apply to new deployments only. Redeploy after
changing one.

## Sign-in cannot complete on a preview deployment

Every preview gets a fresh URL, and neither provider redirects to an
unregistered one. Previews are for reviewing rendering; sign-in is verified
locally, in the container, and on production. Pointing `AUTH_URL` at production
does not fix it — the session cookie would be set on the wrong domain.

## Checking credentials without running the app

Post a deliberately invalid `code` to the provider's token endpoint. The error
distinguishes bad credentials from a bad code:

| Provider | Credentials good | Credentials bad |
| --- | --- | --- |
| GitHub | `bad_verification_code` | `incorrect_client_credentials` |
| Google | `invalid_grant` | `invalid_client` |

Read the values from the environment rather than typing them into a command, so
no secret lands in shell history:

```bash
set -a; . ./.env.local; set +a
curl -s -H 'Accept: application/json' \
  -d "client_id=$AUTH_GITHUB_ID" \
  --data-urlencode "client_secret=$AUTH_GITHUB_SECRET" \
  -d 'code=deliberately-invalid' \
  https://github.com/login/oauth/access_token
```

Google's authorize endpoint also reveals whether a redirect URI is registered —
an unregistered one redirects to `/signin/oauth/error` with the reason
base64-encoded in the query string. **GitHub's does not**: it redirects to its
login page before checking `redirect_uri`, so a deliberately wrong URI looks
identical to a correct one. A GitHub callback URL is only proven by a human
completing a sign-in.

Always run a known-bad control alongside any such probe. The first version of
this check reported four passes including one that should have failed, because
it looked for an error string in the response body while Google had encoded it
into a redirect.
