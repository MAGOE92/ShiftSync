# ShiftSync Mobile — iOS, iPad & Android (Capacitor)

Die Mobile-Apps sind **keine zweite Codebasis**: Capacitor verpackt den
bestehenden Vite-Build (`dist/`) in native iOS-/Android-Projekte. Alle
Funktionen (Planer, ArbZG-Wächter, Stempeluhr, Schichtbörse, Abwesenheiten,
ShiftSync-2-Design mit Sidebar/Modulen) sind damit 1:1 identisch zur Web-App.
Die App bleibt online-pflichtig und spricht wie bisher nur mit der
Edge Function `api`.

```
npm run build          # Web-Assets bauen
npx cap sync           # in ios/ und android/ kopieren + Plugins verdrahten
npx cap open android   # Android Studio
npx cap open ios       # Xcode (nur am Mac)
```

## Projektstruktur

- `capacitor.config.json` — App-ID `pro.shiftsync.app`, Name „ShiftSync", Splash/Push-Konfig
- `android/`, `ios/` — generierte native Projekte (eingecheckt, Icons/Splash via
  `npx @capacitor/assets generate` aus `public/icons/`)
- `src/lib/native.js` — einzige Brücke zur nativen Welt (Web-Build: No-ops)
  - StatusBar folgt Hell/Dunkel, Splash-Hide, Safe-Area-Padding (Notch)
  - Push: Permission → Token → `register_push` ans Gateway
- iPad läuft automatisch mit (`TARGETED_DEVICE_FAMILY = 1,2`), responsive UI vorhanden.

## Push-Benachrichtigungen (einmalige Einrichtung)

Versand läuft server-seitig über **FCM HTTP v1** (bedient Android **und**
iOS/APNs). Bereits im Code: Tabelle `push_tokens`, Gateway-Aktionen
`register_push`/`unregister_push`, automatischer Versand bei jeder neuen
In-App-Benachrichtigung (Genehmigungen, neue Anfragen, Planveröffentlichung,
Schichtbörse — alles, was `notifs` erzeugt).

Noch zu tun (Reihenfolge):

1. **Migration ausführen**: `supabase/migrations/20260712000000_push_tokens.sql`
   (war in dieser Session durch den Berechtigungsmodus geblockt).
2. **Edge Function `api` neu deployen** (enthält Push-Code; ohne Secret läuft
   sie unverändert weiter — Push wird still übersprungen).
3. **Firebase-Projekt** anlegen (console.firebase.google.com):
   - Android-App `pro.shiftsync.app` hinzufügen → `google-services.json`
     nach `android/app/` legen.
   - iOS-App `pro.shiftsync.app` hinzufügen → `GoogleService-Info.plist` ins
     Xcode-Projekt; in Xcode „Push Notifications"-Capability aktivieren und
     den **APNs-Auth-Key** (Apple Developer → Keys) in Firebase hochladen.
     Für FCM auf iOS zusätzlich Firebase-Messaging-Pod einbinden
     (siehe Capacitor-Doku „Push Notifications – iOS with FCM").
4. **Secret setzen**: Service-Account-JSON (Firebase → Projekteinstellungen →
   Dienstkonten → neuen Schlüssel erzeugen) als
   `supabase secrets set FCM_SERVICE_ACCOUNT='<gesamtes JSON>'`.

## Builds & Store-Veröffentlichung

**Android** (geht auf diesem Windows-PC):
- Android Studio installieren → `npx cap open android` → Build → Generate
  Signed Bundle (AAB). Play-Console-Konto: einmalig 25 $.

**iOS/iPad** (braucht einen Mac ODER Cloud-Build):
- Mac: Xcode → Signing mit Apple-Developer-Konto (99 €/Jahr) → Archive →
  App Store Connect.
- Ohne Mac: Cloud-Build-Dienst (Codemagic, Ionic Appflow) mit diesem Repo
  verbinden — beide bauen Capacitor-iOS-Apps inkl. Signierung.

**Wichtig für das App-Review (Apple 4.2 „Minimum Functionality")**: Die App
bündelt die Web-Assets lokal (kein reiner Website-Wrapper) und bringt Push,
Splash, native StatusBar mit — das entspricht dem üblichen, akzeptierten
Capacitor-Setup. Demo-Zugang für das Review-Team im App-Store-Formular angeben.

**App-Updates**: UI-Änderungen erfordern einen neuen Store-Build
(`npm run build && npx cap sync` → neue Version hochladen). Optional später:
Live-Update-Dienst (Capgo/Appflow), um Web-Assets ohne Review zu aktualisieren.

## E-Mail-Registrierung + „Mit Apple/Google anmelden" (nächster Schritt)

Heute: Betriebs-ID + Login-ID + PIN (bleibt für Mitarbeiter im Betrieb ideal).
Für den Marktstart geplant, **zusätzlich**, nicht ersetzend:

1. **Inhaber-Konto = E-Mail** — Supabase Auth (E-Mail + Passwort/Magic Link).
   Neue Tabelle `accounts (auth_uid, emp_id, org_id)` verknüpft Auth-User mit
   dem Owner-Mitarbeiter; das Gateway akzeptiert dann alternativ ein
   Supabase-JWT und stellt sein eigenes Session-Token aus.
2. **Sign in with Apple / Google** — `supabase.auth.signInWithIdToken()` mit
   den Capacitor-Plugins `@capacitor-firebase/authentication` oder
   `capacitor-social-login`. Apple-Login ist **Pflicht** im App Store, sobald
   Google-Login angeboten wird (Apple-Richtlinie 4.8).
3. Mitarbeiter behalten Betriebs-ID+PIN; Einladung per E-Mail kann später
   das PIN-Onboarding ersetzen.

Aufwand: Gateway-Erweiterung (~1 Tag) + Login-UI + Apple/Google-Konsolen-Setup.
