import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { runWithRequestContext } from "../request-context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

/**
 * Global middleware that sets request-scoped context for ALL procedures.
 * This allows deep functions (like the AirDNA rate limiter) to know
 * if the current request is from an admin without threading user info
 * through every function parameter.
 */
const withRequestContext = t.middleware(async ({ ctx, next }) => {
  const isAdmin = ctx.user?.role === 'admin';
  const userId = ctx.user?.id;
  
  return runWithRequestContext(
    { isAdmin, userId },
    () => next({ ctx })
  ) as ReturnType<typeof next>;
});

// All procedures get request context automatically
export const publicProcedure = t.procedure.use(withRequestContext);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(withRequestContext).use(requireUser);

export const adminProcedure = t.procedure.use(withRequestContext).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
