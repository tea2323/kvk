import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Crown, Sword, Hammer, FlaskConical, Coins, Clock,
  Shield, Send, Loader2, CheckCircle2, XCircle, AlertCircle,
  Sparkles, X, User, ChevronDown, Globe, Plus, Minus
} from 'lucide-react'

// ─── Hardcoded Discord Webhook ────────────────────────────────────────────────
const DISCORD_WEBHOOK_URL =
  'https://discord.com/api/webhooks/1565118471174627478/K5S5SOtF0pnEKRZPLVXhgPIx2b6DNN6xo_iX2bTghUdE7ZLrl8oXzFU7lcjGDbDXds7V'

// ─── Translations ─────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
]

const T = {
  en: {
    badge: 'Server 2323 · KvK Season',
    subtitle: 'Ministry Appointment Booking',
    secPlayer: 'Player Details',
    secSpeedups: 'Speedups & Resources',
    secSlot: 'Time Slot',
    labelName: 'Player Name / In-Game Name',
    labelAlliance: 'Alliance',
    labelConstruction: 'Construction',
    labelResearch: 'Research',
    labelTraining: 'Training',
    labelGold: 'True Gold Count',
    labelSlot: 'Preferred Time Slot (UTC)',
    placeholderName: 'Your in-game name…',
    placeholderGold: 'e.g. 250 000',
    placeholderSlot: 'Select a slot…',
    days: 'Days',
    hours: 'Hours',
    btnSubmit: 'Book Ministry Appointment',
    btnSubmitting: 'Submitting…',
    successTitle: 'Appointment Booked!',
    successMsg: 'Your request was sent to the alliance Discord channel.',
    successClose: 'Done',
    errName: 'Player name is required.',
    errAlliance: 'Select your alliance.',
    errSlot: 'Select a time slot.',
    errNetwork: 'Network Error',
    errNetworkMsg: 'Could not reach Discord. Check your connection.',
    errFailed: 'Submission Failed',
    errCheck: 'Fix the highlighted fields.',
    rowCommander: 'Commander',
    rowAlliance: 'Alliance',
    rowSlot: 'Time Slot',
    footer: 'All times UTC · 30-minute slots · 2323 KvK',
  },
  es: {
    badge: 'Servidor 2323 · Temporada KvK',
    subtitle: 'Reserva de Cita en el Ministerio',
    secPlayer: 'Datos del Jugador',
    secSpeedups: 'Aceleradores y Recursos',
    secSlot: 'Franja Horaria',
    labelName: 'Nombre en el Juego',
    labelAlliance: 'Alianza',
    labelConstruction: 'Construcción',
    labelResearch: 'Investigación',
    labelTraining: 'Entrenamiento',
    labelGold: 'Oro Verdadero',
    labelSlot: 'Franja Horaria (UTC)',
    placeholderName: 'Tu nombre en el juego…',
    placeholderGold: 'ej. 250 000',
    placeholderSlot: 'Elige una franja…',
    days: 'Días',
    hours: 'Horas',
    btnSubmit: 'Reservar Cita en el Ministerio',
    btnSubmitting: 'Enviando…',
    successTitle: '¡Cita Reservada!',
    successMsg: 'Tu solicitud fue enviada al canal Discord de la alianza.',
    successClose: 'Listo',
    errName: 'El nombre del jugador es obligatorio.',
    errAlliance: 'Selecciona tu alianza.',
    errSlot: 'Selecciona una franja horaria.',
    errNetwork: 'Error de Red',
    errNetworkMsg: 'No se pudo contactar Discord. Verifica tu conexión.',
    errFailed: 'Error al Enviar',
    errCheck: 'Corrige los campos marcados.',
    rowCommander: 'Comandante',
    rowAlliance: 'Alianza',
    rowSlot: 'Franja Horaria',
    footer: 'Horarios en UTC · Franjas de 30 min · 2323 KvK',
  },
  pt: {
    badge: 'Servidor 2323 · Temporada KvK',
    subtitle: 'Reserva de Consulta no Ministério',
    secPlayer: 'Dados do Jogador',
    secSpeedups: 'Aceleradores e Recursos',
    secSlot: 'Horário',
    labelName: 'Nome no Jogo',
    labelAlliance: 'Aliança',
    labelConstruction: 'Construção',
    labelResearch: 'Pesquisa',
    labelTraining: 'Treinamento',
    labelGold: 'Ouro Verdadeiro',
    labelSlot: 'Horário Preferido (UTC)',
    placeholderName: 'Seu nome no jogo…',
    placeholderGold: 'ex. 250 000',
    placeholderSlot: 'Escolha um horário…',
    days: 'Dias',
    hours: 'Horas',
    btnSubmit: 'Reservar Consulta no Ministério',
    btnSubmitting: 'Enviando…',
    successTitle: 'Consulta Reservada!',
    successMsg: 'Sua solicitação foi enviada ao canal Discord da aliança.',
    successClose: 'Feito',
    errName: 'Nome do jogador é obrigatório.',
    errAlliance: 'Selecione sua aliança.',
    errSlot: 'Selecione um horário.',
    errNetwork: 'Erro de Rede',
    errNetworkMsg: 'Não foi possível alcançar o Discord.',
    errFailed: 'Falha no Envio',
    errCheck: 'Corrija os campos destacados.',
    rowCommander: 'Comandante',
    rowAlliance: 'Aliança',
    rowSlot: 'Horário',
    footer: 'Horários em UTC · Intervalos de 30 min · 2323 KvK',
  },
  ar: {
    badge: 'خادم 2323 · موسم KvK',
    subtitle: 'حجز موعد الوزارة',
    secPlayer: 'بيانات اللاعب',
    secSpeedups: 'التسريعات والموارد',
    secSlot: 'الفترة الزمنية',
    labelName: 'اسم اللاعب / الاسم في اللعبة',
    labelAlliance: 'التحالف',
    labelConstruction: 'البناء',
    labelResearch: 'البحث',
    labelTraining: 'التدريب',
    labelGold: 'الذهب الحقيقي',
    labelSlot: 'الفترة الزمنية المفضلة (UTC)',
    placeholderName: 'اسمك في اللعبة…',
    placeholderGold: 'مثال: 250000',
    placeholderSlot: 'اختر فترة زمنية…',
    days: 'أيام',
    hours: 'ساعات',
    btnSubmit: 'احجز موعد الوزارة',
    btnSubmitting: 'جارٍ الإرسال…',
    successTitle: 'تم حجز الموعد!',
    successMsg: 'تم إرسال طلبك إلى قناة Discord للتحالف.',
    successClose: 'تم',
    errName: 'اسم اللاعب مطلوب.',
    errAlliance: 'اختر تحالفك.',
    errSlot: 'اختر فترة زمنية.',
    errNetwork: 'خطأ في الشبكة',
    errNetworkMsg: 'تعذر الوصول إلى Discord.',
    errFailed: 'فشل الإرسال',
    errCheck: 'صحح الحقول المميزة.',
    rowCommander: 'القائد',
    rowAlliance: 'التحالف',
    rowSlot: 'الفترة الزمنية',
    footer: '2323 KvK · جميع الأوقات بتوقيت UTC · فترات 30 دقيقة',
  },
  de: {
    badge: 'Server 2323 · KvK-Saison',
    subtitle: 'Ministerium Terminbuchung',
    secPlayer: 'Spielerdaten',
    secSpeedups: 'Beschleuniger & Ressourcen',
    secSlot: 'Zeitfenster',
    labelName: 'Spielername / In-Game-Name',
    labelAlliance: 'Allianz',
    labelConstruction: 'Bau',
    labelResearch: 'Forschung',
    labelTraining: 'Training',
    labelGold: 'Echtes Gold',
    labelSlot: 'Zeitfenster (UTC)',
    placeholderName: 'Dein In-Game-Name…',
    placeholderGold: 'z.B. 250 000',
    placeholderSlot: 'Zeitfenster wählen…',
    days: 'Tage',
    hours: 'Stunden',
    btnSubmit: 'Ministeriumstermin buchen',
    btnSubmitting: 'Wird gesendet…',
    successTitle: 'Termin gebucht!',
    successMsg: 'Deine Anfrage wurde an den Discord-Kanal gesendet.',
    successClose: 'Fertig',
    errName: 'Spielername ist erforderlich.',
    errAlliance: 'Wähle deine Allianz.',
    errSlot: 'Wähle ein Zeitfenster.',
    errNetwork: 'Netzwerkfehler',
    errNetworkMsg: 'Discord konnte nicht erreicht werden.',
    errFailed: 'Übermittlung fehlgeschlagen',
    errCheck: 'Korrigiere die markierten Felder.',
    rowCommander: 'Kommandant',
    rowAlliance: 'Allianz',
    rowSlot: 'Zeitfenster',
    footer: 'Alle Zeiten UTC · 30-Minuten-Slots · 2323 KvK',
  },
}

