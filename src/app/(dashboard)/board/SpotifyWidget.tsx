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
  ListMusic,
  Compass,
  ChevronLeft,
  Clock,
  Shuffle,
  Smartphone,
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

interface Playlist {
  id: string;
  name: string;
  image: string;
  trackCount: number;
  owner: string;
  uri: string;
  description?: string;
}

interface PlayerState {
  playing: boolean;
  paused: boolean;
  trackName: string;
  artistName: string;
  albumImage: string;
  positionMs: number;
  durationMs: number;
  deviceName: string;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type Tab = "playing" | "search" | "playlists" | "browse";

export default function SpotifyWidget({ dark = false }: { dark?: boolean }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PlayerState | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("browse");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);

  const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  // Check connection
  useEffect(() => {
    fetch("/api/spotify/token")
      .then((r) => { setConnected(r.ok); })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  // Poll playback state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/state");
      if (res.ok) {
        const data = await res.json();
        if (data.trackName) {
          setState(data);
        } else {
          setState(null);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetchState();
    pollRef.current = setInterval(fetchState, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected, fetchState]);

  // Load playlists
  useEffect(() => {
    if (activeTab === "playlists" && playlists.length === 0 && !loadingPlaylists && connected) {
      setLoadingPlaylists(true);
      fetch("/api/spotify/playlists")
        .then((r) => r.json())
        .then((d) => setPlaylists(d.playlists || []))
        .catch(() => {})
        .finally(() => setLoadingPlaylists(false));
    }
  }, [activeTab, playlists.length, loadingPlaylists, connected]);

  // Load browse
  useEffect(() => {
    if (activeTab === "browse" && featuredPlaylists.length === 0 && recentTracks.length === 0 && !loadingBrowse && connected) {
      setLoadingBrowse(true);
      fetch("/api/spotify/browse")
        .then((r) => r.json())
        .then((d) => {
          setFeaturedPlaylists(d.featuredPlaylists || []);
          setRecentTracks(d.recentTracks || []);
        })
        .catch(() => {})
        .finally(() => setLoadingBrowse(false));
    }
  }, [activeTab, featuredPlaylists.length, recentTracks.length, loadingBrowse, connected]);

  async function control(action: string) {
    try {
      await fetch("/api/spotify/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchState, 300);
    } catch {}
  }

  async function playTrack(uri: string, contextUri?: string) {
    setPlayError(null);
    try {
      const res = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri, contextUri }),
      });
      if (!res.ok) {
        const data = await res.json();
        const err = typeof data.error === "string" ? data.error : "";
        if (err.includes("NO_DEVICE")) {
          setPlayError("Ouvrez Spotify sur un appareil d'abord");
        } else if (err.includes("PREMIUM_REQUIRED")) {
          setPlayError("Spotify Premium requis");
        } else {
          setPlayError("Erreur de lecture");
        }
        return;
      }
      setTimeout(fetchState, 500);
      setActiveTab("playing");
    } catch {
      setPlayError("Erreur de connexion");
    }
  }

