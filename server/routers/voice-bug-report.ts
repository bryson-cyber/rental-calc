/**
 * Voice Bug Report Router
 * 
 * Allows the developer to record a voice message describing a bug,
 * which gets transcribed and parsed into structured bug report fields
 * using AI. The report is then saved to the database and optionally
 * sent to Slack.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { bugReports } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

export const voiceBugReportRouter = router({
  // Upload audio and get a storage URL back
  uploadAudio: publicProcedure
    .input(z.object({
      audioBase64: z.string(), // base64 encoded audio data
      mimeType: z.string().default('audio/webm'),
      fileName: z.string().default('bug-report-audio.webm'),
    }))
    .mutation(async ({ input }) => {
      try {
        // Decode base64 to buffer
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');
        
        // Check size (16MB limit)
        const sizeMB = audioBuffer.length / (1024 * 1024);
        if (sizeMB > 16) {
          return { success: false, error: 'Audio file too large (max 16MB)' };
        }
        
        // Upload to S3
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
        // Step 1: Transcribe the audio
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
        
        // Step 2: Use AI to parse the transcript into structured fields
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
                  title: { 
                    type: 'string', 
                    description: 'A concise bug title (max 80 chars)' 
                  },
                  description: { 
                    type: 'string', 
                    description: 'Detailed description of the bug' 
                  },
                  stepsToReproduce: { 
                    type: 'string', 
                    description: 'Steps to reproduce the bug, numbered list' 
                  },
                  expectedBehavior: { 
                    type: 'string', 
                    description: 'What should happen' 
                  },
                  actualBehavior: { 
                    type: 'string', 
                    description: 'What actually happens' 
                  },
                  severity: {
                    type: 'string',
                    description: 'Bug severity: low, medium, high, or critical',
                  },
                  affectedFeature: {
                    type: 'string',
                    description: 'Which feature/tool is affected (e.g., "Deal Alerts", "Regulations Tracker", "Opportunity Finder")',
                  },
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
          return {
            success: true,
            transcript,
            parsed: null,
            error: 'Could not parse transcript into structured format',
          };
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
        return { 
          success: false, 
          error: 'Failed to process voice bug report',
        };
      }
    }),

  // Submit the final parsed bug report (after user review/edit)
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
        
        console.log('[VoiceBugReport] Report created:', shareCode, input.title);
        
        // Send notification to owner
        try {
          await notifyOwner({
            title: `🎙️ Voice Bug Report: ${input.title}`,
            content: [
              `**Bug:** ${input.title}`,
              input.description ? `**Description:** ${input.description}` : '',
              input.toolName ? `**Tool:** ${input.toolName}` : '',
              input.severity ? `**Severity:** ${input.severity}` : '',
              input.transcript ? `**Voice Transcript:** "${input.transcript.substring(0, 200)}${input.transcript.length > 200 ? '...' : ''}"` : '',
              `**Share Link:** https://coachinayahturnkeytool.com/bug/${shareCode}`,
            ].filter(Boolean).join('\n'),
          });
        } catch (notifyErr) {
          console.error('[VoiceBugReport] Failed to notify owner:', notifyErr);
        }
        
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
