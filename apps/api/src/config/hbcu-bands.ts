export interface BandChannelConfig {
  name: string;
  school: string;
  city: string;
  state: string;
  channelId?: string;
  channelHandle?: string;
  playlistIds?: string[];
  keywords: string[];
}

export const CONFERENCES = [
  'SWAC', 'MEAC', 'SIAC', 'CIAA', 'GCAC', 'Independent'
];

export const DIVISIONS = [
  'NCAA Division I', 'NCAA Division II', 'NAIA'
];

export const HBCU_BANDS: BandChannelConfig[] = [
  // ==========================================
  // SWAC (Southwestern Athletic Conference)
  // ==========================================
  {
    name: "Southern University Human Jukebox",
    school: "Southern University",
    city: "Baton Rouge",
    state: "Louisiana",
    channelHandle: "@SouthernUniversityBand",
    keywords: ["southern university", "human jukebox", "swac", "baton rouge", "su", "jags", "jaguars", "southern u"]
  },
  {
    name: "Jackson State Sonic Boom of the South",
    school: "Jackson State University",
    city: "Jackson",
    state: "Mississippi",
    channelHandle: "@JSUBands",
    keywords: ["jackson state", "sonic boom", "swac", "mississippi", "jsu", "sbots", "sonic boom of the south", "tigers"]
  },
  {
    name: "Florida A&M Marching 100",
    school: "Florida A&M University",
    city: "Tallahassee",
    state: "Florida",
    channelHandle: "@FAMUBand",
    keywords: ["famu", "marching 100", "swac", "tallahassee", "rattlers", "florida a&m", "florida am", "the 100"]
  },
  {
    name: "Bethune-Cookman Marching Wildcats",
    school: "Bethune-Cookman University",
    city: "Daytona Beach",
    state: "Florida",
    channelHandle: "@TheMarchingWildcats",
    keywords: ["bethune cookman", "marching wildcats", "swac", "daytona", "bcu", "bethune-cookman", "wildcats"]
  },
  {
    name: "Texas Southern Ocean of Soul",
    school: "Texas Southern University",
    city: "Houston",
    state: "Texas",
    channelHandle: "@TexasSouthernBand",
    keywords: ["texas southern", "ocean of soul", "swac", "houston", "txsu", "tsu", "tigers"]
  },
  {
    name: "Grambling State Tiger Marching Band",
    school: "Grambling State University",
    city: "Grambling",
    state: "Louisiana",
    channelHandle: "@GramblingBand",
    keywords: ["grambling", "tiger marching band", "world famed", "swac", "louisiana", "gsu", "grambling state", "g-men", "tigers"]
  },
  {
    name: "Prairie View A&M Marching Storm",
    school: "Prairie View A&M University",
    city: "Prairie View",
    state: "Texas",
    keywords: ["prairie view", "marching storm", "swac", "pvamu", "pv", "panthers"]
  },
  {
    name: "Alabama State Mighty Marching Hornets",
    school: "Alabama State University",
    city: "Montgomery",
    state: "Alabama",
    channelHandle: "@MightyMarchingHornets",
    keywords: ["alabama state", "mighty marching hornets", "swac", "montgomery", "asu", "bama state", "mmh", "hornets"]
  },
  {
    name: "Alabama A&M Marching Maroon and White",
    school: "Alabama A&M University",
    city: "Huntsville",
    state: "Alabama",
    keywords: ["alabama a&m", "marching maroon and white", "swac", "huntsville", "aamu", "alabama am", "maroon and white", "bulldogs"]
  },
  {
    name: "Alcorn State Sounds of Dyn-O-Mite",
    school: "Alcorn State University",
    city: "Lorman",
    state: "Mississippi",
    keywords: ["alcorn state", "sounds of dyn-o-mite", "sod", "swac", "mississippi", "sounds of dynomite", "dynomite", "braves"]
  },
  {
    name: "Mississippi Valley State Mean Green Marching Machine",
    school: "Mississippi Valley State University",
    city: "Itta Bena",
    state: "Mississippi",
    keywords: ["mississippi valley state", "mean green marching machine", "swac", "mvsu", "mississippi valley", "valley", "mean green", "mgmm", "delta devils", "devils"]
  },
  {
    name: "UAPB Marching Musical Machine of the Mid-South",
    school: "University of Arkansas at Pine Bluff",
    city: "Pine Bluff",
    state: "Arkansas",
    keywords: ["uapb", "m4", "marching musical machine", "swac", "arkansas", "university of arkansas at pine bluff"]
  },

  // ==========================================
  // MEAC (Mid-Eastern Athletic Conference)
  // ==========================================
  {
    name: "Howard University Showtime Marching Band",
    school: "Howard University",
    city: "Washington",
    state: "Washington DC",
    channelHandle: "@HowardUniversityBand",
    keywords: ["howard university", "showtime", "meac", "washington dc", "bison"]
  },
  {
    name: "North Carolina Central Sound Machine",
    school: "North Carolina Central University",
    city: "Durham",
    state: "North Carolina",
    keywords: ["nccu", "sound machine", "meac", "durham", "eagles", 'north carolina central', 'nccu', 'sound machine', 'nc central',
    'ncc university', 'durham eagles', 'north carolina central university']
  },
  {
    name: "Norfolk State Spartan Legion",
    school: "Norfolk State University",
    city: "Norfolk",
    state: "Virginia",
    keywords: ["norfolk state", "spartan legion", "meac", "virginia", "behold", "nsu", "spartans"]
  },
  {
    name: "Morgan State Magnificent Marching Machine",
    school: "Morgan State University",
    city: "Baltimore",
    state: "Maryland",
    keywords: ["morgan state", "magnificent marching machine", "meac", "baltimore", "bears"]
  },
  {
    name: "South Carolina State Marching 101",
    school: "South Carolina State University",
    city: "Orangeburg",
    state: "South Carolina",
    keywords: ["sc state", "marching 101", "meac", "orangeburg", "bulldogs"]
  },
  {
    name: "Delaware State Approaching Storm",
    school: "Delaware State University",
    city: "Dover",
    state: "Delaware",
    keywords: ["delaware state", "approaching storm", "meac", "dover", "hornets"]
  },

  // ==========================================
  // CIAA (Central Intercollegiate Athletic Association)
  // ==========================================
  {
    name: "Virginia State Trojan Explosion",
    school: "Virginia State University",
    city: "Petersburg",
    state: "Virginia",
    keywords: ["virginia state", "trojan explosion", "ciaa", "petersburg", "trojans"]
  },
  {
    name: "Winston-Salem State Red Sea of Sound",
    school: "Winston-Salem State University",
    city: "Winston-Salem",
    state: "North Carolina",
    keywords: ["wssu", "red sea of sound", "ciaa", "winston-salem", "rams"]
  },
  {
    name: "Bowie State Symphony of Soul",
    school: "Bowie State University",
    city: "Bowie",
    state: "Maryland",
    keywords: ["bowie state", "symphony of soul", "ciaa", "maryland", "bulldogs", "marching bulldogs"]
  },
  {
    name: "Elizabeth City State Marching Sound of Class",
    school: "Elizabeth City State University",
    city: "Elizabeth City",
    state: "North Carolina",
    keywords: ["ecsu", "sound of class", "ciaa", "vikings"]
  },
  {
    name: "Fayetteville State Marching Bronco Express",
    school: "Fayetteville State University",
    city: "Fayetteville",
    state: "North Carolina",
    keywords: ["fayetteville state", "bronco express", "ciaa", "broncos", "blue and white machine"]
  },
  {
    name: "Shaw University Platinum Sound",
    school: "Shaw University",
    city: "Raleigh",
    state: "North Carolina",
    keywords: ["shaw university", "platinum sound", "ciaa", "raleigh", "bears"]
  },
  {
    name: "Virginia Union Ambassadors of Sound",
    school: "Virginia Union University",
    city: "Richmond",
    state: "Virginia",
    keywords: ["virginia union", "ambassadors of sound", "ciaa", "richmond", "panthers", "vuu"]
  },
  {
    name: "Johnson C. Smith International Institution of Sound",
    school: "Johnson C. Smith University",
    city: "Charlotte",
    state: "North Carolina",
    keywords: ["jcsu", "international institution of sound", "iiovs", "ciaa", "charlotte"]
  },
  {
    name: "Livingstone College Blue Thunder",
    school: "Livingstone College",
    city: "Salisbury",
    state: "North Carolina",
    keywords: ["livingstone", "blue thunder", "ciaa", "blue bears"]
  },
  {
    name: "Lincoln University Orange Crush",
    school: "Lincoln University",
    city: "Lincoln University",
    state: "Pennsylvania",
    keywords: ["lincoln university", "orange crush", "ciaa", "pennsylvania", "lions"]
  },
  {
    name: "Bluefield State Blue Soul Marching Band",
    school: "Bluefield State University",
    city: "Bluefield",
    state: "West Virginia",
    keywords: ["bluefield state", "blue soul", "ciaa", "west virginia"]
  },

  // ==========================================
  // SIAC (Southern Intercollegiate Athletic Conference)
  // ==========================================
  {
    name: "Miles College Purple Marching Machine",
    school: "Miles College",
    city: "Fairfield",
    state: "Alabama",
    keywords: ["miles college", "purple marching machine", "siac", "pmm", "purple machine"]
  },
  {
    name: "Tuskegee University Golden Voices",
    school: "Tuskegee University",
    city: "Tuskegee",
    state: "Alabama",
    keywords: ["tuskegee", "golden voices", "marching crimson pipers", "siac", "tu", "marching crimson piper", "mcp", "crimson piper", "golden tigers", "tuskegee university"]
  },
  {
    name: "Albany State Marching Rams Show Band",
    school: "Albany State University",
    city: "Albany",
    state: "Georgia",
    keywords: ["albany state", "marching rams", "siac", "asu", "mrsb", "marching rams show band", "golden rams", "albany state university"]
  },
  {
    name: "Benedict College Band of Distinction",
    school: "Benedict College",
    city: "Columbia",
    state: "South Carolina",
    keywords: ["benedict college", "band of distinction", "siac", "tigers", "benedict college"]
  },
  {
    name: "Fort Valley State Blue Machine",
    school: "Fort Valley State University",
    city: "Fort Valley",
    state: "Georgia",
    keywords: ["fort valley state", "blue machine", "siac", "wildcats", "fort valley state university"]
  },
  {
    name: "Savannah State Powerhouse of the South",
    school: "Savannah State University",
    city: "Savannah",
    state: "Georgia",
    keywords: ["savannah state", "powerhouse of the south", "siac", "tigers", "ssu", "marching band", "savannah state university"]
  },
  {
    name: "Clark Atlanta Mighty Marching Panthers",
    school: "Clark Atlanta University",
    city: "Atlanta",
    state: "Georgia",
    keywords: ["clark atlanta", "mighty marching panthers", "siac", "atlanta", "cau", "mighty marching panther band", "panthers", "clark atlanta university"]
  },
  {
    name: "Morehouse College House of Funk",
    school: "Morehouse College",
    city: "Atlanta",
    state: "Georgia",
    keywords: ["morehouse", "house of funk", "siac", "maroon tigers", "morehouse college"]
  },
  {
    name: "Central State Invincible Marching Marauders",
    school: "Central State University",
    city: "Wilberforce",
    state: "Ohio",
    keywords: ["central state", "invincible marching marauders", "siac", "central state university", "marauders"]
  },
  {
    name: "Kentucky State Mighty Marching Thorobreds",
    school: "Kentucky State University",
    city: "Frankfort",
    state: "Kentucky",
    keywords: ["kentucky state", "mighty marching thorobreds", "siac", "thorobreds", "kentucky state university"]
  },
  {
    name: "Lane College Quiet Storm",
    school: "Lane College",
    city: "Jackson",
    state: "Tennessee",
    keywords: ["lane college", "quiet storm", "siac", "dragons", "lane college"]
  },
  {
    name: "Edward Waters Triple Threat Marching Band",
    school: "Edward Waters University",
    city: "Jacksonville",
    state: "Florida",
    keywords: ["edward waters", "triple threat", "siac", "tigers", "ewu"]
  },

  // ==========================================
  // CAA (Coastal Athletic Association)
  // ==========================================
  {
    name: "North Carolina A&T Blue and Gold Marching Machine",
    school: "North Carolina A&T State University",
    city: "Greensboro",
    state: "North Carolina",
    channelHandle: "@NCATBand",
    keywords: ["nc a&t", "blue and gold", "marching machine", "caa", "bgmm"]
  },
  {
    name: "Hampton University Marching Force",
    school: "Hampton University",
    city: "Hampton",
    state: "Virginia",
    keywords: ["hampton university", "marching force", "caa", "pirates"]
  },

  // ==========================================
  // OVC (Ohio Valley Conference)
  // ==========================================
  {
    name: "Tennessee State Aristocrat of Bands",
    school: "Tennessee State University",
    city: "Nashville",
    state: "Tennessee",
    keywords: ["tennessee state", "aristocrat of bands", "ovc", "aob", "tsu", "tigers"]
  },

  // ==========================================
  // GCAC / NAIA / Independent
  // ==========================================
  {
    name: "Talladega College Great Tornado",
    school: "Talladega College",
    city: "Talladega",
    state: "Alabama",
    keywords: ["talladega", "great tornado", "marching band"]
  },
  {
    name: "Langston University Marching Pride",
    school: "Langston University",
    city: "Langston",
    state: "Oklahoma",
    keywords: ["langston", "marching pride", "lump", "lions"]
  },
  {
    name: "Florida Memorial The Roar",
    school: "Florida Memorial University",
    city: "Miami Gardens",
    state: "Florida",
    keywords: ["florida memorial", "the roar", "fmu", "lions"]
  },
  {
    name: "Allen University Band of Gold",
    school: "Allen University",
    city: "Columbia",
    state: "South Carolina",
    keywords: ["allen university", "band of gold", "au", "yellow jackets"]
  },
  {
    name: "Fisk University Music City Sound",
    school: "Fisk University",
    city: "Nashville",
    state: "Tennessee",
    keywords: ["fisk university", "music city sound", "bulldogs"]
  },
  {
    name: "Wiley University Marching Grandioso",
    school: "Wiley University",
    city: "Marshall",
    state: "Texas",
    keywords: ["wiley", "marching grandioso", "wildcats"]
  },
  {
    name: "Saint Augustine's Superior Sound",
    school: "Saint Augustine's University",
    city: "Raleigh",
    state: "North Carolina",
    keywords: ["saint augustine", "superior sound", "falcons"]
  },
  {
    name: "Rust College Marching Bearcats",
    school: "Rust College",
    city: "Holly Springs",
    state: "Mississippi",
    keywords: ["rust college", "marching bearcats", "mississippi"]
  },
  {
    name: "Texas College Marching Steers",
    school: "Texas College",
    city: "Tyler",
    state: "Texas",
    keywords: ["texas college", "marching steers", "tyler", "texas"]
  },
  {
    name: "Tougaloo College Marching Band",
    school: "Tougaloo College",
    city: "Tougaloo",
    state: "Mississippi",
    keywords: ["tougaloo", "marching band", "jacktown", "mississippi"]
  },

];

export const KNOWN_BAND_NAMES = HBCU_BANDS.map(b => b.name);
export const KNOWN_SCHOOL_NAMES = HBCU_BANDS.map(b => b.school);
export const KNOWN_KEYWORDS = HBCU_BANDS.map(b => b.keywords).flat();