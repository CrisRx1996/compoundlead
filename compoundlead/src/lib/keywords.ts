/**
 * Keyword groups mirror what QCRx says it specialises in on qcrxusa.com:
 * hormone optimisation, weight loss, sexual health, sports medicine, IV & vitamins.
 *
 * Each group is one checkbox. `queries` are the phrases actually sent to Google —
 * more phrases means better coverage but more API calls, so keep them tight.
 */

export interface KeywordGroup {
  id: string;
  label: string;
  hint: string;
  queries: string[];
  /** Weight used by the scorer — how strongly this group predicts a compounding buyer. */
  weight: number;
  defaultOn: boolean;
}

export const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    id: "weight_loss",
    label: "Medical weight loss / GLP-1",
    hint: "semaglutide, tirzepatide, weight management clinics",
    queries: ["medical weight loss clinic", "semaglutide weight loss clinic", "GLP-1 weight loss clinic"],
    weight: 30,
    defaultOn: true,
  },
  {
    id: "trt",
    label: "Testosterone / men's health",
    hint: "TRT, low T, men's clinics",
    queries: ["testosterone replacement therapy clinic", "men's health clinic low testosterone"],
    weight: 28,
    defaultOn: true,
  },
  {
    id: "hrt",
    label: "Hormone replacement / BHRT",
    hint: "bioidentical hormones, women's health, menopause",
    queries: ["hormone replacement therapy clinic", "bioidentical hormone doctor"],
    weight: 28,
    defaultOn: true,
  },
  {
    id: "peptides",
    label: "Peptide therapy",
    hint: "peptides, NAD+, longevity",
    queries: ["peptide therapy clinic", "NAD+ therapy clinic"],
    weight: 26,
    defaultOn: true,
  },
  {
    id: "sexual_health",
    label: "Sexual health",
    hint: "ED clinics, intimate wellness",
    queries: ["erectile dysfunction clinic", "sexual wellness clinic"],
    weight: 22,
    defaultOn: false,
  },
  {
    id: "sports_med",
    label: "Sports medicine / regenerative",
    hint: "sports med, joint injections, recovery",
    queries: ["sports medicine clinic", "regenerative medicine clinic"],
    weight: 18,
    defaultOn: false,
  },
  {
    id: "iv_wellness",
    label: "IV therapy / wellness",
    hint: "IV drips, vitamin infusion, med spa",
    queries: ["IV therapy clinic", "medical spa wellness clinic"],
    weight: 16,
    defaultOn: false,
  },
  {
    id: "anti_aging",
    label: "Anti-aging / longevity",
    hint: "age management, functional medicine",
    queries: ["anti-aging clinic", "functional medicine clinic"],
    weight: 20,
    defaultOn: false,
  },
];

/** Phrases that mean "this is not a prospect" — filtered out before scoring. */
export const EXCLUDE_TERMS = [
  "veterinary",
  "veterinarian",
  "animal hospital",
  "pet clinic",
  "compounding pharmacy", // competitors, not customers
  "cvs",
  "walgreens",
  "rite aid",
  "walmart pharmacy",
  "costco pharmacy",
  "urgent care",
  "emergency room",
  "dental",
  "dentist",
  "veterinary clinic",
];

export const groupById = (id: string) => KEYWORD_GROUPS.find((g) => g.id === id);
