/**
 * Mock mode. Runs when GOOGLE_PLACES_API_KEY is unset.
 *
 * These clinics are invented — the names, numbers and sites are not real
 * businesses. The point is to exercise the whole pipeline (search → dedupe →
 * score → export) so the tool can be demoed before anyone touches a credit card.
 * The UI shows a "Demo data" banner whenever this is the source.
 */

interface MockTemplate {
  name: string; // {CITY} is substituted
  keywordIds: string[];
  phone: boolean;
  site: string | null; // {city} substituted, lowercased
  rating: number | null;
  reviews: number | null;
  status?: string;
}

const TEMPLATES: MockTemplate[] = [
  { name: "{CITY} Hormone & Wellness Institute", keywordIds: ["hrt", "trt", "peptides"], phone: true, site: "{city}hormonewellness.example.com", rating: 4.9, reviews: 412 },
  { name: "Elevate Medical Weight Loss of {CITY}", keywordIds: ["weight_loss"], phone: true, site: "elevate-{city}.example.com", rating: 4.8, reviews: 286 },
  { name: "{CITY} Men's Vitality Clinic", keywordIds: ["trt", "sexual_health"], phone: true, site: "{city}mensvitality.example.com", rating: 4.7, reviews: 193 },
  { name: "Renew Peptide & Longevity — {CITY}", keywordIds: ["peptides", "anti_aging"], phone: true, site: "renewpeptide.example.com", rating: 4.9, reviews: 121 },
  { name: "Balance BHRT Center", keywordIds: ["hrt"], phone: true, site: "balancebhrt-{city}.example.com", rating: 4.6, reviews: 88 },
  { name: "{CITY} Metabolic & Weight Institute", keywordIds: ["weight_loss", "anti_aging"], phone: true, site: "{city}metabolic.example.com", rating: 4.4, reviews: 64 },
  { name: "Summit Sports Medicine & Regenerative", keywordIds: ["sports_med"], phone: true, site: "summitsportsmed.example.com", rating: 4.8, reviews: 157 },
  { name: "Pure IV Lounge {CITY}", keywordIds: ["iv_wellness"], phone: true, site: "pureivlounge.example.com", rating: 4.5, reviews: 231 },
  { name: "{CITY} Anti-Aging & Functional Medicine", keywordIds: ["anti_aging", "hrt"], phone: true, site: "{city}functionalmed.example.com", rating: 4.7, reviews: 76 },
  { name: "Optimal T Clinic", keywordIds: ["trt"], phone: true, site: null, rating: 4.2, reviews: 41 },
  { name: "New Leaf Weight Management", keywordIds: ["weight_loss"], phone: true, site: "newleafweight.example.com", rating: 4.1, reviews: 29 },
  { name: "{CITY} Intimate Health Center", keywordIds: ["sexual_health"], phone: true, site: "{city}intimatehealth.example.com", rating: 4.3, reviews: 52 },
  { name: "Vitality Med Spa & Wellness", keywordIds: ["iv_wellness", "anti_aging"], phone: true, site: "vitalitymedspa-{city}.example.com", rating: 4.6, reviews: 340 },
  { name: "Apex Hormone Therapy", keywordIds: ["hrt", "trt"], phone: true, site: "apexhormone.example.com", rating: 3.9, reviews: 18 },
  { name: "{CITY} GLP-1 Weight Clinic", keywordIds: ["weight_loss"], phone: true, site: "{city}glp1.example.com", rating: 4.9, reviews: 98 },
  { name: "Thrive Regenerative Medicine", keywordIds: ["sports_med", "peptides"], phone: true, site: "thriveregen.example.com", rating: 4.5, reviews: 67 },
  { name: "Desert Family Practice", keywordIds: ["weight_loss"], phone: true, site: null, rating: 3.4, reviews: 22 },
  { name: "Hers & His Hormone Co.", keywordIds: ["hrt", "trt"], phone: true, site: "hersandhis.example.com", rating: 4.8, reviews: 145 },
  { name: "{CITY} NAD+ Therapy Center", keywordIds: ["peptides", "iv_wellness"], phone: false, site: "nadcenter.example.com", rating: 4.4, reviews: 12 },
  { name: "Legacy Longevity Group", keywordIds: ["anti_aging", "peptides"], phone: true, site: "legacylongevity.example.com", rating: 5.0, reviews: 8 },
  { name: "Closed Wellness Clinic", keywordIds: ["hrt"], phone: false, site: null, rating: 3.1, reviews: 15, status: "CLOSED_PERMANENTLY" },
];

