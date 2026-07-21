#!/bin/bash
# check-restart-loop.sh — Check if the dispatcher loop is alive; restart if dead.
# Usage: bash check-restart-loop.sh
# Safe to run multiple times; idempotent.

set -e

LOOP_SCRIPT="emergency-dispatcher-loop.ts"
PROJECT_DIR="/home/ubuntu/rental-calculator"
LOG_FILE="$PROJECT_DIR/dispatcher-loop.log"

echo "=== Dispatcher Loop Check @ $(date -u) ==="

# Find the main node process running the dispatcher loop
LOOP_PID=$(pgrep -f "$LOOP_SCRIPT" | head -1 || true)

if [ -n "$LOOP_PID" ]; then
    echo "[OK] Dispatcher loop is ALIVE (PID: $LOOP_PID)"
    echo "[OK] Process uptime: $(ps -o etime= -p $LOOP_PID | xargs)"
    
    # Show latest heartbeat
    LAST_HB=$(grep "HEARTBEAT" "$LOG_FILE" 2>/dev/null | tail -1 || echo "none")
    echo "[OK] Last heartbeat: $LAST_HB"
    
    # Show last 3 log lines
    echo "--- Recent log ---"
    tail -3 "$LOG_FILE" 2>/dev/null || echo "(no log)"
    echo "---"
    echo "[STATUS] Loop running. No action needed."
else
    echo "[DEAD] Dispatcher loop process NOT FOUND. Restarting..."
    
    # Kill any zombie tsx processes related to the loop
    pkill -f "$LOOP_SCRIPT" 2>/dev/null || true
    sleep 1
    
    # Kill the TSC watcher if it's eating memory (not needed for dispatch)
    pkill -f "tsc --noEmit --watch" 2>/dev/null || true
    
    # Restart the loop in background
    cd "$PROJECT_DIR"
    nohup bash -c "cd $PROJECT_DIR && FORCE_CRON=true npx tsx $LOOP_SCRIPT" >> "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    
    sleep 5
    
    # Verify it started
    ACTUAL_PID=$(pgrep -f "$LOOP_SCRIPT" | head -1 || true)
    if [ -n "$ACTUAL_PID" ]; then
        echo "[RESTARTED] New dispatcher loop PID: $ACTUAL_PID"
        echo "--- First log lines after restart ---"
        tail -5 "$LOG_FILE" 2>/dev/null
    else
        echo "[FAILED] Could not restart dispatcher loop!"
        echo "Try manually: cd $PROJECT_DIR && FORCE_CRON=true npx tsx $LOOP_SCRIPT 2>&1 | tee -a $LOG_FILE"
    fi
fi

echo ""
echo "=== Quick Status ==="
echo "Time (UTC): $(date -u '+%Y-%m-%d %H:%M:%S')"
echo "Time (ET):  $(TZ='America/New_York' date '+%Y-%m-%d %I:%M:%S %p')"
echo "Memory: $(free -m | awk '/Mem:/{printf "%dMB used / %dMB total (%d%%)", $3, $2, $3*100/$2}')"
echo ""
echo "=== Remaining Fires ==="
echo "  22:00 UTC (6:00 PM ET) — 1 Hour Warning (#330005)"
echo "  22:45 UTC (6:45 PM ET) — 15 Min Before (#330006)"
echo "  22:55 UTC (6:55 PM ET) — Starting NOW (#330007)"
echo "  23:10 UTC (7:10 PM ET) — No-Show Nudge (#330008)"
echo "  01:00 UTC (9:00 PM ET) — Missed You (#330010)"
