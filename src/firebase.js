import { initializeApp } from 'firebase/app'
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser
} from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs,
  setDoc, deleteDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  writeBatch, runTransaction, increment
} from 'firebase/firestore'
import { firebaseConfig as fileConfig } from './firebase-config.js'
import {
  starterRoutines, starterBonuses, starterBosses, starterRewards,
  dayKey, dateFromDayKey, isScheduledToday, requiredObjectives,
  schoolDayKeysEndingToday, XP
} from './data.js'

const cfg = {
  apiKey: fileConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: fileConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: fileConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: fileConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: fileConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: fileConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID
}

export const cloudEnabled = Boolean(cfg.apiKey && cfg.projectId && cfg.appId)
let app, auth, db
if (cloudEnabled) {
  app = initializeApp(cfg)
  auth = getAuth(app)
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
}

function friendlyAuthError(error) {
  const code = error?.code || ''
  if (code.includes('email-already-in-use')) return new Error('That email already has a Questbound save. Sign in instead.')
  if (code.includes('invalid-email')) return new Error('Enter a valid email address.')
  if (code.includes('weak-password')) return new Error('Use a password with at least 6 characters.')
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return new Error('Email or password is incorrect.')
  if (code.includes('too-many-requests')) return new Error('Too many sign-in attempts. Wait a bit and try again.')
  return error instanceof Error ? error : new Error('Firebase sign-in failed.')
}

function cleanEmail(value) { return String(value || '').trim().toLowerCase() }
function cleanName(value, fallback) { return String(value || '').trim().slice(0, 80) || fallback }

function bytesToBase64(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
function base64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}
function bytesToHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') }

async function derivePinHash(pin, saltBase64 = null) {
  const clean = String(pin || '').replace(/\D/g, '')
  if (!/^\d{4,8}$/.test(clean)) throw new Error('Parent PIN must be 4–8 digits.')
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16))
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(clean), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, material, 256)
  return { salt: bytesToBase64(salt), hash: bytesToHex(new Uint8Array(bits)) }
}

export async function ensureAuth() {
  if (!cloudEnabled) return null
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (user) => { off(); resolve(user || null) })
  })
}

export async function createFamily(payload) {
  if (!cloudEnabled) throw new Error('Firebase is not configured.')
  const email = cleanEmail(payload?.email)
  const password = String(payload?.password || '')
  if (!email) throw new Error('Enter an email address.')
  if (password.length < 6) throw new Error('Password must be at least 6 characters.')
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const familyId = credential.user.uid
    const profileId = 'kid-1'
    const secret = await derivePinHash(payload?.parentPin)
    const familyName = cleanName(payload?.familyName, 'Our Guild')
    const childName = cleanName(payload?.childName, 'Adventurer')
    const timeZone = cleanName(payload?.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago')
    const batch = writeBatch(db)

    batch.set(doc(db, 'families', familyId), {
      name: familyName,
      email,
      timeZone,
      schemaVersion: 4,
      parentPinSalt: secret.salt,
      parentPinHash: secret.hash,
      createdAt: serverTimestamp()
    })
    batch.set(doc(db, 'families', familyId, 'profiles', profileId), {
      name: childName,
      avatar: '🧙',
      xp: 0,
      coins: 0,
      createdAt: serverTimestamp()
    })
    for (const q of [...starterRoutines(profileId), ...starterBonuses(profileId), ...starterBosses(profileId)]) {
      const { id, ...body } = q
      batch.set(doc(db, 'families', familyId, 'quests', id), { ...body, createdAt: serverTimestamp() })
    }
    for (const r of starterRewards) {
      const { id, ...body } = r
      batch.set(doc(db, 'families', familyId, 'rewards', id), { ...body, createdAt: serverTimestamp() })
    }
    const activityRef = doc(collection(db, 'families', familyId, 'activity'))
    batch.set(activityRef, { profileId, type: 'note', text: 'Questbound initialized. The map is yours.', at: serverTimestamp() })
    try {
      await batch.commit()
    } catch (error) {
      try { await deleteUser(credential.user) } catch {}
      throw error
    }
    return { familyId, role: 'kid', profileId, email }
  } catch (error) {
    throw friendlyAuthError(error)
  }
}

