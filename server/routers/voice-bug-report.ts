/**
 * Voice Bug Report Router
 * 
 * Full pipeline:
 * 1. Upload audio to S3
 * 2. Transcribe via Whisper
 * 3. AI-parse into structured bug report
 * 4. Save to database
 * 5. AI-triage: identify affected components, severity, fix approach
 * 6. Post rich Slack message to #bug-triage with copy-paste-ready Manus prompt
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { bugReports } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

// #bug-triage channel ID
const BUG_TRIAGE_CHANNEL_ID = "C0AFD8WV2KB";

// Known file mapping for the codebase — helps AI triage identify affected files
const CODEBASE_MAP = `
Key files in the Coach Inayah Turnkey Tool codebase:
- client/src/pages/LeadMagnet.tsx — Main calculator page with 9 steps (tabs)
- client/src/components/RegulationTrackerStep.tsx — Step 1: Check Regulations
- client/src/components/OpportunityFinderStep.tsx — Step 2: Find a Property
- client/src/components/RevenueEstimatorStep.tsx — Step 3: See Real Revenue
- client/src/components/MarketComparisonStep.tsx — Step 4: Explore Competitors
- client/src/components/DealValidatorStep.tsx — Step 5: Validate the Deal
- client/src/components/ComparisonDashboard.tsx — Step 6: Compare Favorites
- client/src/components/MapViewContent.tsx — Step 7: See the Map
- client/src/components/StandaloneMarketAdvisor.tsx — Step 8: Market Advisor
- client/src/components/AIAdvisorStep.tsx — Step 9: AI Advisor
- client/src/pages/DealAlertsPage.tsx — Deal alerts management and matches
- client/src/components/shared-report/ — Report generation components
- server/sop-reports.ts — Server-side report generation (SOP reports)
- server/routers/batch-validate.ts — Batch property analysis
- server/routers/deal-alerts.ts — Deal alert CRUD and scanning
- server/deal-alert-agent.ts — Deal alert scanning agent
- server/newsletter-deal-finder.ts — Property analysis for arbitrage
- server/airdna-*.ts — AirDNA API integration (market data, comps, revenue)
- server/routers/regulations.ts — Regulations lookup
- server/routers/revenue-estimate.ts — Revenue estimation
- server/slack-admin-router.ts — Slack integration for report delivery
- drizzle/schema.ts — Database schema
- client/src/App.tsx — Routing and navigation
`;

/**
 * Post a message to Slack via MCP CLI
 */
async function postToSlack(channelId: string, message: string): Promise<{ success: boolean; permalink?: string; error?: string }> {
  const { execSync } = await import("child_process");
  
  try {
    const inputObj = {
      channel_id: channelId,
      message,
    };
    
    const cmd = `manus-mcp-cli tool call slack_send_message --server slack --input '${JSON.stringify(inputObj).replace(/'/g, "'\\''")}'`;
    const output = execSync(cmd, { 
      encoding: "utf-8", 
      timeout: 30000,
      cwd: "/home/ubuntu/rental-calculator"
    });
    
    if (output.includes("error") && output.includes("not_in_channel")) {
      return { success: false, error: "Bot is not in #bug-triage channel. Please invite the bot first." };
    }
    
    const permalinkMatch = output.match(/https:\/\/coachinayah\.slack\.com\/archives\/[^\s)]+/);
    
    return { 
      success: true, 
      permalink: permalinkMatch?.[0] 
    };
  } catch (error: any) {
    console.error("[BugTriage] Error posting to Slack:", error?.message);
    return { success: false, error: error?.message || "Failed to post to Slack" };
  }
}

/**
 * AI Triage: analyze the bug and generate a Manus-ready prompt
 */
async function triageBug(parsed: {
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  severity: string;
  affectedFeature: string;
}, context: {
  toolName?: string;
  pagePath?: string;
  navTrail?: string;
  transcript?: string;
}): Promise<{
  likelyFiles: string[];
  diagnosis: string;
  suggestedApproach: string;
  manusPrompt: string;
}> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a senior developer triaging bugs for the Coach Inayah Turnkey Tool — a rental property analysis web app built with React + tRPC + Express + Drizzle ORM.

${CODEBASE_MAP}

