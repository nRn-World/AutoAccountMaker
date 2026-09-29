/**
 * cooldown.js: the rate limit for the store build.
 *
 * Three automatic fills per hour. That is generous for a person filling in
 * forms, and it stops the extension from hammering any single site if it is
 * left open in a loop. The counter is per browser profile, stored locally, and
 * it works offline, so there is no server involved and nothing is sent.
 *
 * Fail closed: if the check itself breaks, the answer is "not now". A broken
 * rate limit must never turn into unlimited use.
 */
const RUN_TIMESTAMPS_KEY = 'aam_fill_timestamps';
const FILL_LIMIT = 3;
const COOLDOWN_MS = 60 * 60 * 1000;

function remainingMinutes(nextAllowedAt, now) {
  return Math.max(1, Math.ceil((nextAllowedAt - now) / (60 * 1000)));
}

/** Feeds the countdown text, for example "2h 14m". */
function formatRemaining(ms) {
  if (ms <= 0) return '';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

async function readActiveTimestamps() {
  const now = Date.now();
  const cutoff = now - COOLDOWN_MS;
  let localStamps = [];
  let syncStamps = [];
  try {
    const local = await chrome.storage.local.get([RUN_TIMESTAMPS_KEY]);
    localStamps = local[RUN_TIMESTAMPS_KEY] || [];
  } catch (e) {}
  try {
    if (chrome.storage.sync) {
      const sync = await chrome.storage.sync.get([RUN_TIMESTAMPS_KEY]);
      syncStamps = sync[RUN_TIMESTAMPS_KEY] || [];
    }
  } catch (e) {}
  const timestamps = [...new Set([...localStamps, ...syncStamps].filter((ts) => ts > cutoff))].sort();
  return { now, timestamps };
}

async function writeActiveTimestamps(timestamps) {
  await chrome.storage.local.set({ [RUN_TIMESTAMPS_KEY]: timestamps });
  try {
    if (chrome.storage.sync) {
      await chrome.storage.sync.set({ [RUN_TIMESTAMPS_KEY]: timestamps });
    }
  } catch (e) {}
}

function limitReached(now, timestamps) {
  const oldestTimestamp = Math.min(...timestamps);
  const nextAllowedAt = oldestTimestamp + COOLDOWN_MS;
  return {
    allowed: false,
    reason: 'rateLimit',
    minutesRemaining: remainingMinutes(nextAllowedAt, now),
    remainingMs: Math.max(0, nextAllowedAt - now),
    remainingLabel: formatRemaining(Math.max(0, nextAllowedAt - now)),
    nextAllowedAt,
  };
}

/** Read only. Does not consume anything. */
async function canStartRun() {
  try {
    const { now, timestamps } = await readActiveTimestamps();
    if (timestamps.length >= FILL_LIMIT) return limitReached(now, timestamps);
    return { allowed: true, remainingMs: 0, remainingLabel: '' };
  } catch (e) {
    console.warn('[AAM] Rate limit check failed:', e);
    return {
      allowed: false,
      reason: 'rateLimit',
      minutesRemaining: 60,
      remainingMs: COOLDOWN_MS,
      remainingLabel: '1h',
    };
  }
}

let consumeChain = Promise.resolve();

async function consumeFreeRunSlotInner() {
  const { now, timestamps } = await readActiveTimestamps();
  if (timestamps.length >= FILL_LIMIT) {
    await writeActiveTimestamps(timestamps);
    return limitReached(now, timestamps);
  }
  timestamps.push(now);
  await writeActiveTimestamps(timestamps);
  return { allowed: true };
}

/**
 * Consumes one slot when a fill actually starts. Serialized, so two fast
 * clicks cannot both pass the check.
 */
async function consumeFreeRunSlot() {
  const run = consumeChain.then(
    () => consumeFreeRunSlotInner(),
    () => consumeFreeRunSlotInner()
  );
  consumeChain = run.catch(() => {});
  return run;
}
