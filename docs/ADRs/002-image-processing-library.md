# ADR-002: Image Processing Library for Baileys

## Status
Accepted

## Date
2026-02-06

## Context
When sending movie poster images via WhatsApp, Baileys attempts to generate thumbnails for image previews. Without an image processing library installed, this produces warning logs:

```
Error: No image processing library available
    at getImageProcessingLibrary (.../node_modules/@whiskeysockets/baileys/lib/Utils/messages-media.js:26:11)
    ...
msg: "failed to obtain extra info"
```

### Options Considered

#### 1. Install `sharp`
Native image processing library with excellent performance.

| Pros | Cons |
|------|------|
| Fast processing | Requires native compilation |
| Well-maintained | Can fail on shared hosting |
| Recommended by Baileys | Adds ~30MB to node_modules |

#### 2. Install `jimp`
Pure JavaScript image processing library.

| Pros | Cons |
|------|------|
| No native dependencies | Slower than sharp |
| Works on any hosting | Larger bundle size |
| Easy installation | |

#### 3. Do nothing
Accept the warning and skip thumbnail generation.

| Pros | Cons |
|------|------|
| No extra dependencies | Warning noise in logs |
| Simpler deployment | |
| Images still display correctly | |

## Decision
We will **do nothing** and accept the warning logs.

### Rationale
- The warning is non-fatal (level 40 = warn)
- Images are sent and displayed correctly without thumbnails
- Thumbnails only affect the small preview before full image loads
- WhatsApp handles missing thumbnails gracefully
- Avoiding extra dependencies keeps deployment simple on Uberspace

## Consequences

### Positive
- No additional dependencies to maintain
- No native compilation issues on shared hosting
- Simpler deployment process

### Negative
- Warning messages in server logs (minor noise)
- No image previews/thumbnails in chat (WhatsApp shows placeholder until image loads)

### If This Becomes Problematic
If we later need thumbnails or want to silence the warnings:
1. Install `jimp` (safer for shared hosting): `npm install jimp`
2. Or install `sharp` (faster, if hosting supports it): `npm install sharp`
3. Baileys auto-detects either library, no code changes needed
