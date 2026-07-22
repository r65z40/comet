"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Link,
  Tv,
  Youtube,
  List,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  SkipBack,
  SkipForward,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Channel {
  name: string;
  url: string;
  group?: string;
}

interface VideoPlayerWidgetProps {
  dark?: boolean;
  externalUrl?: string;
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|ogv|avi|mkv|mov|flv|wmv)(\?|$)/i;

function detectStreamType(url: string): "hls" | "youtube" | "native" | "iframe" {
  if (/youtu\.?be/i.test(url)) return "youtube";
  if (/\.m3u8/i.test(url)) return "hls";
  if (/\.ts$/i.test(url)) return "hls";
  if (VIDEO_EXTENSIONS.test(url)) return "native";
  if (/^https?:\/\//i.test(url) && /embed|\.html|\.php|\.asp|player|watch|stream|video/i.test(url)) return "iframe";
  return "native";
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseM3U(text: string): Channel[] {
  const lines = text.split("\n").map((l) => l.trim());
  const channels: Channel[] = [];
  let name = "";
  let group = "";

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXTINF:")) {
      const nameMatch = lines[i].match(/,(.+)$/);
      name = nameMatch ? nameMatch[1].trim() : `Channel ${channels.length + 1}`;
      const groupMatch = lines[i].match(/group-title="([^"]+)"/);
      group = groupMatch ? groupMatch[1] : "";
    } else if (lines[i] && !lines[i].startsWith("#")) {
      channels.push({ name: name || lines[i], url: lines[i], group });
      name = "";
      group = "";
    }
  }
  return channels;
}

