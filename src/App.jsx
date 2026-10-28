import { useState, useCallback } from 'react'
import {
  Crown, Sword, Hammer, FlaskConical, Coins, Calendar, Clock,
  Shield, Send, Loader2, CheckCircle2, XCircle, AlertCircle,
  Sparkles, X, User, ChevronDown
} from 'lucide-react'

// ─── Hardcoded Discord Webhook ────────────────────────────────────────────────
const DISCORD_WEBHOOK_URL =
  'https://discord.com/api/webhooks/1565118471174627478/K5S5SOtF0pnEKRZPLVXhgPIx2b6DNN6xo_iX2bTghUdE7ZLrl8oXzFU7lcjGDbDXds7V'

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLIANCES = ['TEA', 'VIK', 'ERA', 'FFF']

const ALLIANCE_STYLES = {
  TEA: {
    border: 'border-emerald-500/60',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    shadow: '0 0 14px rgba(16,185,129,0.35)',
  },
  VIK: {
    border: 'border-rose-500/60',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    shadow: '0 0 14px rgba(239,68,68,0.35)',
  },
  ERA: {
    border: 'border-violet-500/60',
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    shadow: '0 0 14px rgba(139,92,246,0.35)',
  },
  FFF: {
    border: 'border-amber-500/60',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    shadow: '0 0 14px rgba(245,158,11,0.35)',
  },
}

// Generate 30-min UTC slots 00:00–23:30
const TIME_SLOTS = (() => {
  const slots = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const pad = (n) => String(n).padStart(2, '0')
      const endH = m === 30 ? h + 1 : h
      const endM = m === 30 ? 0 : 30
      slots.push({
        value: `${pad(h)}:${pad(m)}`,
        label: `${pad(h)}:${pad(m)} – ${endH === 24 ? '24:00' : pad(endH) + ':' + pad(endM)} UTC`,
      })
    }
  }
  return slots
})()