Given a bug report, you must:
1. Identify the most likely affected files (2-5 files)
2. Provide a brief technical diagnosis (what's probably wrong)
3. Suggest a fix approach (1-3 sentences)
4. Generate a copy-paste-ready Manus prompt that a developer can paste directly into Manus chat to get the bug fixed immediately

The Manus prompt should be specific, actionable, and include the bug details + affected files + what needs to change. Write it as if you're instructing an AI coding assistant.

Return JSON.`,
        },
        {
          role: 'user',
          content: `Triage this bug:

**Title:** ${parsed.title}
**Description:** ${parsed.description}
**Steps to Reproduce:** ${parsed.stepsToReproduce}
**Expected:** ${parsed.expectedBehavior}
**Actual:** ${parsed.actualBehavior}
**Severity:** ${parsed.severity}
**Feature:** ${parsed.affectedFeature}
**Page:** ${context.pagePath || 'unknown'}
**Tool/Tab:** ${context.toolName || 'unknown'}
${context.navTrail ? `**Navigation Trail:**\n${context.navTrail}` : ''}
${context.transcript ? `**Voice Transcript:** "${context.transcript}"` : ''}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'bug_triage',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              likelyFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of likely affected file paths (2-5 files)',
              },
              diagnosis: {
                type: 'string',
                description: 'Brief technical diagnosis of what is probably wrong (2-3 sentences)',
              },
              suggestedApproach: {
                type: 'string',
                description: 'Suggested fix approach (1-3 sentences)',
              },
              manusPrompt: {
                type: 'string',
                description: 'A complete, copy-paste-ready prompt for Manus chat to fix this bug. Should be specific and actionable, referencing exact files and what needs to change.',
              },
            },
            required: ['likelyFiles', 'diagnosis', 'suggestedApproach', 'manusPrompt'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    const triage = typeof content === 'string' ? JSON.parse(content) : null;

    if (!triage) {
      return {
        likelyFiles: [],
        diagnosis: 'Could not auto-diagnose.',
        suggestedApproach: 'Manual investigation needed.',
        manusPrompt: `Fix this bug in the rental-calculator project: ${parsed.title}. ${parsed.description}`,
      };
    }

    return triage;
  } catch (error) {
    console.error('[BugTriage] AI triage error:', error);
    return {
      likelyFiles: [],
      diagnosis: 'AI triage failed.',
      suggestedApproach: 'Manual investigation needed.',
      manusPrompt: `Fix this bug in the rental-calculator project: ${parsed.title}. ${parsed.description}`,
    };
  }
}

/**
 * Build the rich Slack message with triage results and Manus prompt
 */
function buildSlackMessage(
  parsed: {
    title: string;
    description: string;
    stepsToReproduce: string;
    expectedBehavior: string;
    actualBehavior: string;
    severity: string;
    affectedFeature: string;
  },
  triage: {
    likelyFiles: string[];
    diagnosis: string;
    suggestedApproach: string;
    manusPrompt: string;
  },
  context: {
    shareCode: string;
    audioUrl?: string;
    transcript?: string;
    pagePath?: string;
    toolName?: string;
    screenSize?: string;
  }
): string {
  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  const emoji = severityEmoji[parsed.severity] || '🟡';

  const lines: string[] = [
    `${emoji} **Bug Report: ${parsed.title}**`,
    `*Severity:* ${parsed.severity.toUpperCase()} | *Feature:* ${parsed.affectedFeature}`,
    '',
    `**Description:** ${parsed.description}`,
    '',
  ];

  if (parsed.stepsToReproduce) {
    lines.push(`**Steps to Reproduce:**`);
    lines.push(parsed.stepsToReproduce);
    lines.push('');
  }

  if (parsed.expectedBehavior) {
    lines.push(`**Expected:** ${parsed.expectedBehavior}`);
  }
  if (parsed.actualBehavior) {
    lines.push(`**Actual:** ${parsed.actualBehavior}`);
  }
  lines.push('');

  // Context
  lines.push('---');
  lines.push('**Context:**');
  if (context.toolName) lines.push(`- Page/Tool: ${context.toolName}`);
  if (context.pagePath) lines.push(`- Path: ${context.pagePath}`);
  if (context.screenSize) lines.push(`- Screen: ${context.screenSize}`);
  if (context.audioUrl) lines.push(`- Audio: ${context.audioUrl}`);
  lines.push('');

  // AI Triage
  lines.push('---');
  lines.push('**AI Triage:**');
  lines.push(`*Diagnosis:* ${triage.diagnosis}`);
  lines.push(`*Suggested Fix:* ${triage.suggestedApproach}`);
  if (triage.likelyFiles.length > 0) {
    lines.push(`*Likely Affected Files:*`);
    triage.likelyFiles.forEach(f => lines.push(`- \`${f}\``));
  }
  lines.push('');

  // Manus Prompt — the key feature
  lines.push('---');
  lines.push('**Copy-Paste Manus Prompt:**');
  lines.push('```');
  lines.push(triage.manusPrompt);
  lines.push('```');

  if (context.transcript) {
    lines.push('');
    lines.push(`*Voice Transcript:* "${context.transcript.substring(0, 300)}${context.transcript.length > 300 ? '...' : ''}"`);
  }

  return lines.join('\n');
}

