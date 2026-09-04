"use client";

/*
 * A client component because the island is interactive by definition —
 * a WebGL canvas, keys, drags, taps, a reduced-motion query and a visibility
 * observer that stops drawing when the reader scrolls on. What it shows is
 * still server-rendered: the panels' content arrives as nodes built on the
 * server, and before this mounts (or without WebGL) the same nodes render
 * as the atlas, so every section exists in the HTML before any of this loads.
 */

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { Atlas } from "./atlas";
import {
  npcById,
  poiById,
  type Offer,
  type WorldFacts,
} from "./content";
import {
  ControlsHint,
  DialogueBox,
  Joystick,
  Journal,
  Minimap,
  Prompt,
  Signposts,
  TitleCard,
  Toast,
  Toolbar,
} from "./hud";
import { INTERACT_KEYS, isTyping, useDragToLook, useMovementKeys } from "./input";
import { Panel } from "./panel";
import { usePalette } from "./palette";
import { doorOf, isPlaceId, placeById, QUEST_ORDER, type Place, type PlaceId } from "./places";
import {
  createRuntime,
  createStore,
  loadCamera,
  loadDiscovered,
  saveCamera,
  saveDiscovered,
  useWorldState,
  type CameraMode,
  type WorldState,
} from "./state";

/*
 * The scene, and with it `three`, arrives only in the browser and only once
 * this component has mounted — a server render of a WebGL canvas is nothing,
 * and the renderer is the largest thing the site ships, so it is not on the
 * critical path of a page that is otherwise text.
 */
const Scene = dynamic(() => import("./scene"), { ssr: false });

let webglSupport: boolean | undefined;

