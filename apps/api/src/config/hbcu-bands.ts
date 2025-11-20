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

export const HBCU_BANDS: BandChannelConfig[] = [
  // SWAC Bands
  {
    name: "Southern University Human Jukebox",
    school: "Southern University",
    city: "Baton Rouge",
    state: "Louisiana",
    channelHandle: "@SouthernUniversityBand",
    keywords: ["southern university", "human jukebox", "swac", "baton rouge"]
  },
  {
    name: "Jackson State Sonic Boom",
    school: "Jackson State University", 
    city: "Jackson",
    state: "Mississippi",
    channelHandle: "@JSUBands",
    keywords: ["jackson state", "sonic boom", "swac", "mississippi"]
  },
  {
    name: "Texas Southern Ocean of Soul",
    school: "Texas Southern University",
    city: "Houston",
    state: "Texas", 
    channelHandle: "@TexasSouthernBand",
    keywords: ["texas southern", "ocean of soul", "swac", "houston"]
  },
  {
    name: "Grambling State Tiger Marching Band",
    school: "Grambling State University",
    city: "Grambling",
    state: "Louisiana",
    channelHandle: "@GramblingBand",
    keywords: ["grambling", "tiger marching band", "swac", "louisiana"]
  },
  {
    name: "Prairie View A&M Marching Storm",
    school: "Prairie View A&M University", 
    city: "Prairie View",
    state: "Texas",
    keywords: ["prairie view", "marching storm", "swac", "pvamu"]
  },

  // MEAC Bands  
  {
    name: "North Carolina A&T Blue and Gold Marching Machine",
    school: "North Carolina A&T State University",
    city: "Greensboro",
    state: "North Carolina", 
    channelHandle: "@NCATBand",
    keywords: ["nc a&t", "blue and gold", "marching machine", "meac"]
  },
  {
    name: "Howard University Showtime Marching Band",
    school: "Howard University",
    city: "Washington",
    state: "Washington DC",
    channelHandle: "@HowardUniversityBand", 
    keywords: ["howard university", "showtime", "meac", "washington dc"]
  },
  {
    name: "Florida A&M Marching 100",
    school: "Florida A&M University",
    city: "Tallahassee",
    state: "Florida",
    channelHandle: "@FAMUBand",
    keywords: ["famu", "marching 100", "meac", "tallahassee"]
  },

  // CIAA Bands
  {
    name: "Norfolk State Spartan Legion",
    school: "Norfolk State University", 
    city: "Norfolk",
    state: "Virginia",
    keywords: ["norfolk state", "spartan legion", "ciaa", "virginia"]
  },
  {
    name: "Virginia State Trojan Explosion",
    school: "Virginia State University",
    city: "Petersburg",
    state: "Virginia", 
    keywords: ["virginia state", "trojan explosion", "ciaa"]
  },

  // SIAC Bands
  {
    name: "Bethune-Cookman Marching Wildcats",
    school: "Bethune-Cookman University",
    city: "Daytona Beach",
    state: "Florida",
    keywords: ["bethune cookman", "marching wildcats", "siac", "daytona"]
  },
  {
    name: "Tuskegee Golden Voices",
    school: "Tuskegee University", 
    city: "Tuskegee",
    state: "Alabama",
    keywords: ["tuskegee", "golden voices", "siac", "alabama"]
  }
];