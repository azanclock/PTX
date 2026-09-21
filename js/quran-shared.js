/* Shared Quran helpers used by BOTH the popup (index.js) and the service worker.
   Loaded via <script> in index.html and via importScripts() in serviceWorker.js.
   Pure functions only (no DOM, no chrome.* calls) so it is safe in either context. */

/* Surah audio: one MP3 per surah. Only bitrate 128 is served for surah audio, and the
   islamic.network CDN id is the reciter identifier with any trailing '-surah' stripped. */
const QURAN_AUDIO_BASE = 'https://cdn.islamic.network/quran/audio-surah/128/';
const QURAN_DEFAULT_RECITER = 'ar.alafasy-surah';
const QURAN_SURAH_COUNT = 114;

/* When Qur'an playback auto-resumes after an adhan/alarm interrupted it, rewind this many
   seconds for context. A manual pause → play resumes from the exact spot (no rewind). */
const QURAN_ADHAN_RESUME_REWIND = 10;

function quranReciterCdnId(identifier) {
    return (identifier && identifier.endsWith('-surah')) ? identifier.slice(0, -6) : identifier;
}

function quranSurahAudioUrl(surahNumber, reciterIdentifier) {
    return QURAN_AUDIO_BASE + quranReciterCdnId(reciterIdentifier) + '/' + surahNumber + '.mp3';
}

/* The chosen reciter (one global reciter for all surahs), else the default. */
function quranReciter(quran) {
    return (quran && quran.reciter) || QURAN_DEFAULT_RECITER;
}
