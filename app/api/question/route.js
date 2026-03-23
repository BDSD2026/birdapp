import { NextResponse } from 'next/server';
import { BIRDS } from '@/lib/birds';

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function fetchT(url, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error('timeout')); }, ms);
    fetch(url).then(function(r) { clearTimeout(timer); resolve(r); })
      .catch(function(e) { clearTimeout(timer); reject(e); });
  });
}

function isGoodImage(page) {
  var info = page.imageinfo ? page.imageinfo[0] : null;
  if (!info) return null;
  var mime = info.mime || '';
  if (mime.indexOf('svg') >= 0) return null;
  var t = (page.title || '').toLowerCase();
  if (t.indexOf('map') >= 0 || t.indexOf('range') >= 0 || t.indexOf('distribution') >= 0 || t.indexOf('logo') >= 0 || t.indexOf('icon') >= 0 || t.indexOf('stamp') >= 0 || t.indexOf('egg') >= 0) return null;
  var credit = 'Wikimedia Commons';
  if (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) {
    credit = info.extmetadata.Artist.value.replace(/<[^>]*>/g, '');
  }
  return { imageUrl: info.thumburl || info.url, imageCredit: credit };
}

async function searchWiki(query) {
  try {
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&format=json&origin=*';
    var r = await fetchT(url, 8000);
    if (!r.ok) return null;
    var d = await r.json();
    var pages = d.query ? d.query.pages : null;
    if (!pages) return null;
    var entries = Object.values(pages);
    for (var i = 0; i < entries.length; i++) {
      var result = isGoodImage(entries[i]);
      if (result) return result;
    }
    return null;
  } catch (e) { return null; }
}

async function getImage(sci, en) {
  // Strategy 1: Search by scientific name
  var result = await searchWiki(sci);
  if (result) return result;
  // Strategy 2: Search by English name + bird
  result = await searchWiki(en + ' bird');
  if (result) return result;
  // Strategy 3: Search by just English name
  result = await searchWiki(en);
  return result;
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

  var audioUrl = null;
  var recordist = null;
  var license = null;
  if (correct.xcId) {
    audioUrl = 'https://xeno-canto.org/' + correct.xcId + '/download';
    recordist = correct.xcRec || 'xeno-canto';
    license = correct.xcLic || 'CC';
  }

  // Try multiple strategies to find an image
  var image = await getImage(correct.sci, correct.en);

  return NextResponse.json({
    correctId: correct.id,
    audioUrl: audioUrl,
    recordist: recordist,
    license: license,
    imageUrl: image ? image.imageUrl : null,
    imageCredit: image ? image.imageCredit : null,
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
