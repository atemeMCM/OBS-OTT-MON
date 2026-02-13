// Channel Configuration
const CHANNELS = [
  {
    id: 1,
    name: 'Channel 01',
    hls: 'https://debug-video.ovpobs.tv/live/ch01/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch01/dashclear/Manifest.mpd'
  },
  {
    id: 2,
    name: 'Channel 02',
    hls: 'https://debug-video.ovpobs.tv/live/ch02/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch02/dashclear/Manifest.mpd'
  },
  {
    id: 3,
    name: 'Channel 03',
    hls: 'https://debug-video.ovpobs.tv/live/ch03/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch03/dashclear/Manifest.mpd'
  },
  {
    id: 4,
    name: 'Channel 04',
    hls: 'https://debug-video.ovpobs.tv/live/ch04/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch04/dashclear/Manifest.mpd'
  },
  {
    id: 5,
    name: 'Channel 05',
    hls: 'https://debug-video.ovpobs.tv/live/ch05/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch05/dashclear/Manifest.mpd'
  },
  {
    id: 6,
    name: 'Channel 06',
    hls: 'https://debug-video.ovpobs.tv/live/ch06/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch06/dashclear/Manifest.mpd'
  },
  {
    id: 7,
    name: 'Channel 07',
    hls: 'https://debug-video.ovpobs.tv/live/ch07/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch07/dashclear/Manifest.mpd'
  },
  {
    id: 8,
    name: 'Channel 08',
    hls: 'https://debug-video.ovpobs.tv/live/ch08/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch08/dashclear/Manifest.mpd'
  },
  {
    id: 9,
    name: 'Channel 09',
    hls: 'https://debug-video.ovpobs.tv/live/ch09/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch09/dashclear/Manifest.mpd'
  },
  {
    id: 10,
    name: 'Channel 10',
    hls: 'https://debug-video.ovpobs.tv/live/ch10/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch10/dashclear/Manifest.mpd'
  },
  {
    id: 11,
    name: 'Channel 11',
    hls: 'https://debug-video.ovpobs.tv/live/ch11/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch11/dashclear/Manifest.mpd'
  },
  {
    id: 12,
    name: 'Channel 12',
    hls: 'https://debug-video.ovpobs.tv/live/ch12/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch12/dashclear/Manifest.mpd'
  },
  {
    id: 13,
    name: 'Channel 13',
    hls: 'https://debug-video.ovpobs.tv/live/ch13/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch13/dashclear/Manifest.mpd'
  },
  {
    id: 14,
    name: 'Channel 14',
    hls: 'https://debug-video.ovpobs.tv/live/ch14/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch14/dashclear/Manifest.mpd'
  },
  {
    id: 15,
    name: 'Channel 15',
    hls: 'https://debug-video.ovpobs.tv/live/ch15/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch15/dashclear/Manifest.mpd'
  },
  {
    id: 16,
    name: 'Channel 16',
    hls: 'https://debug-video.ovpobs.tv/live/ch16/hlsclear/index.m3u8',
    dash: 'http://debug-video.ovpobs.tv/live/ch16/dashclear/Manifest.mpd'
  }
];

// Video.js Configuration
const PLAYER_CONFIG = {
  controls: true,
  autoplay: true,
  muted: true,
  preload: 'auto',
  fluid: false,
  responsive: false,
  liveui: true,
  html5: {
    vhs: {
      overrideNative: true,
      enableLowInitialPlaylist: true
    },
    nativeAudioTracks: false,
    nativeVideoTracks: false
  }
};
