/**
 * The filing provider's `industry` for every activity the wizard can produce
 * (2026-10-29, ported from Her First Order's PR #397). Since the provider's
 * 2026-10-27 change a company create without `industry` is refused (400
 * E_VALIDATION_FAILED, fields.industry = E_INDUSTRY_INVALID), and `naicsCode`
 * is no longer accepted; HFO's order #32 ("workwear") was refused that way.
 *
 * This app's wizard (client/src/components/llc-formation/WizardSteps.tsx)
 * writes the provider's own label: businessType DIRECT_LABEL_MARKER (a
 * one-tap preset or the searchable list from shared/doola-industries.ts),
 * with industryType holding the label. deriveDoolaIndustry in doola.ts reads that
 * label first. Everything else is the three-level taxonomy of
 * shared/whop-taxonomy.ts (2,033 choices in 140 groups, the same file as
 * HFO's): drafts and orders from before the provider-label switch, and any
 * triple the activity step still accepts (llcActivityStepSchema's taxonomy
 * path). This table maps every one of those choices, and the app's own
 * activity choices (LLC_ACTIVITY_CHOICES in shared/llc.ts, keyed the same
 * way), so no order this app can hold files without an industry.
 *
 * GROUP_INDUSTRY and the first block of CHOICE_INDUSTRY are HFO's table
 * verbatim (the taxonomy is identical); the second block adds closer labels
 * for the rental and real-estate choices this app's clients pick. A label
 * not on the reference list is never returned: deriveDoolaIndustry treats it
 * as unmappable and the filing step holds the order for ops before any call.
 * server/llc/industryMap.test.ts checks every choice resolves to a label on
 * the reference list and on the provider's live list fetched 2026-10-29.
 */
import { DOOLA_VALID_INDUSTRIES } from "../../shared/doola-industries";
import { isValidWhopTaxonomySelection } from "../../shared/whop-taxonomy";
import { findLlcActivityChoice } from "../../shared/llc";

