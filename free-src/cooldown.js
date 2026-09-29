// cooldown.js, the free tier rate limit: one automated registration per three hour window.
//
// This is the whole license system in the free version: a counter that keeps
// you to one registration every third hour. There is no key, no secret and
// no Pro tier, only the rate limit.

const RUN_TIMESTAMPS_KEY = 'aam_run_timestamps';
const FREE_RUN_LIMIT = 1;
const FREE_COOLDOWN_MS = 3 * 60 * 60 * 1000;

function remainingMinutes(nextAllowedAt, now) {
  return Math.max(1, Math.ceil((nextAllowedAt - now) / (60 * 1000)));
}

// Drives the countdown in the popup ("2h 14m").
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
  const cutoff = now - FREE_COOLDOWN_MS;
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

function cooldownDenied(now, timestamps) {
  const oldestTimestamp = Math.min(...timestamps);
  const nextAllowedAt = oldestTimestamp + FREE_COOLDOWN_MS;
  return {
    allowed: false,
    tier: 'free',
    reason: 'cooldown',
    minutesRemaining: remainingMinutes(nextAllowedAt, now),
    remainingMs: Math.max(0, nextAllowedAt - now),
    remainingLabel: formatRemaining(Math.max(0, nextAllowedAt - now)),
    nextAllowedAt,
  };
}

// Interface use only. Does not consume a slot.
async function canStartRun() {
  try {
    const { now, timestamps } = await readActiveTimestamps();
    await writeActiveTimestamps(timestamps);

    if (timestamps.length >= FREE_RUN_LIMIT) {
      return cooldownDenied(now, timestamps);
    }

    return { allowed: true, tier: 'free', remainingMs: 0, remainingLabel: '' };
  } catch (e) {
    console.warn('[AAM Cooldown] Check failed:', e);
    // Fail closed: a broken check must never open up unlimited use.
    return {
      allowed: false,
      tier: 'free',
      reason: 'cooldown',
      minutesRemaining: 180,
      remainingMs: FREE_COOLDOWN_MS,
      remainingLabel: '3h',
    };
  }
}

let consumeSlotChain = Promise.resolve();

async function consumeFreeRunSlotInner() {
  const { now, timestamps } = await readActiveTimestamps();

  if (timestamps.length >= FREE_RUN_LIMIT) {
    await writeActiveTimestamps(timestamps);
    return cooldownDenied(now, timestamps);
  }

  timestamps.push(now);
  await writeActiveTimestamps(timestamps);
  return { allowed: true, tier: 'free' };
}

// Consumes the slot when a registration actually starts. Serialized so two
// fast clicks cannot both pass the check.
async function consumeFreeRunSlot() {
  const run = consumeSlotChain.then(
    () => consumeFreeRunSlotInner(),
    () => consumeFreeRunSlotInner()
  );
  consumeSlotChain = run.catch(() => {});
  return run;
}
