/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
          950: '#2c3e99',
        },
        gold: {
          300: '#ffd700',
          400: '#ffca28',
          500: '#ffb300',
          600: '#ff8f00',
        },
        surface: {
          900: '#0a0b0f',
          800: '#0f1117',
          750: '#12141c',
          700: '#161822',
          600: '#1c1f2e',
          500: '#232640',
          400: '#2a2d4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'Inter', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'toast-in': 'toast-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'toast-out': 'toast-out 0.3s ease-in forwards',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(92,124,250,0.3), 0 0 20px rgba(92,124,250,0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(92,124,250,0.6), 0 0 40px rgba(92,124,250,0.2)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.9)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(-10px) scale(0.95)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(92,124,250,0.3)',
        'glow-md': '0 0 20px rgba(92,124,250,0.4)',
        'glow-lg': '0 0 40px rgba(92,124,250,0.3)',
        'glow-gold': '0 0 20px rgba(255,215,0,0.4)',
        'inner-glow': 'inset 0 0 20px rgba(92,124,250,0.1)',
      },
    },
  },
  plugins: [],
}