/** `${businessType}/${industryGroup}` → provider industry label. */
export const GROUP_INDUSTRY: Readonly<Record<string, string>> = {
  "coaching_and_courses/trading_and_investing": "Online education services",
  "coaching_and_courses/sports_betting_and_gambling": "Online education services",
  "coaching_and_courses/fitness_and_athletics": "Fitness coaching",
  "coaching_and_courses/health_and_wellness": "Health coaching",
  "coaching_and_courses/business_and_entrepreneurship": "Coaching and consulting",
  "coaching_and_courses/sales_and_revenue": "Sales consulting",
  "coaching_and_courses/marketing_and_advertising": "Marketing consulting",
  "coaching_and_courses/creative_and_content_creation": "Online education services",
  "coaching_and_courses/tech_and_development": "Online education services",
  "coaching_and_courses/real_estate": "Real estate consulting",
  "coaching_and_courses/personal_finance": "Personal finance",
  "coaching_and_courses/career_and_professional": "Coaching",
  "coaching_and_courses/dating_and_relationships": "Life coaching",
  "coaching_and_courses/spirituality_and_mindfulness": "Life coaching",
  "coaching_and_courses/personal_development": "Personal development",
  "coaching_and_courses/publishing_and_info_products": "Digital products",
  "coaching_and_courses/academic_and_test_prep": "Tutoring",
  "coaching_and_courses/hobbies_and_lifestyle": "Online education services",
  "coaching_and_courses/video_games_and_esports": "Online education services",
  "coaching_and_courses/legal_and_compliance": "Online education services",
  "coaching_and_courses/music_and_performing_arts": "Music teacher",
  "coaching_and_courses/language_and_communication": "Tutoring",
  "services/marketing_and_advertising": "Digital marketing agency",
  "services/sales_and_revenue": "Sales and marketing",
  "services/ai_and_automation_agencies": "Automation",
  "services/creative_and_content_creation": "Creative agency",
  "services/tech_and_development": "Software development",
  "services/recruiting_and_staffing": "Staffing service",
  "services/customer_support_agencies": "Call center",
  "services/consulting": "Consulting",
  "services/professional_services": "Professional services",
  "services/media_and_publishing_companies": "Media",
  "services/home_and_trade_services": "Home services",
  "services/security_and_investigations": "Security services",
  "services/personal_services": "Personal services",
  "services/logistics_and_transportation_services": "Logistics",
  "services/industrial_and_manufacturing": "Manufacturing",
  "services/health_and_wellness_services": "Health and wellness",
  "physical_product/clothing_and_apparel": "Clothing brand",
  "physical_product/supplements_and_nutrition": "Supplements",
  "physical_product/beauty_and_personal_care": "Beauty products",
  "physical_product/fitness_equipment_and_gear": "Sporting goods",
  "physical_product/accessories": "Accessories",
  "physical_product/home_and_living": "Home goods",
  "physical_product/electronics_and_gadgets": "Electronics",
  "physical_product/food_and_beverages": "Food manufacturing",
  "physical_product/baby_and_kids": "Consumer goods",
  "physical_product/outdoor_and_sports": "Sporting goods",
  "physical_product/arts_and_crafts": "Crafts",
  "physical_product/automotive": "Car parts",
  "physical_product/pets_and_animals": "Pet products",
  "physical_product/home_improvement_and_tools": "Tool sales",
  "physical_product/office_and_business_supplies": "Stationery",
  "physical_product/sustainability_and_eco_products": "Consumer goods",
  "physical_product/religion_and_faith": "Speciality store",
  "marketplace/product_marketplaces": "Online marketplace",
  "marketplace/service_marketplaces": "Online marketplace",
  "marketplace/rental_marketplaces": "Online marketplace",
  "marketplace/food_and_hospitality_marketplaces": "Online marketplace",
  "marketplace/digital_and_education_marketplaces": "Online marketplace",
  "marketplace/b2b_and_professional_marketplaces": "Online marketplace",
  "gig_economy/delivery_and_logistics": "Delivery service",
  "gig_economy/transportation": "Ride share",
  "gig_economy/task_and_errands": "Personal services",
  "gig_economy/home_services_gigs": "Handyman service",
  "gig_economy/creative_and_content_creation": "Content creator",
  "gig_economy/professional_gigs": "Professional services",
  "gig_economy/specialized_gigs": "General services",
  "paid_group/trading_and_investing": "Online education services",
  "paid_group/sports_betting_and_gambling": "Online education services",
  "paid_group/business_and_entrepreneurship": "Online education services",
  "paid_group/fitness_and_athletics": "Online education services",
  "paid_group/creative_and_content_creation": "Online education services",
  "paid_group/tech_and_development": "Online education services",
  "paid_group/lifestyle_and_personal_growth": "Online education services",
  "paid_group/video_games_and_esports": "Online education services",
  "paid_group/hobbies_and_lifestyle": "Online education services",
  "software/trading_and_investing": "SaaS",
  "software/ai_and_automation_software": "SaaS",
  "software/marketing_and_advertising": "SaaS",
  "software/e_commerce_software": "SaaS",
  "software/productivity_and_business_ops": "SaaS",
  "software/tech_and_development": "SaaS",
  "software/community_and_education_software": "SaaS",
  "software/health_and_wellness": "SaaS",
  "software/real_estate": "SaaS",
  "software/industry_specific_software": "SaaS",
  "software/security_and_privacy_software": "SaaS",
  "software/gaming_and_entertainment_software": "Video game development",
  "software/communication_and_messaging_software": "SaaS",
  "software/digital_goods_and_accounts": "Digital products",
  "telehealth/primary_and_general_care": "Medical services",
  "telehealth/dermatology_and_skin": "Medical services",
  "telehealth/mental_health_and_behavioral": "Mental health",
  "telehealth/womens_and_mens_health": "Medical services",
  "telehealth/dental_and_vision": "Dental services",
  "telehealth/specialty_medical_care": "Medical services",
  "telehealth/weight_and_metabolic_health": "Medical services",
  "telehealth/rehabilitation_and_therapy": "Physical therapy",
  "telehealth/sleep_and_chronic_conditions": "Medical services",
  "telehealth/wellness_and_alternative": "Holistic healing",
  "telehealth/genetic_and_specialized": "Medical testing",
  "telehealth/veterinary": "Veterinary medicine",
  "class_action_settlement/class_action_settlement": "Legal services business",
  "events/educational_training_events": "Education and training",
  "events/conference_and_expo_events": "Event production",
  "events/social_and_networking_events": "Event production",
  "events/performance_and_show_events": "Event production",
  "events/social_entertainment_events": "Event production",
  "events/sports_and_fitness_events": "Event production",
  "events/lifestyle_and_wellness_events": "Event production",
  "events/charity_and_cause_events": "Charity",
  "events/family_and_community_events": "Event production",
  "newsletter/finance_and_investing": "Publishing",
  "newsletter/business_and_entrepreneurship": "Publishing",
  "newsletter/tech_and_ai": "Publishing",
  "newsletter/health_and_wellness": "Publishing",
  "newsletter/lifestyle_and_culture": "Publishing",
  "newsletter/news_and_politics": "Publishing",
  "newsletter/creative_and_education": "Publishing",
  "newsletter/spirituality_and_personal_growth": "Publishing",
  "brick_and_mortar/fitness_and_recreation": "Fitness center",
  "brick_and_mortar/restaurants": "Restaurant",
  "brick_and_mortar/cafes_and_quick_service": "Cafe",
  "brick_and_mortar/bars_and_breweries": "Bar",
  "brick_and_mortar/agriculture_and_farming": "Farming",
  "brick_and_mortar/retail": "Retail sales",
  "brick_and_mortar/beauty_and_wellness": "Beauty salon",
  "brick_and_mortar/healthcare": "Medical practice",
  "brick_and_mortar/funeral_and_death_care": "Funeral services",
  "brick_and_mortar/automotive": "Auto repair",
  "brick_and_mortar/hospitality_and_lodging": "Hospitality",
  "brick_and_mortar/education_and_childcare": "Education",
  "brick_and_mortar/entertainment_and_leisure": "Entertainment",
  "brick_and_mortar/professional_services_storefront": "Professional services",
  "brick_and_mortar/pet_services": "Pet services",
  "brick_and_mortar/home_and_trade_storefronts": "Home services",
  "other/nonprofit_and_charity": "Non-profit organization",
  "other/government_and_public": "Government contracting",
  "other/miscellaneous": "General services",
};

