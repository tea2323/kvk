import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Download, Search, AlertTriangle, ArrowLeft,
  Crown, ChevronUp, ChevronDown, Loader2, XCircle, Calendar,
  TrendingUp, Users, Pencil, Trash2, Lock, KeyRound,
  LogOut, Save, X, Check, ShieldAlert, UserPlus, CheckCircle2,
  Clock, Eye, EyeOff, Plus, LayoutGrid,
} from 'lucide-react'
import { supabase } from './lib/supabase.js'
import { calculateRoiScore } from './lib/roi.js'

// ─── Shared constants ─────────────────────────────────────────────────────────
const ALLIANCES = ['TEA', 'VIK', 'ERA', 'FFF']

const ALLIANCE_CLR = {
  TEA: { border: '#10b981', bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7' },
  VIK: { border: '#f43f5e', bg: 'rgba(244,63,94,0.15)',   text: '#fda4af' },
  ERA: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  text: '#c4b5fd' },
  FFF: { border: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  text: '#fcd34d' },
}

const TC_LEVELS  = ['25','26','27','28','29','30','TG1','TG2','TG3']
const TC_IS_GOLD = (v) => v?.startsWith('TG')

const KVK_DAYS = [
  { id: 'day1', emoji: '⚒️', label: 'Day 1', sub: 'Construction & Research',
    border: '#4c6ef5', bg: 'rgba(76,110,245,0.13)', text: '#748ffc', glow: '0 0 14px rgba(92,124,250,0.35)' },
  { id: 'day4', emoji: '⚔️', label: 'Day 4', sub: 'Training',
    border: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  text: '#fcd34d', glow: '0 0 14px rgba(245,158,11,0.35)' },
]

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
const fmtDate = (s)    => new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
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

// Build a safe DB payload with strict type coercion — shared by Add + Edit
const buildPayload = (f) => ({
  player_name:        String(f.playerName).trim(),
  alliance:           String(f.alliance),
  selected_days:      Array.isArray(f.selectedDays) ? f.selectedDays : [],
  tc_level:           String(f.tcLevel),
  construction_days:  parseInt(f.constructionDays,  10) || 0,
  construction_hours: parseInt(f.constructionHours, 10) || 0,
  research_days:      parseInt(f.researchDays,      10) || 0,
  research_hours:     parseInt(f.researchHours,     10) || 0,
  training_days:      parseInt(f.trainingDays,      10) || 0,
  training_hours:     parseInt(f.trainingHours,     10) || 0,
  true_gold_count:    parseInt(f.trueGold,          10) || 0,
  time_slot_day1:     f.timeSlotDay1 ? String(f.timeSlotDay1) : null,
  time_slot_day4:     f.timeSlotDay4 ? String(f.timeSlotDay4) : null,
})

// ─── Conflict detection ───────────────────────────────────────────────────────
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

// ─── CSV Export ───────────────────────────────────────────────────────────────
const exportCsv = (rows, conflictMap) => {
  const hdrs = ['Rank','Player','Alliance','TC Level','Selected Days','Day 1 Slot','Day 4 Slot',
                'Construction','Research','Training','True Gold','ROI Score','Conflict','Submitted At']
  const body = rows.map((r, i) => [
    i+1, r.player_name, r.alliance, r.tc_level,
    (r.selected_days||[]).join(' + '),
    fmtSlot(r.time_slot_day1), fmtSlot(r.time_slot_day4),
    fmtSpd(r.construction_days, r.construction_hours),
    fmtSpd(r.research_days, r.research_hours),
    fmtSpd(r.training_days, r.training_hours),
    r.true_gold_count ?? 0, r._roi ?? 0,
    conflictMap.has(r.id) ? [...conflictMap.get(r.id)].join('+') : '',
    fmtDate(r.created_at),
  ])
  const csv = [hdrs,...body].map(row =>
    row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')
  ).join('\n')
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'),{href:url,download:`kvk-appointments-${new Date().toISOString().slice(0,10)}.csv`})
  a.click(); URL.revokeObjectURL(url)
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl"
      style={{ background:'#0f1117', border:`1px solid ${accent??'#1c1f2e'}`, flex:'1 1 120px' }}>
      <div className="flex items-center gap-1.5" style={{ color:accent??'#6b7280' }}>
        {icon}
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
      </div>
      <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">{value}</span>
    </div>
  )
}

function AllianceBadge({ alliance }) {
  const s = ALLIANCE_CLR[alliance] ?? { border:'#6b7280', bg:'rgba(107,114,128,0.15)', text:'#9ca3af' }
  return (
    <span className="inline-block font-bold text-xs uppercase tracking-widest px-2 py-0.5 rounded-lg"
      style={{ color:s.text, background:s.bg, border:`1px solid ${s.border}` }}>
      {alliance}
    </span>
  )
}

