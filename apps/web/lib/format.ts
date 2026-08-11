import type { ProjectStatus, SkillLevel } from "./types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Render an API date as "March 2024".
 *
 * Parses the ISO string by hand instead of `new Date(value)`. A date-only
 * string is parsed as UTC midnight, so anywhere west of Greenwich
 * `new Date("2024-03-01").getMonth()` is February — every date on the site
 * would be a month early for roughly half the world. Splitting the string
 * avoids the timezone round trip entirely.
 */
export function formatMonthYear(value: string | null): string | null {
  if (!value) return null;

  const [year, month] = value.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || !year) return value;

  return `${monthName} ${year}`;
}

/**
 * The date part of an API timestamp, as `2026-08-09`.
 *
 * Sliced, not parsed, for the same reason as above and then some:
 * `published_at` is a full instant with an offset, so `new Date()` would move
 * the day for any reader whose timezone crosses midnight relative to it — a
 * post published on the 9th would be dated the 8th in Los Angeles. The stored
 * UTC day is the day it was published, and it reads the same for everyone.
 *
 * Also the format `<time datetime>` wants.
 */
export function isoDay(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

/** "9 August 2026" — a post is dated to the day, unlike a role or a project. */
export function formatFullDate(value: string | null): string | null {
  const day = isoDay(value);
  if (!day) return null;

  const [year, month, date] = day.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || !year || !date) return day;

  return `${Number(date)} ${monthName} ${year}`;
}

/** "December 2024 — March 2025", or "… — Present" while it is still running. */
export function formatPeriod(startedOn: string | null, endedOn: string | null): string {
  const start = formatMonthYear(startedOn);
  if (!start) return "";

  // A null end date is how the API marks the current role or an in-flight
  // project. It is not missing data.
  return `${start} — ${formatMonthYear(endedOn) ?? "Present"}`;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export function statusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Matches the colour coding the Vite app used for each status. */
export const STATUS_CLASSES: Record<ProjectStatus, string> = {
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  on_hold: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  dropped: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const LEVEL_LABELS: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export function levelLabel(level: SkillLevel): string {
  return LEVEL_LABELS[level] ?? level;
}

/** How full the bar reads for each named level. */
export const LEVEL_WIDTH: Record<SkillLevel, string> = {
  beginner: "25%",
  intermediate: "50%",
  advanced: "75%",
  expert: "100%",
};
