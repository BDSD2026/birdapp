import { NextResponse } from 'next/server';
import { BIRDS } from '@/lib/birds';

function shuffle(a) {
  var arr = a.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function fetchT(url, ms) {
  return Promise.race([
    fetch(url),
    new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, ms); })
  ]);
}

// Strategy 1: Wikipedia REST API (fastest, most reliable)
async function wikiRest(name) {
  try {
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name.replace(/ /g, '_'));
    var r = await fetchT(url, 6000);
    if (!r.ok) return null;
    var d = await r.json();
    if (d.thumbnail && d.thumbnail.source) {
      var imgUrl = d.thumbnail.source.replace(/\/\d+px-/, '/640px-');
      return { imageUrl: imgUrl, imageCredit: 'Wikipedia' };
    }
    if (d.originalimage && d.originalimage.source) {
      return { imageUrl: d.originalimage.source, imageCredit: 'Wikipedia' };
    }
    return null;
  } catch (e) { return null; }
}

// Strategy 2: Commons search
async function commonsSearch(query) {
  try {
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&format=json&origin=*';
    var r = await fetchT(url, 8000);
    if (!r.ok) return null;
    var d = await r.json();
    var pages = d.query ? d.query.pages : null;
    if (!pages) return null;
    var entries = Object.values(pages);
    for (var i = 0; i < entries.length; i++) {
      var info = entries[i].imageinfo ? entries[i].imageinfo[0] : null;
      if (!info) continue;
      var mime = info.mime || '';
      if (mime.indexOf('svg') >= 0 || mime.indexOf('gif') >= 0) continue;
      var t = (entries[i].title || '').toLowerCase();
      if (/map|range|distribut|logo|icon|stamp|egg|skeleton|skull|diagram|taxo|specim/.test(t)) continue;
      var credit = 'Wikimedia Commons';
      if (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) {
        credit = info.extmetadata.Artist.value.replace(/<[^>]*>/g, '').substring(0, 60);
      }
      return { imageUrl: info.thumburl || info.url, imageCredit: credit };
    }
    return null;
  } catch (e) { return null; }
}

async function getImage(sci, en) {
  // Try Wikipedia REST first (fast, reliable)
  var img = await wikiRest(en);
  if (img) return img;
  // Try scientific name on Wikipedia
  img = await wikiRest(sci);
  if (img) return img;
  // Fall back to Commons search
  img = await commonsSearch(sci);
  if (img) return img;
  img = await commonsSearch(en + ' bird');
  return img;
}

export async function GET(request) {
  var url = new URL(request.url);
  var region = url.searchParams.get('region') || 'Global';
  var habitat = url.searchParams.get('habitat') || 'All';
  var pool = BIRDS.filter(function(b) {
    var rm = region === 'Global' || b.regions.indexOf(region) >= 0 || b.regions.indexOf('Global') >= 0;
    var hm = habitat === 'All' || b.habitats.indexOf(habitat.toLowerCase()) >= 0 || b.habitats.indexOf(habitat) >= 0;
    return rm && hm;
  });
  if (pool.length < 4) pool = BIRDS;
  var shuffled = shuffle(pool);
  var correct = shuffled[0];
  var distractors = shuffled.filter(function(b) { return b.id !== correct.id; }).slice(0, 3);
  var options = shuffle([correct].concat(distractors));
  var audioUrl = correct.xcId ? 'https://xeno-canto.org/' + correct.xcId + '/download' : null;
  var recordist = correct.xcRec || 'xeno-canto';
  var license = correct.xcLic || 'CC';
  var image = correct.imgUrl
    ? { imageUrl: correct.imgUrl, imageCredit: correct.imgCredit || 'Wikimedia' }
    : await getImage(correct.sci, correct.en);
  return NextResponse.json({
    correctId: correct.id, audioUrl: audioUrl, recordist: recordist, license: license,
    imageUrl: image ? image.imageUrl : null, imageCredit: image ? image.imageCredit : null,
    options: options.map(function(b) { return { id: b.id, en: b.en, sci: b.sci }; }),
    bird: {
      id: correct.id, en: correct.en, sci: correct.sci,
      regions: correct.regions, habitats: correct.habitats,
      desc: correct.desc, funFact: correct.funFact,
      difficulty: correct.difficulty, features: correct.features,
      audioUrl: audioUrl, recordist: recordist, license: license,
      imageUrl: image ? image.imageUrl : null,
      imageCredit: image ? image.imageCredit : null
    }
  });
      }
