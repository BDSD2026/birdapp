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

function fetchWithTimeout(url, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error('timeout')); }, ms);
    fetch(url).then(function(r) {
      clearTimeout(timer);
      resolve(r);
    }).catch(function(e) {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function getAudio(sci) {
  try {
    var url = 'https://xeno-canto.org/api/2/recordings?query=' + encodeURIComponent(sci);
    console.log('XC fetch:', url);
    var r = await fetchWithTimeout(url, 10000);
    console.log('XC status:', r.status);
    if (!r.ok) return null;
    var d = await r.json();
    console.log('XC recordings:', d.numRecordings);
    if (!d.recordings || d.recordings.length === 0) return null;
    var good = [];
    for (var i = 0; i < d.recordings.length && i < 20; i++) {
      var rec = d.recordings[i];
      var parts = rec.length ? rec.length.split(':') : [];
      var secs = parts.length === 2 ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) : 999;
      if (secs >= 2 && secs <= 30) good.push(rec);
    }
    var pick = good.length > 0 ? good[Math.floor(Math.random() * Math.min(good.length, 5))] : d.recordings[0];
    var audioUrl = pick.file;
    if (audioUrl && audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;
    console.log('XC audio:', audioUrl);
    return { audioUrl: audioUrl, recordist: pick.rec, license: pick.lic };
  } catch (e) {
    console.error('XC error:', e.message);
    return null;
  }
}

async function getImage(sci) {
  try {
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(sci) + '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*';
    var r = await fetchWithTimeout(url, 10000);
    if (!r.ok) return null;
    var d = await r.json();
    var pages = d.query ? d.query.pages : null;
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
  var url = new URL(request.url);
  var region = url.searchParams.get('region') || 'Global';
  var habitat = url.searchParams.get('habitat') || 'All';
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
  var audio = null;
  var image = null;
  try {
    var results = await Promise.all([getAudio(correct.sci), getImage(correct.sci)]);
    audio = results[0];
    image = results[1];
  } catch(e) {
    console.error('Parallel fetch error:', e.message);
  }
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
