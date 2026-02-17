import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql } from "drizzle-orm";

export const aiRouter = router({
    // Non-streaming chat endpoint (fallback)
    chat: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string(),
        })),
        systemPrompt: z.string().optional(),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { claudeChat } = await import('../ai-streaming');
          
          const response = await claudeChat(
            input.messages.map(m => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            })),
            input.systemPrompt
          );
          
          // Save to conversation if conversationId provided
          if (input.conversationId) {
            const db = await getDb();
            if (db) {
              const { aiMessages, aiConversations } = await import('../../drizzle/schema');
              
              // Save user message
              const userMsg = input.messages.filter(m => m.role === 'user').pop();
              if (userMsg) {
                await db.insert(aiMessages).values({
                  conversationId: input.conversationId,
                  role: 'user',
                  content: userMsg.content,
                  isComplete: 1,
                });
              }
              
              // Save assistant response
              await db.insert(aiMessages).values({
                conversationId: input.conversationId,
                role: 'assistant',
                content: response,
                isComplete: 1,
              });
              
              // Update conversation
              await db.execute(
                sql`UPDATE ai_conversations SET messageCount = messageCount + 2, lastMessageAt = NOW() WHERE id = ${input.conversationId}`
              );
            }
          }
          
          return {
            content: response || 'I apologize, but I could not generate a response.',
            success: true,
          };
        } catch (error) {
          console.error('[AI Chat] Claude Error:', error);
          return {
            content: 'I apologize, but I encountered an error. Please try again.',
            success: false,
          };
        }
      }),
    
    // Create a new conversation
    createConversation: publicProcedure
      .input(z.object({
        title: z.string().optional(),
        contextTool: z.string().optional(),
        contextAddress: z.string().optional(),
        contextMarket: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const { aiConversations } = await import('../../drizzle/schema');
        
        const result = await db.insert(aiConversations).values({
          userId: ctx.user?.id || null,
          sessionId: input.sessionId || null,
          title: input.title || 'New Conversation',
          contextTool: input.contextTool || null,
          contextAddress: input.contextAddress || null,
          contextMarket: input.contextMarket || null,
          messageCount: 0,
        });
        
        return {
          id: result[0].insertId,
          success: true,
        };
      }),
    
    // List conversations for a user/session
    listConversations: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        limit: z.number().default(20),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { conversations: [] };
        
        const { aiConversations } = await import('../../drizzle/schema');
        
        // Get conversations for this user or session
        let conversations: typeof aiConversations.$inferSelect[] = [];
        if (ctx.user?.id) {
          conversations = await db
            .select()
            .from(aiConversations)
            .where(eq(aiConversations.userId, ctx.user.id))
            .orderBy(desc(aiConversations.lastMessageAt))
            .limit(input.limit);
        } else if (input.sessionId) {
          conversations = await db
            .select()
            .from(aiConversations)
            .where(eq(aiConversations.sessionId, input.sessionId))
            .orderBy(desc(aiConversations.lastMessageAt))
            .limit(input.limit);
        } else {
          conversations = [];
        }
        
        return { conversations };
      }),
    
    // Get messages for a conversation
    getConversation: publicProcedure
      .input(z.object({
        conversationId: z.number(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { messages: [], conversation: null };
        
        const { aiConversations, aiMessages } = await import('../../drizzle/schema');
        
        // Get conversation details
        const [conversation] = await db
          .select()
          .from(aiConversations)
          .where(eq(aiConversations.id, input.conversationId))
          .limit(1);
        
        if (!conversation) {
          return { messages: [], conversation: null };
        }
        
        // Get messages
        const messages = await db
          .select()
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, input.conversationId))
          .orderBy(aiMessages.createdAt);
        
        return { messages, conversation };
      }),
    
    // Add a message to a conversation
    addMessage: publicProcedure
      .input(z.object({
        conversationId: z.number(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const { aiMessages, aiConversations } = await import('../../drizzle/schema');
        
        // Insert message
        const result = await db.insert(aiMessages).values({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          isComplete: 1,
        });
        
        // Update conversation
        await db.execute(
          sql`UPDATE ai_conversations SET messageCount = messageCount + 1, lastMessageAt = NOW() WHERE id = ${input.conversationId}`
        );
        
        // Auto-generate title from first user message if title is still default
        if (input.role === 'user') {
          const [conv] = await db
            .select()
            .from(aiConversations)
            .where(eq(aiConversations.id, input.conversationId))
            .limit(1);
          
          if (conv && (conv.title === 'New Conversation' || !conv.title)) {
            // Generate title from first ~50 chars of message
            const autoTitle = input.content.slice(0, 50) + (input.content.length > 50 ? '...' : '');
            await db
              .update(aiConversations)
              .set({ title: autoTitle })
              .where(eq(aiConversations.id, input.conversationId));
          }
        }
        
        return {
          id: result[0].insertId,
          success: true,
        };
      }),
    
    // Delete a conversation
    deleteConversation: publicProcedure
      .input(z.object({
        conversationId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const { aiConversations, aiMessages } = await import('../../drizzle/schema');
        
        // Verify ownership
        const [conversation] = await db
          .select()
          .from(aiConversations)
          .where(eq(aiConversations.id, input.conversationId))
          .limit(1);
        
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        // Delete messages first
        await db
          .delete(aiMessages)
          .where(eq(aiMessages.conversationId, input.conversationId));
        
        // Delete conversation
        await db
          .delete(aiConversations)
          .where(eq(aiConversations.id, input.conversationId));
        
        return { success: true };
      }),
});
