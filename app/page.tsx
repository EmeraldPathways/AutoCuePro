"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_SCRIPT = `Welcome to CueFlow.

This is your calm, focused space for delivering a great take.

Paste your script in the editor, choose a comfortable text size, and set your pace. When you are ready, press play and enter fullscreen.

Keep your eyes near the guide line, breathe naturally, and let the words come to you.`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const MIN_SPEED = 0.5;
const MAX_SPEED = 4;
const SPEED_STEP = 0.1;
const PIXELS_PER_SPEED = 32;
const DEFAULT_SPEED = 1.7;
const MIN_FOCUS_STRENGTH = 20;
const MAX_FOCUS_STRENGTH = 95;
const DEFAULT_FOCUS_STRENGTH = 72;

const roundSpeed = (value: number) =>
  Math.round(value / SPEED_STEP) * SPEED_STEP;

const speedLabel = (value: number) => {
  if (value < 1) return "Gentle";
  if (value < 1.7) return "Steady";
  if (value < 2.5) return "Comfortable";
  if (value < 3.3) return "Brisk";
  return "Fast";
};

const migrateLegacySpeed = (value: number) => {
  const legacyLevel = clamp(value > 10 ? value / 10 : value, 1, 10);
  const proportion = (legacyLevel - 1) / 9;
  return roundSpeed(MIN_SPEED + proportion * (MAX_SPEED - MIN_SPEED));
};

function Icon({
  children,
  size = 18,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="icon"
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

export default function Home() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [fontSize, setFontSize] = useState(58);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [focusStrength, setFocusStrength] = useState(DEFAULT_FOCUS_STRENGTH);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [focusZone, setFocusZone] = useState(false);
  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cueScale, setCueScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewStageHeightRef = useRef<number | null>(null);
  const fullscreenTransitionRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("cueflow-script");
    const savedSize = Number(window.localStorage.getItem("cueflow-size"));
    const savedSpeed = Number(window.localStorage.getItem("cueflow-speed-v2"));
    const legacySpeed = Number(window.localStorage.getItem("cueflow-speed"));
    const savedFocusStrength = Number(window.localStorage.getItem("cueflow-focus-strength"));
    const savedFocusZone = window.localStorage.getItem("cueflow-focus-zone");
    if (saved) setScript(saved);
    if (savedSize) setFontSize(clamp(savedSize, 32, 104));
    if (Number.isFinite(savedSpeed) && savedSpeed > 0) {
      setSpeed(clamp(roundSpeed(savedSpeed), MIN_SPEED, MAX_SPEED));
    } else if (Number.isFinite(legacySpeed) && legacySpeed > 0) {
      setSpeed(migrateLegacySpeed(legacySpeed));
    }
    if (Number.isFinite(savedFocusStrength) && savedFocusStrength > 0) {
      setFocusStrength(clamp(savedFocusStrength, MIN_FOCUS_STRENGTH, MAX_FOCUS_STRENGTH));
    }
    if (savedFocusZone === "true") setFocusZone(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem("cueflow-script", script);
    window.localStorage.setItem("cueflow-size", String(fontSize));
    window.localStorage.setItem("cueflow-speed-v2", String(speed));
    window.localStorage.setItem("cueflow-focus-strength", String(focusStrength));
    window.localStorage.setItem("cueflow-focus-zone", String(focusZone));
  }, [focusStrength, focusZone, fontSize, ready, script, speed]);

  const updateProgress = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    scrollPositionRef.current = viewport.scrollTop;
    const available = viewport.scrollHeight - viewport.clientHeight;
    setProgress(available > 0 ? viewport.scrollTop / available : 0);
  }, []);

  useEffect(() => {
    if (!playing) {
      previousTimeRef.current = null;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }

    previousTimeRef.current = null;
    const tick = (time: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (previousTimeRef.current !== null) {
        const elapsed = (time - previousTimeRef.current) / 1000;
        scrollPositionRef.current += speed * PIXELS_PER_SPEED * cueScale * elapsed;
        viewport.scrollTop = scrollPositionRef.current;
        updateProgress();
        const end = viewport.scrollHeight - viewport.clientHeight;
        if (viewport.scrollTop >= end - 1) {
          setPlaying(false);
          return;
        }
      }
      previousTimeRef.current = time;
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      previousTimeRef.current = null;
    };
  }, [cueScale, playing, speed, updateProgress]);

  const restart = useCallback(() => {
    if (viewportRef.current) viewportRef.current.scrollTo({ top: 0 });
    scrollPositionRef.current = 0;
    setProgress(0);
    setPlaying(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => setFallbackFullscreen(true));
      return;
    }
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    previewStageHeightRef.current = stage.getBoundingClientRect().height;
    fullscreenTransitionRef.current = true;
    try {
      await stage.requestFullscreen();
      setFallbackFullscreen(false);
    } catch {
      fullscreenTransitionRef.current = false;
      setFallbackFullscreen(true);
    }
  }, [fallbackFullscreen]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame: number | null = null;
    const updateCueScale = () => {
      frame = null;
      const height = stage.getBoundingClientRect().height;
      if (!height) return;
      const fullscreen = document.fullscreenElement === stage || fullscreenTransitionRef.current || stage.classList.contains("stage--fullscreen-fallback");
      if (fullscreen) {
        const previewHeight = previewStageHeightRef.current ?? height;
        setCueScale(clamp(height / previewHeight, 1, 2.5));
      } else {
        previewStageHeightRef.current = height;
        setCueScale(1);
      }
    };
    const scheduleScaleUpdate = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateCueScale);
    };
    const onFullscreen = () => {
      fullscreenTransitionRef.current = false;
      setIsFullscreen(document.fullscreenElement === stage);
      if (document.fullscreenElement === stage) setFallbackFullscreen(false);
      scheduleScaleUpdate();
    };

    const observer = new ResizeObserver(scheduleScaleUpdate);
    observer.observe(stage);
    updateCueScale();
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("resize", scheduleScaleUpdate);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("resize", scheduleScaleUpdate);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (shortcutsOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setShortcutsOpen(false);
        }
        return;
      }
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (event.key === "Escape" && fallbackFullscreen) {
        event.preventDefault();
        setFallbackFullscreen(false);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key.toLowerCase() === "r") {
        restart();
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSpeed((value) => clamp(roundSpeed(value + SPEED_STEP), MIN_SPEED, MAX_SPEED));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSpeed((value) => clamp(roundSpeed(value - SPEED_STEP), MIN_SPEED, MAX_SPEED));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fallbackFullscreen, restart, shortcutsOpen, toggleFullscreen]);

  const wordCount = useMemo(
    () => script.trim().split(/\s+/).filter(Boolean).length,
    [script],
  );
  const estimatedMinutes = Math.max(1, Math.ceil(wordCount / 135));
  const scaledFontSize = fontSize * cueScale;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="CueFlow home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>CueFlow</span>
        </a>
        <div className="topbar-meta">
          <span className="saved-status">
            <span className="saved-dot" />
            Saved locally
          </span>
          <button className="shortcut-button" type="button" title="Keyboard shortcuts" aria-haspopup="dialog" aria-expanded={shortcutsOpen} onClick={() => setShortcutsOpen(true)}>
            <Icon>
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="2.5" y="5" width="19" height="14" rx="3" />
                <path d="M6.5 9h.01M10.2 9h.01M13.8 9h.01M17.5 9h.01M7 13.2h10" />
              </svg>
            </Icon>
            Shortcuts
          </button>
        </div>
      </header>

      {shortcutsOpen && (
        <div className="shortcuts-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShortcutsOpen(false); }}>
          <section className="shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
            <button className="shortcuts-close" type="button" aria-label="Close keyboard shortcuts" onClick={() => setShortcutsOpen(false)}>×</button>
            <p className="eyebrow">Quick controls</p>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <dl>
              <div><dt><kbd>Space</kbd></dt><dd>Play or pause</dd></div>
              <div><dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Adjust scroll speed</dd></div>
              <div><dt><kbd>R</kbd></dt><dd>Restart from the beginning</dd></div>
              <div><dt><kbd>F</kbd></dt><dd>Enter or exit fullscreen</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Exit fullscreen or close this panel</dd></div>
            </dl>
          </section>
        </div>
      )}

      <section className="workspace">
        <aside className="control-panel">
          <div className="panel-heading">
            <p className="eyebrow">Your script</p>
            <h1>Ready when you are.</h1>
            <p>Paste your words, set your pace, and deliver with confidence.</p>
          </div>

          <div className="script-editor">
            <textarea
              aria-label="Autocue script"
              value={script}
              onChange={(event) => {
                setScript(event.target.value);
                restart();
              }}
              spellCheck
            />
            <div className="script-stats">
              <span>{wordCount} words</span>
              <span>~{estimatedMinutes} min read</span>
            </div>
          </div>

          <div className="settings">
            <label className="setting">
              <span className="setting-header">
                <span>
                  <Icon>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 18 10.4 5h1.2L18 18M6.2 14h9.6M17 9h4M19 7v4" />
                    </svg>
                  </Icon>
                  Text size
                </span>
                <output>{fontSize} px</output>
              </span>
              <input
                type="range"
                min="32"
                max="104"
                step="2"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                style={{ "--value": `${((fontSize - 32) / 72) * 100}%` } as React.CSSProperties}
              />
              <span className="range-labels">
                <span>Small</span>
                <span>Large</span>
              </span>
            </label>

            <label className="setting">
              <span className="setting-header">
                <span>
                  <Icon>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 14a8 8 0 1 1 3 4.8M12 12l4-3M3 18h5M2 21h4" />
                    </svg>
                  </Icon>
                  Scroll speed
                </span>
                <output>{speed.toFixed(1)}× · {speedLabel(speed)}</output>
              </span>
              <input
                type="range"
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={SPEED_STEP}
                value={speed}
                onChange={(event) => setSpeed(roundSpeed(Number(event.target.value)))}
                style={{ "--value": `${((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100}%` } as React.CSSProperties}
              />
              <span className="range-labels">
                <span>Gentle</span>
                <span>Fast</span>
              </span>
            </label>

            <label className="setting">
              <span className="setting-header">
                <span>
                  <Icon>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 5h16M4 12h16M4 19h16M8 3v4M15 10v4M11 17v4" />
                    </svg>
                  </Icon>
                  Focus strength
                </span>
                <output>{focusStrength}%</output>
              </span>
              <input
                type="range"
                min={MIN_FOCUS_STRENGTH}
                max={MAX_FOCUS_STRENGTH}
                step="1"
                value={focusStrength}
                onChange={(event) => setFocusStrength(Number(event.target.value))}
                style={{ "--value": `${((focusStrength - MIN_FOCUS_STRENGTH) / (MAX_FOCUS_STRENGTH - MIN_FOCUS_STRENGTH)) * 100}%` } as React.CSSProperties}
                aria-label="Focus strength"
              />
              <span className="range-labels">
                <span>Lighter</span>
                <span>Darker</span>
              </span>
            </label>
          </div>

          <div className="tip">
            <Icon>
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10.5v6M12 7.5h.01" />
              </svg>
            </Icon>
            <p>
              <strong>Presenter tip</strong>
              Press <kbd>Space</kbd> to play or pause. Use <kbd>↑</kbd> and{" "}
              <kbd>↓</kbd> to adjust pace while presenting.
            </p>
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">Live preview</p>
              <p className="preview-note">Your script appears exactly as it will in fullscreen.</p>
            </div>
            <div className="preview-actions">
              <button
                className={`focus-button${focusZone ? " is-active" : ""}`}
                type="button"
                aria-pressed={focusZone}
                onClick={() => setFocusZone((value) => !value)}
              >
                <Icon>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" />
                  </svg>
                </Icon>
                Focus zone
              </button>
              <button className="fullscreen-button" type="button" onClick={toggleFullscreen}>
                <Icon>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
                  </svg>
                </Icon>
                Fullscreen
              </button>
            </div>
          </div>

          <div className={`stage${fallbackFullscreen ? " stage--fullscreen-fallback" : ""}`} ref={stageRef}>
            <div className="stage-topline">
              <span className="live-pill">
                <span />
                AUTOCUE
              </span>
              <span className="stage-status">
                <button
                  className={`stage-focus-button${focusZone ? " is-active" : ""}`}
                  type="button"
                  aria-label={`${focusZone ? "Hide" : "Show"} focus zone`}
                  aria-pressed={focusZone}
                  onClick={() => setFocusZone((value) => !value)}
                >
                  <Icon size={15}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" />
                    </svg>
                  </Icon>
                  Focus
                </button>
                <span>{Math.round(progress * 100)}%</span>
              </span>
            </div>

            <div
              className="cue-viewport"
              ref={viewportRef}
              onScroll={updateProgress}
              style={{
                "--cue-font-size": `${scaledFontSize}px`,
                "--cue-scale": cueScale,
              } as React.CSSProperties}
            >
              <div
                className={`focus-zone${focusZone ? " is-visible" : ""}`}
                style={{ "--focus-shade-opacity": focusStrength / 100 } as React.CSSProperties}
                aria-hidden="true"
              >
                <span className="focus-shade focus-shade-top" />
                <span className="focus-band" />
                <span className="focus-shade focus-shade-bottom" />
              </div>
              <div className="cue-spacer" />
              <div className="cue-text" style={{ fontSize: scaledFontSize }}>
                {script || "Your script will appear here."}
              </div>
              <div className="cue-spacer cue-spacer-end" />
            </div>

            <div className="stage-controls">
              <button
                className="secondary-control"
                type="button"
                onClick={restart}
                aria-label="Restart"
              >
                <Icon size={20}>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 10a8 8 0 1 1 1.8 7M4 10V5m0 5h5" />
                  </svg>
                </Icon>
              </button>
              <button
                className="play-control"
                type="button"
                onClick={() => setPlaying((value) => !value)}
              >
                <Icon size={22}>
                  {playing ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6.5" y="5" width="4" height="14" rx="1" />
                      <rect x="13.5" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="m8 5 11 7-11 7V5Z" />
                    </svg>
                  )}
                </Icon>
                {playing ? "Pause" : "Start cue"}
              </button>
              {isFullscreen || fallbackFullscreen ? (
                <button
                  className="secondary-control"
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label="Exit fullscreen"
                >
                  <Icon size={20}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                    </svg>
                  </Icon>
                </button>
              ) : (
                <span className="control-spacer" />
              )}
            </div>
          </div>

          <p className="preview-footer">
            <span><kbd>Space</kbd> Play / pause</span>
            <span><kbd>R</kbd> Restart</span>
            <span><kbd>F</kbd> Fullscreen</span>
          </p>
        </section>
      </section>
    </main>
  );
}
