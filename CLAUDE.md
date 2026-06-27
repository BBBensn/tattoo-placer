---
date_created: 2026-06-27 14:20:00
type: project-config
date_modified: 2026-06-27 14:20:00
---

# Tattoo Placer — CLAUDE.md

Projekt-spezifischer Kontext. Ergänzt `~/.claude/CLAUDE.md`.
Ablageort: `~/Documents/Coding/tattoo-placer/CLAUDE.md`

---

## Projekt-Basics

- **Name:** tattoo-placer
- **Domain:** tattoo.bensn.me
- **Version:** v1.0.0
- **Status:** active
- **Stack:** Vanilla JS + three.js (CDN, no-build) + IndexedDB · kein Backend

Web-basierter Tattoo-Placer: generisches 3D-Körpermodell, auf das transparente PNG-Designs als Decals projiziert, transformiert, gespeichert und als Screenshot exportiert werden. Komplett client-side, rein statisch deploybar.

---

## Lokale Struktur

```
~/Documents/Coding/tattoo-placer/
├── public/                     ← komplette App, 1:1 das was deployed wird
│   ├── index.html
│   ├── app.js                  ← Einstieg (weitere Module nach Bedarf)
│   ├── style.css
│   └── assets/
│       ├── body.glb            ← CC0 Base-Mesh, A-Pose
│       └── CREDITS.md          ← Mesh-Quelle + Lizenz
├── docs/
│   └── changelogs/             ← Claude Code schreibt Changelogs hierher
├── CLAUDE.md
└── .gitignore
```

---

## Remote-Struktur

```
/var/www/tattoo/public/         ← komplette statische App (Frontend = alles)
```

Kein `api/` — es gibt kein Backend.

---

## Services & Ports

Kein Backend, kein systemd-Service, kein Port. Reine statische Auslieferung über nginx.

---

## Einmalige Infra (ich, vor dem ersten Deploy)

- [ ] DNS A-Record: `tattoo.bensn.me` → `178.104.133.228`
- [ ] nginx vhost für `tattoo.bensn.me`, root `/var/www/tattoo/public`, static
- [ ] TLS via certbot (`certbot --nginx -d tattoo.bensn.me`)
- [ ] Ordner anlegen: `ssh bensn mkdir -p /var/www/tattoo/public`

---

## Deploy

```bash
# Komplette statische App deployen (kein Restart nötig)
scp -r ~/Documents/Coding/tattoo-placer/public/* \
  bensn:/var/www/tattoo/public/
```

---

## Git

- **Repo:** `https://github.com/BBBensn/tattoo-placer`
- **Remote:** `git remote add origin git@github.com:BBBensn/tattoo-placer.git`
- **Branch:** `main`

```bash
git add .
git commit -m "Add [feature]"
git push origin main
```

---

## Auth

- [x] Öffentlich — kein Auth

---

## Projekt-spezifische Konventionen

- **Kein Build-Step.** ES-Module via Importmap vom CDN. three.js auf eine feste Version pinnen (kein `@latest`).
- three.js Addons aus `three/examples/jsm/...`: `OrbitControls`, `DecalGeometry`, `GLTFLoader`.
- **Decals sind immutable.** Source of Truth ist die Decal-Spec (`imageId`, Position, Orientierung, Größe, Rotation). Bei jeder Transform-Änderung wird die `DecalGeometry` neu erzeugt — nicht das bestehende Mesh manipuliert.
- **Persistenz: IndexedDB**, nicht localStorage. Bilder als Blobs, Kompositionen als JSON mit Referenz auf Bild-IDs. Kein base64-in-localStorage (Quota).
- Komposition-Schema trägt `schemaVersion` — Migrationspfad für späteres Backend / Export muss sauber bleiben.
- Decal-Material: `transparent: true`, `depthTest: true`, `polygonOffset` gegen z-fighting, Alpha aus dem PNG erhalten.

---

## Roadmap

| Version | Feature | Status |
|---------|---------|--------|
| v1.0.0 | MVP: Mesh laden · PNG per Drag&Drop + Paste · Decal projizieren · transformieren · IndexedDB save/load · Screenshot- + JSON-Export | aktiv |
| v1.1.0 | Preset-Library aus eigenen Designs (statt nur Upload) | geplant |
| v1.2.0 | Armature + Pose-Bends (Knie/Ellbogen) für realistischen Wrap-Test | geplant |
| v2.0.0 | Optionales Backend (Flask + SQLite) für Cross-Device-Sync | idee |

---

## Obsidian-Doku

- Projekt-MD: `03_Projects/Coding PC/tattoo-placer/tattoo-placer.md`
- Changelogs: `03_Projects/Coding PC/tattoo-placer/Changelogs/`
- Changelog-All: `03_Projects/Coding PC/tattoo-placer/tattoo-placer-Changelog-All.md`
