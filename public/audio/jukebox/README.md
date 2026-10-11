# Approved recordings for Our Jukebox

The preferred workflow is **CMS → Jukebox → Tambah lagu → Upload audio → Simpan jukebox**.
Uploads are stored in the existing Cloudflare R2 bucket. Playlist order, titles, artists,
personal labels, bilingual notes and interface wording are stored in D1 (`cms.jukebox`).
Normal deploys and custom-domain changes do not replace these records.

Use owner-supplied recordings that the owner has permission to publish. Accept MP3 or
AAC in an M4A container, maximum 20 MB per track; 128–192 kbps is sufficient. Do not
download or rip Spotify, YouTube, Apple Music or commercial album artwork.

An optional repository workflow can place approved files here as `track-01.mp3` or
`track-01.m4a`. Its playlist `src` must be `/audio/jukebox/track-01.mp3` (or `.m4a`).
The central schema/defaults are in `lib/jukebox-playlist.ts`; do not edit player internals.
The deployed playlist is managed through the CMS, not this README.

No demo recordings ship by default. Generated local test tones are uploaded only to
isolated local QA storage. With no enabled recordings, the public jukebox stays hidden.

Removing a song from the playlist does not delete its uploaded R2 recording. Old audio
and covers are retained for recovery; deleting unused stored recordings can be a
separate owner-approved cleanup.