const INITIAL_FORM = {
  playerName: '',
  alliance: '',
  constructionSpeedups: '',
  researchSpeedups: '',
  trainingSpeedups: '',
  trueGold: '',
  appointmentDate: '',
  timeSlot: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const [y, mo, d] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[parseInt(mo) - 1]} ${y}`
}

const getSlotLabel = (value) =>
  TIME_SLOTS.find((s) => s.value === value)?.label ?? '—'

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
      style={{ animation: 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
          isSuccess
            ? 'border-emerald-500/40 bg-emerald-950/80'
            : 'border-rose-500/40 bg-rose-950/80'
        }`}
      >
        {isSuccess
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          : <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{toast.message}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ data, onClose }) {
  if (!data) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.25s ease-out' }}
    >
      <div
        className="w-full max-w-sm bg-[#0f1117] border border-[#1c1f2e] rounded-2xl overflow-hidden shadow-2xl"
        style={{ animation: 'slideUp 0.35s ease-out' }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#4c6ef5,#5c7cfa,#748ffc)' }} />

        <div className="p-7 text-center space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(76,110,245,0.15)', border: '1px solid rgba(76,110,245,0.3)', boxShadow: '0 0 30px rgba(92,124,250,0.25)' }}
            >
              <CheckCircle2 className="w-8 h-8 text-primary-400" style={{ color: '#748ffc' }} />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-1">Appointment Booked!</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your request has been sent to the alliance Discord channel.
            </p>
          </div>

          {/* Summary */}
          <div className="bg-[#12141c] border border-[#1c1f2e] rounded-xl p-4 text-left space-y-2.5">
            <Row label="Commander" value={data.playerName} />
            <Row label="Alliance" value={data.alliance} highlight />
            <Row label="Date" value={formatDate(data.appointmentDate)} />
            <Row label="Time Slot" value={getSlotLabel(data.timeSlot)} accent />
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#4c6ef5,#5c7cfa)', boxShadow: '0 0 20px rgba(92,124,250,0.3)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, highlight, accent }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-600 font-medium uppercase tracking-wider shrink-0">{label}</span>
      <span
        className={`text-sm font-semibold text-right truncate ${
          highlight ? 'text-primary-300' : accent ? 'text-amber-300' : 'text-gray-200'
        }`}
        style={highlight ? { color: '#748ffc' } : {}}
      >
        {value || '—'}
      </span>
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, icon, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-400" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-[#1c1f2e]" />
      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-[#1c1f2e]" />
    </div>
  )
}

// ─── Shared input class ───────────────────────────────────────────────────────
const inputCls = (hasError) =>
  `w-full bg-[#0a0b0f] border rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 text-sm
   focus:outline-none focus:ring-1 transition-all duration-200 hover:border-[#3a3d5a]
   ${hasError
     ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
     : 'border-[#1c1f2e] focus:border-[#4c6ef5] focus:ring-[#4c6ef5]/20'}`

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [successData, setSuccessData] = useState(null)

  const showToast = useCallback((type, title, message) => {
    setToast({ type, title, message })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const set = (field) => (e) => {
    const val = e.target ? e.target.value : e
    setForm((prev) => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.playerName.trim())   e.playerName = 'Player name is required.'
    if (!form.alliance)            e.alliance = 'Please select your alliance.'
    if (!form.appointmentDate)     e.appointmentDate = 'Please pick a date.'
    if (!form.timeSlot)            e.timeSlot = 'Please select a time slot.'
    return e
  }

  const buildPayload = (f) => ({
    username: '2323 KvK Ministry Bot',
    embeds: [{
      author: { name: '2323 KvK · Ministry Appointment Booking' },
      title: '⚔️ Ministry Appointment Request',
      color: 0x5c7cfa,
      fields: [
        { name: '👤 Commander',       value: f.playerName,                        inline: true },
        { name: '🛡️ Alliance',        value: f.alliance,                          inline: true },
        { name: '\u200b',             value: '\u200b',                            inline: true },
        { name: '📅 Date',            value: formatDate(f.appointmentDate),        inline: true },
        { name: '🕐 Time Slot (UTC)', value: getSlotLabel(f.timeSlot),            inline: true },
        { name: '\u200b',             value: '\u200b',                            inline: true },
        ...(f.constructionSpeedups ? [{ name: '🔨 Construction Speedups', value: f.constructionSpeedups, inline: true }] : []),
        ...(f.researchSpeedups     ? [{ name: '🧪 Research Speedups',     value: f.researchSpeedups,     inline: true }] : []),
        ...(f.trainingSpeedups     ? [{ name: '⚔️ Training Speedups',     value: f.trainingSpeedups,     inline: true }] : []),
        ...(f.trueGold             ? [{ name: '🪙 True Gold',             value: Number(f.trueGold).toLocaleString(), inline: true }] : []),
      ],
      footer: { text: `2323 KvK · Ministry Booking · Kingshot` },
      timestamp: new Date().toISOString(),
    }],
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('error', 'Check required fields', 'Some fields need your attention.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })

      if (res.ok || res.status === 204) {
        setSuccessData({ ...form })
        setForm(INITIAL_FORM)
        setErrors({})
      } else {
        const text = await res.text()
        showToast('error', 'Submission Failed', `Discord returned status ${res.status}.`)
        console.error('Discord webhook error:', text)
      }
    } catch {
      showToast('error', 'Network Error', 'Could not reach Discord. Check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes toastIn  { from { opacity:0; transform:translateY(16px) scale(0.92) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(24px) }            to { opacity:1; transform:translateY(0) }          }
        @keyframes fadeIn   { from { opacity:0 }                                         to { opacity:1 }                                   }
        @keyframes subtleGlow {
          0%,100% { box-shadow:0 0 20px rgba(92,124,250,0.1), 0 0 0 1px rgba(76,110,245,0.15) }
          50%      { box-shadow:0 0 35px rgba(92,124,250,0.2), 0 0 0 1px rgba(76,110,245,0.25) }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-start px-4 pt-10 pb-16">

        {/* ── Logo / Branding ── */}
        <div className="mb-7 text-center" style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(76,110,245,0.1)', border: '1px solid rgba(76,110,245,0.25)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#748ffc' }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#748ffc' }}>
              Server 2323 · KvK Season
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: "'Rajdhani', sans-serif", background: 'linear-gradient(135deg,#748ffc 0%,#5c7cfa 50%,#91a7ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            2323 KvK
          </h1>
          <p className="text-gray-400 font-semibold text-lg mt-0.5">Ministry Appointment Booking</p>
        </div>

        {/* ── Form Card ── */}
        <div
          className="w-full"
          style={{
            maxWidth: 650,
            background: '#0f1117',
            border: '1px solid #1c1f2e',
            borderRadius: 20,
            overflow: 'hidden',
            animation: 'slideUp 0.45s ease-out, subtleGlow 4s ease-in-out infinite',
          }}
        >
          {/* Card top accent */}
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#4c6ef5,#5c7cfa,#748ffc,transparent)' }} />

          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 space-y-6">

            {/* ── Player Details ── */}
            <div className="space-y-4">
              <Divider label="Player Details" />

              {/* Player Name */}
              <Field
                label="Player Name / In-Game Name"
                icon={<User className="w-3.5 h-3.5" />}
                error={errors.playerName}
              >
                <input
                  type="text"
                  value={form.playerName}
                  onChange={set('playerName')}
                  placeholder="Enter your in-game name…"
                  className={inputCls(errors.playerName)}
                />
              </Field>

              {/* Alliance */}
              <Field
                label="Alliance"
                icon={<Shield className="w-3.5 h-3.5" />}
                error={errors.alliance}
              >
                <div className="grid grid-cols-4 gap-2.5">
                  {ALLIANCES.map((a) => {
                    const s = ALLIANCE_STYLES[a]
                    const selected = form.alliance === a
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({ ...p, alliance: a }))
                          setErrors((p) => ({ ...p, alliance: null }))
                        }}
                        className={`py-2.5 rounded-xl border font-bold text-sm uppercase tracking-widest transition-all duration-200 ${
                          selected ? `${s.border} ${s.bg} ${s.text}` : 'border-[#1c1f2e] bg-[#0a0b0f] text-gray-500 hover:border-[#2a2d4a] hover:text-gray-300'
                        }`}
                        style={selected ? { boxShadow: s.shadow } : {}}
                      >
                        {a}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* ── Speedups & Resources ── */}
            <div className="space-y-4">
              <Divider label="Speedups & Resources" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Construction Speedups" icon={<Hammer className="w-3.5 h-3.5" />}>
                  <input
                    type="text"
                    value={form.constructionSpeedups}
                    onChange={set('constructionSpeedups')}
                    placeholder="e.g. 12d 4h 30m"
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="Research Speedups" icon={<FlaskConical className="w-3.5 h-3.5" />}>
                  <input
                    type="text"
                    value={form.researchSpeedups}
                    onChange={set('researchSpeedups')}
                    placeholder="e.g. 8d 12h"
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="Training Speedups" icon={<Sword className="w-3.5 h-3.5" />}>
                  <input
                    type="text"
                    value={form.trainingSpeedups}
                    onChange={set('trainingSpeedups')}
                    placeholder="e.g. 5d 6h 15m"
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="True Gold Count" icon={<Coins className="w-3.5 h-3.5" />}>
                  <input
                    type="number"
                    min="0"
                    value={form.trueGold}
                    onChange={set('trueGold')}
                    placeholder="e.g. 250000"
                    className={`${inputCls(false)} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  />
                </Field>
              </div>
            </div>

            {/* ── Appointment Scheduling ── */}
            <div className="space-y-4">
              <Divider label="Appointment Scheduling" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Appointment Date" icon={<Calendar className="w-3.5 h-3.5" />} error={errors.appointmentDate}>
                  <input
                    type="date"
                    value={form.appointmentDate}
                    onChange={set('appointmentDate')}
                    min={new Date().toISOString().split('T')[0]}
                    className={inputCls(errors.appointmentDate)}
                  />
                </Field>

                <Field label="Preferred Time Slot (UTC)" icon={<Clock className="w-3.5 h-3.5" />} error={errors.timeSlot}>
                  <div className="relative">
                    <select
                      value={form.timeSlot}
                      onChange={set('timeSlot')}
                      className={`${inputCls(errors.timeSlot)} appearance-none pr-10 ${!form.timeSlot ? 'text-gray-600' : 'text-gray-100'}`}
                    >
                      <option value="" disabled>Select a time slot…</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot.value} value={slot.value} className="bg-[#0f1117] text-gray-100">
                          {slot.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                  </div>
                </Field>
              </div>

              {/* Popular Slots Quick-pick */}
              <div>
                <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">Quick pick</p>
                <div className="flex flex-wrap gap-2">
                  {['08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setForm((p) => ({ ...p, timeSlot: v })); setErrors((p) => ({ ...p, timeSlot: null })) }}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-150"
                      style={
                        form.timeSlot === v
                          ? { background: 'rgba(76,110,245,0.18)', border: '1px solid rgba(76,110,245,0.5)', color: '#91a7ff' }
                          : { background: 'transparent', border: '1px solid #1c1f2e', color: '#4b5563' }
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Submit Button ── */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base text-white transition-all duration-200 focus:outline-none active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 mt-2"
              style={
                submitting
                  ? { background: '#1c1f2e' }
                  : { background: 'linear-gradient(135deg,#4c6ef5 0%,#5c7cfa 60%,#748ffc 100%)', boxShadow: '0 0 32px rgba(92,124,250,0.35), 0 4px 16px rgba(92,124,250,0.2)' }
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Book Ministry Appointment
                </>
              )}
            </button>

          </form>
        </div>

        {/* ── Footer ── */}
        <p className="mt-8 text-xs text-gray-700">
          2323 KvK · Ministry Booking · All times in UTC · 30-minute slots
        </p>
      </div>

      {/* ── Overlays ── */}
      <SuccessModal data={successData} onClose={() => setSuccessData(null)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