/** Whether this browser can draw the island. Checked once, on the client. */
function hasWebGL(): boolean {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const noop = () => () => {};

const INITIAL: WorldState = {
  mode: "title",
  camera: "third",
  nearby: null,
  panel: null,
  dialogue: null,
  journal: false,
  atlas: false,
  discovered: [],
  quest: null,
  moved: false,
  hovered: null,
  toast: null,
};

/**
 * The island: seven places, six paths, and you at the crossroads.
 *
 * ## What it is for
 *
 * The home page used to be a name, a sentence and the sections under them,
 * which is what every portfolio is. This is somewhere to go. Each section
 * of the site is a landmark — the lighthouse is the work, the cairn the
 * stack, the big tree the writing, the mountain the career, the pavilion
 * the credentials, the cabin the way to get in touch, and the crossroads is
 * the owner — and you walk to it, in third or first person, past the people
 * who will tell you about it and a fox that will show you the way. Getting
 * there opens the section, as a panel over the island.
 *
 * ## What it is not allowed to cost
 *
 * The atlas is the real content: server-rendered, every section in reading
 * order, reachable from the title card, the journal and the toolbar, and
 * what a browser without WebGL gets outright. Hash links (`/#projects`)
 * work with and without the scene. Under reduced motion nothing idles and
 * the camera cuts rather than swoops. Off screen, the canvas stops drawing.
 */
export function World({
  facts,
  counts,
  panels,
  atlasSections,
  nameplate,
  className,
}: {
  facts: WorldFacts;
  /** How many things each place holds, for the signposts. Absent = unknown. */
  counts: Partial<Record<PlaceId, number>>;
  /** Each place's content, server-rendered, opened as a panel in the world. */
  panels: Record<PlaceId, ReactNode>;
  /** The same content as the atlas lists it: places with nothing to say are left out. */
  atlasSections: { place: Place; content: ReactNode }[];
  /** The page's h1 and its eyebrow, drawn in the corner over the island. */
  nameplate: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const palette = usePalette();
  // Both are facts about the browser, read as external stores so they are
  // `null`/false on the server and true on the client without a re-render
  // in an effect. Motion follows the OS setting live.
  const motion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION_QUERY).matches, () => false);
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);
  const [store] = useState(() => createStore(INITIAL));
  const [getRuntime] = useState(() => createRuntime());
  const [active, setActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mode = useWorldState(store, (s) => s.mode);
  const camera = useWorldState(store, (s) => s.camera);
  const nearby = useWorldState(store, (s) => s.nearby);
  const panel = useWorldState(store, (s) => s.panel);
  const dialogue = useWorldState(store, (s) => s.dialogue);
  const journal = useWorldState(store, (s) => s.journal);
  const atlas = useWorldState(store, (s) => s.atlas);
  const discovered = useWorldState(store, (s) => s.discovered);
  const quest = useWorldState(store, (s) => s.quest);
  const moved = useWorldState(store, (s) => s.moved);
  const toast = useWorldState(store, (s) => s.toast);
  const pointing = useWorldState(store, (s) => s.hovered !== null && s.mode === "title");

  // What this browser found last time, and how it liked to look.
  useEffect(() => {
    store.set({ discovered: loadDiscovered(), camera: loadCamera() });
  }, [store]);

  // Draw only while on screen and while the tab is in front.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let seen = false;
    const settle = () => setActive(seen && document.visibilityState === "visible");
    const observer = new IntersectionObserver(
      (entries) => {
        seen = entries.some((entry) => entry.isIntersecting);
        settle();
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", settle);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", settle);
    };
  }, []);

  /* ---------------------------------------------------------------------- */

  const say = useCallback(
    (text: string) => {
      store.set({ toast: text });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => store.set({ toast: null }), 3200);
    },
    [store],
  );

  /** Mark a place found. The journal ticks it, the toast says so. */
  const discover = useCallback(
    (id: PlaceId) => {
      const { discovered, quest } = store.get();
      const patch: Partial<WorldState> = {};
      if (quest === id) patch.quest = null;
      if (!discovered.includes(id)) {
        const next = [...discovered, id];
        patch.discovered = next;
        saveDiscovered(next);
        const place = placeById(id);
        say(
          next.length === QUEST_ORDER.length
            ? "Every path walked. Thank you for visiting."
            : `Found ${place.landmark.toLowerCase()} · ${next.length} of ${QUEST_ORDER.length}`,
        );
      }
      store.set(patch);
    },
    [store, say],
  );

  const openPanel = useCallback(
    (id: PlaceId) => {
      discover(id);
      store.set({ panel: id, dialogue: null, journal: false, nearby: null });
    },
    [store, discover],
  );

  const closePanel = useCallback(() => {
    store.set({ panel: null });
    // Back to the island, not to wherever focus fell.
    root.current?.focus({ preventScroll: true });
  }, [store]);

  /** Where the player faces on arrival: the landmark. */
  const placeAt = useCallback(
    (id: PlaceId) => {
      const place = placeById(id);
      const [x, z] = doorOf(place);
      const runtime = getRuntime();
      const p = runtime.player;
      p.pos.x = x;
      p.pos.z = z;
      p.target = null;
      p.yaw = Math.atan2(place.at[0] - x, place.at[1] - z);
      runtime.cam.yaw = store.get().camera === "first" ? p.yaw : p.yaw + Math.PI;
    },
    [getRuntime, store],
  );

  const start = useCallback(() => {
    if (store.get().mode === "explore") return;
    const runtime = getRuntime();
    const p = runtime.player;
    runtime.cam.yaw = store.get().camera === "first" ? p.yaw : p.yaw + Math.PI;
    runtime.cam.pitch = 0.5;
    const first = !store.get().discovered.includes("about");
    store.set({ mode: "explore", journal: false });
    // A first visit is greeted; the guide's opening lines are the tutorial.
    if (first) {
      const guide = npcById("guide");
      store.set({ dialogue: { ...guide.talk(facts), index: 0 } });
      discover("about");
    }
    root.current?.focus({ preventScroll: true });
  }, [store, getRuntime, facts, discover]);

  /** A landmark was clicked, or the journal asked: walk there, fox first. */
  const travel = useCallback(
    (id: PlaceId) => {
      const wasTitle = store.get().mode === "title";
      start();
      const [x, z] = doorOf(placeById(id));
      getRuntime().player.target = { x, z };
      store.set({ quest: store.get().discovered.includes(id) ? null : id, journal: false, hovered: null });
      if (wasTitle) store.set({ dialogue: null });
    },
    [store, getRuntime, start],
  );

  /** Arrive somewhere directly: the hash links, the nav's Projects. */
  const goTo = useCallback(
    (id: PlaceId) => {
      start();
      store.set({ dialogue: null });
      placeAt(id);
      openPanel(id);
    },
    [store, start, placeAt, openPanel],
  );

  const interact = useCallback(() => {
    const { nearby, dialogue } = store.get();
    if (dialogue) {
      // E while talking is "continue"; on the last line, "walk on".
      if (dialogue.index < dialogue.lines.length - 1) {
        store.set({ dialogue: { ...dialogue, index: dialogue.index + 1 } });
      } else if (dialogue.offers.length === 0) {
        store.set({ dialogue: null });
      }
      return;
    }
    if (!nearby) return;
    if (nearby.kind === "place") {
      openPanel(nearby.id);
    } else if (nearby.kind === "npc") {
      const npc = npcById(nearby.id);
      if (npc.id === "guide") discover("about");
      store.set({ dialogue: { ...npc.talk(facts), index: 0 } });
    } else {
      store.set({ dialogue: { ...poiById(nearby.id).talk(facts), index: 0 } });
    }
  }, [store, facts, openPanel, discover]);

  const choose = useCallback(
    (offer: Offer) => {
      store.set({ dialogue: null });
      if (offer.quest) {
        const { discovered } = store.get();
        const target =
          (offer.quest as string) === "next"
            ? (QUEST_ORDER.find((id) => id !== "about" && !discovered.includes(id)) ?? null)
            : offer.quest;
        if (target) {
          store.set({ quest: target });
          say(`The fox leads the way to ${placeById(target).landmark.toLowerCase()}`);
        } else {
          say("Nowhere left to lead you. Every path is walked.");
        }
      }
      if (offer.panel) openPanel(offer.panel);
      if (offer.href) {
        if (offer.href.startsWith("mailto:")) window.location.href = offer.href;
        else router.push(offer.href);
      }
    },
    [store, say, openPanel, router],
  );

  const setCamera = useCallback(
    (next: CameraMode) => {
      const runtime = getRuntime();
      const p = runtime.player;
      runtime.cam.yaw = next === "first" ? p.yaw : p.yaw + Math.PI;
      store.set({ camera: next });
      saveCamera(next);
    },
    [getRuntime, store],
  );

  const toggleCamera = useCallback(() => {
    setCamera(store.get().camera === "third" ? "first" : "third");
  }, [setCamera, store]);

  const toggleJournal = useCallback(() => {
    store.set((s) => ({ journal: !s.journal, dialogue: null }));
  }, [store]);

  const openAtlas = useCallback(() => {
    store.set({ atlas: true, panel: null, journal: false, dialogue: null });
  }, [store]);

  const closeAtlas = useCallback(() => {
    store.set({ atlas: false });
  }, [store]);

  /** Escape: close the topmost thing, and only that. */
  const back = useCallback(() => {
    const s = store.get();
    if (s.panel) closePanel();
    else if (s.dialogue) store.set({ dialogue: null });
    else if (s.journal) store.set({ journal: false });
  }, [store, closePanel]);

  /* ---------------------------------------------------------------------- */

  const exploring = mode === "explore" && !atlas;
  useMovementKeys(getRuntime, exploring && !panel && !dialogue && !journal);
  useDragToLook(root, getRuntime, exploring && !panel && !journal);

  // The keys that are not movement: interact, camera, journal, escape.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        back();
        return;
      }
      const s = store.get();
      if (s.atlas || s.mode !== "explore") return;
      // Enter and space on a focused button are the button's; the browser
      // will click it, and this must not act twice.
      const onControl = event.target instanceof Element && event.target.closest("button, a, [role='dialog']");
      if (INTERACT_KEYS.has(key) && !(onControl && key !== "e")) {
        if (s.panel) return;
        event.preventDefault();
        interact();
      } else if (key === "v" && !s.panel) {
        toggleCamera();
      } else if (key === "j" && !s.panel) {
        toggleJournal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, back, interact, toggleCamera, toggleJournal]);

  // `/#projects` and friends: from the nav on another page, from a link in
  // a panel, or typed. With the scene, that is "arrive there"; the atlas
  // has the same ids as sections and the browser handles the scroll.
  useEffect(() => {
    function onHash() {
      const id = window.location.hash.slice(1);
      if (!isPlaceId(id)) return;
      if (webgl && !store.get().atlas) {
        goTo(id);
        // Consumed: the address bar should not keep a hash the page has
        // acted on, or the next click on the same link would do nothing.
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [webgl, store, goTo]);

  // Warm the routes a panel can lead to while the reader is still deciding.
  useEffect(() => {
    if (!panel) return;
    const href = placeById(panel).href;
    if (href) router.prefetch(href);
  }, [panel, router]);

  const sceneProps = useMemo(() => ({ store, getRuntime, facts, travel }), [store, getRuntime, facts, travel]);

  /* ---------------------------------------------------------------------- */

  // Without the scene — on the server, before hydration, without WebGL, or
  // by choice — the island is the atlas.
  if (webgl !== true || atlas) {
    return (
      <div ref={root} className={cn("world-list", className)}>
        <Atlas
          nameplate={nameplate}
          sections={atlasSections}
          back={
            webgl ? (
              <button type="button" onClick={closeAtlas} className={buttonClasses("quiet")}>
                <span aria-hidden="true">←</span> Back to the island
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div
      ref={root}
      tabIndex={-1}
      className={cn("world relative isolate overflow-hidden outline-none", className)}
      style={{ cursor: pointing ? "pointer" : undefined }}
    >
      <div aria-hidden="true" className="absolute inset-0 touch-none">
        {palette ? <Scene palette={palette} motion={motion} active={active} {...sceneProps} /> : null}
      </div>

      <Signposts store={store} getRuntime={getRuntime} counts={counts} onTravel={travel} />

      {/* The HUD. Nothing in it takes the pointer unless it says so. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-4 top-4 sm:left-8 sm:top-6">{nameplate}</div>
        <Toolbar
          mode={mode}
          camera={camera}
          journal={journal}
          onCamera={toggleCamera}
          onJournal={toggleJournal}
          onAtlas={openAtlas}
        />

        {mode === "title" ? (
          <TitleCard discovered={discovered.length} counts={counts} onStart={start} onAtlas={openAtlas} />
        ) : (
          <>
            <Minimap getRuntime={getRuntime} />
            {!panel && !dialogue && !journal ? <Joystick getRuntime={getRuntime} /> : null}
            {!moved && !dialogue && !panel ? <ControlsHint camera={camera} /> : null}
            {nearby && !dialogue && !panel && !journal ? <Prompt nearby={nearby} onInteract={interact} /> : null}
            {dialogue && !panel ? (
              <DialogueBox
                dialogue={dialogue}
                onAdvance={interact}
                onChoose={choose}
                onClose={() => store.set({ dialogue: null })}
              />
            ) : null}
            {journal && !panel ? (
              <Journal
                discovered={discovered}
                quest={quest}
                camera={camera}
                onGuide={(id) => {
                  store.set({ quest: id, journal: false });
                  if (id) say(`The fox leads the way to ${placeById(id).landmark.toLowerCase()}`);
                }}
                onOpen={openPanel}
                onClose={toggleJournal}
                onAtlas={openAtlas}
              />
            ) : null}
          </>
        )}

        {toast ? <Toast text={toast} /> : null}
      </div>

      {panel ? (
        <Panel id={panel} onClose={closePanel}>
          {panels[panel]}
        </Panel>
      ) : null}
    </div>
  );
}

