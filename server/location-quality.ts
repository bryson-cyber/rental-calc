/**
 * Location Quality Service
 * 
 * Uses Google Places API to calculate location quality metrics:
 * - Walk Score (restaurants, cafes, shops within walking distance)
 * - Transit Score (public transit stops nearby)
 * - Attraction Score (tourist spots, entertainment, landmarks)
 * - Neighborhood Amenities (parks, gyms, grocery stores)
 */

import { makeRequest, PlacesSearchResult } from './_core/map';

// Place types for different scores
const WALK_SCORE_TYPES = ['restaurant', 'cafe', 'bar', 'grocery_or_supermarket', 'convenience_store', 'pharmacy', 'bank'];
const TRANSIT_TYPES = ['transit_station', 'subway_station', 'bus_station', 'train_station', 'light_rail_station'];
const ATTRACTION_TYPES = ['tourist_attraction', 'museum', 'art_gallery', 'amusement_park', 'aquarium', 'zoo', 'stadium', 'night_club'];
const AMENITY_TYPES = ['park', 'gym', 'shopping_mall', 'movie_theater', 'spa', 'laundry', 'hospital'];

export interface LocationQualityResult {
  walkScore: {
    score: number; // 0-100
    grade: string; // A+, A, B+, B, C+, C, D, F
    label: string; // "Walker's Paradise", "Very Walkable", etc.
    nearbyPlaces: number;
    highlights: string[];
  };
  transitScore: {
    score: number;
    grade: string;
    label: string;
    nearbyStops: number;
    highlights: string[];
  };
  attractionScore: {
    score: number;
    grade: string;
    label: string;
    nearbyAttractions: number;
    highlights: string[];
  };
  amenityScore: {
    score: number;
    grade: string;
    label: string;
    nearbyAmenities: number;
    highlights: string[];
  };
  overallScore: number;
  overallGrade: string;
  overallLabel: string;
  guestAppeal: string; // Plain English summary of why guests would want to stay here
}

