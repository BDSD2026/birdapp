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

function fetchWithTimeout(url, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error('timeout')); }, ms);
    fetch(url).then(function(r) { clearTimeout(timer); resolve(r); })
      .catch(function(e) { clearTimeout(timer); reject(e); });
  });
}

async function getImage(sci) {
  try {
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(sci) + '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*';
    var r = await fetchWithTimeout(url, 8000);
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

  // Use pre-cached xeno-canto ID from bird data
  var audioUrl = null;
  var recordist = null;
  var license = null;
  if (correct.xcId) {
    audioUrl = 'https://xeno-canto.org/' + correct.xcId + '/download';
    recordist = correct.xcRec || 'xeno-canto';
    license = correct.xcLic || 'CC';
  }

  // Fetch image from Wikimedia
  var image = await getImage(correct.sci);

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
      audioUrl: audioUrl,
      recordist: recordist,
      license: license,
      imageUrl: image ? image.imageUrl : null,
      imageCredit: image ? image.imageCredit : null
    }
  });
  }
