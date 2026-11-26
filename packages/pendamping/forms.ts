/**
 * Pemahaman cerita: mencocokkan cerita bebas dengan bentuk Kekerasan seksual pada
 * Permendikbudristek 55/2024 Pasal 12 ayat (2) huruf a–z, serta bentuk Kekerasan lain (Pasal 7 ayat (2)).
 * Berjalan di perangkat. Hasilnya petunjuk, bukan penilaian hukum; Satgas yang menilai.
 */
import { cues, hasCue, stems, type Cue } from './text';

type Form = {
  id: string;
  pasal: string;
  label: string;
  ringkas: string;
  cues: Cue[];
  seksual: boolean;
};

/** Kata kunci bentuk: `strong` bernilai 3, `weak` bernilai 1. Dipisah dengan `|`. */
type Kata = { strong: string; weak?: string };

const F = (
  id: string,
  pasal: string,
  label: string,
  ringkas: string,
  { strong, weak = '' }: Kata,
  seksual = true,
): Form => ({
  id,
  pasal,
  label,
  ringkas,
  seksual,
  cues: [...cues(strong, 3), ...cues(weak, 1)],
});

const FORMS: Form[] = [
  F(
    'a',
    'Pasal 12 ayat (2) huruf a',
    'Komentar yang melecehkan tubuh atau identitas gender',
    'ujaran yang mendiskriminasi atau melecehkan tampilan fisik, kondisi tubuh, atau identitas gender',
    {
      strong:
        'komentar badan|komentar tubuh|bentuk badan|bentuk tubuh|badan kamu|tubuh kamu|body shaming|bodi kamu|ukuran dada|banci|bencong|seksi',
      weak: 'badan|tubuh|gendut|dada|pantat|paha|bokong|montok',
    },
  ),
  F(
    'b',
    'Pasal 12 ayat (2) huruf b',
    'Memperlihatkan alat kelamin tanpa persetujuan',
    'memperlihatkan alat kelamin dengan sengaja tanpa persetujuan',
    {
      strong: 'alat kelamin|memperlihatkan kelamin|buka celana|pamer kelamin|ekshibisionis',
      weak: 'kelamin|telanjang|celana',
    },
  ),
  F(
    'c',
    'Pasal 12 ayat (2) huruf c',
    'Rayuan, lelucon, atau siulan bernuansa seksual',
    'ucapan yang memuat rayuan, lelucon, atau siulan bernuansa seksual',
    {
      strong:
        'lelucon jorok|candaan jorok|candaan mesum|lelucon mesum|bercanda mesum|siul|digoda|menggoda|merayu|rayuan|gombal|catcalling|cantik banget|kamu seksi',
      weak: 'mesum|jorok|goda|rayu|sayang|cantik|ganteng',
    },
  ),
  F(
    'd',
    'Pasal 12 ayat (2) huruf d',
    'Tatapan bernuansa seksual yang membuat tidak nyaman',
    'menatap dengan nuansa seksual atau membuat tidak nyaman',
    {
      strong:
        'menatap dada|menatap tubuh|melihat dada|melihat tubuh|tatapan mesum|lihatin badan|memandangi tubuh|memandangi badan',
      weak: 'menatap|tatap|memandangi|melirik|tidak nyaman|risih',
    },
  ),
  F(
    'e',
    'Pasal 12 ayat (2) huruf e',
    'Pesan, gambar, atau video bernuansa seksual',
    'mengirim pesan, lelucon, gambar, foto, audio, atau video bernuansa seksual',
    {
      strong:
        'chat malam|chat tengah malam|pesan tengah malam|chat malam malam|kirim foto bugil|foto bugil|minta foto|kirim video|video call|vc malam|pesan mesum|chat mesum|stiker porno|gambar porno|video porno|foto telanjang|sexting',
      weak: 'chat|pesan|whatsapp|wa|dm|foto|video|stiker|porno',
    },
  ),
  F(
    'f',
    'Pasal 12 ayat (2) huruf f',
    'Mengambil atau merekam foto/video tanpa persetujuan',
    'mengambil, merekam, atau mengedarkan foto atau rekaman tanpa persetujuan',
    {
      strong:
        'foto diam diam|merekam diam diam|direkam tanpa izin|difoto tanpa izin|rekam saya|memfoto saya|kamera tersembunyi',
      weak: 'rekam|memfoto|kamera',
    },
  ),
  F(
    'g',
    'Pasal 12 ayat (2) huruf g',
    'Mengunggah foto tubuh atau info pribadi bernuansa seksual',
    'mengunggah foto tubuh atau informasi pribadi bernuansa seksual tanpa persetujuan',
    {
      strong:
        'unggah foto saya|upload foto saya|posting foto saya|foto saya di media sosial|foto saya disebar',
      weak: 'unggah|upload|posting|instagram|story|media sosial',
    },
  ),
  F(
    'h',
    'Pasal 12 ayat (2) huruf h',
    'Menyebarkan informasi tubuh atau pribadi bernuansa seksual',
    'menyebarkan informasi tentang tubuh atau pribadi bernuansa seksual tanpa persetujuan',
    {
      strong:
        'menyebarkan foto|sebar foto|sebarkan foto|disebar ke grup|ancam sebar|mengancam menyebarkan|cerita ke grup|gosip tentang tubuh',
      weak: 'sebar|grup|gosip',
    },
  ),
  F(
    'i',
    'Pasal 12 ayat (2) huruf i',
    'Mengintip saat kegiatan pribadi',
    'mengintip atau dengan sengaja melihat saat sedang melakukan kegiatan pribadi',
    {
      strong: 'mengintip|diintip|kamar mandi|ganti baju|ruang ganti|toilet',
      weak: 'kamar kos|kamar',
    },
  ),
  F(
    'j',
    'Pasal 12 ayat (2) huruf j',
    'Bujukan atau janji imbalan untuk kegiatan seksual',
    'membujuk, menjanjikan, atau menawarkan sesuatu untuk transaksi atau kegiatan seksual',
    {
      strong:
        'tidak acc|tidak lulus kalau|kalau tidak mau|kalau saya tidak mau|nilai saya urus|nilaimu saya urus|janji nilai|janji lulus|dijanjikan nilai|acc skripsi|tanda tangan skripsi|beasiswa kalau|imbalan nilai|nanti saya bantu lulus|tawarkan uang|dibayar',
      weak: 'nilai|lulus|skripsi|tesis|acc|beasiswa|imbalan|janji|proyek|asisten|berdua',
    },
  ),
  F(
    'k',
    'Pasal 12 ayat (2) huruf k',
    'Hukuman atau sanksi bernuansa seksual',
    'pemberian hukuman atau sanksi yang bernuansa seksual',
    {
      strong: 'hukuman buka baju|disuruh buka baju|hukuman cium|sanksi cium|dihukum dengan',
      weak: 'hukuman|sanksi|dihukum',
    },
  ),
  F(
    'l',
    'Pasal 12 ayat (2) huruf l',
    'Sentuhan, pelukan, atau ciuman tanpa persetujuan',
    'menyentuh, mengusap, meraba, memegang, memeluk, mencium, atau menggosokkan bagian tubuh',
    {
      strong:
        'pegang tangan|memegang tangan|sering pegang|pegang pegang|meraba|diraba|memegang paha|pegang paha|memegang pinggang|memeluk saya|dipeluk|mencium saya|dicium|mengusap|mengelus|menggesek|menggosokkan|mencolek|meremas|rangkul paksa',
      weak: 'pegang|sentuh|peluk|cium|usap|elus|colek|rangkul|paha|pinggang|tangan',
    },
  ),
  F(
    'm',
    'Pasal 12 ayat (2) huruf m',
    'Membuka pakaian tanpa persetujuan',
    'membuka pakaian tanpa persetujuan',
    {
      strong:
        'membuka baju saya|buka baju saya|membuka pakaian|menarik baju|membuka kancing|melepas baju|menarik rok|menarik celana',
      weak: 'baju|pakaian|kancing|rok',
    },
  ),
  F(
    'n',
    'Pasal 12 ayat (2) huruf n',
    'Pemaksaan kegiatan seksual',
    'pemaksaan untuk melakukan transaksi atau kegiatan seksual',
    {
      strong:
        'memaksa berhubungan|dipaksa berhubungan|memaksa saya|dipaksa|mengajak ke hotel|ajak check in|check in|hubungan badan|tidur bersama|berhubungan seksual',
      weak: 'paksa|hotel|kos|berdua',
    },
  ),
  F(
    'o',
    'Pasal 12 ayat (2) huruf o',
    'Praktik "tradisi" komunitas kampus bernuansa seksual',
    'praktik budaya komunitas Warga Kampus yang bernuansa kekerasan seksual',
    {
      strong: 'tradisi angkatan|ospek|pengkaderan|inisiasi|perpeloncoan|tradisi senior',
      weak: 'senior|tradisi|angkatan',
    },
  ),
  F(
    'p',
    'Pasal 12 ayat (2) huruf p',
    'Percobaan perkosaan',
    'percobaan perkosaan walaupun penetrasi tidak terjadi',
    { strong: 'mencoba memperkosa|hampir diperkosa|percobaan perkosaan|berusaha memperkosa' },
  ),
  F(
    'q',
    'Pasal 12 ayat (2) huruf q',
    'Perkosaan',
    'perkosaan, termasuk penetrasi dengan benda atau bagian tubuh selain alat kelamin',
    { strong: 'perkosa|diperkosa|memperkosa|rudapaksa|penetrasi' },
  ),
  F(
    'r',
    'Pasal 12 ayat (2) huruf r',
    'Pemaksaan atau tipu daya untuk aborsi',
    'pemaksaan atau tipu daya untuk melakukan aborsi',
    { strong: 'aborsi|gugurkan kandungan|menggugurkan|disuruh menggugurkan' },
  ),
  F(
    's',
    'Pasal 12 ayat (2) huruf s',
    'Pemaksaan atau tipu daya untuk hamil',
    'pemaksaan atau tipu daya untuk hamil',
    { strong: 'dipaksa hamil|memaksa hamil|dibuat hamil' },
  ),
  F('t', 'Pasal 12 ayat (2) huruf t', 'Pemaksaan sterilisasi', 'pemaksaan sterilisasi', {
    strong: 'sterilisasi|dipaksa steril',
  }),
  F('u', 'Pasal 12 ayat (2) huruf u', 'Penyiksaan seksual', 'penyiksaan seksual', {
    strong: 'penyiksaan seksual|disiksa secara seksual|menyiksa alat kelamin',
  }),
  F('v', 'Pasal 12 ayat (2) huruf v', 'Eksploitasi seksual', 'eksploitasi seksual', {
    strong: 'eksploitasi|menjual foto saya|menjual video saya|dijadikan konten',
  }),
  F('w', 'Pasal 12 ayat (2) huruf w', 'Perbudakan seksual', 'perbudakan seksual', {
    strong: 'perbudakan|disekap|dikurung|budak',
  }),
  F(
    'x',
    'Pasal 12 ayat (2) huruf x',
    'Perdagangan orang untuk eksploitasi seksual',
    'tindak pidana perdagangan orang untuk eksploitasi seksual',
    { strong: 'perdagangan orang|trafficking|dijual ke' },
  ),
  F(
    'y',
    'Pasal 12 ayat (2) huruf y',
    'Pembiaran kekerasan seksual dengan sengaja',
    'pembiaran terjadinya kekerasan seksual dengan sengaja',
    {
      strong:
        'laporan diabaikan|laporan tidak ditanggapi|laporan didiamkan|kasus didiamkan|pura pura tidak tahu|dibiarkan|tutup mata|tidak ditindak',
      weak: 'abaikan|biarkan|diam saja',
    },
  ),
  F(
    'fisik',
    'Pasal 7 ayat (2)',
    'Kekerasan fisik',
    'kekerasan fisik',
    {
      strong:
        'memukul|dipukul|menampar|ditampar|menendang|ditendang|mendorong saya|menjambak|mencekik',
      weak: 'pukul|tampar|tendang|dorong|jambak',
    },
    false,
  ),
  F(
    'psikis',
    'Pasal 7 ayat (2)',
    'Kekerasan psikis',
    'kekerasan psikis',
    {
      strong:
        'mengancam|diancam|ancaman|mengintimidasi|mempermalukan|menghina saya|merendahkan saya|dikucilkan',
      weak: 'ancam|takut|hina|malu|intimidasi',
    },
    false,
  ),
  F(
    'rundung',
    'Pasal 7 ayat (2)',
    'Perundungan',
    'perundungan',
    {
      strong: 'dirundung|merundung|dibully|membully|perundungan|diejek terus|diolok olok',
      weak: 'ejek|olok|bully',
    },
    false,
  ),
];

export type FormHit = { form: Form; score: number; matched: string[] };

/** Skor tiap bentuk dari petunjuk yang muncul. Petunjuk kuat bernilai 3, petunjuk lemah 1. Tampil bila skor ≥ 3. */
export function understandStory(text: string, max = 3): FormHit[] {
  const ts = stems(text);
  if (ts.length < 3) return [];
  const hits: FormHit[] = [];
  for (const form of FORMS) {
    let score = 0;
    const matched: string[] = [];
    for (const c of form.cues)
      if (hasCue(ts, c.s)) {
        score += c.w;
        matched.push(c.raw);
      }
    if (score >= 3) hits.push({ form, score, matched: [...new Set(matched)].slice(0, 4) });
  }
  // bentuk seksual didahulukan bila skornya setara
  return hits
    .sort((a, b) => b.score - a.score || Number(b.form.seksual) - Number(a.form.seksual))
    .slice(0, max);
}