interface PlaceResult {
  name: string;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

function getGradeFromScore(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}

function getWalkScoreLabel(score: number): string {
  if (score >= 90) return "Walker's Paradise";
  if (score >= 70) return "Very Walkable";
  if (score >= 50) return "Somewhat Walkable";
  if (score >= 25) return "Car-Dependent";
  return "Almost All Errands Require a Car";
}

function getTransitScoreLabel(score: number): string {
  if (score >= 90) return "Excellent Transit";
  if (score >= 70) return "Great Transit";
  if (score >= 50) return "Good Transit";
  if (score >= 25) return "Some Transit";
  return "Minimal Transit";
}

function getAttractionScoreLabel(score: number): string {
  if (score >= 90) return "Tourist Hotspot";
  if (score >= 70) return "Lots to See & Do";
  if (score >= 50) return "Some Attractions Nearby";
  if (score >= 25) return "Few Attractions";
  return "Off the Beaten Path";
}

function getAmenityScoreLabel(score: number): string {
  if (score >= 90) return "Everything You Need";
  if (score >= 70) return "Well-Equipped Area";
  if (score >= 50) return "Basic Amenities";
  if (score >= 25) return "Limited Amenities";
  return "Remote Location";
}

function getOverallLabel(score: number): string {
  if (score >= 90) return "Prime Location";
  if (score >= 75) return "Great Location";
  if (score >= 60) return "Good Location";
  if (score >= 45) return "Average Location";
  if (score >= 30) return "Below Average Location";
  return "Challenging Location";
}

async function searchNearbyPlaces(
  lat: number,
  lng: number,
  types: string[],
  radiusMeters: number = 1609 // 1 mile
): Promise<PlaceResult[]> {
  const allResults: PlaceResult[] = [];
  
  // Search for each type (Google only allows one type per request)
  for (const type of types) {
    try {
      const result = await makeRequest<PlacesSearchResult>(
        '/maps/api/place/nearbysearch/json',
        {
          location: `${lat},${lng}`,
          radius: radiusMeters,
          type: type
        }
      );
      
      if (result.status === 'OK' && result.results) {
        allResults.push(...result.results.map(r => ({
          name: r.name,
          rating: r.rating,
          user_ratings_total: r.user_ratings_total,
          types: r.types,
          geometry: r.geometry
        })));
      }
    } catch (error) {
      console.error(`Error searching for ${type}:`, error);
    }
  }
  
  // Remove duplicates by place name
  const uniqueResults = allResults.filter((place, index, self) =>
    index === self.findIndex(p => p.name === place.name)
  );
  
  return uniqueResults;
}

function calculateScoreFromPlaces(places: PlaceResult[], maxPlaces: number = 20): number {
  // Base score from count (up to 70 points)
  const countScore = Math.min(places.length / maxPlaces, 1) * 70;
  
  // Bonus for highly-rated places (up to 30 points)
  const ratedPlaces = places.filter(p => p.rating && p.rating >= 4.0);
  const ratingBonus = Math.min(ratedPlaces.length / 10, 1) * 30;
  
  return Math.round(countScore + ratingBonus);
}

function getHighlights(places: PlaceResult[], maxHighlights: number = 3): string[] {
  // Sort by rating and review count to get the best places
  const sortedPlaces = places
    .filter(p => p.rating && p.user_ratings_total)
    .sort((a, b) => {
      const scoreA = (a.rating || 0) * Math.log10((a.user_ratings_total || 1) + 1);
      const scoreB = (b.rating || 0) * Math.log10((b.user_ratings_total || 1) + 1);
      return scoreB - scoreA;
    });
  
  return sortedPlaces.slice(0, maxHighlights).map(p => p.name);
}

function generateGuestAppeal(result: Omit<LocationQualityResult, 'guestAppeal'>): string {
  const appeals: string[] = [];
  
  if (result.walkScore.score >= 70) {
    appeals.push("Guests can walk to restaurants, cafes, and shops");
  }
  
  if (result.transitScore.score >= 60) {
    appeals.push("Easy access to public transportation");
  }
  
  if (result.attractionScore.score >= 50) {
    appeals.push("Close to popular attractions and entertainment");
  }
  
  if (result.amenityScore.score >= 60) {
    appeals.push("All essential amenities within reach");
  }
  
  if (appeals.length === 0) {
    if (result.overallScore >= 50) {
      return "This location offers a balanced mix of convenience and accessibility for guests.";
    } else {
      return "This location may appeal to guests seeking a quieter, more secluded stay away from busy areas.";
    }
  }
  
  if (appeals.length === 1) {
    return appeals[0] + ".";
  }
  
  if (appeals.length === 2) {
    return appeals.join(" and ") + ".";
  }
  
  return appeals.slice(0, -1).join(", ") + ", and " + appeals[appeals.length - 1] + ".";
}

export async function getLocationQuality(lat: number, lng: number): Promise<LocationQualityResult> {
  console.log(`[LocationQuality] Getting quality metrics for ${lat}, ${lng}`);
  
  // Run all searches in parallel for speed
  const [walkPlaces, transitPlaces, attractionPlaces, amenityPlaces] = await Promise.all([
    searchNearbyPlaces(lat, lng, WALK_SCORE_TYPES, 805), // 0.5 mile for walk score
    searchNearbyPlaces(lat, lng, TRANSIT_TYPES, 1609), // 1 mile for transit
    searchNearbyPlaces(lat, lng, ATTRACTION_TYPES, 3219), // 2 miles for attractions
    searchNearbyPlaces(lat, lng, AMENITY_TYPES, 1609) // 1 mile for amenities
  ]);
  
  // Calculate scores
  const walkScore = calculateScoreFromPlaces(walkPlaces, 15);
  const transitScore = calculateScoreFromPlaces(transitPlaces, 5);
  const attractionScore = calculateScoreFromPlaces(attractionPlaces, 10);
  const amenityScore = calculateScoreFromPlaces(amenityPlaces, 10);
  
  // Overall score is weighted average
  const overallScore = Math.round(
    walkScore * 0.35 +
    transitScore * 0.15 +
    attractionScore * 0.25 +
    amenityScore * 0.25
  );
  
  const result: Omit<LocationQualityResult, 'guestAppeal'> = {
    walkScore: {
      score: walkScore,
      grade: getGradeFromScore(walkScore),
      label: getWalkScoreLabel(walkScore),
      nearbyPlaces: walkPlaces.length,
      highlights: getHighlights(walkPlaces)
    },
    transitScore: {
      score: transitScore,
      grade: getGradeFromScore(transitScore),
      label: getTransitScoreLabel(transitScore),
      nearbyStops: transitPlaces.length,
      highlights: getHighlights(transitPlaces)
    },
    attractionScore: {
      score: attractionScore,
      grade: getGradeFromScore(attractionScore),
      label: getAttractionScoreLabel(attractionScore),
      nearbyAttractions: attractionPlaces.length,
      highlights: getHighlights(attractionPlaces)
    },
    amenityScore: {
      score: amenityScore,
      grade: getGradeFromScore(amenityScore),
      label: getAmenityScoreLabel(amenityScore),
      nearbyAmenities: amenityPlaces.length,
      highlights: getHighlights(amenityPlaces)
    },
    overallScore,
    overallGrade: getGradeFromScore(overallScore),
    overallLabel: getOverallLabel(overallScore)
  };
  
  return {
    ...result,
    guestAppeal: generateGuestAppeal(result)
  };
}
