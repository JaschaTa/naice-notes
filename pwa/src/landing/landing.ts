// Landing page behaviour: no framework, everything here is decoration on top of static markup
// that reads fine without it. Ported from design-mockups/landing-04-editorial.html.

const OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
const DONE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.5 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z"/></svg>'
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

// Row check circles, as the app draws them.
document.querySelectorAll<HTMLElement>('.r .c').forEach((c) => { c.innerHTML = c.closest('.r')!.classList.contains('done') ? DONE : OPEN })

// Hand photo: the live screen is laid out at 260px wide and scaled into the photo's screen area.
const stage = $('stage')
const phone = stage.querySelector<HTMLElement>('.phone')!
const fit = () => stage.style.setProperty('--k', String(phone.clientWidth / 260))
const hand = stage.querySelector<HTMLImageElement>('.hand-img')!
hand.addEventListener('load', fit)
if (hand.complete) fit()
addEventListener('resize', fit)

// Sections rise in once; the sorted notes in the before → after card follow one by one.
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return
  e.target.classList.add('in')
  io.unobserve(e.target)
  if (e.target.id === 'after') e.target.querySelectorAll<HTMLElement>('.note').forEach((n, i) => { n.style.transitionDelay = `${300 + i * 140}ms` })
}), { threshold: 0.15 })
document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

// Waveforms (the bars only move without reduced motion; see landing.css).
function bars(wave: Element, count: number, base: number, range: number, freq: number, step: number, mod: number) {
  for (let i = 0; i < count; i++) {
    const b = document.createElement('i')
    b.style.height = `${base + Math.round(Math.abs(Math.sin(i * freq)) * range)}px`
    b.style.animationDelay = `${(i % mod) * step}ms`
    wave.appendChild(b)
  }
}
document.querySelectorAll('.wave').forEach((w) => bars(w, 26, 6, 18, 1.7, 90, 7))
document.querySelectorAll('.big-wave').forEach((w) => bars(w, 18, 10, 34, 1.3, 110, 5))

// Hero phone: tap a row to tick it, like in the app; the open count follows.
const rows = $('hero-rows')
const badge = $('open-badge')
function recount() {
  const n = rows.querySelectorAll('.r:not(.wait):not(.done)').length
  badge.textContent = String(n)
  badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop')
  $('open-count').textContent = `${n} open`
}
rows.addEventListener('click', (e) => {
  const r = (e.target as Element).closest('.r')
  if (!r || r.classList.contains('wait')) return
  r.classList.toggle('done')
  r.classList.remove('due')
  r.querySelector('.c')!.innerHTML = r.classList.contains('done') ? DONE : OPEN
  recount()
})

// Feature cards: a plain swipe row; the arrows step one card and dim at either end.
const car = $('carousel')
const prev = $<HTMLButtonElement>('car-prev')
const next = $<HTMLButtonElement>('car-next')
const cardW = () => (car.children[1] as HTMLElement).offsetLeft - (car.children[0] as HTMLElement).offsetLeft
const sync = () => {
  prev.disabled = car.scrollLeft <= 2
  next.disabled = car.scrollLeft >= car.scrollWidth - car.clientWidth - 2
}
prev.addEventListener('click', () => car.scrollBy({ left: -cardW(), behavior: still ? 'auto' : 'smooth' }))
next.addEventListener('click', () => car.scrollBy({ left: cardW(), behavior: still ? 'auto' : 'smooth' }))
car.addEventListener('scroll', sync, { passive: true })
addEventListener('resize', sync)
sync()
