import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { generateExcelReport } from "../export-excel";
import { generatePDFReport } from "../export-pdf";
import { generateFullArbitrageAnalysis } from "../sop-reports";

export const exportRouter = router({
    // Export analysis as PDF
    pdf: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        monthly_rent: z.number().min(0, "Monthly rent is required"),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating PDF for:', input.address);
          
          // Run the analysis
          const analysis = await generateFullArbitrageAnalysis(
            input.address,
            input.monthly_rent,
            input.bedrooms,
            input.bathrooms
          );
          
          // Generate PDF
          const pdfBuffer = await generatePDFReport(analysis as any);
          const base64 = pdfBuffer.toString('base64');
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${input.address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
              mimeType: 'application/pdf'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating PDF:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF',
            data: null
          };
        }
      }),

    // Export analysis as Excel
    excel: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        monthly_rent: z.number().min(0, "Monthly rent is required"),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating Excel for:', input.address);
          
          // Run the analysis
          const analysis = await generateFullArbitrageAnalysis(
            input.address,
            input.monthly_rent,
            input.bedrooms,
            input.bathrooms
          );
          
          // Generate Excel
          const excelBuffer = await generateExcelReport(analysis as any);
          const base64 = excelBuffer.toString('base64');
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${input.address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating Excel:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate Excel',
            data: null
          };
        }
      }),

    // Export from existing analysis data (no re-fetch)
    pdfFromData: publicProcedure
      .input(z.object({
        analysisData: z.any(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating PDF from existing data');
          
          const pdfBuffer = await generatePDFReport(input.analysisData);
          const base64 = pdfBuffer.toString('base64');
          const address = input.analysisData?.property_estimate?.property?.address || 'property';
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
              mimeType: 'application/pdf'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating PDF from data:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF',
            data: null
          };
        }
      }),

    // Export from existing analysis data as Excel (no re-fetch)
    excelFromData: publicProcedure
      .input(z.object({
        analysisData: z.any(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating Excel from existing data');
          
          const excelBuffer = await generateExcelReport(input.analysisData);
          const base64 = excelBuffer.toString('base64');
          const address = input.analysisData?.property_estimate?.property?.address || 'property';
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating Excel from data:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate Excel',
            data: null
          };
        }
      }),
});
