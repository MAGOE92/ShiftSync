Lies zuerst CLAUDE.md und docs/MIGRATION.md vollständig.

Aufgabe (Phase 1 der Roadmap): Überführe src/App.jsx in ein sauberes
Vite-React-Projekt mit der in MIGRATION.md vorgeschlagenen Modulstruktur.

Harte Regeln:
1. Verhalten und Design bleiben EXAKT identisch — standalone/ShiftSyncPro.html
   ist die Referenz. Keine Funktionsänderungen, kein Redesign, keine Emojis.
2. arbzgCheck, algo und orgCode werden pure functions in src/lib/ mit
   eigenen Unit-Tests (Vitest).
3. Die Persistenz bleibt hinter EINER Schnittstelle (src/lib/storage.js,
   window.storage-kompatibel) — sie wird in Phase 2 gegen Supabase getauscht.
4. tests/e2e.test.cjs muss nach dem Umbau grün laufen (passe nur Pfade an,
   nicht die Assertions). Richte ein npm-Script "test:e2e" dafür ein.
5. Initialisiere git und committe in kleinen, nachvollziehbaren Schritten.

Arbeite die Zerlegung Datei für Datei ab und führe nach jedem größeren
Schritt den E2E-Test aus. Wenn alles grün ist: kurzes Fazit, dann stoppen —
Phase 2 (Supabase) starte ich separat.
