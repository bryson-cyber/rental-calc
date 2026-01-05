export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  airdnaApiKey: process.env.AIRDNA_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  poeApiKey: process.env.POE_API_KEY ?? "",
  browserUseApiKey: process.env.BROWSER_USE_API_KEY ?? "",
};
