const fs = require('fs');
const crypto = require('crypto');
const txt = fs.readFileSync('/tmp/sas/package/dist/dictionary-default.js', 'utf8');
const words = [...txt.matchAll(/^\s*"([a-z-]+)",?$/gm)].map((m) => m[1]);
const block =
  /(seks|cabul|perkos|zina|mesum|bugil|telanj|kelamin|nafsu|birahi|pelacur|lonte|bangsat|anjing|babi|bajing|bunuh|bantai|siksa|aniaya|sundal|jalang|tolol|goblok|bego|kontol|memek|ngentot|pantat|payudara|vagina|penis|senggama|setubuh|ereksi|onani|porno|erot|lacur|gerayang|grepe|raba|cium|peluk|buah dada|mati|jenazah|bangkai|darah|racun|tikam|sembelih|pukul|tampar|tendang|hajar|jahanam|sialan|keparat|cacat|buta|tuli|gila|sinting|idiot|pandir|dungu|haram|laknat|iblis|setan|kafir|dosa|neraka|kutuk|aib|nista|hina|cela|benci|dendam|marah|murka|takut|ngeri|seram|derita|sengsara|nestapa|duka|pilu|sedih|tangis|luka|sakit|nyeri|pedih|perih|trauma|korban|pelaku|tersangka|polisi|penjara|bui|hukum|sidang|vonis|tuduh|fitnah|bohong|dusta|curang|culas|licik|tipu|culik|rampok|copet|maling|curi|jambret|todong|ancam|teror|paksa|tindas|siksa|lecehkan|gauli|rudapaksa)/;
let w = [...new Set(words)].filter(
  (x) =>
    /^[a-z]{4,6}$/.test(x) &&
    !block.test(x) &&
    !/(or|asi|isme|ologi|tif|sif|ik|is|al|er|um|us|ur|if|et|on|ir|ar)$/.test(x) &&
    !/^(ab|ad|af|ag|ek|eks|ko|kon|ne|neo|pa|po|pr|sp|st|tr|ps|ph|x)/.test(x),
);
console.log('after filter', w.length);
// deterministic shuffle by hash then take 7776, then sort alphabetically for stable lookup
w = w
  .map((x) => [
    crypto
      .createHash('sha256')
      .update('gema-wordlist-v1:' + x)
      .digest('hex'),
    x,
  ])
  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .slice(0, 7776)
  .map((x) => x[1])
  .sort();
if (w.length !== 7776) throw new Error('len ' + w.length);
const out = `// Daftar 7.776 kata dasar Bahasa Indonesia (4-6 huruf), 6 kata ≈ 77,5 bit entropi.
// Sumber: kamus kata dasar ts-sastrawi (ISC), disaring dari kata sensitif lalu dipilih deterministik.
// Dibangun oleh scripts/gen-wordlist.cjs — jangan diubah manual karena mengubah semua passphrase lama.
export const WORDLIST: readonly string[] = ${JSON.stringify(w.join(' '))}.split(' ');
`;
fs.writeFileSync('packages/passphrase/wordlist.ts', out);
fs.copyFileSync(__filename, 'scripts/gen-wordlist.cjs');
console.log(w.slice(0, 12), w.length);