// ─── Alliance config ──────────────────────────────────────────────────────────
const ALLIANCES = ['TEA', 'VIK', 'ERA', 'FFF']
const ALLIANCE_STYLES = {
  TEA: { border: '#10b981', bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7', glow: '0 0 16px rgba(16,185,129,0.4)' },
  VIK: { border: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  text: '#fda4af', glow: '0 0 16px rgba(244,63,94,0.4)'  },
  ERA: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', text: '#c4b5fd', glow: '0 0 16px rgba(139,92,246,0.4)' },
  FFF: { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: '#fcd34d', glow: '0 0 16px rgba(245,158,11,0.4)' },
}

// ─── UTC Time Slots ───────────────────────────────────────────────────────────
const TIME_SLOTS = (() => {
  const slots = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const p = (n) => String(n).padStart(2, '0')
      const eH = m === 30 ? h + 1 : h
      const eM = m === 30 ? 0 : 30
      slots.push({
        value: `${p(h)}:${p(m)}`,
        label: `${p(h)}:${p(m)} – ${eH === 24 ? '24:00' : p(eH) + ':' + p(eM)} UTC`,
      })
    }
  }
  return slots
})()

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtSpeedups = (days, hours) => {
  if (!days && !hours) return null
  if (days && hours) return `${days}d ${hours}h`
  return days ? `${days}d` : `${hours}h`
}
const getSlotLabel = (v) => TIME_SLOTS.find((s) => s.value === v)?.label ?? '—'

