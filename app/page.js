'use client';
import { useState, useCallback, useRef } from 'react';
const REGIONS = ['Global','India','Asia','Europe','Africa','Americas','Oceania'];
const HABITATS = ['All','forest','wetland','urban','grassland','coastal'];

export default function Home() {
  const [screen, setScreen] = useState('home');
  const [region, setRegion] = useState('India');
  const [habitat, setHabitat] = useState('All');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [qn, setQn] = useState(0);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const [ok, setOk] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const audioRef = useRef(null);

  const fetchQuestion = useCallback(async () => {
    setLoading(true); setSel(null); setOk(null); setAudioReady(false); setPlaying(false); setImgLoaded(false); setImgErr(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const res = await fetch(`/api/question?region=${encodeURIComponent(region)}&habitat=${encodeURIComponent(habitat)}`);
      const data = await res.json();
      setQuestion(data); setQn(q => q + 1); setLoading(false);
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.addEventListener('canplaythrough', () => { setAudioReady(true); setPlaying(true); audio.play().catch(() => {}); }, { once: true });
        audio.addEventListener('ended', () => setPlaying(false));
        audio.addEventListener('error', () => setAudioReady(false));
        audio.load(); audioRef.current = audio;
      }
    } catch (e) { setLoading(false); }
  }, [region, habitat]);

  const playAudio = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); setPlaying(true); audioRef.current.onended = () => setPlaying(false); } };
  const pickAnswer = (id) => { if (sel !== null || !question) return; const c = id === question.correctId; setSel(id); setOk(c); if (c) { setScore(s => s + 1); setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; }); } else setStreak(0); };
  const bird = question?.bird;
  const chip = (on, color) => `px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${on ? 'bg-gradient-to-r ' + color + ' text-white shadow-md' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`;
  if (screen === 'home') return (
    <div className="min-h-screen text-gray-100 flex flex-col items-center px-5 pt-12 pb-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3c-3 0-6 2-6 5.5 0 2 1 3.5 2 4.5L5 20l3-1.5 4 1.5 4-1.5 3 1.5-3-7c1-1 2-2.5 2-4.5C18 5 15 3 12 3z"/><circle cx="10" cy="8" r="1" fill="white"/></svg>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-1">BirdCall Quest</h1>
          <p className="text-slate-400 text-sm">Real bird recordings &middot; Real photos &middot; Learn as you play</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-400">Powered by xeno-canto &amp; Wikimedia Commons</span>
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.035] border border-white/[0.07] backdrop-blur-xl p-5 mb-4">
          <div className="text-[0.68rem] uppercase tracking-widest text-slate-500 font-bold mb-2">Region</div>
          <div className="flex flex-wrap gap-1.5 mb-5">{REGIONS.map(r => (<button key={r} onClick={() => setRegion(r)} className={chip(region === r, 'from-emerald-500 to-emerald-600 shadow-emerald-500/25')}>{r}</button>))}</div>
          <div className="text-[0.68rem] uppercase tracking-widest text-slate-500 font-bold mb-2">Habitat</div>
          <div className="flex flex-wrap gap-1.5">{HABITATS.map(h => (<button key={h} onClick={() => setHabitat(h)} className={chip(habitat === h, 'from-blue-500 to-blue-600 shadow-blue-500/25')}>{h === 'All' ? 'All Habitats' : h.charAt(0).toUpperCase() + h.slice(1)}</button>))}</div>
        </div>
        <button onClick={() => { setScore(0); setStreak(0); setQn(0); setScreen('play'); setTimeout(fetchQuestion, 100); }} className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-lg font-bold shadow-lg shadow-emerald-500/30 active:scale-[0.98]">Start Quest</button>
        <p className="text-center text-[0.65rem] text-slate-600 mt-4">Audio: xeno-canto.org (CC) &middot; Photos: Wikimedia Commons (CC BY-SA)</p>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen text-gray-100">
      <div className="sticky top-0 z-10 flex justify-between items-center px-4 py-3 border-b border-white/5 bg-[#06101f]/80 backdrop-blur-xl">
        <button onClick={() => { if (audioRef.current) audioRef.current.pause(); setScreen('home'); }} className="bg-white/5 text-slate-400 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-white/10">&larr; Menu</button>
        <div className="flex gap-5">{[{l:'Score',v:score,c:'text-emerald-400'},{l:'Streak',v:streak>=3?streak+' \uD83D\uDD25':streak,c:streak>=3?'text-amber-400':'text-slate-400'},{l:'Q#',v:qn,c:'text-blue-400'}].map((x,i)=>(<div key={i} className="text-center"><div className="text-[0.55rem] uppercase tracking-wider text-slate-600">{x.l}</div><div className={`text-xl font-extrabold ${x.c}`}>{x.v}</div></div>))}</div>
      </div>
      <div className="max-w-lg mx-auto px-5 pt-5 pb-8">
        {loading && (<div className="text-center py-20"><div className="w-8 h-8 border-[3px] border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin-slow mx-auto mb-4"></div><p className="text-slate-400 text-sm">Fetching real bird call from xeno-canto...</p></div>)}
        {!loading && question && (<div className="animate-fadeUp">
          <div className="rounded-2xl bg-white/[0.035] border border-white/[0.07] p-5 text-center mb-5">
            <div className="text-[0.68rem] uppercase tracking-widest text-slate-500 font-bold mb-4">Identify this bird call</div>
            <div className="flex justify-center items-center gap-0.5 h-12 mb-4">{Array.from({length:24}).map((_,i)=>(<div key={i} className="w-[3px] rounded-full" style={{background:playing?'#22c58d':'rgba(34,197,141,0.2)',height:playing?'100%':'5px',transformOrigin:'center',animation:playing?`pulse-bar ${0.4+Math.random()*0.5}s ease-in-out ${i*0.04}s infinite`:'none'}}/>))}</div>
            {!audioReady && !playing && (<p className="text-xs text-slate-500 mb-3">{question.audioUrl ? 'Loading real recording...' : 'No recording available'}</p>)}
            <button onClick={playAudio} disabled={!audioReady} className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${playing?'bg-emerald-500/10 border border-emerald-500/30 text-white':audioReady?'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25':'bg-white/5 text-slate-500 cursor-wait'}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">{playing?<><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>:<polygon points="5,3 19,12 5,21"/>}</svg>
              {playing ? 'Playing...' : audioReady ? 'Replay Call' : 'Loading...'}
            </button>
            {question.recordist && (<p className="text-[0.6rem] text-slate-600 mt-3">\uD83D\uDD0A Recorded by <strong className="text-slate-400">{question.recordist}</strong> &middot; xeno-canto.org &middot; {question.license || 'CC'}</p>)}
          </div>
          {sel === null && (<div className="grid gap-2 mb-5">{question.options.map((o, i) => (<button key={o.id} onClick={() => pickAnswer(o.id)} className="w-full p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] text-left flex items-center gap-3 hover:bg-white/[0.07] hover:border-emerald-500/20 transition-all"><span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">{String.fromCharCode(65+i)}</span><span className="font-semibold text-slate-200">{o.en}</span></button>))}</div>)}
          {sel !== null && bird && (<div className="animate-fadeUp">
            <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-4 ${ok ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>{ok ? '\u2713' : '\u2717'}</div>
              <div><div className={`font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{ok ? (streak >= 3 ? `\uD83D\uDD25 ${streak} in a row!` : 'Correct!') : 'Not quite!'}</div>{!ok && <div className="text-sm text-slate-400">Answer: <strong className="text-emerald-400">{bird.en}</strong></div>}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.035] border border-white/[0.07] overflow-hidden mb-4">
              <div className="relative w-full min-h-[200px] bg-black/30 flex items-center justify-center">
                {bird.imageUrl && !imgErr ? (<>
                  {!imgLoaded && <div className="absolute inset-0 flex items-center justify-center"><div className="w-7 h-7 border-[3px] border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin-slow"></div></div>}
                  <img src={bird.imageUrl} alt={bird.en} onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)} className={`w-full max-h-80 object-cover ${imgLoaded ? 'block' : 'hidden'}`}/>
                  <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/50 text-[0.55rem] text-white/50 text-right">{bird.imageCredit || 'Wikimedia'} &middot; CC BY-SA</div>
                </>) : (<div className="py-10 text-slate-600 text-sm">No photo available</div>)}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-extrabold text-white mb-1">{bird.en}</h2>
                <p className="text-sm text-blue-400 italic mb-3">{bird.sci}</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{bird.desc}</p>
                <div className="grid gap-2.5">
                  <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10"><div className="text-[0.6rem] uppercase tracking-widest text-purple-400 font-bold mb-0.5">Features</div><div className="text-sm text-slate-300">{bird.features}</div></div>
                  <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10"><div className="text-[0.6rem] uppercase tracking-widest text-blue-400 font-bold mb-0.5">Found In</div><div className="text-sm text-slate-300">{bird.regions?.join(' \u00b7 ')}</div></div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10"><div className="text-[0.6rem] uppercase tracking-widest text-emerald-400 font-bold mb-0.5">Habitat</div><div className="text-sm text-slate-300">{bird.habitats?.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(' \u00b7 ')}</div></div>
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10"><div className="text-[0.6rem] uppercase tracking-widest text-amber-400 font-bold mb-0.5">Fun Fact</div><div className="text-sm text-slate-300">{bird.funFact}</div></div>
                </div>
                {bird.recordist && <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-500">\uD83D\uDD0A {bird.recordist} &middot; xeno-canto &middot; {bird.license || 'CC'}</div>}
              </div>
            </div>
            <div className="grid gap-1.5 mb-4">{question.options.map((o, i) => { const me = o.id === sel, ans = o.id === question.correctId; return (<div key={o.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${ans ? 'bg-emerald-500/[0.08] border-emerald-500/25' : me && !ok ? 'bg-red-500/[0.08] border-red-500/25' : 'bg-white/[0.02] border-white/[0.04]'} ${!me && !ans ? 'opacity-30' : ''}`}><span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${ans ? 'bg-emerald-500 text-white' : me && !ok ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-500'}`}>{ans ? '\u2713' : me && !ok ? '\u2717' : String.fromCharCode(65+i)}</span><span className={`text-sm font-semibold ${ans ? 'text-emerald-400' : 'text-slate-400'}`}>{o.en}</span></div>); })}</div>
            <button onClick={fetchQuestion} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/25 active:scale-[0.98]">Next Question &rarr;</button>
            <div className="flex justify-center gap-6 mt-4 p-3 bg-white/[0.02] rounded-lg">{[{l:'Accuracy',v:(qn ? Math.round(score/qn*100) : 0)+'%',c:'text-slate-200'},{l:'Best',v:best,c:'text-amber-400'},{l:'Total',v:qn,c:'text-blue-400'}].map((x,i) => (<div key={i} className="text-center"><div className="text-[0.55rem] uppercase tracking-wider text-slate-600">{x.l}</div><div className={`text-base font-extrabold ${x.c}`}>{x.v}</div></div>))}</div>
          </div>)}
        </div>)}
      </div>
    </div>
  );
}
