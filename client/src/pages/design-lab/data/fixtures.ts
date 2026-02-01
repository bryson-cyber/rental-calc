// Mock data for design lab variants - consistent across all variations

export const mockRegulationResult = {
  city: "Austin",
  state: "TX",
  status: "allowed_with_requirements" as const,
  yesNoSummary: "Yes, you can operate a short-term rental in Austin with proper licensing.",
  summary: "Austin allows short-term rentals but requires registration, licensing, and compliance with occupancy limits. The city has specific rules for different property types and zones.",
  simplifiedSummary: "You can rent your place on Airbnb in Austin! You just need to get a license first and follow some simple rules about how many guests can stay.",
  keyRequirements: [
    "Must obtain Short-Term Rental License ($450/year)",
    "Property must pass safety inspection",
    "Maximum occupancy: 2 per bedroom + 2 additional",
    "Must collect and remit 15% Hotel Occupancy Tax",
    "Noise ordinance compliance required",
    "Parking requirements based on zone"
  ],
  permitRequired: true,
  primaryResidenceOnly: false,
  maxNightsPerYear: undefined,
  registrationFee: "$450/year",
  occupancyTax: "15%",
  zoningRestrictions: "Type 2 STRs not allowed in some residential zones",
  sources: [
    {
      title: "City of Austin STR Regulations",
      url: "https://www.austintexas.gov/str",
      type: "official" as const
    },
    {
      title: "Austin Code Department",
      url: "https://www.austintexas.gov/department/code",
      type: "official" as const
    }
  ],
  lastUpdated: "2024-01-15",
  confidence: "high" as const,
  warnings: ["Regulations may vary by specific zone - verify with city"],
  ordinanceNumber: "Ord. No. 20231116-047",
  governingJurisdiction: "City of Austin"
};

export const mockBannedResult = {
  city: "Santa Monica",
  state: "CA",
  status: "banned" as const,
  yesNoSummary: "No, short-term rentals under 30 days are not allowed in Santa Monica unless you're renting a room in your primary residence.",
  summary: "Santa Monica has some of the strictest STR regulations in the country. Whole-home rentals are prohibited. Only home-sharing (renting a room while present) is allowed for primary residents.",
  simplifiedSummary: "Santa Monica doesn't allow Airbnb-style rentals where you rent out your whole place. You can only rent out a room if you live there too.",
  keyRequirements: [
    "Only home-sharing allowed (host must be present)",
    "Must be primary residence",
    "Business license required",
    "14% Transient Occupancy Tax",
    "Maximum 2 guests per bedroom"
  ],
  permitRequired: true,
  primaryResidenceOnly: true,
  maxNightsPerYear: undefined,
  registrationFee: "$100/year",
  occupancyTax: "14%",
  zoningRestrictions: "Whole-home STRs prohibited citywide",
  sources: [
    {
      title: "Santa Monica Home-Sharing Ordinance",
      url: "https://www.santamonica.gov/housing",
      type: "official" as const
    }
  ],
  lastUpdated: "2024-01-10",
  confidence: "high" as const,
  warnings: ["Fines up to $500/day for violations"],
  ordinanceNumber: "SMMC 6.20",
  governingJurisdiction: "City of Santa Monica"
};

export const mockAllowedResult = {
  city: "Gatlinburg",
  state: "TN",
  status: "allowed" as const,
  yesNoSummary: "Yes! Gatlinburg is very STR-friendly with minimal restrictions.",
  summary: "Gatlinburg is one of the most STR-friendly markets in the US. The city's economy relies heavily on tourism, and short-term rentals are welcomed with minimal regulatory burden.",
  simplifiedSummary: "Great news! Gatlinburg loves vacation rentals. You just need a simple business license and you're good to go!",
  keyRequirements: [
    "Business license required ($15/year)",
    "State sales tax collection (9.75%)",
    "Basic safety requirements"
  ],
  permitRequired: false,
  primaryResidenceOnly: false,
  maxNightsPerYear: undefined,
  registrationFee: "$15/year",
  occupancyTax: "5%",
  zoningRestrictions: "None - STRs allowed in all zones",
  sources: [
    {
      title: "Gatlinburg Business Licensing",
      url: "https://www.gatlinburgtn.gov/business",
      type: "official" as const
    }
  ],
  lastUpdated: "2024-01-12",
  confidence: "high" as const,
  warnings: [],
  ordinanceNumber: undefined,
  governingJurisdiction: "City of Gatlinburg"
};
