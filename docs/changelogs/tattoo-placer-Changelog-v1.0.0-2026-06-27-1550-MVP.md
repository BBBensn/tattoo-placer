---
date_created: 2026-06-27 15:50:02
type: changelog
tags:
  - tattoo-placer
  - changelog
date_modified: 2026-06-27 15:50:02
---

# v1.0.0 — MVP (2026-06-27)

- three.js 0.168.0 via Importmap (CDN, kein Build-Step): OrbitControls, GLTFLoader, DecalGeometry
- CC0/CC-BY-lizenziertes humanoides Base-Mesh (ferrumiron6, 12.8k Triangles) geladen, auf 176 cm skaliert, Füße bei y=0 zentriert
- three.js-Szene mit Ambient-, Key- und Fill-Licht, OrbitControls (Damping, Min/Max-Distance), preserveDrawingBuffer für Screenshot
- PNG-Import via Drag & Drop auf Canvas oder Drop-Zone und via Paste (Ctrl+V, Alpha erhalten)
- Bilder werden als Blob in IndexedDB gespeichert (schemaVersion-fähig), Kompositions-Schema versioniert (schemaVersion: 1)
- Decal-Platzierung: Raycast auf Body-Mesh → Trefferpunkt + Weltkoordinaten-Normale → DecalGeometry (transparent, depthTest, polygonOffset gegen Z-Fighting)
- Decal-Manipulation: Größe (Slider 3–50 cm) und Rotation (Slider ±180°) → bei jeder Änderung DecalGeometry neu projiziert (Spec ist Source of Truth)
- Reposition-Modus: OrbitControls deaktiviert, nächster Body-Klick repositioniert selektiertes Decal
- Layer-Panel: alle platzierten Decals als Liste, Klick selektiert; rechter Mausklick auf Bild-Thumbnail löscht Bild + zugehörige Decals
- Kompositionen: benannt in IndexedDB speichern, laden, löschen
- Export: Screenshot als PNG-Download, Komposition als portables JSON (Bilder als base64-Blobs eingebettet)
- Import: JSON reimportiert Bilder in IndexedDB und rekonstruiert alle Decals
- Dateistruktur: public/ (index.html, app.js, scene.js, db.js, style.css, assets/body.glb, assets/CREDITS.md)
