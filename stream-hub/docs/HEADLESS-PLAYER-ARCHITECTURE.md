# Headless Native Player Architecture

Unified media hub with a **tiered playback model**. DRM-protected OTT content cannot be surface-mirrored legally; direct streams can run inside MAX.

## Playback tiers

| Tier | Content | Mechanism | User sees |
|------|---------|-----------|-----------|
| **In-app** | HLS / DASH / MP4 (IPTV, licensed) | `CustomVideoContainer` (web) or `PlayerSurfaceActivity` + ExoPlayer (Android) | MAX player UI only |
| **OTT handoff** | Netflix, Shahid, TOD (DRM) | `PlatformLaunchPlugin` → official app in separate task | Handoff overlay in MAX; official app handles auth/DRM |

## Why not surface mirroring for Netflix/Shahid?

- Widevine / PlayReady blocks extraction and `FLAG_SECURE` on many devices.
- Terms of service forbid rebroadcasting streams outside official clients.
- No public playback API for arbitrary third-party shells (partner SDK only).

**Secure handoff** keeps compliance: official app runs in background/separate task; MAX dashboard stays mounted with return UX.

## Module map

```
Poster click
  └── useLockedPlay
        └── playback-bridge.ts
              ├── mode: in_app  → headless-player-native.ts → HeadlessPlayerPlugin (Android)
              │                      └── PlaybackForegroundService (ExoPlayer)
              │                      └── PlayerSurfaceActivity (MAX-branded surface)
              └── mode: ott_handoff → platform-open.ts → PlatformLaunchPlugin
```

## Key files

| Layer | Path |
|-------|------|
| Coordinator | `stream-hub/src/lib/playback-bridge.ts` |
| Web/native bridge | `stream-hub/src/lib/headless-player-native.ts` |
| Custom player UI | `stream-hub/src/components/CustomVideoContainer.tsx` |
| OTT handoff banner | `stream-hub/src/components/OttHandoffOverlay.tsx` |
| Android service | `PlaybackForegroundService.java` |
| Android surface | `PlayerSurfaceActivity.java` |
| Capacitor plugin | `HeadlessPlayerPlugin.java` |

## Remote control (CustomVideoContainer)

- **Space / Enter** — play/pause
- **← / →** — seek ±10s
- **Escape / Back** — close player, return to grid

## Adding Apple TV

1. Add `apple-tv` to `PlatformId` and `PLATFORMS`.
2. Extend `PlatformLaunchPlugin` with package + search URL.
3. Route via `ott_handoff` (same DRM constraints as Netflix).

## Future: partner SDK path

If Netflix/Shahid grant SDK access, add `PlaybackMode.partner_sdk` and render inside `PlayerSurfaceActivity` using their official player SDK — still no stream extraction.
