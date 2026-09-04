import { placeById, type PlaceId } from "./places";

/**
 * What the island says, and who says it.
 *
 * Everything an NPC or a signpost tells the visitor is built from `WorldFacts`,
 * a small serialisable summary the home page computes on the server from the
 * same reads that fill the panels. So the keeper of the lighthouse names the
 * newest project because there is one, and says the shelves are empty when
 * the API is asleep — the world is read from the data, never written by hand
 * next to it.
 *
 * Pure data and pure functions. Nothing here renders and nothing imports
 * `three`, so the HUD can read it without the renderer.
 */
export type WorldFacts = {
  projects: { count: number; featured: number; latest: { title: string; slug: string } | null };
  posts: { count: number; latest: { title: string; slug: string } | null };
  career: { count: number; current: { title: string; company: string } | null };
  certificates: { count: number; latestIssuer: string | null };
  skills: { count: number; categories: string[] };
  /** Whether the reads behind all of this were answered. */
  apiOk: boolean;
};

/** What a line of dialogue can offer at its end: a quest, a panel, a page. */
export type Offer = {
  label: string;
  quest?: PlaceId;
  panel?: PlaceId;
  href?: string;
};

export type Dialogue = {
  speaker: string;
  lines: string[];
  offers: Offer[];
};

/* ------------------------------------------------------------------------ */

export type NpcId = "guide" | "keeper" | "reader" | "climber" | "postmaster";

export type Npc = {
  id: NpcId;
  name: string;
  /** The line under the name tag. */
  role: string;
  /** The place this person talks about, and whose panel they can open. */
  place: PlaceId;
  at: [number, number];
  /** Resting heading, radians; 0 faces +z (towards the camera at the start). */
  facing: number;
  /** Which coat. The warm one is the player's alone, so the eye finds you first. */
  coat: "cool" | "plain";
  talk: (facts: WorldFacts) => Dialogue;
};

const quiet = (text: string) => text;

export const NPCS: Npc[] = [
  {
    id: "guide",
    name: "Khôi",
    role: "Software engineer",
    place: "about",
    at: [1.5, 0.9],
    facing: 2.6,
    coat: "cool",
    talk: (facts) => ({
      speaker: "Khôi",
      lines: [
        "Hi — I'm Khôi. I build the parts you do not see: APIs, schemas, queues and the services between them.",
        "This island is everything I have made, laid out as somewhere to walk. Every path from this signpost leads to one part of it.",
        facts.projects.count > 0
          ? `The lighthouse is the work — ${facts.projects.count} builds are lit there. That is the place to start.`
          : "The lighthouse is the work. It is dark tonight: the API that serves the island is asleep, but the paths still lead where they lead.",
      ],
      offers: [
        { label: "Show me the work", quest: "projects" },
        { label: "Tell me about yourself", panel: "about" },
      ],
    }),
  },
  {
    id: "keeper",
    name: "The keeper",
    role: "Keeps the lighthouse",
    place: "projects",
    at: [4.7, 4.4],
    facing: -0.9,
    coat: "plain",
    talk: (facts) => ({
      speaker: "The keeper",
      lines: [
        facts.projects.count > 0
          ? `${facts.projects.count} builds are lit up there${facts.projects.latest ? ` — the newest is “${facts.projects.latest.title}”` : ""}.`
          : quiet("Nothing is lit tonight — the write-up queue is still draining."),
        "Each one is written up as a case: what it does, what broke, and what I would change. Go on up; the door is open.",
      ],
      offers: [
        { label: "Look at the work", panel: "projects" },
        ...(facts.projects.latest
          ? [{ label: `Read “${facts.projects.latest.title}”`, href: `/projects/${facts.projects.latest.slug}` }]
          : []),
      ],
    }),
  },
  {
    id: "reader",
    name: "The reader",
    role: "Never leaves the bench",
    place: "writing",
    at: [-3.5, -1.4],
    facing: -2.2,
    coat: "plain",
    talk: (facts) => ({
      speaker: "The reader",
      lines: [
        facts.posts.count > 0
          ? `${facts.posts.count} notes so far${facts.posts.latest ? `. The latest is “${facts.posts.latest.title}”` : ""}.`
          : "The shelves are bare for now — drafts are still in review.",
        "He writes when something breaks in a way worth remembering. Mostly backend, occasionally CSS.",
      ],
      offers: [
        { label: "Browse the notes", panel: "writing" },
        { label: "Go to the blog", href: "/blog" },
      ],
    }),
  },
  {
    id: "climber",
    name: "The climber",
    role: "Knows the trail",
    place: "career",
    at: [0.9, -4.0],
    facing: 0.4,
    coat: "cool",
    talk: (facts) => ({
      speaker: "The climber",
      lines: [
        "The trail is the timeline. Every stone is a little higher than the last, and every flag is somewhere he has worked or studied.",
        facts.career.current
          ? `The flag at the top is ${facts.career.current.title} at ${facts.career.current.company}.`
          : facts.career.count > 0
            ? `${facts.career.count} stops on the way up.`
            : "No flags are planted yet.",
      ],
      offers: [
        { label: "Walk the timeline", panel: "career" },
        { label: "Full history", href: "/career-journey" },
      ],
    }),
  },
  {
    id: "postmaster",
    name: "The postmaster",
    role: "Minds the mailbox",
    place: "contact",
    at: [-3.2, 4.6],
    facing: 0.9,
    coat: "plain",
    talk: () => ({
      speaker: "The postmaster",
      lines: [
        "Anything you post at the cabin reaches Khôi's inbox. Usually answered within two days.",
        "The mailbox works even when the rest of the island is asleep — email does not need the API.",
      ],
      offers: [
        { label: "Write a message", panel: "contact" },
      ],
    }),
  },
];

