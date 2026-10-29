import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Download, Search, AlertTriangle, ArrowLeft,
  Crown, ChevronUp, ChevronDown, Loader2, XCircle, Calendar,
  TrendingUp, Users
} from 'lucide-react'
import { supabase } from './lib/supabase.js'
import { calculateRoiScore } from './lib/roi.js'

// ─── Display constants ────────────────────────────────────────────────────────
const ALLIANCES    = ['TEA', 'VIK', 'ERA', 'FFF']
const ALLIANCE_CLR = {
  TEA: { border:'#10b981', bg:'rgba(16,185,129,0.15)',  text:'#6ee7b7' },
  VIK: { border:'#f43f5e', bg:'rgba(244,63,94,0.15)',   text:'#fda4af' },
  ERA: { border:'#8b5cf6', bg:'rgba(139,92,246,0.15)',  text:'#c4b5fd' },
  FFF: { border:'#f59e0b', bg:'rgba(245,158,11,0.15)',  text:'#fcd34d' },
}

const TC_IS_GOLD  = (v) => v?.startsWith('TG')
const fmtSpd      = (d, h) => (!d && !h) ? '—' : (d && h) ? `${d}d ${h}h` : d ? `${d}d` : `${h}h`
const fmtGold     = (n) => !n ? '—' : n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n)
const fmtDate     = (s) => new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
const fmtSlot     = (v) => {
  if (!v) return '—'
  const [h, m] = v.split(':').map(Number)
  const eH = m === 30 ? h + 1 : h
  const eM = m === 30 ? 0 : 30
  const p  = (n) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)} – ${eH === 24 ? '24:00' : p(eH) + ':' + p(eM)}`
}

// ─── ROI colour thresholds ────────────────────────────────────────────────────
const roiStyle = (score) => {
  if (score >= 4000) return { color:'#6ee7b7', bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)' }
  if (score >= 1500) return { color:'#fcd34d', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)' }
  return               { color:'#9ca3af', bg:'rgba(107,114,128,0.10)',  border:'rgba(107,114,128,0.2)' }
}

// ─── Conflict detection ───────────────────────────────────────────────────────
// Returns Map<id, Set<'day1'|'day4'>>
const buildConflictMap = (rows) => {
  const d1 = {}   // slot → [id, ...]
  const d4 = {}
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
  const hdrs = ['Rank','Player','Alliance','TC Level','Selected Days',
                'Day 1 Slot','Day 4 Slot','Construction','Research','Training',
                'True Gold','ROI Score','Conflict','Submitted At']
  const body = rows.map((r, i) => [
    i + 1,
    r.player_name,
    r.alliance,
    r.tc_level,
    (r.selected_days || []).join(' + '),    // ← correct DB column
    fmtSlot(r.time_slot_day1),
    fmtSlot(r.time_slot_day4),
    fmtSpd(r.construction_days, r.construction_hours),
    fmtSpd(r.research_days,     r.research_hours),
    fmtSpd(r.training_days,     r.training_hours),
    r.true_gold_count ?? 0,                 // ← correct DB column
    r._roi ?? 0,                            // ← client-computed ROI
    conflictMap.has(r.id) ? [...conflictMap.get(r.id)].join('+') : '',
    fmtDate(r.created_at),
  ])
  const csv = [hdrs, ...body]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `kvk-appointments-${new Date().toISOString().slice(0, 10)}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl"
      style={{ background:'#0f1117', border:`1px solid ${accent ?? '#1c1f2e'}`, flex:'1 1 110px' }}>
      <div className="flex items-center gap-1.5" style={{ color: accent ?? '#6b7280' }}>
        {icon}
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
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
        ? { color:'#fcd34d', background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.3)' }
        : { color:'#748ffc', background:'rgba(76,110,245,0.14)', border:'1px solid rgba(76,110,245,0.3)' }}>
      {level}
    </span>
  )
}