/** `${businessType}/${industryGroup}/${industryType}` → a closer label than its group's. */
export const CHOICE_INDUSTRY: Readonly<Record<string, string>> = {
  // Her First Order's overrides (PR #397), verbatim.
  "physical_product/clothing_and_apparel/kids_clothing": "Children's clothing",
  "physical_product/accessories/jewelry": "Jewelry",
  "physical_product/baby_and_kids/baby_clothing_accessories": "Children's clothing",
  "physical_product/food_and_beverages/baked_goods": "Baked goods",
  "physical_product/food_and_beverages/specialty_coffee_tea": "Coffee",
  "physical_product/religion_and_faith/christian_apparel": "Clothing brand",
  "physical_product/religion_and_faith/jewish_apparel": "Clothing brand",
  "physical_product/religion_and_faith/islamic_apparel": "Clothing brand",
  "physical_product/religion_and_faith/christian_jewelry": "Jewelry",
  "brick_and_mortar/retail/boutique_store": "Clothing boutique",
  "brick_and_mortar/retail/clothing_store": "Clothing store",
  "brick_and_mortar/retail/jewelry_store": "Jewelry shop",
  "brick_and_mortar/beauty_and_wellness/hair_salon": "Hair salon",
  "brick_and_mortar/beauty_and_wellness/nail_salon": "Nail salon",
  "services/personal_services/personal_styling": "Fashion",
  // This app (rental and real-estate clients): closer labels than the
  // group's "Hospitality" / "Professional services".
  "brick_and_mortar/hospitality_and_lodging/vacation_rental_property": "Vacation rentals",
  "brick_and_mortar/hospitality_and_lodging/cabin_rental": "Vacation rentals",
  "brick_and_mortar/hospitality_and_lodging/hotel": "Hotel",
  "brick_and_mortar/hospitality_and_lodging/boutique_hotel": "Hotel",
  "brick_and_mortar/hospitality_and_lodging/bed_and_breakfast": "Bed and breakfast",
  "brick_and_mortar/hospitality_and_lodging/campground_rv": "Campground",
  "brick_and_mortar/professional_services_storefront/storage_facility": "Self storage",
  "services/professional_services/property_management": "Property management",
  "services/professional_services/real_estate_services": "Real estate services",
  // The app's own activity choices (LLC_ACTIVITY_CHOICES in shared/llc.ts).
  // NAICS 541618 (owner, 2026-10-29): doola's only 541618 label is "Sports management consulting" and it takes labels, never codes, so this files under the 54161 parent; change this line if doola adds a general 541618 label.
  "services/consulting/other_management_consulting_services": "Business consulting",
};

/**
 * The provider industry for a taxonomy choice or one of the app's own
 * activity choices, or undefined when the choice is not one the wizard offers
 * or its label is not on the reference list (the filing step then holds the
 * order).
 */
export function industryForActivity(activity: {
  businessType: string | null;
  industryGroup: string | null;
  industryType: string | null;
}): string | undefined {
  if (
    !isValidWhopTaxonomySelection(activity.businessType ?? "", activity.industryGroup ?? "", activity.industryType ?? "") &&
    !findLlcActivityChoice(activity)
  ) {
    return undefined;
  }
  const group = `${activity.businessType}/${activity.industryGroup}`;
  const label = CHOICE_INDUSTRY[`${group}/${activity.industryType ?? ""}`] ?? GROUP_INDUSTRY[group];
  return label && DOOLA_VALID_INDUSTRIES.has(label) ? label : undefined;
}