export async function joinFamily(payload) {
  if (!cloudEnabled) throw new Error('Firebase is not configured.')
  const email = cleanEmail(payload?.email)
  const password = String(payload?.password || '')
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const familyId = credential.user.uid
    const profiles = await getDocs(collection(db, 'families', familyId, 'profiles'))
    const profile = profiles.docs[0]
    if (!profile) throw new Error('This Questbound account does not have a child profile yet.')
    return { familyId, role: 'kid', profileId: profile.id, email }
  } catch (error) {
    throw friendlyAuthError(error)
  }
}

export async function signOutFamily() {
  if (cloudEnabled) await signOut(auth)
}

export async function verifyParentPin(familyId, pin) {
  const user = await ensureAuth()
  if (!user || user.uid !== familyId) return false
  const snap = await getDoc(doc(db, 'families', familyId))
  if (!snap.exists()) return false
  const family = snap.data()
  if (!family.parentPinSalt || !family.parentPinHash) return false
  const attempt = await derivePinHash(pin, family.parentPinSalt)
  return attempt.hash === family.parentPinHash
}

export async function unlockParentCloud({ familyId, pin }) {
  if (!(await verifyParentPin(familyId, pin))) throw new Error('Incorrect parent PIN.')
  return { ok: true }
}
export async function lockParentCloud() { return { ok: true } }

export function subscribeFamily(session, onData, onError) {
  let cancelled = false
  const offs = []
  const stop = () => { cancelled = true; offs.splice(0).forEach(off => off()) }
  ensureAuth().then((user) => {
    if (cancelled) return
    if (!user || user.uid !== session.familyId) {
      onError(new Error('Your Questbound sign-in expired. Sign in again.'))
      return
    }
    const familyId = session.familyId
    const state = { family: null, profiles: [], quests: [], progress: [], rewards: [], redemptions: [], activity: [] }
    const emit = () => onData({ ...state })
    const watchDoc = (ref, key) => offs.push(onSnapshot(ref, snap => {
      if (!snap.exists()) state[key] = null
      else {
        const value = { id: snap.id, ...snap.data() }
        if (key === 'family') { delete value.parentPinHash; delete value.parentPinSalt }
        state[key] = value
      }
      emit()
    }, onError))
    const watchCol = (ref, key, sorter = null) => offs.push(onSnapshot(sorter ? query(ref, sorter) : ref, snap => { state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit() }, onError))
    watchDoc(doc(db, 'families', familyId), 'family')
    watchCol(collection(db, 'families', familyId, 'profiles'), 'profiles')
    watchCol(collection(db, 'families', familyId, 'quests'), 'quests')
    watchCol(collection(db, 'families', familyId, 'progress'), 'progress')
    watchCol(collection(db, 'families', familyId, 'rewards'), 'rewards')
    watchCol(collection(db, 'families', familyId, 'redemptions'), 'redemptions')
    watchCol(collection(db, 'families', familyId, 'activity'), 'activity', orderBy('at', 'desc'))
  }).catch(onError)
  return stop
}

function blankProgress(profileId, key = dayKey()) {
  return { profileId, dayKey: key, objectives: {}, bonuses: {}, routines: {}, bosses: {}, selfCorrections: 0 }
}

async function addActivity(familyId, profileId, type, text) {
  await addDoc(collection(db, 'families', familyId, 'activity'), { profileId, type, text, at: serverTimestamp() })
}

