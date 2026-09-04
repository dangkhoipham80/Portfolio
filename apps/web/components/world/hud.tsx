"use client";

/*
 * Everything drawn over the island in HTML: the title card, the toolbar,
 * the signposts, the prompt, the conversation box, the journal, the
 * minimap, the joystick, the toast. All of it is a client concern — it
 * reads the store and drives the scene — and none of it is content: the
 * content is in the panels, which are server-rendered.
 *
 * One rule for all of it: the HUD root does not take the pointer. Each
 * control opts in with `pointer-events-auto`, so a tap on empty HUD lands on
 * the island underneath and walks the player there.
 */

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { pillClasses } from "@/components/ui/pill";
import { cn } from "@/lib/cn";

import { NPCS, promptFor, type Dialogue, type Interactable, type Offer } from "./content";
import { IslandMap } from "./map";
import { PLACES, placeById, QUEST_ORDER, type PlaceId } from "./places";
import { useWorldState, type CameraMode, type Runtime, type Store } from "./state";

/** The surface a card over the island sits on: the pill, at card scale. */
export const glassCard =
  "rounded-[var(--radius-card)] border border-border/70 bg-background/85 shadow-[0_1px_2px_hsl(0_0%_0%/0.08)] backdrop-blur-md";

/** A key cap, in the prompt and the controls list. */
function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The title card: the island's opening line, and the two ways in. The
 * strip of places under it is the map as links — hash links, so they work
 * before any script runs and, once it has, open the place in the world.
 */
