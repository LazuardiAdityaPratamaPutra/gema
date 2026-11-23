'use client';
import { useEffect, useRef, type ElementType } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Judul yang muncul per kata. Teks tetap utuh di DOM (pembaca layar membaca kalimat biasa);
 * hanya posisi kata yang dianimasikan. Dilewati bila pengguna meminta gerak dikurangi.
 */
export function Words({
  as = 'h2',
  text,
  id,
  className,
  onLoad = false,
}: {
  as?: 'h1' | 'h2' | 'h3';
  text: string;
  id?: string;
  className?: string;
  onLoad?: boolean;
}) {
  const Tag = as as ElementType;
  const ref = useRef<HTMLElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from('.wi', {
        yPercent: 115,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.07,
        ...(onLoad ? {} : { scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
      });
    }, el);
    return () => ctx.revert();
  }, [onLoad]);

  return (
    <Tag ref={ref} id={id} className={className}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="w">
            <span className="wi">{w}</span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
