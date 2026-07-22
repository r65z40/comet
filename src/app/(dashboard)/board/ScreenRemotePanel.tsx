"use client";

import { useState, useRef } from "react";
import { Monitor, Send, Search, Play, Pause, Square, SkipForward, SkipBack, Video, Music, X, Loader2, Volume2, VolumeX } from "lucide-react";

interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
}

export default function ScreenRemotePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"video" | "spotify">("video");
  const [videoUrl, setVideoUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [videoSent, setVideoSent] = useState(false);
  const [videoVolume, setVideoVolume] = useState(80);
  const [videoMuted, setVideoMuted] = useState(false);

  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  async function sendVideo() {
    if (!videoUrl.trim()) return;
    setSending(true);
    await fetch("/api/screen/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "video", url: videoUrl.trim() }),
    });
    setSending(false);
    setSent(true);
    setVideoSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  async function sendVideoControl(action: "play" | "pause" | "stop" | "mute" | "unmute", volume?: number) {
    await fetch("/api/screen/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "video:control", action, volume }),
    });
    if (action === "stop") setVideoSent(false);
  }

  async function sendVideoVolume(vol: number) {
    setVideoVolume(vol);
    setVideoMuted(vol === 0);
    await fetch("/api/screen/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "video:control", volume: vol / 100 }),
    });
  }

  async function toggleVideoMute() {
    const newMuted = !videoMuted;
    setVideoMuted(newMuted);
    await sendVideoControl(newMuted ? "mute" : "unmute");
  }

  async function sendSpotifyTrack(uri: string) {
    await fetch("/api/screen/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotify", uri, action: "play" }),
    });
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  async function sendSpotifyControl(action: "play" | "pause" | "next" | "prev") {
    await fetch("/api/screen/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotify", action }),
    });
  }

  function handleSpotifySearch(q: string) {
    setSpotifyQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSpotifyResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&type=track&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSpotifyResults(data.tracks || []);
        }
      } catch {} finally {
        setSearching(false);
      }
    }, 400);
  }

  function formatDuration(ms: number) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Envoyer au Screen</h3>
              <p className="text-[11px] text-slate-400">Vidéo ou musique sur l&apos;écran</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab("video")}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === "video" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            <Video className="w-4 h-4" /> Vidéo
          </button>
          <button
            onClick={() => setTab("spotify")}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === "spotify" ? "text-green-600 border-b-2 border-green-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            <Music className="w-4 h-4" /> Spotify
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === "video" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">URL de la vidéo</label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="YouTube, MP4, M3U8, flux IPTV..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === "Enter" && sendVideo()}
                />
              </div>
              <button
                onClick={sendVideo}
                disabled={!videoUrl.trim() || sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer au Screen
              </button>

              {/* Video playback controls */}
              {videoSent && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-medium text-slate-500">Contrôles du lecteur</p>
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => sendVideoControl("play")} className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                      <Play className="w-5 h-5" />
                    </button>
                    <button onClick={() => sendVideoControl("pause")} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                      <Pause className="w-5 h-5" />
                    </button>
                    <button onClick={() => sendVideoControl("stop")} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                      <Square className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={toggleVideoMute} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                      {videoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={videoMuted ? 0 : videoVolume}
                      onChange={(e) => sendVideoVolume(Number(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
                    />
                    <span className="text-xs text-slate-400 w-8 text-right">{videoMuted ? 0 : videoVolume}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "spotify" && (
            <div className="space-y-3">
              {/* Controls */}
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => sendSpotifyControl("prev")} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={() => sendSpotifyControl("pause")} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  <Pause className="w-5 h-5" />
                </button>
                <button onClick={() => sendSpotifyControl("play")} className="p-3 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors">
                  <Play className="w-5 h-5" />
                </button>
                <button onClick={() => sendSpotifyControl("next")} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={spotifyQuery}
                  onChange={(e) => handleSpotifySearch(e.target.value)}
                  placeholder="Rechercher un titre..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
              </div>

              {/* Results */}
              {spotifyResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto -mx-1 space-y-0.5">
                  {spotifyResults.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => sendSpotifyTrack(track.uri)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                    >
                      {track.album.images[0] && (
                        <img src={track.album.images[track.album.images.length - 1].url} alt="" className="w-10 h-10 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{track.name}</div>
                        <div className="text-xs text-slate-400 truncate">{track.artists.map((a) => a.name).join(", ")}</div>
                      </div>
                      <span className="text-xs text-slate-400">{formatDuration(track.duration_ms)}</span>
                      <Send className="w-3.5 h-3.5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sent confirmation */}
          {sent && (
            <div className="mt-3 py-2 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm text-center font-medium">
              Envoyé au screen !
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
