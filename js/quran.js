/* Offscreen Qur'an player — lives in offscreen.html alongside js/adhan.js.
   The service worker drives it via chrome.runtime.sendMessage; it reports playback
   position/duration/ended back to the SW ALSO via chrome.runtime.sendMessage (the SW's
   chrome.runtime.onMessage listener), which reliably wakes a stopped MV3 worker —
   serviceWorker.controller.postMessage does not, so `quranEnded` used to be lost on longer
   surahs. The SW persists everything to storage: offscreen documents only expose
   chrome.runtime (NOT chrome.storage), so all persistence goes through the SW.
   Every key is Qur'an-namespaced (never a bare `volume`) so adhan.js ignores it. */

const qap = document.getElementById('quranAudioPlayer');
let quranCurrentSurah = 0;
let quranLastProgressWrite = 0;

/* Seeking a long surah to its exact end HANGS the media element — it fires `seeking`/`waiting`
   and never `seeked`/`ended` (the last chunk past the end can't be fetched), so `quranEnded`
   (auto-complete + advance) was silently lost whenever the user fast-forwarded a long surah to
   the end. Any seek landing within this many seconds of the end is treated as the surah
   finishing instead. The seek bar's smallest step is far larger than this on long surahs, so
   nothing the listener actually wants to hear is skipped. */
const QURAN_END_EPS = 0.75;

/* TEMP TRACE (remove after debugging long-surah completion): log key audio events to the
   offscreen console AND route them to the service-worker console, so we can see whether `ended`
   fires and whether messages still flow at the end of a long playout. */
function quranDbgSend(m) {
    try { console.log('[qdbg] OFFSCREEN ' + m); } catch (e) { }
    try { const p = chrome.runtime.sendMessage({ quranDbg: m }); if (p && typeof p.catch === 'function') p.catch(() => { }); } catch (e) { }
}
['ended', 'stalled', 'waiting', 'suspend', 'pause', 'error', 'emptied'].forEach((ev) => {
    qap.addEventListener(ev, () => quranDbgSend(ev + ' surah=' + quranCurrentSurah + ' t=' + (qap.currentTime || 0).toFixed(1) + '/' + qap.duration + ' paused=' + qap.paused + ' ns=' + qap.networkState));
});

/* Use chrome.runtime.sendMessage (NOT serviceWorker.controller.postMessage): the latter does
   not wake a stopped MV3 service worker, so `quranEnded` was lost on longer surahs (no advance
   / no auto-complete). chrome.runtime messages wake the SW reliably. */
function quranPostToSW(message) {
    try {
        const p = chrome.runtime.sendMessage(message);
        if (p && typeof p.catch === 'function') p.catch(() => { });
    } catch (e) { /* SW not reachable */ }
}

/* Report position + duration to the SW, which persists them to quranState. */
function quranReportProgress(isPlaying) {
    if (!quranCurrentSurah) return;
    quranPostToSW({
        quranProgress: {
            surah: quranCurrentSurah,
            currentTime: qap.currentTime || 0,
            duration: (isFinite(qap.duration) && qap.duration > 0) ? qap.duration : 0,
            isPlaying: !!isPlaying
        }
    });
}

function quranClampVolume(v) {
    return Math.max(0, Math.min(1, (v || 0) / 10));
}

chrome.runtime.onMessage.addListener((msg) => {

    if (msg.quranPlay) {
        const { src, startTime, surah, quranVolume } = msg.quranPlay;
        if (surah) quranCurrentSurah = surah;
        if (typeof quranVolume === 'number') qap.volume = quranClampVolume(quranVolume);

        const onMeta = () => {
            qap.removeEventListener('loadedmetadata', onMeta);
            if (startTime && isFinite(startTime)) {
                try { qap.currentTime = startTime; } catch (e) { /* seek not ready */ }
            }
            quranReportProgress(!qap.paused);   /* report duration + start position */
        };
        qap.addEventListener('loadedmetadata', onMeta);

        qap.src = src;
        qap.play().catch(() => { });
        quranLastProgressWrite = Date.now();
    }
    else if (msg.quranResume) {
        const t = msg.quranResume && msg.quranResume.startTime;   /* rewound spot after an adhan/alarm */
        if (typeof t === 'number' && isFinite(t)) {
            try { qap.currentTime = Math.max(0, t); } catch (e) { /* seek not ready */ }
        }
        qap.play().catch(() => { });
    }
    else if (msg.quranPause) {
        qap.pause();
        quranReportProgress(false);
    }
    else if ('quranSeek' in msg) {
        if (isFinite(msg.quranSeek)) {
            const dur = qap.duration;
            if (!qap.paused && isFinite(dur) && dur > 0 && msg.quranSeek >= dur - QURAN_END_EPS) {
                /* Fast-forwarded to the end while playing: don't attempt the seek (it would hang);
                   report the bar at 100% + stopped, then tell the SW the surah finished so it
                   auto-completes and advances just like a natural end. (When paused we fall through
                   to a plain seek, so dragging to the end while paused doesn't start the next surah.) */
                qap.pause();
                quranPostToSW({ quranProgress: { surah: quranCurrentSurah, currentTime: dur, duration: dur, isPlaying: false } });
                quranPostToSW({ quranEnded: true });
            } else {
                try { qap.currentTime = Math.max(0, msg.quranSeek); } catch (e) { }
                quranReportProgress(!qap.paused);
            }
        }
    }
    else if (msg.quranStopAudio) {
        qap.pause();
        try { qap.currentTime = 0; } catch (e) { }
        qap.removeAttribute('src');
        qap.load();
    }
    else if ('quranVolume' in msg) {
        qap.volume = quranClampVolume(msg.quranVolume);
    }
});

qap.onended = () => {
    quranPostToSW({ quranEnded: true });   /* SW advances + sets the next state */
};

qap.ontimeupdate = () => {
    const now = Date.now();
    if (now - quranLastProgressWrite >= 3000) {
        quranLastProgressWrite = now;
        quranReportProgress(!qap.paused);
    }
};

qap.onerror = () => {
    if (qap.currentSrc) quranPostToSW({ quranError: true });
};
