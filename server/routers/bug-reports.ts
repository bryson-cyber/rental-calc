import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bugReports } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// #bug-triage channel ID
const BUG_TRIAGE_CHANNEL_ID = "C0AFD8WV2KB";

// Known file mapping for the codebase
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
- server/routers/ — Backend API routers
- server/airdna-*.ts — AirDNA API integration
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
    console.error("[BugReport] Error posting to Slack:", error?.message);
    return { success: false, error: error?.message || "Failed to post to Slack" };
  }
}

/**
 * AI Triage: analyze the bug and generate a Manus-ready prompt
 */
async function triageBugReport(input: {
  title: string;
  description?: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  toolName?: string;
  pagePath?: string;
  errorMessage?: string;
}): Promise<{
  likelyFiles: string[];
  diagnosis: string;
  suggestedApproach: string;
  manusPrompt: string;
  severity: string;
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
2. Provide a brief technical diagnosis
3. Suggest a fix approach (1-3 sentences)
4. Generate a copy-paste-ready Manus prompt
5. Assess severity (low/medium/high/critical)

Return JSON.`,
        },
        {
          role: 'user',
          content: `Triage this bug:

**Title:** ${input.title}
**Description:** ${input.description || 'Not provided'}
**Steps to Reproduce:** ${input.stepsToReproduce || 'Not provided'}
**Expected:** ${input.expectedBehavior || 'Not provided'}
**Actual:** ${input.actualBehavior || 'Not provided'}
**Page/Tool:** ${input.toolName || input.pagePath || 'unknown'}
**Error Message:** ${input.errorMessage || 'None'}`,
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
              likelyFiles: { type: 'array', items: { type: 'string' }, description: 'Likely affected file paths (2-5 files)' },
              diagnosis: { type: 'string', description: 'Brief technical diagnosis' },
              suggestedApproach: { type: 'string', description: 'Suggested fix approach' },
              manusPrompt: { type: 'string', description: 'Copy-paste-ready Manus prompt' },
              severity: { type: 'string', description: 'Bug severity: low, medium, high, or critical' },
            },
            required: ['likelyFiles', 'diagnosis', 'suggestedApproach', 'manusPrompt', 'severity'],
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
        manusPrompt: `Fix this bug in the rental-calculator project: ${input.title}. ${input.description || ''}`,
        severity: 'medium',
      };
    }

    return triage;
  } catch (error) {
    console.error('[BugReport] AI triage error:', error);
    return {
      likelyFiles: [],
      diagnosis: 'AI triage failed.',
      suggestedApproach: 'Manual investigation needed.',
      manusPrompt: `Fix this bug in the rental-calculator project: ${input.title}. ${input.description || ''}`,
      severity: 'medium',
    };
  }
}

/**
 * Build Slack message for a text bug report
 */
function buildSlackMessage(
  input: {
    title: string;
    description?: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    toolName?: string;
    pagePath?: string;
    errorMessage?: string;
    browserInfo?: string;
    screenSize?: string;
  },
  triage: {
    likelyFiles: string[];
    diagnosis: string;
    suggestedApproach: string;
    manusPrompt: string;
    severity: string;
  },
  shareCode: string
): string {
  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  const emoji = severityEmoji[triage.severity] || '🟡';

  const lines: string[] = [
    `${emoji} **Bug Report: ${input.title}**`,
    `*Severity:* ${triage.severity.toUpperCase()} | *Feature:* ${input.toolName || 'General'}`,
    '',
  ];

  if (input.description) {
    lines.push(`**Description:** ${input.description}`);
    lines.push('');
  }

  if (input.stepsToReproduce) {
    lines.push(`**Steps to Reproduce:**`);
    lines.push(input.stepsToReproduce);
    lines.push('');
  }

  if (input.expectedBehavior) lines.push(`**Expected:** ${input.expectedBehavior}`);
  if (input.actualBehavior) lines.push(`**Actual:** ${input.actualBehavior}`);
  if (input.errorMessage) lines.push(`**Error:** ${input.errorMessage}`);
  lines.push('');

  // Context
  lines.push('---');
  lines.push('**Context:**');
  if (input.toolName) lines.push(`- Page/Tool: ${input.toolName}`);
  if (input.pagePath) lines.push(`- Path: ${input.pagePath}`);
  if (input.screenSize) lines.push(`- Screen: ${input.screenSize}`);
  if (input.browserInfo) lines.push(`- Browser: ${input.browserInfo}`);
  lines.push(`- Report: ${shareCode}`);
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

  // Manus Prompt
  lines.push('---');
  lines.push('**Copy-Paste Manus Prompt:**');
  lines.push('```');
  lines.push(triage.manusPrompt);
  lines.push('```');

  return lines.join('\n');
}

