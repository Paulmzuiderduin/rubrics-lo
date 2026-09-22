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

De pilot gebruikt een relationeel datamodel. Iedere docent krijgt automatisch één persoonlijke `workspace`; klassen, leerlingen, roosters, lessenreeksen, sessies en beoordelingen staan in afzonderlijke tabellen. Rubrics zijn afzonderlijk geversioneerd, zodat een historische beoordeling naar de toen gebruikte inhoud kan blijven verwijzen.

`workspace_members` bevat al rollen voor eigenaar, beheerder, docent en lezer. De huidige interface maakt uitsluitend een persoonlijke werkomgeving met één eigenaar en biedt bewust nog geen deel- of teamfuncties. Later kunnen scholen, teams en gedeeld eigenaarschap daardoor worden toegevoegd zonder de onderwijsgegevens opnieuw te modelleren.

De frontend leest via een afgeschermde RPC een volledige clientweergave, maar schrijft alleen gewijzigde entiteiten via een tweede RPC. Die wijzigingen worden transactioneel als gerichte upserts/verwijderingen op de genormaliseerde tabellen toegepast; een enkele aanpassing wist of herschrijft dus niet alle klassen, lessen en beoordelingen. Iedere write bevat ook de laatst gelezen workspaceversie. De database weigert een stale write zodat een oudere browsertab geen nieuwere wijzigingen kan overschrijven. De eigenaar komt uitsluitend uit `auth.uid()` en kan niet vanuit de browser worden meegestuurd. De gegevens zelf worden niet als één JSON-document opgeslagen.

Beveiliging:

- RLS staat aan én wordt geforceerd.
- `anon` heeft geen tabelrechten.
- `authenticated` krijgt alleen de minimaal benodigde tabel- en RPC-rechten.
- Alle domeintabellen zijn via `workspace_id` en lidmaatschapspolicies afgeschermd.
- De persoonlijke workspace-eigenaar wordt server-side bepaald via `auth.uid()`.
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

### Auth-e-mail

De vaste afzender is `Rubrics LO <rubrics@paulzuiderduin.com>`. De Nederlandse HTML-templates staan in `supabase/templates` en zijn voor lokaal testen gekoppeld in `supabase/config.toml`.

Voor de gehoste omgeving:

1. Configureer onder **Authentication → SMTP Settings** een eigen SMTP-provider met `rubrics@paulzuiderduin.com` als afzender en `Rubrics LO` als afzendernaam. Bewaar SMTP-wachtwoorden uitsluitend in Supabase, nooit in Git of in een `VITE_`-variabele.
2. Publiceer de vereiste SPF-, DKIM- en DMARC-records bij de DNS-provider.
3. Kopieer onderwerp en HTML uit `supabase/templates` naar **Authentication → Email Templates**. De app gebruikt momenteel `confirmation.html` en `recovery.html`; de overige templates voorkomen later terugval op standaard Supabase-teksten.
4. Test registratie en wachtwoordherstel met een echt extern e-mailadres voordat openbare registratie wordt aangezet.

Een Send Email Auth Hook met Edge Function is bewust nog niet nodig. Custom SMTP en de eigen templates vervangen de standaardafzender en standaardteksten met minder storingspunten. Een hook blijft later mogelijk voor conditionele inhoud of volledige providercontrole.

## Publicatie

GitHub Pages leest tijdens de build deze repositoryvariabelen:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Controle

```bash
npm test
npm run build
```
