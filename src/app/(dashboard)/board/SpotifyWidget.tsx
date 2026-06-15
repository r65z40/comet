"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Search,
  Volume2,
  VolumeX,
  Music,
  Loader2,
  LogIn,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Track {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  durationMs: number;
}

interface PlayerState {
  paused: boolean;
  trackName: string;
  artistName: string;
  albumImage: string;
  positionMs: number;
  durationMs: number;
}

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (t: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  addListener: (event: string, cb: (data: Record<string, unknown>) => void) => void;
  removeListener: (event: string) => void;
  _options: { id: string };
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function SpotifyWidget({ dark = false }: { dark?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<PlayerState | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>(null);
  const sdkLoaded = useRef(false);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/token");
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (!token || sdkLoaded.current) return;
    sdkLoaded.current = true;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({
        name: "Comet Board",
        getOAuthToken: (cb) => {
          fetch("/api/spotify/token")
            .then((r) => r.json())
            .then((d) => cb(d.token))
            .catch(() => {});
        },
        volume: 0.5,
      });

      p.addListener("ready", (data) => {
        setDeviceId((data as { device_id: string }).device_id);
      });

      p.addListener("player_state_changed", (s) => {
        if (!s) { setState(null); return; }
        const st = s as {
          paused: boolean;
          position: number;
          duration: number;
          track_window: {
            current_track: {
              name: string;
              artists: { name: string }[];
              album: { images: { url: string }[] };
            };
          };
        };
        setState({
          paused: st.paused,
          trackName: st.track_window.current_track.name,
          artistName: st.track_window.current_track.artists.map((a) => a.name).join(", "),
          albumImage: st.track_window.current_track.album.images[0]?.url || "",
          positionMs: st.position,
          durationMs: st.duration,
        });
      });

      p.connect();
      setPlayer(p);
    };

    return () => {
      script.remove();
    };
  }, [token]);

  // Progress ticker
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (state && !state.paused) {
      progressInterval.current = setInterval(() => {
        setState((prev) =>
          prev && !prev.paused
            ? { ...prev, positionMs: Math.min(prev.positionMs + 500, prev.durationMs) }
            : prev,
        );
      }, 500);
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
  }, [state?.paused]);

  async function playTrack(uri: string) {
    if (!deviceId || !token) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri] }),
    });
    setShowSearch(false);
    setQuery("");
    setResults([]);
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.tracks || []);
        }
      } catch {}
      setSearching(false);
    }, 400);
  }

  function toggleMute() {
    if (muted) {
      player?.setVolume(volume);
      setMuted(false);
    } else {
      player?.setVolume(0);
      setMuted(true);
    }
  }

  function handleVolume(v: number) {
    setVolume(v);
    setMuted(false);
    player?.setVolume(v);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className={cn("h-5 w-5 animate-spin", dark ? "text-slate-500" : "text-slate-300")} />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full gap-3 p-4", dark ? "text-slate-400" : "text-slate-500")}>
        <Music className="h-8 w-8 opacity-30" />
        <p className="text-xs text-center">Connectez Spotify dans les paramètres</p>
        <a
          href="/api/spotify/auth"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors",
            dark ? "bg-green-600 hover:bg-green-500 text-white" : "bg-green-500 hover:bg-green-600 text-white",
          )}
        >
          <LogIn className="h-3.5 w-3.5" />
          Connecter Spotify
        </a>
      </div>
    );
  }

  const progress = state ? (state.positionMs / state.durationMs) * 100 : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Now playing */}
      <div className={cn("flex items-center gap-3 p-3", dark ? "bg-slate-800/40" : "bg-slate-50")}>
        {state?.albumImage ? (
          <img src={state.albumImage} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 shadow-lg" />
        ) : (
          <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
            <Music className={cn("h-5 w-5", dark ? "text-slate-500" : "text-slate-400")} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", dark ? "text-white" : "text-slate-800")}>
            {state?.trackName || "Aucune lecture"}
          </p>
          <p className={cn("text-xs truncate", dark ? "text-slate-400" : "text-slate-500")}>
            {state?.artistName || "Recherchez un titre"}
          </p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={cn(
            "p-2 rounded-lg transition-colors shrink-0",
            showSearch
              ? (dark ? "bg-green-600 text-white" : "bg-green-500 text-white")
              : (dark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-600"),
          )}
        >
          {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      {/* Progress bar */}
      {state && (
        <div className="px-3 pt-1">
          <div className={cn("w-full h-1 rounded-full overflow-hidden", dark ? "bg-slate-700" : "bg-slate-200")}>
            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className={cn("text-[9px] tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(state.positionMs)}</span>
            <span className={cn("text-[9px] tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(state.durationMs)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-3 py-2">
        <button onClick={() => player?.previousTrack()} disabled={!player} className={cn("p-2 rounded-full transition-colors", dark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")}>
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={() => player?.togglePlay()}
          disabled={!player}
          className={cn("p-3 rounded-full transition-colors", dark ? "bg-green-600 hover:bg-green-500 text-white" : "bg-green-500 hover:bg-green-600 text-white")}
        >
          {state?.paused === false ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <button onClick={() => player?.nextTrack()} disabled={!player} className={cn("p-2 rounded-full transition-colors", dark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")}>
          <SkipForward className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={toggleMute} className={cn("p-1", dark ? "text-slate-500" : "text-slate-400")}>
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolume(parseFloat(e.target.value))}
            className="w-16 h-1 accent-green-500"
          />
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className={cn("flex-1 flex flex-col border-t overflow-hidden", dark ? "border-slate-700" : "border-slate-200")}>
          <div className="p-2">
            <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", dark ? "bg-slate-700" : "bg-slate-100")}>
              <Search className={cn("h-3.5 w-3.5 shrink-0", dark ? "text-slate-400" : "text-slate-400")} />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher un titre, artiste..."
                autoFocus
                className={cn("flex-1 bg-transparent text-sm outline-none", dark ? "text-white placeholder:text-slate-500" : "text-slate-800 placeholder:text-slate-400")}
              />
              {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {results.map((track) => (
              <button
                key={track.id}
                onClick={() => playTrack(track.uri)}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
              >
                {track.image ? (
                  <img src={track.image} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                ) : (
                  <div className={cn("h-9 w-9 rounded flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                    <Music className="h-4 w-4 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{track.name}</p>
                  <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{track.artist}</p>
                </div>
                <span className={cn("text-[10px] shrink-0", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(track.durationMs)}</span>
              </button>
            ))}
            {query.length >= 2 && results.length === 0 && !searching && (
              <p className={cn("text-xs text-center py-6", dark ? "text-slate-500" : "text-slate-400")}>Aucun résultat</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