function RoiPill({ score }) {
  const s = roiStyle(score ?? 0)
  return (
    <span className="inline-block font-bold text-sm px-2.5 py-0.5 rounded-lg tabular-nums"
      style={{ color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      {(score ?? 0).toLocaleString()}
    </span>
  )
}

function ConflictPill({ conflicts }) {
  if (!conflicts || conflicts.size === 0) return <span style={{ color:'#374151' }}>—</span>
  const days = [...conflicts].map(d => d === 'day1' ? 'D1' : 'D4').join('+')
  return (
    <span className="inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-lg"
      style={{ color:'#fcd34d', background:'rgba(245,158,11,0.18)', border:'1px solid rgba(245,158,11,0.4)' }}>
      <AlertTriangle className="w-3 h-3" />{days}
    </span>
  )
}

function SortIcon({ col, sort }) {
  if (sort.col !== col)
    return <ChevronDown className="w-3 h-3 inline ml-1" style={{ color:'#2d3748' }} />
  return sort.dir === 'desc'
    ? <ChevronDown className="w-3 h-3 inline ml-1" style={{ color:'#748ffc' }} />
    : <ChevronUp   className="w-3 h-3 inline ml-1" style={{ color:'#748ffc' }} />
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const [allianceFilter, setAlliance] = useState('ALL')
  const [dayFilter,      setDay]      = useState('ALL')  // ALL | day1 | day4 | both
  const [search,         setSearch]   = useState('')
  const [sort, setSort]               = useState({ col: '_roi', dir: 'desc' })

  // ── Fetch from Supabase ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    console.log('[Supabase] Fetching kvk_appointments…')

    const { data, error: err } = await supabase
      .from('kvk_appointments')
      .select('*')
      .order('created_at', { ascending: false })  // order by insert time; ROI sorted client-side

    if (err) {
      console.error('[Supabase fetch FAILED]', {
        code:    err.code,
        message: err.message,
        details: err.details,
        hint:    err.hint,
      })
      setError(`${err.message}${err.hint ? ` — ${err.hint}` : ''}`)
      setLoading(false)
      return
    }

    console.log(`[Supabase] ✅ ${(data ?? []).length} row(s) loaded`)

    // Enrich each row with a client-computed ROI score
    // (roi_score column does not exist in DB — computed here)
    const enriched = (data ?? []).map(r => ({
      ...r,
      _roi: calculateRoiScore({
        tcLevel:           r.tc_level,
        constructionDays:  r.construction_days,
        constructionHours: r.construction_hours,
        researchDays:      r.research_days,
        researchHours:     r.research_hours,
        trainingDays:      r.training_days,
        trainingHours:     r.training_hours,
        trueGold:          r.true_gold_count,   // ← correct DB column name
      }),
    }))

    setRows(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Conflict map (across all rows, not just filtered) ─────────────────────
  const conflictMap = useMemo(() => buildConflictMap(rows), [rows])

  // ── Filtered + sorted view ────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let res = [...rows]

    if (allianceFilter !== 'ALL')
      res = res.filter(r => r.alliance === allianceFilter)

    // selected_days is the correct DB column name
    if (dayFilter === 'day1') res = res.filter(r => r.selected_days?.includes('day1'))
    if (dayFilter === 'day4') res = res.filter(r => r.selected_days?.includes('day4'))
    if (dayFilter === 'both') res = res.filter(r =>
      r.selected_days?.includes('day1') && r.selected_days?.includes('day4'))

    if (search.trim())
      res = res.filter(r => r.player_name?.toLowerCase().includes(search.toLowerCase()))

    res.sort((a, b) => {
      const av = a[sort.col] ?? 0
      const bv = b[sort.col] ?? 0
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sort.dir === 'desc' ? -cmp : cmp
    })

    return res
  }, [rows, allianceFilter, dayFilter, search, sort])

  const toggleSort = (col) =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })

  // ── Stats (from all rows, not filtered) ──────────────────────────────────
  const totalConflicts = rows.filter(r => conflictMap.has(r.id)).length
  const day1Count  = rows.filter(r => r.selected_days?.includes('day1')).length
  const day4Count  = rows.filter(r => r.selected_days?.includes('day4')).length
  const bothCount  = rows.filter(r =>
    r.selected_days?.includes('day1') && r.selected_days?.includes('day4')).length

  // ── Column header ─────────────────────────────────────────────────────────
  const Th = ({ col, children, right }) => (
    <th
      onClick={() => toggleSort(col)}
      className="select-none cursor-pointer whitespace-nowrap"
      style={{
        padding: '10px 14px', textAlign: right ? 'right' : 'left',
        fontSize: 11, fontWeight: 700, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        background: '#0a0b0f', borderBottom: '1px solid #1c1f2e',
        position: 'sticky', top: 0, zIndex: 10,
      }}
    >
      {children}<SortIcon col={col} sort={sort} />
    </th>
  )

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .arow { transition: background 0.12s; }
        .arow:hover { background: rgba(255,255,255,0.03); }
        .arow-conflict { background: rgba(245,158,11,0.07) !important; }
        .arow-conflict:hover { background: rgba(245,158,11,0.13) !important; }
        .fpill { padding:5px 12px; border-radius:8px; font-size:12px; font-weight:600;
                 cursor:pointer; border:1px solid #1c1f2e; background:#0a0b0f;
                 color:#4b5563; transition:all 0.15s; }
        .fpill:hover { border-color:#2a2d4a; color:#9ca3af; }
        .fpill.on { background:rgba(92,124,250,0.15); border-color:rgba(92,124,250,0.45); color:#748ffc; }
        input[type=text]{ font-size:14px; }
      `}</style>

      <div className="min-h-screen" style={{ background:'#0a0b0f', animation:'fadeIn 0.25s ease-out' }}>

        {/* ── Top bar ── */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3"
          style={{ background:'rgba(10,11,15,0.93)', borderBottom:'1px solid #1c1f2e', backdropFilter:'blur(12px)' }}>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color:'#6b7280' }}
            onMouseOver={e => e.currentTarget.style.color='#e2e8f0'}
            onMouseOut={e  => e.currentTarget.style.color='#6b7280'}>
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Booking Form</span>
          </button>

          <div className="flex items-center gap-2 ml-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background:'rgba(76,110,245,0.2)', border:'1px solid rgba(76,110,245,0.3)' }}>
              <Crown className="w-3.5 h-3.5" style={{ color:'#748ffc' }} />
            </div>
            <span className="font-bold text-sm" style={{ color:'#e2e8f0' }}>Ministry Admin</span>
            <span className="hidden sm:inline text-xs font-medium" style={{ color:'#374151' }}>— 2323 KvK</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => exportCsv(displayed, conflictMap)}
              disabled={displayed.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background:'rgba(76,110,245,0.12)', border:'1px solid rgba(76,110,245,0.3)', color:'#748ffc' }}>
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid #1c1f2e', color:'#6b7280' }}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-6 space-y-5" style={{ maxWidth:1400, margin:'0 auto' }}>

          {/* ── Stats strip ── */}
          <div className="flex flex-wrap gap-3">
            <StatCard icon={<Users       className="w-3.5 h-3.5" />} label="Total"     value={rows.length} />
            <StatCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Conflicts" value={totalConflicts}
              accent={totalConflicts > 0 ? 'rgba(245,158,11,0.5)' : undefined} />
            <StatCard icon={<span style={{fontSize:13}}>⚒️</span>}  label="Day 1"     value={day1Count} accent="rgba(76,110,245,0.5)"  />
            <StatCard icon={<span style={{fontSize:13}}>⚔️</span>}  label="Day 4"     value={day4Count} accent="rgba(245,158,11,0.5)"  />
            <StatCard icon={<TrendingUp  className="w-3.5 h-3.5" />} label="Both Days" value={bothCount} accent="rgba(139,92,246,0.5)" />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Alliance */}
            <div className="flex flex-wrap gap-1.5">
              {['ALL', ...ALLIANCES].map(a => (
                <button key={a}
                  className={`fpill${allianceFilter === a ? ' on' : ''}`}
                  onClick={() => setAlliance(a)}>
                  {a === 'ALL' ? 'All Alliances' : a}
                </button>
              ))}
            </div>

            <div className="w-px h-5 hidden sm:block" style={{ background:'#1c1f2e' }} />

            {/* Day */}
            <div className="flex flex-wrap gap-1.5">
              {[['ALL','All Days'],['day1','⚒️ Day 1'],['day4','⚔️ Day 4'],['both','Both']].map(([v,l]) => (
                <button key={v} className={`fpill${dayFilter === v ? ' on' : ''}`} onClick={() => setDay(v)}>
                  {l}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color:'#4b5563' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search player…"
                className="pl-9 pr-4 py-2 rounded-xl text-sm placeholder-gray-600 focus:outline-none focus:ring-1"
                style={{ background:'#0f1117', border:'1px solid #1c1f2e', width:180,
                         color:'#e2e8f0', '--tw-ring-color':'rgba(92,124,250,0.3)' }} />
            </div>
          </div>

          {/* ── Conflict banner ── */}
          {totalConflicts > 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
              style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color:'#fcd34d' }} />
              <p style={{ fontSize:12, color:'#fcd34d', fontWeight:600, lineHeight:1.5 }}>
                {totalConflicts} appointment{totalConflicts !== 1 ? 's' : ''} share a time slot (highlighted in amber).
                Award the Ministry slot to the player with the highest ROI score.
              </p>
            </div>
          )}

          {/* ── States ── */}
          {loading ? (
            <div className="flex items-center justify-center py-24 gap-3" style={{ color:'#4b5563' }}>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">Loading appointments…</span>
            </div>

          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <XCircle className="w-10 h-10" style={{ color:'#f43f5e' }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color:'#fda4af' }}>Supabase fetch error</p>
                <p className="text-xs font-mono px-4 py-2 rounded-lg max-w-md" style={{ color:'#9ca3af', background:'#12141c' }}>
                  {error}
                </p>
              </div>
              <p className="text-xs max-w-sm" style={{ color:'#4b5563' }}>
                Check that the <code className="text-gray-400">kvk_appointments</code> table exists and RLS policies
                allow <code className="text-gray-400">SELECT</code>. See the SQL comment in{' '}
                <code className="text-gray-400">src/lib/supabase.js</code>.
              </p>
              <button onClick={fetchData}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background:'rgba(76,110,245,0.15)', border:'1px solid rgba(76,110,245,0.3)', color:'#748ffc' }}>
                Retry
              </button>
            </div>

          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Calendar className="w-10 h-10" style={{ color:'#2d3748' }} />
              <p className="text-sm font-semibold" style={{ color:'#4b5563' }}>
                {rows.length === 0 ? 'No appointments yet' : 'No results match the current filters'}
              </p>
              {(allianceFilter !== 'ALL' || dayFilter !== 'ALL' || search) && (
                <button onClick={() => { setAlliance('ALL'); setDay('ALL'); setSearch('') }}
                  className="text-xs underline underline-offset-2" style={{ color:'#748ffc' }}>
                  Clear filters
                </button>
              )}
            </div>

          ) : (
            /* ── Table ── */
            <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid #1c1f2e' }}>
              <div className="overflow-x-auto">
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr>
                      <Th col="_rank">     #          </Th>
                      <Th col="player_name">Player   </Th>
                      <Th col="alliance">  Alliance   </Th>
                      <Th col="tc_level">  TC         </Th>
                      <Th col="_days">     Days       </Th>
                      <Th col="time_slot_day1">Day 1 Slot</Th>
                      <Th col="time_slot_day4">Day 4 Slot</Th>
                      <Th col="construction_days">Const</Th>
                      <Th col="research_days">Research</Th>
                      <Th col="training_days">Training</Th>
                      <Th col="true_gold_count" right>True Gold</Th>
                      <Th col="_roi"       right>ROI Score</Th>
                      <Th col="_conflict"> ⚠️         </Th>
                      <Th col="created_at">Submitted  </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((r, idx) => {
                      const conflicts   = conflictMap.get(r.id)
                      const hasConflict = conflicts && conflicts.size > 0
                      // selected_days is the correct DB column
                      const days = (r.selected_days || []).map(d => d === 'day1' ? '⚒️' : '⚔️').join(' ')

                      return (
                        <tr key={r.id}
                          className={`arow${hasConflict ? ' arow-conflict' : ''}`}
                          style={{ borderBottom:'1px solid #12141c' }}>
                          {/* # */}
                          <td style={{ padding:'10px 14px', color:'#374151', fontWeight:700, textAlign:'center', minWidth:40 }}>
                            {idx + 1}
                          </td>
                          {/* Player */}
                          <td style={{ padding:'10px 14px', color:'#e2e8f0', fontWeight:600, whiteSpace:'nowrap', minWidth:140 }}>
                            {r.player_name}
                          </td>
                          {/* Alliance */}
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                            <AllianceBadge alliance={r.alliance} />
                          </td>
                          {/* TC */}
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                            <TcBadge level={r.tc_level} />
                          </td>
                          {/* Days (emojis) */}
                          <td style={{ padding:'10px 14px', fontSize:16, whiteSpace:'nowrap' }}>{days}</td>
                          {/* Day 1 slot */}
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap', minWidth:130,
                            color: conflicts?.has('day1') ? '#fcd34d' : '#6b7280',
                            fontWeight: conflicts?.has('day1') ? 700 : 400 }}>
                            {fmtSlot(r.time_slot_day1)}
                          </td>
                          {/* Day 4 slot */}
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap', minWidth:130,
                            color: conflicts?.has('day4') ? '#fcd34d' : '#6b7280',
                            fontWeight: conflicts?.has('day4') ? 700 : 400 }}>
                            {fmtSlot(r.time_slot_day4)}
                          </td>
                          {/* Speedups */}
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>
                            {fmtSpd(r.construction_days, r.construction_hours)}
                          </td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>
                            {fmtSpd(r.research_days, r.research_hours)}
                          </td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' }}>
                            {fmtSpd(r.training_days, r.training_hours)}
                          </td>
                          {/* True Gold — correct DB column: true_gold_count */}
                          <td style={{ padding:'10px 14px', textAlign:'right', color:'#fcd34d', fontWeight:600, whiteSpace:'nowrap' }}>
                            {fmtGold(r.true_gold_count)}
                          </td>
                          {/* ROI — client-computed, stored on row as _roi */}
                          <td style={{ padding:'10px 14px', textAlign:'right', whiteSpace:'nowrap' }}>
                            <RoiPill score={r._roi} />
                          </td>
                          {/* Conflict */}
                          <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                            <ConflictPill conflicts={conflicts} />
                          </td>
                          {/* Date */}
                          <td style={{ padding:'10px 14px', color:'#4b5563', whiteSpace:'nowrap', fontSize:12 }}>
                            {fmtDate(r.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop:'1px solid #1c1f2e', background:'#0a0b0f' }}>
                <span style={{ fontSize:11, color:'#374151' }}>
                  Showing <strong style={{ color:'#6b7280' }}>{displayed.length}</strong> of{' '}
                  <strong style={{ color:'#6b7280' }}>{rows.length}</strong> entries
                </span>
                <span style={{ fontSize:11, color:'#2d3748' }}>
                  sorted by {sort.col.replace('_', '')} {sort.dir}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
