// cooldown.js — gratisnivåns spärr (1 automatisk registrering per 3-timmarsfönster)
//
// Det här är hela "licenssystemet" i gratisversionen: en räknare som ser till
// att du inte kör fler än en registrering var tredje timme. Det finns ingen
// nyckel, ingen hemlighet och ingen Pro-nivå — bara spärren.

const RUN_TIMESTAMPS_KEY = 'aam_run_timestamps';
const FREE_RUN_LIMIT = 1;
const FREE_COOLDOWN_MS = 3 * 60 * 60 * 1000;

function remainingMinutes(nextAllowedAt, now) {
  return Math.max(1, Math.ceil((nextAllowedAt - now) / (60 * 1000)));
}

// Matar nedräkningen i popupen ("2h 14m").
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

// Bara för gränssnittet. Förbrukar ingen slot.
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
    // Fail closed: en trasig kontroll får inte öppna upp obegränsat bruk.
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

// Förbrukar slotten när en registrering faktiskt startar. Serialiserad, så två
// snabba klick inte båda kan passera kontrollen.
async function consumeFreeRunSlot() {
  const run = consumeSlotChain.then(
    () => consumeFreeRunSlotInner(),
    () => consumeFreeRunSlotInner()
  );
  consumeSlotChain = run.catch(() => {});
  return run;
}
