/**
 * The places on the island, which are the site's sections.
 *
 * Positions are in scene units on the ground plane (x across, z towards the
 * camera). The island is a disc of radius ~11; the crossroads is the origin
 * and every path runs from there. Kept as data rather than JSX so the scene,
 * the signposts, the minimap, the journal and the atlas all read one list
 * and cannot disagree about where a place is or what it is called.
 *
 * Seven places now, not five. The two that were missing were the two the
 * old page carried as sections without a landmark — the stack, and the
 * owner themself. The stack is a cairn by the east path: one stone per
 * layer, which is what "where in the stack I work" looks like as a thing.
 * The owner stands at the crossroads, where a guide would.
 */
export type PlaceId =
  | "about"
  | "projects"
  | "skills"
  | "writing"
  | "career"
  | "certificates"
  | "contact";

export type Place = {
  id: PlaceId;
  /** The section's name: what the journal and the atlas call it. */
  label: string;
  /** The landmark's name: what you see when you get there. */
  landmark: string;
  /** One line under the label: what you will find there. */
  blurb: string;
  /** The quest line in the journal, as an instruction. */
  quest: string;
  /**
   * The page this section also has, if it has one. `/contact` is where the
   * form lives; the lighthouse has no page of its own because a project does.
   */
  href: string | null;
  /** Ground position: [x, z]. */
  at: [number, number];
  /** Where the signpost floats, as a height above the ground at `at`. */
  labelHeight: number;
  /**
   * How far from `at` the ground is taken: the player cannot walk closer
   * than this, and the door is just outside it.
   */
  footprint: number;
  /** Interaction reach beyond the footprint. */
  reach: number;
};

export const PLACES: Place[] = [
  {
    id: "about",
    label: "About",
    landmark: "The crossroads",
    blurb: "Where every path starts",
    quest: "Meet Khôi at the signpost",
    href: null,
    at: [0, 0],
    labelHeight: 3.2,
    footprint: 0.55,
    reach: 2.2,
  },
  {
    id: "projects",
    label: "Projects",
    landmark: "The lighthouse",
    blurb: "Selected work",
    quest: "Climb the hill to the lighthouse",
    href: null,
    at: [6.4, 1.6],
    labelHeight: 5.6,
    footprint: 2.7,
    reach: 2.0,
  },
  {
    id: "skills",
    label: "Skills",
    landmark: "The cairn",
    blurb: "Where in the stack I work",
    quest: "Read the cairn by the east path",
    href: null,
    at: [5.6, -4.6],
    labelHeight: 3.0,
    footprint: 1.0,
    reach: 1.9,
  },
  {
    id: "writing",
    label: "Writing",
    landmark: "The big tree",
    blurb: "Notes from the build",
    quest: "Sit under the big tree",
    href: "/blog",
    at: [-6.2, -3.6],
    labelHeight: 5.4,
    footprint: 1.0,
    reach: 2.2,
  },
  {
    id: "career",
    label: "Career",
    landmark: "The mountain trail",
    blurb: "Where I have worked and studied",
    quest: "Walk the trail up the mountain",
    href: "/career-journey",
    at: [2.6, -7.2],
    labelHeight: 5.2,
    footprint: 3.3,
    reach: 2.0,
  },
  {
    id: "certificates",
    label: "Certificates",
    landmark: "The pavilion",
    blurb: "Courses and credentials",
    quest: "Visit the pavilion",
    href: "/certificates",
    at: [-6.8, 2.6],
    labelHeight: 3.4,
    footprint: 2.1,
    reach: 2.0,
  },
  {
    id: "contact",
    label: "Contact",
    landmark: "The cabin",
    blurb: "Send me a message",
    quest: "Knock at the cabin door",
    href: "/contact",
    at: [-1.2, 6.6],
    labelHeight: 3.6,
    footprint: 1.7,
    reach: 2.1,
  },
];

/** The places with a landmark of their own — everything but the crossroads. */
export const LANDMARKS = PLACES.filter((place) => place.id !== "about");

export function placeById(id: PlaceId): Place {
  const place = PLACES.find((entry) => entry.id === id);
  if (!place) throw new Error(`Unknown place: ${id}`);
  return place;
}

export function isPlaceId(value: string): value is PlaceId {
  return PLACES.some((place) => place.id === value);
}

/**
 * Where to stand at a place: just outside its footprint, on the side the
 * crossroads is on, because that is the side the path arrives from.
 */
export function doorOf(place: Place): [number, number] {
  const [x, z] = place.at;
  const length = Math.hypot(x, z);
  if (length < 0.001) return [0, 1.7];
  const back = place.footprint + 0.7;
  return [x - (x / length) * back, z - (z / length) * back];
}

/** The order the journal lists quests in — the order a first visit should take. */
export const QUEST_ORDER: PlaceId[] = [
  "about",
  "projects",
  "skills",
  "writing",
  "career",
  "certificates",
  "contact",
];
