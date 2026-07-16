/**
 * QCRx licensed states, transcribed from https://www.qcrxusa.com/licensed-states
 * (18 states as published). Edit this file when a licence is added or lapses.
 *
 * Cities are the population centres worth prospecting in each state, roughly
 * ordered by size. Not exhaustive — a free-text city box covers the rest.
 */

export interface StateDef {
  abbr: string;
  name: string;
  cities: string[];
}

export const STATES: StateDef[] = [
  {
    abbr: "NV",
    name: "Nevada",
    cities: ["Las Vegas", "Henderson", "North Las Vegas", "Reno", "Sparks", "Carson City", "Summerlin", "Boulder City", "Mesquite", "Elko"],
  },
  {
    abbr: "AZ",
    name: "Arizona",
    cities: ["Phoenix", "Scottsdale", "Mesa", "Chandler", "Gilbert", "Tempe", "Glendale", "Peoria", "Tucson", "Surprise", "Goodyear", "Flagstaff", "Prescott", "Sedona", "Yuma"],
  },
  {
    abbr: "CO",
    name: "Colorado",
    cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Boulder", "Highlands Ranch", "Littleton", "Greeley", "Pueblo", "Castle Rock", "Broomfield", "Vail", "Durango"],
  },
  {
    abbr: "FL",
    name: "Florida",
    cities: ["Miami", "Fort Lauderdale", "West Palm Beach", "Boca Raton", "Naples", "Tampa", "St. Petersburg", "Sarasota", "Orlando", "Winter Park", "Jacksonville", "Fort Myers", "Clearwater", "Tallahassee", "Gainesville", "Destin"],
  },
  {
    abbr: "GA",
    name: "Georgia",
    cities: ["Atlanta", "Alpharetta", "Marietta", "Roswell", "Sandy Springs", "Johns Creek", "Savannah", "Augusta", "Columbus", "Macon", "Athens", "Buckhead"],
  },
  {
    abbr: "ID",
    name: "Idaho",
    cities: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Coeur d'Alene", "Twin Falls", "Pocatello", "Eagle", "Ketchum"],
  },
  {
    abbr: "IA",
    name: "Iowa",
    cities: ["Des Moines", "West Des Moines", "Cedar Rapids", "Davenport", "Iowa City", "Ankeny", "Sioux City", "Waterloo", "Ames", "Dubuque"],
  },
  {
    abbr: "ME",
    name: "Maine",
    cities: ["Portland", "South Portland", "Lewiston", "Bangor", "Auburn", "Scarborough", "Brunswick", "Augusta"],
  },
  {
    abbr: "MN",
    name: "Minnesota",
    cities: ["Minneapolis", "St. Paul", "Bloomington", "Edina", "Plymouth", "Woodbury", "Eden Prairie", "Maple Grove", "Rochester", "Duluth", "St. Cloud", "Wayzata"],
  },
  {
    abbr: "MO",
    name: "Missouri",
    cities: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Chesterfield", "Lee's Summit", "St. Charles", "Independence", "Branson", "Clayton"],
  },
  {
    abbr: "MT",
    name: "Montana",
    cities: ["Billings", "Missoula", "Bozeman", "Great Falls", "Kalispell", "Helena", "Whitefish", "Butte"],
  },
  {
    abbr: "NM",
    name: "New Mexico",
    cities: ["Albuquerque", "Santa Fe", "Rio Rancho", "Las Cruces", "Roswell", "Farmington", "Taos"],
  },
  {
    abbr: "NY",
    name: "New York",
    cities: ["New York City", "Manhattan", "Brooklyn", "Queens", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "White Plains", "Scarsdale", "Great Neck", "Hamptons", "Saratoga Springs"],
  },
  {
    abbr: "NC",
    name: "North Carolina",
    cities: ["Charlotte", "Raleigh", "Durham", "Greensboro", "Winston-Salem", "Cary", "Chapel Hill", "Asheville", "Wilmington", "Huntersville", "Fayetteville", "Concord"],
  },
  {
    abbr: "UT",
    name: "Utah",
    cities: ["Salt Lake City", "Provo", "Orem", "Lehi", "Draper", "Sandy", "St. George", "Park City", "Ogden", "Layton", "American Fork"],
  },
  {
    abbr: "WA",
    name: "Washington",
    cities: ["Seattle", "Bellevue", "Kirkland", "Redmond", "Tacoma", "Spokane", "Vancouver", "Everett", "Olympia", "Bellingham", "Issaquah", "Gig Harbor"],
  },
  {
    abbr: "WI",
    name: "Wisconsin",
    cities: ["Milwaukee", "Madison", "Green Bay", "Brookfield", "Waukesha", "Appleton", "Kenosha", "Racine", "Oshkosh", "Mequon"],
  },
  {
    abbr: "WY",
    name: "Wyoming",
    cities: ["Cheyenne", "Casper", "Jackson", "Laramie", "Gillette", "Sheridan", "Rock Springs"],
  },
];

export const stateByAbbr = (abbr: string) => STATES.find((s) => s.abbr === abbr);
