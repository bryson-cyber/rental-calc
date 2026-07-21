/**
 * Emergency Dispatcher Loop — runs SMS + Email dispatchers + Import cron
 * from the sandbox when the production site is suspended.
 * 
 * Usage: cd /home/ubuntu/rental-calculator && FORCE_CRON=true npx tsx emergency-dispatcher-loop.ts
 * 
 * Auto-expires at 2026-07-20T01:30:00Z (9:30 PM ET Jul 19)
 */

import './server/routers/webinar-sms'; // side-effect: initializes initDispatcherV2

const TICK_INTERVAL = 30_000; // 30s
const IMPORT_INTERVAL = 180_000; // 3 min
const EXPIRY = new Date('2026-07-20T01:30:00Z');

async function main() {
  const startTime = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-US', { 
    timeZone: 'America/New_York', 
    dateStyle: 'short', 
    timeStyle: 'medium' 
  });
  
  console.log('======================================================================');
  console.log(`[DISPATCHER LOOP STARTED] ${startTime.toISOString()}`);
  console.log(`ET: ${etFormatter.format(startTime)}`);
  console.log(`Tick interval: ${TICK_INTERVAL/1000}s | Import interval: ${IMPORT_INTERVAL/1000}s`);
  console.log(`Expiry: ${EXPIRY.toISOString()} (9:30 PM ET)`);
  console.log('======================================================================');
  
  const minutesUntilExpiry = Math.round((EXPIRY.getTime() - Date.now()) / 60000);
  console.log(`[INFO] Will auto-stop in ${minutesUntilExpiry} minutes`);
  
  // Import the functions we need
  const { 
    startSmsDispatcher, 
    startEmailDispatcher, 
    startWebinarImportCron,
    runScheduledDispatch,
    runScheduledEmailDispatch,
    runScheduledImport
  } = await import('./server/routers/webinar-sms');
  
  // Start the import cron (reads settings from DB, runs every 3 min)
  await startWebinarImportCron();
  
  // Start SMS dispatcher (V2 look-ahead, every 30s)
  await startSmsDispatcher();
  
  // Start email dispatcher (independent, every 30s)
  await startEmailDispatcher();
  
  // Heartbeat ticker - logs status every 5 minutes (every 10 ticks)
  let tickCount = 0;
  const heartbeat = setInterval(async () => {
    tickCount++;
    if (Date.now() > EXPIRY.getTime()) {
      console.log(`[EXPIRED] Loop expired at ${new Date().toISOString()}. Shutting down.`);
      clearInterval(heartbeat);
      process.exit(0);
    }
    
    if (tickCount % 10 === 0) {
      const now = new Date();
      try {
        const smsResult = await runScheduledDispatch();
        const emailResult = await runScheduledEmailDispatch();
        console.log(`[HEARTBEAT ${now.toISOString()}] Tick #${tickCount} | ET: ${etFormatter.format(now)} | SMS: ${JSON.stringify(smsResult)} | Email: ${JSON.stringify(emailResult)}`);
      } catch (err: any) {
        console.error(`[HEARTBEAT ERROR] Tick #${tickCount}: ${err.message}`);
      }
    }
  }, TICK_INTERVAL);
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('[SHUTDOWN] Received SIGINT, stopping...');
    clearInterval(heartbeat);
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] Received SIGTERM, stopping...');
    clearInterval(heartbeat);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