// ============================================
// ROUTER
// ============================================

export const voiceBugReportRouter = router({
  // Upload audio to S3
  uploadAudio: publicProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default('audio/webm'),
      fileName: z.string().default('bug-report-audio.webm'),
    }))
    .mutation(async ({ input }) => {
      try {
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');
        
        if (audioBuffer.length > 16 * 1024 * 1024) {
          return { success: false, error: 'Audio file too large (max 16MB)' };
        }
        
        const fileKey = `voice-bug-reports/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webm`;
        const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);
        
        return { success: true, audioUrl: url };
      } catch (error) {
        console.error('[VoiceBugReport] Upload error:', error);
        return { success: false, error: 'Failed to upload audio' };
      }
    }),

  // Transcribe audio and parse into structured bug report
  transcribeAndParse: publicProcedure
    .input(z.object({
      audioUrl: z.string(),
      toolName: z.string().optional(),
      pagePath: z.string().optional(),
      propertyAddress: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        console.log('[VoiceBugReport] Transcribing audio...');
        const transcription = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: 'en',
          prompt: 'Transcribe this bug report about a web application. The speaker is describing a software bug or issue they encountered.',
        });
        
        if ('error' in transcription) {
          return { 
            success: false, 
            error: `Transcription failed: ${transcription.error}`,
            details: transcription.details,
          };
        }
        
        const transcript = transcription.text;
        console.log('[VoiceBugReport] Transcript:', transcript);
        
        const contextInfo = [
          input.toolName ? `Tool/Page: ${input.toolName}` : null,
          input.pagePath ? `Page Path: ${input.pagePath}` : null,
          input.propertyAddress ? `Property: ${input.propertyAddress}` : null,
          input.city && input.state ? `Location: ${input.city}, ${input.state}` : null,
        ].filter(Boolean).join('\n');
        
        const parseResult = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are a bug report parser. Given a voice transcript describing a software bug, extract structured information into a JSON format. Be concise but accurate. If the speaker doesn't mention something, leave it empty.

The application is a rental property analysis tool called "Coach Inayah Turnkey Tool" that helps users analyze short-term rental markets and properties.

${contextInfo ? `Current context:\n${contextInfo}` : ''}`,
            },
            {
              role: 'user',
              content: `Parse this voice bug report into structured fields:\n\n"${transcript}"`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'bug_report',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'A concise bug title (max 80 chars)' },
                  description: { type: 'string', description: 'Detailed description of the bug' },
                  stepsToReproduce: { type: 'string', description: 'Steps to reproduce the bug, numbered list' },
                  expectedBehavior: { type: 'string', description: 'What should happen' },
                  actualBehavior: { type: 'string', description: 'What actually happens' },
                  severity: { type: 'string', description: 'Bug severity: low, medium, high, or critical' },
                  affectedFeature: { type: 'string', description: 'Which feature/tool is affected' },
                },
                required: ['title', 'description', 'stepsToReproduce', 'expectedBehavior', 'actualBehavior', 'severity', 'affectedFeature'],
                additionalProperties: false,
              },
            },
          },
        });
        
        const parsedContent = parseResult.choices[0]?.message?.content;
        const parsed = typeof parsedContent === 'string' ? JSON.parse(parsedContent) : null;
        
        if (!parsed) {
          return { success: true, transcript, parsed: null, error: 'Could not parse transcript' };
        }
        
        return {
          success: true,
          transcript,
          parsed: {
            title: parsed.title || '',
            description: parsed.description || '',
            stepsToReproduce: parsed.stepsToReproduce || '',
            expectedBehavior: parsed.expectedBehavior || '',
            actualBehavior: parsed.actualBehavior || '',
            severity: parsed.severity || 'medium',
            affectedFeature: parsed.affectedFeature || input.toolName || '',
          },
        };
      } catch (error) {
        console.error('[VoiceBugReport] Parse error:', error);
        return { success: false, error: 'Failed to process voice bug report' };
      }
    }),

  // Submit: save to DB → AI triage → post to Slack with Manus prompt
  submit: publicProcedure
    .input(z.object({
      title: z.string().min(5),
      description: z.string().optional(),
      stepsToReproduce: z.string().optional(),
      expectedBehavior: z.string().optional(),
      actualBehavior: z.string().optional(),
      toolName: z.string().optional(),
      pagePath: z.string().optional(),
      propertyAddress: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      browserInfo: z.string().optional(),
      screenSize: z.string().optional(),
      errorMessage: z.string().optional(),
      audioUrl: z.string().optional(),
      transcript: z.string().optional(),
      severity: z.string().optional(),
      reporterEmail: z.string().optional(),
      reporterName: z.string().optional(),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const shareCode = `BUG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        // Build description with voice context
        let fullDescription = input.description || '';
        if (input.transcript) {
          fullDescription += `\n\n---\n**Voice Transcript:**\n${input.transcript}`;
        }
        if (input.audioUrl) {
          fullDescription += `\n\n**Audio Recording:** ${input.audioUrl}`;
        }
        
        // Save to database
        const result = await db.insert(bugReports).values({
          shareCode,
          title: input.title,
          description: fullDescription,
          stepsToReproduce: input.stepsToReproduce,
          expectedBehavior: input.expectedBehavior,
          actualBehavior: input.actualBehavior,
          toolName: input.toolName,
          pagePath: input.pagePath,
          propertyAddress: input.propertyAddress,
          city: input.city,
          state: input.state,
          browserInfo: input.browserInfo,
          screenSize: input.screenSize,
          errorMessage: input.errorMessage,
          reporterEmail: input.reporterEmail,
          reporterName: input.reporterName,
          sessionId: input.sessionId,
          userId: ctx.user?.id,
          priority: (input.severity as 'low' | 'medium' | 'high' | 'critical') || 'medium',
        });
        
        console.log('[VoiceBugReport] Report saved:', shareCode, input.title);
        
        // ============================================
        // ASYNC: AI Triage + Slack notification
        // (don't block the response — fire and forget)
        // ============================================
        const parsed = {
          title: input.title,
          description: input.description || '',
          stepsToReproduce: input.stepsToReproduce || '',
          expectedBehavior: input.expectedBehavior || '',
          actualBehavior: input.actualBehavior || '',
          severity: input.severity || 'medium',
          affectedFeature: input.toolName || '',
        };
        
        const triageContext = {
          toolName: input.toolName,
          pagePath: input.pagePath,
          navTrail: input.stepsToReproduce, // nav trail is embedded in steps
          transcript: input.transcript,
        };
        
        // Fire and forget — don't await
        (async () => {
          try {
            // Step 1: AI Triage
            console.log('[BugTriage] Running AI triage for:', input.title);
            const triage = await triageBug(parsed, triageContext);
            console.log('[BugTriage] Triage complete. Files:', triage.likelyFiles);
            
            // Step 2: Build and post Slack message
            const slackMessage = buildSlackMessage(parsed, triage, {
              shareCode,
              audioUrl: input.audioUrl,
              transcript: input.transcript,
              pagePath: input.pagePath,
              toolName: input.toolName,
              screenSize: input.screenSize,
            });
            
            const slackResult = await postToSlack(BUG_TRIAGE_CHANNEL_ID, slackMessage);
            
            if (slackResult.success) {
              console.log('[BugTriage] Posted to #bug-triage:', slackResult.permalink);
            } else {
              console.error('[BugTriage] Failed to post to Slack:', slackResult.error);
              // Fallback: use notifyOwner
              await notifyOwner({
                title: `🐛 Bug Report: ${input.title}`,
                content: `Severity: ${input.severity}\nFeature: ${input.toolName}\n\nSlack post failed: ${slackResult.error}\n\nManus Prompt:\n${triage.manusPrompt}`,
              });
            }
          } catch (triageErr) {
            console.error('[BugTriage] Triage pipeline error:', triageErr);
            // Fallback notification
            try {
              await notifyOwner({
                title: `🎙️ Voice Bug Report: ${input.title}`,
                content: `${input.description || ''}\nSeverity: ${input.severity}\nTranscript: ${input.transcript?.substring(0, 200) || 'N/A'}`,
              });
            } catch { /* ignore */ }
          }
        })();
        
        return {
          success: true,
          shareCode,
          bugId: result[0].insertId,
          shareUrl: `https://coachinayahturnkeytool.com/bug/${shareCode}`,
        };
      } catch (error) {
        console.error('[VoiceBugReport] Submit error:', error);
        return { success: false, error: 'Failed to create bug report' };
      }
    }),
});