async function awardBossOnceCloud(familyId, profileId, boss, key = dayKey()) {
  const progressRef = doc(db, 'families', familyId, 'progress', `${profileId}_${key}`)
  const profileRef = doc(db, 'families', familyId, 'profiles', profileId)
  let event = null
  await runTransaction(db, async tx => {
    const [pSnap, profileSnap] = await Promise.all([tx.get(progressRef), tx.get(profileRef)])
    if (!profileSnap.exists()) throw new Error('Profile not found.')
    const p = pSnap.exists() ? pSnap.data() : blankProgress(profileId, key)
    p.bosses = p.bosses || {}
    if (p.bosses[boss.id]) return
    const xp = Number(boss.xp || 0), coins = Number(boss.coins || 0)
    p.bosses[boss.id] = { at: Date.now() }
    tx.set(progressRef, { ...p, updatedAt: serverTimestamp() }, { merge: true })
    tx.update(profileRef, { xp: increment(xp), coins: increment(coins) })
    event = { title: boss.title, icon: boss.icon, xp, coins }
  })
  if (event) await addActivity(familyId, profileId, 'boss', `${event.title} defeated · +${event.xp} XP`)
  return event
}

async function evaluateAutoBosses(familyId, profileId) {
  const questSnap = await getDocs(collection(db, 'families', familyId, 'quests'))
  const quests = questSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => q.profileId === profileId)
  const bosses = quests.filter(q => q.type === 'boss' && q.active !== false)
  const today = dayKey()
  const progressSnap = await getDoc(doc(db, 'families', familyId, 'progress', `${profileId}_${today}`))
  const progress = progressSnap.exists() ? progressSnap.data() : blankProgress(profileId, today)
  const awarded = []

  const sweep = bosses.find(b => b.kind === 'all-bonuses')
  if (sweep) {
    const bonuses = quests.filter(q => q.type === 'bonus' && isScheduledToday(q))
    if (bonuses.length && bonuses.every(b => progress.bonuses?.[b.id])) {
      const event = await awardBossOnceCloud(familyId, profileId, sweep, today)
      if (event) awarded.push(event)
    }
  }

  const streak = bosses.find(b => b.kind === 'routine-streak')
  if (streak && [1,2,3,4,5].includes(new Date().getDay())) {
    const keys = schoolDayKeysEndingToday(5, new Date())
    let complete = true
    for (const key of keys) {
      const pSnap = await getDoc(doc(db, 'families', familyId, 'progress', `${profileId}_${key}`))
      const p = pSnap.exists() ? pSnap.data() : blankProgress(profileId, key)
      const date = dateFromDayKey(key)
      const routines = quests.filter(q => q.type === 'routine' && isScheduledToday(q, date))
      if (!routines.length || !routines.every(r => p.routines?.[r.id])) { complete = false; break }
    }
    if (complete) {
      const event = await awardBossOnceCloud(familyId, profileId, streak, today)
      if (event) awarded.push(event)
    }
  }
  return awarded
}

export async function completeObjectiveCloud({ familyId, profileId, routineId, objectiveId }) {
  await ensureAuth()
  const key = dayKey()
  const progressRef = doc(db, 'families', familyId, 'progress', `${profileId}_${key}`)
  const routineRef = doc(db, 'families', familyId, 'quests', routineId)
  const profileRef = doc(db, 'families', familyId, 'profiles', profileId)
  let objectiveEvent = null, routineEvent = null

  await runTransaction(db, async tx => {
    const [pSnap, rSnap, profileSnap] = await Promise.all([tx.get(progressRef), tx.get(routineRef), tx.get(profileRef)])
    if (!rSnap.exists() || !profileSnap.exists()) throw new Error('Routine or profile not found.')
    const routine = rSnap.data()
    const obj = (routine.objectives || []).find(o => o.id === objectiveId)
    if (!obj) throw new Error('Objective not found.')
    const p = pSnap.exists() ? pSnap.data() : blankProgress(profileId, key)
    p.objectives = p.objectives || {}; p.routines = p.routines || {}; p.bonuses = p.bonuses || {}; p.bosses = p.bosses || {}
    const ids = p.objectives[routineId] || []
    if (ids.includes(objectiveId)) return
    p.objectives[routineId] = [...ids, objectiveId]
    const oxp = Number(obj.xp || 0), ocoins = Number(obj.coins || 0)
    let totalXp = oxp, totalCoins = ocoins
    objectiveEvent = { title: obj.title, xp: oxp, coins: ocoins, type: obj.bonus ? 'routine-bonus' : 'objective' }

    if (!p.routines[routineId]) {
      const required = requiredObjectives(routine)
      if (required.every(o => p.objectives[routineId].includes(o.id))) {
        p.routines[routineId] = { at: Date.now() }
        const rxp = Number(routine.xp || 0), rcoins = Number(routine.coins || 0)
        totalXp += rxp; totalCoins += rcoins
        routineEvent = { title: routine.title, icon: routine.icon, xp: rxp, coins: rcoins }
      }
    }
    tx.set(progressRef, { ...p, updatedAt: serverTimestamp() }, { merge: true })
    tx.update(profileRef, { xp: increment(totalXp), coins: increment(totalCoins) })
  })

  if (objectiveEvent) await addActivity(familyId, profileId, objectiveEvent.type, `${objectiveEvent.title} · +${objectiveEvent.xp} XP`)
  if (routineEvent) await addActivity(familyId, profileId, 'routine', `${routineEvent.title} cleared · +${routineEvent.xp} XP`)
  const bosses = await evaluateAutoBosses(familyId, profileId)
  return { ok: true, routine: routineEvent, boss: bosses[0] || null }
}