const INITIAL_FORM = {
  playerName: '',
  alliance: '',
  constructionDays: 0, constructionHours: 0,
  researchDays: 0,     researchHours: 0,
  trainingDays: 0,     trainingHours: 0,
  trueGold: '',
  timeSlot: '',
}

// ─── Language Switcher ────────────────────────────────────────────────────────
function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGUAGES.find((l) => l.code === lang)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors select-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown className="w-3 h-3 opacity-60" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-30 rounded-xl overflow-hidden py-1"
          style={{ minWidth: 140, background: '#161820', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', animation: 'fadeIn 0.15s ease-out' }}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
              style={{
                color: l.code === lang ? '#748ffc' : '#9ca3af',
                background: l.code === lang ? 'rgba(92,124,250,0.12)' : 'transparent',
                fontWeight: l.code === lang ? 600 : 400,
              }}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Speedup Stepper Row ──────────────────────────────────────────────────────
function SpeedupRow({ icon, label, days, hours, onDays, onHours, t, isRTL }) {
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val))

  const Counter = ({ value, onChange, max, unitLabel }) => {
    const [inputVal, setInputVal] = useState(String(value))

    useEffect(() => { setInputVal(String(value)) }, [value])

    const commit = (raw) => {
      const n = parseInt(raw, 10)
      onChange(isNaN(n) ? 0 : clamp(n, 0, max))
    }

    return (
      <div
        className="flex-1 flex items-stretch rounded-xl overflow-hidden"
        style={{ background: '#0a0b0f', border: '1px solid #1c1f2e', minHeight: 56 }}
      >
        <button
          type="button"
          onPointerDown={() => onChange(clamp(value - 1, 0, max))}
          className="flex items-center justify-center text-gray-500 active:text-white transition-colors select-none"
          style={{ width: 44, fontSize: 22, fontWeight: 300 }}
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={inputVal}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(inputVal) }}
            className="w-full text-center bg-transparent text-white font-bold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ fontSize: 22, lineHeight: 1 }}
            min={0}
            max={max}
          />
          <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {unitLabel}
          </span>
        </div>
        <button
          type="button"
          onPointerDown={() => onChange(clamp(value + 1, 0, max))}
          className="flex items-center justify-center text-gray-500 active:text-white transition-colors select-none"
          style={{ width: 44, fontSize: 22, fontWeight: 300 }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <span style={{ color: '#374151' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
        {(days > 0 || hours > 0) && (
          <span
            className="ml-auto"
            style={{ fontSize: 11, fontWeight: 600, color: '#748ffc', background: 'rgba(92,124,250,0.12)', borderRadius: 6, padding: '1px 7px', border: '1px solid rgba(92,124,250,0.2)' }}
          >
            {fmtSpeedups(days, hours)}
          </span>
        )}
      </div>
      <div className="flex gap-2.5" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <Counter value={days}  onChange={onDays}  max={999} unitLabel={t.days}  />
        <Counter value={hours} onChange={onHours} max={23}  unitLabel={t.hours} />
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4500)
    return () => clearTimeout(id)
  }, [toast, onDismiss])

  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
      style={{ transform: 'translateX(-50%)', animation: 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <div
        className="flex items-start gap-3 p-4 rounded-2xl backdrop-blur-xl"
        style={{
          background: ok ? 'rgba(6,78,59,0.9)' : 'rgba(69,10,10,0.9)',
          border: `1px solid ${ok ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {ok
          ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#6ee7b7' }} />
          : <XCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#fda4af' }} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100">{toast.title}</p>
          {toast.msg && <p className="text-xs text-gray-400 mt-0.5">{toast.msg}</p>}
        </div>
        <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ data, t, onClose }) {
  if (!data) return null
  const s = ALLIANCE_STYLES[data.alliance] || {}
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease-out' }}
    >
      <div
        className="w-full overflow-hidden"
        style={{ maxWidth: 360, background: '#0f1117', border: '1px solid #1c1f2e', borderRadius: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.7)', animation: 'slideUp 0.35s ease-out' }}
      >
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#4c6ef5,#748ffc,transparent)' }} />
        <div className="p-7 flex flex-col items-center gap-5 text-center">
          {/* Pulsing check */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(76,110,245,0.12)', border: '1px solid rgba(76,110,245,0.3)', boxShadow: '0 0 40px rgba(92,124,250,0.25)', animation: 'subtleGlow 3s ease-in-out infinite' }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: '#748ffc' }} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">{t.successTitle}</h2>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.successMsg}</p>
          </div>

          {/* Summary card */}
          <div className="w-full rounded-xl p-4 space-y-3 text-left" style={{ background: '#12141c', border: '1px solid #1c1f2e' }}>
            <SummaryRow label={t.rowCommander} value={data.playerName} />
            <SummaryRow
              label={t.rowAlliance}
              value={
                <span className="font-bold px-2 py-0.5 rounded-lg text-xs uppercase tracking-widest"
                  style={{ color: s.text, background: s.bg, border: `1px solid ${s.border}` }}>
                  {data.alliance}
                </span>
              }
            />
            <SummaryRow label={t.rowSlot} value={getSlotLabel(data.timeSlot)} accent />
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#4c6ef5,#5c7cfa)', boxShadow: '0 0 24px rgba(92,124,250,0.35)' }}
          >
            {t.successClose}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
        {label}
      </span>
      <span className={`text-sm font-semibold text-right ${accent ? '' : 'text-gray-200'}`}
        style={accent ? { color: '#fbbf24' } : {}}>
        {value || '—'}
      </span>
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="flex-1 h-px" style={{ background: '#1c1f2e' }} />
      <span style={{ fontSize: 10, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: '#1c1f2e' }} />
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, icon, error, isRTL, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center gap-1.5" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {icon && <span style={{ color: '#374151' }}>{icon}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {label}
          </span>
        </div>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs" style={{ color: '#f43f5e', animation: 'fadeIn 0.2s ease-out' }}>
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

const inputCls = (hasError) => [
  'w-full rounded-xl px-4 py-3.5 text-sm text-gray-100 placeholder-gray-600 transition-all duration-200',
  'focus:outline-none',
  hasError
    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
    : 'focus:ring-1',
].join(' ')

const inputStyle = (hasError) => ({
  background: '#0a0b0f',
  border: `1px solid ${hasError ? '#f43f5e66' : '#1c1f2e'}`,
  outline: 'none',
})

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang]   = useState('en')
  const [form, setForm]   = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]   = useState(null)
  const [successData, setSuccessData] = useState(null)

  const t      = T[lang]
  const isRTL  = lang === 'ar'

  const showToast = useCallback((type, title, msg) => {
    setToast({ type, title, msg })
  }, [])

  const set = (field) => (val) => {
    setForm((p) => ({ ...p, [field]: val }))
    setErrors((p) => ({ ...p, [field]: null }))
  }

  const setField = (field) => (e) => set(field)(e.target.value)

  const validate = () => {
    const e = {}
    if (!form.playerName.trim()) e.playerName = t.errName
    if (!form.alliance)           e.alliance   = t.errAlliance
    if (!form.timeSlot)           e.timeSlot   = t.errSlot
    return e
  }

  const buildPayload = (f) => ({
    username: '2323 KvK Ministry Bot',
    embeds: [{
      author: { name: '2323 KvK · Ministry Appointment Booking' },
      title: '⚔️ Ministry Appointment Request',
      color: 0x5c7cfa,
      fields: [
        { name: '👤 Commander',       value: f.playerName, inline: true },
        { name: '🛡️ Alliance',        value: f.alliance,   inline: true },
        { name: '\u200b',             value: '\u200b',     inline: true },
        { name: '🕐 Time Slot (UTC)', value: getSlotLabel(f.timeSlot), inline: false },
        ...(fmtSpeedups(f.constructionDays, f.constructionHours) ? [{ name: '🔨 Construction', value: fmtSpeedups(f.constructionDays, f.constructionHours), inline: true }] : []),
        ...(fmtSpeedups(f.researchDays,     f.researchHours)     ? [{ name: '🧪 Research',     value: fmtSpeedups(f.researchDays,     f.researchHours),     inline: true }] : []),
        ...(fmtSpeedups(f.trainingDays,     f.trainingHours)     ? [{ name: '⚔️ Training',     value: fmtSpeedups(f.trainingDays,     f.trainingHours),     inline: true }] : []),
        ...(f.trueGold ? [{ name: '🪙 True Gold', value: Number(f.trueGold).toLocaleString(), inline: true }] : []),
      ],
      footer: { text: '2323 KvK · Ministry Booking · Kingshot' },
      timestamp: new Date().toISOString(),
    }],
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      showToast('error', t.errCheck, null)
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
        showToast('error', t.errFailed, `Status ${res.status}`)
      }
    } catch {
      showToast('error', t.errNetwork, t.errNetworkMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes toastIn  { from{opacity:0;transform:translateX(-50%) translateY(16px) scale(0.92)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes subtleGlow {
          0%,100%{box-shadow:0 0 20px rgba(92,124,250,0.12),0 0 0 1px rgba(76,110,245,0.12)}
          50%{box-shadow:0 0 40px rgba(92,124,250,0.25),0 0 0 1px rgba(76,110,245,0.22)}
        }
        @keyframes cardGlow {
          0%,100%{box-shadow:0 0 0 1px rgba(76,110,245,0.12),0 24px 64px rgba(0,0,0,0.5)}
          50%{box-shadow:0 0 0 1px rgba(76,110,245,0.22),0 24px 64px rgba(0,0,0,0.5),0 0 40px rgba(92,124,250,0.08)}
        }
        /* Prevent number input zoom on iOS */
        input[type='number'] { font-size: 16px; }
        input[type='text']   { font-size: 16px; }
        select               { font-size: 16px; }
      `}</style>

      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex flex-col items-center justify-start px-4 py-8 sm:py-12"
      >
        {/* ── Brand header ── */}
        <div className="w-full text-center mb-6" style={{ maxWidth: 650, animation: 'slideUp 0.35s ease-out' }}>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3"
            style={{ background: 'rgba(76,110,245,0.1)', border: '1px solid rgba(76,110,245,0.22)' }}
          >
            <Sparkles className="w-3 h-3" style={{ color: '#748ffc' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#748ffc', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t.badge}
            </span>
          </div>
          <h1
            className="font-bold tracking-tight leading-none mb-1"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 'clamp(2rem, 8vw, 2.75rem)',
              background: 'linear-gradient(135deg,#748ffc 0%,#5c7cfa 50%,#91a7ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            2323 KvK
          </h1>
          <p style={{ color: '#9ca3af', fontWeight: 500, fontSize: '1rem' }}>{t.subtitle}</p>
        </div>

        {/* ── Form Card ── */}
        <div
          className="w-full overflow-hidden"
          style={{
            maxWidth: 650,
            background: '#0f1117',
            borderRadius: 22,
            animation: 'slideUp 0.4s ease-out, cardGlow 5s ease-in-out infinite',
          }}
        >
          {/* Top gradient bar */}
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#4c6ef5 0%,#748ffc 60%,transparent 100%)' }} />

          {/* Card header: title + lang switcher */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid #1c1f2e', background: 'rgba(18,20,28,0.5)' }}
          >
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4" style={{ color: '#4c6ef5' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ministry Booking
              </span>
            </div>
            <LangSwitcher lang={lang} setLang={setLang} />
          </div>

          <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 space-y-5">

            {/* ── Player Details ── */}
            <div className="space-y-4">
              <Divider label={t.secPlayer} />

              {/* Player Name */}
              <Field
                label={t.labelName}
                icon={<User className="w-3.5 h-3.5" />}
                error={errors.playerName}
                isRTL={isRTL}
              >
                <input
                  type="text"
                  value={form.playerName}
                  onChange={setField('playerName')}
                  placeholder={t.placeholderName}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={inputCls(errors.playerName)}
                  style={inputStyle(errors.playerName)}
                />
              </Field>

              {/* Alliance */}
              <Field
                label={t.labelAlliance}
                icon={<Shield className="w-3.5 h-3.5" />}
                error={errors.alliance}
                isRTL={isRTL}
              >
                <div className="grid grid-cols-4 gap-2.5">
                  {ALLIANCES.map((a) => {
                    const s = ALLIANCE_STYLES[a]
                    const selected = form.alliance === a
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => { set('alliance')(a) }}
                        className="py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 active:scale-95"
                        style={selected
                          ? { border: `1px solid ${s.border}`, background: s.bg, color: s.text, boxShadow: s.glow }
                          : { border: '1px solid #1c1f2e', background: '#0a0b0f', color: '#4b5563' }
                        }
                      >
                        {a}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* ── Speedups ── */}
            <div className="space-y-4">
              <Divider label={t.secSpeedups} />

              <SpeedupRow
                icon={<Hammer className="w-3.5 h-3.5" />}
                label={t.labelConstruction}
                days={form.constructionDays}
                hours={form.constructionHours}
                onDays={set('constructionDays')}
                onHours={set('constructionHours')}
                t={t}
                isRTL={isRTL}
              />
              <SpeedupRow
                icon={<FlaskConical className="w-3.5 h-3.5" />}
                label={t.labelResearch}
                days={form.researchDays}
                hours={form.researchHours}
                onDays={set('researchDays')}
                onHours={set('researchHours')}
                t={t}
                isRTL={isRTL}
              />
              <SpeedupRow
                icon={<Sword className="w-3.5 h-3.5" />}
                label={t.labelTraining}
                days={form.trainingDays}
                hours={form.trainingHours}
                onDays={set('trainingDays')}
                onHours={set('trainingHours')}
                t={t}
                isRTL={isRTL}
              />

              {/* True Gold */}
              <Field
                label={t.labelGold}
                icon={<Coins className="w-3.5 h-3.5" />}
                isRTL={isRTL}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={form.trueGold}
                  onChange={setField('trueGold')}
                  placeholder={t.placeholderGold}
                  dir="ltr"
                  className={`${inputCls(false)} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  style={{ ...inputStyle(false), textAlign: isRTL ? 'right' : 'left' }}
                />
              </Field>
            </div>

            {/* ── Time Slot ── */}
            <div className="space-y-4">
              <Divider label={t.secSlot} />

              <Field
                label={t.labelSlot}
                icon={<Clock className="w-3.5 h-3.5" />}
                error={errors.timeSlot}
                isRTL={isRTL}
              >
                <div className="relative">
                  <select
                    value={form.timeSlot}
                    onChange={setField('timeSlot')}
                    className={`${inputCls(errors.timeSlot)} appearance-none pr-10`}
                    style={{
                      ...inputStyle(errors.timeSlot),
                      color: form.timeSlot ? '#f1f5f9' : '#4b5563',
                      paddingRight: isRTL ? 16 : 40,
                      paddingLeft: isRTL ? 40 : 16,
                    }}
                    dir="ltr"
                  >
                    <option value="" disabled style={{ background: '#0f1117' }}>{t.placeholderSlot}</option>
                    {TIME_SLOTS.map((s) => (
                      <option key={s.value} value={s.value} style={{ background: '#0f1117', color: '#f1f5f9' }}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ [isRTL ? 'left' : 'right']: 14, color: '#4b5563' }}
                  />
                </div>
              </Field>
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed"
              style={{
                padding: '16px 24px',
                fontSize: 15,
                background: submitting
                  ? '#1c1f2e'
                  : 'linear-gradient(135deg,#4c6ef5 0%,#5c7cfa 60%,#748ffc 100%)',
                boxShadow: submitting
                  ? 'none'
                  : '0 0 36px rgba(92,124,250,0.4), 0 4px 20px rgba(92,124,250,0.25)',
              }}
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" />{t.btnSubmitting}</>
                : <><Send className="w-5 h-5" />{t.btnSubmit}</>
              }
            </button>

          </form>
        </div>

        {/* ── Footer ── */}
        <p className="mt-6 text-center" style={{ fontSize: 11, color: '#374151' }}>{t.footer}</p>
      </div>

      <SuccessModal data={successData} t={t} onClose={() => setSuccessData(null)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
