import { STATES, COUNTRIES } from "@grantly/core";

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export const COURSE_LEVEL_OPTS = [
  { v: "school_11_12", l: "Class 11 / 12" },
  { v: "diploma", l: "Diploma" },
  { v: "iti", l: "ITI" },
  { v: "ug", l: "Undergraduate" },
  { v: "pg", l: "Postgraduate" },
  { v: "phd", l: "PhD" },
];

export const STREAM_OPTS = [
  { v: "engineering", l: "Engineering" },
  { v: "medical", l: "Medical" },
  { v: "science", l: "Science" },
  { v: "commerce", l: "Commerce" },
  { v: "arts", l: "Arts / Humanities" },
  { v: "law", l: "Law" },
  { v: "management", l: "Management" },
  { v: "computer_applications", l: "Computer applications" },
];

export const CATEGORY_OPTS = [
  { v: "GEN", l: "General" },
  { v: "OBC", l: "OBC" },
  { v: "SC", l: "SC" },
  { v: "ST", l: "ST" },
  { v: "EWS", l: "EWS" },
];

export const MINORITY_OPTS = [
  { v: "none", l: "None" },
  { v: "muslim", l: "Muslim" },
  { v: "christian", l: "Christian" },
  { v: "sikh", l: "Sikh" },
  { v: "buddhist", l: "Buddhist" },
  { v: "jain", l: "Jain" },
  { v: "parsi", l: "Parsi" },
];

export const STATE_OPTS = Object.entries(STATES)
  .map(([v, names]) => ({ v, l: title(names[0]) }))
  .sort((a, b) => a.l.localeCompare(b.l));

export const COUNTRY_OPTS = Object.entries(COUNTRIES)
  .filter(([v]) => v !== "IN")
  .map(([v, names]) => ({ v, l: v === "UK" || v === "US" || v === "EU" ? v : title(names[0]) }));

export const label = (opts: { v: string; l: string }[], v: string | null | undefined) => opts.find((o) => o.v === v)?.l ?? v ?? "—";
