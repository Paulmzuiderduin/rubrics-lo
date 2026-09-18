# Rubrics LO

Rubrics LO is een pilot voor formatief handelen in het bewegingsonderwijs. De app bevat een rubricbibliotheek, weekagenda, lessenreeksen, leerlingzelfbeoordeling en perioderapporten.

## Lokaal starten

1. Kopieer `.env.example` naar `.env.local`.
2. Vul de Supabase-project-URL en **publishable key** in.
3. Start de app:

```bash
npm install
npm run dev
```

Gebruik nooit een Supabase secret key of `service_role` key in deze browserapp.

## Supabase

De gekoppelde productieomgeving is het Supabase-project `Rubrics`. De migraties staan in `supabase/migrations`.

De pilot bewaart per docentenaccount één versieerbare werkomgeving in `public.teacher_workspaces`. Dit houdt iedere opslagactie atomair en beperkt het RLS-aanvalsoppervlak. Voor een latere schoolbrede productversie kan de JSON-werkomgeving achter `src/cloudStorage.mjs` worden genormaliseerd zonder de interface opnieuw te bouwen.

Beveiliging:

- RLS staat aan én wordt geforceerd.
- `anon` heeft geen tabelrechten.
- `authenticated` heeft alleen `SELECT`, `INSERT` en `UPDATE`.
- Alle drie policies vereisen `owner_id = auth.uid()`.
- Anonieme Auth-gebruikers worden expliciet geweigerd.
- De frontend bevat uitsluitend de openbare publishable key.
- Lokale leerlingdata wordt na een eenmalige cloudmigratie uit `localStorage` verwijderd. Alleen een persoonsgegevensvrij leerlingmodusslot blijft lokaal staan zolang een les actief is.
- Teruggaan van leerling- naar docentmodus vereist opnieuw het accountwachtwoord; verversen of de site opnieuw openen omzeilt dit slot niet.

## Auth-configuratie

E-mail/wachtwoordregistratie en e-mailbevestiging staan aan. Stel in Supabase onder **Authentication → URL Configuration** in:

- Site URL: `https://rubricsvo.paulzuiderduin.com`
- Redirect URL productie: `https://rubricsvo.paulzuiderduin.com`
- Redirect URL lokaal: `http://127.0.0.1:5173`

Supabase ondersteunt 2FA/MFA met onder andere TOTP-authenticatorapps. De huidige pilot is daarop voorbereid via Supabase Auth, maar toont nog geen inschrijf- en herstelinterface voor een tweede factor. Voeg MFA pas toe samen met een herstelprocedure en afdwinging op `aal2` in RLS.

Geplande botbescherming: Cloudflare Turnstile voor inloggen, registreren en wachtwoordherstel. Activeer **Enable CAPTCHA protection** in Supabase pas nadat de Turnstile-widget en `captchaToken` in alle drie frontendflows zijn toegevoegd en getest.

## Publicatie

GitHub Pages leest tijdens de build deze repositoryvariabelen:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Controle

```bash
npm test
npm run build
```
