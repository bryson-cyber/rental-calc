import { describe, it, expect, beforeAll } from "vitest";
import { listProfiles, createProfile, createSession, stopSession } from "./browser-use";

describe("Market Research - Browser Use Integration", () => {
  // Test that we can list profiles
  it("should list existing profiles", async () => {
    const profiles = await listProfiles();
    expect(Array.isArray(profiles)).toBe(true);
    console.log(`Found ${profiles.length} existing profiles`);
  }, 30000);

  // Test profile creation (only if we don't have the profile yet)
  it("should create or find CoachInayah profile", async () => {
    const profiles = await listProfiles();
    let profile = profiles.find(p => p.name === 'CoachInayah-MarketCharts-Test');
    
    if (!profile) {
      // Create new profile for testing
      profile = await createProfile('CoachInayah-MarketCharts-Test');
      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('CoachInayah-MarketCharts-Test');
      console.log(`Created new profile: ${profile.id}`);
    } else {
      console.log(`Found existing profile: ${profile.id}`);
      expect(profile.id).toBeDefined();
    }
  }, 30000);

  // Test session creation
  it("should create a session with profile", async () => {
    // First get or create profile
    const profiles = await listProfiles();
    let profile = profiles.find(p => p.name === 'CoachInayah-MarketCharts-Test');
    
    if (!profile) {
      profile = await createProfile('CoachInayah-MarketCharts-Test');
    }

    // Create session
    const session = await createSession({
      profileId: profile.id,
      startUrl: 'https://example.com', // Use example.com for testing
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');
    console.log(`Created session: ${session.id}`);
    console.log(`Live URL: ${session.liveUrl}`);

    // Clean up - stop the session
    await stopSession(session.id);
    console.log('Session stopped');
  }, 60000);
});
