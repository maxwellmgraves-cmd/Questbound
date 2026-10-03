export const XP = {
  minor: 5,
  moderate: 25,
  major: 100
}

export const COINS = {
  minor: 1,
  moderate: 5,
  major: 20
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const EVERY_DAY = [0,1,2,3,4,5,6]
export const SCHOOL_DAYS = [1,2,3,4,5]

const objective = (id, title, bonus = false) => ({
  id,
  title,
  bonus,
  xp: bonus ? XP.moderate : XP.minor,
  coins: bonus ? COINS.moderate : COINS.minor
})

export const starterRoutines = (profileId = 'kid-1') => [
  {
    id: 'morning-routine', profileId, type: 'routine', title: 'Morning Routine', icon: '🌅', zone: 'Dawn Camp',
    description: 'Wake up, gear up, and get your character online.', days: SCHOOL_DAYS, reminderTime: '06:45', order: 1,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('bathroom', 'Go to the bathroom'),
      objective('brush-teeth', 'Brush teeth'),
      objective('get-dressed', 'Get dressed'),
      objective('brush-hair', 'Brush hair')
    ]
  },
  {
    id: 'launch-routine', profileId, type: 'routine', title: 'Launch Routine', icon: '🚀', zone: 'Launch Pad',
    description: 'Run the preflight before leaving the house.', days: SCHOOL_DAYS, reminderTime: '07:10', order: 2,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('shirt-check', 'Check if shirt is on correctly'),
      objective('pants-check', 'Check if pants are buttoned and zipped'),
      objective('eat-something', 'Eat something'),
      objective('shoes', 'Put shoes on')
    ]
  },
  {
    id: 'load-up', profileId, type: 'routine', title: 'Load Up', icon: '🎒', zone: 'Departure Gate',
    description: 'Everything aboard. Nothing dangling in the airlock.', days: SCHOOL_DAYS, reminderTime: '07:25', order: 3,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('backpack', 'Grab backpack'),
      objective('lunchbox', 'Grab lunchbox'),
      objective('car', 'Get into car'),
      objective('door', 'Close door completely'),
      objective('seatbelt', 'Seatbelt')
    ]
  },
  {
    id: 'pickup-routine', profileId, type: 'routine', title: 'Pickup Routine', icon: '🚌', zone: 'Return Route',
    description: 'Regroup after school and make the ride home count.', days: SCHOOL_DAYS, reminderTime: '15:20', order: 4,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('car', 'Get into car'),
      objective('door', 'Close door completely'),
      objective('seatbelt', 'Seatbelt'),
      objective('school-story', 'Tell mom/dad what happened at school today'),
      objective('phone-free-home', 'BONUS: Make it home without looking at your phone', true)
    ]
  },
  {
    id: 'afternoon-routine', profileId, type: 'routine', title: 'Afternoon Routine', icon: '🏡', zone: 'Home Base',
    description: 'Reset the base before the evening begins.', days: SCHOOL_DAYS, reminderTime: '16:00', order: 5,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('animals', 'Feed/water animals'),
      objective('snack', 'Eat something'),
      objective('homework', 'Do homework'),
      objective('pack-lunch', 'Pack lunch for tomorrow'),
      objective('play-no-electronics', 'BONUS: 30 min play time with no electronics', true)
    ]
  },
  {
    id: 'dinner-routine', profileId, type: 'routine', title: 'Dinner Routine', icon: '🍲', zone: 'Great Hall',
    description: 'Food, conversation, and table skills. Tiny kingdom stuff.', days: EVERY_DAY, reminderTime: '18:15', order: 6,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('mouth-closed', 'Chew with mouth closed'),
      objective('sit-correctly', 'Sit in chair correctly'),
      objective('eat-full', 'Eat until full'),
      objective('good-thing', 'Tell someone one thing about your day that you enjoyed'),
      objective('no-reminders', 'BONUS: Chew with mouth closed and sit correctly without any reminders', true)
    ]
  },
  {
    id: 'evening-routine', profileId, type: 'routine', title: 'Evening Routine', icon: '🛠️', zone: 'Workshop',
    description: 'Wind down without turning into a glowing rectangle goblin.', days: EVERY_DAY, reminderTime: '19:30', order: 7,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('constructive', '30 min of constructive activity (read, draw, write, craft, etc...)'),
      objective('free-no-electronics', '30 min of free time (no electronics)'),
      objective('shower', 'Shower'),
      objective('towel', 'Hang up towel'),
      objective('hamper', 'Dirty clothes in hamper')
    ]
  },
  {
    id: 'bedtime-routine', profileId, type: 'routine', title: 'Bedtime Routine', icon: '🌙', zone: 'Moon Camp',
    description: 'Save the game and shut the system down properly.', days: EVERY_DAY, reminderTime: '20:30', order: 8,
    xp: XP.moderate, coins: COINS.moderate, active: true,
    objectives: [
      objective('brush-teeth', 'Brush teeth'),
      objective('goodnight', 'Say goodnight to family'),
      objective('alarm', 'Set alarm'),
      objective('bed', 'Get into bed')
    ]
  }
]