function TcBadge({ level }) {
  const gold = TC_IS_GOLD(level)
  return (
    <span className="inline-block font-bold text-xs px-2 py-0.5 rounded-lg"
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
    <span className="inline-block font-bold text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 rounded-lg tabular-nums"
      style={{ color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      {(score??0).toLocaleString()}
    </span>
  )
}

function ConflictPill({ conflicts }) {
  if (!conflicts||conflicts.size===0) return <span style={{ color:'#374151' }}>—</span>
  return (
    <span className="inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-lg"
      style={{ color:'#fcd34d', background:'rgba(245,158,11,0.18)', border:'1px solid rgba(245,158,11,0.4)' }}>
      <AlertTriangle className="w-3 h-3" />
      {[...conflicts].map(d=>d==='day1'?'D1':'D4').join('+')}
    </span>
  )
}

function SortIcon({ col, sort }) {
  if (sort.col!==col) return <ChevronDown className="w-3 h-3 inline ml-1" style={{ color:'#2d3748' }} />
  return sort.dir==='desc'
    ? <ChevronDown className="w-3 h-3 inline ml-1" style={{ color:'#748ffc' }} />
    : <ChevronUp   className="w-3 h-3 inline ml-1" style={{ color:'#748ffc' }} />
}

// ─── Slot Coverage Visualizer / Heatmap ───────────────────────────────────────
function SlotCoverageVisualizer({ rows, activeDay, setActiveDay, hideCovered, setHideCovered, onSelectUnclaimedSlot }) {
  const [hoveredData, setHoveredData] = useState(null)

  // Map each slot value to list of signups for this day
  const slotData = useMemo(() => {
    const slotField = activeDay === 'day1' ? 'time_slot_day1' : 'time_slot_day4'
    return TIME_SLOTS.map(slot => {
      const signups = rows.filter(r =>
        r.selected_days?.includes(activeDay) && r[slotField] === slot.value
      ).sort((a, b) => (b._roi ?? 0) - (a._roi ?? 0)) // sort by highest ROI

      const count = signups.length
      const status = count === 0 ? 'unclaimed' : count === 1 ? 'covered' : 'conflict'
      return { slot, signups, count, status }
    })
  }, [rows, activeDay])

  // Coverage statistics for active day
  const totalSlots     = 48
  const coveredSlots   = useMemo(() => slotData.filter(s => s.count >= 1).length, [slotData])
  const unclaimedSlots = useMemo(() => slotData.filter(s => s.count === 0).length, [slotData])
  const conflictSlots  = useMemo(() => slotData.filter(s => s.count >= 2).length, [slotData])
  const coveragePct    = Math.round((coveredSlots / totalSlots) * 100)

  // Filter slots if 'Hide Covered Slots' toggle is active
  const displayedSlots = useMemo(() => {
    if (hideCovered) {
      return slotData.filter(s => s.status === 'unclaimed')
    }
    return slotData
  }, [slotData, hideCovered])

  // Count unclaimed for both days to display in tab buttons
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

  const handleCellHover = (e, slot, signups, status) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredData({ slot, signups, status, rect })
  }

  const handleCellLeave = () => {
    setHoveredData(null)
  }

  return (
    <div className="rounded-2xl p-4 sm:p-5 space-y-4"
      style={{ background: '#0f1117', border: '1px solid #1c1f2e', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>

      {/* Visualizer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(76, 110, 245, 0.15)', border: '1px solid rgba(76, 110, 245, 0.35)' }}>
            <Clock className="w-4 h-4" style={{ color: '#748ffc' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-sm sm:text-base tracking-tight">
                Slot Coverage Visualizer
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide"
                style={{
                  background: coveragePct >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: coveragePct >= 80 ? '#6ee7b7' : '#fcd34d',
                  border: `1px solid ${coveragePct >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                {coveragePct}% Covered ({coveredSlots}/{totalSlots})
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
              24h UTC Ministry timeline · 30-min intervals · Click empty slots to assign players
            </p>
          </div>
        </div>

        {/* Day switch & Hide Covered toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Day 1 vs Day 4 Switch */}
          <div className="flex items-center p-1 rounded-xl"
            style={{ background: '#0a0b0f', border: '1px solid #1c1f2e' }}>
            <button
              onClick={() => setActiveDay('day1')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={activeDay === 'day1'
                ? { background: 'rgba(76, 110, 245, 0.22)', color: '#748ffc', border: '1px solid rgba(76, 110, 245, 0.45)', boxShadow: '0 0 12px rgba(92,124,250,0.25)' }
                : { color: '#6b7280', border: '1px solid transparent' }}
            >
              <span>⚒️</span>
              <span>Day 1</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold"
                style={{ background: 'rgba(0,0,0,0.4)', color: activeDay === 'day1' ? '#a5b4fc' : '#4b5563' }}>
                {d1UnclaimedCount} free
              </span>
            </button>

            <button
              onClick={() => setActiveDay('day4')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={activeDay === 'day4'
                ? { background: 'rgba(245, 158, 11, 0.22)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.45)', boxShadow: '0 0 12px rgba(245,158,11,0.25)' }
                : { color: '#6b7280', border: '1px solid transparent' }}
            >
              <span>⚔️</span>
              <span>Day 4</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold"
                style={{ background: 'rgba(0,0,0,0.4)', color: activeDay === 'day4' ? '#fde68a' : '#4b5563' }}>
                {d4UnclaimedCount} free
              </span>
            </button>
          </div>

          {/* Hide Covered Slots Toggle */}
          <button
            onClick={() => setHideCovered(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={hideCovered
              ? { background: 'rgba(244, 63, 94, 0.16)', border: '1px solid rgba(244, 63, 94, 0.45)', color: '#fda4af' }
              : { background: '#0a0b0f', border: '1px solid #1c1f2e', color: '#9ca3af' }}
          >
            {hideCovered ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{hideCovered ? 'Showing Free Only' : 'Hide Covered'}</span>
            <span className="sm:hidden">{hideCovered ? 'Free Only' : 'Hide'}</span>
            {hideCovered && (
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold"
                style={{ background: 'rgba(244, 63, 94, 0.3)', color: '#fff' }}>
                {unclaimedSlots}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Legend & Summary Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1c1f2e]/70 text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded"
              style={{ background: 'rgba(244,63,94,0.06)', border: '1px dashed rgba(244,63,94,0.55)' }} />
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              Unclaimed: <strong className="text-rose-400">{unclaimedSlots}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded"
              style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.55)' }} />
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              Covered: <strong className="text-emerald-400">{coveredSlots - conflictSlots}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded"
              style={{ background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.65)' }} />
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              Conflict: <strong className="text-amber-400">{conflictSlots}</strong>
            </span>
          </div>
        </div>

        <div className="text-[11px]" style={{ color: '#4b5563' }}>
          Showing {displayedSlots.length} of {totalSlots} slots
        </div>
      </div>

      {/* Heatmap Grid */}
      {displayedSlots.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-center"
          style={{ background: '#0a0b0f', border: '1px dashed #1c1f2e', borderRadius: 16 }}>
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-bold text-white">Full 100% Slot Coverage!</p>
          <p className="text-xs text-gray-500">Every single 30-min time slot is claimed for {activeDay === 'day1' ? 'Day 1' : 'Day 4'}.</p>
          <button
            onClick={() => setHideCovered(false)}
            className="text-xs mt-2 underline text-indigo-400 hover:text-indigo-300">
            Show all slots
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
          {displayedSlots.map(({ slot, signups, count, status }) => {
            const isUnclaimed = status === 'unclaimed'
            const isCovered   = status === 'covered'
            const isConflict  = status === 'conflict'

            let borderStyle, bgStyle, glowStyle
            if (isUnclaimed) {
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
                onClick={() => {
                  if (isUnclaimed) {
                    onSelectUnclaimedSlot(activeDay, slot.value)
                  }
                }}
                onMouseEnter={(e) => handleCellHover(e, slot, signups, status)}
                onMouseLeave={handleCellLeave}
                className={`group relative flex flex-col justify-between p-2 rounded-xl transition-all select-none ${
                  isUnclaimed
                    ? 'cursor-pointer hover:border-rose-400 hover:bg-rose-950/25 active:scale-95'
                    : 'cursor-pointer hover:border-indigo-400 hover:bg-opacity-80'
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
                  <span className="font-mono text-xs font-bold text-gray-200">
                    {slot.value}
                  </span>
                  {isConflict && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded"
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
                    <span className="text-[10px] text-rose-400 font-mono font-medium group-hover:text-rose-300">
                      FREE
                    </span>
                  )}
                </div>

                {/* Bottom line: Content */}
                <div className="mt-1">
                  {isUnclaimed ? (
                    <div className="flex items-center gap-1 text-[11px] text-rose-300/80 group-hover:text-rose-200">
                      <Plus className="w-3 h-3 shrink-0" />
                      <span className="font-medium truncate text-[10px]">Assign</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-white truncate max-w-[70px] sm:max-w-[85px]">
                          {topPlayer?.player_name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                          {topPlayer?._roi ? fmtGold(topPlayer._roi) : '—'}
                        </span>
                      </div>
                      {isConflict && (
                        <span className="text-[9px] text-amber-300/90 font-medium truncate">
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
      )}

      {/* Floating Hover Tooltip (Portaled / Absolute viewport position) */}
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
            {/* Tooltip Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c1f2e]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: '#748ffc' }} />
                <span className="font-bold text-xs text-white">{hoveredData.slot.label}</span>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
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
                  ? `⚠️ ${hoveredData.signups.length} Conflicts`
                  : hoveredData.status === 'covered'
                    ? '1 Booking'
                    : 'Unclaimed'}
              </span>
            </div>

            {/* Tooltip Content */}
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
                        <span className="font-bold text-xs text-white truncate">{player.player_name}</span>
                        <AllianceBadge alliance={player.alliance} />
                      </div>
                      <RoiPill score={player._roi} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-[#1c1f2e]/40">
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
                  <p className="text-[10px] text-amber-300/90 italic text-center pt-0.5">
                    👑 Ranked by ROI score · highest recommended
                  </p>
                )}
              </div>
            ) : (
              <div className="py-2 text-center text-xs">
                <p className="font-semibold text-rose-300">Unclaimed Time Slot</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Click this slot to manually book a player</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin Toast ──────────────────────────────────────────────────────────────
function AdminToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onClose, 3200)
    return () => clearTimeout(id)
  }, [toast, onClose])

  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="fixed bottom-6 right-6 z-[80]"
      style={{ animation:'toastSlide 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div className="flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl"
        style={{ background: ok ? 'rgba(6,78,59,0.97)' : 'rgba(69,10,10,0.97)',
                 border: `1px solid ${ok?'rgba(16,185,129,0.45)':'rgba(244,63,94,0.45)'}`,
                 boxShadow:'0 8px 36px rgba(0,0,0,0.55)', backdropFilter:'blur(12px)' }}>
        {ok
          ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color:'#6ee7b7' }} />
          : <XCircle      className="w-4 h-4 shrink-0" style={{ color:'#fda4af' }} />}
        <p className="text-sm font-semibold text-white pr-1">{toast.msg}</p>
        <button onClick={onClose} className="shrink-0 transition-colors" style={{ color:'#4b5563' }}
          onMouseOver={e=>e.currentTarget.style.color='#e2e8f0'}
          onMouseOut={e =>e.currentTarget.style.color='#4b5563'}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────
function Backdrop({ children, zIndex=50 }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)',
               zIndex, animation:'fadeIn 0.18s ease-out' }}>
      {children}
    </div>
  )
}

// ─── Login Modal ──────────────────────────────────────────────────────────────
function LoginModal({ onSuccess }) {
  const navigate = useNavigate()
  const [pw,    setPw]    = useState('')
  const [err,   setErr]   = useState('')
  const [shake, setShake] = useState(false)
  const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD

  const attempt = (e) => {
    e.preventDefault()
    if (!ADMIN_PW) { console.warn('[Admin] No VITE_ADMIN_PASSWORD — access granted.'); onSuccess(); return }
    if (pw === ADMIN_PW) { onSuccess() }
    else {
      setErr('Incorrect passcode. Try again.')
      setPw(''); setShake(true)
      setTimeout(() => setShake(false), 450)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{ background:'#0a0b0f', animation:'fadeIn 0.2s ease-out' }}>
      <div className="w-full" style={{ maxWidth:360 }}>
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background:'rgba(76,110,245,0.15)', border:'1px solid rgba(76,110,245,0.35)',
                     boxShadow:'0 0 32px rgba(92,124,250,0.2)', animation:'subtleGlow 3s ease-in-out infinite' }}>
            <ShieldAlert className="w-8 h-8" style={{ color:'#748ffc' }} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Ministry Admin</h1>
            <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>2323 KvK · R4 Access Only</p>
          </div>
        </div>
        <form onSubmit={attempt} className="rounded-2xl p-6 space-y-4"
          style={{ background:'#0f1117', border:'1px solid #1c1f2e', boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
                   animation:shake?'shake 0.4s ease-out':'slideUp 0.3s ease-out' }}>
          <div className="space-y-1.5">
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em' }}>
              R4 Passcode
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color:'#374151' }} />
              <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr('')}}
                placeholder="Enter passcode…" autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1"
                style={{ background:'#0a0b0f', border:`1px solid ${err?'#f43f5e66':'#1c1f2e'}`, fontSize:16, '--tw-ring-color':'rgba(92,124,250,0.3)' }} />
            </div>
            {err && (
              <p className="flex items-center gap-1.5 text-xs" style={{ color:'#f43f5e', animation:'fadeIn 0.15s' }}>
                <XCircle className="w-3.5 h-3.5 shrink-0" />{err}
              </p>
            )}
          </div>
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{ background:'linear-gradient(135deg,#4c6ef5,#5c7cfa)', boxShadow:'0 0 24px rgba(92,124,250,0.35)', fontSize:14 }}>
            <KeyRound className="w-4 h-4" />Enter Admin Dashboard
          </button>
          <button type="button" onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-all"
            style={{ color:'#4b5563', background:'transparent', border:'1px solid #1c1f2e' }}
            onMouseOver={e=>e.currentTarget.style.color='#9ca3af'}
            onMouseOut={e =>e.currentTarget.style.color='#4b5563'}>
            <ArrowLeft className="w-3.5 h-3.5" />Back to Booking Form
          </button>
        </form>
        <p className="text-center mt-4" style={{ fontSize:10, color:'#2d3748' }}>
          Session-scoped · VITE_ADMIN_PASSWORD
        </p>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ row, loading, onConfirm, onCancel }) {
  return (
    <Backdrop zIndex={60}>
      <div className="w-full rounded-2xl p-6 space-y-5"
        style={{ maxWidth:360, background:'#0f1117', border:'1px solid rgba(244,63,94,0.25)',
                 boxShadow:'0 24px 64px rgba(0,0,0,0.7)', animation:'slideUp 0.25s ease-out' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background:'rgba(244,63,94,0.15)', border:'1px solid rgba(244,63,94,0.3)' }}>
            <Trash2 className="w-5 h-5" style={{ color:'#f43f5e' }} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Delete Booking?</h3>
            <p style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>
              {row.player_name} · <AllianceBadge alliance={row.alliance} />
            </p>
          </div>
        </div>
        <p style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>
          This will permanently remove this appointment. This action cannot be undone.
        </p>
        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background:'#1c1f2e', color:'#9ca3af', border:'1px solid #2a2d3a' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
            style={{ background:'rgba(244,63,94,0.2)', border:'1px solid rgba(244,63,94,0.4)', color:'#fda4af' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Backdrop>
  )
}

// ─── Booking Modal (shared by Add & Edit) ────────────────────────────────────
function BookingModal({ mode = 'edit', row = null, prefill = null, onSave, onClose, saving }) {
  const isAdd = mode === 'add'

  const [f, setF] = useState(() => ({
    playerName:        isAdd ? '' : (row?.player_name ?? ''),
    alliance:          isAdd ? '' : (row?.alliance ?? ''),
    selectedDays:      isAdd
      ? (prefill?.day ? [prefill.day] : [])
      : (row?.selected_days ?? []),
    tcLevel:           isAdd ? '' : (row?.tc_level ?? ''),
    constructionDays:  isAdd ? 0 : (row?.construction_days ?? 0),
    constructionHours: isAdd ? 0 : (row?.construction_hours ?? 0),
    researchDays:      isAdd ? 0 : (row?.research_days ?? 0),
    researchHours:     isAdd ? 0 : (row?.research_hours ?? 0),
    trainingDays:      isAdd ? 0 : (row?.training_days ?? 0),
    trainingHours:     isAdd ? 0 : (row?.training_hours ?? 0),
    trueGold:          isAdd ? '' : (row?.true_gold_count ?? ''),
    timeSlotDay1:      isAdd
      ? (prefill?.day === 'day1' ? prefill.slot : '')
      : (row?.time_slot_day1 ?? ''),
    timeSlotDay4:      isAdd
      ? (prefill?.day === 'day4' ? prefill.slot : '')
      : (row?.time_slot_day4 ?? ''),
  }))

  const set  = (k) => (v) => setF(p => ({ ...p, [k]: v }))
  const setE = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const toggleDay = (id) =>
    setF(p => ({
      ...p,
      selectedDays: p.selectedDays.includes(id)
        ? p.selectedDays.filter(d => d !== id)
        : [...p.selectedDays, id],
    }))

  // Accent colours: emerald for Add, indigo for Edit
  const accent     = isAdd ? '#10b981' : '#4c6ef5'
  const accentText = isAdd ? '#6ee7b7' : '#748ffc'
  const accentBg   = isAdd ? 'rgba(16,185,129,0.15)' : 'rgba(76,110,245,0.15)'
  const accentGlow = isAdd ? 'rgba(16,185,129,0.4)'  : 'rgba(92,124,250,0.4)'
  const btnGrad    = isAdd
    ? 'linear-gradient(135deg,#059669,#10b981)'
    : 'linear-gradient(135deg,#4c6ef5,#5c7cfa)'

  const lbl = { fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em' }
  const inp = { background:'#0a0b0f', border:'1px solid #1c1f2e', color:'#e2e8f0',
                borderRadius:10, padding:'8px 12px', fontSize:14, outline:'none', width:'100%' }

  return (
    <Backdrop zIndex={60}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{ maxWidth:520, maxHeight:'92vh', background:'#0f1117',
                 border:`1px solid ${accent}40`,
                 boxShadow:'0 24px 64px rgba(0,0,0,0.7)', animation:'slideUp 0.28s ease-out' }}>

        {/* Accent bar */}
        <div className="h-0.5 w-full shrink-0"
          style={{ background:`linear-gradient(90deg,${accent},${accentText},transparent)` }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom:'1px solid #1c1f2e', background:'rgba(18,20,28,0.7)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background:accentBg, border:`1px solid ${accent}50` }}>
              {isAdd
                ? <UserPlus className="w-4 h-4" style={{ color:accentText }} />
                : <Pencil   className="w-4 h-4" style={{ color:accentText }} />}
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">{isAdd ? 'Add Player' : 'Edit Booking'}</h2>
              <p style={{ fontSize:11, color:'#4b5563' }}>
                {isAdd
                  ? prefill?.slot
                    ? `Manual entry · pre-selected ${prefill.day === 'day1' ? 'Day 1' : 'Day 4'} (${prefill.slot} UTC)`
                    : 'Manual entry · no Discord notification'
                  : `${row?.player_name} · ${row?.alliance}`}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color:'#4b5563', background:'#12141c' }}
            onMouseOver={e=>e.currentTarget.style.color='#e2e8f0'}
            onMouseOut={e =>e.currentTarget.style.color='#4b5563'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">

          {/* Player Name */}
          <div className="space-y-1.5">
            <p style={lbl}>Player Name</p>
            <input type="text" value={f.playerName} onChange={setE('playerName')}
              placeholder="In-game name…" style={inp} />
          </div>

          {/* Alliance */}
          <div className="space-y-1.5">
            <p style={lbl}>Alliance</p>
            <div className="grid grid-cols-4 gap-2">
              {ALLIANCES.map(a => {
                const s = ALLIANCE_CLR[a]; const sel = f.alliance === a
                return (
                  <button key={a} type="button" onClick={() => set('alliance')(a)}
                    className="py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
                    style={sel
                      ?{border:`1.5px solid ${s.border}`,background:s.bg,color:s.text,boxShadow:`0 0 10px ${s.border}44`}
                      :{border:'1.5px solid #1c1f2e',background:'#0a0b0f',color:'#4b5563'}}>
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          {/* KvK Days */}
          <div className="space-y-1.5">
            <p style={lbl}>KvK Prep Days</p>
            <div className="grid grid-cols-2 gap-2.5">
              {KVK_DAYS.map(d => {
                const sel = f.selectedDays.includes(d.id)
                return (
                  <button key={d.id} type="button" onClick={() => toggleDay(d.id)}
                    className="relative flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all active:scale-97"
                    style={sel
                      ?{border:`1.5px solid ${d.border}`,background:d.bg,boxShadow:d.glow}
                      :{border:'1.5px solid #1c1f2e',background:'#0a0b0f'}}>
                    <span className="flex items-center justify-center rounded-full shrink-0"
                      style={{ width:16, height:16, background:sel?d.border:'transparent', border:sel?'none':'1.5px solid #2a2d4a' }}>
                      {sel && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize:15 }}>{d.emoji}</span>
                    <div className="text-left">
                      <p className="text-xs font-bold leading-tight" style={{ color:sel?d.text:'#6b7280' }}>{d.label}</p>
                      <p style={{ fontSize:10, color:sel?d.text:'#374151', lineHeight:1.3 }}>{d.sub}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* TC Level */}
          <div className="space-y-1.5">
            <p style={lbl}>TC Level</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TC_LEVELS.map(lvl => {
                const gold = TC_IS_GOLD(lvl); const sel = f.tcLevel === lvl
                const aC   = gold ? '#f59e0b' : '#4c6ef5'
                return (
                  <button key={lvl} type="button" onClick={() => set('tcLevel')(lvl)}
                    className="py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
                    style={sel
                      ?{border:`1.5px solid ${aC}`,background:gold?'rgba(245,158,11,0.14)':'rgba(76,110,245,0.14)',
                        color:gold?'#fcd34d':'#748ffc',boxShadow:`0 0 10px ${aC}55`}
                      :{border:`1.5px solid ${gold?'rgba(245,158,11,0.22)':'#1c1f2e'}`,
                        background:gold?'rgba(245,158,11,0.04)':'#0a0b0f',
                        color:gold?'rgba(245,158,11,0.5)':'#374151'}}>
                    {lvl}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Speedups */}
          <div className="space-y-3">
            <p style={lbl}>Speedups (Days / Hours)</p>
            {[['🔨','Construction','constructionDays','constructionHours'],
              ['🧪','Research',    'researchDays',    'researchHours'   ],
              ['⚔️','Training',    'trainingDays',    'trainingHours'   ],
            ].map(([icon,label,dKey,hKey]) => (
              <div key={label} className="flex items-center gap-3">
                <span style={{ width:22, textAlign:'center', fontSize:14, flexShrink:0 }}>{icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#6b7280', width:82, flexShrink:0 }}>{label}</span>
                <div className="flex gap-2 flex-1">
                  {[['Days', dKey, 999], ['Hours', hKey, 23]].map(([unit, key, max]) => (
                    <div key={key} className="flex-1">
                      <input type="number" min="0" max={max} value={f[key]}
                        onChange={e => set(key)(parseInt(e.target.value,10)||0)}
                        style={{ ...inp, textAlign:'center', appearance:'textfield' }} />
                      <p style={{ fontSize:9, color:'#374151', textAlign:'center', marginTop:2, fontWeight:700, textTransform:'uppercase' }}>{unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* True Gold */}
          <div className="space-y-1.5">
            <p style={lbl}>True Gold Count</p>
            <input type="number" min="0" value={f.trueGold}
              onChange={setE('trueGold')} placeholder="e.g. 250000" style={inp} />
          </div>

          {/* Time Slots */}
          {(f.selectedDays.includes('day1') || f.selectedDays.includes('day4')) && (
            <div className="space-y-3">
              <p style={lbl}>Time Slots (UTC)</p>
              {[['day1','⚒️ Day 1 Slot','#748ffc','timeSlotDay1'],
                ['day4','⚔️ Day 4 Slot','#fcd34d','timeSlotDay4']
              ].filter(([id]) => f.selectedDays.includes(id)).map(([,label,color,key]) => (
                <div key={key} className="space-y-1">
                  <p style={{ fontSize:11, color, fontWeight:700 }}>{label}</p>
                  <div className="relative">
                    <select value={f[key]} onChange={setE(key)} dir="ltr"
                      style={{ ...inp, paddingRight:36, appearance:'none', cursor:'pointer' }}>
                      <option value="">Select a slot…</option>
                      {TIME_SLOTS.map(s => <option key={s.value} value={s.value} style={{ background:'#0f1117' }}>{s.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color:'#4b5563' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 shrink-0"
          style={{ borderTop:'1px solid #1c1f2e', background:'rgba(10,11,15,0.5)' }}>
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background:'#1c1f2e', color:'#9ca3af', border:'1px solid #2a2d3a' }}>
            Cancel
          </button>
          <button onClick={() => onSave(f)} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background:saving?'#1c1f2e':btnGrad,
                     boxShadow:saving?'none':`0 0 24px ${accentGlow}55`, fontSize:14 }}>
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isAdd ? <UserPlus className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? (isAdd?'Adding…':'Saving…') : isAdd ? 'Add to Dashboard' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Backdrop>
  )
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('kvk_admin_auth') === 'true')
  const login  = () => { sessionStorage.setItem('kvk_admin_auth','true');  setIsAuthed(true)  }
  const logout = () => { sessionStorage.removeItem('kvk_admin_auth');       setIsAuthed(false) }

  // ── Data ──────────────────────────────────────────────────────────────────────
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Heatmap & Coverage Visualizer State ───────────────────────────────────────
  const [heatmapDay,  setHeatmapDay]  = useState('day1')  // 'day1' | 'day4'
  const [hideCovered, setHideCovered] = useState(false)

  // ── Table Filters & sort ──────────────────────────────────────────────────────
  const [allianceFilter, setAlliance] = useState('ALL')
  const [dayFilter,      setDay]      = useState('ALL')
  const [search,         setSearch]   = useState('')
  const [sort, setSort]               = useState({ col:'_roi', dir:'desc' })

  // ── CRUD modals ───────────────────────────────────────────────────────────────
  const [addModal,      setAddModal]   = useState({ open: false, prefill: null })
  const [addSaving,     setAddSaving]  = useState(false)
  const [editRow,       setEditRow]    = useState(null)
  const [editSaving,    setEditSaving] = useState(false)
  const [deleteTarget,  setDelTarget]  = useState(null)
  const [deleteLoading, setDelLoading] = useState(false)

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [adminToast, setAdminToast] = useState(null)
  const showToast = useCallback((type, msg) => setAdminToast({ type, msg }), [])

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from('kvk_appointments')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      console.error('[Supabase fetch]', err)
      setError(`${err.message}${err.hint?` — ${err.hint}`:''}`)
      setLoading(false); return
    }
    setRows((data??[]).map(enrichRoi))
    setLoading(false)
  }, [])

  useEffect(() => { if (isAuthed) fetchData() }, [isAuthed, fetchData])

  // ── Add player (direct DB insert, no Discord) ─────────────────────────────────
  const handleAddSave = async (f) => {
    setAddSaving(true)
    const payload = buildPayload(f)
    console.log('[Admin Add] Inserting:', payload)

    const { error: err } = await supabase
      .from('kvk_appointments')
      .insert([payload])

    if (err) {
      console.error('[Supabase add]', err)
      alert(`Add failed: ${err.message}${err.hint?`\nHint: ${err.hint}`:''}`)
      setAddSaving(false); return
    }

    setAddSaving(false)
    setAddModal({ open: false, prefill: null })
    showToast('success', `✅ ${f.playerName || 'Player'} added to dashboard`)
    await fetchData()   // refresh so new row appears with correct ROI
  }

  // ── Edit save ─────────────────────────────────────────────────────────────────
  const handleEditSave = async (f) => {
    setEditSaving(true)
    const payload = buildPayload(f)
    const { error: err } = await supabase
      .from('kvk_appointments')
      .update(payload)
      .eq('id', editRow.id)
    if (err) {
      console.error('[Supabase update]', err)
      alert(`Update failed: ${err.message}`)
      setEditSaving(false); return
    }
    setRows(prev => prev.map(r => r.id === editRow.id ? enrichRoi({ ...r, ...payload }) : r))
    setEditSaving(false)
    setEditRow(null)
    showToast('success', `✅ ${f.playerName} updated`)
  }

  // ── Delete confirm ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDelLoading(true)
    const { error: err } = await supabase
      .from('kvk_appointments')
      .delete()
      .eq('id', deleteTarget.id)
    if (err) {
      console.error('[Supabase delete]', err)
      alert(`Delete failed: ${err.message}`)
      setDelLoading(false); return
    }
    const name = deleteTarget.player_name
    setRows(prev => prev.filter(r => r.id !== deleteTarget.id))
    setDelLoading(false); setDelTarget(null)
    showToast('success', `🗑️ ${name}'s booking deleted`)
  }

  // ── Derived stats & conflict calculations ─────────────────────────────────────
  const conflictMap = useMemo(() => buildConflictMap(rows), [rows])

  const displayed = useMemo(() => {
    let res = [...rows]
    if (allianceFilter !== 'ALL') res = res.filter(r => r.alliance === allianceFilter)
    if (dayFilter === 'day1') res = res.filter(r => r.selected_days?.includes('day1'))
    if (dayFilter === 'day4') res = res.filter(r => r.selected_days?.includes('day4'))
    if (dayFilter === 'both') res = res.filter(r =>
      r.selected_days?.includes('day1') && r.selected_days?.includes('day4'))
    if (search.trim()) res = res.filter(r =>
      r.player_name?.toLowerCase().includes(search.toLowerCase()))
    res.sort((a,b) => {
      const av=a[sort.col]??0, bv=b[sort.col]??0
      const cmp = typeof av==='string' ? av.localeCompare(bv) : av-bv
      return sort.dir==='desc' ? -cmp : cmp
    })
    return res
  }, [rows, allianceFilter, dayFilter, search, sort])

  const toggleSort     = (col) => setSort(s => s.col===col?{col,dir:s.dir==='desc'?'asc':'desc'}:{col,dir:'desc'})
  const totalConflicts = rows.filter(r => conflictMap.has(r.id)).length
  const day1Count      = rows.filter(r => r.selected_days?.includes('day1')).length
  const day4Count      = rows.filter(r => r.selected_days?.includes('day4')).length
  const bothCount      = rows.filter(r => r.selected_days?.includes('day1') && r.selected_days?.includes('day4')).length

  // Calculate unique unclaimed slots across both days for summary stat badge
  const d1CoveredCount = useMemo(() => {
    const s = new Set()
    rows.forEach(r => {
      if (r.selected_days?.includes('day1') && r.time_slot_day1) s.add(r.time_slot_day1)
    })
    return s.size
  }, [rows])

  const d4CoveredCount = useMemo(() => {
    const s = new Set()
    rows.forEach(r => {
      if (r.selected_days?.includes('day4') && r.time_slot_day4) s.add(r.time_slot_day4)
    })
    return s.size
  }, [rows])

  const activeUnclaimedCount = heatmapDay === 'day1' ? (48 - d1CoveredCount) : (48 - d4CoveredCount)

  const Th = ({ col, children, right }) => (
    <th onClick={() => toggleSort(col)} className="select-none cursor-pointer whitespace-nowrap"
      style={{ padding:'10px 14px', textAlign:right?'right':'left', fontSize:11, fontWeight:700,
               color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', background:'#0a0b0f',
               borderBottom:'1px solid #1c1f2e', position:'sticky', top:0, zIndex:10 }}>
      {children}<SortIcon col={col} sort={sort} />
    </th>
  )

  // ── Not authed ────────────────────────────────────────────────────────────────
  if (!isAuthed) return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes subtleGlow { 0%,100%{box-shadow:0 0 20px rgba(92,124,250,0.12)} 50%{box-shadow:0 0 36px rgba(92,124,250,0.28)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
      `}</style>
      <LoginModal onSuccess={login} />
    </>
  )

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastSlide { from{opacity:0;transform:translateY(12px) scale(0.94)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes subtleGlow { 0%,100%{box-shadow:0 0 20px rgba(92,124,250,0.12)} 50%{box-shadow:0 0 36px rgba(92,124,250,0.28)} }
        .arow{transition:background 0.1s;}
        .arow:hover{background:rgba(255,255,255,0.025);}
        .arow-conflict{background:rgba(245,158,11,0.07) !important;}
        .arow-conflict:hover{background:rgba(245,158,11,0.12) !important;}
        .fpill{padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
               border:1px solid #1c1f2e;background:#0a0b0f;color:#4b5563;transition:all 0.15s;}
        .fpill:hover{border-color:#2a2d4a;color:#9ca3af;}
        .fpill.on{background:rgba(92,124,250,0.15);border-color:rgba(92,124,250,0.45);color:#748ffc;}
        input[type=text],input[type=number],select{font-size:14px;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
      `}</style>

      <div className="min-h-screen" style={{ background:'#0a0b0f', animation:'fadeIn 0.2s ease-out' }}>

        {/* ── Top bar ── */}
        <div className="sticky top-0 z-30 flex items-center gap-2 px-4 sm:px-6 py-3"
          style={{ background:'rgba(10,11,15,0.93)', borderBottom:'1px solid #1c1f2e', backdropFilter:'blur(12px)' }}>

          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors shrink-0"
            style={{ color:'#6b7280' }}
            onMouseOver={e=>e.currentTarget.style.color='#e2e8f0'}
            onMouseOut={e =>e.currentTarget.style.color='#6b7280'}>
            <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Booking</span>
          </button>

          <div className="flex items-center gap-2 ml-1 mr-auto">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background:'rgba(76,110,245,0.2)', border:'1px solid rgba(76,110,245,0.3)' }}>
              <Crown className="w-3.5 h-3.5" style={{ color:'#748ffc' }} />
            </div>
            <span className="font-bold text-sm text-gray-200 hidden sm:inline">Ministry Admin</span>
            <span className="hidden md:inline text-xs font-medium" style={{ color:'#374151' }}>— 2323 KvK</span>
          </div>

          {/* ── Action buttons ── */}
          {/* Add Player — emerald */}
          <button onClick={() => setAddModal({ open: true, prefill: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7' }}
            onMouseOver={e=>{e.currentTarget.style.background='rgba(16,185,129,0.2)';e.currentTarget.style.borderColor='rgba(16,185,129,0.5)'}}
            onMouseOut={e =>{e.currentTarget.style.background='rgba(16,185,129,0.12)';e.currentTarget.style.borderColor='rgba(16,185,129,0.3)'}}>
            <UserPlus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Add Player</span>
          </button>

          {/* Export CSV — indigo */}
          <button onClick={() => exportCsv(displayed, conflictMap)} disabled={displayed.length===0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background:'rgba(76,110,245,0.12)', border:'1px solid rgba(76,110,245,0.3)', color:'#748ffc' }}>
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </button>

          {/* Refresh */}
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid #1c1f2e', color:'#6b7280' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Logout — rose */}
          <button onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.2)', color:'#f43f5e' }}>
            <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        <div className="px-4 sm:px-6 py-6 space-y-6" style={{ maxWidth:1440, margin:'0 auto' }}>

          {/* Summary Stats Strip (including Unclaimed Slots Badge) */}
          <div className="flex flex-wrap gap-3">
            <StatCard icon={<Users         className="w-3.5 h-3.5" />} label="Total"     value={rows.length} />
            <StatCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Conflicts" value={totalConflicts}
              accent={totalConflicts>0?'rgba(245,158,11,0.5)':undefined} />
            <StatCard icon={<span style={{fontSize:13}}>⚒️</span>} label="Day 1" value={day1Count} accent="rgba(76,110,245,0.5)" />
            <StatCard icon={<span style={{fontSize:13}}>⚔️</span>} label="Day 4" value={day4Count} accent="rgba(245,158,11,0.5)" />
            <StatCard icon={<TrendingUp    className="w-3.5 h-3.5" />} label="Both"      value={bothCount} accent="rgba(139,92,246,0.5)" />
            {/* Quick Stat Badge: Unclaimed Slots */}
            <StatCard
              icon={<Clock className="w-3.5 h-3.5" />}
              label={`Unclaimed (${heatmapDay === 'day1' ? 'D1' : 'D4'})`}
              value={`${activeUnclaimedCount} / 48`}
              accent={activeUnclaimedCount > 0 ? 'rgba(244,63,94,0.6)' : 'rgba(16,185,129,0.6)'}
            />
          </div>

          {/* Conflict Banner */}
          {totalConflicts > 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
              style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color:'#fcd34d' }} />
              <p style={{ fontSize:12, color:'#fcd34d', fontWeight:600, lineHeight:1.5 }}>
                {totalConflicts} booking{totalConflicts!==1?'s':''} share a time slot (amber cells & rows).
                Award the Ministry slot to the player with the highest ROI score.
              </p>
            </div>
          )}

          {/* ── Slot Coverage Visualizer Component (Heatmap) ── */}
          <SlotCoverageVisualizer
            rows={rows}
            activeDay={heatmapDay}
            setActiveDay={setHeatmapDay}
            hideCovered={hideCovered}
            setHideCovered={setHideCovered}
            onSelectUnclaimedSlot={(day, slot) => setAddModal({ open: true, prefill: { day, slot } })}
          />

          {/* Table Filters & Search */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filters:</span>
              <div className="flex flex-wrap gap-1.5">
                {['ALL',...ALLIANCES].map(a => (
                  <button key={a} className={`fpill${allianceFilter===a?' on':''}`} onClick={() => setAlliance(a)}>
                    {a==='ALL'?'All Alliances':a}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-5 hidden sm:block" style={{ background:'#1c1f2e' }} />

            <div className="flex flex-wrap gap-1.5">
              {[['ALL','All Days'],['day1','⚒️ Day 1'],['day4','⚔️ Day 4'],['both','Both']].map(([v,l]) => (
                <button key={v} className={`fpill${dayFilter===v?' on':''}`} onClick={() => setDay(v)}>{l}</button>
              ))}
            </div>

            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color:'#4b5563' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search player…"
                className="pl-9 pr-4 py-2 rounded-xl text-sm placeholder-gray-600 focus:outline-none focus:ring-1"
                style={{ background:'#0f1117', border:'1px solid #1c1f2e', width:180, color:'#e2e8f0',
                         '--tw-ring-color':'rgba(92,124,250,0.3)' }} />
            </div>
          </div>

          {/* Appointments Data Table */}
          {loading ? (
            <div className="flex items-center justify-center py-24 gap-3 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-20 gap-4 text-center">
              <XCircle className="w-10 h-10" style={{ color:'#f43f5e' }} />
              <p className="text-sm font-semibold" style={{ color:'#fda4af' }}>Supabase error</p>
              <p className="text-xs font-mono px-4 py-2 rounded-lg max-w-md" style={{ color:'#9ca3af', background:'#12141c' }}>{error}</p>
              <button onClick={fetchData} className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background:'rgba(76,110,245,0.15)', border:'1px solid rgba(76,110,245,0.3)', color:'#748ffc' }}>Retry</button>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-4">
              <Calendar className="w-10 h-10" style={{ color:'#2d3748' }} />
              <p className="text-sm font-semibold" style={{ color:'#4b5563' }}>
                {rows.length===0 ? 'No appointments yet' : 'No results match the current filters'}
              </p>
              {rows.length===0 && (
                <button onClick={() => setAddModal({ open: true, prefill: null })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7' }}>
                  <UserPlus className="w-4 h-4" />Add First Player
                </button>
              )}
              {(allianceFilter!=='ALL'||dayFilter!=='ALL'||search) && (
                <button onClick={() => {setAlliance('ALL');setDay('ALL');setSearch('')}}
                  className="text-xs underline underline-offset-2" style={{ color:'#748ffc' }}>Clear filters</button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid #1c1f2e' }}>
              <div className="overflow-x-auto">
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr>
                      <Th col="_rank">        #          </Th>
                      <Th col="player_name">  Player     </Th>
                      <Th col="alliance">     Alliance   </Th>
                      <Th col="tc_level">     TC         </Th>
                      <Th col="_days">        Days       </Th>
                      <Th col="time_slot_day1">Day 1 Slot</Th>
                      <Th col="time_slot_day4">Day 4 Slot</Th>
                      <Th col="construction_days">Const  </Th>
                      <Th col="research_days">  Research </Th>
                      <Th col="training_days">  Training </Th>
                      <Th col="true_gold_count" right>Gold</Th>
                      <Th col="_roi"            right>ROI Score</Th>
                      <Th col="_conflict">    ⚠️         </Th>
                      <Th col="created_at">   Submitted  </Th>
                      <th style={{ padding:'10px 14px', fontSize:11, fontWeight:700, color:'#6b7280',
                                   textTransform:'uppercase', letterSpacing:'0.07em', background:'#0a0b0f',
                                   borderBottom:'1px solid #1c1f2e', position:'sticky', top:0, zIndex:10, whiteSpace:'nowrap' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((r, idx) => {
                      const conflicts   = conflictMap.get(r.id)
                      const hasConflict = conflicts && conflicts.size > 0
                      const days = (r.selected_days||[]).map(d=>d==='day1'?'⚒️':'⚔️').join(' ')
                      return (
                        <tr key={r.id} className={`arow${hasConflict?' arow-conflict':''}`}
                          style={{ borderBottom:'1px solid #12141c' }}>
                          <td style={{ padding:'10px 14px', color:'#374151', fontWeight:700, textAlign:'center', minWidth:40 }}>{idx+1}</td>
                          <td style={{ padding:'10px 14px', color:'#e2e8f0', fontWeight:600, whiteSpace:'nowrap', minWidth:130 }}>{r.player_name}</td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><AllianceBadge alliance={r.alliance} /></td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><TcBadge level={r.tc_level} /></td>
                          <td style={{ padding:'10px 14px', fontSize:15, whiteSpace:'nowrap' }}>{days}</td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap', minWidth:130,
                            color:conflicts?.has('day1')?'#fcd34d':'#6b7280', fontWeight:conflicts?.has('day1')?700:400 }}>
                            {fmtSlot(r.time_slot_day1)}
                          </td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap', minWidth:130,
                            color:conflicts?.has('day4')?'#fcd34d':'#6b7280', fontWeight:conflicts?.has('day4')?700:400 }}>
                            {fmtSlot(r.time_slot_day4)}
                          </td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtSpd(r.construction_days,r.construction_hours)}</td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtSpd(r.research_days,r.research_hours)}</td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtSpd(r.training_days,r.training_hours)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', color:'#fcd34d', fontWeight:600, whiteSpace:'nowrap' }}>{fmtGold(r.true_gold_count)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', whiteSpace:'nowrap' }}><RoiPill score={r._roi} /></td>
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}><ConflictPill conflicts={conflicts} /></td>
                          <td style={{ padding:'10px 14px', color:'#4b5563', whiteSpace:'nowrap', fontSize:12 }}>{fmtDate(r.created_at)}</td>
                          <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setEditRow(r)} title="Edit"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                style={{ background:'rgba(76,110,245,0.1)', border:'1px solid rgba(76,110,245,0.25)', color:'#748ffc' }}
                                onMouseOver={e=>{e.currentTarget.style.background='rgba(76,110,245,0.2)';e.currentTarget.style.borderColor='rgba(76,110,245,0.5)'}}
                                onMouseOut={e =>{e.currentTarget.style.background='rgba(76,110,245,0.1)';e.currentTarget.style.borderColor='rgba(76,110,245,0.25)'}}>
                                <Pencil className="w-3 h-3" /><span className="hidden sm:inline">Edit</span>
                              </button>
                              <button onClick={() => setDelTarget(r)} title="Delete"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                style={{ background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.2)', color:'#f43f5e' }}
                                onMouseOver={e=>{e.currentTarget.style.background='rgba(244,63,94,0.18)';e.currentTarget.style.borderColor='rgba(244,63,94,0.45)'}}
                                onMouseOut={e =>{e.currentTarget.style.background='rgba(244,63,94,0.08)';e.currentTarget.style.borderColor='rgba(244,63,94,0.2)'}}>
                                <Trash2 className="w-3 h-3" /><span className="hidden sm:inline">Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop:'1px solid #1c1f2e', background:'#0a0b0f' }}>
                <span style={{ fontSize:11, color:'#374151' }}>
                  Showing <strong style={{ color:'#6b7280' }}>{displayed.length}</strong> of{' '}
                  <strong style={{ color:'#6b7280' }}>{rows.length}</strong> entries
                </span>
                <span style={{ fontSize:11, color:'#2d3748' }}>sorted by {sort.col.replace('_','')} {sort.dir}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Player modal ── */}
      {addModal.open && (
        <BookingModal
          mode="add"
          prefill={addModal.prefill}
          onSave={handleAddSave}
          onClose={() => setAddModal({ open: false, prefill: null })}
          saving={addSaving}
        />
      )}

      {/* ── Edit modal ── */}
      {editRow && (
        <BookingModal
          mode="edit"
          row={editRow}
          onSave={handleEditSave}
          onClose={() => setEditRow(null)}
          saving={editSaving}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {deleteTarget && (
        <DeleteModal
          row={deleteTarget}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDelTarget(null)}
        />
      )}

      {/* ── Admin toast ── */}
      <AdminToast toast={adminToast} onClose={() => setAdminToast(null)} />
    </>
  )
}
