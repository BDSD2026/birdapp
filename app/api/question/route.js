import { NextResponse } from 'next/server';
import { BIRDS } from '@/lib/birds';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getAudio(sci) {
  try {
    const q = encodeURIComponent(sci + ' q:A');
    const r = await fetch('https://xeno-canto.org/api/2/recordings?query=' + q);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.recordings?.length) return null;
    const good = d.recordings.filter(rec => {
      const p = rec.length?.split(':') || [];
      const s = p.length === 2 ? parseInt(p[0]) * 60 + parseFloat(p[1]) : parseFloat(p[0]) || 999;
      return s >= 2 && s <= 25;
    });
    const pick = good.length > 0 ? good[Math.floor(Math.random() * Math.min(good.length, 5))] : d.recordings[0];
    return { audioUrl: 'https:' + pick.file, recordist: pick.rec, license: pick.lic, xcId: pick.id };
  } catch (e) { return null; }
}

async function getImage(sci) {
  try {
    const q = encodeURIComponent(sci);
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + q + '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*';
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const pages = d.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      if ((info.mime || '').includes('svg')) continue;
      const t = (page.title || '').toLowerCase();
      if (t.includes('map') || t.includes('range') || t.includes('distribution')) continue;
      return {
        imageUrl: info.thumburl || info.url,
        imageCredit: info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '') || 'Wikimedia Commons',
        imageLicense: info.extmetadata?.LicenseShortName?.value || 'CC BY-SA',
      };
    }
    return null;
  } catch (e) { return null; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || 'Global';
  const habitat = searchParams.get('habitat') || 'All';
  let pool = BIRDS.filter(b => {
    const rm = region === 'Global' || b.regions.includes(region) || b.regions.includes('Global');
    const hm = habitat === 'All' || b.habitats.includes(habitat);
    return rm && hm;
  });
  if (pool.length < 4) pool = BIRDS;
  const shuffled = shuffle(pool);
  const correct = shuffled[0];
  const distractors = shuffled.filter(b => b.id !== correct.id).slice(0, 3);
  const options = shuffle([correct, ...distractors]);
  const [audio, image] = await Promise.all([getAudio(correct.sci), getImage(correct.sci)]);
  return NextResponse.json({
    correctId: correct.id,
    audioUrl: audio?.audioUrl || null,
    recordist: audio?.recordist || null,
    license: audio?.license || null,
    imageUrl: image?.imageUrl || null,
    imageCredit: image?.imageCredit || null,
    options: options.map(b => ({ id: b.id, en: b.en, sci: b.sci })),
    bird: { ...correct, audioUrl: audio?.audioUrl || null, recordist: audio?.recordist || null, license: audio?.license || null, imageUrl: image?.imageUrl || null, imageCredit: image?.imageCredit || null },
  });
    }