export const bugReportsRouter = router({
    // Create a new bug report — now with Slack integration
    create: publicProcedure
      .input(z.object({
        title: z.string().min(5, 'Title must be at least 5 characters'),
        description: z.string().optional(),
        stepsToReproduce: z.string().optional(),
        expectedBehavior: z.string().optional(),
        actualBehavior: z.string().optional(),
        toolName: z.string().optional(),
        pagePath: z.string().optional(),
        propertyAddress: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        marketId: z.string().optional(),
        browserInfo: z.string().optional(),
        screenSize: z.string().optional(),
        errorMessage: z.string().optional(),
        consoleErrors: z.string().optional(),
        screenshotUrl: z.string().optional(),
        reporterEmail: z.string().email().optional(),
        reporterName: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Generate unique share code
          const shareCode = `BUG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          
          const result = await db.insert(bugReports).values({
            shareCode,
            title: input.title,
            description: input.description,
            stepsToReproduce: input.stepsToReproduce,
            expectedBehavior: input.expectedBehavior,
            actualBehavior: input.actualBehavior,
            toolName: input.toolName,
            pagePath: input.pagePath,
            propertyAddress: input.propertyAddress,
            city: input.city,
            state: input.state,
            marketId: input.marketId,
            browserInfo: input.browserInfo,
            screenSize: input.screenSize,
            errorMessage: input.errorMessage,
            consoleErrors: input.consoleErrors,
            screenshotUrl: input.screenshotUrl,
            reporterEmail: input.reporterEmail,
            reporterName: input.reporterName,
            sessionId: input.sessionId,
            userId: ctx.user?.id,
          });
          
          console.log('[BugReport] New report created:', shareCode, input.title);
          
          // ============================================
          // ASYNC: AI Triage + Slack notification
          // (don't block the response — fire and forget)
          // ============================================
          (async () => {
            try {
              console.log('[BugReport] Running AI triage for:', input.title);
              const triage = await triageBugReport(input);
              console.log('[BugReport] Triage complete. Files:', triage.likelyFiles);
              
              const slackMessage = buildSlackMessage(input, triage, shareCode);
              const slackResult = await postToSlack(BUG_TRIAGE_CHANNEL_ID, slackMessage);
              
              if (slackResult.success) {
                console.log('[BugReport] Posted to #bug-triage:', slackResult.permalink);
              } else {
                console.error('[BugReport] Failed to post to Slack:', slackResult.error);
                // Fallback: use notifyOwner
                await notifyOwner({
                  title: `🐛 Bug Report: ${input.title}`,
                  content: `Feature: ${input.toolName || 'General'}\n\nSlack post failed: ${slackResult.error}\n\nManus Prompt:\n${triage.manusPrompt}`,
                });
              }
            } catch (triageErr) {
              console.error('[BugReport] Triage pipeline error:', triageErr);
              try {
                await notifyOwner({
                  title: `🐛 Bug Report: ${input.title}`,
                  content: `${input.description || ''}\nFeature: ${input.toolName || 'General'}`,
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
          console.error('[BugReport] Error creating report:', error);
          return {
            success: false,
            error: 'Failed to create bug report',
          };
        }
      }),
    
    // Get bug report by share code (public)
    getByShareCode: publicProcedure
      .input(z.object({
        shareCode: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const result = await db.select().from(bugReports).where(eq(bugReports.shareCode, input.shareCode)).limit(1);
        
        if (result.length === 0) {
          return null;
        }
        
        return result[0];
      }),
    
    // List all bug reports (admin only)
    list: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        status: z.enum(['new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const results = await db.select().from(bugReports).orderBy(desc(bugReports.createdAt)).limit(input.limit).offset(input.offset);
        return results;
      }),
    
    // Update bug report status (admin only)
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate']),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        resolution: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const updateData: Record<string, unknown> = {
          status: input.status,
        };
        
        if (input.priority) {
          updateData.priority = input.priority;
        }
        
        if (input.resolution) {
          updateData.resolution = input.resolution;
        }
        
        if (input.status === 'resolved') {
          updateData.resolvedAt = new Date();
        }
        
        await db.update(bugReports).set(updateData).where(eq(bugReports.id, input.id));
        
        return { success: true };
      }),
});