export const starterBonuses = (profileId = 'kid-1') => [
  ['read-chapter', 'Read a chapter', 'Any grade-level book counts.', '📚'],
  ['outside-30', 'Play outside for 30 min', 'Fresh air side quest.', '🌲'],
  ['help-dinner', 'Help mom/dad with dinner', 'Pitch in before the feast.', '🥕'],
  ['hold-door', 'Hold the door for someone', 'Tiny act. Real-world charisma point.', '🚪'],
  ['clean-up', 'Clean up after yourself', 'Leave the area better than you found it.', '🧹'],
  ['instrument', 'Play a musical instrument', 'Make some noise on purpose.', '🎸']
].map(([id,title,description,icon], i) => ({
  id, profileId, type: 'bonus', title, description, icon, xp: XP.minor, coins: COINS.minor,
  days: EVERY_DAY, active: true, order: 100 + i
}))

export const starterBosses = (profileId = 'kid-1') => [
  {
    id: 'five-day-gauntlet', profileId, type: 'boss', kind: 'routine-streak', title: 'The Five-Day Gauntlet', icon: '🐉',
    description: 'Complete every available routine for five school days in a row.', xp: 150, coins: 30, active: true, order: 1
  },
  {
    id: 'bonus-sweep', profileId, type: 'boss', kind: 'all-bonuses', title: 'Side Quest Sweep', icon: '👑',
    description: 'Complete every available Daily Bonus in one day.', xp: XP.major, coins: COINS.major, active: true, order: 2
  },
  {
    id: 'shorts-breaker', profileId, type: 'boss', kind: 'manual-daily', title: 'Breaker of the Scroll', icon: '⚡',
    description: 'Go a whole day without YouTube Shorts. Have a parent verify it at the end of the day.', xp: XP.major, coins: COINS.major, active: true, order: 3
  }
]

export const starterRewards = [
  { id: 'pick-dinner', title: 'Choose Dinner', description: 'Pick the family dinner one night.', cost: 120, icon: '🍕', active: true },
  { id: 'extra-game', title: '+30 Minutes Game Time', description: 'Cash this in for thirty extra minutes.', cost: 90, icon: '🎮', active: true },
  { id: 'movie-captain', title: 'Movie Captain', description: 'Choose the family movie.', cost: 75, icon: '🎬', active: true },
  { id: 'weekend-choice', title: 'Choose a Weekend Activity', description: 'Pick one reasonable family activity.', cost: 220, icon: '🗺️', active: true }
]

export function createDemoState() {
  const child = { id: 'kid-1', name: 'Adventurer', avatar: '🧙', xp: 0, coins: 0, createdAt: Date.now() }
  return {
    schemaVersion: 2,
    family: { id: 'demo-family', code: 'DEMO42', name: 'Demo Guild', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago' },
    profiles: [child],
    quests: [...starterRoutines(child.id), ...starterBonuses(child.id), ...starterBosses(child.id)],
    progress: [],
    rewards: starterRewards,
    redemptions: [],
    activity: [{ id: 'a1', profileId: child.id, type: 'note', text: 'Questbound initialized. The map is yours.', at: Date.now() }]
  }
}

export function migrateDemoState(raw) {
  if (!raw || raw.schemaVersion !== 2 || !Array.isArray(raw.progress)) return createDemoState()
  return raw
}

export function xpNeededForLevel(level = 1) {
  const n = Math.max(1, Number(level || 1)) - 1
  // Every level costs more than the last: 100, 135, 190, 265, 360, 475...
  return 100 + (25 * n) + (10 * n * n)
}

export function levelFromXp(xp = 0) {
  let level = 1
  let remaining = Math.max(0, Number(xp || 0))
  let need = xpNeededForLevel(level)
  while (remaining >= need) {
    remaining -= need
    level += 1
    need = xpNeededForLevel(level)
  }
  return { level, current: remaining, need, progress: need ? remaining / need : 0 }
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dateFromDayKey(key) {
  const [y,m,d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export function isScheduledToday(item, date = new Date()) {
  if (!item?.active) return false
  if (!item.days) return true
  return item.days.includes(date.getDay())
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function progressFor(data, profileId, key = dayKey()) {
  return data.progress?.find(p => p.profileId === profileId && p.dayKey === key) || {
    id: `${profileId}_${key}`, profileId, dayKey: key, objectives: {}, bonuses: {}, routines: {}, bosses: {}
  }
}

export function requiredObjectives(routine) {
  return (routine.objectives || []).filter(o => !o.bonus)
}

export function routineIsComplete(routine, progress) {
  const done = progress.objectives?.[routine.id] || []
  return requiredObjectives(routine).every(o => done.includes(o.id))
}

export function schoolDayKeysEndingToday(count = 5, from = new Date()) {
  const out = []
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12)
  while (out.length < count) {
    if (SCHOOL_DAYS.includes(d.getDay())) out.unshift(dayKey(d))
    d.setDate(d.getDate() - 1)
  }
  return out
}
