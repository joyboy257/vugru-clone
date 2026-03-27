// Music tracks available for auto-edits.
// Using copyright-free ambient music from public URLs (Pixabay CDN).
// These are placeholder URLs — in production, swap with actual hosted tracks or an API.

export const MUSIC_TRACKS = {
  'upbeat-1': {
    name: 'Morning Drive',
    url: 'https://cdn.pixabay.com/audio/2022/03/24/audio_1ec46ab521.mp3',
    duration: 60,
  },
  'warm-1': {
    name: 'Golden Hour',
    url: 'https://cdn.pixabay.com/audio/2021/08/04/audio_a1e6b8e85e.mp3',
    duration: 60,
  },
  'modern-1': {
    name: 'Clean Lines',
    url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_bf0d99e4e6.mp3',
    duration: 60,
  },
  'cinematic-1': {
    name: 'Wide Open',
    url: 'https://cdn.pixabay.com/audio/2023/07/06/audio_88c74ab61b.mp3',
    duration: 60,
  },
  'acoustic-1': {
    name: 'Sunday Light',
    url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
    duration: 60,
  },
} as const;

export type MusicKey = keyof typeof MUSIC_TRACKS;

export function getMusicTrack(key: string) {
  return MUSIC_TRACKS[key as MusicKey] ?? MUSIC_TRACKS['upbeat-1'];
}
