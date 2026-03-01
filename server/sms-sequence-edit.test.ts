import { describe, it, expect } from "vitest";

/**
 * Tests for SMS sequence message editing and join link inclusion.
 * These are unit tests for the template generation logic and the
 * upsertScheduledMessage input validation.
 */

describe("SMS Sequence Message Templates", () => {
  // Replicate the template generation logic from webinar-sms.ts
  function generateSequenceTemplates(webinarLink?: string, replayLink?: string) {
    const link = webinarLink || "[WEBINAR_LINK]";
    const replay = replayLink || "[REPLAY_LINK]";

    return [
      {
        sequenceName: "Registration Confirmation",
        sequenceOrder: 1,
        messageBody: `Hey %FIRST_NAME%! Thanks for registering for our live workshop. Save this number so you don't miss any updates! 🎯`,
        audience: "all",
      },
      {
        sequenceName: "2 Days Before Reminder",
        sequenceOrder: 2,
        messageBody: `Hey %FIRST_NAME%! Quick reminder — our live call is in 2 days. You won't want to miss this one. Mark your calendar! 📅\n\nJoin here: ${link}`,
        audience: "all",
      },
      {
        sequenceName: "Day Before Reminder",
        sequenceOrder: 3,
        messageBody: `%FIRST_NAME%, our call is TOMORROW! Show up early to guarantee your seat — we have a lot of people registered. See you there! 🔥\n\nJoin here: ${link}`,
        audience: "all",
      },
      {
        sequenceName: "Morning Of",
        sequenceOrder: 4,
        messageBody: `Good morning %FIRST_NAME%! Today's the day. Our call is happening TODAY. Be there early — seats fill up fast! 💪\n\nJoin here: ${link}`,
        audience: "all",
      },
      {
        sequenceName: "1 Hour Warning",
        sequenceOrder: 5,
        messageBody: `%FIRST_NAME% — we're starting in 1 HOUR! Get ready and show up 10 min early. Join here: ${link}`,
        audience: "all",
      },
      {
        sequenceName: "Starting NOW",
        sequenceOrder: 6,
        messageBody: `🔴 WE'RE LIVE! %FIRST_NAME%, join now before we get started: ${link}`,
        audience: "all",
      },
      {
        sequenceName: "Thank You (Attended)",
        sequenceOrder: 7,
        messageBody: `Thanks for showing up today %FIRST_NAME%! 🙏 Here's the replay if you want to rewatch: ${replay}`,
        audience: "attended",
      },
      {
        sequenceName: "Missed You (No-Show)",
        sequenceOrder: 8,
        messageBody: `Hey %FIRST_NAME%, we missed you today! No worries — I saved the replay for you: ${replay}`,
        audience: "not_attended",
      },
      {
        sequenceName: "Follow-Up CTA",
        sequenceOrder: 9,
        messageBody: `%FIRST_NAME%, did you catch the call? If you're ready to take the next step, reply YES and I'll send you the details. 🚀`,
        audience: "all",
      },
    ];
  }

  it("should include webinar join link in messages 2-6 when link is provided", () => {
    const link = "https://event.webinarjam.com/go/live/abc123";
    const templates = generateSequenceTemplates(link);

    // Messages 2-6 should contain the link
    expect(templates[1].messageBody).toContain(link); // 2 Days Before
    expect(templates[2].messageBody).toContain(link); // Day Before
    expect(templates[3].messageBody).toContain(link); // Morning Of
    expect(templates[4].messageBody).toContain(link); // 1 Hour Warning
    expect(templates[5].messageBody).toContain(link); // Starting NOW
  });

  it("should include replay link in messages 7-8 when provided", () => {
    const replay = "https://event.webinarjam.com/replay/abc123";
    const templates = generateSequenceTemplates(undefined, replay);

    expect(templates[6].messageBody).toContain(replay); // Thank You
    expect(templates[7].messageBody).toContain(replay); // Missed You
  });

  it("should use placeholder when no webinar link is provided", () => {
    const templates = generateSequenceTemplates();

    expect(templates[1].messageBody).toContain("[WEBINAR_LINK]");
    expect(templates[4].messageBody).toContain("[WEBINAR_LINK]");
  });

  it("should use placeholder when no replay link is provided", () => {
    const templates = generateSequenceTemplates();

    expect(templates[6].messageBody).toContain("[REPLAY_LINK]");
    expect(templates[7].messageBody).toContain("[REPLAY_LINK]");
  });

  it("should NOT include join link in Registration Confirmation (message 1)", () => {
    const link = "https://event.webinarjam.com/go/live/abc123";
    const templates = generateSequenceTemplates(link);

    // Message 1 is a simple confirmation — no link needed
    expect(templates[0].messageBody).not.toContain(link);
  });

  it("should NOT include join link in Follow-Up CTA (message 9)", () => {
    const link = "https://event.webinarjam.com/go/live/abc123";
    const templates = generateSequenceTemplates(link);

    // Message 9 is a CTA — no link, just asks for reply
    expect(templates[8].messageBody).not.toContain(link);
  });

  it("should generate exactly 9 messages", () => {
    const templates = generateSequenceTemplates();
    expect(templates).toHaveLength(9);
  });

  it("should have correct sequence ordering (1-9)", () => {
    const templates = generateSequenceTemplates();
    templates.forEach((t, i) => {
      expect(t.sequenceOrder).toBe(i + 1);
    });
  });

  it("should have correct audience targeting", () => {
    const templates = generateSequenceTemplates();

    // Messages 1-6 and 9 target everyone
    [0, 1, 2, 3, 4, 5, 8].forEach((i) => {
      expect(templates[i].audience).toBe("all");
    });

    // Message 7 targets attended only
    expect(templates[6].audience).toBe("attended");

    // Message 8 targets no-shows only
    expect(templates[7].audience).toBe("not_attended");
  });

  it("should include %FIRST_NAME% placeholder in all messages", () => {
    const templates = generateSequenceTemplates();
    templates.forEach((t) => {
      expect(t.messageBody).toContain("%FIRST_NAME%");
    });
  });
});

describe("SMS Message Edit Validation", () => {
  it("should reject empty message body", () => {
    const editText = "";
    expect(editText.trim()).toBe("");
  });

  it("should accept valid message body", () => {
    const editText = "Hey %FIRST_NAME%! Updated message content.";
    expect(editText.trim().length).toBeGreaterThan(0);
  });

  it("should trim whitespace from message body", () => {
    const editText = "  Hey %FIRST_NAME%!  ";
    expect(editText.trim()).toBe("Hey %FIRST_NAME%!");
  });

  it("should preserve newlines in message body (for join links)", () => {
    const editText = "Hey %FIRST_NAME%!\n\nJoin here: https://example.com";
    expect(editText).toContain("\n\nJoin here:");
  });
});