// Neutral street names so demo addresses read plausibly in any licensed city.
const STREETS = ["Medical Center Dr", "N Main St", "E Oak Ave", "Professional Plaza", "S Cedar Blvd", "W Park Ave", "Wellness Way", "N Ridge Rd", "E Commerce Dr", "S Meridian St"];

// Real area codes + ZIP prefixes per licensed state, so demo rows look believable.
const STATE_DIAL: Record<string, { area: string[]; zip: string }> = {
  AZ: { area: ["602", "480", "520", "623"], zip: "85" },
  CO: { area: ["303", "720", "970", "719"], zip: "80" },
  FL: { area: ["305", "407", "813", "954"], zip: "33" },
  GA: { area: ["404", "470", "678", "770"], zip: "30" },
  ID: { area: ["208", "986"], zip: "83" },
  IA: { area: ["515", "319", "563", "712"], zip: "50" },
  ME: { area: ["207"], zip: "04" },
  MN: { area: ["612", "651", "763", "952"], zip: "55" },
  MO: { area: ["314", "816", "417", "573"], zip: "63" },
  MT: { area: ["406"], zip: "59" },
  NM: { area: ["505", "575"], zip: "87" },
  NY: { area: ["212", "718", "585", "716"], zip: "10" },
  NV: { area: ["702", "725", "775"], zip: "89" },
  NC: { area: ["704", "919", "336", "980"], zip: "27" },
  UT: { area: ["801", "385", "435"], zip: "84" },
  WA: { area: ["206", "425", "253", "509"], zip: "98" },
  WI: { area: ["414", "608", "262", "920"], zip: "53" },
  WY: { area: ["307"], zip: "82" },
};

function dialFor(state: string) {
  return STATE_DIAL[state] ?? { area: ["555"], zip: "00" };
}

function slug(city: string) {
  return city.toLowerCase().replace(/[^a-z]/g, "");
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface MockPlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  addressComponents: { longText: string; shortText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  types: string[];
}

export function mockPlacesFor(keywordId: string, city: string, state: string): MockPlace[] {
  const matches = TEMPLATES.filter((t) => t.keywordIds.includes(keywordId));

  return matches.map((t) => {
    const name = t.name.replace("{CITY}", city);
    const h = hash(name + city);
    const num = 100 + (h % 9800);
    const street = STREETS[h % STREETS.length];
    const dial = dialFor(state);
    const zip = `${dial.zip}${String(100 + (h % 900))}`;

    return {
      id: `mock_${hash(name).toString(36)}`,
      displayName: { text: name },
      formattedAddress: `${num} ${street}, ${city}, ${state} ${zip}`,
      addressComponents: [
        { longText: city, shortText: city, types: ["locality"] },
        { longText: state, shortText: state, types: ["administrative_area_level_1"] },
        { longText: zip, shortText: zip, types: ["postal_code"] },
      ],
      ...(t.phone
        ? { nationalPhoneNumber: `(${dial.area[h % dial.area.length]}) ${200 + (h % 800)}-${1000 + (h % 9000)}` }
        : {}),
      ...(t.site ? { websiteUri: `https://${t.site.replace("{city}", slug(city))}` } : {}),
      ...(t.rating ? { rating: t.rating } : {}),
      ...(t.reviews ? { userRatingCount: t.reviews } : {}),
      businessStatus: t.status ?? "OPERATIONAL",
      types: ["health", "doctor", "point_of_interest"],
    };
  });
}