export function npcById(id: NpcId): Npc {
  const npc = NPCS.find((entry) => entry.id === id);
  if (!npc) throw new Error(`Unknown NPC: ${id}`);
  return npc;
}

/* ------------------------------------------------------------------------ */

/**
 * Smaller things worth stopping at: environmental storytelling, one line
 * each. None of them is a section of the site; they are how the island
 * explains itself, and a couple of them lead somewhere.
 */
export type PoiId = "bench" | "mailbox" | "campfire" | "pond" | "fox";

export type Poi = {
  id: PoiId;
  label: string;
  /** Ground position. The fox's is read live; this is where it is looked for. */
  at: [number, number];
  reach: number;
  talk: (facts: WorldFacts) => Dialogue;
};

export const POIS: Poi[] = [
  {
    id: "bench",
    label: "The bench",
    at: [-4.6, -2.3],
    reach: 1.4,
    talk: (facts) => ({
      speaker: "The bench",
      lines: [
        facts.posts.latest
          ? `A book left open under the lantern. The page it is open to: “${facts.posts.latest.title}”.`
          : "A book left open under the lantern, at a blank page.",
      ],
      offers: facts.posts.latest ? [{ label: "Read the page", href: `/blog/${facts.posts.latest.slug}` }] : [],
    }),
  },
  {
    id: "mailbox",
    label: "The mailbox",
    at: [-3.2, 7.1],
    reach: 1.3,
    talk: () => ({
      speaker: "The mailbox",
      lines: ["The flag is up. One address on the front: dangkhoipham80@gmail.com."],
      offers: [{ label: "Write an email", href: "mailto:dangkhoipham80@gmail.com" }],
    }),
  },
  {
    id: "campfire",
    label: "The campfire",
    at: [-0.3, 8.5],
    reach: 1.4,
    talk: () => ({
      speaker: "The campfire",
      lines: [
        "Still burning. Open to mid-level roles and above in backend, data and AI engineering.",
      ],
      offers: [{ label: "Get in touch", panel: "contact" }],
    }),
  },
  {
    id: "pond",
    label: "The pond",
    at: [-2.4, -6.2],
    reach: 1.5,
    talk: (facts) => ({
      speaker: "The pond",
      lines: [
        "Still water. Look closer and the island reflects the site: every place here is read from one API when the page is built.",
        facts.apiOk
          ? "The API answered when this page was made — which is why the lighthouse is lit."
          : "The API was asleep when this page was made. The places stay; only the shelves empty.",
      ],
      offers: [],
    }),
  },
  {
    id: "fox",
    label: "The fox",
    at: [1.6, 2.6],
    reach: 1.3,
    talk: () => ({
      speaker: "The fox",
      lines: ["It looks at you, then at the nearest path, then back at you."],
      offers: [{ label: "Follow it", quest: "next" as PlaceId }],
    }),
  },
];

export function poiById(id: PoiId): Poi {
  const poi = POIS.find((entry) => entry.id === id);
  if (!poi) throw new Error(`Unknown point of interest: ${id}`);
  return poi;
}

/* ------------------------------------------------------------------------ */

/**
 * What a place says when you arrive at its door, before the panel opens.
 * Short: the panel is the content, this is the threshold.
 */
export function placePrompt(id: PlaceId): string {
  switch (id) {
    case "about":
      return "Read the signpost";
    case "projects":
      return "Enter the lighthouse";
    case "skills":
      return "Read the cairn";
    case "writing":
      return "Sit under the tree";
    case "career":
      return "Read the trail markers";
    case "certificates":
      return "Step into the pavilion";
    case "contact":
      return "Knock at the door";
  }
}

/** Something the player can walk up to and press E at. */
export type Interactable =
  | { kind: "place"; id: PlaceId }
  | { kind: "npc"; id: NpcId }
  | { kind: "poi"; id: PoiId };

export function interactableKey(it: Interactable): string {
  return `${it.kind}:${it.id}`;
}

export function parseInteractable(key: string): Interactable | null {
  const [kind, id] = key.split(":");
  if (kind === "place" && PLACES_IDS.has(id)) return { kind, id: id as PlaceId };
  if (kind === "npc" && NPCS.some((n) => n.id === id)) return { kind, id: id as NpcId };
  if (kind === "poi" && POIS.some((p) => p.id === id)) return { kind, id: id as PoiId };
  return null;
}

const PLACES_IDS = new Set<string>([
  "about",
  "projects",
  "skills",
  "writing",
  "career",
  "certificates",
  "contact",
]);

/** The label on the prompt at the foot of the screen. */
export function promptFor(it: Interactable): string {
  switch (it.kind) {
    case "place":
      return placePrompt(it.id);
    case "npc":
      return `Talk to ${npcById(it.id).name}`;
    case "poi":
      return `Look at ${poiById(it.id).label.toLowerCase()}`;
  }
}

/** The section a quest points at, for the marker on the signpost. */
export function questLabel(id: PlaceId): string {
  return placeById(id).quest;
}
