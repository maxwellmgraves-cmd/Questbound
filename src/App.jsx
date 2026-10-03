import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  cloudEnabled, createFamily, joinFamily, signOutFamily, subscribeFamily, unlockParentCloud, lockParentCloud,
  completeObjectiveCloud, completeBonusCloud, claimBossCloud, selfCorrectionCloud,
  redeemRewardCloud, resolveRedemptionCloud, saveQuestCloud, deleteQuestCloud,
  saveRewardCloud, deleteRewardCloud, enablePush
} from './firebase.js'
import {
  DAY_NAMES, EVERY_DAY, SCHOOL_DAYS, createDemoState, migrateDemoState, dayKey,
  dateFromDayKey, isScheduledToday, levelFromXp, progressFor, requiredObjectives,
  routineIsComplete, schoolDayKeysEndingToday, uid, XP, COINS
} from './data.js'

const SESSION_KEY = 'questbound.session.v2'
const DEMO_KEY = 'questbound.demo.v2'
const OLD_DEMO_KEY = 'questbound.demo.v1'
const DEMO_PARENT_PIN = '1234'

function ms(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value?.toMillis) return value.toMillis()
  if (value?.seconds) return value.seconds * 1000
  return Date.parse(value) || 0
}

function loadDemo() {
  try {
    const current = JSON.parse(localStorage.getItem(DEMO_KEY))
    if (current) return migrateDemoState(current)
    if (localStorage.getItem(OLD_DEMO_KEY)) localStorage.removeItem(OLD_DEMO_KEY)
  } catch {}
  return createDemoState()
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null }
  catch { return null }
}
function clone(value) { return JSON.parse(JSON.stringify(value)) }

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [role, setRole] = useState(() => cloudEnabled ? (loadSession() ? 'kid' : null) : 'kid')
  const [data, setData] = useState(() => cloudEnabled ? null : loadDemo())
  const [loading, setLoading] = useState(cloudEnabled && Boolean(loadSession()))
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const reminderSeen = useRef(new Set())

  useEffect(() => {
    if (!cloudEnabled && data) localStorage.setItem(DEMO_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!cloudEnabled || !session) return
    setLoading(true)
    const off = subscribeFamily(session, (next) => {
      setData(next)
      setLoading(false)
    }, (e) => { setError(e.message); setLoading(false) })
    return off
  }, [session])

  useEffect(() => {
    if (!data || role !== 'kid') return
    const tick = () => {
      const profileId = session?.profileId || data.profiles[0]?.id
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const todayProgress = progressFor(data, profileId, dayKey(now))
      data.quests
        .filter(q => q.profileId === profileId && q.type === 'routine' && isScheduledToday(q, now) && q.reminderTime === hhmm && !todayProgress.routines?.[q.id])
        .forEach(q => {
          const key = `${dayKey(now)}:${q.id}:${hhmm}`
          if (reminderSeen.current.has(key)) return
          reminderSeen.current.add(key)
          showToast(`🔔 ${q.title} is waiting`, 'reminder')
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Questbound: ${q.title}`, { body: q.description || 'A routine is waiting.', icon: `${import.meta.env.BASE_URL}icon-192.png` })
          }
        })
    }
    tick()
    const timer = setInterval(tick, 30000)
    return () => clearInterval(timer)
  }, [data, role, session])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2300)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(() => setCelebration(null), celebration.type === 'boss' ? 4200 : 2800)
    return () => clearTimeout(t)
  }, [celebration])

  function showToast(text, kind = 'success') { setToast({ text, kind, key: Date.now() }) }
  function updateSession(next) {
    setSession(next)
    setRole(next ? 'kid' : null)
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    else localStorage.removeItem(SESSION_KEY)
  }

  async function signOutQuestbound() {
    try { if (cloudEnabled) await signOutFamily() } catch {}
    updateSession(null)
    setData(null)
  }


  async function enterParentControls(pin) {
    const clean = String(pin || '').replace(/\D/g, '')
    if (!/^\d{4,8}$/.test(clean)) throw new Error('Enter the 4–8 digit parent PIN.')
    if (cloudEnabled) {
      await unlockParentCloud({ familyId: session.familyId, pin: clean })
    } else if (clean !== DEMO_PARENT_PIN) {
      throw new Error('Incorrect parent PIN. Local demo PIN is 1234.')
    }
    setRole('parent')
    showToast('🔓 Parent controls unlocked.')
  }

  async function exitParentControls() {
    try {
      if (cloudEnabled && session?.role !== 'parent') await lockParentCloud({ familyId: session.familyId })
    } catch {}
    setRole(session?.role === 'parent' ? 'parent' : 'kid')
  }

  function updateLocalProgress(profileId, updater) {
    setData(prev => {
      const next = clone(prev)
      const key = dayKey()
      let progress = next.progress.find(p => p.profileId === profileId && p.dayKey === key)
      if (!progress) {
        progress = { id: `${profileId}_${key}`, profileId, dayKey: key, objectives: {}, bonuses: {}, routines: {}, bosses: {} }
        next.progress.push(progress)
      }
      updater(next, progress)
      return next
    })
  }

  function award(next, profileId, xp, coins, text, type) {
    const profile = next.profiles.find(p => p.id === profileId)
    if (profile) { profile.xp = Number(profile.xp || 0) + xp; profile.coins = Number(profile.coins || 0) + coins }
    next.activity.unshift({ id: uid('a'), profileId, type, text, at: Date.now() })
  }

  function maybeAwardLocalBosses(next, profileId, todayProgress) {
    const bosses = next.quests.filter(q => q.profileId === profileId && q.type === 'boss' && q.active)
    const bonuses = next.quests.filter(q => q.profileId === profileId && q.type === 'bonus' && isScheduledToday(q))
    const sweep = bosses.find(b => b.kind === 'all-bonuses')
    if (sweep && !todayProgress.bosses?.[sweep.id] && bonuses.length && bonuses.every(b => todayProgress.bonuses?.[b.id])) {
      todayProgress.bosses[sweep.id] = { at: Date.now() }
      award(next, profileId, sweep.xp, sweep.coins, `${sweep.title} defeated · +${sweep.xp} XP`, 'boss')
      queueMicrotask(() => setCelebration({ type: 'boss', title: sweep.title, xp: sweep.xp, coins: sweep.coins, icon: sweep.icon }))
    }

    const streakBoss = bosses.find(b => b.kind === 'routine-streak')
    const now = new Date()
    if (!streakBoss || !SCHOOL_DAYS.includes(now.getDay())) return
    const keys = schoolDayKeysEndingToday(5, now)
    const complete = keys.every(key => {
      const p = progressFor(next, profileId, key)
      const date = dateFromDayKey(key)
      const routines = next.quests.filter(q => q.profileId === profileId && q.type === 'routine' && isScheduledToday(q, date))
      return routines.length > 0 && routines.every(r => p.routines?.[r.id])
    })
    const recentlyAwarded = keys.some(key => progressFor(next, profileId, key).bosses?.[streakBoss.id])
    if (complete && !recentlyAwarded) {
      todayProgress.bosses[streakBoss.id] = { at: Date.now() }
      award(next, profileId, streakBoss.xp, streakBoss.coins, `${streakBoss.title} defeated · +${streakBoss.xp} XP`, 'boss')
      queueMicrotask(() => setCelebration({ type: 'boss', title: streakBoss.title, xp: streakBoss.xp, coins: streakBoss.coins, icon: streakBoss.icon }))
    }
  }

  async function completeObjective(routine, objective) {
    const profileId = session?.profileId || data.profiles[0].id
    const todayProgress = progressFor(data, profileId)
    if ((todayProgress.objectives?.[routine.id] || []).includes(objective.id)) return
    if (cloudEnabled) {
      const result = await completeObjectiveCloud({ familyId: session.familyId, profileId, routineId: routine.id, objectiveId: objective.id })
      if (result?.boss) setCelebration({ type: 'boss', ...result.boss })
      else if (result?.routine) setCelebration({ type: 'routine', ...result.routine })
    } else {
      updateLocalProgress(profileId, (next, p) => {
        p.objectives[routine.id] = [...(p.objectives[routine.id] || []), objective.id]
        award(next, profileId, objective.xp, objective.coins, `${objective.title} · +${objective.xp} XP`, objective.bonus ? 'routine-bonus' : 'objective')
        const updatedRoutine = next.quests.find(q => q.id === routine.id)
        if (!p.routines[routine.id] && routineIsComplete(updatedRoutine, p)) {
          p.routines[routine.id] = { at: Date.now() }
          award(next, profileId, routine.xp, routine.coins, `${routine.title} cleared · +${routine.xp} XP`, 'routine')
          queueMicrotask(() => setCelebration({ type: 'routine', title: routine.title, xp: routine.xp, coins: routine.coins, icon: routine.icon }))
        }
        maybeAwardLocalBosses(next, profileId, p)
      })
    }
    showToast(`${objective.bonus ? '🌟' : '✨'} +${objective.xp} XP · ${objective.title}`)
  }

  async function completeBonus(bonus) {
    const profileId = session?.profileId || data.profiles[0].id
    const p = progressFor(data, profileId)
    if (p.bonuses?.[bonus.id]) return
    if (cloudEnabled) {
      const result = await completeBonusCloud({ familyId: session.familyId, profileId, bonusId: bonus.id })
      if (result?.boss) setCelebration({ type: 'boss', ...result.boss })
    } else {
      updateLocalProgress(profileId, (next, progress) => {
        progress.bonuses[bonus.id] = { at: Date.now() }
        award(next, profileId, bonus.xp, bonus.coins, `${bonus.title} · +${bonus.xp} XP`, 'bonus')
        maybeAwardLocalBosses(next, profileId, progress)
      })
    }
    showToast(`⭐ Side quest complete · +${bonus.xp} XP`)
  }

  async function claimBoss(boss, parentPin) {
    const profileId = session?.profileId || data.profiles[0].id
    const p = progressFor(data, profileId)
    if (p.bosses?.[boss.id]) return
    if (boss.kind !== 'manual-daily') return
    if (cloudEnabled) {
      const result = await claimBossCloud({ familyId: session.familyId, profileId, bossId: boss.id, parentPin })
      if (result?.boss) setCelebration({ type: 'boss', ...result.boss })
    } else {
      if (String(parentPin || '') !== DEMO_PARENT_PIN) throw new Error('Incorrect parent PIN. Local demo PIN is 1234.')
      updateLocalProgress(profileId, (next, progress) => {
        progress.bosses[boss.id] = { at: Date.now(), approvedByParent: true }
        award(next, profileId, boss.xp, boss.coins, `${boss.title} defeated · +${boss.xp} XP`, 'boss')
      })
      setCelebration({ type: 'boss', title: boss.title, xp: boss.xp, coins: boss.coins, icon: boss.icon })
    }
  }

  async function selfCorrection(kind, parentPin) {
    const profileId = session?.profileId || data.profiles[0].id
    if (cloudEnabled) await selfCorrectionCloud({ familyId: session.familyId, profileId, kind, parentPin })
    else {
      if (String(parentPin || '') !== DEMO_PARENT_PIN) throw new Error('Incorrect parent PIN. Local demo PIN is 1234.')
      const todayCount = data.activity.filter(a => a.profileId === profileId && a.type === 'self-correction' && dayKey(new Date(ms(a.at))) === dayKey()).length
      if (todayCount >= 5) { showToast('Daily Caught It cap reached.', 'reminder'); return }
      setData(prev => {
        const next = clone(prev)
        award(next, profileId, XP.minor, 1, `Caught It: ${kind} · +${XP.minor} XP`, 'self-correction')
        return next
      })
    }
    showToast(`✨ Caught It! +${XP.minor} XP`)
  }

  async function redeem(reward) {
    const profileId = session?.profileId || data.profiles[0].id
    const profile = data.profiles.find(p => p.id === profileId)
    if (profile.coins < reward.cost) { showToast('Not enough coins yet.', 'reminder'); return }
    if (cloudEnabled) await redeemRewardCloud({ familyId: session.familyId, profileId, rewardId: reward.id })
    else {
      setData(prev => {
        const next = clone(prev)
        const p = next.profiles.find(x => x.id === profileId)
        p.coins -= reward.cost
        next.redemptions.unshift({ id: uid('r'), profileId, rewardId: reward.id, rewardTitle: reward.title, cost: reward.cost, status: 'pending', at: Date.now() })
        next.activity.unshift({ id: uid('a'), profileId, type: 'reward', text: `${reward.title} requested for ${reward.cost} coins`, at: Date.now() })
        return next
      })
    }
    showToast('🪙 Reward request sent.')
  }

  async function resolveRedemption(redemption, decision) {
    if (cloudEnabled) await resolveRedemptionCloud({ familyId: session.familyId, redemptionId: redemption.id, decision })
    else {
      setData(prev => {
        const next = clone(prev)
        const r = next.redemptions.find(x => x.id === redemption.id)
        if (!r || r.status !== 'pending') return prev
        r.status = decision
        if (decision === 'rejected') next.profiles.find(p => p.id === r.profileId).coins += r.cost
        next.activity.unshift({ id: uid('a'), profileId: r.profileId, type: 'reward', text: `${r.rewardTitle} ${decision}`, at: Date.now() })
        return next
      })
    }
  }

  async function saveQuest(quest) {
    const profileId = quest.profileId || data.profiles[0].id
    const normalized = normalizeQuest({ ...quest, profileId })
    if (cloudEnabled) await saveQuestCloud(session.familyId, normalized)
    else setData(prev => ({ ...prev, quests: normalized.id ? prev.quests.map(q => q.id === normalized.id ? normalized : q) : [...prev.quests, { ...normalized, id: uid('q') }] }))
    showToast('Quest saved.')
  }
  async function removeQuest(quest) {
    if (!confirm(`Delete “${quest.title}”?`)) return
    if (cloudEnabled) await deleteQuestCloud(session.familyId, quest.id)
    else setData(prev => ({ ...prev, quests: prev.quests.filter(q => q.id !== quest.id) }))
  }
  async function saveReward(reward) {
    const normalized = { ...reward, cost: Number(reward.cost), active: Boolean(reward.active) }
    if (cloudEnabled) await saveRewardCloud(session.familyId, normalized)
    else setData(prev => ({ ...prev, rewards: normalized.id ? prev.rewards.map(r => r.id === normalized.id ? normalized : r) : [...prev.rewards, { ...normalized, id: uid('rw') }] }))
    showToast('Reward saved.')
  }
  async function removeReward(reward) {
    if (!confirm(`Delete “${reward.title}”?`)) return
    if (cloudEnabled) await deleteRewardCloud(session.familyId, reward.id)
    else setData(prev => ({ ...prev, rewards: prev.rewards.filter(r => r.id !== reward.id) }))
  }
  async function requestNotifications() {
    try {
      if (!('Notification' in window)) throw new Error('This browser does not support notifications.')
      if (cloudEnabled) await enablePush(session)
      else if (await Notification.requestPermission() !== 'granted') throw new Error('Notification permission was not granted.')
      showToast('🔔 Reminders enabled.')
    } catch (e) { setError(e.message) }
  }

  if (cloudEnabled && !session) return <Onboarding onSession={updateSession} onError={setError} error={error} />
  if (loading || !data) return <Loading />

  const effectiveSession = session || { familyId: data.family.id, role, profileId: data.profiles[0]?.id }
  return (
    <div className={`app-shell ${role === 'parent' ? 'parent-theme' : 'kid-theme'}`}>
      {toast && <Toast toast={toast} />}
      {celebration && <Celebration event={celebration} onClose={() => setCelebration(null)} />}
      {error && <div className="error-banner" onClick={() => setError('')}>{error}<span>×</span></div>}
      {!cloudEnabled && <DemoBar />}
      {role === 'kid'
        ? <KidApp data={data} session={effectiveSession} cloudEnabled={cloudEnabled} onObjective={completeObjective} onBonus={completeBonus} onBoss={claimBoss} onSelfCorrection={selfCorrection} onRedeem={redeem} onNotify={requestNotifications} onParentControls={enterParentControls} />
        : <ParentApp data={data} session={effectiveSession} onSaveQuest={saveQuest} onDeleteQuest={removeQuest} onSaveReward={saveReward} onDeleteReward={removeReward} onResolve={resolveRedemption} onNotify={requestNotifications} onSignOut={cloudEnabled ? signOutQuestbound : null} onExitParent={exitParentControls} />}
    </div>
  )
}

function normalizeQuest(q) {
  const out = { ...q, active: Boolean(q.active), order: Number(q.order || 999), xp: Number(q.xp || 0), coins: Number(q.coins || 0) }
  if (out.type === 'routine') {
    out.days = out.days || EVERY_DAY
    out.objectives = (out.objectives || []).map((o, i) => ({ id: o.id || uid(`obj${i}`), title: o.title, bonus: Boolean(o.bonus), xp: Number(o.xp ?? (o.bonus ? XP.moderate : XP.minor)), coins: Number(o.coins ?? (o.bonus ? COINS.moderate : COINS.minor)) }))
  }
  if (out.type === 'bonus') out.days = out.days || EVERY_DAY
  return out
}

function DemoBar() {
  return <div className="demo-bar"><span>LOCAL DEMO · add Firebase config for free cross-device sync</span></div>
}

function Onboarding({ onSession, onError, error }) {
  const [mode, setMode] = useState('signin')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ familyName: 'Our Guild', childName: '', parentPin: '', email: '', password: '' })
  const change = (k,v) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e) {
    e.preventDefault(); setBusy(true); onError('')
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'
      const result = mode === 'create'
        ? await createFamily({ familyName: form.familyName, childName: form.childName, parentPin: form.parentPin, email: form.email, password: form.password, timeZone: tz })
        : await joinFamily({ email: form.email, password: form.password })
      onSession(result)
    } catch (e) { onError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="onboarding"><div className="onboard-emblem">⚔️</div><span className="eyebrow">A LIFE RPG</span><h1>QUESTBOUND</h1><p className="lede">Build routines. Earn loot. Defeat the boring stuff.</p><div className="segmented"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign In</button><button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create Family Save</button></div><form className="onboard-card" onSubmit={submit}>{mode === 'create' && <><Field label="Family / guild name" value={form.familyName} onChange={v => change('familyName', v)} required/><Field label="Adventurer name" value={form.childName} onChange={v => change('childName', v)} required/><Field label="Parent PIN" value={form.parentPin} onChange={v => change('parentPin', v.replace(/\D/g,''))} type="password" inputMode="numeric" maxLength={8} required/><div className="form-divider">SHARED CLOUD SAVE</div></>}<Field label="Email" type="email" autoComplete="email" value={form.email} onChange={v => change('email', v)} required/><Field label="Password" type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={form.password} onChange={v => change('password', v)} minLength={6} required/>{mode === 'create' && <p className="form-note">Use this same email and password once on each family device. The app opens in Kid Mode; Parent Controls stay behind your separate PIN.</p>}{error && <div className="inline-error">{error}</div>}<button className="primary big" disabled={busy}>{busy ? 'Opening portal…' : mode === 'create' ? 'Create Shared Save' : 'Enter Questbound'}</button></form></div>
}
function Loading() { return <div className="loading"><div className="spinner"/><strong>Drawing the map…</strong></div> }

function KidApp({ data, session, cloudEnabled, onObjective, onBonus, onBoss, onSelfCorrection, onRedeem, onNotify, onParentControls }) {
  const [tab, setTab] = useState('quests')
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [parentUnlockOpen, setParentUnlockOpen] = useState(false)
  const [bossToApprove, setBossToApprove] = useState(null)
  const profile = data.profiles.find(p => p.id === session.profileId) || data.profiles[0]
  if (!profile) return <div className="empty-state">No kid profile is assigned to this device.</div>
  const lvl = levelFromXp(profile.xp)
  const progress = progressFor(data, profile.id)
  const routines = data.quests.filter(q => q.profileId === profile.id && q.type === 'routine' && isScheduledToday(q)).sort(sortOrder)
  const bonuses = data.quests.filter(q => q.profileId === profile.id && q.type === 'bonus' && isScheduledToday(q)).sort(sortOrder)
  const bosses = data.quests.filter(q => q.profileId === profile.id && q.type === 'boss' && q.active).sort(sortOrder)
  const doneRoutines = routines.filter(r => progress.routines?.[r.id]).length
  const totalRequired = routines.reduce((n,r) => n + requiredObjectives(r).length, 0)
  const doneRequired = routines.reduce((n,r) => n + requiredObjectives(r).filter(o => (progress.objectives?.[r.id] || []).includes(o.id)).length, 0)
  const selfCount = data.activity.filter(a => a.profileId === profile.id && a.type === 'self-correction' && dayKey(new Date(ms(a.at))) === dayKey()).length

  return <>
    <header className="kid-header">
      <div className="skyline"><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>
      <div className="kid-topline"><div className="avatar-frame"><div className="avatar">{profile.avatar || '🧙'}</div></div><div className="identity"><span>LEVEL {lvl.level} ADVENTURER</span><h1>{profile.name}</h1><p>{titleForLevel(lvl.level)}</p></div><button className="icon-button settings-gear" title="Settings" onClick={()=>setSettingsOpen(true)}>⚙️</button></div>
      <div className="xp-ribbon"><div className="xp-label"><b>XP</b><span>{lvl.current} / {lvl.need} to level {lvl.level + 1}</span></div><div className="xp-bar"><span style={{width: `${Math.max(2, lvl.progress*100)}%`}}/></div></div>
      <div className="resource-row"><div><strong>🪙 {profile.coins}</strong><span>Loot</span></div><div><strong>🗺️ {doneRoutines}/{routines.length}</strong><span>Routines</span></div><div><strong>⚔️ {doneRequired}/{totalRequired}</strong><span>Objectives</span></div></div>
    </header>

    <main className="kid-content">
      {tab === 'quests' && <>
        <SectionBanner icon="⭐" kicker="QUICK SIDE QUESTS" title="Daily Bonuses" subtitle="Grab a few easy wins before tackling the main trail." />
        <div className="bonus-grid">{bonuses.map(b => <BonusCard key={b.id} bonus={b} done={Boolean(progress.bonuses?.[b.id])} onComplete={() => onBonus(b)}/>)}</div>

        <button className="caught-button" disabled={selfCount >= 5} onClick={() => setCorrectionOpen(true)}><span className="caught-icon">✨</span><div><strong>Caught It!</strong><small>I noticed and fixed something myself · parent approval required</small></div><b>+{XP.minor} XP</b></button>

        <div className="map-title quest-title"><div><span className="eyebrow">TODAY'S MAIN QUEST</span><h2>Quest Trail</h2></div><div className="map-progress">{Math.round((doneRequired / Math.max(1,totalRequired))*100)}%</div></div>
        <div className="routine-stack">{routines.map((r,i) => <RoutineCard key={r.id} routine={r} progress={progress} index={i} onObjective={onObjective}/>)}</div>

        <SectionBanner icon="🐉" kicker="BOSS ARENA" title="Big Challenges" subtitle="Automatic bosses pop when the requirement is met. Manual bosses need a parent to verify the win." />
        <div className="boss-stack">{bosses.map(b => <BossCard key={b.id} boss={b} progress={progress} data={data} profileId={profile.id} onClaim={() => setBossToApprove(b)}/>)}</div>
      </>}
      {tab === 'rewards' && <RewardShop profile={profile} data={data} onRedeem={onRedeem}/>} 
      {tab === 'character' && <CharacterPanel profile={profile} data={data}/>} 
      {tab === 'log' && <ActivityLog activity={data.activity.filter(a => a.profileId === profile.id)}/>} 
    </main>

    <nav className="bottom-nav"><NavButton active={tab==='quests'} icon="🗺️" label="Adventure" onClick={()=>setTab('quests')}/><NavButton active={tab==='rewards'} icon="🎁" label="Loot" onClick={()=>setTab('rewards')}/><NavButton active={tab==='character'} icon="🧙" label="Hero" onClick={()=>setTab('character')}/><NavButton active={tab==='log'} icon="📜" label="Log" onClick={()=>setTab('log')}/></nav>

    {settingsOpen && <SettingsSheet cloudEnabled={cloudEnabled} onClose={()=>setSettingsOpen(false)} onNotify={onNotify} onParent={()=>{setSettingsOpen(false);setParentUnlockOpen(true)}} />}
    {parentUnlockOpen && <ParentPinSheet title="Unlock Parent Controls" text="Parent PIN required. This temporarily unlocks the command table on this device." action="Unlock" onClose={()=>setParentUnlockOpen(false)} onApprove={async pin=>{await onParentControls(pin);setParentUnlockOpen(false)}} />}
    {correctionOpen && <CorrectionSheet onClose={()=>setCorrectionOpen(false)} onApprove={async (kind,pin) => { await onSelfCorrection(kind,pin); setCorrectionOpen(false) }}/>} 
    {bossToApprove && <ParentPinSheet title={`Verify ${bossToApprove.title}`} text="A parent needs to confirm this boss was actually defeated before the XP is awarded." action="Defeat Boss" onClose={()=>setBossToApprove(null)} onApprove={async pin=>{await onBoss(bossToApprove,pin);setBossToApprove(null)}} icon={bossToApprove.icon || '🐉'} />}
  </>
}

function RoutineCard({ routine, progress, index, onObjective }) {
  const doneIds = progress.objectives?.[routine.id] || []
  const required = requiredObjectives(routine)
  const doneRequired = required.filter(o => doneIds.includes(o.id)).length
  const complete = Boolean(progress.routines?.[routine.id])
  const pct = Math.round(doneRequired / Math.max(1, required.length) * 100)
  return <article className={`routine-card ${complete ? 'cleared' : ''}`}>
    <div className="trail-node">{complete ? '✓' : index + 1}</div>
    <div className="routine-head"><div className="routine-emblem">{routine.icon}</div><div className="routine-copy"><span>{routine.zone || 'Quest Zone'}</span><h3>{routine.title}</h3><p>{routine.description}</p></div><div className="routine-score"><b>{doneRequired}/{required.length}</b><small>required</small></div></div>
    <div className="routine-meter"><span style={{width:`${pct}%`}}/></div>
    <div className="objective-list">{(routine.objectives || []).map(obj => {
      const done = doneIds.includes(obj.id)
      return <button key={obj.id} className={`objective ${obj.bonus ? 'bonus-objective' : ''} ${done ? 'done' : ''}`} disabled={done} onClick={() => onObjective(routine,obj)}><span className="objective-check">{done ? '✓' : obj.bonus ? '★' : ''}</span><span className="objective-text">{obj.bonus && <em>BONUS</em>}<b>{obj.title.replace(/^BONUS:\s*/i,'')}</b></span><span className="objective-xp">+{obj.xp} XP</span></button>
    })}</div>
    <div className={`routine-clear ${complete ? 'show' : ''}`}><span>ROUTINE CLEARED</span><b>+{routine.xp} XP</b></div>
  </article>
}

function BonusCard({ bonus, done, onComplete }) {
  return <button className={`bonus-card ${done ? 'done' : ''}`} disabled={done} onClick={onComplete}><span className="bonus-icon">{done ? '✓' : bonus.icon}</span><strong>{bonus.title}</strong><small>{bonus.description}</small><b>+{bonus.xp} XP</b></button>
}

function BossCard({ boss, progress, data, profileId, onClaim }) {
  const defeated = Boolean(progress.bosses?.[boss.id])
  let detail = ''
  const manual = boss.kind === 'manual-daily'
  const canClaim = manual && !defeated
  if (boss.kind === 'all-bonuses') {
    const all = data.quests.filter(q => q.profileId === profileId && q.type === 'bonus' && isScheduledToday(q))
    const done = all.filter(b => progress.bonuses?.[b.id]).length
    detail = `${done}/${all.length} side quests today · auto-completes`
  }
  if (boss.kind === 'routine-streak') detail = `${routineStreakCount(data, profileId)}/5 school days · auto-completes`
  if (manual) detail = 'Parent verification required'
  return <article className={`boss-card ${defeated ? 'defeated' : ''}`}><div className="boss-icon">{boss.icon}</div><div className="boss-copy"><span>{defeated ? 'DEFEATED' : manual ? 'PARENT-VERIFIED BOSS' : 'BOSS CHALLENGE'}</span><h3>{boss.title}</h3><p>{boss.description}</p><div className="boss-progress">{detail}</div></div><div className="boss-reward"><b>+{boss.xp}</b><span>XP</span>{canClaim && <button onClick={onClaim}>VERIFY</button>}{defeated && <i>✓</i>}</div></article>
}

function routineStreakCount(data, profileId) {
  let count = 0
  const d = new Date(); d.setHours(12,0,0,0)
  for (let guard=0; guard<14 && count<5; guard++) {
    if (SCHOOL_DAYS.includes(d.getDay())) {
      const p = progressFor(data, profileId, dayKey(d))
      const routines = data.quests.filter(q => q.profileId === profileId && q.type === 'routine' && isScheduledToday(q,d))
      if (routines.length && routines.every(r => p.routines?.[r.id])) count++
      else break
    }
    d.setDate(d.getDate()-1)
  }
  return count
}

function SectionBanner({ icon,kicker,title,subtitle }) { return <div className="section-banner"><div className="section-icon">{icon}</div><div><span>{kicker}</span><h2>{title}</h2><p>{subtitle}</p></div></div> }

function RewardShop({ profile, data, onRedeem }) {
  const pending = data.redemptions.filter(r => r.profileId === profile.id && r.status === 'pending').length
  return <><div className="map-title"><div><span className="eyebrow">THE TREASURE VAULT</span><h2>Reward Shop</h2></div><div className="coin-chip">🪙 {profile.coins}</div></div>{pending > 0 && <div className="status-card">⏳ {pending} reward request{pending > 1 ? 's' : ''} waiting for parent approval.</div>}<div className="reward-grid">{data.rewards.filter(r=>r.active).map(r => <RewardCard key={r.id} reward={r} coins={profile.coins} onRedeem={() => onRedeem(r)}/>)}</div></>
}

function SettingsSheet({ cloudEnabled, onClose, onNotify, onParent }) {
  return <Modal onClose={onClose}>
    <div className="modal-icon">⚙️</div>
    <span className="eyebrow">SETTINGS</span>
    <h2>Adventure Settings</h2>
    <div className={`sync-status ${cloudEnabled ? 'online' : 'local'}`}><span>{cloudEnabled ? '☁️' : '💾'}</span><div><strong>{cloudEnabled ? 'Cloud sync connected' : 'Local demo mode'}</strong><small>{cloudEnabled ? 'Progress is shared across signed-in family devices.' : 'Progress currently exists only in this browser.'}</small></div></div>
    <div className="settings-list">
      <button onClick={onNotify}><span>🔔</span><div><strong>Enable reminders</strong><small>Allow reminder notifications while Questbound is running on this device.</small></div><b>›</b></button>
      <button onClick={onParent}><span>🔐</span><div><strong>Parent controls</strong><small>Open the command table with the parent PIN.</small></div><b>›</b></button>
    </div>
  </Modal>
}

function ParentPinSheet({ title, text, action='Approve', icon='🔐', onClose, onApprove }) {
  const [pin,setPin] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function submit(e) {
    e?.preventDefault?.()
    if (!/^\d{4,8}$/.test(pin)) { setError('Enter the 4–8 digit parent PIN.'); return }
    setBusy(true); setError('')
    try { await onApprove(pin) }
    catch (e) { setError(e?.message || 'Parent approval failed.'); setBusy(false) }
  }
  return <Modal onClose={onClose}><div className="modal-icon">{icon}</div><span className="eyebrow">PARENT CHECK</span><h2>{title}</h2><p>{text}</p><form onSubmit={submit}><Field label="Parent PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={v=>setPin(v.replace(/\D/g,''))}/>{error&&<div className="inline-error">{error}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||pin.length<4}>{busy?'Checking…':action}</button></div></form></Modal>
}

function CorrectionSheet({ onClose, onApprove }) {
  const choices = ['Clothes / gear','Remembered something','Caught myself interrupting','Accepted a correction','Fixed posture / manners','Other']
  const [kind,setKind] = useState('')
  const [pin,setPin] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function approve(e) {
    e?.preventDefault?.()
    if (!kind) return
    if (!/^\d{4,8}$/.test(pin)) { setError('A parent needs to enter the 4–8 digit parent PIN.'); return }
    setBusy(true); setError('')
    try { await onApprove(kind,pin) }
    catch (e) { setError(e?.message || 'Parent approval failed.'); setBusy(false) }
  }
  return <Modal onClose={onClose}><div className="modal-icon">✨</div><span className="eyebrow">SELF-CORRECTION BONUS</span><h2>Caught It!</h2>{!kind?<><p>What did you notice and fix before someone else had to?</p><div className="choice-grid">{choices.map(c=><button key={c} onClick={()=>setKind(c)}>{c}</button>)}</div></>:<form onSubmit={approve}><div className="approval-summary"><span>✨</span><div><strong>{kind}</strong><small>Hand the device to a parent to approve this XP.</small></div></div><Field label="Parent PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={v=>setPin(v.replace(/\D/g,''))}/>{error&&<div className="inline-error">{error}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={()=>{setKind('');setPin('');setError('')}}>Back</button><button className="primary" disabled={busy||pin.length<4}>{busy?'Checking…':`Approve +${XP.minor} XP`}</button></div></form>}</Modal>
}

function RewardCard({ reward, coins, onRedeem }) {
  const can = coins >= reward.cost
  return <article className="reward-card"><div className="reward-icon">{reward.icon || '🎁'}</div><h3>{reward.title}</h3><p>{reward.description}</p><button disabled={!can} onClick={onRedeem}>{can ? `🪙 ${reward.cost} · Redeem` : `Need ${reward.cost - coins} more`}</button></article>
}

function CharacterPanel({ profile, data }) {
  const lvl = levelFromXp(profile.xp)
  const allProgress = data.progress.filter(p => p.profileId === profile.id)
  const routines = allProgress.reduce((n,p)=>n+Object.keys(p.routines||{}).length,0)
  const objectives = allProgress.reduce((n,p)=>n+Object.values(p.objectives||{}).reduce((s,a)=>s+a.length,0),0)
  const bosses = allProgress.reduce((n,p)=>n+Object.keys(p.bosses||{}).length,0)
  return <div className="character-panel"><div className="hero-card"><div className="hero-avatar">{profile.avatar || '🧙'}</div><span>LEVEL {lvl.level}</span><h2>{profile.name}</h2><p>{titleForLevel(lvl.level)}</p></div><div className="stat-grid"><Stat value={profile.xp} label="Lifetime XP"/><Stat value={profile.coins} label="Coins"/><Stat value={routines} label="Routines Cleared"/><Stat value={bosses} label="Bosses Defeated"/></div><div className="panel-card"><span className="eyebrow">ADVENTURE STATS</span><div className="unlock-row"><span>⚔️</span><div><strong>{objectives} objectives complete</strong><small>Every tiny checkbox counts.</small></div></div><div className="unlock-row"><span>🏅</span><div><strong>{titleForLevel(lvl.level)}</strong><small>Current title</small></div></div></div></div>
}

function ParentApp({ data, session, onSaveQuest, onDeleteQuest, onSaveReward, onDeleteReward, onResolve, onNotify, onSignOut, onExitParent }) {
  const [tab,setTab] = useState('overview')
  const [questEdit,setQuestEdit] = useState(null)
  const [rewardEdit,setRewardEdit] = useState(null)
  const profile = data.profiles[0]
  if (!profile) return <div className="empty-state">No child profiles found.</div>
  const p = progressFor(data, profile.id)
  const routines = data.quests.filter(q=>q.profileId===profile.id&&q.type==='routine'&&isScheduledToday(q)).sort(sortOrder)
  const bonuses = data.quests.filter(q=>q.profileId===profile.id&&q.type==='bonus'&&isScheduledToday(q)).sort(sortOrder)
  const bosses = data.quests.filter(q=>q.profileId===profile.id&&q.type==='boss'&&q.active).sort(sortOrder)
  const doneRoutines = routines.filter(r=>p.routines?.[r.id]).length
  const totalObj = routines.reduce((n,r)=>n+requiredObjectives(r).length,0)
  const doneObj = routines.reduce((n,r)=>n+requiredObjectives(r).filter(o=>(p.objectives?.[r.id]||[]).includes(o.id)).length,0)
  const doneBonus = bonuses.filter(b=>p.bonuses?.[b.id]).length
  const lvl=levelFromXp(profile.xp)
  const pending=data.redemptions.filter(r=>r.status==='pending')

  return <>
    <header className="parent-header"><div><span className="eyebrow">QUESTBOUND // PARENT</span><h1>{profile.name}'s Command Table</h1><p>{data.family?.name} · <b>Shared cloud save</b></p></div><div className="parent-actions"><button className="secondary" onClick={onNotify}>🔔 Reminders</button>{onExitParent&&<button className="primary" onClick={onExitParent}>← Kid view</button>}{onSignOut&&<button className="ghost" onClick={onSignOut}>Sign out</button>}</div></header>
    <nav className="parent-tabs">{['overview','quests','rewards','log'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}{t==='rewards'&&pending.length?` (${pending.length})`:''}</button>)}</nav>
    <main className="parent-content">
      {tab==='overview'&&<><div className="metric-grid"><Metric value={`${doneRoutines}/${routines.length}`} label="Routines cleared" note="today"/><Metric value={`${doneObj}/${totalObj}`} label="Objectives" note="required objectives today"/><Metric value={`${doneBonus}/${bonuses.length}`} label="Daily bonuses" note="optional side quests"/><Metric value={`Lv. ${lvl.level}`} label="Character level" note={`${profile.xp} lifetime XP`}/></div><div className="two-col"><section className="parent-card"><CardTitle title="Today's Route" sub="At-a-glance routine progress"/><div className="compact-list">{routines.map(r=>{const ids=p.objectives?.[r.id]||[];const req=requiredObjectives(r);const done=req.filter(o=>ids.includes(o.id)).length;return <div className="compact-row" key={r.id}><span className={`status-dot ${p.routines?.[r.id]?'good':''}`}/><div><strong>{r.icon} {r.title}</strong><small>{done}/{req.length} required objectives · {p.routines?.[r.id]?'cleared':'in progress'}</small></div><b>{p.routines?.[r.id]?'✓':`${Math.round(done/Math.max(1,req.length)*100)}%`}</b></div>})}</div></section><section className="parent-card"><CardTitle title="Boss Board" sub="Major milestones"/>{bosses.map(b=><div className="boss-mini" key={b.id}><span>{b.icon}</span><div><strong>{b.title}</strong><small>{b.kind==='routine-streak'?`${routineStreakCount(data,profile.id)}/5 school days`:p.bosses?.[b.id]?'Defeated today':b.description}</small></div><b>{p.bosses?.[b.id]?'✓':`+${b.xp}`}</b></div>)}</section></div>{pending.length>0&&<section className="parent-card"><CardTitle title="Pending Rewards" sub="Approve or refund requests"/>{pending.map(r=><RedemptionRow key={r.id} redemption={r} onResolve={onResolve}/>)}</section>}<section className="parent-card"><CardTitle title="Recent Activity" sub="Useful history, not a surveillance wall"/><ActivityLog activity={data.activity.filter(a=>a.profileId===profile.id).slice(0,10)} embedded/></section></>}
      {tab==='quests'&&<><div className="list-toolbar"><div><span className="eyebrow">QUEST ARCHITECTURE</span><h2>Routines, Bonuses & Bosses</h2></div><button className="primary" onClick={()=>setQuestEdit(newRoutine(profile.id,data.quests.length+1))}>+ New</button></div><div className="manage-list">{data.quests.filter(q=>q.profileId===profile.id).sort((a,b)=>(typeOrder(a.type)-typeOrder(b.type))||sortOrder(a,b)).map(q=><ManageQuest key={q.id} quest={q} onEdit={()=>setQuestEdit(q)} onDelete={()=>onDeleteQuest(q)}/>)}</div></>}
      {tab==='rewards'&&<><div className="list-toolbar"><div><span className="eyebrow">REWARD ECONOMY</span><h2>Reward Shop</h2></div><button className="primary" onClick={()=>setRewardEdit({title:'',description:'',cost:100,icon:'🎁',active:true})}>+ New Reward</button></div>{pending.length>0&&<section className="parent-card reward-approval"><CardTitle title="Waiting for Approval" sub={`${pending.length} request${pending.length>1?'s':''}`}/>{pending.map(r=><RedemptionRow key={r.id} redemption={r} onResolve={onResolve}/>)}</section>}<div className="manage-list">{data.rewards.map(r=><div className="manage-row" key={r.id}><div className="manage-icon">{r.icon||'🎁'}</div><div className="manage-copy"><strong>{r.title}</strong><span>{r.description}</span><small>🪙 {r.cost} · {r.active?'Active':'Paused'}</small></div><div className="row-actions"><button onClick={()=>setRewardEdit(r)}>Edit</button><button className="danger" onClick={()=>onDeleteReward(r)}>Delete</button></div></div>)}</div></>}
      {tab==='log'&&<><div className="list-toolbar"><div><span className="eyebrow">ADVENTURE LOG</span><h2>Activity History</h2></div></div><section className="parent-card"><ActivityLog activity={data.activity.filter(a=>a.profileId===profile.id)} embedded/></section></>}
    </main>
    {questEdit&&<QuestEditor value={questEdit} onClose={()=>setQuestEdit(null)} onSave={async q=>{await onSaveQuest(q);setQuestEdit(null)}}/>}
    {rewardEdit&&<RewardEditor value={rewardEdit} onClose={()=>setRewardEdit(null)} onSave={async r=>{await onSaveReward(r);setRewardEdit(null)}}/>}
  </>
}

function newRoutine(profileId,order){return {profileId,type:'routine',title:'',icon:'🧭',zone:'New Zone',description:'',xp:XP.moderate,coins:COINS.moderate,active:true,reminderTime:'',days:EVERY_DAY,objectives:[{id:uid('obj'),title:'New objective',bonus:false,xp:XP.minor,coins:COINS.minor}],order}}
function typeOrder(t){return t==='routine'?0:t==='bonus'?1:2}
function sortOrder(a,b){return (a.order||999)-(b.order||999)}

function ManageQuest({quest,onEdit,onDelete}) {
  const label=quest.type==='routine'?'Routine':quest.type==='bonus'?'Daily Bonus':'Boss'
  return <div className="manage-row"><div className="manage-icon">{quest.icon||'🧭'}</div><div className="manage-copy"><div className="manage-title"><strong>{quest.title}</strong><i className={`type-pill ${quest.type}`}>{label}</i></div><span>{quest.description}</span><small>+{quest.xp} XP · 🪙 {quest.coins} · {quest.reminderTime?`Reminder ${prettyTime(quest.reminderTime)} · `:''}{quest.active?'Active':'Paused'}{quest.type==='routine'?` · ${(quest.objectives||[]).length} objectives`:''}</small>{quest.days&&<div className="day-pills">{quest.days.map(d=><i key={d}>{DAY_NAMES[d]}</i>)}</div>}</div><div className="row-actions"><button onClick={onEdit}>Edit</button><button className="danger" onClick={onDelete}>Delete</button></div></div>
}

function QuestEditor({value,onClose,onSave}) {
  const [form,setForm]=useState(()=>clone(value)); const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const toggleDay=d=>set('days',(form.days||[]).includes(d)?form.days.filter(x=>x!==d):[...(form.days||[]),d].sort())
  const setType=type=>setForm(f=>({...f,type,days:type==='boss'?undefined:(f.days||EVERY_DAY),kind:type==='boss'?(f.kind||'manual-daily'):undefined,objectives:type==='routine'?(f.objectives?.length?f.objectives:[{id:uid('obj'),title:'New objective',bonus:false,xp:XP.minor,coins:COINS.minor}]):undefined,xp:type==='routine'?XP.moderate:type==='bonus'?XP.minor:XP.major,coins:type==='routine'?COINS.moderate:type==='bonus'?COINS.minor:COINS.major}))
  const objectiveText=(form.objectives||[]).map(o=>`${o.bonus?'[BONUS] ':''}${o.title}`).join('\n')
  const setObjectives=text=>set('objectives',text.split('\n').map(s=>s.trim()).filter(Boolean).map((line,i)=>{const bonus=/^\[BONUS\]\s*/i.test(line);const title=line.replace(/^\[BONUS\]\s*/i,'');const old=(form.objectives||[])[i];return {id:old?.id||uid('obj'),title,bonus,xp:bonus?XP.moderate:XP.minor,coins:bonus?COINS.moderate:COINS.minor}}))
  return <Modal onClose={onClose} wide><span className="eyebrow">QUEST EDITOR</span><h2>{form.id?'Edit':'Create'} {form.type==='routine'?'Routine':form.type==='bonus'?'Daily Bonus':'Boss'}</h2><div className="type-select">{['routine','bonus','boss'].map(t=><button key={t} className={form.type===t?'active':''} onClick={()=>setType(t)}>{t==='routine'?'🗺️ Routine':t==='bonus'?'⭐ Daily Bonus':'🐉 Boss'}</button>)}</div><div className="form-grid small-left"><Field label="Icon" value={form.icon||''} onChange={v=>set('icon',v)}/><Field label="Title" value={form.title||''} onChange={v=>set('title',v)}/></div><label className="field"><span>Description</span><textarea rows="3" value={form.description||''} onChange={e=>set('description',e.target.value)}/></label>{form.type==='routine'&&<><div className="form-grid"><Field label="Map zone" value={form.zone||''} onChange={v=>set('zone',v)}/><Field label="Reminder" type="time" value={form.reminderTime||''} onChange={v=>set('reminderTime',v)}/></div><label className="field"><span>Objectives</span><textarea rows="8" value={objectiveText} onChange={e=>setObjectives(e.target.value)} placeholder={'One objective per line\n[BONUS] Optional objective'}/><small>Prefix an optional objective with [BONUS]. Normal objectives = {XP.minor} XP. Bonus objectives = {XP.moderate} XP.</small></label></>}{form.type==='boss'&&<label className="field"><span>Boss rule</span><select value={form.kind||'manual-daily'} onChange={e=>set('kind',e.target.value)}><option value="manual-daily">Parent verified manual boss</option><option value="all-bonuses">Auto: all Daily Bonuses in one day</option><option value="routine-streak">Auto: all routines for 5 school days</option></select></label>}{form.type!=='boss'&&<label className="field"><span>Available on</span><div className="day-select">{DAY_NAMES.map((n,d)=><button type="button" key={n} className={(form.days||[]).includes(d)?'active':''} onClick={()=>toggleDay(d)}>{n}</button>)}</div></label>}<div className="form-grid three"><Field label="Completion XP" type="number" value={form.xp||0} onChange={v=>set('xp',v)}/><Field label="Coins" type="number" value={form.coins||0} onChange={v=>set('coins',v)}/><Field label="Order" type="number" value={form.order||1} onChange={v=>set('order',v)}/></div><label className="check-line"><input type="checkbox" checked={form.active!==false} onChange={e=>set('active',e.target.checked)}/> Active</label><div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(form)} disabled={!form.title?.trim()||(form.type!=='boss'&&!(form.days||[]).length)}>Save</button></div></Modal>
}

function RewardEditor({value,onClose,onSave}) { const [form,setForm]=useState({...value});const set=(k,v)=>setForm(f=>({...f,[k]:v}));return <Modal onClose={onClose}><span className="eyebrow">REWARD EDITOR</span><h2>{form.id?'Edit Reward':'Create Reward'}</h2><div className="form-grid small-left"><Field label="Icon" value={form.icon||''} onChange={v=>set('icon',v)}/><Field label="Title" value={form.title||''} onChange={v=>set('title',v)}/></div><label className="field"><span>Description</span><textarea rows="3" value={form.description||''} onChange={e=>set('description',e.target.value)}/></label><Field label="Coin cost" type="number" value={form.cost} onChange={v=>set('cost',v)}/><label className="check-line"><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/> Active in kid shop</label><div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(form)} disabled={!form.title?.trim()}>Save Reward</button></div></Modal> }

function RedemptionRow({redemption,onResolve}) { return <div className="redemption-row"><div><strong>{redemption.rewardTitle}</strong><small>🪙 {redemption.cost} · requested {formatWhen(redemption.at)}</small></div><div><button className="approve" onClick={()=>onResolve(redemption,'approved')}>Approve</button><button className="reject" onClick={()=>onResolve(redemption,'rejected')}>Reject</button></div></div> }

function ActivityLog({activity,embedded=false}) { return <div className={`activity-log ${embedded?'embedded':''}`}>{activity.length===0?<Empty icon="📜" title="No entries yet" text="The log is waiting for its first victory." compact/>:activity.map((a,i)=><div className="activity-row" key={a.id||i}><span className="timeline-dot">{activityIcon(a.type)}</span><div><strong>{a.text}</strong><small>{formatWhen(a.at)}</small></div></div>)}</div> }

function Celebration({event,onClose}) {
  const count=event.type==='boss'?54:26
  const particles=useMemo(()=>Array.from({length:count},(_,i)=>({id:i,left:(i*37)%100,delay:(i%11)*.045,duration:1.5+(i%7)*.14,rot:(i*71)%360})),[count])
  return <div className={`celebration ${event.type}`} onClick={onClose}><div className="flash-ring"/><div className="confetti">{particles.map(p=><i key={p.id} style={{left:`${p.left}%`,animationDelay:`${p.delay}s`,animationDuration:`${p.duration}s`,transform:`rotate(${p.rot}deg)`}}/>)}</div><div className="celebration-card"><div className="celebration-icon">{event.icon || (event.type==='boss'?'🐉':'🏆')}</div><span>{event.type==='boss'?'BOSS DEFEATED':'ROUTINE CLEARED'}</span><h2>{event.title}</h2><div className="celebration-loot"><b>+{event.xp} XP</b><b>🪙 +{event.coins}</b></div><small>Tap anywhere to continue</small></div></div>
}
function Toast({toast}) { return <div key={toast.key} className={`toast ${toast.kind||''}`}>{toast.text}</div> }
function Modal({children,onClose,wide=false}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={`modal ${wide?'wide':''}`}><button className="modal-close" onClick={onClose}>×</button>{children}</div></div> }
function Field({label,hint,onChange,...props}) { return <label className="field"><span>{label}</span><input {...props} onChange={e=>onChange(e.target.value)}/>{hint&&<small>{hint}</small>}</label> }
function NavButton({active,icon,label,onClick}) { return <button className={active?'active':''} onClick={onClick}><span>{icon}</span><small>{label}</small></button> }
function Metric({value,label,note}) { return <div className="metric"><strong>{value}</strong><span>{label}</span><small>{note}</small></div> }
function Stat({value,label}) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }
function CardTitle({title,sub}) { return <div className="card-title"><h3>{title}</h3><p>{sub}</p></div> }
function Empty({icon,title,text,compact=false}) { return <div className={`empty ${compact?'compact':''}`}><span>{icon}</span><strong>{title}</strong><p>{text}</p></div> }
function titleForLevel(level){return level>=15?'Legend of the Daily Grind':level>=10?'Executive Function Wizard':level>=7?'Routine Ranger':level>=4?'Keeper of the Checklist':level>=2?'Trail Scout':'Rookie Adventurer'}
function activityIcon(t){return t==='boss'?'🐉':t==='routine'?'🏆':t==='routine-bonus'?'🌟':t==='bonus'?'⭐':t==='objective'?'✓':t==='reward'?'🎁':t==='self-correction'?'✨':'•'}
function formatWhen(v){const t=ms(v);if(!t)return'just now';return new Date(t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function prettyTime(t){if(!t)return'';const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}