export function TitleCard({
  discovered,
  counts,
  onStart,
  onAtlas,
}: {
  discovered: number;
  counts: Partial<Record<PlaceId, number>>;
  onStart: () => void;
  onAtlas: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:gap-4 sm:p-8">
      <div className={cn(glassCard, "hero-item pointer-events-auto max-w-lg p-5 [animation-delay:200ms] sm:p-6")}>
        <Eyebrow>
          /world · {PLACES.length} places{discovered > 0 ? ` · ${discovered} found` : ""}
        </Eyebrow>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
          Walk through what I have built.
        </h2>
        {/* The sentence is for a screen with room for it; a phone gets the buttons. */}
        <p className="mt-2 hidden max-w-[var(--measure)] text-sm text-muted-foreground sm:block sm:text-base">
          Every path on this island leads to one part of this portfolio. Meet the
          people, follow the fox, and read what you find.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
          <button type="button" onClick={onStart} className={buttonClasses("primary")} autoFocus>
            Start exploring <span aria-hidden="true">→</span>
          </button>
          <button type="button" onClick={onAtlas} className={buttonClasses("quiet")}>
            Read it as a list
          </button>
        </div>
        <p className="mt-4 hidden items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground pointer-fine:flex">
          <Key>W</Key>
          <Key>A</Key>
          <Key>S</Key>
          <Key>D</Key>
          <span>walk</span>
          <span aria-hidden="true">·</span>
          <span>click to go there</span>
          <span aria-hidden="true">·</span>
          <Key>E</Key>
          <span>interact</span>
        </p>
      </div>
      {/* One scrolling row on a phone, where seven pills would stack four deep over the island. */}
      <nav aria-label="Places" className="pointer-events-auto hero-item -mx-4 overflow-x-auto px-4 [animation-delay:320ms] [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {PLACES.map((place) => (
            <li key={place.id}>
              <Link href={`/#${place.id}`} className={pillClasses()}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
                {place.label}
                {counts[place.id] !== undefined ? (
                  <span className="text-muted-foreground">· {counts[place.id]}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export function Toolbar({
  mode,
  camera,
  journal,
  onCamera,
  onJournal,
  onAtlas,
}: {
  mode: "title" | "explore";
  camera: CameraMode;
  journal: boolean;
  onCamera: () => void;
  onJournal: () => void;
  onAtlas: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute right-4 top-20 flex flex-wrap justify-end gap-2 sm:right-8 sm:top-6">
      {mode === "explore" ? (
        <>
          <button
            type="button"
            onClick={onCamera}
            className={pillClasses()}
            aria-label={`Camera: ${camera === "third" ? "third person" : "first person"}. Switch.`}
            title="Switch camera (V)"
          >
            <span aria-hidden="true">{camera === "third" ? "3rd" : "1st"}</span>
            <span className="hidden sm:inline">person</span>
          </button>
          <button
            type="button"
            onClick={onJournal}
            aria-expanded={journal}
            className={pillClasses(journal)}
            title="Journal (J)"
          >
            Journal
          </button>
        </>
      ) : null}
      <button type="button" onClick={onAtlas} className={pillClasses()} title="Read the island as a list">
        Atlas
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The floating labels: a signpost over each place and a name tag over each
 * person, positioned by the scene each frame, so they start invisible and
 * appear once the first frame has placed them. Decorative duplicates of the
 * journal and the atlas: not in the tab order, not announced.
 */
export function Signposts({
  store,
  getRuntime,
  counts,
  onTravel,
}: {
  store: Store;
  getRuntime: () => Runtime;
  counts: Partial<Record<PlaceId, number>>;
  onTravel: (id: PlaceId) => void;
}) {
  const hovered = useWorldState(store, (s) => s.hovered);
  const quest = useWorldState(store, (s) => s.quest);
  const discovered = useWorldState(store, (s) => s.discovered);
  const mode = useWorldState(store, (s) => s.mode);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
      {PLACES.map((place) => (
        <button
          key={place.id}
          type="button"
          tabIndex={-1}
          ref={(el) => {
            if (el) getRuntime().anchors.set(`place:${place.id}`, el);
            else getRuntime().anchors.delete(`place:${place.id}`);
          }}
          onPointerEnter={() => store.set({ hovered: place.id })}
          onPointerLeave={() => store.set((s) => (s.hovered === place.id ? { hovered: null } : {}))}
          onClick={() => onTravel(place.id)}
          className={cn(
            "world-post absolute left-0 top-0 opacity-0",
            (hovered === place.id || quest === place.id) && "is-lit",
          )}
        >
          <span className="world-post-node" />
          <span className="world-post-label">
            {quest === place.id ? "Quest · " : discovered.includes(place.id) ? "✓ " : ""}
            {place.label}
            {counts[place.id] !== undefined ? (
              <span className="text-muted-foreground"> · {counts[place.id]}</span>
            ) : null}
          </span>
          <span className="world-post-blurb">{mode === "title" ? place.blurb : place.landmark}</span>
        </button>
      ))}
      {NPCS.map((npc) => (
        <span
          key={npc.id}
          ref={(el) => {
            if (el) getRuntime().anchors.set(`npc:${npc.id}`, el);
            else getRuntime().anchors.delete(`npc:${npc.id}`);
          }}
          className="world-tag absolute left-0 top-0 opacity-0"
        >
          <span className="world-tag-name">{npc.name}</span>
          <span className="world-tag-role">{npc.role}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** The one line at the foot of the screen: what E would do right now. */
export function Prompt({ nearby, onInteract }: { nearby: Interactable; onInteract: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4 pointer-coarse:justify-end sm:bottom-8">
      <button
        type="button"
        onClick={onInteract}
        className={cn(
          pillClasses(true),
          "pointer-events-auto min-h-12 gap-3 px-5 pointer-coarse:min-h-14 pointer-coarse:px-7 pointer-coarse:text-sm",
        )}
      >
        <span className="hidden pointer-fine:inline-flex">
          <Key>E</Key>
        </span>
        {promptFor(nearby)}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * A conversation: one line at a time, in the speaker's voice, and at the
 * end whatever they can offer — a place to go, a page to read. The box takes
 * focus when it opens so Enter walks the lines and a screen reader hears
 * them; `aria-live` on the text so each new line is announced in place.
 */
export function DialogueBox({
  dialogue,
  onAdvance,
  onChoose,
  onClose,
}: {
  dialogue: Dialogue & { index: number };
  onAdvance: () => void;
  onChoose: (offer: Offer) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const last = dialogue.index >= dialogue.lines.length - 1;

  useEffect(() => {
    box.current?.focus();
  }, [dialogue.speaker]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-8">
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-label={dialogue.speaker}
        className={cn(glassCard, "world-sheet pointer-events-auto w-full max-w-xl p-5 outline-none sm:p-6")}
      >
        <div className="flex items-start justify-between gap-4">
          <Eyebrow>
            {dialogue.speaker}
            <span className="text-border"> · </span>
            {dialogue.index + 1}/{dialogue.lines.length}
          </Eyebrow>
          <button
            type="button"
            onClick={onClose}
            aria-label="End the conversation"
            className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p aria-live="polite" className="mt-2 text-base leading-relaxed text-foreground sm:text-lg">
          {dialogue.lines[dialogue.index]}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {last ? (
            <>
              {dialogue.offers.map((offer) => (
                <button
                  key={offer.label}
                  type="button"
                  onClick={() => onChoose(offer)}
                  className={buttonClasses("primary")}
                >
                  {offer.label}
                </button>
              ))}
              <button type="button" onClick={onClose} className={buttonClasses("quiet")}>
                {dialogue.offers.length > 0 ? "Walk on" : "Okay"}
              </button>
            </>
          ) : (
            <button type="button" onClick={onAdvance} className={buttonClasses("primary")}>
              Continue <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The journal: the quests, which are the sections; what is found and what
 * is left; and the controls, written down once for anyone who missed the
 * hint. A sheet on the left, so the island stays in view on the right.
 */
export function Journal({
  discovered,
  quest,
  camera,
  onGuide,
  onOpen,
  onClose,
  onAtlas,
}: {
  discovered: PlaceId[];
  quest: PlaceId | null;
  camera: CameraMode;
  onGuide: (id: PlaceId | null) => void;
  onOpen: (id: PlaceId) => void;
  onClose: () => void;
  onAtlas: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-title"
      className={cn(
        glassCard,
        "world-sheet pointer-events-auto absolute inset-y-4 left-4 flex w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden sm:inset-y-6 sm:left-8",
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
        <div>
          <Eyebrow>
            /journal · {discovered.length} of {QUEST_ORDER.length} found
          </Eyebrow>
          <h2 id="journal-title" className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
            Quests
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close the journal"
          className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ol className="flex-1 overflow-y-auto p-2">
        {QUEST_ORDER.map((id) => {
          const place = placeById(id);
          const done = discovered.includes(id);
          const guiding = quest === id;
          return (
            <li key={id} className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  done ? "border-signal bg-signal text-primary-foreground" : "border-border text-transparent",
                )}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", done ? "text-muted-foreground line-through decoration-border" : "text-foreground")}>
                  {place.quest}
                </span>
                <span className={cn(eyebrowClasses, "block normal-case tracking-normal")}>
                  {place.landmark} · {place.label}
                </span>
                <span className="sr-only">{done ? "Found." : guiding ? "Being guided." : "Not yet found."}</span>
              </span>
              {done ? (
                <button
                  type="button"
                  onClick={() => onOpen(id)}
                  className="inline-flex min-h-11 items-center px-2 font-mono text-xs uppercase tracking-wider text-primary transition-colors hover:text-foreground"
                >
                  Open
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onGuide(guiding ? null : id)}
                  aria-pressed={guiding}
                  className={cn(
                    "inline-flex min-h-11 items-center px-2 font-mono text-xs uppercase tracking-wider transition-colors",
                    guiding ? "text-primary" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {guiding ? "Guiding" : "Guide me"}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border/60 p-5">
        <dl className="hidden grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground pointer-fine:grid">
          <dt className="flex gap-1">
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key>
          </dt>
          <dd className="self-center">walk · hold shift to run</dd>
          <dt>
            <Key>drag</Key>
          </dt>
          <dd className="self-center">look around</dd>
          <dt>
            <Key>E</Key>
          </dt>
          <dd className="self-center">interact</dd>
          <dt>
            <Key>V</Key>
          </dt>
          <dd className="self-center">{camera === "third" ? "first person" : "third person"}</dd>
          <dt>
            <Key>J</Key>
          </dt>
          <dd className="self-center">this journal</dd>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground pointer-fine:mt-4">
          Rather not walk?{" "}
          <button type="button" onClick={onAtlas} className="link-draw inline-flex min-h-11 items-center text-foreground">
            Read the island as a list
          </button>
          .
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** The map in the corner, with the player on it. Decorative; the journal is the list. */
export function Minimap({ getRuntime }: { getRuntime: () => Runtime }) {
  return (
    <div
      aria-hidden="true"
      className={cn(glassCard, "pointer-events-none absolute bottom-5 left-4 hidden h-28 w-28 p-1 sm:bottom-8 sm:left-8 sm:block")}
    >
      <IslandMap labels={false} className="h-full w-full">
        <g
          ref={(el) => {
            if (el) getRuntime().anchors.set("minimap:player", el);
            else getRuntime().anchors.delete("minimap:player");
          }}
        >
          <path d="M4 0 L-3 3 L-1.5 0 L-3 -3 Z" className="fill-foreground" />
        </g>
      </IslandMap>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * A thumbstick for touch. The knob follows the finger inside the ring and
 * writes the vector into the runtime; nothing else on the page sees the
 * pointer. Only on coarse pointers — a mouse has a keyboard next to it.
 */
export function Joystick({ getRuntime }: { getRuntime: () => Runtime }) {
  const knob = useRef<HTMLSpanElement>(null);
  const RADIUS = 40;

  function move(el: HTMLElement, clientX: number, clientY: number) {
    const runtime = getRuntime();
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    const dead = d < 8;
    runtime.input.stick.x = dead ? 0 : dx / RADIUS;
    runtime.input.stick.y = dead ? 0 : dy / RADIUS;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    runtime.player.target = null;
  }

  function release() {
    const runtime = getRuntime();
    runtime.input.stick.x = 0;
    runtime.input.stick.y = 0;
    if (knob.current) knob.current.style.transform = "";
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-auto absolute bottom-5 left-4 hidden h-28 w-28 touch-none select-none items-center justify-center rounded-full border border-border/70 bg-background/60 backdrop-blur-md pointer-coarse:flex"
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        move(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span ref={knob} className="h-12 w-12 rounded-full border border-primary/50 bg-background/90 shadow-[0_1px_2px_hsl(0_0%_0%/0.2)]" />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** The controls, once, until the first step proves they were read. */
export function ControlsHint({ camera }: { camera: CameraMode }) {
  return (
    <p className="pointer-events-none absolute bottom-5 right-4 hidden items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground pointer-fine:flex sm:bottom-8 sm:right-8">
      <Key>W</Key>
      <Key>A</Key>
      <Key>S</Key>
      <Key>D</Key>
      <span>{camera === "first" ? "walk · turn" : "walk"}</span>
      <span aria-hidden="true">·</span>
      <span>drag to look</span>
      <span aria-hidden="true">·</span>
      <Key>E</Key>
      <span>interact</span>
    </p>
  );
}

/** A line that appears when something is found, and goes away on its own. */
export function Toast({ text }: { text: string }) {
  return (
    <div role="status" className="pointer-events-none absolute left-4 right-4 top-36 flex sm:left-8 sm:top-24">
      <p className={cn(pillClasses(true), "world-sheet pointer-events-none")}>
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
        {text}
      </p>
    </div>
  );
}
