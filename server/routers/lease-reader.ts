/**
 * Lease Reader & Addendum Maker Router
 * Step 8: Upload lease → AI analysis → Generate addendum (PDF + email/text)
 */

import { z } from 'zod';
import { protectedProcedure } from '../_core/trpc';
import { router } from '../_core/trpc';
import { storagePut } from '../storage';
import { analyzeLeaseDocument, generateAddendum, generateAddendumPdf, type LeaseAnalysis } from '../lease-reader';

export const leaseReaderRouter = router({
  /**
   * Upload a lease document (PDF or image) to S3
   * Returns the S3 URL for the uploaded file
   */
  uploadLease: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileData: z.string(), // base64-encoded file data
      fileType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { fileName, fileData, fileType } = input;
      const userId = ctx.user.id;
      
      // Decode base64
      const buffer = Buffer.from(fileData, 'base64');
      
      // Validate file size (max 20MB)
      if (buffer.length > 20 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 20MB.');
      }
      
      // Upload to S3
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const ext = fileType === 'application/pdf' ? 'pdf' : fileType.split('/')[1];
      const fileKey = `lease-uploads/${userId}/${timestamp}-${randomSuffix}.${ext}`;
      
      const { url, key } = await storagePut(fileKey, buffer, fileType);
      
      console.log(`[LeaseReader] Lease uploaded by user ${userId}: ${key}`);
      
      return {
        url,
        key,
        fileType: fileType === 'application/pdf' ? 'pdf' as const : 'image' as const,
      };
    }),

  /**
   * Analyze an uploaded lease document using Claude Vision
   * Returns the full lease analysis
   */
  analyzeLease: protectedProcedure
    .input(z.object({
      fileUrl: z.string().url(),
      fileType: z.enum(['pdf', 'image']),
    }))
    .mutation(async ({ input }) => {
      const analysis = await analyzeLeaseDocument(input.fileUrl, input.fileType);
      return analysis;
    }),

  /**
   * Generate an addendum based on the lease analysis
   * Returns formal text, email version, and SMS version
   */
  generateAddendum: protectedProcedure
    .input(z.object({
      analysis: z.any(), // LeaseAnalysis object (validated on client)
      tenantName: z.string().min(1),
      tenantEmail: z.string().email().optional(),
      tenantPhone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const analysis = input.analysis as LeaseAnalysis;
      
      const addendum = await generateAddendum(analysis, {
        name: input.tenantName,
        email: input.tenantEmail,
        phone: input.tenantPhone,
      });
      
      // Also generate the HTML version and store it
      const { url: htmlUrl } = await generateAddendumPdf(addendum, analysis);
      
      return {
        ...addendum,
        htmlUrl,
      };
    }),
});