  async function playPlaylist(playlist: Playlist) {
    setPlayError(null);
    try {
      const res = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextUri: playlist.uri }),
      });
      if (!res.ok) {
        const data = await res.json();
        const err = typeof data.error === "string" ? data.error : "";
        if (err.includes("NO_DEVICE")) {
          setPlayError("Ouvrez Spotify sur un appareil d'abord");
        } else {
          setPlayError("Erreur de lecture");
        }
        return;
      }
      setTimeout(fetchState, 500);
      setActiveTab("playing");
    } catch {
      setPlayError("Erreur de connexion");
    }
  }

  async function openPlaylist(playlist: Playlist) {
    setSelectedPlaylist(playlist);
    setLoadingPlaylistTracks(true);
    try {
      const res = await fetch(`/api/spotify/playlists?id=${playlist.id}`);
      const data = await res.json();
      setPlaylistTracks(data.tracks || []);
    } catch {
      setPlaylistTracks([]);
    }
    setLoadingPlaylistTracks(false);
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.tracks || []);
        }
      } catch {}
      setSearching(false);
    }, 400);
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
        <a href="/api/spotify/auth" className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors", dark ? "bg-green-600 hover:bg-green-500 text-white" : "bg-green-500 hover:bg-green-600 text-white")}>
          <LogIn className="h-3.5 w-3.5" />
          Connecter Spotify
        </a>
      </div>
    );
  }

  const progress = state ? (state.positionMs / state.durationMs) * 100 : 0;

  const tabs: { id: Tab; icon: typeof Music; label: string }[] = [
    { id: "playing", icon: Music, label: "Lecture" },
    { id: "browse", icon: Compass, label: "Explorer" },
    { id: "search", icon: Search, label: "Chercher" },
    { id: "playlists", icon: ListMusic, label: "Playlists" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mini player */}
      {state && activeTab !== "playing" && (
        <div className={cn("relative flex items-center gap-2.5 p-2 cursor-pointer shrink-0", dark ? "bg-slate-800/60" : "bg-slate-50")} onClick={() => setActiveTab("playing")}>
          {state.albumImage ? (
            <img src={state.albumImage} alt="" className="h-9 w-9 rounded-md object-cover shrink-0 shadow" />
          ) : (
            <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
              <Music className={cn("h-4 w-4", dark ? "text-slate-500" : "text-slate-400")} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={cn("text-[11px] font-medium truncate", dark ? "text-white" : "text-slate-800")}>{state.trackName}</p>
            <p className={cn("text-[9px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{state.artistName}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); control("previous"); }} className={cn("p-1 rounded-full", dark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-200 text-slate-500")}>
              <SkipBack className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); control(state.paused ? "resume" : "pause"); }} className={cn("p-1.5 rounded-full", dark ? "bg-green-600 text-white" : "bg-green-500 text-white")}>
              {state.paused ? <Play className="h-3 w-3 ml-0.5" /> : <Pause className="h-3 w-3" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); control("next"); }} className={cn("p-1 rounded-full", dark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-200 text-slate-500")}>
              <SkipForward className="h-3 w-3" />
            </button>
          </div>
          <div className={cn("absolute bottom-0 left-0 right-0 h-0.5", dark ? "bg-slate-700" : "bg-slate-200")}>
            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className={cn("flex border-b shrink-0", dark ? "border-slate-700" : "border-slate-200")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors",
              activeTab === tab.id
                ? (dark ? "text-green-400 border-b-2 border-green-400" : "text-green-600 border-b-2 border-green-500")
                : (dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"),
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {playError && (
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-red-500">{playError}</p>
          <button onClick={() => setPlayError(null)}><X className="h-3 w-3 text-red-400" /></button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "playing" && (
          state ? (
            <div className="flex flex-col items-center p-4 gap-3">
              {state.albumImage ? (
                <img src={state.albumImage} alt="" className="w-28 h-28 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className={cn("w-28 h-28 rounded-xl flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
                  <Music className={cn("h-10 w-10", dark ? "text-slate-500" : "text-slate-400")} />
                </div>
              )}
              <div className="text-center w-full">
                <p className={cn("text-sm font-semibold truncate", dark ? "text-white" : "text-slate-800")}>{state.trackName}</p>
                <p className={cn("text-xs truncate", dark ? "text-slate-400" : "text-slate-500")}>{state.artistName}</p>
              </div>
              <div className="w-full px-2">
                <div className={cn("w-full h-1.5 rounded-full overflow-hidden", dark ? "bg-slate-700" : "bg-slate-200")}>
                  <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={cn("text-[9px] tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(state.positionMs)}</span>
                  <span className={cn("text-[9px] tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(state.durationMs)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => control("previous")} className={cn("p-2 rounded-full", dark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")}>
                  <SkipBack className="h-5 w-5" />
                </button>
                <button onClick={() => control(state.paused ? "resume" : "pause")} className={cn("p-3.5 rounded-full", dark ? "bg-green-600 hover:bg-green-500 text-white" : "bg-green-500 hover:bg-green-600 text-white")}>
                  {state.paused ? <Play className="h-6 w-6 ml-0.5" /> : <Pause className="h-6 w-6" />}
                </button>
                <button onClick={() => control("next")} className={cn("p-2 rounded-full", dark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")}>
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>
              {state.deviceName && (
                <div className={cn("flex items-center gap-1.5 text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>
                  <Smartphone className="h-3 w-3" />
                  {state.deviceName}
                </div>
              )}
            </div>
          ) : (
            <div className={cn("flex flex-col items-center justify-center h-full gap-2 p-4", dark ? "text-slate-500" : "text-slate-400")}>
              <Music className="h-8 w-8 opacity-30" />
              <p className="text-xs">Aucune lecture en cours</p>
              <p className="text-[10px] opacity-60">Ouvrez Spotify sur un appareil puis lancez une musique ici</p>
            </div>
          )
        )}

        {activeTab === "search" && (
          <div className="flex flex-col h-full">
            <div className="p-2 shrink-0">
              <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", dark ? "bg-slate-700" : "bg-slate-100")}>
                <Search className={cn("h-3.5 w-3.5 shrink-0 text-slate-400")} />
                <input
                  type="text" value={query} onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Titre, artiste, playlist..."
                  autoFocus
                  className={cn("flex-1 bg-transparent text-sm outline-none", dark ? "text-white placeholder:text-slate-500" : "text-slate-800 placeholder:text-slate-400")}
                />
                {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />}
                {query && <button onClick={() => { setQuery(""); setSearchResults([]); }}><X className={cn("h-3.5 w-3.5", dark ? "text-slate-500" : "text-slate-400")} /></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchResults.map((track) => (
                <TrackRow key={track.id} track={track} dark={dark} onPlay={() => playTrack(track.uri)} />
              ))}
              {query.length >= 2 && searchResults.length === 0 && !searching && (
                <p className={cn("text-xs text-center py-6", dark ? "text-slate-500" : "text-slate-400")}>Aucun résultat</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "playlists" && (
          selectedPlaylist ? (
            <>
              <button
                onClick={() => { setSelectedPlaylist(null); setPlaylistTracks([]); }}
                className={cn("flex items-center gap-2 p-2.5 text-xs font-medium shrink-0 w-full border-b", dark ? "text-slate-300 border-slate-700 hover:bg-slate-800" : "text-slate-600 border-slate-200 hover:bg-slate-50")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Retour
              </button>
              <div className={cn("flex items-center gap-3 p-3", dark ? "bg-slate-800/40" : "bg-slate-50")}>
                {selectedPlaylist.image ? (
                  <img src={selectedPlaylist.image} alt="" className="h-12 w-12 rounded-lg object-cover shadow" />
                ) : (
                  <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
                    <ListMusic className="h-5 w-5 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", dark ? "text-white" : "text-slate-800")}>{selectedPlaylist.name}</p>
                  <p className={cn("text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>{selectedPlaylist.trackCount || playlistTracks.length} titres</p>
                </div>
                <button onClick={() => playPlaylist(selectedPlaylist)} className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 shrink-0">
                  <Play className="h-4 w-4 ml-0.5" />
                </button>
              </div>
              {loadingPlaylistTracks ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-green-500" /></div>
              ) : (
                playlistTracks.map((track) => (
                  <TrackRow key={track.id} track={track} dark={dark} onPlay={() => playTrack(track.uri, selectedPlaylist.uri)} />
                ))
              )}
            </>
          ) : (
            loadingPlaylists ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-green-500" /></div>
            ) : playlists.length === 0 ? (
              <p className={cn("text-xs text-center py-6", dark ? "text-slate-500" : "text-slate-400")}>Aucune playlist</p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => openPlaylist(pl)}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
                >
                  {pl.image ? (
                    <img src={pl.image} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className={cn("h-10 w-10 rounded flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                      <ListMusic className="h-4 w-4 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{pl.name}</p>
                    <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{pl.owner} · {pl.trackCount} titres</p>
                  </div>
                </button>
              ))
            )
          )
        )}

        {activeTab === "browse" && (
          loadingBrowse ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-green-500" /></div>
          ) : (
            <>
              {recentTracks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                    <Clock className={cn("h-3.5 w-3.5", dark ? "text-slate-500" : "text-slate-400")} />
                    <p className={cn("text-[10px] font-semibold uppercase tracking-wider", dark ? "text-slate-400" : "text-slate-500")}>Écoutés récemment</p>
                  </div>
                  {recentTracks.slice(0, 10).map((track, i) => (
                    <TrackRow key={`${track.id}-${i}`} track={track} dark={dark} onPlay={() => playTrack(track.uri)} />
                  ))}
                </div>
              )}
              {featuredPlaylists.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                    <Compass className={cn("h-3.5 w-3.5", dark ? "text-slate-500" : "text-slate-400")} />
                    <p className={cn("text-[10px] font-semibold uppercase tracking-wider", dark ? "text-slate-400" : "text-slate-500")}>Playlists populaires</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    {featuredPlaylists.slice(0, 8).map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => { setActiveTab("playlists"); openPlaylist({ ...pl, trackCount: 0, owner: "" }); }}
                        className={cn("flex items-center gap-2 rounded-lg p-2 text-left transition-colors", dark ? "bg-slate-800/50 hover:bg-slate-700/50" : "bg-slate-50 hover:bg-slate-100")}
                      >
                        {pl.image ? (
                          <img src={pl.image} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className={cn("h-10 w-10 rounded flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                            <ListMusic className="h-4 w-4 text-slate-500" />
                          </div>
                        )}
                        <p className={cn("text-[10px] font-medium line-clamp-2 leading-tight", dark ? "text-white" : "text-slate-800")}>{pl.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recentTracks.length === 0 && featuredPlaylists.length === 0 && (
                <div className={cn("flex flex-col items-center justify-center py-8 gap-2", dark ? "text-slate-500" : "text-slate-400")}>
                  <Compass className="h-6 w-6 opacity-30" />
                  <p className="text-xs">Aucune donnée pour le moment</p>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

function TrackRow({ track, dark, onPlay }: { track: Track; dark: boolean; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
    >
      <div className="relative shrink-0">
        {track.image ? (
          <img src={track.image} alt="" className="h-9 w-9 rounded object-cover" />
        ) : (
          <div className={cn("h-9 w-9 rounded flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
            <Music className="h-4 w-4 text-slate-500" />
          </div>
        )}
        <div className="absolute inset-0 rounded flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{track.name}</p>
        <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{track.artist}</p>
      </div>
      <span className={cn("text-[10px] shrink-0", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(track.durationMs)}</span>
    </button>
  );
}
