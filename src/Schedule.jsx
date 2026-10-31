import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, Crown, Calendar, Search, ArrowLeft, RefreshCw,
  AlertTriangle, CheckCircle2, Eye, EyeOff, Sparkles,
  Share2, ChevronDown, ChevronUp, User, ExternalLink,
  Shield, Layers, Filter, Check, X,
} from 'lucide-react'
import { supabase } from './lib/supabase.js'
import { calculateRoiScore } from './lib/roi.js'

// ─── Shared display constants ─────────────────────────────────────────────────
const ALLIANCES = ['TEA', 'VIK', 'ERA', 'FFF']

const ALLIANCE_CLR = {
  TEA: { border: '#10b981', bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7' },
  VIK: { border: '#f43f5e', bg: 'rgba(244,63,94,0.15)',   text: '#fda4af' },
  ERA: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  text: '#c4b5fd' },
  FFF: { border: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  text: '#fcd34d' },
}

const TC_IS_GOLD = (v) => v?.startsWith('TG')

const TIME_SLOTS = (() => {
  const slots = []
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 30) {
      const p  = (n) => String(n).padStart(2, '0')
      const eH = m === 30 ? h + 1 : h
      const eM = m === 30 ? 0 : 30
      slots.push({
        value: `${p(h)}:${p(m)}`,
        label: `${p(h)}:${p(m)} – ${eH === 24 ? '24:00' : p(eH)+':'+p(eM)} UTC`,
      })
    }
  return slots
})()

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtSpd  = (d, h) => (!d && !h) ? '—' : (d && h) ? `${d}d ${h}h` : d ? `${d}d` : `${h}h`
const fmtGold = (n)    => !n ? '—' : n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n/1_000)}K` : String(n)
const fmtSlot = (v)    => {
  if (!v) return '—'
  const [h, m] = v.split(':').map(Number)
  const eH = m === 30 ? h + 1 : h
  const eM = m === 30 ? 0 : 30
  const p  = (n) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)} – ${eH === 24 ? '24:00' : p(eH)+':'+p(eM)}`
}

const roiStyle = (score) => {
  if (score >= 4000) return { color:'#6ee7b7', bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)' }
  if (score >= 1500) return { color:'#fcd34d', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)' }
  return                    { color:'#9ca3af', bg:'rgba(107,114,128,0.10)', border:'rgba(107,114,128,0.2)' }
}

const enrichRoi = (r) => ({
  ...r,
  _roi: calculateRoiScore({
    tcLevel:           r.tc_level,
    constructionDays:  r.construction_days,  constructionHours: r.construction_hours,
    researchDays:      r.research_days,      researchHours:     r.research_hours,
    trainingDays:      r.training_days,      trainingHours:     r.training_hours,
    trueGold:          r.true_gold_count,
  }),
})

