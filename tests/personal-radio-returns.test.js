import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';
const E = loadScript('js/features/music-selection.js').SegueixApp.features.musicSelection;
const videos = Array.from({length:200}, (_, i) => ({
 id: 'v'+i, title:'Cançó '+i, channelId:'a'+i, channelTitle:'Artista '+i,
 contentType:'song', durationSeconds:200, viewCount:200000-i*500,
 categories:['Pop'], publishedAt:'2025-01-01T00:00:00Z'
}));
const ctx = E.createContext({videos, now:Date.parse('2026-10-21T10:00:00Z')});
function run(signals, extra={}) { return E.selectRadio({ctx, candidates:videos, signals,
 policy:'personal', count:40, rng:()=>0.4, ...extra}); }
describe('retorns de la ràdio personal', () => {
 it('reserva 8 de 40 per a escoltades preferides o populars i respecta les 20 darreres', () => {
  const signals=E.emptySignals();
  signals.songs=Object.fromEntries(videos.slice(0,80).map(v=>[v.id,{q:2,l:1}]));
  signals.liked=new Set(videos.slice(50,80).map(v=>v.id));
  signals.recent=videos.slice(0,20).map(v=>({id:v.id,at:ctx.now}));
  const result=run(signals);
  expect(result.queue).toHaveLength(40);
  expect(result.queue.filter(v=>signals.songs[v.id])).toHaveLength(8);
  expect(result.queue.every(v=>!signals.recent.some(r=>r.id===v.id))).toBe(true);
  expect(result.meta.returns).toEqual({count:8,target:0.2});
  expect(result.queue.filter((v,i)=>signals.songs[v.id] && (i+1)%5!==0)).toHaveLength(0);
 });
 it('sense historial completa la ràdio sense inventar retorns', () => {
  const result=run(E.emptySignals());
  expect(result.queue).toHaveLength(40);
  expect(result.meta.returns.count).toBe(0);
 });
 it('manté el percentatge en ampliar una cua i exclou els descartats', () => {
  const signals=E.emptySignals();
  signals.songs=Object.fromEntries(videos.slice(0,80).map(v=>[v.id,{q:2}]));
  signals.liked=new Set(videos.slice(0,80).map(v=>v.id));
  signals.lessLike=new Set(['v0','v1']);
  const first=run(signals);
  const next=run(signals,{preceding:first.queue,count:10});
  expect(next.queue.filter(v=>signals.songs[v.id])).toHaveLength(2);
  expect(next.queue.every(v=>!first.queue.some(p=>p.id===v.id)&&!signals.lessLike.has(v.id))).toBe(true);
 });
});