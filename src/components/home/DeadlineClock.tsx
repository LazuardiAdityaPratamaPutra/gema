'use client';
import { useState } from 'react';
import { Words } from '@/components/motion/Words';

const DUE = 3,
  T2 = 3,
  T3 = 10,
  MAX = 15;
const LEVELS = [
  { who: 'Ketua Satgas', at: DUE + 1, c: 'var(--map-kuning)' },
  { who: 'Pimpinan kampus', at: DUE + T2, c: 'var(--map-oranye)' },
  { who: 'Pengawas', at: DUE + T3, c: 'var(--map-merah)' },
];
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'];

/** Kalender hari kerja: geser untuk melihat kapan tiap pihak diberi tahu. */
export function DeadlineClock() {
  const [day, setDay] = useState(6);
  const summary =
    day <= DUE
      ? `Masih dalam tenggat. Sisa ${DUE - day} hari kerja.`
      : `Terlambat ${day - DUE} hari kerja.`;
  const levelAt = (d: number) => [...LEVELS].reverse().find((l) => d >= l.at);
  return (
    <div className="band band-clock">
      <section className="clock wrap" aria-labelledby="jam">
        <div className="clock-copy">
          <Words as="h2" id="jam" text="Kalau Satgas diam, pimpinan tahu." />
          <p>
            Laporan harus ditindaklanjuti paling lambat {DUE} hari kerja setelah diterima
            (Permendikbudristek 55/2024 Pasal 53). Lewat dari itu, Gema meneruskan pemberitahuan ke
            atas. Geser untuk mencoba.
          </p>
          <label htmlFor="hari" className="label">
            Hari kerja ke-{day} sejak laporan diterima
          </label>
          <input
            id="hari"
            className="slider"
            type="range"
            min={0}
            max={MAX}
            value={day}
            onChange={(e) => setDay(+e.target.value)}
            aria-valuetext={`Hari kerja ${day}. ${summary}`}
          />
          <p className="small" role="status" aria-live="polite">
            {summary}
          </p>
        </div>
        <div className="cal" aria-hidden="true">
          <div className="cal-head">
            {HARI.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          <div className="cal-grid">
            {Array.from({ length: MAX }, (_, i) => {
              const d = i + 1;
              const lv = levelAt(d);
              const marks = LEVELS.filter((l) => l.at === d);
              return (
                <span
                  key={d}
                  className="cal-day"
                  data-past={d <= day}
                  data-due={d === DUE}
                  style={lv && d <= day ? { ['--lv' as string]: lv.c } : undefined}
                >
                  <b>{d}</b>
                  {d === DUE && <i className="cal-tag">tenggat</i>}
                  {marks.map((m) => (
                    <i key={m.who} className="cal-tag up">
                      {m.who}
                    </i>
                  ))}
                </span>
              );
            })}
          </div>
        </div>
        <ul className="lamps" aria-label="Siapa yang sudah diberi tahu">
          {LEVELS.map((l) => (
            <li key={l.who} data-on={day >= l.at} style={{ ['--lc' as string]: l.c }}>
              <span className="lp" aria-hidden="true" />
              <b>{l.who}</b>
              <span>{day >= l.at ? 'sudah diberi tahu' : `mulai hari ke-${l.at}`}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
