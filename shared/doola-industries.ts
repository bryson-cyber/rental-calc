/**
 * Doola NAICS industry codes — fetched from /v1/partner/references/naics-codes
 * Last updated: 2026-07-29
 * 
 * These are the ONLY valid values for the "industry" field when creating a company via Doola.
 * The wizard MUST only offer these values.
 */

export interface DoolaNaicsCode {
  naicsCodeId: string;
  naicsCode: string;
  industry: string;
}

export const DOOLA_NAICS_CODES: DoolaNaicsCode[] = [
  {
    "naicsCodeId": "2o8v0ka3xoozhqzqL6rWkQihWnj",
    "naicsCode": "812990",
    "industry": "Personal services"
  },
  {
    "naicsCodeId": "2o8v0ka9SV9ixOXJkPx2A7pMT8R",
    "naicsCode": "524113",
    "industry": "Life insurance"
  },
  {
    "naicsCodeId": "2o8v0kaErSkBorD6F5q9PYODUVz",
    "naicsCode": "5629",
    "industry": "Remediation services"
  },
  {
    "naicsCodeId": "2o8v0kb9yoDYwoAvZmPFnWDj4jI",
    "naicsCode": "812199",
    "industry": "Tattoo salon"
  },
  {
    "naicsCodeId": "2o8v0kbFW1JNIb6y7RgpWscBJ2Y",
    "naicsCode": "812199",
    "industry": "Massage therapy"
  },
  {
    "naicsCodeId": "2o8v0kcaCWyPyi3LJFsCiTCFSyk",
    "naicsCode": "811111",
    "industry": "Auto repair"
  },
  {
    "naicsCodeId": "2o8v0kcGwlxUPI4x2pkA0oJMQxp",
    "naicsCode": "722513",
    "industry": "Fast food restaurant"
  },
  {
    "naicsCodeId": "2o8v0kcnhFU05Jk9wJnzI6PnjIf",
    "naicsCode": "517",
    "industry": "Telecommunications"
  },
  {
    "naicsCodeId": "2o8v0kdCoc2oq0bl12rHeRdoVkf",
    "naicsCode": "518210",
    "industry": "Data processing"
  },
  {
    "naicsCodeId": "2o8v0kderKFWAHfaEVZaTA7TGNP",
    "naicsCode": "23611",
    "industry": "Residential construction"
  },
  {
    "naicsCodeId": "2o8v0kdzPNDPMgFQwvWbUH12Voy",
    "naicsCode": "456120",
    "industry": "Hair products"
  },
  {
    "naicsCodeId": "2o8v0ke20hahIK2WOO0X0o0YkPN",
    "naicsCode": "81233",
    "industry": "Laundry service"
  },
  {
    "naicsCodeId": "2o8v0kf4QtjSe2hFkSD7mMO4OP3",
    "naicsCode": "81112",
    "industry": "Automotive customization"
  },
  {
    "naicsCodeId": "2o8v0kfanz5AlW36DYWziOBOnCd",
    "naicsCode": "5416",
    "industry": "Expert witness service"
  },
  {
    "naicsCodeId": "2o8v0kfKxjMsABuvZ1shSKOTnTO",
    "naicsCode": "623220",
    "industry": "Sober living"
  },
  {
    "naicsCodeId": "2o8v0kfL4RvfJ3o4VvG7zmqnVRb",
    "naicsCode": "423450",
    "industry": "Medical device sales"
  },
  {
    "naicsCodeId": "2o8v0kgEKXPdsOlXP7bC6qGlRjJ",
    "naicsCode": "5231",
    "industry": "Cryptocurrency brokerage"
  },
  {
    "naicsCodeId": "2o8v0kggXzS2fU6RWlRqGPXpTBQ",
    "naicsCode": "621399",
    "industry": "Acupuncture"
  },
  {
    "naicsCodeId": "2o8v0kgGyFVgknslpM0qYDtV7W6",
    "naicsCode": "541715",
    "industry": "Artificial intelligence"
  },
  {
    "naicsCodeId": "2o8v0kha4sf5zBGhV3O2HpNViXf",
    "naicsCode": "713930",
    "industry": "Marina services"
  },
  {
    "naicsCodeId": "2o8v0kidrCTEvxoMP0R2GDuWuBc",
    "naicsCode": "713940",
    "industry": "Fitness center"
  },
  {
    "naicsCodeId": "2o8v0kijDYXuKTpjuxi5SiuNrLZ",
    "naicsCode": "531110",
    "industry": "Rental property"
  },
  {
    "naicsCodeId": "2o8v0kijg02qiQ5wWaF5kUsZYdj",
    "naicsCode": "512110",
    "industry": "Video production"
  },
  {
    "naicsCodeId": "2o8v0kiZtDxmU1CUlE1VCU3z5JR",
    "naicsCode": "455219",
    "industry": "Ecommerce"
  },
  {
    "naicsCodeId": "2o8v0kJopPN05reu3HPrXdVqOgf",
    "naicsCode": "812112",
    "industry": "Esthetician"
  },
  {
    "naicsCodeId": "2o8v0kjULLfP31q1YC4DABwCVQN",
    "naicsCode": "11142",
    "industry": "Plant nursery"
  },
  {
    "naicsCodeId": "2o8v0kJxvP9LnzUq8LCrgL0GZNq",
    "naicsCode": "621320",
    "industry": "Optometrist service"
  },
  {
    "naicsCodeId": "2o8v0kK4gcYWUK2XYZEzgBrRMJN",
    "naicsCode": "459991",
    "industry": "Marijuana dispensary"
  },
  {
    "naicsCodeId": "2o8v0kKDBE5fYiYFsCCuSY2PT7a",
    "naicsCode": "561710",
    "industry": "Pest control"
  },
  {
    "naicsCodeId": "2o8v0kkDkxCwzRqUZ3XM8GXfs5X",
    "naicsCode": "484110",
    "industry": "General freight"
  },
  {
    "naicsCodeId": "2o8v0kKUvHaQ9Ko7qjOFCAsBWFQ",
    "naicsCode": "5418",
    "industry": "Media"
  },
  {
    "naicsCodeId": "2o8v0kL6FE3HmtUAsPksaEjxa90",
    "naicsCode": "5416",
    "industry": "Creative consulting"
  },
  {
    "naicsCodeId": "2o8v0klmxeq2db2c3uvnLWOutY6",
    "naicsCode": "48",
    "industry": "Hauling"
  },
  {
    "naicsCodeId": "2o8v0kLNrfT9L2JOegEpwl8X8mJ",
    "naicsCode": "541690",
    "industry": "Security consulting"
  },
  {
    "naicsCodeId": "2o8v0klO3dKU3jmhLWTzF23P8RE",
    "naicsCode": "315",
    "industry": "Apparel manufacturing"
  },
  {
    "naicsCodeId": "2o8v0kMCaxuA2W2WiKqOvXXrNgT",
    "naicsCode": "54169",
    "industry": "Oil and gas consulting"
  },
  {
    "naicsCodeId": "2o8v0kmEgAVLFfXmJ9ZjACtoxsH",
    "naicsCode": "713290",
    "industry": "Gambling services"
  },
  {
    "naicsCodeId": "2o8v0kmGKp18BgTIbHxZi1Pa43p",
    "naicsCode": "5324",
    "industry": "Equipment leasing"
  },
  {
    "naicsCodeId": "2o8v0kmiVBeKsYtFN8NPXEfBXIu",
    "naicsCode": "459991",
    "industry": "Smoke shop"
  },
  {
    "naicsCodeId": "2o8v0kNrEpkOB78uKbqqhcV4OE7",
    "naicsCode": "812112",
    "industry": "Cosmetology"
  },
  {
    "naicsCodeId": "2o8v0kNRmAA37LcNScDQB4xwHgA",
    "naicsCode": "624410",
    "industry": "Daycare"
  },
  {
    "naicsCodeId": "2o8v0knyerizIEJ5T2jKOn5PAuf",
    "naicsCode": "812320",
    "industry": "Dry cleaning"
  },
  {
    "naicsCodeId": "2o8v0koaalCtFqdU0CGx1B70BNO",
    "naicsCode": "52",
    "industry": "Fintech"
  },
  {
    "naicsCodeId": "2o8v0kOaJAfvK5rRHIYDySFCpFu",
    "naicsCode": "5614",
    "industry": "Credit repair"
  },
  {
    "naicsCodeId": "2o8v0kOlJTllXJFGSvRb895jcqu",
    "naicsCode": "722330",
    "industry": "Food truck"
  },
  {
    "naicsCodeId": "2o8v0kOOBFFD2MrDjCbf1eQCwtR",
    "naicsCode": "459991",
    "industry": "Dispensary"
  },
  {
    "naicsCodeId": "2o8v0kOR1I7fPwDlRCvlEUO34js",
    "naicsCode": "5239",
    "industry": "Investment advisors"
  },
  {
    "naicsCodeId": "2o8v0koU57K6U97OigytGcBj8BF",
    "naicsCode": "611430",
    "industry": "Coaching and consulting"
  },
  {
    "naicsCodeId": "2o8v0kP37tOPhTf9x5Hfe7elqW5",
    "naicsCode": "812910",
    "industry": "Pet daycare"
  },
  {
    "naicsCodeId": "2o8v0kP8aUA3TdmhQZt2X662KgO",
    "naicsCode": "812990",
    "industry": "Fitness coaching"
  },
  {
    "naicsCodeId": "2o8v0kPGJZqVwflqLKEOfXFUPlq",
    "naicsCode": "922190",
    "industry": "Safety"
  },
  {
    "naicsCodeId": "2o8v0kPUJv6ftV7cpCbfAKM9Wbg",
    "naicsCode": "541810",
    "industry": "Creative agency"
  },
  {
    "naicsCodeId": "2o8v0kPZTiKERnKA62OJfgPywjF",
    "naicsCode": "722410",
    "industry": "Nightclub"
  },
  {
    "naicsCodeId": "2o8v0kQ1a863hQoIOHIT0X1OgC6",
    "naicsCode": "523940",
    "industry": "Private equity"
  },
  {
    "naicsCodeId": "2o8v0kqF7LxFhdTnbmREipupLam",
    "naicsCode": "541613",
    "industry": "Digital marketing"
  },
  {
    "naicsCodeId": "2o8v0kqRJJzVZ6PXNBedJ2QVdz1",
    "naicsCode": "624410",
    "industry": "Babysitting"
  },
  {
    "naicsCodeId": "2o8v0kqwxR3n1EofIDQ9qm2h2Qj",
    "naicsCode": "524114",
    "industry": "Health insurance"
  },
  {
    "naicsCodeId": "2o8v0kR05enMasP7xtsXY7xvrPH",
    "naicsCode": "5414",
    "industry": "Designer"
  },
  {
    "naicsCodeId": "2o8v0kR3cpHvd6dMv5VgJoamAiN",
    "naicsCode": "561612",
    "industry": "Security services"
  },
  {
    "naicsCodeId": "2o8v0kr55C58KRSBBkX3Jm2F7A6",
    "naicsCode": "813920",
    "industry": "Organizing"
  },
  {
    "naicsCodeId": "2o8v0krn8mcog2UyGSTmTYppvVR",
    "naicsCode": "238990",
    "industry": "Crane operator"
  },
  {
    "naicsCodeId": "2o8v0kscfORjkW3kS9X3EGAFFbb",
    "naicsCode": "516",
    "industry": "Sports media"
  },
  {
    "naicsCodeId": "2o8v0kSKDS1Z9krOQVZDwt3UZb8",
    "naicsCode": "4411",
    "industry": "Auto sales"
  },
  {
    "naicsCodeId": "2o8v0kSmslf72AiGDKYW13Gdx7J",
    "naicsCode": "551112",
    "industry": "Conglomerate"
  },
  {
    "naicsCodeId": "2o8v0ksZKYz7aNLYV8sedgDZK6l",
    "naicsCode": "531110",
    "industry": "Vacation rentals"
  },
  {
    "naicsCodeId": "2o8v0kth7w7IcnoDCHaYsDwTml7",
    "naicsCode": "621",
    "industry": "Medical center"
  },
  {
    "naicsCodeId": "2o8v0ktymQwbvzbuoettikkmNa1",
    "naicsCode": "541511",
    "industry": "Online tech business"
  },
  {
    "naicsCodeId": "2o8v0kuDoglwbYOwynOb76Fhmdl",
    "naicsCode": "455219",
    "industry": "Gadget store"
  },
  {
    "naicsCodeId": "2o8v0kUjphWgaxlqP3M7icqCsFx",
    "naicsCode": "812910",
    "industry": "Pet boarding"
  },
  {
    "naicsCodeId": "2o8v0kUmDYqjYmXLw1WPsECza1k",
    "naicsCode": "561621",
    "industry": "Home security"
  },
  {
    "naicsCodeId": "2o8v0kuwc5FxTvUmvv83OIt40lC",
    "naicsCode": "513210",
    "industry": "Software"
  },
  {
    "naicsCodeId": "2o8v0kV1emV6RPBIjpLQWdRghvG",
    "naicsCode": "624190",
    "industry": "Marriage therapy"
  },
  {
    "naicsCodeId": "2o8v0kvDwEOdLiJnScsWqvMkoOv",
    "naicsCode": "5122",
    "industry": "Music record label"
  },
  {
    "naicsCodeId": "2o8v0kvpOP2RVr1WVxdoDvI7pRt",
    "naicsCode": "541320",
    "industry": "Landscape design"
  },
  {
    "naicsCodeId": "2o8v0kWK06IZHRR93s3IPeyoplj",
    "naicsCode": "621330",
    "industry": "Mental health counseling"
  },
  {
    "naicsCodeId": "2o8v0kwsQcPzbvqtiYDFFEzJm4V",
    "naicsCode": "713990",
    "industry": "Golf simulator"
  },
  {
    "naicsCodeId": "2o8v0kWviXkerS0q0hNaF2UnaZf",
    "naicsCode": "49211",
    "industry": "Food delivery courier"
  },
  {
    "naicsCodeId": "2o8v0kWx5yD2HQj1AzBoNzaJWrC",
    "naicsCode": "541410",
    "industry": "Interior decorating services"
  },
  {
    "naicsCodeId": "2o8v0kX43WXxW8x65FHPNNRDykd",
    "naicsCode": "541613",
    "industry": "Online marketing"
  },
  {
    "naicsCodeId": "2o8v0kxHZa6eZFT9hVYq5BaSu0a",
    "naicsCode": "812199",
    "industry": "Spray tanning"
  },
  {
    "naicsCodeId": "2o8v0kY0sAflvB0M7Xcw6W0ceYA",
    "naicsCode": "812199",
    "industry": "Spa"
  },
  {
    "naicsCodeId": "2o8v0kY6knkIsIz2cqERjZtBmy5",
    "naicsCode": "312120",
    "industry": "Brewery"
  },
  {
    "naicsCodeId": "2o8v0kYiTRJwGtSKQXzcedhvAT4",
    "naicsCode": "71",
    "industry": "Entertainment services"
  },
  {
    "naicsCodeId": "2o8v0kYPfj7qkW7U6GRtRKIeYDU",
    "naicsCode": "561990",
    "industry": "Auctioneering"
  },
  {
    "naicsCodeId": "2o8v0kzc5Lkx189Xqfs5NPMgQVq",
    "naicsCode": "722410",
    "industry": "Lounge"
  },
  {
    "naicsCodeId": "2o8v0kZmbhDaGpx4CURNsF6wbgT",
    "naicsCode": "713940",
    "industry": "Sports club"
  },
  {
    "naicsCodeId": "2o8v0kzn3anIITFSNJYTq1QPYQO",
    "naicsCode": "561622",
    "industry": "Locksmith"
  },
  {
    "naicsCodeId": "2o8v0kzsEiQyGEd9Q9Ak7sZDcok",
    "naicsCode": "711510",
    "industry": "Venue hire services"
  },
  {
    "naicsCodeId": "2o8v0kZSpdFjf6varg7FJdhpSxE",
    "naicsCode": "238320",
    "industry": "Commercial and residential painting"
  },
  {
    "naicsCodeId": "2o8v0kZx1cGbu8oZeChfPkYt6VZ",
    "naicsCode": "423920",
    "industry": "Sports cards"
  },
  {
    "naicsCodeId": "2o8v0kZyD87VPoUdQ8lLvZOWmIb",
    "naicsCode": "423910",
    "industry": "Sporting goods"
  },
  {
    "naicsCodeId": "2o8v0l09Sf6KEUrv6vG0ROEGhqU",
    "naicsCode": "5615",
    "industry": "Tourism services"
  },
  {
    "naicsCodeId": "2o8v0l0IMhHwA2FhkR8xtnIBerH",
    "naicsCode": "221",
    "industry": "Utilities"
  },
  {
    "naicsCodeId": "2o8v0l0NPxZRsyGrnVAK7nAhoWn",
    "naicsCode": "621399",
    "industry": "Health and wellness"
  },
  {
    "naicsCodeId": "2o8v0l0TxyjJbw5K0JqV66AhC9H",
    "naicsCode": "441120",
    "industry": "Used car sales"
  },
  {
    "naicsCodeId": "2o8v0l0Xsugzgk4ipdW0aloZ1zb",
    "naicsCode": "561790",
    "industry": "Pressure washing"
  },
  {
    "naicsCodeId": "2o8v0l3j7kD19rcNfGtUnwqSpTn",
    "naicsCode": "812910",
    "industry": "Pet grooming"
  },
  {
    "naicsCodeId": "2o8v0l3WeGStGhEL9tSyz4KyNmH",
    "naicsCode": "713290",
    "industry": "Gaming service"
  },
  {
    "naicsCodeId": "2o8v0l6LsH1mHhaakwODNy7Qi2t",
    "naicsCode": "812210",
    "industry": "Funeral services"
  },
  {
    "naicsCodeId": "2o8v0l72gy4KfV4VpWNU6yIdT9F",
    "naicsCode": "8114",
    "industry": "Handyman service"
  },
  {
    "naicsCodeId": "2o8v0l7CEu3rPBe54wT7FxR2h9I",
    "naicsCode": "48",
    "industry": "Freight transportation"
  },
  {
    "naicsCodeId": "2o8v0l7Hnb7yN3XE5LNbnQGVxEj",
    "naicsCode": "238320",
    "industry": "Painting"
  },
  {
    "naicsCodeId": "2o8v0l7v20bVMLDf8rimH89QBUa",
    "naicsCode": "459910",
    "industry": "Pet products"
  },
  {
    "naicsCodeId": "2o8v0l8i5MUo4chPMKvPiYfVMhb",
    "naicsCode": "541690",
    "industry": "Solar consulting"
  },
  {
    "naicsCodeId": "2o8v0l8XYkhXeAC7Wb8bbPBM3ii",
    "naicsCode": "53",
    "industry": "Housing - real estate"
  },
  {
    "naicsCodeId": "2o8v0l9eUIpgYFcBwf9qvNiFtRw",
    "naicsCode": "541612",
    "industry": "HR consulting"
  },
  {
    "naicsCodeId": "2o8v0l9i6uVTcIdEmXoTgJ0Dxl3",
    "naicsCode": "5629",
    "industry": "Restoration contractor"
  },
  {
    "naicsCodeId": "2o8v0lAIKah7mRgWlT1da9GmH2i",
    "naicsCode": "423450",
    "industry": "Medical sales"
  },
  {
    "naicsCodeId": "2o8v0lANcNTpEUMufRQik2Jdtqe",
    "naicsCode": "611610",
    "industry": "Dance studio"
  },
  {
    "naicsCodeId": "2o8v0lAPFJ8AeA2uUwb4EmgWMZP",
    "naicsCode": "712110",
    "industry": "Museum"
  },
  {
    "naicsCodeId": "2o8v0lasBNUVo4YACtrFvhAgY7O",
    "naicsCode": "54151",
    "industry": "SaaS"
  },
  {
    "naicsCodeId": "2o8v0lAwTdRH08oBh6iOB81uS4G",
    "naicsCode": "624410",
    "industry": "Youth care business"
  },
  {
    "naicsCodeId": "2o8v0lB1J2kHt1IjEl6k2DNUurO",
    "naicsCode": "5418",
    "industry": "Brand services"
  },
  {
    "naicsCodeId": "2o8v0lb2XyopbiYeSAAWNlsZ2KS",
    "naicsCode": "113",
    "industry": "Forestry"
  },
  {
    "naicsCodeId": "2o8v0lB5vkvR8x1I7rEGgKiWoiX",
    "naicsCode": "48",
    "industry": "Transportation"
  },
  {
    "naicsCodeId": "2o8v0lbAtsErndtbiXnzsdIuh2J",
    "naicsCode": "541618",
    "industry": "Sports management consulting"
  },
  {
    "naicsCodeId": "2o8v0lBclrlxQ3N5uOHeWb43vSO",
    "naicsCode": "236118",
    "industry": "Home improvement"
  },
  {
    "naicsCodeId": "2o8v0lBl3zbLAyYa4BAOIchqikS",
    "naicsCode": "611512",
    "industry": "Flight training"
  },
  {
    "naicsCodeId": "2o8v0lblAVxMaQAKKmSadXjzN6O",
    "naicsCode": "2213",
    "industry": "Water treatment"
  },
  {
    "naicsCodeId": "2o8v0lC1G6Bqw33nGJPRORdQrba",
    "naicsCode": "2211",
    "industry": "Energy"
  },
  {
    "naicsCodeId": "2o8v0lCeCFuL0mojoVbuip4TyPh",
    "naicsCode": "531210",
    "industry": "Real estate agent"
  },
  {
    "naicsCodeId": "2o8v0lClxDde5GXG31m3Z7mwzPP",
    "naicsCode": "531320",
    "industry": "Real estate appraisers"
  },
  {
    "naicsCodeId": "2o8v0lcMCrmNWHjsUwRF7Zvm7l4",
    "naicsCode": "711130",
    "industry": "Musician"
  },
  {
    "naicsCodeId": "2o8v0lcQ57yhmlZJrRLC1oLtWnx",
    "naicsCode": "541330",
    "industry": "Civil engineering"
  },
  {
    "naicsCodeId": "2o8v0ld94KvvX3OvqwYE4nx7ndD",
    "naicsCode": "561440",
    "industry": "Payment collections agency"
  },
  {
    "naicsCodeId": "2o8v0ldtlqCL3ULJa6mhpe1VAo5",
    "naicsCode": "238220",
    "industry": "HVAC"
  },
  {
    "naicsCodeId": "2o8v0lE26hchOBAuGWv0UJ2kzUt",
    "naicsCode": "713110",
    "industry": "Theme park"
  },
  {
    "naicsCodeId": "2o8v0le2sBaVZEJAYVl4W2hA3z7",
    "naicsCode": "32541",
    "industry": "Pharmaceutical"
  },
  {
    "naicsCodeId": "2o8v0leaPzHysvcP27RiRKEV7Xu",
    "naicsCode": "711510",
    "industry": "Influencer"
  },
  {
    "naicsCodeId": "2o8v0lEbpHFyMbabJD9HRh97fUq",
    "naicsCode": "611699",
    "industry": "Yoga instruction"
  },
  {
    "naicsCodeId": "2o8v0leItV48BnU0o2rZjuUv7Zo",
    "naicsCode": "221114",
    "industry": "Solar business"
  },
  {
    "naicsCodeId": "2o8v0lEsVESF0nqAgV4FVE7oiLY",
    "naicsCode": "611620",
    "industry": "Sports instruction"
  },
  {
    "naicsCodeId": "2o8v0lFG9wJcTxk8qdF0EN8Fwzx",
    "naicsCode": "455110",
    "industry": "Household supply store"
  },
  {
    "naicsCodeId": "2o8v0lfghL1UCBUAH2IlMHxRcBU",
    "naicsCode": "5417",
    "industry": "Scientific research"
  },
  {
    "naicsCodeId": "2o8v0lfIghTfAS8lZHTzsKYBhg6",
    "naicsCode": "512110",
    "industry": "Media production"
  },
  {
    "naicsCodeId": "2o8v0lfOnPXX1PuXCRTNP3eeLUg",
    "naicsCode": "541810",
    "industry": "Advertising"
  },
  {
    "naicsCodeId": "2o8v0lFZLv14PAd1ekNmrNRlOwG",
    "naicsCode": "5614",
    "industry": "Customer service"
  },
  {
    "naicsCodeId": "2o8v0lG5sxvSgRWHRmKHUXGA3kC",
    "naicsCode": "541690",
    "industry": "Energy consulting"
  },
  {
    "naicsCodeId": "2o8v0lhIWdzhJKi4IIu3H1mjn7o",
    "naicsCode": "813110",
    "industry": "Clergyman service"
  },
  {
    "naicsCodeId": "2o8v0lHMKPg2QwWsQ79g7E8UrJS",
    "naicsCode": "71",
    "industry": "Art"
  },
  {
    "naicsCodeId": "2o8v0lHX8xmGJsAn7HeEegGHLD6",
    "naicsCode": "111998",
    "industry": "Aquatic plants farming"
  },
  {
    "naicsCodeId": "2o8v0lHYBaXfuFROcRQY1PQ0Plz",
    "naicsCode": "56211",
    "industry": "Dumpster rental"
  },
  {
    "naicsCodeId": "2o8v0lJHDg0e2SOmRdmUazO0Bvn",
    "naicsCode": "62111",
    "industry": "Anesthesia services"
  },
  {
    "naicsCodeId": "2o8v0lJhkqhLHemypWldCnFDURa",
    "naicsCode": "458110",
    "industry": "Children's clothing"
  },
  {
    "naicsCodeId": "2o8v0ljj9esTsTQScGYbfMHBsOK",
    "naicsCode": "611692",
    "industry": "Driving school"
  },
  {
    "naicsCodeId": "2o8v0lK9CYharVVcoDJ72LZjYw2",
    "naicsCode": "8129",
    "industry": "General services"
  },
  {
    "naicsCodeId": "2o8v0lKh7EfXjQNvyKED0HgWGmn",
    "naicsCode": "315210",
    "industry": "Sewing and alteration"
  },
  {
    "naicsCodeId": "2o8v0lksivuYTkUi6hMoniKK9Yk",
    "naicsCode": "237210",
    "industry": "Land development"
  },
  {
    "naicsCodeId": "2o8v0lL60BuQHRv9YfRHBMu2V1G",
    "naicsCode": "484",
    "industry": "Trucking"
  },
  {
    "naicsCodeId": "2o8v0lLeAs3Cso8RBCtktzfSGhb",
    "naicsCode": "812199",
    "industry": "Day spa"
  },
  {
    "naicsCodeId": "2o8v0lLGWbUclzR7ftByhr5Hcu1",
    "naicsCode": "621330",
    "industry": "Psychotherapy"
  },
  {
    "naicsCodeId": "2o8v0lLJFxR4hWhsibkCl0JU4N0",
    "naicsCode": "531390",
    "industry": "Real estate services"
  },
  {
    "naicsCodeId": "2o8v0llW30evR6oGmzIoGutb90y",
    "naicsCode": "488410",
    "industry": "Roadside assistance"
  },
  {
    "naicsCodeId": "2o8v0lMA4esw5WTKbeXeR0AUqRT",
    "naicsCode": "711510",
    "industry": "Photographic art"
  },
  {
    "naicsCodeId": "2o8v0lMpXOI9GTeKOPXEKobb6B5",
    "naicsCode": "541430",
    "industry": "Digital design agency"
  },
  {
    "naicsCodeId": "2o8v0lMUsN3OavpTzM5JdtBTpbW",
    "naicsCode": "458110",
    "industry": "Clothing boutique"
  },
  {
    "naicsCodeId": "2o8v0lMw7wzk9rabDciEjn7kiat",
    "naicsCode": "325411",
    "industry": "Supplements"
  },
  {
    "naicsCodeId": "2o8v0lnB0dNzEpmRVURITCeYlsR",
    "naicsCode": "561720",
    "industry": "Office cleaning"
  },
  {
    "naicsCodeId": "2o8v0locb5KnlgyXVb4MknAHJ98",
    "naicsCode": "445320",
    "industry": "Liquor store"
  },
  {
    "naicsCodeId": "2o8v0lOHaiJMFHMQ257j61hQjQ8",
    "naicsCode": "48",
    "industry": "Shipping"
  },
  {
    "naicsCodeId": "2o8v0lONUUaHT9HtjYOnMeqQtk5",
    "naicsCode": "812199",
    "industry": "Teeth whitening services"
  },
  {
    "naicsCodeId": "2o8v0lOO3IWFbDne8X07F4uWkWh",
    "naicsCode": "541110",
    "industry": "Law practice"
  },
  {
    "naicsCodeId": "2o8v0lPLuKCHCLMiHhxv8Rcpmwn",
    "naicsCode": "532",
    "industry": "Rental and leasing services"
  },
  {
    "naicsCodeId": "2o8v0lpxiB8n2lyBx6WHdnkwKfc",
    "naicsCode": "812990",
    "industry": "Health and fitness coach"
  },
  {
    "naicsCodeId": "2o8v0lQBSiThtiH7IYLMPJiPOJx",
    "naicsCode": "621399",
    "industry": "Health coaching"
  },
  {
    "naicsCodeId": "2o8v0lqGfpquYTKWTYSPkApzu2K",
    "naicsCode": "621391",
    "industry": "Podiatrist service"
  },
  {
    "naicsCodeId": "2o8v0lSMI9MYLs7pDmQyE6Klzhr",
    "naicsCode": "522320",
    "industry": "Merchant services"
  },
  {
    "naicsCodeId": "2o8v0lSNar6nUhmYtMrqTIYV3Jd",
    "naicsCode": "238160",
    "industry": "Roofing"
  },
  {
    "naicsCodeId": "2o8v0lsOyS3mCQxRRu4Yq9wqW9V",
    "naicsCode": "481",
    "industry": "Aviation"
  },
  {
    "naicsCodeId": "2o8v0lSpXn3fc1VyMSIkKQj38LO",
    "naicsCode": "812112",
    "industry": "Hair care services"
  },
  {
    "naicsCodeId": "2o8v0lT34d9p4H7xZlihqVlDvEi",
    "naicsCode": "722515",
    "industry": "Ice cream shop"
  },
  {
    "naicsCodeId": "2o8v0lT7hrZIUAS8fv67dZxZwxu",
    "naicsCode": "561910",
    "industry": "Packaging and labeling services"
  },
  {
    "naicsCodeId": "2o8v0lta5KmaMfzNTkcGfStdCRO",
    "naicsCode": "315",
    "industry": "Apparel"
  },
  {
    "naicsCodeId": "2o8v0ltInbNUE9Z55ovjjtxzMoV",
    "naicsCode": "812111",
    "industry": "Barber examiner"
  },
  {
    "naicsCodeId": "2o8v0ltUIIQVo7tl9L64MTooIAP",
    "naicsCode": "621610",
    "industry": "Home care"
  },
  {
    "naicsCodeId": "2o8v0ltzyqzX1r2JCONboIOQc4d",
    "naicsCode": "611699",
    "industry": "CPR training"
  },
  {
    "naicsCodeId": "2o8v0luGv7Yh4KMZHYQUvWxsqIm",
    "naicsCode": "238320",
    "industry": "Painting and decorating"
  },
  {
    "naicsCodeId": "2o8v0luK9ON3Xjf0NNEbDug3oK8",
    "naicsCode": "541613",
    "industry": "SEO"
  },
  {
    "naicsCodeId": "2o8v0lulK8h3fqYhMrGluA3tYuz",
    "naicsCode": "621320",
    "industry": "Opticians"
  },
  {
    "naicsCodeId": "2o8v0lV619mWLV4SBpjR10MyzaX",
    "naicsCode": "541410",
    "industry": "Decorating business"
  },
  {
    "naicsCodeId": "2o8v0lVtWqcFMR7wbr9g7sNcOsv",
    "naicsCode": "621610",
    "industry": "Home health care"
  },
  {
    "naicsCodeId": "2o8v0lVwGxwS9jND2YLzHXmiRuw",
    "naicsCode": "722513",
    "industry": "Takeout restaurant"
  },
  {
    "naicsCodeId": "2o8v0lvZ6nBv62K2kcB7ucP9PlP",
    "naicsCode": "512110",
    "industry": "Production company"
  },
  {
    "naicsCodeId": "2o8v0lWDDZQhr0S3CPJgXiYE4Tn",
    "naicsCode": "541219",
    "industry": "Bookkeeping"
  },
  {
    "naicsCodeId": "2o8v0lwelqIfBswyg6DpGLv4PzT",
    "naicsCode": "722515",
    "industry": "Coffee shop"
  },
  {
    "naicsCodeId": "2o8v0lwKFt29LrADfhDrz7ieGWv",
    "naicsCode": "812990",
    "industry": "Personal coaching business"
  },
  {
    "naicsCodeId": "2o8v0lWMD5AzgRr4nmHBEmOA0fy",
    "naicsCode": "541613",
    "industry": "Internet marketing"
  },
  {
    "naicsCodeId": "2o8v0lwmkh2ca3aLzxPGyvvmiVa",
    "naicsCode": "561440",
    "industry": "Collection agency"
  },
  {
    "naicsCodeId": "2o8v0lwN5k1rDS1J8QvbUQbOeig",
    "naicsCode": "812112",
    "industry": "Eyelash extensions"
  },
  {
    "naicsCodeId": "2o8v0lXOohWmBAEU4hBrK24mdzN",
    "naicsCode": "8131",
    "industry": "Ministry"
  },
  {
    "naicsCodeId": "2o8v0lxWB27hcZil9EEe77iNFJh",
    "naicsCode": "541410",
    "industry": "Interior design"
  },
  {
    "naicsCodeId": "2o8v0lxXf9cUPqBM2Et3yclDLev",
    "naicsCode": "5161",
    "industry": "Broadcasting"
  },
  {
    "naicsCodeId": "2o8v0lxyUCagxq8hmnVqGa9AACY",
    "naicsCode": "541",
    "industry": "Professional services"
  },
  {
    "naicsCodeId": "2o8v0lYlG3hvogA7dhQls72qBqN",
    "naicsCode": "541512",
    "industry": "Automation"
  },
  {
    "naicsCodeId": "2o8v0lyyEPTLzMSIpGjfWeQyb7c",
    "naicsCode": "71121",
    "industry": "Sports team"
  },
  {
    "naicsCodeId": "2o8v0m0zu11Sr8xZ4ZP754GYlPh",
    "naicsCode": "541213",
    "industry": "Tax preparation"
  },
  {
    "naicsCodeId": "2o8v0m1MVpTEHO32Qn7fB7M7Wgj",
    "naicsCode": "5418",
    "industry": "Multimedia"
  },
  {
    "naicsCodeId": "2o8v0m1o6FmyHBRgbAruA7Y3vDQ",
    "naicsCode": "238",
    "industry": "Contractor"
  },
  {
    "naicsCodeId": "2o8v0m1tkTVePjFq3onm24mdnTy",
    "naicsCode": "721211",
    "industry": "Campground"
  },
  {
    "naicsCodeId": "2o8v0m2Fw3adVklvzgEdHlvZFVn",
    "naicsCode": "541330",
    "industry": "Engineering firm"
  },
  {
    "naicsCodeId": "2o8v0m2J2E8ThstduSYaYKGqVrH",
    "naicsCode": "621210",
    "industry": "Dentistry"
  },
  {
    "naicsCodeId": "2o8v0m2NFjiajjjPBexY4MWyjwE",
    "naicsCode": "513",
    "industry": "Publishing"
  },
  {
    "naicsCodeId": "2o8v0m2zIf7T4vbi5r5145iNXH8",
    "naicsCode": "541430",
    "industry": "Graphic design agency"
  },
  {
    "naicsCodeId": "2o8v0m3iGqps0eB8FYCruiym4JM",
    "naicsCode": "611620",
    "industry": "Golf instruction"
  },
  {
    "naicsCodeId": "2o8v0m3NTxBbpW4ZiMTsDUraAYn",
    "naicsCode": "561740",
    "industry": "Carpet cleaning"
  },
  {
    "naicsCodeId": "2o8v0m3Zv1tIZbgHOi6xX8ZQHRp",
    "naicsCode": "531110",
    "industry": "Airbnb rentals"
  },
  {
    "naicsCodeId": "2o8v0m411MpH2AojsjwtgcrOSoS",
    "naicsCode": "711510",
    "industry": "Arts and crafts"
  },
  {
    "naicsCodeId": "2o8v0m4EovywmGsZpVhG8wkIj1B",
    "naicsCode": "813920",
    "industry": "Professional organizing"
  },
  {
    "naicsCodeId": "2o8v0m4pQC8x0B9DHm3dZayTSaN",
    "naicsCode": "531",
    "industry": "Commercial real estate"
  },
  {
    "naicsCodeId": "2o8v0m68Q06FnhFp481vTDLy9QE",
    "naicsCode": "722410",
    "industry": "Bar"
  },
  {
    "naicsCodeId": "2o8v0m6gaoh2tQTbF27wtofuNrP",
    "naicsCode": "53211",
    "industry": "Car rental and leasing"
  },
  {
    "naicsCodeId": "2o8v0m6YktjrYs4MlUqN9sLlDqj",
    "naicsCode": "7113",
    "industry": "Event venue services"
  },
  {
    "naicsCodeId": "2o8v0m789igL3CL03cnyHxZXXMt",
    "naicsCode": "4885",
    "industry": "Dispatching services"
  },
  {
    "naicsCodeId": "2o8v0m7lOag3TavWPZwfLYatF0e",
    "naicsCode": "23",
    "industry": "Industrial - construction"
  },
  {
    "naicsCodeId": "2o8v0m7r8E07AJWTM0qGCdOxQcL",
    "naicsCode": "522220",
    "industry": "Sales financing"
  },
  {
    "naicsCodeId": "2o8v0m7XUll1WpW1kh7jwE86oBu",
    "naicsCode": "456120",
    "industry": "Cosmetics"
  },
  {
    "naicsCodeId": "2o8v0m8E14Sn84cB8fikZTwS0nD",
    "naicsCode": "621112",
    "industry": "Psychiatrist"
  },
  {
    "naicsCodeId": "2o8v0m8NBuvAXrdXUhubj20hbRV",
    "naicsCode": "459420",
    "industry": "Gift store"
  },
  {
    "naicsCodeId": "2o8v0m9VVflswLrpTHiApSlQ5Mw",
    "naicsCode": "621111",
    "industry": "Medical aesthetics"
  },
  {
    "naicsCodeId": "2o8v0m9yIhX86Tv18YATvxlRtnK",
    "naicsCode": "532284",
    "industry": "Boat rental"
  },
  {
    "naicsCodeId": "2o8v0ma4KlRDQbVXmO4W1YchOgB",
    "naicsCode": "512230",
    "industry": "Music publishing"
  },
  {
    "naicsCodeId": "2o8v0maUXPXuHGSPGAzcq2cRfaV",
    "naicsCode": "624410",
    "industry": "Childcare services"
  },
  {
    "naicsCodeId": "2o8v0mbSbnYVvUsVBCIcGKWvmQq",
    "naicsCode": "722330",
    "industry": "Mobile bar"
  },
  {
    "naicsCodeId": "2o8v0mBZ64nVEWeKXmtBzA8wqO2",
    "naicsCode": "621",
    "industry": "Medical practice"
  },
  {
    "naicsCodeId": "2o8v0mC1T0k9jFvgBO5xY0mlIjN",
    "naicsCode": "423610",
    "industry": "Electrical supplier"
  },
  {
    "naicsCodeId": "2o8v0mCajmQYbe55auTUIBFAZsL",
    "naicsCode": "533110",
    "industry": "Franchising"
  },
  {
    "naicsCodeId": "2o8v0mCPrxfyf7gg6gROcuv3auv",
    "naicsCode": "6213",
    "industry": "Therapist"
  },
  {
    "naicsCodeId": "2o8v0mcScJ2x2FVHFce0zcTFRQK",
    "naicsCode": "531110",
    "industry": "Home rental"
  },
  {
    "naicsCodeId": "2o8v0mCV8BVq83hlW499vG88NRv",
    "naicsCode": "3111",
    "industry": "Pet food"
  },
  {
    "naicsCodeId": "2o8v0mCVJLK6L9tQLd0pWMDuNWj",
    "naicsCode": "541690",
    "industry": "Pharmaceutical consulting"
  },
  {
    "naicsCodeId": "2o8v0mD8jpeOukgsZAo4kp3wJ6D",
    "naicsCode": "4881",
    "industry": "Aviation services"
  },
  {
    "naicsCodeId": "2o8v0mDNNn3VSY1Fjz8fVbJgFv7",
    "naicsCode": "238310",
    "industry": "Drywall"
  },
  {
    "naicsCodeId": "2o8v0mdnuGBdbyQBGLlI87zj9Cz",
    "naicsCode": "541714",
    "industry": "Biotechnology"
  },
  {
    "naicsCodeId": "2o8v0mDparq1qijg7BY7TIugVYU",
    "naicsCode": "11411",
    "industry": "Commercial fishing"
  },
  {
    "naicsCodeId": "2o8v0mds9dXs3YIPoZUcirKYUuG",
    "naicsCode": "621399",
    "industry": "Nursing service"
  },
  {
    "naicsCodeId": "2o8v0mDYVul7JxlTcS65KlDVHYX",
    "naicsCode": "458110",
    "industry": "Clothing brand"
  },
  {
    "naicsCodeId": "2o8v0mE23bz4ozQBmxt3O9lktZG",
    "naicsCode": "8111",
    "industry": "Mobile RV repair"
  },
  {
    "naicsCodeId": "2o8v0mEtyWrPZXURSmdlwZEy1Zj",
    "naicsCode": "562991",
    "industry": "Septic"
  },
  {
    "naicsCodeId": "2o8v0mf9IXnZtS0HKFhyEKpWRRy",
    "naicsCode": "722515",
    "industry": "Juice bar"
  },
  {
    "naicsCodeId": "2o8v0mfQrbpay6j6NW8sJE1qnyP",
    "naicsCode": "71121",
    "industry": "Sports trainer"
  },
  {
    "naicsCodeId": "2o8v0mFxzIfJVvqf1hVPrtTPvPj",
    "naicsCode": "458110",
    "industry": "Golf accessories & apparel"
  },
  {
    "naicsCodeId": "2o8v0mgpmUQycxOh9UEiYzC8I7I",
    "naicsCode": "611691",
    "industry": "Tutoring"
  },
  {
    "naicsCodeId": "2o8v0mgT5yiFRpCxRncUeUjHkma",
    "naicsCode": "922160",
    "industry": "Fire protection"
  },
  {
    "naicsCodeId": "2o8v0mgtdYwJR0mlkaG3oBY453F",
    "naicsCode": "339910",
    "industry": "Engraving"
  },
  {
    "naicsCodeId": "2o8v0mH0pqFEOy5ZWfipJkSrdsb",
    "naicsCode": "481",
    "industry": "Pilot services"
  },
  {
    "naicsCodeId": "2o8v0mhOWzw9BbVV3UIUJ3dBL6G",
    "naicsCode": "531110",
    "industry": "Property rental"
  },
  {
    "naicsCodeId": "2o8v0mhXki7ifAn69WG6DO55afU",
    "naicsCode": "541620",
    "industry": "Environmental consulting"
  },
  {
    "naicsCodeId": "2o8v0mHXomyzojCjhrRMUtPrQyQ",
    "naicsCode": "11299",
    "industry": "Dog breeding"
  },
  {
    "naicsCodeId": "2o8v0mHyLsnNO7cMKpoSg4da5AP",
    "naicsCode": "33231",
    "industry": "Welding and fabrication"
  },
  {
    "naicsCodeId": "2o8v0mi4qOcFEcKWjOia3utFkK7",
    "naicsCode": "5239",
    "industry": "Financial consulting"
  },
  {
    "naicsCodeId": "2o8v0miA6h0CrRYk7jyv8c4XFGp",
    "naicsCode": "5416",
    "industry": "IT consulting"
  },
  {
    "naicsCodeId": "2o8v0mIgG0NngI4zLNRbp1Ht9fL",
    "naicsCode": "441330",
    "industry": "Car detailing supplies"
  },
  {
    "naicsCodeId": "2o8v0miXk9olGUQGcgSowwF4g3I",
    "naicsCode": "54151",
    "industry": "Web design consulting"
  },
  {
    "naicsCodeId": "2o8v0mjcHxYDCxqCXkcVPlajlwY",
    "naicsCode": "811411",
    "industry": "Small engine repair"
  },
  {
    "naicsCodeId": "2o8v0mJgmcd5w9DUzOgZT6ZWcW9",
    "naicsCode": "7113",
    "industry": "Events"
  },
  {
    "naicsCodeId": "2o8v0mjIxD12r9o8VcOj484M3Td",
    "naicsCode": "458310",
    "industry": "Jewelry shop"
  },
  {
    "naicsCodeId": "2o8v0mJtAQiHxlEVk9NoZzHZphp",
    "naicsCode": "48",
    "industry": "Transport services"
  },
  {
    "naicsCodeId": "2o8v0mJX2Q2gkHsKy5IwOs8sjW9",
    "naicsCode": "62139",
    "industry": "Nutritionist"
  },
  {
    "naicsCodeId": "2o8v0mKuaX9f0EfZAP4wOBKfqiv",
    "naicsCode": "812910",
    "industry": "Pet spa"
  },
  {
    "naicsCodeId": "2o8v0mKYuStuLyiycZKqbSTWv95",
    "naicsCode": "455219",
    "industry": "Online boutique"
  },
  {
    "naicsCodeId": "2o8v0mLCs1BN30klzki1nn9ayoi",
    "naicsCode": "6241",
    "industry": "Social services"
  },
  {
    "naicsCodeId": "2o8v0mlzDOwS5Dwgq63NtQuIxrN",
    "naicsCode": "812113",
    "industry": "Nail salon"
  },
  {
    "naicsCodeId": "2o8v0mMdBfG17RQlh631c7g4QVG",
    "naicsCode": "531",
    "industry": "Real estate investing"
  },
  {
    "naicsCodeId": "2o8v0mmDgzJtDsmLySlCJ6JSeMp",
    "naicsCode": "5414",
    "industry": "Design"
  },
  {
    "naicsCodeId": "2o8v0mMHtjT7R4LtQtcI6WGDmEH",
    "naicsCode": "561730",
    "industry": "Landscaping"
  },
  {
    "naicsCodeId": "2o8v0mN17H2HOl1OsGG03cNc9Ll",
    "naicsCode": "236",
    "industry": "Housing - construction"
  },
  {
    "naicsCodeId": "2o8v0mNCoAG88KCSBobkEIuJXXS",
    "naicsCode": "112",
    "industry": "Animal farming"
  },
  {
    "naicsCodeId": "2o8v0mNiEGNCEx1My6U7mo846Nt",
    "naicsCode": "523160",
    "industry": "Commodity brokers"
  },
  {
    "naicsCodeId": "2o8v0mNSdbhQGitJAoSuauMYChw",
    "naicsCode": "8121",
    "industry": "Salon"
  },
  {
    "naicsCodeId": "2o8v0mogCRQ1PJOXsaWXlBsxm4T",
    "naicsCode": "541490",
    "industry": "Fashion"
  },
  {
    "naicsCodeId": "2o8v0mopiEI4VGTRxeRastXoETb",
    "naicsCode": "423990",
    "industry": "Firearms sales"
  },
  {
    "naicsCodeId": "2o8v0moPJyDXdIPtFGkIwps0aX1",
    "naicsCode": "811210",
    "industry": "Computer repair"
  },
  {
    "naicsCodeId": "2o8v0moRKyp1Qg1snDJAo39HO1x",
    "naicsCode": "711219",
    "industry": "Motorsports"
  },
  {
    "naicsCodeId": "2o8v0mP4wkginC9iAup5x2nfOEQ",
    "naicsCode": "2111",
    "industry": "Oil and gas operations"
  },
  {
    "naicsCodeId": "2o8v0mPgH6WGufH26ZgJvkM6MXp",
    "naicsCode": "315",
    "industry": "Clothes alteration"
  },
  {
    "naicsCodeId": "2o8v0mQbLsOj1oSZUYvrAHumpBi",
    "naicsCode": "722511",
    "industry": "Restaurant bar"
  },
  {
    "naicsCodeId": "2o8v0mqneqC3sb711gRaYWqc8sv",
    "naicsCode": "238140",
    "industry": "Masonry"
  },
  {
    "naicsCodeId": "2o8v0mqsooKhL2Sw5QZRR4llr3p",
    "naicsCode": "311920",
    "industry": "Coffee"
  },
  {
    "naicsCodeId": "2o8v0mr8ntEcJdsSehfrvrVRLo5",
    "naicsCode": "561720",
    "industry": "Commercial and residential cleaning"
  },
  {
    "naicsCodeId": "2o8v0mrKARI4IH2pzRxYTCAICM7",
    "naicsCode": "812910",
    "industry": "Dog training"
  },
  {
    "naicsCodeId": "2o8v0mRTHoPW7t2xTppxVDe6DYF",
    "naicsCode": "561410",
    "industry": "Writing and editing service"
  },
  {
    "naicsCodeId": "2o8v0mRva2b8kxap65Lhdw2YsaU",
    "naicsCode": "621498",
    "industry": "Body contouring"
  },
  {
    "naicsCodeId": "2o8v0mRxbRyL7YvaLstaLm4WFbj",
    "naicsCode": "811412",
    "industry": "Appliance repair"
  },
  {
    "naicsCodeId": "2o8v0mRyBHKgF93QFRWmFcWeEzG",
    "naicsCode": "455219",
    "industry": "Online sales"
  },
  {
    "naicsCodeId": "2o8v0mTCQgjR4asdD4aolsUKPw0",
    "naicsCode": "455219",
    "industry": "Digital products"
  },
  {
    "naicsCodeId": "2o8v0mTGq4gEiucBlT2E0ctXyVD",
    "naicsCode": "455219",
    "industry": "Dropshipping"
  },
  {
    "naicsCodeId": "2o8v0mTikaK7TNt7xMhb48hlK7x",
    "naicsCode": "238350",
    "industry": "Carpentry"
  },
  {
    "naicsCodeId": "2o8v0mTvTew6pQfSKZkghjMk7Ma",
    "naicsCode": "812990",
    "industry": "Wedding planning consulting"
  },
  {
    "naicsCodeId": "2o8v0mu7OdN1nZc8MjXrW31VtW3",
    "naicsCode": "812990",
    "industry": "Personal development"
  },
  {
    "naicsCodeId": "2o8v0mVldniMAcfqFTI93UtLXmX",
    "naicsCode": "5418",
    "industry": "Communications / public relations"
  },
  {
    "naicsCodeId": "2o8v0mVtpOKLC2hBFnMpKLm1dde",
    "naicsCode": "523910",
    "industry": "Venture capital"
  },
  {
    "naicsCodeId": "2o8v0mVWtcFEyw6PgoIhj4ZJJH5",
    "naicsCode": "339999",
    "industry": "Candle making"
  },
  {
    "naicsCodeId": "2o8v0mW0IvysVNQr5kGAN6GELI3",
    "naicsCode": "5239",
    "industry": "Trading"
  },
  {
    "naicsCodeId": "2o8v0mw37Bv6oJleVVnqYOLLLCF",
    "naicsCode": "484",
    "industry": "Cargo transportation in trucks"
  },
  {
    "naicsCodeId": "2o8v0mWCWYlfXg8aza7SZvBSzi2",
    "naicsCode": "7139",
    "industry": "Outdoor recreation"
  },
  {
    "naicsCodeId": "2o8v0mwdt2574tqfOl3l2S6gQgq",
    "naicsCode": "493110",
    "industry": "Storage"
  },
  {
    "naicsCodeId": "2o8v0mWj3kpSeeQyzupGVWR5HXU",
    "naicsCode": "7111",
    "industry": "Performing arts"
  },
  {
    "naicsCodeId": "2o8v0mwX8jBLqN1xmWtbjRtXOCm",
    "naicsCode": "5416",
    "industry": "Information technology consulting"
  },
  {
    "naicsCodeId": "2o8v0mwzLtuRQr3RdWmPXx9DAXi",
    "naicsCode": "541511",
    "industry": "Website development"
  },
  {
    "naicsCodeId": "2o8v0mX3gAxbFTKdbDI6AsMBYlH",
    "naicsCode": "531110",
    "industry": "Short term rentals"
  },
  {
    "naicsCodeId": "2o8v0mxD7yNrnUJN71Ee56lCA3W",
    "naicsCode": "541511",
    "industry": "Developer"
  },
  {
    "naicsCodeId": "2o8v0mxe6eJJ7aHF7UVrNoJdKvU",
    "naicsCode": "445131",
    "industry": "Convenience store"
  },
  {
    "naicsCodeId": "2o8v0mxFXxJvggFETezmkOMeUZX",
    "naicsCode": "621310",
    "industry": "Chiropractors"
  },
  {
    "naicsCodeId": "2o8v0mXOwrjzz4US9FKfBykintl",
    "naicsCode": "541613",
    "industry": "Social media marketing"
  },
  {
    "naicsCodeId": "2o8v0mXvBfyoHXXAJRftbnp56oX",
    "naicsCode": "541370",
    "industry": "Land surveying"
  },
  {
    "naicsCodeId": "2o8v0mxZbGLP50GUbx6tZVHDCcJ",
    "naicsCode": "5418",
    "industry": "Media agency"
  },
  {
    "naicsCodeId": "2o8v0myEg9OEhkzFwH0bkI8pI0O",
    "naicsCode": "611610",
    "industry": "Dance instructor"
  },
  {
    "naicsCodeId": "2o8v0mZ32AoLFDvSvAtY6KLYIhB",
    "naicsCode": "112111",
    "industry": "Cattle ranching"
  },
  {
    "naicsCodeId": "2o8v0mz35ZBrA3o6NfTJT0odix3",
    "naicsCode": "513130",
    "industry": "Book publishing"
  },
  {
    "naicsCodeId": "2o8v0mzAOSAe9bCBFdN9GRhiQr3",
    "naicsCode": "561510",
    "industry": "Travel advisor"
  },
  {
    "naicsCodeId": "2o8v0n0624mb0DlqEplmCbB0Hh1",
    "naicsCode": "541211",
    "industry": "Accounting"
  },
  {
    "naicsCodeId": "2o8v0n2f103YNM5B8jCign0kaPT",
    "naicsCode": "11",
    "industry": "Agriculture"
  },
  {
    "naicsCodeId": "2o8v0n3D34Y8H3mxICUuakpWXX4",
    "naicsCode": "812112",
    "industry": "Hairdressing / hairstsyling"
  },
  {
    "naicsCodeId": "2o8v0n44WydtmW4W7DCdLKDpyjd",
    "naicsCode": "813",
    "industry": "Church"
  },
  {
    "naicsCodeId": "2o8v0n48U4tfmQAjqsV9E6jjvxf",
    "naicsCode": "621511",
    "industry": "Medical testing"
  },
  {
    "naicsCodeId": "2o8v0n4T7ALkE06a6gsgF2b1BT5",
    "naicsCode": "531390",
    "industry": "Real estate holding company"
  },
  {
    "naicsCodeId": "2o8v0n5fJPOKQZswGifWiJ8DKUK",
    "naicsCode": "54161",
    "industry": "Business strategy company"
  },
  {
    "naicsCodeId": "2o8v0n5nTCsvBn1i7yBhRIVngaN",
    "naicsCode": "339910",
    "industry": "Jewelry"
  },
  {
    "naicsCodeId": "2o8v0n5q3NLwXnMtzrPzP2j63My",
    "naicsCode": "81321",
    "industry": "Charity"
  },
  {
    "naicsCodeId": "2o8v0n5sgAH4YaGrXbKttAKYF1q",
    "naicsCode": "455219",
    "industry": "Ebay business"
  },
  {
    "naicsCodeId": "2o8v0n5W9vOIPAa7HgPrJ30I2tl",
    "naicsCode": "611430",
    "industry": "Training"
  },
  {
    "naicsCodeId": "2o8v0n6U2po5dEsiczV6sEjj88t",
    "naicsCode": "62111",
    "industry": "Doctors"
  },
  {
    "naicsCodeId": "2o8v0n7IfpfVw5OERkmUqqZPRZH",
    "naicsCode": "4931",
    "industry": "Warehousing"
  },
  {
    "naicsCodeId": "2o8v0n8aCasj6fjchpUKk26pxqn",
    "naicsCode": "323113",
    "industry": "Screen printing"
  },
  {
    "naicsCodeId": "2o8v0n8De6vOCug5nCFkjN62EXu",
    "naicsCode": "541512",
    "industry": "Video game development"
  },
  {
    "naicsCodeId": "2o8v0n8fMtPyVS61kFOeXWpQsvb",
    "naicsCode": "449210",
    "industry": "Electronics store"
  },
  {
    "naicsCodeId": "2o8v0n8PQfytSls7or0wH0A34em",
    "naicsCode": "623312",
    "industry": "Elderly care home"
  },
  {
    "naicsCodeId": "2o8v0nacOY8d4dmFZIOSwFlnVTE",
    "naicsCode": "621340",
    "industry": "Physiotherapy"
  },
  {
    "naicsCodeId": "2o8v0nB2oR0bgTkSqJx4hbT9tt5",
    "naicsCode": "551112",
    "industry": "Parent company"
  },
  {
    "naicsCodeId": "2o8v0nB45Slh8FmOMDIc1A6JrKf",
    "naicsCode": "339999",
    "industry": "3D printing"
  },
  {
    "naicsCodeId": "2o8v0nBa3AU8OsLB3H10RwZGeR6",
    "naicsCode": "484",
    "industry": "Trucking company"
  },
  {
    "naicsCodeId": "2o8v0nbLTnABdKJYg0hNW2BzWih",
    "naicsCode": "561110",
    "industry": "Virtual assistant"
  },
  {
    "naicsCodeId": "2o8v0nbmgkrkHGTrtLwUc7hvTmP",
    "naicsCode": "621399",
    "industry": "Wellness and health"
  },
  {
    "naicsCodeId": "2o8v0nBTMlWqWhRZTIcc6xHMNgz",
    "naicsCode": "424490",
    "industry": "Food distribution"
  },
  {
    "naicsCodeId": "2o8v0nbzPLbrl3Xd3AjVTQMw49g",
    "naicsCode": "541690",
    "industry": "Training and consulting"
  },
  {
    "naicsCodeId": "2o8v0nd1rx5z62A3g9RPXqMlYVy",
    "naicsCode": "811",
    "industry": "Equipment repair"
  },
  {
    "naicsCodeId": "2o8v0nD7vrbe4JL5yUDDrdLekBX",
    "naicsCode": "2213",
    "industry": "Water"
  },
  {
    "naicsCodeId": "2o8v0nDeJgYYbiUcHFt38yCCCos",
    "naicsCode": "623990",
    "industry": "Group home"
  },
  {
    "naicsCodeId": "2o8v0nDg0XHWH1nux4LxdWiDnBA",
    "naicsCode": "11251",
    "industry": "Aquaculture"
  },
  {
    "naicsCodeId": "2o8v0ndsD4pt4KS1Wy5toyUJN6v",
    "naicsCode": "71",
    "industry": "Entertainment"
  },
  {
    "naicsCodeId": "2o8v0nE1mh365NjTdWfJqpOrIUp",
    "naicsCode": "812910",
    "industry": "Dog walking"
  },
  {
    "naicsCodeId": "2o8v0nEWu3kaRwPTgZLcb5ZiNA5",
    "naicsCode": "551112",
    "industry": "Holding company"
  },
  {
    "naicsCodeId": "2o8v0nFF5GR1hCrR76cGxmE0PAc",
    "naicsCode": "621340",
    "industry": "Occupational therapy"
  },
  {
    "naicsCodeId": "2o8v0nfLqH2237SLOshcRgmUhN2",
    "naicsCode": "561790",
    "industry": "Power washing"
  },
  {
    "naicsCodeId": "2o8v0ng756SNvGTgYKgopwMfeNx",
    "naicsCode": "721191",
    "industry": "Bed and breakfast"
  },
  {
    "naicsCodeId": "2o8v0nGMaJKxdD0F5uBT1Lzyp0a",
    "naicsCode": "541613",
    "industry": "Sales consulting"
  },
  {
    "naicsCodeId": "2o8v0ngv4DIskQyhu3e1FZLOpvs",
    "naicsCode": "315210",
    "industry": "Tailoring"
  },
  {
    "naicsCodeId": "2o8v0nH9ht4Bf51zlSBOkGLitVN",
    "naicsCode": "54192",
    "industry": "Photo booth"
  },
  {
    "naicsCodeId": "2o8v0nhd75cS86lVbnVwkbulu6U",
    "naicsCode": "722513",
    "industry": "Limited service restaurant"
  },
  {
    "naicsCodeId": "2o8v0nIJCjsy45PfhgU9XDHTxjQ",
    "naicsCode": "5416",
    "industry": "Design consulting"
  },
  {
    "naicsCodeId": "2o8v0nIShWCPDNtDH3bOLPzPavP",
    "naicsCode": "455",
    "industry": "Consumer goods"
  },
  {
    "naicsCodeId": "2o8v0niXP8MG7g7jCDqstRX47SL",
    "naicsCode": "562111",
    "industry": "Junk removal"
  },
  {
    "naicsCodeId": "2o8v0nj6mrODZv4ZopGsPSG67lQ",
    "naicsCode": "722330",
    "industry": "Mobile food"
  },
  {
    "naicsCodeId": "2o8v0nJeOFYIQGnEBHiEdPkw3A1",
    "naicsCode": "236118",
    "industry": "Home maintenance and repair"
  },
  {
    "naicsCodeId": "2o8v0nJLxtApYl6UGEKbkMUVgfN",
    "naicsCode": "333",
    "industry": "Industrial - manufacturing"
  },
  {
    "naicsCodeId": "2o8v0nJlYLt5gSjBjvru7w96CaE",
    "naicsCode": "518210",
    "industry": "Data analysis"
  },
  {
    "naicsCodeId": "2o8v0njmLzLPCW9Gh6tIsoBsPBg",
    "naicsCode": "459120",
    "industry": "Toys"
  },
  {
    "naicsCodeId": "2o8v0nJo7Fw9xiKVL43G6P9eqVR",
    "naicsCode": "611620",
    "industry": "Basketball training"
  },
  {
    "naicsCodeId": "2o8v0nkJr24CCGOaZC1Fs7rmzhX",
    "naicsCode": "522291",
    "industry": "Lending"
  },
  {
    "naicsCodeId": "2o8v0nklaTwTMRmIN15Ujx0aBcL",
    "naicsCode": "711211",
    "industry": "Sports entertainment"
  },
  {
    "naicsCodeId": "2o8v0nkNhXvC7ClaFoQXm7TyCZj",
    "naicsCode": "561110",
    "industry": "Admin support"
  },
  {
    "naicsCodeId": "2o8v0nKvvpc2zEWFdDu42yowTAA",
    "naicsCode": "33281",
    "industry": "Powder coating"
  },
  {
    "naicsCodeId": "2o8v0nL1DPvtb9Iv8zWSEIbmges",
    "naicsCode": "711130",
    "industry": "Musical group"
  },
  {
    "naicsCodeId": "2o8v0nlFY5GVcqTzS6gcANeZt5p",
    "naicsCode": "311920",
    "industry": "Coffee roasting"
  },
  {
    "naicsCodeId": "2o8v0nlfZdMdsfCqV3il5DMpoUT",
    "naicsCode": "459991",
    "industry": "CBD dispensary"
  },
  {
    "naicsCodeId": "2o8v0nLi8Bw0tCBZZiBrh3HV7G9",
    "naicsCode": "459991",
    "industry": "Tobacco"
  },
  {
    "naicsCodeId": "2o8v0nlPaHwcd07NlxL9Iy6HbMb",
    "naicsCode": "541922",
    "industry": "Aerial photography"
  },
  {
    "naicsCodeId": "2o8v0nmFnEX9SHxdJRLpBTb4g7Z",
    "naicsCode": "541490",
    "industry": "Clothing designer"
  },
  {
    "naicsCodeId": "2o8v0nmZ1R1NvI8dGJSw9K18o3E",
    "naicsCode": "611430",
    "industry": "Coaching"
  },
  {
    "naicsCodeId": "2o8v0nn1LrjOKzGJcLUSV8M6srZ",
    "naicsCode": "541614",
    "industry": "Manufacturing consulting"
  },
  {
    "naicsCodeId": "2o8v0nNJ3GEftsL9gn6RhFacO3k",
    "naicsCode": "5239",
    "industry": "Investment management"
  },
  {
    "naicsCodeId": "2o8v0nnktD7ptA21i6wibn5Ztru",
    "naicsCode": "812111",
    "industry": "Barber"
  },
  {
    "naicsCodeId": "2o8v0nnzevwyu0bLuhQnG6AksfS",
    "naicsCode": "4594",
    "industry": "Gifts"
  },
  {
    "naicsCodeId": "2o8v0no9sBg797RVqSORlCFrGxm",
    "naicsCode": "524210",
    "industry": "Insurance agency"
  },
  {
    "naicsCodeId": "2o8v0nocVBv776zPumZbp5cNLHg",
    "naicsCode": "7223",
    "industry": "Bartender"
  },
  {
    "naicsCodeId": "2o8v0noqRnuvFNiVCjQCMe5C6T2",
    "naicsCode": "711510",
    "industry": "Author"
  },
  {
    "naicsCodeId": "2o8v0np4W38DM9Ktrm3cE2pyStd",
    "naicsCode": "52",
    "industry": "Personal finance"
  },
  {
    "naicsCodeId": "2o8v0nPZHq7OUvZcUHeIt1jBjfl",
    "naicsCode": "523",
    "industry": "Stock trading"
  },
  {
    "naicsCodeId": "2o8v0nr22Vy2ID5RbvU8xbAiKqV",
    "naicsCode": "5416",
    "industry": "Technology consulting"
  },
  {
    "naicsCodeId": "2o8v0nRCFFGsj3JuewIh5R5DYd7",
    "naicsCode": "541613",
    "industry": "Digital media agency"
  },
  {
    "naicsCodeId": "2o8v0nREqgAp9yvJzq3WKv8SDVW",
    "naicsCode": "541199",
    "industry": "Paralegal service"
  },
  {
    "naicsCodeId": "2o8v0nrFvGhMnidj9S9jkckzzbJ",
    "naicsCode": "541110",
    "industry": "Attorney"
  },
  {
    "naicsCodeId": "2o8v0nrsHg5EvGJeV8VLSG1cheh",
    "naicsCode": "524210",
    "industry": "Insurance brokerage"
  },
  {
    "naicsCodeId": "2o8v0nrUp6Ybe2mZ23DlJvQg5LL",
    "naicsCode": "51712",
    "industry": "Phone store"
  },
  {
    "naicsCodeId": "2o8v0nsjVmHzKTk6AklTHxR9R38",
    "naicsCode": "541370",
    "industry": "Drone services - surveying"
  },
  {
    "naicsCodeId": "2o8v0nSxbAL2hjqCL6NIy9R40eQ",
    "naicsCode": "445292",
    "industry": "Candy"
  },
  {
    "naicsCodeId": "2o8v0ntlGbVBIWbjX6gA4ZQniSx",
    "naicsCode": "445110",
    "industry": "Grocery store"
  },
  {
    "naicsCodeId": "2o8v0nTNG7ioCKm6BDmE7EzN25i",
    "naicsCode": "442110",
    "industry": "Furniture sales"
  },
  {
    "naicsCodeId": "2o8v0ntoswnXk0IoKwWOEFabBw7",
    "naicsCode": "541350",
    "industry": "Home inspections"
  },
  {
    "naicsCodeId": "2o8v0nTy1yCiTgKrgk70l5ABXV9",
    "naicsCode": "812910",
    "industry": "Dog boarding"
  },
  {
    "naicsCodeId": "2o8v0nUCrHLF1lfyilHTp133vcF",
    "naicsCode": "721211",
    "industry": "RV park"
  },
  {
    "naicsCodeId": "2o8v0nueganXXoQlnRU3gepezfH",
    "naicsCode": "492",
    "industry": "Delivery service"
  },
  {
    "naicsCodeId": "2o8v0nUZCwCIcqpMqm219Mtcb68",
    "naicsCode": "531390",
    "industry": "Own real estate"
  },
  {
    "naicsCodeId": "2o8v0nVacvWNaKdiQWXSvcwR8Oo",
    "naicsCode": "54161",
    "industry": "Consulting and training"
  },
  {
    "naicsCodeId": "2o8v0nvzuVhJ9sFaFvL3xgc0D90",
    "naicsCode": "811",
    "industry": "Repairs"
  },
  {
    "naicsCodeId": "2o8v0nWBuv5Q9O5QqREjjT4VGmr",
    "naicsCode": "523910",
    "industry": "Cryptocurrency investing"
  },
  {
    "naicsCodeId": "2o8v0nwfWkjycdjEnM0sEhkaDL6",
    "naicsCode": "561720",
    "industry": "Commercial cleaning"
  },
  {
    "naicsCodeId": "2o8v0nWitGl59Fp1BsRFStaXkn8",
    "naicsCode": "812910",
    "industry": "Pet services"
  },
  {
    "naicsCodeId": "2o8v0nwm8wh4NejOzAVLuzzmiAV",
    "naicsCode": "812930",
    "industry": "Car garage"
  },
  {
    "naicsCodeId": "2o8v0nWyQScWdhdjWq1G2FyQyiK",
    "naicsCode": "32311",
    "industry": "Printing company"
  },
  {
    "naicsCodeId": "2o8v0nXSUu9QhOD0s1zI6kloGwQ",
    "naicsCode": "53131",
    "industry": "Property management"
  },
  {
    "naicsCodeId": "2o8v0ny6iclEdafuXYNoF4EcKxD",
    "naicsCode": "561720",
    "industry": "Residential cleaning"
  },
  {
    "naicsCodeId": "2o8v0nYBz3FISuRMJ56qZO0ZLRp",
    "naicsCode": "522210",
    "industry": "Credit card issuing"
  },
  {
    "naicsCodeId": "2o8v0nYH1pp3Wczn7BtswIlv7Ov",
    "naicsCode": "561920",
    "industry": "Event planning"
  },
  {
    "naicsCodeId": "2o8v0nYM4Ml1cV1NuPzgyGSg4VI",
    "naicsCode": "52",
    "industry": "Finance"
  },
  {
    "naicsCodeId": "2o8v0nZ5ypl9GJZv9qEXLzKybzL",
    "naicsCode": "531",
    "industry": "Real estate development"
  },
  {
    "naicsCodeId": "2o8v0nZdv6lUzAXhZcXiqIAZ125",
    "naicsCode": "5417",
    "industry": "Research"
  },
  {
    "naicsCodeId": "2o8v0nziFvZyTsUwmxubKhJ9KbJ",
    "naicsCode": "54192",
    "industry": "Photography and videography"
  },
  {
    "naicsCodeId": "2o8v0nznW3XiOwXemDJY1eiSeK1",
    "naicsCode": "236",
    "industry": "Building contracting company"
  },
  {
    "naicsCodeId": "2o8v0nzSEnLDhPn37FtQpNTbdta",
    "naicsCode": "492110",
    "industry": "Courier service"
  },
  {
    "naicsCodeId": "2o8v0nzVv1ZRqJ3toaRvEQUj4E5",
    "naicsCode": "81211",
    "industry": "Skin care services"
  },
  {
    "naicsCodeId": "2o8v0o25AQTiRBeIvNeIOkcywsG",
    "naicsCode": "459999",
    "industry": "Collectibles"
  },
  {
    "naicsCodeId": "2o8v0o2JwqKb2hxid3gVtJZS45O",
    "naicsCode": "621210",
    "industry": "Dental services"
  },
  {
    "naicsCodeId": "2o8v0o2SgmJVBOJnb1aZrf7n8d9",
    "naicsCode": "48",
    "industry": "Distribution"
  },
  {
    "naicsCodeId": "2o8v0o3lHsW9WNyPyXD6LiYPxdh",
    "naicsCode": "812199",
    "industry": "Tanning salon"
  },
  {
    "naicsCodeId": "2o8v0o4MXo2KQ7t9XVUOKr3UhXg",
    "naicsCode": "541511",
    "industry": "Tech business"
  },
  {
    "naicsCodeId": "2o8v0o4sMoqoa1BnnuAYwVt202V",
    "naicsCode": "811310",
    "industry": "Industrial - repair"
  },
  {
    "naicsCodeId": "2o8v0o4WoKfcPE0tWfYj7G8hYHs",
    "naicsCode": "522320",
    "industry": "ATM business"
  },
  {
    "naicsCodeId": "2o8v0o5n3Vdn8gXIoM54HcMheQB",
    "naicsCode": "562111",
    "industry": "Trash removal"
  },
  {
    "naicsCodeId": "2o8v0o6Z2wjYe5Do8HQixfDlHcL",
    "naicsCode": "541613",
    "industry": "Sales and marketing"
  },
  {
    "naicsCodeId": "2o8v0o7V7vOZWxYYh7ZP9Shtpxw",
    "naicsCode": "561720",
    "industry": "Exterior cleaning"
  },
  {
    "naicsCodeId": "2o8v0o81PZtKQY4F0QDeXaYIuR9",
    "naicsCode": "3118",
    "industry": "Home bakery"
  },
  {
    "naicsCodeId": "2o8v0o87cClDR2DcCTZQ3t4DpBx",
    "naicsCode": "541420",
    "industry": "Product development and design"
  },
  {
    "naicsCodeId": "2o8v0o8GeEkSiwwek6fZrI37l2Y",
    "naicsCode": "611699",
    "industry": "Yoga"
  },
  {
    "naicsCodeId": "2o8v0o9KJsz720rVu6NRZ3id78u",
    "naicsCode": "561730",
    "industry": "Lawn care"
  },
  {
    "naicsCodeId": "2o8v0o9XqJw93gZSuUAATXZu4mO",
    "naicsCode": "541921",
    "industry": "Videography"
  },
  {
    "naicsCodeId": "2o8v0o9XSaucRuJfQihcIxR5erC",
    "naicsCode": "5311",
    "industry": "Real estate rental"
  },
  {
    "naicsCodeId": "2o8v0oA1AXweIS0SjujTC3PQOIM",
    "naicsCode": "811111",
    "industry": "Motorcycle repair"
  },
  {
    "naicsCodeId": "2o8v0oaOaiV0P0Ey7OXSuxjp3fW",
    "naicsCode": "812199",
    "industry": "Tattoo and body piercing salon"
  },
  {
    "naicsCodeId": "2o8v0obAA9MFJu0etoyWVEGJMi8",
    "naicsCode": "512110",
    "industry": "Content creator"
  },
  {
    "naicsCodeId": "2o8v0oC62XpL8O2bqKrMSw6IZIn",
    "naicsCode": "621498",
    "industry": "Body sculpting"
  },
  {
    "naicsCodeId": "2o8v0oc9UIOyVZfVva8X2NNSA91",
    "naicsCode": "622",
    "industry": "Hospital"
  },
  {
    "naicsCodeId": "2o8v0oCLsna9mPntbbzXMcyrInS",
    "naicsCode": "621399",
    "industry": "Healing"
  },
  {
    "naicsCodeId": "2o8v0oCNoFxKmlvIyvDC35hRAnB",
    "naicsCode": "541810",
    "industry": "Creative services"
  },
  {
    "naicsCodeId": "2o8v0ocOiqGKG4IRnnILfzGIQOv",
    "naicsCode": "611",
    "industry": "Teaching"
  },
  {
    "naicsCodeId": "2o8v0ocXYfNT589UZGyApH25VVu",
    "naicsCode": "711510",
    "industry": "YouTube"
  },
  {
    "naicsCodeId": "2o8v0oDMKMlJQycfHBVnOHFO8QD",
    "naicsCode": "5231",
    "industry": "Securities brokerage"
  },
  {
    "naicsCodeId": "2o8v0oF3XNiakcY4Bz3IXfZu6Uj",
    "naicsCode": "523991",
    "industry": "Trust administration"
  },
  {
    "naicsCodeId": "2o8v0ofCeUW2TSpeYlRrj2iARLD",
    "naicsCode": "459210",
    "industry": "Bookstore"
  },
  {
    "naicsCodeId": "2o8v0oGftW8SPym4eELBKyiv9PG",
    "naicsCode": "812112",
    "industry": "Microblading"
  },
  {
    "naicsCodeId": "2o8v0oGJCwy9ROr4UznxFtzCU5D",
    "naicsCode": "112920",
    "industry": "Horse boarding"
  },
  {
    "naicsCodeId": "2o8v0oguh2s6azTWt34uSVowE3K",
    "naicsCode": "523940",
    "industry": "Asset management"
  },
  {
    "naicsCodeId": "2o8v0ohaPqCSnWJxpMh99FcZwZP",
    "naicsCode": "42",
    "industry": "Wholesale"
  },
  {
    "naicsCodeId": "2o8v0oHCEZp0pzFggQzdW7lbuGE",
    "naicsCode": "516210",
    "industry": "Podcast"
  },
  {
    "naicsCodeId": "2o8v0oHeAjHfLRCyoyNpjpPH5Vq",
    "naicsCode": "722410",
    "industry": "Wine bar"
  },
  {
    "naicsCodeId": "2o8v0oHeMdquWCKdJC0wMza37Ev",
    "naicsCode": "488410",
    "industry": "Towing"
  },
  {
    "naicsCodeId": "2o8v0ohKBFLRI5X8qRqPiB9Bppl",
    "naicsCode": "541690",
    "industry": "Cyber security consulting"
  },
  {
    "naicsCodeId": "2o8v0oHNRZoQ5bFcxbXIWuoC0Ma",
    "naicsCode": "561790",
    "industry": "Drain cleaning"
  },
  {
    "naicsCodeId": "2o8v0oHplI8ZNsM6xpcLmfabVi5",
    "naicsCode": "541810",
    "industry": "Advertising consulting"
  },
  {
    "naicsCodeId": "2o8v0ohRqjf0AxonIdJimol710w",
    "naicsCode": "7113",
    "industry": "Event production"
  },
  {
    "naicsCodeId": "2o8v0oipuZrD82VXd7G1x9DKtWO",
    "naicsCode": "541611",
    "industry": "Management consulting"
  },
  {
    "naicsCodeId": "2o8v0oJoNUrA8RuYAwGmeNiootV",
    "naicsCode": "541120",
    "industry": "Notary"
  },
  {
    "naicsCodeId": "2o8v0okOsytU9ZLgDuG4HmGBJO3",
    "naicsCode": "54151",
    "industry": "Web design"
  },
  {
    "naicsCodeId": "2o8v0okrHx0kvVdxuv7isZir4yy",
    "naicsCode": "449210",
    "industry": "Computer sales"
  },
  {
    "naicsCodeId": "2o8v0okRYMBGPiIwjA2Rk6ckfM8",
    "naicsCode": "62139",
    "industry": "Dietician"
  },
  {
    "naicsCodeId": "2o8v0oLAnv6c8u8UzgHFXp9yiK9",
    "naicsCode": "3121",
    "industry": "Winery"
  },
  {
    "naicsCodeId": "2o8v0oLB8aaRRTXmlgYDlG6JZy2",
    "naicsCode": "72",
    "industry": "Hospitality"
  },
  {
    "naicsCodeId": "2o8v0olQU7tHdJP2kWHa3vVK5y1",
    "naicsCode": "811122",
    "industry": "Auto glass"
  },
  {
    "naicsCodeId": "2o8v0olXm3py9mnpPbOzHMp5QwO",
    "naicsCode": "711211",
    "industry": "Sports league"
  },
  {
    "naicsCodeId": "2o8v0oM6cTgP4by3JGUhI3Fwtxq",
    "naicsCode": "541613",
    "industry": "Social media"
  },
  {
    "naicsCodeId": "2o8v0oMCzC2jB8tDJBrT8C8M9s4",
    "naicsCode": "812990",
    "industry": "DIY service"
  },
  {
    "naicsCodeId": "2o8v0omM59nXP8PbTX0F42mwBWo",
    "naicsCode": "611620",
    "industry": "Martial arts"
  },
  {
    "naicsCodeId": "2o8v0omvMvf5uminzPEMhM76kMo",
    "naicsCode": "455219",
    "industry": "Online retail store"
  },
  {
    "naicsCodeId": "2o8v0omX82c6m39kcSaZC7pEFDC",
    "naicsCode": "238220",
    "industry": "Plumbing"
  },
  {
    "naicsCodeId": "2o8v0oN2O5ADzOvRQXvSTKGhYwI",
    "naicsCode": "512250",
    "industry": "Record label"
  },
  {
    "naicsCodeId": "2o8v0on4GOsGlumiBd3x1R9p7c8",
    "naicsCode": "332313",
    "industry": "Welding"
  },
  {
    "naicsCodeId": "2o8v0oNHzaJPIOXylZIyZ8OZ1Fv",
    "naicsCode": "332",
    "industry": "Metal fabrication"
  },
  {
    "naicsCodeId": "2o8v0onlG820hXsxSPkjHWkPygV",
    "naicsCode": "455219",
    "industry": "Etsy business"
  },
  {
    "naicsCodeId": "2o8v0oNzzHCe7htWb4NzT2hBzfH",
    "naicsCode": "238320",
    "industry": "House painting"
  },
  {
    "naicsCodeId": "2o8v0oo4WEXkW9KgaLMrlGr4McI",
    "naicsCode": "1121",
    "industry": "Ranch"
  },
  {
    "naicsCodeId": "2o8v0oo5BTtZrKsDh52UnWiig2d",
    "naicsCode": "812112",
    "industry": "Makeup"
  },
  {
    "naicsCodeId": "2o8v0oohZ69foqgPP92iLMLRuxy",
    "naicsCode": "611699",
    "industry": "Yoga studio"
  },
  {
    "naicsCodeId": "2o8v0oOQmOmm5TzcKO2ycctfPO6",
    "naicsCode": "711510",
    "industry": "Artist"
  },
  {
    "naicsCodeId": "2o8v0opawC4yFP7lX7yD3jVX2HA",
    "naicsCode": "621399",
    "industry": "Holistic healing"
  },
  {
    "naicsCodeId": "2o8v0oPnowemCEbSbStKs65jW3d",
    "naicsCode": "621111",
    "industry": "Physician"
  },
  {
    "naicsCodeId": "2o8v0opoAkVpInoLSRu6XCjUAJw",
    "naicsCode": "562",
    "industry": "Waste management"
  },
  {
    "naicsCodeId": "2o8v0oPQDNCcOIaheH8dKYNC0iu",
    "naicsCode": "813",
    "industry": "Community"
  },
  {
    "naicsCodeId": "2o8v0oPs7VayAW5y1ICbxCSHrf7",
    "naicsCode": "11251",
    "industry": "Fishery"
  },
  {
    "naicsCodeId": "2o8v0oPwY7LLzrQoRWoqzvtHpAN",
    "naicsCode": "561720",
    "industry": "Window cleaning"
  },
  {
    "naicsCodeId": "2o8v0oQfxsaYtjA2nDAQixJ4NRN",
    "naicsCode": "311811",
    "industry": "Baked goods"
  },
  {
    "naicsCodeId": "2o8v0oQlBc7uINMNFKUebtrcfgB",
    "naicsCode": "541512",
    "industry": "Information technology"
  },
  {
    "naicsCodeId": "2o8v0oQu1jzXds7MaLPFGv4NB1s",
    "naicsCode": "522292",
    "industry": "Mortgage company"
  },
  {
    "naicsCodeId": "2o8v0orelmlaq0UAoujZR87T7tC",
    "naicsCode": "812310",
    "industry": "Laundromat"
  },
  {
    "naicsCodeId": "2o8v0orIHq55p7k9NST5w8oYPws",
    "naicsCode": "512110",
    "industry": "Motion picture production"
  },
  {
    "naicsCodeId": "2o8v0oRlLauyi5FxdgiknB2gI2s",
    "naicsCode": "621340",
    "industry": "Speech and language pathology"
  },
  {
    "naicsCodeId": "2o8v0oRq8dQFHMkXZXOyRGAVZyY",
    "naicsCode": "5313",
    "industry": "Investment property"
  },
  {
    "naicsCodeId": "2o8v0oRUFXt6yDNwhXTO0iBl04b",
    "naicsCode": "238170",
    "industry": "Gutter installation"
  },
  {
    "naicsCodeId": "2o8v0os5WPVN3nTYwRwPNNjCQqS",
    "naicsCode": "541613",
    "industry": "Marketing consulting"
  },
  {
    "naicsCodeId": "2o8v0oSA9IlgfO6QIooJRoUGhkv",
    "naicsCode": "5411",
    "industry": "Legal services business"
  },
  {
    "naicsCodeId": "2o8v0oSHhgJXDFlUW1K4uL1JHUW",
    "naicsCode": "512250",
    "industry": "Music production"
  },
  {
    "naicsCodeId": "2o8v0oU4Q6FwEzsRQ6hY85pnzc7",
    "naicsCode": "455219",
    "industry": "Lifestyle brand"
  },
  {
    "naicsCodeId": "2o8v0oUDXefnc7f1t0Jq9UIZp07",
    "naicsCode": "561730",
    "industry": "Snow removal"
  },
  {
    "naicsCodeId": "2o8v0ougNpCWCvZT7ThxIpNDcsd",
    "naicsCode": "62",
    "industry": "Medical services"
  },
  {
    "naicsCodeId": "2o8v0ouXhG307hVsC6CmycTW0xE",
    "naicsCode": "455",
    "industry": "Sell merchandise"
  },
  {
    "naicsCodeId": "2o8v0oVAq6zabskzgZDenB8DiXQ",
    "naicsCode": "812990",
    "industry": "Party planning"
  },
  {
    "naicsCodeId": "2o8v0ovf3qGIHd1ED3dWwnMB5eY",
    "naicsCode": "5629",
    "industry": "Recycling services"
  },
  {
    "naicsCodeId": "2o8v0owbOtdZDdEmUFfqTa690wo",
    "naicsCode": "811192",
    "industry": "Auto detailing"
  },
  {
    "naicsCodeId": "2o8v0oWmpamAAW712gFWH1454gq",
    "naicsCode": "561720",
    "industry": "Cleaning services"
  },
  {
    "naicsCodeId": "2o8v0p0md5lq2ysFxa8qmmOnQti",
    "naicsCode": "459310",
    "industry": "Florist"
  },
  {
    "naicsCodeId": "2o8v0p3aFqjyMLIpMvOtuXTN1Tt",
    "naicsCode": "561730",
    "industry": "Tree surgery"
  },
  {
    "naicsCodeId": "2o8v0p4bplLg9S1L1EDhcaVeSq1",
    "naicsCode": "52",
    "industry": "Financial services"
  },
  {
    "naicsCodeId": "2o8v0p4QOSdoOjegXNGQCXgiC50",
    "naicsCode": "561320",
    "industry": "Labor"
  },
  {
    "naicsCodeId": "2o8v0p5K9ga4aRKVcdfvcN31WVk",
    "naicsCode": "5416",
    "industry": "Healthcare consulting"
  },
  {
    "naicsCodeId": "2o8v0p5MCHmhriDS1117zH14Xyy",
    "naicsCode": "513",
    "industry": "Press / publishing"
  },
  {
    "naicsCodeId": "2o8v0p61dx3JKA1BTxYT35gbpbW",
    "naicsCode": "561311",
    "industry": "Recruitment agency"
  },
  {
    "naicsCodeId": "2o8v0p6MMQZWxeOOXrvKgyhEDq7",
    "naicsCode": "4571",
    "industry": "Gas station"
  },
  {
    "naicsCodeId": "2o8v0p6WugiH5rhWDr4Uu1jezVi",
    "naicsCode": "711510",
    "industry": "Taxidermy business"
  },
  {
    "naicsCodeId": "2o8v0p7BNrL8jzhMzYb6KdGHn7C",
    "naicsCode": "455219",
    "industry": "Amazon FBA"
  },
  {
    "naicsCodeId": "2o8v0p7jJXVKHp2XBTO5scpidjt",
    "naicsCode": "4594",
    "industry": "Stationery"
  },
  {
    "naicsCodeId": "2o8v0p7X5KymZWfLwlqVTMLkXnP",
    "naicsCode": "7223",
    "industry": "Personal chef"
  },
  {
    "naicsCodeId": "2o8v0p9jqKIWIm2ZrtvHdzKHC77",
    "naicsCode": "44912",
    "industry": "Home decor"
  },
  {
    "naicsCodeId": "2o8v0pAHZmNqgwCMvTlRZipKj0w",
    "naicsCode": "311811",
    "industry": "Bakery"
  },
  {
    "naicsCodeId": "2o8v0paK8jDDSF5HnUgXfHJwfLm",
    "naicsCode": "531",
    "industry": "Real estate management"
  },
  {
    "naicsCodeId": "2o8v0paNrOtI2QpQM9OtUkkzz1E",
    "naicsCode": "812111",
    "industry": "Barbershop"
  },
  {
    "naicsCodeId": "2o8v0parL600MhhkspRazKHD7bF",
    "naicsCode": "621330",
    "industry": "Psychologist"
  },
  {
    "naicsCodeId": "2o8v0pATLky9bupKGQNUhkgaJTF",
    "naicsCode": "11",
    "industry": "Farming"
  },
  {
    "naicsCodeId": "2o8v0pbBRlq4v665wb9h9hcQOJx",
    "naicsCode": "484210",
    "industry": "Moving company"
  },
  {
    "naicsCodeId": "2o8v0pC51XTPccYj1DkpFkckap3",
    "naicsCode": "72251",
    "industry": "Cafe"
  },
  {
    "naicsCodeId": "2o8v0pCd7IDv8Au4qNKZqILui7t",
    "naicsCode": "532112",
    "industry": "Car leasing"
  },
  {
    "naicsCodeId": "2o8v0pCpJDcIN9oLcPaBxiGPYHB",
    "naicsCode": "611",
    "industry": "Education and training"
  },
  {
    "naicsCodeId": "2o8v0pD6SZR1yWLjPk9UlAYp2WP",
    "naicsCode": "5416",
    "industry": "Food consulting"
  },
  {
    "naicsCodeId": "2o8v0pDGlUwws7p1DbdLHBX0rfz",
    "naicsCode": "455219",
    "industry": "Reseller"
  },
  {
    "naicsCodeId": "2o8v0pdGTnriMuWGLONbLDDDzAc",
    "naicsCode": "236118",
    "industry": "Remodeling"
  },
  {
    "naicsCodeId": "2o8v0pdhXa2bR5L71ESF5zGqyrK",
    "naicsCode": "62",
    "industry": "Medicine"
  },
  {
    "naicsCodeId": "2o8v0pdKkhJKYVNU8sxHe8WNrBB",
    "naicsCode": "512240",
    "industry": "Sound engineering"
  },
  {
    "naicsCodeId": "2o8v0pDOZyw2AFbZzQ6rF0ibk4X",
    "naicsCode": "611699",
    "industry": "Firearms training"
  },
  {
    "naicsCodeId": "2o8v0pdQCuicUjNAwOFBQPEB8tO",
    "naicsCode": "518210",
    "industry": "Bitcoin mining"
  },
  {
    "naicsCodeId": "2o8v0pdqnJ3wlGZnyFuhkSlKzr0",
    "naicsCode": "541330",
    "industry": "Engineering consulting"
  },
  {
    "naicsCodeId": "2o8v0pdsIomqzCoF57eLa2fASdo",
    "naicsCode": "312111",
    "industry": "Soft drink manufacturing"
  },
  {
    "naicsCodeId": "2o8v0pe3AojBenUmSWHzVY2VUMr",
    "naicsCode": "811192",
    "industry": "Mobile detailing"
  },
  {
    "naicsCodeId": "2o8v0pe4Uv503D1lZpqo1lzIVPe",
    "naicsCode": "624410",
    "industry": "Child daycare"
  },
  {
    "naicsCodeId": "2o8v0pekyYGCggmbiK2Xq4Ve1DW",
    "naicsCode": "8121",
    "industry": "Personal care services"
  },
  {
    "naicsCodeId": "2o8v0pEZ1QoFkd93ZY8EfYaylEJ",
    "naicsCode": "812112",
    "industry": "Hair salon"
  },
  {
    "naicsCodeId": "2o8v0pfEglSYw03bmVZL5a6kICX",
    "naicsCode": "532",
    "industry": "Leasing business"
  },
  {
    "naicsCodeId": "2o8v0pfjtOKIF17qJ8WdprEk6Et",
    "naicsCode": "812199",
    "industry": "Medical spa"
  },
  {
    "naicsCodeId": "2o8v0pfsPjqvThBuvmVIJPE1e23",
    "naicsCode": "541430",
    "industry": "Commercial art studio"
  },
  {
    "naicsCodeId": "2o8v0pH9WH2TF3lUoCJa27MHTUT",
    "naicsCode": "488510",
    "industry": "Freight broker"
  },
  {
    "naicsCodeId": "2o8v0phPg8i92b1o9CKleuQjuHw",
    "naicsCode": "811192",
    "industry": "Car wash"
  },
  {
    "naicsCodeId": "2o8v0pjLOtxr9g3uLlfadOipWTv",
    "naicsCode": "238910",
    "industry": "Excavation services"
  },
  {
    "naicsCodeId": "2o8v0pJpIGLSANM9tMZLnMde71W",
    "naicsCode": "48599",
    "industry": "Non emergency medical transportation"
  },
  {
    "naicsCodeId": "2o8v0pKb37A9jOpDyOfEZxGtvua",
    "naicsCode": "541430",
    "industry": "Art and design"
  },
  {
    "naicsCodeId": "2o8v0pkeDR9vtNASxmGUdjozFe9",
    "naicsCode": "541611",
    "industry": "Business management and operations"
  },
  {
    "naicsCodeId": "2o8v0pkiY1weaAogb96Qv3RMH2I",
    "naicsCode": "711510",
    "industry": "Model"
  },
  {
    "naicsCodeId": "2o8v0pKquQzNV9sgc7hE14HOS2B",
    "naicsCode": "238990",
    "industry": "Fencing"
  },
  {
    "naicsCodeId": "2o8v0pL780eaVUlAkXvlrbcxIgA",
    "naicsCode": "541490",
    "industry": "Home staging"
  },
  {
    "naicsCodeId": "2o8v0pl84HNFBOdHzQuQ1O8Vz0A",
    "naicsCode": "541690",
    "industry": "Safety consulting"
  },
  {
    "naicsCodeId": "2o8v0pLae8Rgu4lNpLlNF6OFJmh",
    "naicsCode": "238210",
    "industry": "Low voltage"
  },
  {
    "naicsCodeId": "2o8v0plcHAzrzl02ezWtR8UlcGP",
    "naicsCode": "512110",
    "industry": "Production"
  },
  {
    "naicsCodeId": "2o8v0pls7rUX0m6yIllobt2AcOU",
    "naicsCode": "523",
    "industry": "Wealth management"
  },
  {
    "naicsCodeId": "2o8v0pLZJj13IIR3SYfn9t9eO5u",
    "naicsCode": "112920",
    "industry": "Horse training"
  },
  {
    "naicsCodeId": "2o8v0pM7E9Mkn6zTky0n1bqewjC",
    "naicsCode": "5617",
    "industry": "Home services"
  },
  {
    "naicsCodeId": "2o8v0pmbAZTuzxmz0F7AR1Fm3NY",
    "naicsCode": "441222",
    "industry": "Boat sales"
  },
  {
    "naicsCodeId": "2o8v0pMdw6xNsl20GxKjtWx46b6",
    "naicsCode": "113",
    "industry": "Logging business"
  },
  {
    "naicsCodeId": "2o8v0pmONnPwpQDBby27S6Ieoxe",
    "naicsCode": "624120",
    "industry": "Elderly care services"
  },
  {
    "naicsCodeId": "2o8v0pmpGmTYee1uc6rkXGprTTo",
    "naicsCode": "484",
    "industry": "Hot shot trucking"
  },
  {
    "naicsCodeId": "2o8v0pmSapDykWgTmzO1FBzFeqw",
    "naicsCode": "812112",
    "industry": "Hair removal"
  },
  {
    "naicsCodeId": "2o8v0pn2c9QI1UbmzKKBNY1BqeF",
    "naicsCode": "561720",
    "industry": "Sanitation"
  },
  {
    "naicsCodeId": "2o8v0pNKCqrZtanOGmGm1R30Coa",
    "naicsCode": "522310",
    "industry": "Mortgage brokerage"
  },
  {
    "naicsCodeId": "2o8v0pNTkozlDgx55ayD1ezLEkp",
    "naicsCode": "541612",
    "industry": "Human resources consulting"
  },
  {
    "naicsCodeId": "2o8v0pol8VQikSVISf6Zu3JPmMg",
    "naicsCode": "712130",
    "industry": "Arborist"
  },
  {
    "naicsCodeId": "2o8v0pp4cVNXpCTbr3QYMYcAQSM",
    "naicsCode": "4561",
    "industry": "Health and beauty"
  },
  {
    "naicsCodeId": "2o8v0pP8ZdAU0o4uTDcp3prZ1ZV",
    "naicsCode": "5322",
    "industry": "Wedding rental"
  },
  {
    "naicsCodeId": "2o8v0ppapMVBeEq4Vft9D2ebnxD",
    "naicsCode": "238210",
    "industry": "Electrician"
  },
  {
    "naicsCodeId": "2o8v0pPByoicVWjKqx10H1YRPmG",
    "naicsCode": "423710",
    "industry": "Tool sales"
  },
  {
    "naicsCodeId": "2o8v0pPdQIkwd68oV3WMWso7FvX",
    "naicsCode": "541613",
    "industry": "Affiliate marketing"
  },
  {
    "naicsCodeId": "2o8v0pPEl5NjVHaBrHhoKEFoicE",
    "naicsCode": "112512",
    "industry": "Shellfish farming"
  },
  {
    "naicsCodeId": "2o8v0pptWY5tvTF8PdLWLB77XgT",
    "naicsCode": "238330",
    "industry": "Flooring"
  },
  {
    "naicsCodeId": "2o8v0ppWVQzCvdWN6vJAT5vR1qQ",
    "naicsCode": "459920",
    "industry": "Art gallery"
  },
  {
    "naicsCodeId": "2o8v0pqpcJb27E2TlpryRtq7nIH",
    "naicsCode": "23611",
    "industry": "Building homes"
  },
  {
    "naicsCodeId": "2o8v0pqSwXq58vTQBtmP1mcoa7J",
    "naicsCode": "541720",
    "industry": "Behavioral science"
  },
  {
    "naicsCodeId": "2o8v0pQW077L5DzjMHhy1pAeheQ",
    "naicsCode": "611620",
    "industry": "Athletics"
  },
  {
    "naicsCodeId": "2o8v0prJOr7jbK2PMvG0dJbVSeA",
    "naicsCode": "811192",
    "industry": "Car detailing"
  },
  {
    "naicsCodeId": "2o8v0prwBbdUzJ12k2bH5xPSHGR",
    "naicsCode": "512110",
    "industry": "Film production"
  },
  {
    "naicsCodeId": "2o8v0pSO7tv9cpuVBRZE5WD11tK",
    "naicsCode": "456199",
    "industry": "Hearing aid"
  },
  {
    "naicsCodeId": "2o8v0pt9iT2m4IRBEKMni1CwHcP",
    "naicsCode": "7113",
    "industry": "Sports promotion"
  },
  {
    "naicsCodeId": "2o8v0pTPiQjLNzx8W3uSOzPMxLN",
    "naicsCode": "621399",
    "industry": "Doula service"
  },
  {
    "naicsCodeId": "2o8v0pU3tQZn0IvjRhgR8mApX6w",
    "naicsCode": "33281",
    "industry": "Laser engraving"
  },
  {
    "naicsCodeId": "2o8v0pu7bOhPgmLfxleXCniIH2r",
    "naicsCode": "459999",
    "industry": "Handmade products store"
  },
  {
    "naicsCodeId": "2o8v0pUBh4Ku20MkXfsMky8Pokd",
    "naicsCode": "23",
    "industry": "Construction"
  },
  {
    "naicsCodeId": "2o8v0pubXMJh9JPwfqiwEW0fkSh",
    "naicsCode": "541940",
    "industry": "Veterinary medicine"
  },
  {
    "naicsCodeId": "2o8v0puVnT1EeiqENOwdqcx6yhh",
    "naicsCode": "5416",
    "industry": "Consulting"
  },
  {
    "naicsCodeId": "2o8v0pUZpm4Q7bLbYAiG41bYqPG",
    "naicsCode": "624190",
    "industry": "Counseling"
  },
  {
    "naicsCodeId": "2o8v0pV3uaozmCEhVNh9EVcf3kA",
    "naicsCode": "541720",
    "industry": "Behavioral health"
  },
  {
    "naicsCodeId": "2o8v0pVfW1S2BSD1JStKkhZtiNk",
    "naicsCode": "458110",
    "industry": "Clothing store"
  },
  {
    "naicsCodeId": "2o8v0pvYKGZ2qKCXUpNM0dKJsV2",
    "naicsCode": "813410",
    "industry": "Social club"
  },
  {
    "naicsCodeId": "2o8v0pWMiTkPtVkqhQwRWHSfbqd",
    "naicsCode": "722330",
    "industry": "Mobile catering"
  },
  {
    "naicsCodeId": "2o8v0pwRz23jUq2ewDbDjga6MEr",
    "naicsCode": "813910",
    "industry": "Networking"
  },
  {
    "naicsCodeId": "2o8v0pwRZArXUOLhvVZMwDHxogr",
    "naicsCode": "62",
    "industry": "Healthcare"
  },
  {
    "naicsCodeId": "2o8v0pxb99TACVQ2zc8x04G8owc",
    "naicsCode": "611",
    "industry": "Education"
  },
  {
    "naicsCodeId": "2o8v0pXHZ84dWZGJ4deP1Amk96s",
    "naicsCode": "33513",
    "industry": "Lighting"
  },
  {
    "naicsCodeId": "2o8v0pxpo0KvN3Vlf6cGqyeSsIn",
    "naicsCode": "236118",
    "industry": "Home renovation"
  },
  {
    "naicsCodeId": "2o8v0pXrVKnIwnmFOpRlBiWLSzz",
    "naicsCode": "238290",
    "industry": "Garage door or gate repair service"
  },
  {
    "naicsCodeId": "2o8v0pxXKoNqvi2SKqWSXZkEClv",
    "naicsCode": "812199",
    "industry": "Tattoo artist"
  },
  {
    "naicsCodeId": "2o8v0pyB2ytszgVK6bOPnMgN4as",
    "naicsCode": "713",
    "industry": "Recreation"
  },
  {
    "naicsCodeId": "2o8v0pydKrMTI4PbZBPm7aybtel",
    "naicsCode": "23",
    "industry": "General contractor"
  },
  {
    "naicsCodeId": "2o8v0pYMIcdKhDrVzjHAgbCbbIL",
    "naicsCode": "713940",
    "industry": "Health club"
  },
  {
    "naicsCodeId": "2o8v0pYoyjDkOyqxo5YQZ0KgEvu",
    "naicsCode": "4411",
    "industry": "Vehicle dealership"
  },
  {
    "naicsCodeId": "2o8v0pysiZ3sdFUhisi9vxKi4nV",
    "naicsCode": "236220",
    "industry": "Commercial construction"
  },
  {
    "naicsCodeId": "2o8v0pYzx8ruTFvsX2xl6MryBRK",
    "naicsCode": "812910",
    "industry": "Pet care"
  },
  {
    "naicsCodeId": "2o8v0pZiyzhM7rPnjYrJuuFBYhu",
    "naicsCode": "459120",
    "industry": "Crafts"
  },
  {
    "naicsCodeId": "2o8v0pzNIDSr1Ke6nPsqLNDOpy3",
    "naicsCode": "6241",
    "industry": "Human services"
  },
  {
    "naicsCodeId": "2o8v0pzTL5qwz2UZnu8wkTDhDYQ",
    "naicsCode": "56142",
    "industry": "Virtual call center"
  },
  {
    "naicsCodeId": "2o8v0q0a7RQxBPMPOeSW293wzLv",
    "naicsCode": "531",
    "industry": "Property investment"
  },
  {
    "naicsCodeId": "2o8v0q0VrByMTXOLURI5G10WUBX",
    "naicsCode": "812112",
    "industry": "Waxing studio"
  },
  {
    "naicsCodeId": "2o8v0q2UD4AnTA1zBbJp4dnYZ0G",
    "naicsCode": "811",
    "industry": "Maintenance"
  },
  {
    "naicsCodeId": "2o8v0q2W7Lt3YxoymNCVSe5bD1M",
    "naicsCode": "54171",
    "industry": "Clinical research"
  },
  {
    "naicsCodeId": "2o8v0q3a6nlTtEP1ZsFttm8BMnC",
    "naicsCode": "238110",
    "industry": "Concrete contractor"
  },
  {
    "naicsCodeId": "2o8v0q4ObYzf9ehv1ip7WIiiKEa",
    "naicsCode": "518210",
    "industry": "Data science"
  },
  {
    "naicsCodeId": "2o8v0q4wfGKkc5M2B3HnWBES7nq",
    "naicsCode": "812210",
    "industry": "Mortuary services"
  },
  {
    "naicsCodeId": "2o8v0q5s7AO8qLTiYRRY8q8CoaJ",
    "naicsCode": "561621",
    "industry": "Home alarm"
  },
  {
    "naicsCodeId": "2o8v0q5urWDldJWZgySIHfqkct6",
    "naicsCode": "561520",
    "industry": "Travel tours"
  },
  {
    "naicsCodeId": "2o8v0q5VtpZGYGxuDUiz2IXcznx",
    "naicsCode": "541613",
    "industry": "Digital marketing agency"
  },
  {
    "naicsCodeId": "2o8v0q7GIAo4BozANZBNixhRyJa",
    "naicsCode": "8111",
    "industry": "Mechanical"
  },
  {
    "naicsCodeId": "2o8v0q84fwVUAsKKnNbav4IUdmP",
    "naicsCode": "531",
    "industry": "Land management"
  },
  {
    "naicsCodeId": "2o8v0q89moK4yxnzKcHGTG5nJwC",
    "naicsCode": "458110",
    "industry": "Sell clothing"
  },
  {
    "naicsCodeId": "2o8v0q9uM22Psmf8MyTvLpuH2Q5",
    "naicsCode": "459510",
    "industry": "Antiques"
  },
  {
    "naicsCodeId": "2o8v0qaa0tYigDFiMIYruXixs7w",
    "naicsCode": "561611",
    "industry": "Private investigator"
  },
  {
    "naicsCodeId": "2o8v0qAfpxsBuedUBfzccUWN23J",
    "naicsCode": "721110",
    "industry": "Hotel"
  },
  {
    "naicsCodeId": "2o8v0qaMd2zlFEGuvwlKOgtRBi2",
    "naicsCode": "485310",
    "industry": "Taxi service"
  },
  {
    "naicsCodeId": "2o8v0qAwvQv25lbr2T974awlsuU",
    "naicsCode": "524291",
    "industry": "Insurance adjusting"
  },
  {
    "naicsCodeId": "2o8v0qbGKRXDI618bzxE5AMLUb5",
    "naicsCode": "623312",
    "industry": "Assisted living"
  },
  {
    "naicsCodeId": "2o8v0qC2gCsuRtCeUear1Yvr3ee",
    "naicsCode": "455219",
    "industry": "Speciality store"
  },
  {
    "naicsCodeId": "2o8v0qcazmFzU68AQFtW6zWMbua",
    "naicsCode": "5239",
    "industry": "Investment club"
  },
  {
    "naicsCodeId": "2o8v0qCnlHXTeUixQAb1rMV7Q9R",
    "naicsCode": "541120",
    "industry": "Notary services"
  },
  {
    "naicsCodeId": "2o8v0qcPGirYBdLUCnEglo98zPU",
    "naicsCode": "611512",
    "industry": "Aviation school"
  },
  {
    "naicsCodeId": "2o8v0qcPnDBXqbUALvX7lJrMH3V",
    "naicsCode": "487210",
    "industry": "Boat charter"
  },
  {
    "naicsCodeId": "2o8v0qd0aqqYoI67QlrTNZzjMXK",
    "naicsCode": "313220",
    "industry": "Embroidery"
  },
  {
    "naicsCodeId": "2o8v0qdO1hNPkQOPyZfCFXUEBxw",
    "naicsCode": "238210",
    "industry": "Electrical contractor"
  },
  {
    "naicsCodeId": "2o8v0qDygnLW2wA2VQ8EKGQyyLN",
    "naicsCode": "236118",
    "industry": "Property maintenance and preservation"
  },
  {
    "naicsCodeId": "2o8v0qe2RoGWTd2ox1p0Pgh6yyA",
    "naicsCode": "441222",
    "industry": "Yacht sales"
  },
  {
    "naicsCodeId": "2o8v0qeAZfuiQOnUthXO2GxAZIE",
    "naicsCode": "315",
    "industry": "Clothing manufacturer"
  },
  {
    "naicsCodeId": "2o8v0qevAslnj08lggBZdLj7VU7",
    "naicsCode": "713940",
    "industry": "Fitness studio"
  },
  {
    "naicsCodeId": "2o8v0qeVHCauSQRaGdZF8TO2GEq",
    "naicsCode": "339910",
    "industry": "Permanent jewelry"
  },
  {
    "naicsCodeId": "2o8v0qf9Gb5oECCA8BSl2l2bTGR",
    "naicsCode": "4883",
    "industry": "Marine - water transportation"
  },
  {
    "naicsCodeId": "2o8v0qfAb6mV3YIsknKchNOZLD6",
    "naicsCode": "459120",
    "industry": "Crafting"
  },
  {
    "naicsCodeId": "2o8v0qFkxn2b926WrmTjXdLpUCp",
    "naicsCode": "455219",
    "industry": "Amazon business"
  },
  {
    "naicsCodeId": "2o8v0qFX4ip7SNjT0FNZpVMB1rH",
    "naicsCode": "531390",
    "industry": "Real estate consulting"
  },
  {
    "naicsCodeId": "2o8v0qgc86Ea0GHHAWGXrF6a0rX",
    "naicsCode": "455219",
    "industry": "Internet sales"
  },
  {
    "naicsCodeId": "2o8v0qget0xOFWlN1vWhTuQe80v",
    "naicsCode": "455219",
    "industry": "Sell pet treats"
  },
  {
    "naicsCodeId": "2o8v0qgeWYyuy6FTiTHYNV7i69e",
    "naicsCode": "4491",
    "industry": "Home goods"
  },
  {
    "naicsCodeId": "2o8v0qgODVfDKHo3OPOsIEosuAz",
    "naicsCode": "561990",
    "industry": "Estate sales"
  },
  {
    "naicsCodeId": "2o8v0qGwAQzWIxIYG9omaGnC6U5",
    "naicsCode": "531210",
    "industry": "Real estate broker"
  },
  {
    "naicsCodeId": "2o8v0qh9RBCJuO4aTTrp1jFXTv6",
    "naicsCode": "522110",
    "industry": "Personal banking"
  },
  {
    "naicsCodeId": "2o8v0qhEgIQte3hJlhVH48nEsWX",
    "naicsCode": "236118",
    "industry": "Renovation"
  },
  {
    "naicsCodeId": "2o8v0qhHZyr6dcc3GXOJ5xMA3OO",
    "naicsCode": "423450",
    "industry": "Medical equipment sales"
  },
  {
    "naicsCodeId": "2o8v0qHLPlOhTXAanSx8fsF3l4B",
    "naicsCode": "325611",
    "industry": "Soap"
  },
  {
    "naicsCodeId": "2o8v0qHQSsAuFvCzrN7RPpXwMWm",
    "naicsCode": "813",
    "industry": "Non-profit organization"
  },
  {
    "naicsCodeId": "2o8v0qhV5LFuSCImNzroZB7vgzA",
    "naicsCode": "523",
    "industry": "Day trading"
  },
  {
    "naicsCodeId": "2o8v0qhwRqHrW7ehrPnQpqxN0Hb",
    "naicsCode": "812199",
    "industry": "Massage"
  },
  {
    "naicsCodeId": "2o8v0qI2SwAysCNF8ek1kjUltHz",
    "naicsCode": "111998",
    "industry": "Cannabis"
  },
  {
    "naicsCodeId": "2o8v0qi6ipzwIGQqVcG562YlU4W",
    "naicsCode": "713110",
    "industry": "Amusement park"
  },
  {
    "naicsCodeId": "2o8v0qi8p3b1J05U1Uo2oJdSKJF",
    "naicsCode": "56211",
    "industry": "Waste removal"
  },
  {
    "naicsCodeId": "2o8v0qIHQDjaY41RXwnGjARTm6J",
    "naicsCode": "238210",
    "industry": "Electrical"
  },
  {
    "naicsCodeId": "2o8v0qIkTrOXKcZiydY8Uz1W8Va",
    "naicsCode": "541611",
    "industry": "Procurement consulting"
  },
  {
    "naicsCodeId": "2o8v0qjCG0toKhDixrB8i1Us0Kc",
    "naicsCode": "561312",
    "industry": "Executive recruitment"
  },
  {
    "naicsCodeId": "2o8v0qjd25wIUakWbHB53M7tt0q",
    "naicsCode": "54171",
    "industry": "Green technology"
  },
  {
    "naicsCodeId": "2o8v0qjNJE2LLyZhcPPX0jDQaHX",
    "naicsCode": "541214",
    "industry": "Medical billing"
  },
  {
    "naicsCodeId": "2o8v0qJtcEuHP3vCT5VKkIU5SXX",
    "naicsCode": "721120",
    "industry": "Casino hotel"
  },
  {
    "naicsCodeId": "2o8v0qkS8aV38NOEuUdi8nSKnB8",
    "naicsCode": "561740",
    "industry": "Carpet and upholstery cleaning"
  },
  {
    "naicsCodeId": "2o8v0qKyyhreuupP3Hu7F0p12em",
    "naicsCode": "5613",
    "industry": "Staffing service"
  },
  {
    "naicsCodeId": "2o8v0qL4Y8Pi2Rmxpl2E1gFt9Zi",
    "naicsCode": "4411",
    "industry": "Car sales"
  },
  {
    "naicsCodeId": "2o8v0qlLBdkk0T31Sw3sZvnojdx",
    "naicsCode": "722511",
    "industry": "Restaurant"
  },
  {
    "naicsCodeId": "2o8v0qLNc7W6EfhvQG627O3mkeR",
    "naicsCode": "812112",
    "industry": "Beauty salon"
  },
  {
    "naicsCodeId": "2o8v0qlqESxvbhfSbK4gsln4wkY",
    "naicsCode": "488190",
    "industry": "Aviation maintenance"
  },
  {
    "naicsCodeId": "2o8v0qlrurSON6Mm1CzbxWHahYH",
    "naicsCode": "621420",
    "industry": "Mental health"
  },
  {
    "naicsCodeId": "2o8v0qmEydt8P15gDPvz8jaDyre",
    "naicsCode": "487210",
    "industry": "Yacht charter"
  },
  {
    "naicsCodeId": "2o8v0qMkzAvG4VJKiqVswZ8F23f",
    "naicsCode": "455219",
    "industry": "Online marketplace"
  },
  {
    "naicsCodeId": "2o8v0qmUEHfVK6DFL0ZfYXaWzB1",
    "naicsCode": "7223",
    "industry": "Mobile bartending"
  },
  {
    "naicsCodeId": "2o8v0qMZpVBjvVvvQkCrRlydnox",
    "naicsCode": "541715",
    "industry": "Geology"
  },
  {
    "naicsCodeId": "2o8v0qndDMN06xl1bnmcJAARjJp",
    "naicsCode": "722513",
    "industry": "Food delivery restaurant"
  },
  {
    "naicsCodeId": "2o8v0qnv1U9w6iZ55KQ3yl1zdmF",
    "naicsCode": "611",
    "industry": "Online education services"
  },
  {
    "naicsCodeId": "2o8v0qOCgEo3LGe5G8ovO5tzOPH",
    "naicsCode": "441330",
    "industry": "Car parts"
  },
  {
    "naicsCodeId": "2o8v0qofLTdCATf8j0Jk9El2A7v",
    "naicsCode": "4841",
    "industry": "Haul freight"
  },
  {
    "naicsCodeId": "2o8v0qOymYl9gB7k6LFeUMhgxK1",
    "naicsCode": "611620",
    "industry": "Youth sports"
  },
  {
    "naicsCodeId": "2o8v0qpGa0JHkiuEMC2MuRgODLX",
    "naicsCode": "236118",
    "industry": "Home remodeling"
  },
  {
    "naicsCodeId": "2o8v0qpSfF8wNE2qYPdshJhCW0k",
    "naicsCode": "51712",
    "industry": "Cell phone store"
  },
  {
    "naicsCodeId": "2o8v0qPuFbbz4heQd1xag2nhpbO",
    "naicsCode": "561790",
    "industry": "Pool services"
  },
  {
    "naicsCodeId": "2o8v0qpvgKhM69j8ZPEzAPTQRRk",
    "naicsCode": "561510",
    "industry": "Travel agency"
  },
  {
    "naicsCodeId": "2o8v0qqb4C5ChL6qgiV4cJvCoho",
    "naicsCode": "711410",
    "industry": "Talent agency"
  },
  {
    "naicsCodeId": "2o8v0qqgCWgZypWSxy7FZp2VDqi",
    "naicsCode": "459999",
    "industry": "Candle store"
  },
  {
    "naicsCodeId": "2o8v0qQocC7ZZ919hTFws01rh8G",
    "naicsCode": "541511",
    "industry": "Software consulting"
  },
  {
    "naicsCodeId": "2o8v0qR5jgAH359s33z77Sqx1BN",
    "naicsCode": "713940",
    "industry": "Pilates studio"
  },
  {
    "naicsCodeId": "2o8v0qr84SaxK3gIEtGzyznL3AI",
    "naicsCode": "332994",
    "industry": "Firearms manufacturing"
  },
  {
    "naicsCodeId": "2o8v0qRsMmBX6qi5LkJN2AzJhk0",
    "naicsCode": "611610",
    "industry": "Music teacher"
  },
  {
    "naicsCodeId": "2o8v0qSHNRzhGAhzfxoLntqUguK",
    "naicsCode": "921190",
    "industry": "Government contracting"
  },
  {
    "naicsCodeId": "2o8v0qslxq6f9nzr1911b2to2Im",
    "naicsCode": "811111",
    "industry": "Car repair"
  },
  {
    "naicsCodeId": "2o8v0qsRo7c0FGM15depXpRJsE5",
    "naicsCode": "459910",
    "industry": "Pet supplies"
  },
  {
    "naicsCodeId": "2o8v0qSSfmX3D9GNziL1DgPdocs",
    "naicsCode": "561720",
    "industry": "Home cleaning"
  },
  {
    "naicsCodeId": "2o8v0qt2gVNciyeXEpIL1VhBdmG",
    "naicsCode": "115210",
    "industry": "Equestrian"
  },
  {
    "naicsCodeId": "2o8v0qtCDu9E05SN390c3wzkM7i",
    "naicsCode": "541921",
    "industry": "Wedding photography"
  },
  {
    "naicsCodeId": "2o8v0qTF3fiNOWi1U0rT2Ib7SGY",
    "naicsCode": "337",
    "industry": "Woodwork"
  },
  {
    "naicsCodeId": "2o8v0qTNotmy9IdHYtJjWRlTBQk",
    "naicsCode": "488330",
    "industry": "Maritime pilot"
  },
  {
    "naicsCodeId": "2o8v0qtp5Lu0CUHHmYAlOJ9vTzD",
    "naicsCode": "623110",
    "industry": "Nursing home"
  },
  {
    "naicsCodeId": "2o8v0qTulIKYClRK6g2ujLayMem",
    "naicsCode": "621330",
    "industry": "Applied behavior analysis"
  },
  {
    "naicsCodeId": "2o8v0qudV9r7myIyN7bhrLdi0hK",
    "naicsCode": "481",
    "industry": "Airplane charter"
  },
  {
    "naicsCodeId": "2o8v0quX8KxAdGAwK6FbChVPCpA",
    "naicsCode": "531",
    "industry": "Real estate"
  },
  {
    "naicsCodeId": "2o8v0quzcsnzkwtEzXmFJyJzTSI",
    "naicsCode": "541613",
    "industry": "Marketing"
  },
  {
    "naicsCodeId": "2o8v0qVDR2OivRlY4zocX2SEiwf",
    "naicsCode": "456110",
    "industry": "Pharmacy"
  },
  {
    "naicsCodeId": "2o8v0qVhP7wB3AUOmoIutqbhfxC",
    "naicsCode": "62139",
    "industry": "Nutrition consulting"
  },
  {
    "naicsCodeId": "2o8v0qvRum9SsLO5Qj90Vd6S5l6",
    "naicsCode": "611",
    "industry": "Education consulting"
  },
  {
    "naicsCodeId": "2o8v0qWCdxAksJBxrVG4dAeufI5",
    "naicsCode": "541490",
    "industry": "Games designer"
  },
  {
    "naicsCodeId": "2o8v0qXcXdYmvsCb19s0REVLEnB",
    "naicsCode": "54192",
    "industry": "Photography"
  },
  {
    "naicsCodeId": "2o8v0qXdCJ8fofZ9jkXca07CkNp",
    "naicsCode": "561311",
    "industry": "Headhunting"
  },
  {
    "naicsCodeId": "2o8v0qxN5kAwi0bT2JBlL3E44Vz",
    "naicsCode": "541330",
    "industry": "Engineering"
  },
  {
    "naicsCodeId": "2o8v0qxrGBVzG2mksQODX2WEVzZ",
    "naicsCode": "487210",
    "industry": "Fishing charters"
  },
  {
    "naicsCodeId": "2o8v0qy6MZ5x62enGSigV4m37W2",
    "naicsCode": "513120",
    "industry": "Blogging"
  },
  {
    "naicsCodeId": "2o8v0qYDHuFy3XCDKyt4arAWbr4",
    "naicsCode": "713940",
    "industry": "Gym"
  },
  {
    "naicsCodeId": "2o8v0qydK8M3B7CqowFkHhULnuY",
    "naicsCode": "456120",
    "industry": "Beauty products"
  },
  {
    "naicsCodeId": "2o8v0qYjfuJqXwpQfQjA3DNGnRq",
    "naicsCode": "312111",
    "industry": "Beverage manufacturing"
  },
  {
    "naicsCodeId": "2o8v0qyzi879Dp2KWfwDn4ysdja",
    "naicsCode": "713990",
    "industry": "Adult entertainment"
  },
  {
    "naicsCodeId": "2o8v0qZ6hR0GVIUV57dIMrCY0f5",
    "naicsCode": "456120",
    "industry": "Skin care products"
  },
  {
    "naicsCodeId": "2o8v0qzBFU8EraKf78nb5o18MK5",
    "naicsCode": "32",
    "industry": "Packaging manufacturing"
  },
  {
    "naicsCodeId": "2o8v0qZDV4j453OQexCNs2F1Pva",
    "naicsCode": "484210",
    "industry": "Home moving"
  },
  {
    "naicsCodeId": "2o8v0r0hOP62kLsYBpAuqouHFvw",
    "naicsCode": "722330",
    "industry": "Ice cream truck"
  },
  {
    "naicsCodeId": "2o8v0r0K3LPd3LXDx9ByXOtEHxT",
    "naicsCode": "484220",
    "industry": "Dump truck"
  },
  {
    "naicsCodeId": "2o8v0r1sqI5AFC5JrbX8xzij7IE",
    "naicsCode": "812910",
    "industry": "Pet sitting"
  },
  {
    "naicsCodeId": "2o8v0r2jYv1EXJQz6KgFy9QtLKd",
    "naicsCode": "5313",
    "industry": "House flipping"
  },
  {
    "naicsCodeId": "2o8v0r3cf1pMjCYHowVaxeIF2uB",
    "naicsCode": "812199",
    "industry": "Permanent makeup"
  },
  {
    "naicsCodeId": "2o8v0r3WA8chZIIR6kUulGY4C25",
    "naicsCode": "45",
    "industry": "Sell products"
  },
  {
    "naicsCodeId": "2o8v0r4EbvjCuSuOjd6CgcxIlyS",
    "naicsCode": "238320",
    "industry": "Painting contractor"
  },
  {
    "naicsCodeId": "2o8v0r5HMoN2GBgcAgVqB3pJOvJ",
    "naicsCode": "8121",
    "industry": "Aesthetics"
  },
  {
    "naicsCodeId": "2o8v0r5wEdD9iN9ebct8cwQNZiD",
    "naicsCode": "336999",
    "industry": "Golf carts"
  },
  {
    "naicsCodeId": "2o8v0r6CifbYTzitAsJDmZJrM5E",
    "naicsCode": "561730",
    "industry": "Gardening"
  },
  {
    "naicsCodeId": "2o8v0r6HnTbiQscdZZLRcj8jG6s",
    "naicsCode": "325411",
    "industry": "Dietary supplements"
  },
  {
    "naicsCodeId": "2o8v0r7lvnIf7cXhuNQkjQBEszM",
    "naicsCode": "8111",
    "industry": "Mechanic"
  },
  {
    "naicsCodeId": "2o8v0r9jQc2Tw03WHck7MbtnjJH",
    "naicsCode": "524210",
    "industry": "Insurance services"
  },
  {
    "naicsCodeId": "2o8v0r9NntgdYJXCuOYAHS2buQa",
    "naicsCode": "621340",
    "industry": "Audiology"
  },
  {
    "naicsCodeId": "2o8v0ralXjs2pAIthkQXeEOXqiR",
    "naicsCode": "445132",
    "industry": "Vending machine business"
  },
  {
    "naicsCodeId": "2o8v0rAwjBrhbKyAc2bEiDbTdIL",
    "naicsCode": "541690",
    "industry": "Construction consulting"
  },
  {
    "naicsCodeId": "2o8v0rBKoIk9ClaKV3kUW93EaeE",
    "naicsCode": "722330",
    "industry": "Food vending business"
  },
  {
    "naicsCodeId": "2o8v0rCaiN2DGSGuq0EO6aBAGR1",
    "naicsCode": "812930",
    "industry": "Parking lots and garages"
  },
  {
    "naicsCodeId": "2o8v0rDBnDiL7Dzzae8tUiXg3FL",
    "naicsCode": "561730",
    "industry": "Garden landscaping"
  },
  {
    "naicsCodeId": "2o8v0rDBw6bc6eIFFsLidgzIbZm",
    "naicsCode": "518210",
    "industry": "Cryptocurrency mining"
  },
  {
    "naicsCodeId": "2o8v0rdGJnKed4mnxhqKJW0fRYo",
    "naicsCode": "5617",
    "industry": "Outdoor services"
  },
  {
    "naicsCodeId": "2o8v0rdRy5nFf812LSaimPNIq9z",
    "naicsCode": "541430",
    "industry": "Graphic design"
  },
  {
    "naicsCodeId": "2o8v0rE92PwijFSe1YBvHqB04Y9",
    "naicsCode": "621340",
    "industry": "Physical therapy"
  },
  {
    "naicsCodeId": "2o8v0rEfexh5cFO1XNsux7TS9Pm",
    "naicsCode": "31",
    "industry": "Manufacturing"
  },
  {
    "naicsCodeId": "2o8v0rEG9CICIUq2gAlHNqaTF6J",
    "naicsCode": "512240",
    "industry": "Recording studio"
  },
  {
    "naicsCodeId": "2o8v0rEJkXnmshDT7gfQSoiORhH",
    "naicsCode": "722320",
    "industry": "Catering"
  },
  {
    "naicsCodeId": "2o8v0rEO4jPV88VWhfzc1V40VJZ",
    "naicsCode": "561730",
    "industry": "Lawncare"
  },
  {
    "naicsCodeId": "2o8v0rEtFjqHIax6w4Oje8CLxho",
    "naicsCode": "812990",
    "industry": "Personal training"
  },
  {
    "naicsCodeId": "2o8v0rEu8j38PaN0AwRW6YhEKi3",
    "naicsCode": "812112",
    "industry": "Beauty services"
  },
  {
    "naicsCodeId": "2o8v0rf5aUWTq3snYN6gM20iP3o",
    "naicsCode": "541715",
    "industry": "Aerospace engineering"
  },
  {
    "naicsCodeId": "2o8v0rf99T6VmT63srGVWWOPf3V",
    "naicsCode": "541611",
    "industry": "Project management"
  },
  {
    "naicsCodeId": "2o8v0rfDcr7fRjcVJjj34wj8RAS",
    "naicsCode": "112920",
    "industry": "Horse breeding or sales"
  },
  {
    "naicsCodeId": "2o8v0rfDLAJdp6nJGvJXcQbJJzx",
    "naicsCode": "54161",
    "industry": "Business consulting"
  },
  {
    "naicsCodeId": "2o8v0rFe56R15Q7cVUZu2VYVChP",
    "naicsCode": "315990",
    "industry": "Accessories"
  },
  {
    "naicsCodeId": "2o8v0rG840QKX19xrCf887k2e8A",
    "naicsCode": "112511",
    "industry": "Fish farming"
  },
  {
    "naicsCodeId": "2o8v0rgCReBj9sgYtyXsgtiFyld",
    "naicsCode": "721",
    "industry": "Lodging"
  },
  {
    "naicsCodeId": "2o8v0rGIrKoDbGyerAr02GizQdY",
    "naicsCode": "42",
    "industry": "Import / export goods service"
  },
  {
    "naicsCodeId": "2o8v0rGOcQ8lyXShajduJ4lWJOp",
    "naicsCode": "4561",
    "industry": "Health and personal care retailers"
  },
  {
    "naicsCodeId": "2o8v0rGuAphoFcRL6gPrCJWCJ35",
    "naicsCode": "48",
    "industry": "Freight"
  },
  {
    "naicsCodeId": "2o8v0rGyBxNOHK697Sk0cir71bY",
    "naicsCode": "812990",
    "industry": "Concierge"
  },
  {
    "naicsCodeId": "2o8v0rH4zkqpVz6WrHaENKPBsoo",
    "naicsCode": "423990",
    "industry": "Firewood"
  },
  {
    "naicsCodeId": "2o8v0rH6apUKqzMzs50PyX1gCKI",
    "naicsCode": "48",
    "industry": "Logistics"
  },
  {
    "naicsCodeId": "2o8v0rHcBUeCInwlmh0Q9DPi38B",
    "naicsCode": "532289",
    "industry": "Event rentals"
  },
  {
    "naicsCodeId": "2o8v0rhcN1SGgyv6nOqtj365mCR",
    "naicsCode": "812112",
    "industry": "Hair extensions"
  },
  {
    "naicsCodeId": "2o8v0rhdHgWJbaJ4pw2zGYziDWH",
    "naicsCode": "6214",
    "industry": "Outpatient service"
  },
  {
    "naicsCodeId": "2o8v0rhDRyxXY3VAFJXkqTKlS1C",
    "naicsCode": "711212",
    "industry": "Horse racing"
  },
  {
    "naicsCodeId": "2o8v0rHHVl4HyjusUex2pSLaire",
    "naicsCode": "7139",
    "industry": "Outdoors"
  },
  {
    "naicsCodeId": "2o8v0rhjdM4Y25BDBc0g9A9WlEz",
    "naicsCode": "332",
    "industry": "Fabrication"
  },
  {
    "naicsCodeId": "2o8v0rimiAnBUIDBOTcOdXHkzDu",
    "naicsCode": "621340",
    "industry": "Speech therapy"
  },
  {
    "naicsCodeId": "2o8v0rIswTImmXISkGksI1MfpFk",
    "naicsCode": "23",
    "industry": "Construction management"
  },
  {
    "naicsCodeId": "2o8v0rJ5mZERc43zhDh3bsRvWH7",
    "naicsCode": "485310",
    "industry": "Ride share"
  },
  {
    "naicsCodeId": "2o8v0rJENdIwrEMq5jh8mqFAM4A",
    "naicsCode": "114210",
    "industry": "Hunting"
  },
  {
    "naicsCodeId": "2o8v0rJYgkFv8haWIkfe8QyoJHR",
    "naicsCode": "337",
    "industry": "Furniture manufacturing"
  },
  {
    "naicsCodeId": "2o8v0rlbeOkLVDlzHCqHTgYkanc",
    "naicsCode": "811122",
    "industry": "Window tinting"
  },
  {
    "naicsCodeId": "2o8v0rLe0R0zrRheJzynEJkTj0u",
    "naicsCode": "541922",
    "industry": "Drone photography"
  },
  {
    "naicsCodeId": "2o8v0rlG96CrLbONfmSiASs8he3",
    "naicsCode": "541820",
    "industry": "Public relations consulting"
  },
  {
    "naicsCodeId": "2o8v0rLIGQGONcf4gTnS3V3l83x",
    "naicsCode": "327110",
    "industry": "Ceramics"
  },
  {
    "naicsCodeId": "2o8v0rLNQ7DiDszV2a3ULNr9YNe",
    "naicsCode": "54161",
    "industry": "Business development consulting"
  },
  {
    "naicsCodeId": "2o8v0rlvTiO5XY0v4U3m7Cre1VP",
    "naicsCode": "23",
    "industry": "General construction"
  },
  {
    "naicsCodeId": "2o8v0rmixPgdgsbso8Yhu5lGR5M",
    "naicsCode": "459910",
    "industry": "Pet store"
  },
  {
    "naicsCodeId": "2o8v0rn1w5qJuHlEGFB0ymqBkwI",
    "naicsCode": "812910",
    "industry": "Dog grooming"
  },
  {
    "naicsCodeId": "2o8v0rn8TVUjHxj8EkmzDggAo9o",
    "naicsCode": "812990",
    "industry": "Life coaching"
  },
  {
    "naicsCodeId": "2o8v0rNbCTy8Rslrl0ztxSMUNfI",
    "naicsCode": "621330",
    "industry": "Mental health therapy"
  },
  {
    "naicsCodeId": "2o8v0rnXobx4KBzxYfGJAEpOK0l",
    "naicsCode": "456120",
    "industry": "Fragrance"
  },
  {
    "naicsCodeId": "2o8v0rNyUqxnTOE0jgjUIh0maOO",
    "naicsCode": "711410",
    "industry": "Modeling agency"
  },
  {
    "naicsCodeId": "2o8v0roNkXYQU5FmV8vse9tQnuS",
    "naicsCode": "541310",
    "industry": "Architecture"
  },
  {
    "naicsCodeId": "2o8v0roUMN3BFuqa8IDORpNWn2C",
    "naicsCode": "45",
    "industry": "Retail sales"
  },
  {
    "naicsCodeId": "2o8v0rpApMTUeMK5hnkkuDEroET",
    "naicsCode": "541511",
    "industry": "Software development"
  },
  {
    "naicsCodeId": "2o8v0rpWpbQbTbtOSrad9vgz0wb",
    "naicsCode": "455",
    "industry": "Merchandise"
  },
  {
    "naicsCodeId": "2o8v0rQ1D4MC6guAGZAdKXL1JB9",
    "naicsCode": "541512",
    "industry": "IT services"
  },
  {
    "naicsCodeId": "2o8v0rQa02xK2I7Gbjzi3UBN85i",
    "naicsCode": "238910",
    "industry": "Demolition"
  },
  {
    "naicsCodeId": "2o8v0rqeFbKgcd8MCvRqrD1Xve4",
    "naicsCode": "541",
    "industry": "Medical consulting"
  },
  {
    "naicsCodeId": "2o8v0rQKJ6ckblJrqk2M4nMiMMv",
    "naicsCode": "56142",
    "industry": "Call center"
  },
  {
    "naicsCodeId": "2o8v0rQU8dh0FNa15w28YJ7rotg",
    "naicsCode": "541214",
    "industry": "Payroll service"
  },
  {
    "naicsCodeId": "2o8v0rrEZtXyInZ9OiTq0vl1FtV",
    "naicsCode": "811490",
    "industry": "Boat repair and maintenance"
  },
  {
    "naicsCodeId": "2o8v0rrI5KCYN8uFXPRUaJUeWFY",
    "naicsCode": "541430",
    "industry": "Digital design consulting"
  },
  {
    "naicsCodeId": "2o8v0rRiBS0G3cUsd68y2Z5xU9N",
    "naicsCode": "424590",
    "industry": "Hemp"
  },
  {
    "naicsCodeId": "2o8v0rSVCAUlOVrYe2eOZAfvX5I",
    "naicsCode": "311811",
    "industry": "Baking"
  },
  {
    "naicsCodeId": "2o8v0rSXy780orIzF9dJEM4be0S",
    "naicsCode": "722320",
    "industry": "Food catering"
  },
  {
    "naicsCodeId": "2o8v0rtzPXYeoYaeu9XD993f0I8",
    "naicsCode": "23",
    "industry": "Construction services"
  },
  {
    "naicsCodeId": "2o8v0rUEMF4DBaoQunoGzzpssBe",
    "naicsCode": "561730",
    "industry": "Tree services"
  },
  {
    "naicsCodeId": "2o8v0rUK0NuvezzZqkL54neRwsE",
    "naicsCode": "459120",
    "industry": "Crafts store"
  },
  {
    "naicsCodeId": "2o8v0rukIpm23MMBWyhos8qg2Qw",
    "naicsCode": "561720",
    "industry": "House cleaning"
  },
  {
    "naicsCodeId": "2o8v0rUtgMERQodoIklkmGRywaT",
    "naicsCode": "611610",
    "industry": "Drama school"
  },
  {
    "naicsCodeId": "2o8v0rV5nE9Y5bLqKmrxCKKekl0",
    "naicsCode": "561720",
    "industry": "Housekeeping"
  },
  {
    "naicsCodeId": "2o8v0rVnYoH7q35RlBubqTH5vky",
    "naicsCode": "311",
    "industry": "Food manufacturing"
  },
  {
    "naicsCodeId": "2o8v0rVW8S4ILn8QOeUJCSP3wbM",
    "naicsCode": "238910",
    "industry": "Land clearing"
  },
  {
    "naicsCodeId": "2o8v0rWRL5cymFggnvk9v6T95cf",
    "naicsCode": "624",
    "industry": "Social work"
  },
  {
    "naicsCodeId": "2o8v0rWSlk85RGfCWe7EfCTDBcK",
    "naicsCode": "455110",
    "industry": "Tech store"
  },
  {
    "naicsCodeId": "2o8v0rWUw4jtJfP4ul0tVwHeXLj",
    "naicsCode": "541611",
    "industry": "Management services"
  },
  {
    "naicsCodeId": "2o8v0rXBa5zfkmClaU5TKvWnKwk",
    "naicsCode": "532289",
    "industry": "Party rental"
  },
  {
    "naicsCodeId": "2o8v0rXm9YBN3A3Kp74VGJuSelY",
    "naicsCode": "5414",
    "industry": "Furniture design"
  },
  {
    "naicsCodeId": "2o8v0rYJPySc8HwZqUDsXSemdR0",
    "naicsCode": "5324",
    "industry": "Equipment rental"
  },
  {
    "naicsCodeId": "2o8v0rYV5Qh8mQl7X2C1V1AvwOA",
    "naicsCode": "112920",
    "industry": "Equine"
  },
  {
    "naicsCodeId": "2o8v0rZ7roxJ3TJFblJ04IQvOtG",
    "naicsCode": "455219",
    "industry": "E-commerce"
  },
  {
    "naicsCodeId": "2o8v0rzMDeNkmP3KdOUrYODF68I",
    "naicsCode": "2382",
    "industry": "Building equipment contracting"
  },
  {
    "naicsCodeId": "2o8v0rznDiW4tKvDGcMMZjOYpec",
    "naicsCode": "621399",
    "industry": "Wellness and health center"
  },
  {
    "naicsCodeId": "2o8v0rZpvEUUXkVUne6dDaFjpS0",
    "naicsCode": "623220",
    "industry": "Drug and alcohol recovery service"
  },
  {
    "naicsCodeId": "2o8v0s07QAjH9TEH7wN5KYuQD7T",
    "naicsCode": "5313",
    "industry": "Buy and sell real estate"
  },
  {
    "naicsCodeId": "2o8v0s0Xlc0zhvlHMucvD5iV7OY",
    "naicsCode": "8111",
    "industry": "Mobile mechanic"
  },
  {
    "naicsCodeId": "2o8v0s1Fw5P8EdBbysFkLBPuP4k",
    "naicsCode": "2211",
    "industry": "Renewable energy"
  },
  {
    "naicsCodeId": "2o8v0s2kTu4yO2vW6Wg93R5Ceyw",
    "naicsCode": "711130",
    "industry": "Band"
  },
  {
    "naicsCodeId": "2o8v0s2ncH8gSrdSI7nqk9xXuJs",
    "naicsCode": "711510",
    "industry": "DJ"
  },
  {
    "naicsCodeId": "2o8v0s53knqir1sDYRbsJqNJbh9",
    "naicsCode": "561720",
    "industry": "Janitorial service"
  },
  {
    "naicsCodeId": "2o8v0s5Cg93WqiFUjj59YFSemo1",
    "naicsCode": "531130",
    "industry": "Self storage"
  },
  {
    "naicsCodeId": "2o8v0s5lFgrUIIvXE6MRhoxFyPi",
    "naicsCode": "5418",
    "industry": "Media management"
  },
  {
    "naicsCodeId": "2o8v0s612xm3BnHqZq39s64EJah",
    "naicsCode": "449210",
    "industry": "Electronics"
  },
  {
    "naicsCodeId": "2o8v0s612xm3BnHqZq39s64EJahj",
    "naicsCode": "339114",
    "industry": "Dental equipment & supplies manufacturing"
  }
] as const;

/** Quick lookup set for validation */
export const DOOLA_VALID_INDUSTRIES = new Set(DOOLA_NAICS_CODES.map(c => c.industry));

/** Sorted list of industry labels for the dropdown */
export const DOOLA_INDUSTRY_OPTIONS = DOOLA_NAICS_CODES
  .map(c => ({ value: c.industry, label: c.industry, naicsCode: c.naicsCode }))
  .sort((a, b) => a.label.localeCompare(b.label));
