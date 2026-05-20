# TAILWIND MAPPING — KVARTAL

## Настройка `tailwind.config.ts`

```typescript
colors: {
  kv: {
    navy: '#071d3a',
    'navy-light': '#0d2e58',
    red: '#c73333',
    'red-dark': '#9f2525',
    gold: '#c9a66b',
    ink: '#142033',
    muted: '#697386',
    line: '#dbe2ea',
    bg: '#f4f6f8',
    'bg-warm': '#f7f3ec',
  }
},
borderRadius: {
  'kv-main': '18px',
  'kv-form': '12px',
},
maxWidth: {
  'kv-container': '1180px',
}
```

## Соответствие классов

| CSS Class | Tailwind Classes |
|---|---|
| `.container` | `max-w-kv-container mx-auto px-5` |
| `.btn--primary` | `bg-kv-red text-white font-extrabold rounded-full transition-all hover:bg-kv-red-dark hover:-translate-y-px` |
| `.hero` | `relative overflow-hidden bg-[radial-gradient(circle_at_80%_10%,rgba(201,166,107,0.22),transparent_34%),linear-gradient(130deg,rgba(7,29,58,0.98),rgba(7,29,58,0.86)),linear-gradient(45deg,#0d2e58,#071d3a)]` |
| `.eyebrow` | `flex items-center gap-2.5 mb-4.5 text-white/80 text-[13px] font-extrabold uppercase tracking-widest before:content-[''] before:w-[34px] before:h-[2px] before:bg-kv-gold` |
| `.lead-card` | `p-7 border border-white/16 rounded-kv-main bg-white/10 shadow-2xl backdrop-blur-xl` |