export async function completeBonusCloud({ familyId, profileId, bonusId }) {
  await ensureAuth()
  const key = dayKey()
  const progressRef = doc(db, 'families', familyId, 'progress', `${profileId}_${key}`)
  const bonusRef = doc(db, 'families', familyId, 'quests', bonusId)
  const profileRef = doc(db, 'families', familyId, 'profiles', profileId)
  let event = null
  await runTransaction(db, async tx => {
    const [pSnap, bSnap, profileSnap] = await Promise.all([tx.get(progressRef), tx.get(bonusRef), tx.get(profileRef)])
    if (!bSnap.exists() || !profileSnap.exists()) throw new Error('Bonus or profile not found.')
    const bonus = bSnap.data()
    const p = pSnap.exists() ? pSnap.data() : blankProgress(profileId, key)
    p.bonuses = p.bonuses || {}; p.objectives = p.objectives || {}; p.routines = p.routines || {}; p.bosses = p.bosses || {}
    if (p.bonuses[bonusId]) return
    p.bonuses[bonusId] = { at: Date.now() }
    const xp = Number(bonus.xp || 0), coins = Number(bonus.coins || 0)
    tx.set(progressRef, { ...p, updatedAt: serverTimestamp() }, { merge: true })
    tx.update(profileRef, { xp: increment(xp), coins: increment(coins) })
    event = { title: bonus.title, xp, coins }
  })
  if (event) await addActivity(familyId, profileId, 'bonus', `${event.title} · +${event.xp} XP`)
  const bosses = await evaluateAutoBosses(familyId, profileId)
  return { ok: true, boss: bosses[0] || null }
}

export async function claimBossCloud({ familyId, profileId, bossId, parentPin }) {
  if (!(await verifyParentPin(familyId, parentPin))) throw new Error('Incorrect parent PIN.')
  const bossSnap = await getDoc(doc(db, 'families', familyId, 'quests', bossId))
  if (!bossSnap.exists()) throw new Error('Boss not found.')
  const boss = { id: bossSnap.id, ...bossSnap.data() }
  if (boss.type !== 'boss' || boss.kind !== 'manual-daily' || boss.profileId !== profileId) throw new Error('This boss cannot be manually claimed.')
  const event = await awardBossOnceCloud(familyId, profileId, boss)
  return { ok: true, boss: event }
}