const buildConflictMap = (rows) => {
  const d1 = {}, d4 = {}
  rows.forEach(r => {
    if (r.time_slot_day1) (d1[r.time_slot_day1] ??= []).push(r.id)
    if (r.time_slot_day4) (d4[r.time_slot_day4] ??= []).push(r.id)
  })
  const map = new Map()
  const mark = (ids, day) =>
    ids.forEach(id => { const s = map.get(id) ?? new Set(); s.add(day); map.set(id, s) })
  Object.values(d1).filter(ids => ids.length > 1).forEach(ids => mark(ids, 'day1'))
  Object.values(d4).filter(ids => ids.length > 1).forEach(ids => mark(ids, 'day4'))
  return map
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function AllianceBadge({ alliance }) {
  const s = ALLIANCE_CLR[alliance] ?? { border:'#6b7280', bg:'rgba(107,114,128,0.15)', text:'#9ca3af' }
  return (
    <span className="inline-block font-sans font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-lg"
      style={{ color:s.text, background:s.bg, border:`1px solid ${s.border}` }}>
      {alliance}
    </span>
  )
}

function TcBadge({ level }) {
  const gold = TC_IS_GOLD(level)
  return (
    <span className="inline-block font-sans font-bold text-[11px] px-2 py-0.5 rounded-lg"
      style={gold
        ?{color:'#fcd34d',background:'rgba(245,158,11,0.14)',border:'1px solid rgba(245,158,11,0.3)'}
        :{color:'#748ffc',background:'rgba(76,110,245,0.14)',border:'1px solid rgba(76,110,245,0.3)'}}>
      {level}
    </span>
  )
}

function RoiPill({ score }) {
  const s = roiStyle(score??0)
  return (
    <span className="inline-block font-sans font-semibold text-xs px-2.5 py-0.5 rounded-lg tabular-nums tracking-tight"
      style={{ color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      {(score??0).toLocaleString()}
    </span>
  )
}

function ConflictPill({ conflicts }) {
  if (!conflicts||conflicts.size===0) return <span style={{ color:'#374151' }}>—</span>
  return (
    <span className="inline-flex items-center gap-1 font-sans font-bold text-xs px-2 py-0.5 rounded-lg"
      style={{ color:'#fcd34d', background:'rgba(245,158,11,0.18)', border:'1px solid rgba(245,158,11,0.4)' }}>
      <AlertTriangle className="w-3 h-3" />
      {[...conflicts].map(d=>d==='day1'?'D1':'D4').join('+')}
    </span>
  )
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl"
      style={{ background:'#0f1117', border:`1px solid ${accent??'#1c1f2e'}`, flex:'1 1 120px' }}>
      <div className="flex items-center gap-1.5" style={{ color:accent??'#6b7280' }}>
        {icon}
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
      </div>
      <span className="font-sans text-xl sm:text-2xl font-bold text-white tracking-tight">{value}</span>
      {sub && <span className="font-sans text-[10px] text-slate-500">{sub}</span>}
    </div>
  )
}

// ─── Public Read-Only Schedule Page ───────────────────────────────────────────
export default function PublicSchedule() {
  const navigate = useNavigate()

  const [rows, setRows]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [copied, setCopied]           = useState(false)

  // Visualizer & Filter States
  const [activeDay, setActiveDay]                   = useState('day1')  // 'day1' | 'day4'
  const [hideCovered, setHideCovered]               = useState(false)
  const [selectedSlotFilter, setSelectedSlotFilter] = useState(null)
  const [tableDayFilter, setTableDayFilter]         = useState('day1')
  const [allianceFilter, setAllianceFilter]         = useState('ALL')
  const [search, setSearch]                         = useState('')
  const [sort, setSort]                             = useState({ col:'_roi', dir:'desc' })
  const [hoveredData, setHoveredData]               = useState(null)
  const [unclaimedPromptSlot, setPromptSlot]        = useState(null)

  // ── Fetch appointments from Supabase ───────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('kvk_appointments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Public Schedule Fetch Error]', error)
    } else {
      setRows((data ?? []).map(enrichRoi))
      setLastUpdated(new Date())
    }
    setLoading(false)
  }, [])

  // ── Initial load + Real-time Subscription ──────────────────────────────────
  useEffect(() => {
    fetchData()

    // Real-time Supabase postgres_changes subscription
    const channel = supabase
      .channel('public_schedule_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kvk_appointments' },
        (payload) => {
          console.log('[Real-time Schedule Event]', payload)
          fetchData()
        }
      )
      .subscribe()

    // 45-second polling fallback
    const interval = setInterval(fetchData, 45000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchData])

  // ── Copy Link action ───────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    const url = window.location.href
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2600)
    } catch {
      // ignore
    }
  }

  // ── Sync Day switch ────────────────────────────────────────────────────────
  const handleDaySwitch = (day) => {
    setActiveDay(day)
    setTableDayFilter(day)
    setSelectedSlotFilter(null)
  }

  // ── Slot Data for Visualizer ───────────────────────────────────────────────
  const slotData = useMemo(() => {
    const slotField = activeDay === 'day1' ? 'time_slot_day1' : 'time_slot_day4'
    return TIME_SLOTS.map(slot => {
      const signups = rows.filter(r =>
        r.selected_days?.includes(activeDay) && r[slotField] === slot.value
      ).sort((a, b) => (b._roi ?? 0) - (a._roi ?? 0))

      const count = signups.length
      const status = count === 0 ? 'unclaimed' : count === 1 ? 'covered' : 'conflict'
      return { slot, signups, count, status }
    })
  }, [rows, activeDay])

  const totalSlots     = 48
  const coveredSlots   = useMemo(() => slotData.filter(s => s.count >= 1).length, [slotData])
  const unclaimedSlots = useMemo(() => slotData.filter(s => s.count === 0).length, [slotData])
  const conflictSlots  = useMemo(() => slotData.filter(s => s.count >= 2).length, [slotData])
  const coveragePct    = Math.round((coveredSlots / totalSlots) * 100)

  const displayedSlots = useMemo(() => {
    if (hideCovered) {
      return slotData.filter(s => s.status === 'unclaimed')
    }
    return slotData
  }, [slotData, hideCovered])

  // Unclaimed stats for tabs
  const d1UnclaimedCount = useMemo(() => {
    const claimed = new Set()
    rows.forEach(r => {
      if (r.selected_days?.includes('day1') && r.time_slot_day1) claimed.add(r.time_slot_day1)
    })
    return 48 - claimed.size
  }, [rows])

  const d4UnclaimedCount = useMemo(() => {
    const claimed = new Set()
    rows.forEach(r => {
      if (r.selected_days?.includes('day4') && r.time_slot_day4) claimed.add(r.time_slot_day4)
    })
    return 48 - claimed.size
  }, [rows])

  const day1Signups = useMemo(() => rows.filter(r => r.selected_days?.includes('day1')).length, [rows])
  const day4Signups = useMemo(() => rows.filter(r => r.selected_days?.includes('day4')).length, [rows])
  const conflictMap = useMemo(() => buildConflictMap(rows), [rows])

  // Table rows filtering
  const displayed = useMemo(() => {
    let res = [...rows]

    if (allianceFilter !== 'ALL') res = res.filter(r => r.alliance === allianceFilter)

    if (tableDayFilter === 'day1') res = res.filter(r => r.selected_days?.includes('day1'))
    if (tableDayFilter === 'day4') res = res.filter(r => r.selected_days?.includes('day4'))
    if (tableDayFilter === 'both') res = res.filter(r =>
      r.selected_days?.includes('day1') && r.selected_days?.includes('day4'))

    if (selectedSlotFilter) {
      const slotField = activeDay === 'day1' ? 'time_slot_day1' : 'time_slot_day4'
      res = res.filter(r => r.selected_days?.includes(activeDay) && r[slotField] === selectedSlotFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(r =>
        r.player_name?.toLowerCase().includes(q) ||
        r.alliance?.toLowerCase().includes(q)
      )
    }

    res.sort((a,b) => {
      const av=a[sort.col]??0, bv=b[sort.col]??0
      const cmp = typeof av==='string' ? av.localeCompare(bv) : av-bv
      return sort.dir==='desc' ? -cmp : cmp
    })
    return res
  }, [rows, allianceFilter, tableDayFilter, selectedSlotFilter, activeDay, search, sort])

  const toggleSort = (col) => setSort(s => s.col===col?{col,dir:s.dir==='desc'?'asc':'desc'}:{col,dir:'desc'})

  const handleCellClick = (slot, status) => {
    if (status === 'unclaimed') {
      setPromptSlot(slot)
    } else {
      if (selectedSlotFilter === slot.value) {
        setSelectedSlotFilter(null)
      } else {
        setSelectedSlotFilter(slot.value)
      }
    }
  }

  const Th = ({ col, children, right }) => (
    <th onClick={() => toggleSort(col)} className="select-none cursor-pointer whitespace-nowrap"
      style={{ padding:'10px 14px', textAlign:right?'right':'left', fontSize:11, fontWeight:700,
               color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', background:'#0a0b0f',
               borderBottom:'1px solid #1c1f2e', position:'sticky', top:0, zIndex:10 }}>
      {children}
      {sort.col === col && (
        sort.dir === 'desc'
          ? <ChevronDown className="w-3 h-3 inline ml-1 text-indigo-400" />
          : <ChevronUp className="w-3 h-3 inline ml-1 text-indigo-400" />
      )}
    </th>
  )

  return (
    <div className="min-h-screen text-slate-200" style={{ background: '#0a0b0f' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 backdrop-blur-xl"
        style={{ background: 'rgba(10,11,15,0.92)', borderBottom: '1px solid #1c1f2e' }}>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(76,110,245,0.2)', border: '1px solid rgba(76,110,245,0.35)' }}>
            <Crown className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-bold text-sm sm:text-base text-white tracking-tight">
                2323 KvK Schedule & Coverage
              </h1>
              <span className="flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE SYNC
              </span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              Official Kingdom Ministry Schedule · Read-Only Alliance View
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Share Link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-sans text-xs font-semibold tracking-tight transition-all active:scale-95 bg-[#12141c] hover:bg-[#1a1d28] border border-[#1c1f2e] text-slate-300">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-sans text-xs font-medium tracking-tight transition-all bg-[#12141c] hover:bg-[#1a1d28] border border-[#1c1f2e] text-slate-400 hover:text-white">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Book Appointment CTA */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-sans text-xs font-bold tracking-tight text-white transition-all active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #4c6ef5, #5c7cfa)',
              boxShadow: '0 0 20px rgba(92,124,250,0.3)',
            }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Book a Slot</span>
          </button>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="px-4 sm:px-6 py-6 space-y-6" style={{ maxWidth: 1440, margin: '0 auto' }}>

        {/* Top Summary KPI Cards */}
        <div className="flex flex-wrap gap-3">
          <StatCard
            icon={<Users className="w-3.5 h-3.5" />}
            label="Total Appointments"
            value={rows.length}
            sub="Submitted across 4 alliances"
          />
          <StatCard
            icon={<span style={{fontSize:13}}>⚒️</span>}
            label="Day 1 (Const & Res)"
            value={`${48 - d1UnclaimedCount} / 48`}
            sub={`${d1UnclaimedCount} free slots open`}
            accent={activeDay === 'day1' ? 'rgba(76,110,245,0.7)' : 'rgba(76,110,245,0.3)'}
          />
          <StatCard
            icon={<span style={{fontSize:13}}>⚔️</span>}
            label="Day 4 (Training)"
            value={`${48 - d4UnclaimedCount} / 48`}
            sub={`${d4UnclaimedCount} free slots open`}
            accent={activeDay === 'day4' ? 'rgba(245,158,11,0.7)' : 'rgba(245,158,11,0.3)'}
          />
          <StatCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Active Day Free Slots"
            value={activeDay === 'day1' ? `${d1UnclaimedCount}` : `${d4UnclaimedCount}`}
            sub={`Available for booking in ${activeDay === 'day1' ? 'Day 1' : 'Day 4'}`}
            accent="rgba(244,63,94,0.6)"
          />
          <StatCard
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Day Coverage"
            value={`${coveragePct}%`}
            sub={`${coveredSlots} of 48 slots claimed`}
            accent={coveragePct >= 80 ? 'rgba(16,185,129,0.7)' : 'rgba(245,158,11,0.7)'}
          />
        </div>

        {/* ── Read-Only Slot Coverage Visualizer (Heatmap) ── */}
        <div className="rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl"
          style={{ background: '#0f1117', border: '1px solid #1c1f2e' }}>

          {/* Visualizer Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(76, 110, 245, 0.15)', border: '1px solid rgba(76, 110, 245, 0.35)' }}>
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-sans font-bold text-white text-sm sm:text-base tracking-tight">
                    24h Schedule Coverage Grid
                  </h2>
                  <span className="font-sans text-xs px-2.5 py-0.5 rounded-full font-bold tracking-tight"
                    style={{
                      background: coveragePct >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: coveragePct >= 80 ? '#6ee7b7' : '#fcd34d',
                      border: `1px solid ${coveragePct >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                    {coveragePct}% Covered ({coveredSlots}/48)
                  </span>
                </div>
                <p className="font-sans text-[11px] text-slate-400 mt-0.5">
                  All 48 30-min intervals in UTC · Hover to view player assignment and speedups
                </p>
              </div>
            </div>

            {/* Day Switcher & Hide Covered Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-1 rounded-xl bg-[#0a0b0f] border border-[#1c1f2e]">
                <button
                  onClick={() => handleDaySwitch('day1')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-bold tracking-tight transition-all"
                  style={activeDay === 'day1'
                    ? { background: 'rgba(76, 110, 245, 0.22)', color: '#748ffc', border: '1px solid rgba(76, 110, 245, 0.45)' }
                    : { color: '#6b7280', border: '1px solid transparent' }}>
                  <span>⚒️</span>
                  <span>Day 1</span>
                  <span className="font-sans text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-tight"
                    style={{ background: 'rgba(0,0,0,0.4)', color: activeDay === 'day1' ? '#a5b4fc' : '#6b7280' }}>
                    {d1UnclaimedCount} free
                  </span>
                </button>

                <button
                  onClick={() => handleDaySwitch('day4')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-bold tracking-tight transition-all"
                  style={activeDay === 'day4'
                    ? { background: 'rgba(245, 158, 11, 0.22)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.45)' }
                    : { color: '#6b7280', border: '1px solid transparent' }}>
                  <span>⚔️</span>
                  <span>Day 4</span>
                  <span className="font-sans text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-tight"
                    style={{ background: 'rgba(0,0,0,0.4)', color: activeDay === 'day4' ? '#fde68a' : '#6b7280' }}>
                    {d4UnclaimedCount} free
                  </span>
                </button>
              </div>

              <button
                onClick={() => setHideCovered(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-sans text-xs font-semibold tracking-tight transition-all"
                style={hideCovered
                  ? { background: 'rgba(244, 63, 94, 0.16)', border: '1px solid rgba(244, 63, 94, 0.45)', color: '#fda4af' }
                  : { background: '#0a0b0f', border: '1px solid #1c1f2e', color: '#9ca3af' }}>
                {hideCovered ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hideCovered ? 'Showing Free Only' : 'Hide Covered'}</span>
                <span className="sm:hidden">{hideCovered ? 'Free Only' : 'Hide'}</span>
              </button>
            </div>
          </div>

          {/* Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1c1f2e]/70 text-xs">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded"
                  style={{ background: 'rgba(244,63,94,0.06)', border: '1px dashed rgba(244,63,94,0.55)' }} />
                <span className="font-sans text-[11px] text-slate-400">
                  Open / Unclaimed: <strong className="text-rose-400">{unclaimedSlots}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded"
                  style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.55)' }} />
                <span className="font-sans text-[11px] text-slate-400">
                  Covered: <strong className="text-emerald-400">{coveredSlots - conflictSlots}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded"
                  style={{ background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.65)' }} />
                <span className="font-sans text-[11px] text-slate-400">
                  Overlap / Conflict: <strong className="text-amber-400">{conflictSlots}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-sans text-[11px] text-slate-500">
              {selectedSlotFilter && (
                <button
                  onClick={() => setSelectedSlotFilter(null)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold underline">
                  Clear Slot Filter ({selectedSlotFilter})
                </button>
              )}
              <span>Showing {displayedSlots.length} of {totalSlots} slots</span>
            </div>
          </div>

          {/* 48 Slots Heatmap Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
            {displayedSlots.map(({ slot, signups, count, status }) => {
              const isUnclaimed = status === 'unclaimed'
              const isCovered   = status === 'covered'
              const isConflict  = status === 'conflict'
              const isSelected  = selectedSlotFilter === slot.value

              let borderStyle, bgStyle, glowStyle
              if (isSelected) {
                borderStyle = '2px solid #818cf8'
                bgStyle     = 'rgba(99, 102, 241, 0.25)'
                glowStyle   = '0 0 16px rgba(129, 140, 248, 0.4)'
              } else if (isUnclaimed) {
                borderStyle = '1px dashed rgba(244, 63, 94, 0.45)'
                bgStyle     = 'rgba(244, 63, 94, 0.04)'
                glowStyle   = 'none'
              } else if (isCovered) {
                borderStyle = '1px solid rgba(16, 185, 129, 0.4)'
                bgStyle     = 'rgba(16, 185, 129, 0.12)'
                glowStyle   = '0 0 10px rgba(16, 185, 129, 0.08)'
              } else {
                borderStyle = '1px solid rgba(245, 158, 11, 0.65)'
                bgStyle     = 'rgba(245, 158, 11, 0.18)'
                glowStyle   = '0 0 14px rgba(245, 158, 11, 0.18)'
              }

              const topPlayer = signups[0]

              return (
                <div
                  key={slot.value}
                  onClick={() => handleCellClick(slot, status)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setHoveredData({ slot, signups, status, rect })
                  }}
                  onMouseLeave={() => setHoveredData(null)}
                  className={`group relative flex flex-col justify-between p-2 rounded-xl transition-all select-none cursor-pointer ${
                    isUnclaimed
                      ? 'hover:border-rose-400 hover:bg-rose-950/25 active:scale-95'
                      : isSelected
                        ? 'scale-102 ring-1 ring-indigo-400'
                        : 'hover:border-indigo-400/80 hover:bg-slate-800/40 active:scale-98'
                  }`}
                  style={{
                    border: borderStyle,
                    background: bgStyle,
                    boxShadow: glowStyle,
                    minHeight: 64,
                  }}
                >
                  {/* Top line: Slot Time & Indicator */}
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-sans text-xs font-semibold tracking-tight transition-colors ${
                      isSelected ? 'text-white font-bold' : 'text-slate-200 group-hover:text-white'
                    }`}>
                      {slot.value}
                    </span>
                    {isConflict && (
                      <span className="flex items-center gap-0.5 font-sans text-[10px] font-bold px-1.5 py-0.2 rounded"
                        style={{ background: 'rgba(245,158,11,0.25)', color: '#fcd34d' }}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {count}
                      </span>
                    )}
                    {isCovered && (
                      <span className="w-2 h-2 rounded-full"
                        style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                    )}
                    {isUnclaimed && (
                      <span className="font-sans text-[10px] text-rose-400 font-bold tracking-wide uppercase group-hover:text-rose-300">
                        FREE
                      </span>
                    )}
                  </div>

                  {/* Bottom line: Content */}
                  <div className="mt-1">
                    {isUnclaimed ? (
                      <div className="flex items-center gap-1 font-sans text-[10px] text-rose-300/80 group-hover:text-rose-200">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span className="font-semibold tracking-tight truncate">Open Slot</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-sans text-xs font-semibold text-slate-100 truncate max-w-[70px] sm:max-w-[85px] tracking-tight">
                            {topPlayer?.player_name}
                          </span>
                          <span className="font-sans text-[10px] font-semibold text-emerald-400 tracking-tight">
                            {topPlayer?._roi ? fmtGold(topPlayer._roi) : '—'}
                          </span>
                        </div>
                        {isConflict && (
                          <span className="font-sans text-[9px] text-amber-300/90 font-medium truncate tracking-tight">
                            +{count - 1} overlap
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Active Slot Filter Banner ── */}
        {selectedSlotFilter && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <div className="flex items-center gap-2 font-sans text-xs">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Filtering schedule for slot: <strong className="text-white font-semibold">{selectedSlotFilter} UTC</strong> ({activeDay === 'day1' ? 'Day 1' : 'Day 4'})
              </span>
              <span className="text-[11px] text-indigo-400/80">({displayed.length} player{displayed.length !== 1 ? 's' : ''})</span>
            </div>
            <button
              onClick={() => setSelectedSlotFilter(null)}
              className="flex items-center gap-1 text-xs font-sans font-semibold text-indigo-300 hover:text-white px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 transition-colors">
              <X className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {/* ── Searchable Alliance Schedule Directory ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-sans font-bold text-base text-white tracking-tight">
                Alliance Ministry Directory
              </h3>
              <p className="font-sans text-xs text-slate-400">
                Search your player name or filter by alliance to view assigned times and ROI standing
              </p>
            </div>

            {/* Filter pills & search */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {['ALL', ...ALLIANCES].map(a => (
                  <button
                    key={a}
                    onClick={() => setAllianceFilter(a)}
                    className={`px-2.5 py-1 rounded-lg font-sans text-xs font-semibold tracking-tight transition-all ${
                      allianceFilter === a
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        : 'bg-[#0f1117] text-slate-400 border border-[#1c1f2e] hover:text-slate-200'
                    }`}>
                    {a === 'ALL' ? 'All Alliances' : a}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Find your name…"
                  className="pl-8 pr-4 py-1.5 rounded-xl font-sans text-xs bg-[#0f1117] border border-[#1c1f2e] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 w-36 sm:w-48"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500 font-sans text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading schedule…
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-16 text-center text-slate-500 font-sans text-xs rounded-2xl border border-[#1c1f2e] bg-[#0f1117]">
              No player appointments match the current search or slot filter.
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-[#1c1f2e] bg-[#0f1117]">
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <Th col="_rank">#</Th>
                      <Th col="player_name">Player</Th>
                      <Th col="alliance">Alliance</Th>
                      <Th col="tc_level">TC</Th>
                      <Th col="time_slot_day1">Day 1 Slot</Th>
                      <Th col="time_slot_day4">Day 4 Slot</Th>
                      <Th col="construction_days">Const</Th>
                      <Th col="research_days">Research</Th>
                      <Th col="training_days">Training</Th>
                      <Th col="true_gold_count" right>Gold</Th>
                      <Th col="_roi" right>ROI Score</Th>
                      <Th col="_conflict">Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((r, idx) => {
                      const conflicts = conflictMap.get(r.id)
                      const hasConflict = conflicts && conflicts.size > 0
                      return (
                        <tr key={r.id} className="border-b border-[#141620] hover:bg-white/[0.02] transition-colors">
                          <td style={{ padding:'10px 14px', color:'#4b5563', fontWeight:700, textAlign:'center' }}>{idx+1}</td>
                          <td style={{ padding:'10px 14px', color:'#f8fafc', fontWeight:600, whiteSpace:'nowrap' }}>{r.player_name}</td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><AllianceBadge alliance={r.alliance} /></td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><TcBadge level={r.tc_level} /></td>
                          <td className="font-sans text-xs tracking-tight"
                            style={{ padding:'10px 14px', whiteSpace:'nowrap', color:conflicts?.has('day1')?'#fcd34d':'#94a3b8', fontWeight:conflicts?.has('day1')?700:500 }}>
                            {fmtSlot(r.time_slot_day1)}
                          </td>
                          <td className="font-sans text-xs tracking-tight"
                            style={{ padding:'10px 14px', whiteSpace:'nowrap', color:conflicts?.has('day4')?'#fcd34d':'#94a3b8', fontWeight:conflicts?.has('day4')?700:500 }}>
                            {fmtSlot(r.time_slot_day4)}
                          </td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtSpd(r.construction_days, r.construction_hours)}</td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtSpd(r.research_days, r.research_hours)}</td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtSpd(r.training_days, r.training_hours)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', color:'#fcd34d', fontWeight:600, whiteSpace:'nowrap' }}>{fmtGold(r.true_gold_count)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', whiteSpace:'nowrap' }}><RoiPill score={r._roi} /></td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><ConflictPill conflicts={conflicts} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 font-sans text-xs text-slate-500 border-t border-[#1c1f2e]">
                <span>Showing {displayed.length} of {rows.length} players</span>
                {lastUpdated && (
                  <span>Live synced {lastUpdated.toLocaleTimeString()}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Open Slot Click Prompt Modal (for members who click an empty slot) ── */}
      {unclaimedPromptSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl p-6 bg-[#0f1117] border border-indigo-500/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-white text-base">Unclaimed Slot!</h3>
                <p className="font-sans text-xs text-slate-400">{unclaimedPromptSlot.label}</p>
              </div>
            </div>

            <p className="font-sans text-xs text-slate-300 leading-relaxed">
              This 30-minute Ministry Appointment slot on <strong className="text-white">{activeDay === 'day1' ? 'Day 1' : 'Day 4'}</strong> is currently free with 0 signups. Would you like to submit your speedups to book it?
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPromptSlot(null)}
                className="flex-1 py-2.5 rounded-xl font-sans text-xs font-semibold bg-[#1c1f2e] text-slate-400 hover:text-white">
                Close
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans text-xs font-bold text-white shadow-lg bg-gradient-to-r from-indigo-500 to-indigo-600 active:scale-95">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Book This Slot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      {hoveredData && (
        <div
          className="fixed z-[100] pointer-events-none transition-opacity duration-150"
          style={{
            left: Math.min(
              Math.max(12, hoveredData.rect.left + hoveredData.rect.width / 2 - 140),
              window.innerWidth - 300
            ),
            top: hoveredData.rect.top - 12 > 160
              ? hoveredData.rect.top - 8
              : hoveredData.rect.bottom + 8,
            transform: hoveredData.rect.top - 12 > 160 ? 'translateY(-100%)' : 'none',
            width: 280,
          }}
        >
          <div
            className="p-3 rounded-xl shadow-2xl backdrop-blur-md"
            style={{
              background: 'rgba(15, 17, 23, 0.97)',
              border: hoveredData.status === 'conflict'
                ? '1px solid rgba(245, 158, 11, 0.55)'
                : hoveredData.status === 'covered'
                  ? '1px solid rgba(16, 185, 129, 0.45)'
                  : '1px solid rgba(244, 63, 94, 0.45)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.85)',
            }}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c1f2e]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-sans font-semibold tracking-tight text-xs text-slate-100">
                  {hoveredData.slot.label}
                </span>
              </div>
              <span
                className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full tracking-tight"
                style={{
                  background: hoveredData.status === 'conflict'
                    ? 'rgba(245,158,11,0.22)'
                    : hoveredData.status === 'covered'
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(244,63,94,0.18)',
                  color: hoveredData.status === 'conflict'
                    ? '#fcd34d'
                    : hoveredData.status === 'covered'
                      ? '#6ee7b7'
                      : '#fda4af',
                }}
              >
                {hoveredData.status === 'conflict'
                  ? `⚠️ ${hoveredData.signups.length} Overlaps`
                  : hoveredData.status === 'covered'
                    ? '1 Booking'
                    : 'Open'}
              </span>
            </div>

            {hoveredData.signups.length > 0 ? (
              <div className="space-y-2">
                {hoveredData.signups.map((player, idx) => (
                  <div
                    key={player.id}
                    className="p-2 rounded-lg"
                    style={{
                      background: idx === 0 && hoveredData.status === 'conflict'
                        ? 'rgba(16,185,129,0.08)'
                        : 'rgba(255,255,255,0.03)',
                      border: idx === 0 && hoveredData.status === 'conflict'
                        ? '1px solid rgba(16,185,129,0.3)'
                        : '1px solid #1c1f2e',
                    }}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        {idx === 0 && hoveredData.status === 'conflict' && (
                          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                        <span className="font-sans font-bold text-xs text-white truncate">{player.player_name}</span>
                        <AllianceBadge alliance={player.alliance} />
                      </div>
                      <RoiPill score={player._roi} />
                    </div>
                    <div className="flex items-center justify-between font-sans text-[10px] text-slate-400 pt-1 border-t border-[#1c1f2e]/40">
                      <span>TC {player.tc_level}</span>
                      <span>
                        {fmtSpd(player.construction_days, player.construction_hours)} /{' '}
                        {fmtSpd(player.research_days, player.research_hours)}
                      </span>
                      <span className="text-amber-300 font-semibold">
                        TG: {fmtGold(player.true_gold_count)}
                      </span>
                    </div>
                  </div>
                ))}
                {hoveredData.status === 'conflict' && (
                  <p className="font-sans text-[10px] text-amber-300/90 italic text-center pt-0.5">
                    👑 Ranked by ROI score · highest recommended
                  </p>
                )}
                <p className="font-sans text-[10px] text-indigo-400/80 text-center pt-0.5">
                  Click slot to filter directory table below
                </p>
              </div>
            ) : (
              <div className="py-2 text-center text-xs">
                <p className="font-sans font-semibold text-rose-300">Unclaimed Time Slot</p>
                <p className="font-sans text-[10px] text-slate-400 mt-0.5">Click to view booking options</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
