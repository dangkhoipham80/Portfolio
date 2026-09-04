/**
 * The places on the island, which are the site's sections.
 *
 * Positions are in scene units on the ground plane (x across, z towards the
 * camera). The island is a disc of radius ~11; the crossroads is the origin
 * and every path runs from there. Kept as data rather than JSX so the scene,
 * the signposts and the fallback strip all read one list and cannot disagree
 * about where a place is or what it is called.
 */
export type PlaceId = "projects" | "writing" | "career" | "certificates" | "contact";

export type Place = {
  id: PlaceId;
  label: string;
  /** One line under the label: what you will find there. */
  blurb: string;
  href: string;
  /** Ground position: [x, z]. */
  at: [number, number];
  /** Where the signpost floats, as a height above the ground at `at`. */
  labelHeight: number;
};

export const PLACES: Place[] = [
  {
    id: "projects",
    label: "Projects",
    blurb: "The lighthouse — selected work",
    href: "/#projects",
    at: [6.4, 1.6],
    labelHeight: 5.6,
  },
  {
    id: "writing",
    label: "Writing",
    blurb: "The big tree — notes from the build",
    href: "/blog",
    at: [-6.2, -3.6],
    labelHeight: 5.4,
  },
  {
    id: "career",
    label: "Career",
    blurb: "The mountain trail — where I have worked",
    href: "/career-journey",
    at: [2.6, -7.2],
    labelHeight: 5.2,
  },
  {
    id: "certificates",
    label: "Certificates",
    blurb: "The pavilion — courses and credentials",
    href: "/certificates",
    at: [-6.8, 2.6],
    labelHeight: 3.4,
  },
  {
    id: "contact",
    label: "Contact",
    blurb: "The cabin — send me a message",
    href: "/contact",
    at: [-1.2, 6.6],
    labelHeight: 3.6,
  },
];

export function placeById(id: PlaceId): Place {
  const place = PLACES.find((entry) => entry.id === id);
  if (!place) throw new Error(`Unknown place: ${id}`);
  return place;
}
