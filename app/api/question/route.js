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
    // Split scientific name into genus and species for xeno-canto
    const parts = sci.split(' ');
    const query = encodeURIComponent(parts.join('+'));
    const url = 'https://xeno-canto.org/api/2/recordings?query=' + query;
    console.log('Fetching audio:', url);
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.log('xeno-canto status:', r.status); return null; }
    const d = await r.json();
    console.log('xeno-canto results:', d.numRecordings);
    if (!d.recordings || d.recordings.length === 0) return null;
    // Filter for short recordings
    const good = d.recordings.filter(function(rec) {
      var p = rec.length ? rec.length.split(':') : [];
      var s = p.length === 2 ? parseInt(p[0]) * 60 + parseFloat(p[1]) : parseFloat(p[0]) || 999;
      return s >= 2 && s <= 30;
    });
    var pick = good.length > 0 ? good[Math.floor(Math.random() * Math.min(good.length, 5))] : d.recordings[0];
    var audioUrl = pick.file;
    // Ensure https
    if (audioUrl && audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;
    if (audioUrl && !audioUrl.startsWith('http')) audioUrl = 'https://' + audioUrl;
    console.log('Audio URL:', audioUrl, 'Recordist:', pick.rec);
    return { audioUrl: audioUrl, recordist: pick.rec, license: pick.lic, xcId: pick.id };
  } catch (e) {
    console.error('xeno-canto error:', e.message);
    return null;
  }
}

async function getImage(sci) {
  try {
    const q = encodeURIComponent(sci);
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + q + '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*';
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    const pages = d.query ? d.query.pages : null;
    if (!pages) return null;
    var entries = Object.values(pages);
    for (var i = 0; i < entries.length; i++) {
      var page = entries[i];
      var info = page.imageinfo ? page.imageinfo[0] : null;
      if (!info) continue;
      if ((info.mime || '').indexOf('svg') >= 0) continue;
      var t = (page.title || '').toLowerCase();
      if (t.indexOf('map') >= 0 || t.indexOf('range') >= 0 || t.indexOf('distribution') >= 0) continue;
      var credit = 'Wikimedia Commons';
      if (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) {
        credit = info.extmetadata.Artist.value.replace(/<[^>]*>/g, '');
      }
      return { imageUrl: info.thumburl || info.url, imageCredit: credit };
    }
    return null;
  } catch (e) { return null; }
}

export async function GET(request) {
  const url = new URL(request.url);
  const region = url.searchParams.get('region') || 'Global';
  const habitat = url.searchParams.get('habitat') || 'All';
  var pool = BIRDS.filter(function(b) {
    var rm = region === 'Global' || b.regions.indexOf(region) >= 0 || b.regions.indexOf('Global') >= 0;
    var hm = habitat === 'All' || b.habitats.indexOf(habitat) >= 0;
    return rm && hm;
  });
  if (pool.length < 4) pool = BIRDS;
  var shuffled = shuffle(pool);
  var correct = shuffled[0];
  var distractors = shuffled.filter(function(b) { return b.id !== correct.id; }).slice(0, 3);
  var options = shuffle([correct].concat(distractors));

  // Fetch audio and image in parallel
  var results = await Promise.allSettled([getAudio(correct.sci), getImage(correct.sci)]);
  var audio = results[0].status === 'fulfilled' ? results[0].value : null;
  var image = results[1].status === 'fulfilled' ? results[1].value : null;

  return NextResponse.json({
    correctId: correct.id,
    audioUrl: audio ? audio.audioUrl : null,
    recordist: audio ? audio.recordist : null,
    license: audio ? audio.license : null,
    imageUrl: image ? image.imageUrl : null,
    imageCredit: image ? image.imageCredit : null,
    options: options.map(function(b) { return { id: b.id, en: b.en, sci: b.sci }; }),
    bird: {
      id: correct.id, en: correct.en, sci: correct.sci,
      regions: correct.regions, habitats: correct.habitats,
      desc: correct.desc, funFact: correct.funFact,
      difficulty: correct.difficulty, features: correct.features,
      audioUrl: audio ? audio.audioUrl : null,
      recordist: audio ? audio.recordist : null,
      license: audio ? audio.license : null,
      imageUrl: image ? image.imageUrl : null,
      imageCredit: image ? image.imageCredit : null
    }
  });
        }