export async function selfCorrectionCloud({ familyId, profileId, kind, parentPin }) {
  if (!(await verifyParentPin(familyId, parentPin))) throw new Error('Incorrect parent PIN.')
  const key = dayKey()
  const progressRef = doc(db, 'families', familyId, 'progress', `${profileId}_${key}`)
  const profileRef = doc(db, 'families', familyId, 'profiles', profileId)
  await runTransaction(db, async tx => {
    const [pSnap, profileSnap] = await Promise.all([tx.get(progressRef), tx.get(profileRef)])
    if (!profileSnap.exists()) throw new Error('Profile not found.')
    const p = pSnap.exists() ? pSnap.data() : blankProgress(profileId, key)
    const count = Number(p.selfCorrections || 0)
    if (count >= 5) throw new Error('Daily Caught It bonus cap reached.')
    p.selfCorrections = count + 1
    tx.set(progressRef, { ...p, updatedAt: serverTimestamp() }, { merge: true })
    tx.update(profileRef, { xp: increment(XP.minor), coins: increment(1) })
  })
  await addActivity(familyId, profileId, 'self-correction', `Caught It: ${String(kind || 'Self-correction').slice(0, 100)} · +${XP.minor} XP`)
  return { ok: true }
}

export async function redeemRewardCloud({ familyId, profileId, rewardId }) {
  const rewardRef = doc(db, 'families', familyId, 'rewards', rewardId)
  const profileRef = doc(db, 'families', familyId, 'profiles', profileId)
  const redemptionRef = doc(collection(db, 'families', familyId, 'redemptions'))
  let title = '', cost = 0
  await runTransaction(db, async tx => {
    const [rewardSnap, profileSnap] = await Promise.all([tx.get(rewardRef), tx.get(profileRef)])
    if (!rewardSnap.exists() || !profileSnap.exists()) throw new Error('Reward or profile not found.')
    const reward = rewardSnap.data(); const profile = profileSnap.data()
    title = reward.title; cost = Number(reward.cost || 0)
    if (Number(profile.coins || 0) < cost) throw new Error('Not enough coins.')
    tx.update(profileRef, { coins: increment(-cost) })
    tx.set(redemptionRef, { profileId, rewardId, rewardTitle: title, cost, status: 'pending', at: serverTimestamp() })
  })
  await addActivity(familyId, profileId, 'reward', `${title} requested for ${cost} coins`)
  return { ok: true, redemptionId: redemptionRef.id }
}

export async function resolveRedemptionCloud({ familyId, redemptionId, decision }) {
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Invalid reward decision.')
  const redRef = doc(db, 'families', familyId, 'redemptions', redemptionId)
  let activity = null
  await runTransaction(db, async tx => {
    const redSnap = await tx.get(redRef)
    if (!redSnap.exists()) throw new Error('Reward request not found.')
    const red = redSnap.data()
    if (red.status !== 'pending') return
    tx.update(redRef, { status: decision, resolvedAt: serverTimestamp() })
    if (decision === 'rejected') tx.update(doc(db, 'families', familyId, 'profiles', red.profileId), { coins: increment(Number(red.cost || 0)) })
    activity = { profileId: red.profileId, text: `${red.rewardTitle} ${decision}` }
  })
  if (activity) await addActivity(familyId, activity.profileId, 'reward', activity.text)
  return { ok: true }
}

export async function saveQuestCloud(familyId, quest) {
  const ref = quest.id ? doc(db, 'families', familyId, 'quests', quest.id) : doc(collection(db, 'families', familyId, 'quests'))
  const { id, ...body } = quest
  await setDoc(ref, { ...body, updatedAt: serverTimestamp() }, { merge: true })
  return ref.id
}
export async function deleteQuestCloud(familyId, questId) { await deleteDoc(doc(db, 'families', familyId, 'quests', questId)) }

export async function saveRewardCloud(familyId, reward) {
  const ref = reward.id ? doc(db, 'families', familyId, 'rewards', reward.id) : doc(collection(db, 'families', familyId, 'rewards'))
  const { id, ...body } = reward
  await setDoc(ref, { ...body, updatedAt: serverTimestamp() }, { merge: true })
  return ref.id
}
export async function deleteRewardCloud(familyId, rewardId) { await deleteDoc(doc(db, 'families', familyId, 'rewards', rewardId)) }

export async function enablePush() {
  if (!('Notification' in window)) throw new Error('This browser does not support notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  return true
}
