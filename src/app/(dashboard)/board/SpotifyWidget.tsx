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
  Home,
  Library,
  ChevronLeft,
  Smartphone,
  MonitorSpeaker,
  Shuffle,
  Repeat,
  Heart,
  MoreHorizontal,
  User,
  Disc3,
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

interface Artist {
  id: string;
  name: string;
  image: string;
  uri: string;
  genres?: string[];
}

interface Album {
  id: string;
  name: string;
  artist: string;
  image: string;
  uri: string;
  releaseDate?: string;
  totalTracks?: number;
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

interface BrowseData {
  recentTracks: Track[];
  topArtists: Artist[];
  topTracks: Track[];
  featuredPlaylists: Playlist[];
  newReleases: Album[];
  userPlaylists: Playlist[];
}

interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}

interface ArtistDetail {
  artist: Artist & { followers?: number };
  topTracks: Track[];
  albums: Album[];
  relatedArtists: Artist[];
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const SCROLL_HIDE = "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const GENRE_CARDS = [
  { name: "Pop", color: "#8C67AB", q: "genre:pop" },
  { name: "Rock", color: "#E13300", q: "genre:rock" },
  { name: "Hip-Hop", color: "#BA5D07", q: "genre:hip-hop" },
  { name: "Électro", color: "#DC148C", q: "genre:electronic" },
  { name: "Jazz", color: "#477D95", q: "genre:jazz" },
  { name: "Classique", color: "#7358FF", q: "genre:classical" },
  { name: "R&B", color: "#1E3264", q: "genre:r&b" },
  { name: "Chill", color: "#2D46B9", q: "genre:chill" },
  { name: "Français", color: "#148A08", q: "genre:french" },
  { name: "Ambient", color: "#537AA0", q: "genre:ambient" },
];

type Tab = "home" | "search" | "library" | "playing";
type DetailView = null | { type: "playlist"; data: Playlist } | { type: "artist"; data: Artist };

export interface SpotifyExternalCommand {
  uri?: string;
  action?: "play" | "pause" | "next" | "prev";
  ts: number;
}

