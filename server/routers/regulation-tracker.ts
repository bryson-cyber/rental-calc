import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { savedRegulations, regulationComments, commentVotes, users, notifications, shareableRegulationReports } from "../../drizzle/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { getRegulationInfo, parseLocation } from "../regulation-tracker";
import { generateShareCode, sendSMSNotification, sendEmailNotification } from "../sms-email-notifications";

export const regulationTrackerRouter = router({
    // Parse location from various input formats (city, address, Redfin/Zillow URL)
    parseLocation: publicProcedure
      .input(z.object({
        input: z.string().min(1, "Location input is required"),
      }))
      .query(async ({ input }) => {
        const parsed = parseLocation(input.input);
        if (!parsed) {
          return {
            success: false,
            error: "Could not parse location. Please enter a city/state, address, or Redfin/Zillow URL.",
            data: null,
          };
        }
        return {
          success: true,
          data: parsed,
        };
      }),

    // Get regulations - supports city/state or raw input (address/URL)
    getRegulations: publicProcedure
      .input(z.object({
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
      }))
      .mutation(async ({ input }) => {
        console.log(`[RegulationTracker] Looking up regulations for ${input.city}, ${input.state}`);
        
        const result = await getRegulationInfo(input.city, input.state);
        
        // Debug log the sources being returned
        console.log(`[RegulationTracker] Returning ${result.sources.length} sources:`);
        result.sources.forEach((s, i) => {
          console.log(`  ${i + 1}. [${s.type}] ${s.title} - ${s.url}`);
        });
        
        return result;
      }),

    // Get regulations from raw input (address, URL, or city/state)
    getRegulationsFromInput: publicProcedure
      .input(z.object({
        input: z.string().min(1, "Location input is required"),
      }))
      .mutation(async ({ input }) => {
        // Parse the input to extract city/state
        const parsed = parseLocation(input.input);
        if (!parsed) {
          return {
            success: false,
            error: "Could not parse location. Please enter a city/state, address, or Redfin/Zillow URL.",
            data: null,
          };
        }

        console.log(`[RegulationTracker] Parsed input: ${parsed.city}, ${parsed.state}${parsed.address ? ` (address: ${parsed.address})` : ''}`);
        
        const result = await getRegulationInfo(parsed.city, parsed.state);
        
        // Debug log the sources being returned
        console.log(`[RegulationTracker] Returning ${result.sources.length} sources:`);
        result.sources.forEach((s, i) => {
          console.log(`  ${i + 1}. [${s.type}] ${s.title} - ${s.url}`);
        });
        
        return {
          success: true,
          data: result,
          parsedLocation: parsed,
        };
      }),

    // Save a regulation search to favorites
    saveRegulation: protectedProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        status: z.string(),
        permitRequired: z.boolean(),
        primaryResidenceOnly: z.boolean(),
        registrationFee: z.string().optional(),
        notes: z.string().optional(),
        sources: z.array(z.object({
          title: z.string(),
          url: z.string(),
          type: z.enum(['official', 'news', 'third_party']),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        // Check if already saved
        const existing = await db.select()
          .from(savedRegulations)
          .where(and(
            eq(savedRegulations.userId, ctx.user.id),
            eq(savedRegulations.locationKey, locationKey)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          return {
            success: false,
            error: 'Regulation already saved',
            alreadySaved: true,
          };
        }
        
        await db.insert(savedRegulations).values({
          userId: ctx.user.id,
          city: input.city,
          state: input.state,
          locationKey,
          status: input.status,
          permitRequired: input.permitRequired ? 1 : 0,
          primaryResidenceOnly: input.primaryResidenceOnly ? 1 : 0,
          registrationFee: input.registrationFee,
          notes: input.notes,
          sources: input.sources || [],
        });
        
        return { success: true };
      }),

    // Get user's saved regulations
    getSavedRegulations: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const saved = await db.select()
          .from(savedRegulations)
          .where(eq(savedRegulations.userId, ctx.user.id))
          .orderBy(desc(savedRegulations.createdAt));
        
        return {
          success: true,
          data: saved.map(r => ({
            ...r,
            permitRequired: r.permitRequired === 1,
            primaryResidenceOnly: r.primaryResidenceOnly === 1,
          })),
        };
      }),

    // Delete a saved regulation
    deleteSavedRegulation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(savedRegulations)
          .where(and(
            eq(savedRegulations.id, input.id),
            eq(savedRegulations.userId, ctx.user.id)
          ));
        return { success: true };
      }),

    // Check if a regulation is saved
    isRegulationSaved: protectedProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        const existing = await db.select()
          .from(savedRegulations)
          .where(and(
            eq(savedRegulations.userId, ctx.user.id),
            eq(savedRegulations.locationKey, locationKey)
          ))
          .limit(1);
        return { saved: existing.length > 0 };
      }),

    // Add a comment to a regulation page
    addComment: protectedProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        content: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        const [result] = await db.insert(regulationComments).values({
          userId: ctx.user.id,
          locationKey,
          city: input.city,
          state: input.state,
          content: input.content,
        });
        
        return { success: true, commentId: result.insertId };
      }),

    // Get comments for a regulation page
    getComments: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        const comments = await db.select({
          id: regulationComments.id,
          content: regulationComments.content,
          createdAt: regulationComments.createdAt,
          userId: regulationComments.userId,
          userName: users.name,
          upvotes: regulationComments.upvotes,
          downvotes: regulationComments.downvotes,
          isFlagged: regulationComments.isFlagged,
        })
          .from(regulationComments)
          .leftJoin(users, eq(regulationComments.userId, users.id))
          .where(and(
            eq(regulationComments.locationKey, locationKey),
            eq(regulationComments.isApproved, 1)
          ))
          .orderBy(desc(regulationComments.upvotes), desc(regulationComments.createdAt));
        
        return {
          success: true,
          data: comments.map(c => ({
            ...c,
            voteScore: c.upvotes - c.downvotes,
          })),
          count: comments.length,
        };
      }),

    // Delete own comment
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(regulationComments)
          .where(and(
            eq(regulationComments.id, input.id),
            eq(regulationComments.userId, ctx.user.id)
          ));
        return { success: true };
      }),

    // Vote on a comment (upvote/downvote)
    voteComment: protectedProcedure
      .input(z.object({
        commentId: z.number(),
        voteType: z.enum(['up', 'down']),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const voteValue = input.voteType === 'up' ? 1 : -1;
        
        // Check if user already voted on this comment
        const existingVote = await db.select()
          .from(commentVotes)
          .where(and(
            eq(commentVotes.commentId, input.commentId),
            eq(commentVotes.userId, ctx.user.id)
          ))
          .limit(1);
        
        if (existingVote.length > 0) {
          const oldVote = existingVote[0];
          
          if (oldVote.voteType === voteValue) {
            // Same vote - remove it (toggle off)
            await db.delete(commentVotes)
              .where(eq(commentVotes.id, oldVote.id));
            
            // Update comment vote counts
            if (voteValue === 1) {
              await db.execute(`UPDATE regulation_comments SET upvotes = upvotes - 1 WHERE id = ${input.commentId}`);
            } else {
              await db.execute(`UPDATE regulation_comments SET downvotes = downvotes - 1 WHERE id = ${input.commentId}`);
            }
            
            return { success: true, action: 'removed' };
          } else {
            // Different vote - change it
            await db.update(commentVotes)
              .set({ voteType: voteValue })
              .where(eq(commentVotes.id, oldVote.id));
            
            // Update comment vote counts (swap)
            if (voteValue === 1) {
              await db.execute(`UPDATE regulation_comments SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ${input.commentId}`);
            } else {
              await db.execute(`UPDATE regulation_comments SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ${input.commentId}`);
            }
            
            return { success: true, action: 'changed' };
          }
        } else {
          // New vote
          await db.insert(commentVotes).values({
            commentId: input.commentId,
            userId: ctx.user.id,
            voteType: voteValue,
          });
          
          // Update comment vote counts
          if (voteValue === 1) {
            await db.execute(`UPDATE regulation_comments SET upvotes = upvotes + 1 WHERE id = ${input.commentId}`);
          } else {
            await db.execute(`UPDATE regulation_comments SET downvotes = downvotes + 1 WHERE id = ${input.commentId}`);
          }
          
          return { success: true, action: 'added' };
        }
      }),

    // Get user's vote on a comment
    getUserVote: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const vote = await db.select()
          .from(commentVotes)
          .where(and(
            eq(commentVotes.commentId, input.commentId),
            eq(commentVotes.userId, ctx.user.id)
          ))
          .limit(1);
        
        return {
          hasVoted: vote.length > 0,
          voteType: vote.length > 0 ? (vote[0].voteType === 1 ? 'up' : 'down') : null,
        };
      }),

    // Get user's votes for multiple comments at once
    getUserVotes: protectedProcedure
      .input(z.object({ commentIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        if (input.commentIds.length === 0) return { votes: {} };
        
        const votes = await db.select()
          .from(commentVotes)
          .where(eq(commentVotes.userId, ctx.user.id));
        
        const voteMap: Record<number, 'up' | 'down'> = {};
        votes.forEach(v => {
          if (input.commentIds.includes(v.commentId)) {
            voteMap[v.commentId] = v.voteType === 1 ? 'up' : 'down';
          }
        });
        
        return { votes: voteMap };
      }),

    // Flag a comment for admin review
    flagComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.execute(`UPDATE regulation_comments SET isFlagged = 1 WHERE id = ${input.commentId}`);
        return { success: true };
      }),

    // Admin: Get flagged comments
    getFlaggedComments: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Check if user is admin
        if (ctx.user.role !== 'admin') {
          return { success: false, error: 'Admin access required', data: [] };
        }
        
        const flagged = await db.select({
          id: regulationComments.id,
          content: regulationComments.content,
          createdAt: regulationComments.createdAt,
          userId: regulationComments.userId,
          userName: users.name,
          city: regulationComments.city,
          state: regulationComments.state,
          upvotes: regulationComments.upvotes,
          downvotes: regulationComments.downvotes,
        })
          .from(regulationComments)
          .leftJoin(users, eq(regulationComments.userId, users.id))
          .where(eq(regulationComments.isFlagged, 1))
          .orderBy(desc(regulationComments.createdAt));
        
        return { success: true, data: flagged };
      }),

    // Admin: Approve a flagged comment (unflag)
    approveComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        if (ctx.user.role !== 'admin') {
          return { success: false, error: 'Admin access required' };
        }
        
        await db.execute(`UPDATE regulation_comments SET isFlagged = 0 WHERE id = ${input.commentId}`);
        return { success: true };
      }),

    // Admin: Remove a comment (hide it)
    adminDeleteComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        if (ctx.user.role !== 'admin') {
          return { success: false, error: 'Admin access required' };
        }
        
        await db.execute(`UPDATE regulation_comments SET isApproved = 0, isFlagged = 0 WHERE id = ${input.commentId}`);
        return { success: true };
      }),

    // Create a shareable regulation report link
    createShareableReport: publicProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        status: z.string(),
        summary: z.string().optional(),
        permitRequired: z.boolean().default(false),
        primaryResidenceOnly: z.boolean().default(false),
        maxNightsPerYear: z.number().optional(),
        registrationFee: z.string().optional(),
        occupancyTax: z.string().optional(),
        confidence: z.string().optional(),
        fullRegulationData: z.any().optional(),
        keyRequirements: z.array(z.any()).optional(),
        sources: z.array(z.any()).optional(),
        creatorEmail: z.string().email().optional(),
        creatorPhone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Generate a unique share code
        const shareCode = generateShareCode();
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        const [result] = await db.insert(shareableRegulationReports).values({
          shareCode,
          city: input.city,
          state: input.state,
          locationKey,
          status: input.status,
          summary: input.summary,
          permitRequired: input.permitRequired ? 1 : 0,
          primaryResidenceOnly: input.primaryResidenceOnly ? 1 : 0,
          maxNightsPerYear: input.maxNightsPerYear,
          registrationFee: input.registrationFee,
          occupancyTax: input.occupancyTax,
          confidence: input.confidence,
          fullRegulationData: input.fullRegulationData,
          keyRequirements: input.keyRequirements,
          sources: input.sources,
          creatorEmail: input.creatorEmail,
          creatorPhone: input.creatorPhone,
        });
        
        return {
          success: true,
          shareCode,
          shareUrl: `/report/${shareCode}`,
          reportId: result.insertId,
        };
      }),

    // Get a shareable report by share code
    getShareableReport: publicProcedure
      .input(z.object({ shareCode: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const [report] = await db.select()
          .from(shareableRegulationReports)
          .where(eq(shareableRegulationReports.shareCode, input.shareCode))
          .limit(1);
        
        if (!report) {
          return { success: false, error: 'Report not found', data: null };
        }
        
        // Increment view count
        await db.execute(`UPDATE shareable_regulation_reports SET viewCount = viewCount + 1, lastViewedAt = NOW() WHERE id = ${report.id}`);
        
        return {
          success: true,
          data: {
            ...report,
            permitRequired: report.permitRequired === 1,
            primaryResidenceOnly: report.primaryResidenceOnly === 1,
          },
        };
      }),

    // Send shareable report via SMS
    sendReportSMS: publicProcedure
      .input(z.object({
        shareCode: z.string(),
        phoneNumber: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get the report
        const [report] = await db.select()
          .from(shareableRegulationReports)
          .where(eq(shareableRegulationReports.shareCode, input.shareCode))
          .limit(1);
        
        if (!report) {
          return { success: false, error: 'Report not found' };
        }
        
        // Send SMS via SimpleTexting
        const smsResult = await sendSMSNotification(
          input.phoneNumber,
          `Your STR Regulation Report for ${report.city}, ${report.state} is ready! Status: ${report.status}. View full report: ${process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com'}/report/${input.shareCode}`
        );
        
        if (smsResult.success) {
          // Update the report with SMS sent info
          await db.execute(`UPDATE shareable_regulation_reports SET smsSentTo = '${input.phoneNumber}', smsSentAt = NOW() WHERE id = ${report.id}`);
        }
        
        return smsResult;
      }),

    // Auto-create shareable report and send notifications (for auto-notification flow)
    autoCreateAndNotify: publicProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        status: z.string(),
        summary: z.string().optional(),
        permitRequired: z.boolean().default(false),
        primaryResidenceOnly: z.boolean().default(false),
        maxNightsPerYear: z.number().optional(),
        registrationFee: z.string().optional(),
        occupancyTax: z.string().optional(),
        confidence: z.string().optional(),
        fullRegulationData: z.any().optional(),
        keyRequirements: z.array(z.any()).optional(),
        sources: z.array(z.any()).optional(),
        // Contact info for auto-notification
        userEmail: z.string().email().optional(),
        userPhone: z.string().optional(),
        userName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Only proceed if at least one contact method provided
        if (!input.userEmail && !input.userPhone) {
          return {
            success: false,
            error: 'No contact information provided for notification',
            shareCode: null,
            notificationsSent: { sms: false, email: false },
          };
        }
        
        // Generate a unique share code
        const shareCode = generateShareCode();
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        // Create the shareable report
        const [result] = await db.insert(shareableRegulationReports).values({
          shareCode,
          city: input.city,
          state: input.state,
          locationKey,
          status: input.status,
          summary: input.summary,
          permitRequired: input.permitRequired ? 1 : 0,
          primaryResidenceOnly: input.primaryResidenceOnly ? 1 : 0,
          maxNightsPerYear: input.maxNightsPerYear,
          registrationFee: input.registrationFee,
          occupancyTax: input.occupancyTax,
          confidence: input.confidence,
          fullRegulationData: input.fullRegulationData,
          keyRequirements: input.keyRequirements,
          sources: input.sources,
          creatorEmail: input.userEmail,
          creatorPhone: input.userPhone,
        });
        
        // Send notifications using the helper function
        const { sendReportNotifications } = await import('../sms-email-notifications');
        const notificationResults = await sendReportNotifications(
          {
            city: input.city,
            state: input.state,
            status: input.status,
            shareCode,
          },
          {
            phone: input.userPhone,
            email: input.userEmail,
            name: input.userName,
          }
        );
        
        // Update the report with notification status
        if (notificationResults.sms?.success && input.userPhone) {
          await db.execute(`UPDATE shareable_regulation_reports SET smsSentTo = '${input.userPhone}', smsSentAt = NOW() WHERE id = ${result.insertId}`);
        }
        if (notificationResults.email?.success && input.userEmail) {
          await db.execute(`UPDATE shareable_regulation_reports SET emailSentTo = '${input.userEmail}', emailSentAt = NOW() WHERE id = ${result.insertId}`);
        }
        
        console.log(`[AutoNotify] Created report ${shareCode} for ${input.city}, ${input.state}. SMS: ${notificationResults.sms?.success || false}, Email: ${notificationResults.email?.success || false}`);
        
        return {
          success: true,
          shareCode,
          shareUrl: `/report/${shareCode}`,
          reportId: result.insertId,
          notificationsSent: {
            sms: notificationResults.sms?.success || false,
            email: notificationResults.email?.success || false,
          },
        };
      }),

    // Send shareable report via Email
    sendReportEmail: publicProcedure
      .input(z.object({
        shareCode: z.string(),
        email: z.string().email(),
        recipientName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get the report
        const [report] = await db.select()
          .from(shareableRegulationReports)
          .where(eq(shareableRegulationReports.shareCode, input.shareCode))
          .limit(1);
        
        if (!report) {
          return { success: false, error: 'Report not found' };
        }
        
        // Send email via notification service
        const emailResult = await sendEmailNotification(
          input.email,
          `STR Regulation Report: ${report.city}, ${report.state}`,
          `Your STR Regulation Report is ready!\n\nLocation: ${report.city}, ${report.state}\nStatus: ${report.status}\n\nView full report: ${process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com'}/report/${input.shareCode}`,
          input.recipientName
        );
        
        if (emailResult.success) {
          // Update the report with email sent info
          await db.execute(`UPDATE shareable_regulation_reports SET emailSentTo = '${input.email}', emailSentAt = NOW() WHERE id = ${report.id}`);
        }
        
        return emailResult;
      }),
});
