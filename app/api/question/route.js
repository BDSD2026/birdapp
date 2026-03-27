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
  var imageUrl = correct.img || null;
  var imageCredit = correct.img ? 'Wikipedia' : null;
  return NextResponse.json({
    correctId: correct.id, audioUrl: audioUrl, recordist: recordist, license: license,
    imageUrl: imageUrl, imageCredit: imageCredit,
    options: options.map(function(b) { return { id: b.id, en: b.en, sci: b.sci }; }),
    bird: {
      id: correct.id, en: correct.en, sci: correct.sci,
      regions: correct.regions, habitats: correct.habitats,
      desc: correct.desc, funFact: correct.funFact,
      difficulty: correct.difficulty, features: correct.features,
      audioUrl: audioUrl, recordist: recordist, license: license,
      imageUrl: imageUrl, imageCredit: imageCredit
    }
  });
      }