export default function SpotifyWidget({ dark = false, externalCommand }: { dark?: boolean; externalCommand?: SpotifyExternalCommand }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sdkPlayer, setSdkPlayer] = useState<SpotifyPlayer | null>(null);
  const [sdkDeviceId, setSdkDeviceId] = useState<string | null>(null);
  const [sdkState, setSdkState] = useState<PlayerState | null>(null);
  const sdkLoaded = useRef(false);

  const [apiState, setApiState] = useState<PlayerState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const state = sdkState || apiState;
  const usesSdk = !!sdkDeviceId;

  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({ tracks: [], artists: [], albums: [], playlists: [] });
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const [browseData, setBrowseData] = useState<BrowseData | null>(null);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const [detailView, setDetailView] = useState<DetailView>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [artistDetail, setArtistDetail] = useState<ArtistDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const progressInterval = useRef<ReturnType<typeof setInterval>>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [likedTrack, setLikedTrack] = useState(false);

  // Check connection
  useEffect(() => {
    fetch("/api/spotify/token")
      .then((r) => { setConnected(r.ok); })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  // SDK init — try on any page, let it fail gracefully if not secure context
  useEffect(() => {
    if (!connected || sdkLoaded.current) return;
    sdkLoaded.current = true;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => { sdkLoaded.current = false; };
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
        const deviceId = (data as { device_id: string }).device_id;
        setSdkDeviceId(deviceId);
        // Transfer playback to this browser tab
        fetch("/api/spotify/token")
          .then(r => r.json())
          .then(d => {
            fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: { Authorization: `Bearer ${d.token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ device_ids: [deviceId], play: false }),
            }).catch(() => {});
          })
          .catch(() => {});
      });

      p.addListener("player_state_changed", (s) => {
        if (!s) { setSdkState(null); return; }
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
        setSdkState({
          playing: !st.paused,
          paused: st.paused,
          trackName: st.track_window.current_track.name,
          artistName: st.track_window.current_track.artists.map((a) => a.name).join(", "),
          albumImage: st.track_window.current_track.album.images[0]?.url || "",
          positionMs: st.position,
          durationMs: st.duration,
          deviceName: "Comet Board",
        });
        if (!st.paused) setActiveTab("playing");
      });

      p.connect();
      setSdkPlayer(p);
    };

    return () => { script.remove(); };
  }, [connected]);

  // SDK progress ticker
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (sdkState && !sdkState.paused) {
      progressInterval.current = setInterval(() => {
        setSdkState((prev) =>
          prev && !prev.paused
            ? { ...prev, positionMs: Math.min(prev.positionMs + 500, prev.durationMs) }
            : prev,
        );
      }, 500);
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
  }, [sdkState?.paused]);

  // API polling (when no SDK)
  const fetchApiState = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/state");
      if (res.ok) {
        const data = await res.json();
        if (data.trackName) setApiState(data);
        else setApiState(null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!connected || usesSdk) return;
    fetchApiState();
    pollRef.current = setInterval(fetchApiState, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected, usesSdk, fetchApiState]);

  // Load browse data
  useEffect(() => {
    if (connected && !browseData && !loadingBrowse) {
      setLoadingBrowse(true);
      fetch("/api/spotify/browse")
        .then((r) => r.json())
        .then((d) => setBrowseData({
          recentTracks: d.recentTracks || [],
          topArtists: d.topArtists || [],
          topTracks: d.topTracks || [],
          featuredPlaylists: d.featuredPlaylists || [],
          newReleases: d.newReleases || [],
          userPlaylists: d.userPlaylists || [],
        }))
        .catch(() => {})
        .finally(() => setLoadingBrowse(false));
    }
  }, [connected, browseData, loadingBrowse]);

  // Load playlists for library
  useEffect(() => {
    if (activeTab === "library" && playlists.length === 0 && !loadingPlaylists && connected) {
      setLoadingPlaylists(true);
      fetch("/api/spotify/playlists")
        .then((r) => r.json())
        .then((d) => setPlaylists(d.playlists || []))
        .catch(() => {})
        .finally(() => setLoadingPlaylists(false));
    }
  }, [activeTab, playlists.length, loadingPlaylists, connected]);

  // External commands from remote control
  const lastExtCmdTs = useRef(0);
  useEffect(() => {
    if (!externalCommand || externalCommand.ts <= lastExtCmdTs.current) return;
    lastExtCmdTs.current = externalCommand.ts;
    if (externalCommand.uri) {
      playTrack(externalCommand.uri);
    } else if (externalCommand.action) {
      const actionMap: Record<string, string> = { play: "resume", pause: "pause", next: "next", prev: "previous" };
      doControl(actionMap[externalCommand.action] || externalCommand.action);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCommand]);

  // Controls
  async function doControl(action: string) {
    if (usesSdk && sdkPlayer) {
      if (action === "pause" || action === "resume") await sdkPlayer.togglePlay();
      else if (action === "next") await sdkPlayer.nextTrack();
      else if (action === "previous") await sdkPlayer.previousTrack();
    } else {
      await fetch("/api/spotify/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchApiState, 300);
    }
  }

  async function playTrack(uri: string, contextUri?: string) {
    setPlayError(null);
    try {
      const body: Record<string, string> = { uri };
      if (contextUri) body.contextUri = contextUri;
      if (sdkDeviceId) body.deviceId = sdkDeviceId;

      const res = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        const err = typeof data.error === "string" ? data.error : "";
        if (err.includes("NO_DEVICE")) setPlayError("Ouvrez Spotify sur un appareil d'abord");
        else if (err.includes("PREMIUM_REQUIRED")) setPlayError("Spotify Premium requis");
        else setPlayError("Erreur de lecture");
        return;
      }
      if (!usesSdk) setTimeout(fetchApiState, 500);
      setActiveTab("playing");
    } catch {
      setPlayError("Erreur de connexion");
    }
  }

  async function playContext(contextUri: string) {
    setPlayError(null);
    try {
      const body: Record<string, string> = { contextUri };
      if (sdkDeviceId) body.deviceId = sdkDeviceId;

      const res = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        const err = typeof data.error === "string" ? data.error : "";
        if (err.includes("NO_DEVICE")) setPlayError("Ouvrez Spotify sur un appareil d'abord");
        else setPlayError("Erreur de lecture");
        return;
      }
      if (!usesSdk) setTimeout(fetchApiState, 500);
      setActiveTab("playing");
    } catch {
      setPlayError("Erreur de connexion");
    }
  }

  function openPlaylist(playlist: Playlist) {
    setDetailView({ type: "playlist", data: playlist });
    setPlaylistTracks([]);
    setArtistDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
    fetch(`/api/spotify/playlists?id=${playlist.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setDetailError(data.error);
        else setPlaylistTracks(data.tracks || []);
      })
      .catch(() => setDetailError("Impossible de charger les titres"))
      .finally(() => setLoadingDetail(false));
  }

  function openArtist(artist: Artist) {
    setDetailView({ type: "artist", data: artist });
    setPlaylistTracks([]);
    setArtistDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
    fetch(`/api/spotify/artists?id=${artist.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setDetailError(data.error);
        else setArtistDetail(data);
      })
      .catch(() => setDetailError("Impossible de charger l'artiste"))
      .finally(() => setLoadingDetail(false));
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) {
      setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
      setHasSearched(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults({
            tracks: data.tracks || [],
            artists: data.artists || [],
            albums: data.albums || [],
            playlists: data.playlists || [],
          });
          setHasSearched(true);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 400);
  }

  function searchGenre(q: string) {
    setQuery(q);
    handleSearch(q);
  }

  function toggleMute() {
    if (muted) { sdkPlayer?.setVolume(volume); setMuted(false); }
    else { sdkPlayer?.setVolume(0); setMuted(true); }
  }

  function handleVolume(v: number) {
    setVolume(v); setMuted(false); sdkPlayer?.setVolume(v);
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
      <div className={cn(
        "flex flex-col items-center justify-center h-full gap-4 p-6",
        dark ? "text-slate-400" : "text-slate-500",
      )}>
        <div className={cn("p-4 rounded-full", dark ? "bg-slate-800" : "bg-slate-100")}>
          <Music className="h-8 w-8 opacity-40" />
        </div>
        <div className="text-center">
          <p className={cn("text-sm font-medium mb-1", dark ? "text-slate-300" : "text-slate-600")}>Spotify</p>
          <p className="text-xs opacity-70">Connectez votre compte pour écouter de la musique</p>
        </div>
        <a
          href="/api/spotify/auth"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all hover:scale-105"
        >
          <LogIn className="h-3.5 w-3.5" />
          Se connecter à Spotify
        </a>
      </div>
    );
  }

  const progress = state ? (state.positionMs / state.durationMs) * 100 : 0;

  // Deduplicated recent items for quick access grid
  const quickAccess = browseData
    ? deduplicateByKey(browseData.recentTracks, "name").slice(0, 6)
    : [];

  const tabs: { id: Tab; icon: typeof Music; label: string }[] = [
    { id: "home", icon: Home, label: "Accueil" },
    { id: "search", icon: Search, label: "Recherche" },
    { id: "library", icon: Library, label: "Biblio" },
    { id: "playing", icon: Music, label: "Lecture" },
  ];

  // Detail view (playlist)
  if (detailView) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Back header */}
        <button
          onClick={() => { setDetailView(null); setPlaylistTracks([]); setArtistDetail(null); }}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 text-xs font-medium shrink-0 border-b transition-colors",
            dark ? "text-slate-300 border-slate-700/50 hover:bg-slate-800/50" : "text-slate-600 border-slate-200 hover:bg-slate-50",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Retour
        </button>

        {/* Detail header */}
        <div className={cn("relative shrink-0 overflow-hidden", dark ? "bg-slate-800/30" : "bg-slate-50")}>
          {detailView.type === "playlist" && (
            <div className="flex items-end gap-3 p-4">
              {detailView.data.image ? (
                <img src={detailView.data.image} alt="" className="h-20 w-20 rounded-lg object-cover shadow-lg shrink-0" />
              ) : (
                <div className={cn("h-20 w-20 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                  <ListMusic className="h-8 w-8 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0 pb-0.5">
                <p className={cn("text-sm font-bold truncate", dark ? "text-white" : "text-slate-800")}>{detailView.data.name}</p>
                <p className={cn("text-[10px] mt-0.5", dark ? "text-slate-400" : "text-slate-500")}>
                  {detailView.data.owner && `${detailView.data.owner} · `}
                  {playlistTracks.length || detailView.data.trackCount} titres
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => playContext(detailView.data.uri)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-[11px] font-bold transition-all hover:scale-105"
                  >
                    <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />
                    Lecture
                  </button>
                  <button
                    onClick={() => playContext(detailView.data.uri)}
                    className={cn("p-1.5 rounded-full transition-colors", dark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-200 text-slate-500")}
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          {detailView.type === "artist" && (
            <div className="flex items-end gap-3 p-4">
              {detailView.data.image ? (
                <img src={detailView.data.image} alt="" className="h-20 w-20 rounded-full object-cover shadow-lg shrink-0" />
              ) : (
                <div className={cn("h-20 w-20 rounded-full flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                  <User className="h-8 w-8 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0 pb-0.5">
                <p className={cn("text-sm font-bold", dark ? "text-white" : "text-slate-800")}>{detailView.data.name}</p>
                {detailView.data.genres && detailView.data.genres.length > 0 && (
                  <p className={cn("text-[10px] mt-0.5 capitalize", dark ? "text-slate-400" : "text-slate-500")}>
                    {detailView.data.genres.join(" · ")}
                  </p>
                )}
                <button
                  onClick={() => playContext(detailView.data.uri)}
                  className="flex items-center gap-1.5 px-4 py-1.5 mt-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-[11px] font-bold transition-all hover:scale-105"
                >
                  <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />
                  Lecture aléatoire
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
            </div>
          ) : detailError ? (
            <div className={cn("text-xs text-center py-6 px-4", dark ? "text-red-400" : "text-red-500")}>
              {detailError}
              {detailError.includes("403") && (
                <p className={cn("text-[10px] mt-1", dark ? "text-slate-500" : "text-slate-400")}>
                  Spotify bloque l&apos;accès en mode développement pour cette playlist
                </p>
              )}
            </div>
          ) : detailView.type === "playlist" ? (
            playlistTracks.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-8 px-6 text-center">
                <div className={cn("p-3 rounded-full", dark ? "bg-slate-800" : "bg-slate-100")}>
                  <ListMusic className={cn("h-8 w-8", dark ? "text-slate-500" : "text-slate-400")} />
                </div>
                <div>
                  <p className={cn("text-xs font-medium mb-1", dark ? "text-slate-300" : "text-slate-600")}>
                    {detailView.data.trackCount
                      ? `${detailView.data.trackCount} titres dans cette playlist`
                      : "Playlist disponible"}
                  </p>
                  <p className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>
                    Le détail des titres n&apos;est pas disponible en mode développement Spotify
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => playContext(detailView.data.uri)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold transition-all hover:scale-105"
                  >
                    <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
                    Lancer la lecture
                  </button>
                  <button
                    onClick={() => playContext(detailView.data.uri)}
                    className={cn("p-2.5 rounded-full transition-colors", dark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600")}
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              playlistTracks.map((track, i) => (
                <TrackRow
                  key={`${track.id}-${i}`}
                  track={track}
                  index={i + 1}
                  dark={dark}
                  onPlay={() => playTrack(track.uri, detailView.data.uri)}
                />
              ))
            )
          ) : detailView.type === "artist" && artistDetail ? (
            <div className="pb-3">
              {/* Top Tracks */}
              {artistDetail.topTracks.length > 0 && (
                <div className="mb-2">
                  <SectionTitle dark={dark}>Titres populaires</SectionTitle>
                  {artistDetail.topTracks.map((track, i) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      index={i + 1}
                      dark={dark}
                      onPlay={() => playTrack(track.uri)}
                    />
                  ))}
                </div>
              )}

              {/* Albums */}
              {artistDetail.albums.length > 0 && (
                <div className="mb-2">
                  <SectionTitle dark={dark}>Discographie</SectionTitle>
                  <div className={cn("flex gap-2.5 px-3 pb-1", SCROLL_HIDE)}>
                    {artistDetail.albums.map((album) => (
                      <AlbumCard key={album.id} album={album} dark={dark} onPlay={() => playContext(album.uri)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Related Artists */}
              {artistDetail.relatedArtists.length > 0 && (
                <div className="mb-2">
                  <SectionTitle dark={dark}>Artistes similaires</SectionTitle>
                  <div className={cn("flex gap-3 px-3 pb-1", SCROLL_HIDE)}>
                    {artistDetail.relatedArtists.map((ra) => (
                      <button
                        key={ra.id}
                        onClick={() => openArtist(ra)}
                        className="flex flex-col items-center gap-1.5 shrink-0 group w-[72px]"
                      >
                        {ra.image ? (
                          <img src={ra.image} alt="" className="h-[72px] w-[72px] rounded-full object-cover shadow-md" />
                        ) : (
                          <div className={cn("h-[72px] w-[72px] rounded-full flex items-center justify-center shadow-md", dark ? "bg-slate-700" : "bg-slate-200")}>
                            <User className="h-6 w-6 text-slate-500" />
                          </div>
                        )}
                        <p className={cn("text-[10px] font-medium text-center line-clamp-2 leading-tight w-full", dark ? "text-slate-300" : "text-slate-700")}>{ra.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty artist */}
              {!artistDetail.topTracks.length && !artistDetail.albums.length && (
                <p className={cn("text-xs text-center py-8", dark ? "text-slate-500" : "text-slate-400")}>
                  Aucune donnée disponible pour cet artiste
                </p>
              )}
            </div>
          ) : detailView.type === "artist" ? (
            <p className={cn("text-xs text-center py-8", dark ? "text-slate-500" : "text-slate-400")}>
              Aucune donnée disponible
            </p>
          ) : null}
        </div>

        {/* Mini player in detail */}
        {state && <MiniBar state={state} progress={progress} dark={dark} onPlay={() => doControl(state.paused ? "resume" : "pause")} onTab={() => { setDetailView(null); setActiveTab("playing"); }} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mini player bar (when not on playing tab) */}
      {state && activeTab !== "playing" && (
        <MiniBar state={state} progress={progress} dark={dark} onPlay={() => doControl(state.paused ? "resume" : "pause")} onTab={() => setActiveTab("playing")} />
      )}

      {/* Tab bar */}
      <div className={cn("flex border-b shrink-0", dark ? "border-slate-700/50" : "border-slate-200")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors",
              activeTab === tab.id
                ? (dark ? "text-[#1DB954] border-b-2 border-[#1DB954]" : "text-[#1DB954] border-b-2 border-[#1DB954]")
                : (dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"),
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
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

        {/* ── HOME ─────────────────────────────────────────── */}
        {activeTab === "home" && (
          loadingBrowse ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
            </div>
          ) : (
            <div className="pb-3">
              {/* Greeting */}
              <div className="px-4 pt-4 pb-2">
                <h2 className={cn("text-base font-bold", dark ? "text-white" : "text-slate-800")}>{getGreeting()}</h2>
              </div>

              {/* Quick access grid */}
              {quickAccess.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                  {quickAccess.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => playTrack(track.uri)}
                      className={cn(
                        "flex items-center gap-2 rounded-md overflow-hidden text-left transition-all group",
                        dark ? "bg-slate-800/60 hover:bg-slate-700/60" : "bg-slate-100 hover:bg-slate-200/80",
                      )}
                    >
                      {track.image ? (
                        <img src={track.image} alt="" className="h-10 w-10 object-cover shrink-0" />
                      ) : (
                        <div className={cn("h-10 w-10 flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-300")}>
                          <Music className="h-4 w-4 text-slate-500" />
                        </div>
                      )}
                      <p className={cn("text-[10px] font-semibold truncate pr-2 flex-1", dark ? "text-white" : "text-slate-800")}>{track.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Top Artists */}
              {browseData && browseData.topArtists.length > 0 && (
                <div className="mb-3">
                  <SectionTitle dark={dark}>Vos artistes préférés</SectionTitle>
                  <div className={cn("flex gap-3 px-3 pb-1", SCROLL_HIDE)}>
                    {browseData.topArtists.slice(0, 12).map((artist) => (
                      <button
                        key={artist.id}
                        onClick={() => openArtist(artist)}
                        className="flex flex-col items-center gap-1.5 shrink-0 group w-[72px]"
                      >
                        <div className="relative">
                          {artist.image ? (
                            <img src={artist.image} alt="" className="h-[72px] w-[72px] rounded-full object-cover shadow-md" />
                          ) : (
                            <div className={cn("h-[72px] w-[72px] rounded-full flex items-center justify-center shadow-md", dark ? "bg-slate-700" : "bg-slate-200")}>
                              <User className="h-6 w-6 text-slate-500" />
                            </div>
                          )}
                          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-5 w-5 text-white" fill="white" />
                          </div>
                        </div>
                        <p className={cn("text-[10px] font-medium text-center line-clamp-2 leading-tight w-full", dark ? "text-slate-300" : "text-slate-700")}>{artist.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Tracks */}
              {browseData && browseData.topTracks.length > 0 && (
                <div className="mb-3">
                  <SectionTitle dark={dark}>Vos titres du moment</SectionTitle>
                  {browseData.topTracks.slice(0, 5).map((track, i) => (
                    <TrackRow key={track.id} track={track} index={i + 1} dark={dark} onPlay={() => playTrack(track.uri)} />
                  ))}
                </div>
              )}

              {/* New Releases */}
              {browseData && browseData.newReleases.length > 0 && (
                <div className="mb-3">
                  <SectionTitle dark={dark}>Nouveautés</SectionTitle>
                  <div className={cn("flex gap-2.5 px-3 pb-1", SCROLL_HIDE)}>
                    {browseData.newReleases.slice(0, 12).map((album) => (
                      <AlbumCard key={album.id} album={album} dark={dark} onPlay={() => playContext(album.uri)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Featured Playlists */}
              {browseData && browseData.featuredPlaylists.length > 0 && (
                <div className="mb-3">
                  <SectionTitle dark={dark}>Playlists populaires</SectionTitle>
                  <div className={cn("flex gap-2.5 px-3 pb-1", SCROLL_HIDE)}>
                    {browseData.featuredPlaylists.slice(0, 12).map((pl) => (
                      <PlaylistCard key={pl.id} playlist={pl} dark={dark} onOpen={() => openPlaylist(pl)} onPlay={() => playContext(pl.uri)} />
                    ))}
                  </div>
                </div>
              )}

              {/* User Playlists */}
              {browseData && browseData.userPlaylists.length > 0 && (
                <div className="mb-3">
                  <SectionTitle dark={dark}>Vos playlists</SectionTitle>
                  <div className={cn("flex gap-2.5 px-3 pb-1", SCROLL_HIDE)}>
                    {browseData.userPlaylists.slice(0, 12).map((pl) => (
                      <PlaylistCard key={pl.id} playlist={pl} dark={dark} onOpen={() => openPlaylist(pl)} onPlay={() => playContext(pl.uri)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {browseData && !browseData.recentTracks.length && !browseData.topArtists.length && !browseData.topTracks.length && (
                <div className={cn("flex flex-col items-center justify-center py-8 gap-2", dark ? "text-slate-500" : "text-slate-400")}>
                  <Music className="h-6 w-6 opacity-30" />
                  <p className="text-xs">Écoutez de la musique pour voir vos recommandations</p>
                </div>
              )}
            </div>
          )
        )}

        {/* ── SEARCH ───────────────────────────────────────── */}
        {activeTab === "search" && (
          <div className="flex flex-col h-full">
            <div className="p-3 shrink-0">
              <div className={cn("flex items-center gap-2 rounded-full px-3.5 py-2", dark ? "bg-slate-700/80" : "bg-slate-100")}>
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Artistes, titres ou podcasts"
                  autoFocus
                  className={cn("flex-1 bg-transparent text-sm outline-none", dark ? "text-white placeholder:text-slate-500" : "text-slate-800 placeholder:text-slate-400")}
                />
                {searching && <Loader2 className="h-4 w-4 animate-spin text-[#1DB954]" />}
                {query && (
                  <button onClick={() => { setQuery(""); setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] }); setHasSearched(false); }}>
                    <X className={cn("h-4 w-4", dark ? "text-slate-500" : "text-slate-400")} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!hasSearched ? (
                <>
                  <SectionTitle dark={dark}>Explorer les genres</SectionTitle>
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    {GENRE_CARDS.map((g) => (
                      <button
                        key={g.name}
                        onClick={() => searchGenre(g.q)}
                        className="relative h-16 rounded-lg overflow-hidden text-left transition-transform hover:scale-[1.02]"
                        style={{ backgroundColor: g.color }}
                      >
                        <p className="absolute top-2.5 left-3 text-xs font-bold text-white drop-shadow">{g.name}</p>
                        <Music className="absolute bottom-1 right-1 h-8 w-8 text-white/20 rotate-12" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Top result (first artist or track) */}
                  {(searchResults.artists.length > 0 || searchResults.tracks.length > 0) && (
                    <div className="px-3 pb-2">
                      <p className={cn("text-xs font-bold mb-2", dark ? "text-white" : "text-slate-800")}>Meilleur résultat</p>
                      {searchResults.artists.length > 0 ? (
                        <button
                          onClick={() => playContext(searchResults.artists[0].uri)}
                          className={cn(
                            "w-full p-3 rounded-lg text-left transition-colors group",
                            dark ? "bg-slate-800/60 hover:bg-slate-700/60" : "bg-slate-50 hover:bg-slate-100",
                          )}
                        >
                          <div className="relative w-fit">
                            {searchResults.artists[0].image ? (
                              <img src={searchResults.artists[0].image} alt="" className="h-16 w-16 rounded-full object-cover shadow" />
                            ) : (
                              <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
                                <User className="h-6 w-6 text-slate-500" />
                              </div>
                            )}
                          </div>
                          <p className={cn("text-sm font-bold mt-2", dark ? "text-white" : "text-slate-800")}>{searchResults.artists[0].name}</p>
                          <p className={cn("text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>Artiste</p>
                          <div className="absolute bottom-3 right-3 p-2.5 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 shadow-lg">
                            <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
                          </div>
                        </button>
                      ) : searchResults.tracks.length > 0 && (
                        <button
                          onClick={() => playTrack(searchResults.tracks[0].uri)}
                          className={cn(
                            "w-full p-3 rounded-lg text-left transition-colors group",
                            dark ? "bg-slate-800/60 hover:bg-slate-700/60" : "bg-slate-50 hover:bg-slate-100",
                          )}
                        >
                          {searchResults.tracks[0].image ? (
                            <img src={searchResults.tracks[0].image} alt="" className="h-16 w-16 rounded-md object-cover shadow" />
                          ) : (
                            <div className={cn("h-16 w-16 rounded-md flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
                              <Music className="h-6 w-6 text-slate-500" />
                            </div>
                          )}
                          <p className={cn("text-sm font-bold mt-2", dark ? "text-white" : "text-slate-800")}>{searchResults.tracks[0].name}</p>
                          <p className={cn("text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>{searchResults.tracks[0].artist} · Titre</p>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Tracks */}
                  {searchResults.tracks.length > 0 && (
                    <div className="mb-2">
                      <SectionTitle dark={dark}>Titres</SectionTitle>
                      {searchResults.tracks.slice(0, 4).map((track) => (
                        <TrackRow key={track.id} track={track} dark={dark} onPlay={() => playTrack(track.uri)} />
                      ))}
                    </div>
                  )}

                  {/* Artists */}
                  {searchResults.artists.length > 1 && (
                    <div className="mb-2">
                      <SectionTitle dark={dark}>Artistes</SectionTitle>
                      {searchResults.artists.slice(1, 5).map((artist) => (
                        <button
                          key={artist.id}
                          onClick={() => playContext(artist.uri)}
                          className={cn("w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
                        >
                          {artist.image ? (
                            <img src={artist.image} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                              <User className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{artist.name}</p>
                            <p className={cn("text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>Artiste</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Albums */}
                  {searchResults.albums.length > 0 && (
                    <div className="mb-2">
                      <SectionTitle dark={dark}>Albums</SectionTitle>
                      {searchResults.albums.slice(0, 4).map((album) => (
                        <button
                          key={album.id}
                          onClick={() => playContext(album.uri)}
                          className={cn("w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
                        >
                          {album.image ? (
                            <img src={album.image} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                          ) : (
                            <div className={cn("h-10 w-10 rounded flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                              <Disc3 className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{album.name}</p>
                            <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{album.artist} · Album</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Playlists */}
                  {searchResults.playlists.length > 0 && (
                    <div className="mb-2">
                      <SectionTitle dark={dark}>Playlists</SectionTitle>
                      {searchResults.playlists.slice(0, 4).map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => openPlaylist(pl)}
                          className={cn("w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
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
                            <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{pl.owner ? `${pl.owner} · ` : ""}Playlist</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {hasSearched && !searchResults.tracks.length && !searchResults.artists.length && !searchResults.albums.length && !searchResults.playlists.length && (
                    <p className={cn("text-xs text-center py-8", dark ? "text-slate-500" : "text-slate-400")}>
                      Aucun résultat pour &quot;{query}&quot;
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── LIBRARY ──────────────────────────────────────── */}
        {activeTab === "library" && (
          loadingPlaylists ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
            </div>
          ) : (
            <div>
              <div className="px-4 pt-3 pb-2">
                <h2 className={cn("text-base font-bold", dark ? "text-white" : "text-slate-800")}>Votre bibliothèque</h2>
              </div>

              {/* Liked songs shortcut */}
              <button
                onClick={() => playContext("spotify:collection:tracks")}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
              >
                <div className="h-12 w-12 rounded-md bg-gradient-to-br from-indigo-400 to-blue-600 flex items-center justify-center shrink-0 shadow">
                  <Heart className="h-5 w-5 text-white" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold", dark ? "text-white" : "text-slate-800")}>Titres likés</p>
                  <p className={cn("text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>Playlist</p>
                </div>
              </button>

              {/* Playlists */}
              {playlists.length === 0 ? (
                <p className={cn("text-xs text-center py-6", dark ? "text-slate-500" : "text-slate-400")}>Aucune playlist</p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => openPlaylist(pl)}
                    className={cn("w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
                  >
                    {pl.image ? (
                      <img src={pl.image} alt="" className="h-12 w-12 rounded-md object-cover shrink-0 shadow-sm" />
                    ) : (
                      <div className={cn("h-12 w-12 rounded-md flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
                        <ListMusic className="h-5 w-5 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{pl.name}</p>
                      <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>
                        Playlist · {pl.owner}{pl.trackCount ? ` · ${pl.trackCount} titres` : ""}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )
        )}

        {/* ── NOW PLAYING ──────────────────────────────────── */}
        {activeTab === "playing" && (
          state ? (
            <div className="flex flex-col items-center p-4 gap-3">
              {/* Album art */}
              <div className="relative group">
                {state.albumImage ? (
                  <img src={state.albumImage} alt="" className="w-36 h-36 rounded-xl object-cover shadow-2xl" />
                ) : (
                  <div className={cn("w-36 h-36 rounded-xl flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
                    <Music className={cn("h-12 w-12", dark ? "text-slate-500" : "text-slate-400")} />
                  </div>
                )}
              </div>

              {/* Track info */}
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-2">
                  <p className={cn("text-sm font-bold truncate", dark ? "text-white" : "text-slate-800")}>{state.trackName}</p>
                </div>
                <p className={cn("text-xs truncate", dark ? "text-slate-400" : "text-slate-500")}>{state.artistName}</p>
              </div>

              {/* Like button */}
              <button
                onClick={() => setLikedTrack(!likedTrack)}
                className="p-1"
              >
                <Heart className={cn("h-4 w-4 transition-colors", likedTrack ? "text-[#1DB954] fill-[#1DB954]" : (dark ? "text-slate-500" : "text-slate-400"))} />
              </button>

              {/* Progress bar */}
              <div className="w-full px-2">
                <div className={cn("w-full h-1 rounded-full overflow-hidden cursor-pointer group", dark ? "bg-slate-700" : "bg-slate-200")}>
                  <div className="h-full rounded-full bg-[#1DB954] group-hover:bg-[#1ed760] transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={cn("text-[9px] tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(state.positionMs)}</span>
                  <span className={cn("text-[9px] tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(state.durationMs)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button className={cn("p-1.5", dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}>
                  <Shuffle className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => doControl("previous")} className={cn("p-2 rounded-full transition-colors", dark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")}>
                  <SkipBack className="h-5 w-5" fill="currentColor" />
                </button>
                <button
                  onClick={() => doControl(state.paused ? "resume" : "pause")}
                  className="p-3.5 rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg"
                >
                  {state.paused ? <Play className="h-6 w-6 ml-0.5" fill="currentColor" /> : <Pause className="h-6 w-6" fill="currentColor" />}
                </button>
                <button onClick={() => doControl("next")} className={cn("p-2 rounded-full transition-colors", dark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")}>
                  <SkipForward className="h-5 w-5" fill="currentColor" />
                </button>
                <button className={cn("p-1.5", dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}>
                  <Repeat className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Volume (SDK only) */}
              {usesSdk && (
                <div className="flex items-center gap-2 w-full max-w-[200px]">
                  <button onClick={toggleMute} className={cn("p-1", dark ? "text-slate-500" : "text-slate-400")}>
                    {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => handleVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-[#1DB954] rounded-full"
                  />
                </div>
              )}

              {/* Device */}
              <div className={cn("flex items-center gap-1.5 text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>
                {usesSdk ? <MonitorSpeaker className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                {state.deviceName || (usesSdk ? "Comet Board" : "Appareil externe")}
              </div>
            </div>
          ) : (
            <div className={cn("flex flex-col items-center justify-center h-full gap-3 p-6", dark ? "text-slate-500" : "text-slate-400")}>
              <div className={cn("p-4 rounded-full", dark ? "bg-slate-800" : "bg-slate-100")}>
                <Music className="h-8 w-8 opacity-30" />
              </div>
              <p className="text-xs font-medium">Aucune lecture en cours</p>
              <p className="text-[10px] opacity-60 text-center">
                {usesSdk ? "Lancez une musique depuis l'onglet Accueil ou Recherche" : "Ouvrez Spotify sur un appareil puis lancez une musique"}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function MiniBar({ state, progress, dark, onPlay, onTab }: {
  state: PlayerState;
  progress: number;
  dark: boolean;
  onPlay: () => void;
  onTab: () => void;
}) {
  return (
    <div className={cn("relative flex items-center gap-2.5 p-2 cursor-pointer shrink-0", dark ? "bg-slate-800/60" : "bg-slate-50")} onClick={onTab}>
      {state.albumImage ? (
        <img src={state.albumImage} alt="" className="h-10 w-10 rounded-md object-cover shrink-0 shadow" />
      ) : (
        <div className={cn("h-10 w-10 rounded-md flex items-center justify-center shrink-0", dark ? "bg-slate-700" : "bg-slate-200")}>
          <Music className={cn("h-4 w-4", dark ? "text-slate-500" : "text-slate-400")} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("text-[11px] font-semibold truncate", dark ? "text-white" : "text-slate-800")}>{state.trackName}</p>
        <p className={cn("text-[9px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{state.artistName}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="p-2 rounded-full bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
        >
          {state.paused ? <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" /> : <Pause className="h-3.5 w-3.5" fill="currentColor" />}
        </button>
      </div>
      <div className={cn("absolute bottom-0 left-0 right-0 h-0.5", dark ? "bg-slate-700/50" : "bg-slate-200")}>
        <div className="h-full bg-[#1DB954] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function SectionTitle({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  return (
    <p className={cn("text-xs font-bold px-3 pt-3 pb-2", dark ? "text-white" : "text-slate-800")}>{children}</p>
  );
}

function TrackRow({ track, dark, onPlay, index }: { track: Track; dark: boolean; onPlay: () => void; index?: number }) {
  return (
    <button
      onClick={onPlay}
      className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors group", dark ? "hover:bg-slate-700/50" : "hover:bg-slate-50")}
    >
      {index !== undefined && (
        <span className={cn("text-[10px] w-4 text-right shrink-0 tabular-nums group-hover:hidden", dark ? "text-slate-500" : "text-slate-400")}>{index}</span>
      )}
      {index !== undefined && (
        <Play className={cn("h-3 w-3 shrink-0 hidden group-hover:block", dark ? "text-white" : "text-slate-800")} fill="currentColor" />
      )}
      <div className="relative shrink-0">
        {track.image ? (
          <img src={track.image} alt="" className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className={cn("h-10 w-10 rounded flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
            <Music className="h-4 w-4 text-slate-500" />
          </div>
        )}
        {index === undefined && (
          <div className="absolute inset-0 rounded flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-4 w-4 text-white" fill="white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-800")}>{track.name}</p>
        <p className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{track.artist}</p>
      </div>
      <span className={cn("text-[10px] shrink-0 tabular-nums", dark ? "text-slate-600" : "text-slate-400")}>{formatMs(track.durationMs)}</span>
    </button>
  );
}

function AlbumCard({ album, dark, onPlay }: { album: Album; dark: boolean; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className={cn("flex flex-col shrink-0 w-[120px] p-2 rounded-lg transition-colors group", dark ? "hover:bg-slate-800/60" : "hover:bg-slate-50")}
    >
      <div className="relative mb-2">
        {album.image ? (
          <img src={album.image} alt="" className="w-[104px] h-[104px] rounded-md object-cover shadow-md" />
        ) : (
          <div className={cn("w-[104px] h-[104px] rounded-md flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
            <Disc3 className="h-8 w-8 text-slate-500" />
          </div>
        )}
        <div className="absolute bottom-1.5 right-1.5 p-2 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 shadow-lg">
          <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />
        </div>
      </div>
      <p className={cn("text-[10px] font-semibold line-clamp-1 w-full text-left", dark ? "text-white" : "text-slate-800")}>{album.name}</p>
      <p className={cn("text-[9px] line-clamp-1 w-full text-left", dark ? "text-slate-400" : "text-slate-500")}>{album.artist}</p>
    </button>
  );
}

function PlaylistCard({ playlist, dark, onOpen, onPlay }: { playlist: Playlist; dark: boolean; onOpen: () => void; onPlay: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn("flex flex-col shrink-0 w-[120px] p-2 rounded-lg transition-colors group", dark ? "hover:bg-slate-800/60" : "hover:bg-slate-50")}
    >
      <div className="relative mb-2">
        {playlist.image ? (
          <img src={playlist.image} alt="" className="w-[104px] h-[104px] rounded-md object-cover shadow-md" />
        ) : (
          <div className={cn("w-[104px] h-[104px] rounded-md flex items-center justify-center", dark ? "bg-slate-700" : "bg-slate-200")}>
            <ListMusic className="h-8 w-8 text-slate-500" />
          </div>
        )}
        <div
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="absolute bottom-1.5 right-1.5 p-2 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 shadow-lg cursor-pointer"
        >
          <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />
        </div>
      </div>
      <p className={cn("text-[10px] font-semibold line-clamp-1 w-full text-left", dark ? "text-white" : "text-slate-800")}>{playlist.name}</p>
      <p className={cn("text-[9px] line-clamp-1 w-full text-left", dark ? "text-slate-400" : "text-slate-500")}>{playlist.description || playlist.owner || "Playlist"}</p>
    </button>
  );
}

function deduplicateByKey<T>(items: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    const v = item[key];
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}
