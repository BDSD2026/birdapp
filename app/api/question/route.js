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
    fetch(url, { redirect: 'follow' }),
    new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, ms); })
  ]);
}

// Extract image from Wikipedia REST response
function extractImg(d) {
  if (d.thumbnail && d.thumbnail.source) {
    return { imageUrl: d.thumbnail.source.replace(/\/\d+px-/, '/640px-'), imageCredit: 'Wikipedia' };
  }
  if (d.originalimage && d.originalimage.source) {
    return { imageUrl: d.originalimage.source, imageCredit: 'Wikipedia' };
  }
  return null;
}

// Wikipedia REST API - try multiple title formats
async function wikiRest(name) {
  // Try exact name, then lowercase after first word (Wikipedia convention)
  var titles = [
    name.replace(/ /g, '_'),
    name.split(' ').map(function(w, i) { return i === 0 ? w : w.toLowerCase(); }).join('_'),
    name.toLowerCase().replace(/ /g, '_'),
    name.replace(/-/g, ' ').replace(/ /g, '_')
  ];
  // Deduplicate
  var seen = {};
  var unique = [];
  for (var i = 0; i < titles.length; i++) {
    if (!seen[titles[i]]) { seen[titles[i]] = true; unique.push(titles[i]); }
  }
  for (var i = 0; i < unique.length; i++) {
    try {
      var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(unique[i]);
      var r = await fetchT(url, 5000);
      if (!r.ok) continue;
      var d = await r.json();
      var img = extractImg(d);
      if (img) return img;
    } catch (e) { continue; }
  }
  return null;
}

// Wikipedia search API - finds article even with name variations
async function wikiSearch(query) {
  try {
    var url = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&origin=*';
    var r = await fetchT(url, 6000);
    if (!r.ok) return null;
    var d = await r.json();
    var pages = d.query ? d.query.pages : null;
    if (!pages) return null;
    var entries = Object.values(pages);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].thumbnail && entries[i].thumbnail.source) {
        return { imageUrl: entries[i].thumbnail.source.replace(/\/\d+px-/, '/640px-'), imageCredit: 'Wikipedia' };
      }
    }
    return null;
  } catch (e) { return null; }
}

// Commons search
async function commonsSearch(query) {
  try {
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&format=json&origin=*';
    var r = await fetchT(url, 8000);
    if (!r.ok) return null;
    var d = await r.json();
    var pages = d.query ? d.query.pages : null;
    if (!pages) return null;
    var entries = Object.values(pages);
    for (var i = 0; i < entries.length; i++) {
      var info = entries[i].imageinfo ? entries[i].imageinfo[0] : null;
      if (!info) continue;
      if (/svg|gif/.test(info.mime || '')) continue;
      var t = (entries[i].title || '').toLowerCase();
      if (/map|range|distribut|logo|icon|stamp|egg|skeleton|skull|diagram|taxo|specim/.test(t)) continue;
      var credit = 'Wikimedia';
      if (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) {
        credit = info.extmetadata.Artist.value.replace(/<[^>]*>/g, '').substring(0, 60);
      }
      return { imageUrl: info.thumburl || info.url, imageCredit: credit };
    }
    return null;
  } catch (e) { return null; }
}

async function getImage(sci, en) {
  // 1. Wikipedia REST - tries multiple title casing formats
  var img = await wikiRest(en);
  if (img) return img;
  // 2. Wikipedia REST by scientific name
  img = await wikiRest(sci);
  if (img) return img;
  // 3. Wikipedia search (handles all name variations)
  img = await wikiSearch(en + ' bird');
  if (img) return img;
  // 4. Wikipedia search by scientific name
  img = await wikiSearch(sci);
  if (img) return img;
  // 5. Commons search
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