export default function VideoPlayerWidget({ dark = false, externalUrl }: VideoPlayerWidgetProps) {
  const [url, setUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [streamType, setStreamType] = useState<"hls" | "youtube" | "native" | "iframe">("native");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (externalUrl) {
      setUrl(externalUrl);
      setActiveUrl(externalUrl);
      setStreamType(detectStreamType(externalUrl));
      setPlaying(true);
    }
  }, [externalUrl]);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showChannels, setShowChannels] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(true);
  const [currentChannel, setCurrentChannel] = useState<string>("");
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [view, setView] = useState<"player" | "favorites">("player");

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("comet_video_favorites");
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const saveFavorites = useCallback((favs: Channel[]) => {
    setFavorites(favs);
    try {
      localStorage.setItem("comet_video_favorites", JSON.stringify(favs));
    } catch {}
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const loadSource = useCallback(
    (sourceUrl: string) => {
      setError(null);
      destroyHls();
      const type = detectStreamType(sourceUrl);
      setStreamType(type);
      setActiveUrl(sourceUrl);
      setShowUrlInput(false);

      if (type === "youtube" || type === "iframe") {
        setPlaying(true);
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      if (type === "hls") {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          });
          hls.loadSource(sourceUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
            setPlaying(true);
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                setError("Erreur réseau — vérifiez l'URL du flux");
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              } else {
                setError("Impossible de lire ce flux");
                destroyHls();
              }
            }
          });
          hlsRef.current = hls;
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = sourceUrl;
          video.addEventListener("loadedmetadata", () => {
            video.play().catch(() => {});
            setPlaying(true);
          }, { once: true });
        } else {
          setError("HLS non supporté par ce navigateur");
        }
      } else {
        video.src = sourceUrl;
        video.load();
        video.addEventListener("loadeddata", () => {
          video.play().catch(() => {});
          setPlaying(true);
        }, { once: true });
        video.addEventListener("error", () => {
          setError("Format non supporté ou URL invalide");
        }, { once: true });
      }
    },
    [destroyHls],
  );

  useEffect(() => {
    return () => destroyHls();
  }, [destroyHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = muted;
    }
  }, [volume, muted]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    if (trimmed.endsWith(".m3u") || trimmed.includes("/get.php")) {
      fetch(trimmed)
        .then((r) => r.text())
        .then((text) => {
          const parsed = parseM3U(text);
          if (parsed.length > 0) {
            setChannels(parsed);
            setShowChannels(true);
            setShowUrlInput(false);
          } else {
            loadSource(trimmed);
          }
        })
        .catch(() => loadSource(trimmed));
    } else {
      loadSource(trimmed);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }

  function playChannel(ch: Channel) {
    setCurrentChannel(ch.name);
    loadSource(ch.url);
    setShowChannels(false);
  }

  function addToFavorites(ch: Channel) {
    if (favorites.some((f) => f.url === ch.url)) return;
    saveFavorites([...favorites, ch]);
  }

  function removeFavorite(favUrl: string) {
    saveFavorites(favorites.filter((f) => f.url !== favUrl));
  }

  function addCurrentToFavorites() {
    if (!activeUrl) return;
    const name = currentChannel || new URL(activeUrl).hostname;
    addToFavorites({ name, url: activeUrl });
  }

  const channelGroups = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    const g = ch.group || "Autres";
    (acc[g] = acc[g] || []).push(ch);
    return acc;
  }, {});

  const iframeHostname = activeUrl ? (() => { try { return new URL(activeUrl).hostname; } catch { return "Embed"; } })() : "Embed";
  const bg = dark ? "bg-slate-900 text-white" : "bg-black text-white";
  const btnClass = "flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-white/20";

  if (view === "favorites") {
    return (
      <div className={cn("flex flex-col h-full", bg)}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <button onClick={() => setView("player")} className={btnClass}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium flex-1">Favoris</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {favorites.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
              Aucun favori
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {favorites.map((fav) => (
                <div
                  key={fav.url}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <button
                    onClick={() => {
                      setView("player");
                      setCurrentChannel(fav.name);
                      loadSource(fav.url);
                    }}
                    className="flex-1 text-left"
                  >
                    <p className="text-xs font-medium truncate">{fav.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{fav.url}</p>
                  </button>
                  <button onClick={() => removeFavorite(fav.url)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showChannels && channels.length > 0) {
    return (
      <div className={cn("flex flex-col h-full", bg)}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <button onClick={() => { setShowChannels(false); setShowUrlInput(true); }} className={btnClass}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium flex-1">{channels.length} chaînes</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(channelGroups).map(([group, chs]) => (
            <div key={group}>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white/5 sticky top-0">
                {group}
              </div>
              {chs.map((ch) => (
                <div
                  key={ch.url}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <button onClick={() => playChannel(ch)} className="flex-1 text-left">
                    <p className="text-xs font-medium truncate">{ch.name}</p>
                  </button>
                  <button
                    onClick={() => addToFavorites(ch)}
                    className="text-yellow-400/60 hover:text-yellow-400 p-1"
                    title="Ajouter aux favoris"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full", bg)}>
      {/* Video area */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center bg-black">
        {streamType === "youtube" && activeUrl ? (
          <iframe
            src={`https://www.youtube.com/embed/${extractYoutubeId(activeUrl)}?autoplay=1&rel=0`}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : streamType === "iframe" && activeUrl ? (
          <iframe
            src={activeUrl}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
          />
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            playsInline
            onClick={togglePlay}
          />
        )}

        {!activeUrl && showUrlInput && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 z-10">
            <div className="flex items-center gap-3 text-slate-500">
              <Tv className="h-8 w-8" />
            </div>
            <form onSubmit={handleSubmit} className="w-full max-w-md flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL vidéo, HLS, IPTV, YouTube, embed..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Play className="h-4 w-4" />
              </button>
            </form>
            <div className="flex flex-wrap justify-center gap-2 text-[10px] text-slate-600">
              <span className="px-2 py-0.5 rounded bg-white/5">MP4</span>
              <span className="px-2 py-0.5 rounded bg-white/5">HLS/m3u8</span>
              <span className="px-2 py-0.5 rounded bg-white/5">IPTV</span>
              <span className="px-2 py-0.5 rounded bg-white/5">YouTube</span>
              <span className="px-2 py-0.5 rounded bg-white/5">WebM</span>
              <span className="px-2 py-0.5 rounded bg-white/5">Embed/Web</span>
            </div>
            {favorites.length > 0 && (
              <button
                onClick={() => setView("favorites")}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <List className="h-3 w-3" />
                {favorites.length} favori{favorites.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-2 rounded-lg text-xs z-20">
            {error}
          </div>
        )}
      </div>

      {/* Controls bar */}
      {activeUrl && streamType !== "youtube" && streamType !== "iframe" && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 border-t border-white/10 shrink-0">
          <button onClick={togglePlay} className={btnClass}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <button onClick={() => setMuted(!muted)} className={btnClass}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              setMuted(false);
            }}
            className="w-16 h-1 accent-blue-500"
          />

          {currentChannel && (
            <span className="text-[10px] text-slate-400 truncate mx-1 flex-1">{currentChannel}</span>
          )}
          {!currentChannel && <div className="flex-1" />}

          {channels.length > 0 && (
            <>
              <button
                onClick={() => {
                  const idx = channels.findIndex((c) => c.url === activeUrl);
                  if (idx > 0) playChannel(channels[idx - 1]);
                }}
                className={btnClass}
                title="Chaîne précédente"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  const idx = channels.findIndex((c) => c.url === activeUrl);
                  if (idx < channels.length - 1) playChannel(channels[idx + 1]);
                }}
                className={btnClass}
                title="Chaîne suivante"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setShowChannels(true)} className={btnClass} title="Liste des chaînes">
                <List className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <button onClick={addCurrentToFavorites} className={btnClass} title="Ajouter aux favoris">
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button onClick={() => setView("favorites")} className={btnClass} title="Favoris">
            <List className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => {
              destroyHls();
              setActiveUrl("");
              setStreamType("native");
              setPlaying(false);
              setShowUrlInput(true);
              setCurrentChannel("");
              if (videoRef.current) videoRef.current.src = "";
            }}
            className={btnClass}
            title="Nouvelle URL"
          >
            <Link className="h-3.5 w-3.5" />
          </button>

          <button onClick={toggleFullscreen} className={btnClass}>
            {fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* YouTube minimal controls */}
      {activeUrl && streamType === "youtube" && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 border-t border-white/10 shrink-0">
          <Youtube className="h-4 w-4 text-red-500" />
          <span className="text-[10px] text-slate-400 truncate flex-1 mx-1">YouTube</span>
          <button onClick={addCurrentToFavorites} className={btnClass} title="Ajouter aux favoris">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setView("favorites")} className={btnClass} title="Favoris">
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setActiveUrl("");
              setShowUrlInput(true);
              setCurrentChannel("");
            }}
            className={btnClass}
            title="Nouvelle URL"
          >
            <Link className="h-3.5 w-3.5" />
          </button>
          <button onClick={toggleFullscreen} className={btnClass}>
            {fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Iframe embed controls */}
      {activeUrl && streamType === "iframe" && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 border-t border-white/10 shrink-0">
          <Globe className="h-4 w-4 text-blue-400" />
          <span className="text-[10px] text-slate-400 truncate flex-1 mx-1">
            {currentChannel || iframeHostname}
          </span>
          <button onClick={addCurrentToFavorites} className={btnClass} title="Ajouter aux favoris">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setView("favorites")} className={btnClass} title="Favoris">
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setActiveUrl("");
              setShowUrlInput(true);
              setCurrentChannel("");
            }}
            className={btnClass}
            title="Nouvelle URL"
          >
            <Link className="h-3.5 w-3.5" />
          </button>
          <button onClick={toggleFullscreen} className={btnClass}>
            {fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
