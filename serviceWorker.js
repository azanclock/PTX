self.importScripts('js/praytimes.js', 'js/functions.js', 'js/quran-shared.js', 'js/quran-surahs.js');

chrome.runtime.onInstalled.addListener(async () => { await start() });
chrome.runtime.onStartup.addListener(async () => { await run('onStartUp') });
chrome.alarms.onAlarm.addListener(async (alarm) => { await run('via alarm:' + alarm.name + ' at ' + Date.now()) }); /* every minute */
self.addEventListener('message', async (msg) => {
    if ('goGoRun' in msg.data) {
        await run('run via message')
    }
    else if ('endAdhanCall' in msg.data) {
        await endAdhanCall();
    }
    else if ('quranToggle' in msg.data) {
        await quranToggle();
    }
    else if ('quranSelectSurah' in msg.data) {     /* pick a surah from the list — cue it up, don't play */
        quranErrorStreak = 0;
        await quranSelectSurah(msg.data.quranSelectSurah);
    }
    else if ('quranNext' in msg.data) {
        quranErrorStreak = 0;
        await quranStep(1);
    }
    else if ('quranPrev' in msg.data) {
        quranErrorStreak = 0;
        await quranStep(-1);
    }
    else if ('quranSeek' in msg.data) {            /* drag the progress bar */
        await quranSeek(msg.data.quranSeek);
    }
    else if ('quranReload' in msg.data) {          /* reciter changed → stop (new reciter loads on next play) */
        await quranReload();
    }
    else if ('quranStop' in msg.data) {
        await quranStopAll();
    }
    else if ('quranSetVolume' in msg.data) {
        await quranSetVolume(msg.data.quranSetVolume);
    }
});

/* Offscreen player (js/quran.js) → SW. It uses chrome.runtime.sendMessage (not
   serviceWorker.controller.postMessage) because that reliably wakes a stopped MV3 service
   worker; otherwise `quranEnded` was dropped on longer surahs (no advance / auto-complete).
   Return true + sendResponse keeps the worker alive until the async handler finishes. */
/* TEMP TRACE (remove after debugging long-surah completion): throttle progress logs so the
   console shows pings still arriving + position advancing, without flooding. */
let quranDbgLastProg = 0;
function quranDbg(m) { try { console.log('[qdbg] ' + m + ' @' + new Date().toLocaleTimeString()); } catch (e) { } }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;
    if ('quranDbg' in msg) { quranDbg('OFFSCREEN ' + msg.quranDbg); return; }
    if ('quranEnded' in msg) { quranDbg('SW recv quranEnded'); quranAdvance().catch((e) => quranDbg('SW quranAdvance ERROR ' + e)).finally(() => { try { sendResponse({}); } catch (e) { } }); return true; }
    if ('quranError' in msg) { quranHandleError().finally(() => { try { sendResponse({}); } catch (e) { } }); return true; }
    if ('quranProgress' in msg) {
        const p = msg.quranProgress || {};
        const now = Date.now();
        if (now - quranDbgLastProg >= 15000) { quranDbgLastProg = now; quranDbg('SW recv progress surah=' + p.surah + ' t=' + (p.currentTime || 0).toFixed(0) + '/' + (p.duration || 0).toFixed(0) + ' playing=' + p.isPlaying); }
        quranPersistProgress(p).finally(() => { try { sendResponse({}); } catch (e) { } }); return true;
    }
});

let appData = {};
let adhanStatus = {};
let currentVakit;
let currentTime;
let currentTimeString;
let prayerTimes;
let hijriCurrentTime;
let hijriDate;
let nextVakit;
let totalMinutesInVakit;
let remainingMinutesInVakit;
let aroundTheClock;
let iconColor;
let badgeBackgroundColor;
let iconTextColor;
let clockFaceVakit;
let quranPlaying = false;   /* true while a surah is playing → toolbar icon becomes the pause button */
let quranPlayingSurah = 1;  /* current surah number, for the "now playing" tooltip */

const r = 160;
const ir = 12;
const iconSize = 128;
const colors = { black: '#212529', silver: 'whitesmoke', tomato: '#F20031', gray: '#2E3338' };
const QURAN_GREEN = '#22c55e';   /* the pause bars drawn on the toolbar icon while the Qur'an plays */
const ADHAN_RED = colors.tomato; /* the pause bars drawn on the toolbar icon while an adhan/alarm calls (matches the red #stopAdhanDiv stop button) */
const ctx = new OffscreenCanvas(470, 470).getContext("2d", { alpha: true, willReadFrequently: true });
const itx = new OffscreenCanvas(iconSize, iconSize).getContext("2d", { alpha: true, willReadFrequently: true });
const btx = new OffscreenCanvas(iconSize, iconSize).getContext("2d", { alpha: true, willReadFrequently: true });
const ptx = new OffscreenCanvas(iconSize, iconSize).getContext("2d", { alpha: true, willReadFrequently: true }); /* Qur'an "pause" toolbar icon */
const defaultAdhanSettings = { fajr: 12, dhuhr: 7, asr: 3, maghrib: 6, isha: 1 };

async function run(info) {

    appData = (await chrome.storage.local.get(['appData'])).appData;

    if (!appData) {
        return start();
    }

    let asResult = await chrome.storage.local.get(['adhanStatus']);
    if (asResult.adhanStatus)
        adhanStatus = asResult.adhanStatus;

    /* Sync the Qur'an-playing flag from storage so the toolbar icon is correct even after the
       service worker was suspended while the offscreen player kept playing. */
    let qsResult = await chrome.storage.local.get(['quranState']);
    quranPlaying = !!(qsResult.quranState && qsResult.quranState.isPlaying);
    quranPlayingSurah = (qsResult.quranState && qsResult.quranState.currentSurah) || 1;

    /* in case all chrome windows are closed during an adhan call */
    let isOffscreenDocAvailable = await offScreenDocumentAvailable();
    if (adhanStatus.isBeingCalled && !isOffscreenDocAvailable) {
        adhanStatus.isBeingCalled = false;
        await chrome.storage.local.set({ 'adhanStatus': adhanStatus });
    }

    /* If quranState says it was playing (or waiting to resume after an adhan) but there is no
       offscreen document, that audio can't actually be running — the doc is destroyed on
       reload/update or browser restart while quranState persists. Clear the stale flags so the
       toolbar icon isn't stuck on pause and no spurious resume fires after the next adhan. */
    if (!isOffscreenDocAvailable && qsResult.quranState &&
        (qsResult.quranState.isPlaying || qsResult.quranState.wasPlayingBeforeAdhan)) {
        quranPlaying = false;
        const staleState = qsResult.quranState;
        staleState.isPlaying = false;
        staleState.wasPlayingBeforeAdhan = false;
        await chrome.storage.local.set({ quranState: staleState });
    }

    let lastRunMS = new Date().getTime() - (appData.lastRun ?? 0);
    if (lastRunMS < 700 && info && info.indexOf('alarm') > 0) { return }

    populateVakitsAndVars();

    clearCanvas(ctx);
    updateClock(ctx, r);

    clearCanvas(itx);
    updateIcon(itx, ir * iconSize / 38);

    clearCanvas(btx);
    updateBar(btx, ir * iconSize / 38);

    extensionOps();
}

async function start() {

    let i18nValues = {};
    let navLang = navigator.language;
    let lang = languages.some(f => f.code == navLang) ? navLang : 'en';

    appData = (await chrome.storage.local.get(['appData'])).appData ?? (await chrome.storage.local.get(['appSettings'])).appSettings;

    await chrome.storage.local.remove('appSettings');
    await chrome.storage.local.set({ 'appData': appData }); /* temp renaming fix, remove later */

    if (appData && appData.i18n) {
        let lc = appData.i18n.languageCode;
        lang = (languages.some(f => f.code == lc)) ? lc : 'en';
    }
    const response = await fetch(`../_locales/${lang}/messages.json`);
    if (!response.ok) {
        throw new Error(`Failed to fetch language messages: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    Object.entries(data).forEach(([key, value]) => { i18nValues[key] = value.message });
    await initUser(i18nValues, appData);
}

async function initUser(i18nValues, appData) {

    try {

        if (appData) {

            /* existing user: new version */
            appData.settings ??= {
                address: appData.address,
                calculationMethod: appData.calculationMethod,
                lat: appData.lat,
                lng: appData.lng,
                timeZoneID: appData.timeZoneID,
                timeFormat: appData.timeFormat,
                iconStyle: appData.iconStyle,
                desktopNotifications: appData.desktopNotifications,
                adhans: appData.adhans,
                vakitOffsets: appData.vakitOffsets,
                areAdhansEnabled: appData.areAdhansEnabled,
                hanafiAsr: appData.hanafiAsr,
                showImsak: appData.showImsak,
                showDuha: appData.showDuha,
                showMidnight: appData.showMidnight,
                volume: appData.volume,
                hijriDateOffset: appData.hijriDateOffset
            };
            delete appData.address;
            delete appData.calculationMethod;
            delete appData.lat;
            delete appData.lng;
            delete appData.timeZoneID;
            delete appData.timeFormat;
            delete appData.iconStyle;
            delete appData.desktopNotifications;
            delete appData.adhans;
            delete appData.vakitOffsets;
            delete appData.areAdhansEnabled;
            delete appData.hanafiAsr;
            delete appData.showImsak;
            delete appData.showDuha;
            delete appData.showMidnight;
            delete appData.volume;
            delete appData.hijriDateOffset;

            delete appData.r;
            
            appData.i18n = i18nValues;

            if (!appData.settings.adhans) {
                appData.settings.adhans = defaultAdhanSettings;
            }
            if (!appData.settings.areAdhansEnabled) {
                appData.settings.areAdhansEnabled = false;
            }
            if (!appData.settings.hanafiAsr) {
                appData.settings.hanafiAsr = false;
            }
            if (!appData.settings.volume) {
                appData.settings.volume = 5;
            }
            if (!appData.settings.alarms) {
                appData.settings.alarms = [];
            }
            if (!appData.settings.naflAlarms) {
                appData.settings.naflAlarms = [];
            }

            if (!appData.settings.calcAngleFixApplied) {
                appData.settings.calcAngleFixApplied = true;
                if (calcAngleUpdatedMethods.includes(appData.settings.calculationMethod)) {
                    appData.settings.vakitOffsets = {};
                    await chrome.storage.local.set({ calcAngleNotice: { method: appData.settings.calculationMethod } });
                }
            }

            await chrome.storage.local.set({ 'appData': appData });
            await initAlarm();

        }
        else {
            /* new user: first installation */
            const response = await fetch('https://smartazanclock.com/iplocation', { method: 'POST' });
            if (!response.ok) {
                throw new Error(`Failed to fetch IP location: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            let settings = {
                address: data.address,
                calculationMethod: i18nValues.defaultMethod,
                lat: data.lat,
                lng: data.lng,
                timeZoneID: data.timeZoneID,
                timeFormat: 12,
                iconStyle: 'badge',
                desktopNotifications: true,
                adhans: defaultAdhanSettings,
                areAdhansEnabled: false,
                hanafiAsr: false,
                showImsak: false,
                showDuha: false,
                showMidnight: false,
                volume: 5,
                calcAngleFixApplied: true,
                alarms: [],
                naflAlarms: []
            }
            let appData = {
                settings: settings,
                i18n: i18nValues,
            };
            await chrome.storage.local.set({ 'appData': appData });
        }

    } catch (error) {
        await initDefaultUser(i18nValues);
    }

    await initAlarm();

}

async function initDefaultUser(i18nValues) {
    let appData = { i18n: i18nValues, settings: {} };
    appData.settings.address = "Al-Masjid An-Nabawi"; /* صلى الله عليه وعلى آله وسلم */
    appData.settings.lat = 24.4672105;
    appData.settings.lng = 39.611131;
    appData.settings.timeZoneID = "Asia/Riyadh";
    appData.settings.calculationMethod = 'Makkah';
    appData.settings.iconStyle = 'badge';
    appData.settings.desktopNotifications = true;
    appData.settings.hanafiAsr = false;
    appData.settings.showImsak = false;
    appData.settings.showDuha = false;
    appData.settings.showMidnight = false;
    appData.settings.adhans = defaultAdhanSettings;
    appData.settings.areAdhansEnabled = false;
    appData.settings.volume = 5;
    appData.settings.calcAngleFixApplied = true;
    appData.settings.alarms = [];
    appData.settings.naflAlarms = [];
    await chrome.storage.local.set({ 'appData': appData });
}

/* TEMP (testing only — delete before release): clear the one-time calc-angle
   migration guard and re-run it. Call from the service worker console: resetCalcAngleFix() */
async function resetCalcAngleFix() {
    const stored = (await chrome.storage.local.get('appData')).appData;
    if (stored && stored.settings) delete stored.settings.calcAngleFixApplied;
    await chrome.storage.local.set({ 'appData': stored });
    await chrome.storage.local.remove('calcAngleNotice');
    await start();
    const after = await chrome.storage.local.get(['appData', 'calcAngleNotice']);
    console.log('resetCalcAngleFix:', {
        method: after.appData && after.appData.settings && after.appData.settings.calculationMethod,
        calcAngleFixApplied: after.appData && after.appData.settings && after.appData.settings.calcAngleFixApplied,
        vakitOffsets: after.appData && after.appData.settings && after.appData.settings.vakitOffsets,
        calcAngleNotice: after.calcAngleNotice
    });
    return after;
}

async function initAlarm() {
    run('onInstall');
    let w = new Date();
    w.setMinutes(w.getMinutes() + 1);
    w.setSeconds(0);
    w.setMilliseconds(0);
    await chrome.alarms.create('everyMinute', { periodInMinutes: 1, when: Date.parse(w) });
}

function clearCanvas(canvas) {
    canvas.save();
    canvas.translate(0, 0);
    canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height);
    canvas.restore();
    return this;
}

function populateVakitsAndVars() {

    /* get prayer times */
    prayTimes.setMethod(appData.settings.calculationMethod);

    if (appData.settings.hanafiAsr)
        prayTimes.adjust({ asr: 'Hanafi' });
    else
        prayTimes.adjust({ asr: 'Standard' });


    let baseTuneValues = { imsak: 0, sunrise: 0, duha: 0, duhaend: 0, fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
    let methodDefaultTuneValues = methods.find(f => f.id == appData.settings.calculationMethod).methodOffsets;
    tuneValues = { ...baseTuneValues, ...methodDefaultTuneValues }

    if (appData.settings.vakitOffsets) {
        if (appData.settings.vakitOffsets.imsak)
            tuneValues.imsak += appData.settings.vakitOffsets.imsak;
        if (appData.settings.vakitOffsets.fajr)
            tuneValues.fajr += appData.settings.vakitOffsets.fajr;
        if (appData.settings.vakitOffsets.duha)
            tuneValues.duha += appData.settings.vakitOffsets.duha;
        if (appData.settings.vakitOffsets.duhaend)
            tuneValues.duhaend += appData.settings.vakitOffsets.duhaend;
        if (appData.settings.vakitOffsets.dhuhr)
            tuneValues.dhuhr += appData.settings.vakitOffsets.dhuhr;
        if (appData.settings.vakitOffsets.asr)
            tuneValues.asr += appData.settings.vakitOffsets.asr;
        if (appData.settings.vakitOffsets.maghrib)
            tuneValues.maghrib += appData.settings.vakitOffsets.maghrib;
        if (appData.settings.vakitOffsets.isha)
            tuneValues.isha += appData.settings.vakitOffsets.isha;
    }

    prayTimes.tune({ imsak: tuneValues.imsak, fajr: tuneValues.fajr, sunrise: tuneValues.sunrise, duha: tuneValues.duha, duhaend: tuneValues.duhaend, dhuhr: tuneValues.dhuhr, asr: tuneValues.asr, maghrib: tuneValues.maghrib, isha: tuneValues.isha });

    currentTime = new Date(new Date().toLocaleString("en-US", { timeZone: appData.settings.timeZoneID }));
    currentTimeString = currentTime.getHours() + ':' + fillInZeros(currentTime.getMinutes());
    prayerTimes = prayTimes.getTimes(currentTime, [appData.settings.lat, appData.settings.lng, 0], getOffsetHoursFromTimeZone(appData.settings.timeZoneID), 0, '24h');

    appData.timeNow24 = currentTimeString;
    appData.timeNow = format12(currentTimeString);

    appData.fajrAngle = prayTimes.getDefaults()[appData.settings.calculationMethod].params.fajr;
    if (appData.fajrAngle.toString().indexOf('min') < 0)
        appData.fajrAngle += '°';

    appData.ishaAngle = prayTimes.getDefaults()[appData.settings.calculationMethod].params.isha;
    if (appData.ishaAngle.toString().indexOf('min') < 0)
        appData.ishaAngle += '°';

    hijriCurrentTime = new Date(currentTime);
    if (appData.settings.hijriDateOffset)
        hijriCurrentTime = addDaysToDate(hijriCurrentTime, appData.settings.hijriDateOffset);
    hijriDate = new Intl.DateTimeFormat((appData.i18n.languageCode ?? navigator.language), { calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric' }).format(hijriCurrentTime);

    let aVakits = [];
    let vakits = [];

    imsakVakit = new Vakit('Imsak', getPrayerTime('imsak'), getPrayerTime('fajr'), currentTimeString, appData.settings.timeFormat);
    fajrVakit = new Vakit('Fajr', getPrayerTime('fajr'), getPrayerTime('sunrise'), currentTimeString, appData.settings.timeFormat);
    sunriseDuhaVakit = new Vakit('Sunrise', getPrayerTime('sunrise'), getPrayerTime('duha'), currentTimeString, appData.settings.timeFormat);
    sunriseDhuhrVakit = new Vakit('Sunrise', getPrayerTime('sunrise'), getPrayerTime('dhuhr'), currentTimeString, appData.settings.timeFormat);
    duhaVakit = new Vakit('Duha', getPrayerTime('duha'), getPrayerTime('duhaend'), currentTimeString, appData.settings.timeFormat);
    duhaendVakit = new Vakit('Duhaend', getPrayerTime('duhaend'), getPrayerTime('dhuhr'), currentTimeString, appData.settings.timeFormat);
    dhuhrVakit = new Vakit('Dhuhr', getPrayerTime('dhuhr'), getPrayerTime('asr'), currentTimeString, appData.settings.timeFormat);
    asrVakit = new Vakit('Asr', getPrayerTime('asr'), getPrayerTime('maghrib'), currentTimeString, appData.settings.timeFormat);
    maghribVakit = new Vakit('Maghrib', getPrayerTime('maghrib'), getPrayerTime('isha'), currentTimeString, appData.settings.timeFormat);
    ishaImsakVakit = new Vakit('Isha', getPrayerTime('isha'), getPrayerTime('imsak'), currentTimeString, appData.settings.timeFormat);
    ishaFajrVakit = new Vakit('Isha', getPrayerTime('isha'), getPrayerTime('fajr'), currentTimeString, appData.settings.timeFormat);
    ishaMidnightVakit = new Vakit('Isha', getPrayerTime('isha'), getPrayerTime('midnight'), currentTimeString, appData.settings.timeFormat);
    midnightFajrVakit = new Vakit('Midnight', getPrayerTime('midnight'), getPrayerTime('fajr'), currentTimeString, appData.settings.timeFormat);
    midnightImsakVakit = new Vakit('Midnight', getPrayerTime('midnight'), getPrayerTime('imsak'), currentTimeString, appData.settings.timeFormat);

    aVakits.push(imsakVakit);
    aVakits.push(fajrVakit);
    aVakits.push(sunriseDuhaVakit);
    aVakits.push(duhaVakit);
    aVakits.push(duhaendVakit);
    aVakits.push(dhuhrVakit);
    aVakits.push(asrVakit);
    aVakits.push(maghribVakit);
    aVakits.push(ishaMidnightVakit);
    aVakits.push(midnightImsakVakit);

    if (appData.settings.showImsak) {
        vakits.push(imsakVakit);
    }
    vakits.push(new Vakit('Fajr', getPrayerTime('fajr'), getPrayerTime('sunrise'), currentTimeString, appData.settings.timeFormat));
    if (appData.settings.showDuha) {
        vakits.push(sunriseDuhaVakit);
        vakits.push(duhaVakit);
        vakits.push(duhaendVakit);
    }
    else {
        vakits.push(sunriseDhuhrVakit);
    }
    vakits.push(dhuhrVakit);
    vakits.push(asrVakit);
    vakits.push(maghribVakit);

    if (appData.settings.showMidnight) {
        vakits.push(ishaMidnightVakit);
        if (appData.settings.showImsak)
            vakits.push(midnightImsakVakit);
        else
            vakits.push(midnightFajrVakit);
    }
    else {
        if (appData.settings.showImsak)
            vakits.push(ishaImsakVakit);
        else
            vakits.push(ishaFajrVakit);
    }

    let cvi = vakits.findIndex(a => a.isCurrentVakit);
    currentVakit = vakits[cvi];
    nextVakit = vakits[(cvi + 1) % vakits.length];

    cavi = aVakits.findIndex(a => a.isCurrentVakit);
    currentAllVakit = aVakits[cavi];

    appData.currentVakitAdhanAudioID = appData.settings.adhans[currentVakit.name.toLowerCase()] ?? 0;

    totalMinutesInVakit = diffMinutesBetweenTimes(currentVakit.time24, nextVakit.time24);
    aroundTheClock = totalMinutesInVakit >= 720;
    remainingMinutesInVakit = diffMinutesBetweenTimes(currentTimeString, nextVakit.time24);

    appData.isLastHour = false;

    if (remainingMinutesInVakit <= 60)
        appData.isLastHour = true;

    appData.lastHourHilite = appData.lastHourHilite ?? 1;

    if (appData.isLastHour && appData.lastHourHilite == 1) {
        iconColor = colors.tomato;
        badgeBackgroundColor = colors.tomato;
        iconTextColor = colors.silver;
    }
    else {
        iconColor = colors.silver;
        badgeBackgroundColor = colors.gray;
        iconTextColor = colors.gray;
    }

    clockFaceVakit = appData.i18n[currentVakit.name.toLowerCase() + 'Text'];
    if (currentVakit.name === "Duhaend")
        clockFaceVakit = "";
    if (currentVakit.name === "Sunrise" && currentAllVakit.name !== "Sunrise")
        clockFaceVakit = "";
    if (currentVakit.name === "Midnight")
        clockFaceVakit = appData.i18n['ishaText'];

    if (appData.i18n.languageCode == "en" && clockFaceVakit)
        clockFaceVakit = clockFaceVakit.toUpperCase();

    let appVakits = [];
    for (let i = 0; i < vakits.length; i++) {
        appVakits.push(vakits[i]);
    }

    let allVakits = [];
    for (let i = 0; i < aVakits.length; i++) {
        allVakits.push(aVakits[i]);
    }

    appData.isJumua = false;
    if (currentTime.getDay() === 5)
        appData.isJumua = true;
    appData.appVakits = appVakits;
    appData.allVakits = allVakits;

    return this;
}

function updateIcon(canvas, r) {
    canvas.save();
    canvas.translate(canvas.canvas.width * 0.5, canvas.canvas.height * 0.5);
    fillCircle(canvas, r * 1.5, 0, 0, iconColor);

    if (aroundTheClock) {
        drawArc(canvas, 0, 2 * Math.PI + Math.PI / 40, r * 1.05, r / 3, iconTextColor);
        drawHand(canvas, nextVakit.startAngle12, r * 0.9, r * 1.13, r / 4, iconColor);
    }
    else {
        drawArc(canvas, currentVakit.startAngle12, currentVakit.endAngle12, r * 1.05, r / 3, iconTextColor);
    }

    drawArrow(canvas, hoursToRadians(hours12(currentTime.getHours()) * 60 + currentTime.getMinutes()), 0, r * 0.21, r * 0.81, iconTextColor);
    fillCircle(canvas, r * 0.19, 0, 0, iconTextColor);
    canvas.restore();
    return this;
}

function updateClock(canvas, r) {
    canvas.save();
    let arcLineWidth = r / 15;
    canvas.translate(canvas.canvas.width * 0.5, canvas.canvas.height * 0.5);

    /*
    if (currentVakit.name == 'Sunrise' || currentVakit.name == 'Duha' || currentVakit.name == 'Duhaend') {
        drawArc(canvas, sunriseDhuhrVakit.startAngle12, sunriseDhuhrVakit.endAngle12, r * 1.19, arcLineWidth, colors.gray);
    }
    */

    if (aroundTheClock) {
        drawArc(canvas, 0, 2 * Math.PI + Math.PI / 40, r * 1.19, arcLineWidth, colors.silver);
        drawHand(canvas, nextVakit.startAngle12, r * 1.15, r * 1.22, arcLineWidth / 1.7, colors.gray);
    }
    else {
        drawArc(canvas, currentVakit.startAngle12, currentVakit.endAngle12, r * 1.19, arcLineWidth, colors.silver);
    }

    if (currentVakit.name === 'Isha' || currentVakit.name === 'Midnight') {

        if (!appData.settings.showImsak)
            drawArc(canvas, ishaFajrVakit.startAngle12, ishaFajrVakit.endAngle12, r * 1.19, arcLineWidth, colors.silver);
        else
            drawArc(canvas, ishaImsakVakit.startAngle12, ishaImsakVakit.endAngle12, r * 1.19, arcLineWidth, colors.silver);

        let fractionTextSize = r * 0.13;
        let totalMinutesInIsha = diffMinutesBetweenTimes(getPrayerTime('maghrib'), getPrayerTime('fajr'));
        let oneThird = totalMinutesInIsha / 3;
        let twoThird = oneThird * 2;

        appData.twoThirdTime = addMinutesToTime(getPrayerTime('maghrib'), twoThird);
        if (appData.settings.timeFormat === 12)
            appData.twoThirdTime = format12(appData.twoThirdTime)

        let midnightRadians = timeToRadians(getPrayerTime('midnight'), 12);
        drawHand(canvas, midnightRadians, r * 1.15, r * 1.22, arcLineWidth / 1.7, colors.gray);
        printAt(canvas, '1/2', fractionTextSize, colors.silver, r, midnightRadians);

        let oneThirdRadians = timeToRadians(getPrayerTime('maghrib'), 12) + oneThird * 2 * Math.PI / 720;
        drawHand(canvas, oneThirdRadians, r * 1.15, r * 1.22, arcLineWidth / 1.7, colors.gray);
        printAt(canvas, '1/3', fractionTextSize, colors.silver, r, oneThirdRadians);

        let twoThirdRadians = timeToRadians(getPrayerTime('maghrib'), 12) + twoThird * 2 * Math.PI / 720;
        drawHand(canvas, twoThirdRadians, r * 1.15, r * 1.22, arcLineWidth / 1.7, colors.gray);
        printAt(canvas, '2/3', fractionTextSize, colors.silver, r, twoThirdRadians);

    }

    markAlarms(canvas, r);

    let hourRadians = hoursToRadians(hours12(currentTime.getHours()) * 60 + currentTime.getMinutes());
    let minuteRadians = minutesToRadians(currentTime.getMinutes());
    let secondRadians = secondsToRadians(currentTime.getSeconds());

    drawHand(canvas, hourRadians, -r * 0.05, r * 0.7, arcLineWidth, colors.silver);
    drawHand(canvas, minuteRadians, -r * 0.05, r * 1.05, arcLineWidth, colors.silver);
    drawHand(canvas, secondRadians, -r * 0.1, r * 1.1, arcLineWidth / 4, colors.silver);

    fillCircle(canvas, r * 0.02, 0, 0, colors.gray);
    drawNumbers12(canvas, r * 1.01, colors.silver);

    if (clockFaceVakit) {

        let topHands = handOnTop(hourRadians) || handOnTop(minuteRadians);
        let bottomHands = handOnBottom(hourRadians) || handOnBottom(minuteRadians);

        if (topHands && !bottomHands)
            print(canvas, clockFaceVakit, 27, colors.silver, r * 0.5);
        else
            print(canvas, clockFaceVakit, 27, colors.silver, -r * 0.5);

    }

    canvas.restore();

    return this;
}

function updateBar(canvas, r) {

    let barColor = iconColor;

    if (appData.isLastHour && appData.lastHourHilite == 1) {
        barColor = colors.tomato;
    }

    let scale = canvas.canvas.width / 38;
    let iWidth = 38 * scale;
    let iHeight = 16 * scale;
    let borderPadding = 1.8 * scale;
    let actualWidth = iWidth - 2 * borderPadding;
    let actualHeight = iHeight - 2 * borderPadding;

    let remainingWidth = remainingMinutesInVakit * (actualWidth - 2 * borderPadding) / totalMinutesInVakit;

    if (remainingWidth < 4)
        remainingWidth = 4;

    canvas.save();
    canvas.beginPath();
    canvas.rect(0, 0, iWidth, iHeight);
    canvas.fillStyle = colors.silver;
    canvas.fill();
    canvas.restore();

    canvas.save();
    canvas.beginPath();
    canvas.rect(borderPadding, borderPadding, actualWidth, actualHeight);
    canvas.fillStyle = colors.gray;

    canvas.fill();
    canvas.restore();

    canvas.save();
    canvas.beginPath();
    canvas.rect(borderPadding * 2, borderPadding * 2, remainingWidth, actualHeight - 2 * borderPadding);
    canvas.fillStyle = barColor;
    canvas.fill();
    canvas.restore();

    canvas.save();
    canvas.translate(canvas.canvas.width * 0.5, canvas.canvas.height * 0.5);
    print(canvas, currentVakit.nextVakitIn, r * 1.1, colors.silver, r * 0.85);
    canvas.restore();
    return this;
}

/* Create a desktop notification.
   On macOS, Chrome hands the notification to the system Notification Center,
   which silently drops the rich "image" type WITHOUT setting
   chrome.runtime.lastError — so an image notification simply never appears and
   no error-based fallback can catch it. Use a plain "basic" notification on
   macOS; keep the image (with a basic fallback) on Windows/Linux where it
   renders correctly. */
function showNotification(id, title, message) {
    chrome.notifications.clear(id);
    let base = { iconUrl: 'images/icons/128.png', title: title, message: message };
    if (navigator.userAgent.includes('Macintosh')) {
        chrome.notifications.create(id, Object.assign({ type: 'basic' }, base));
        return;
    }
    chrome.notifications.create(id, Object.assign({ type: 'image', imageUrl: 'images/notification.jpg' }, base), () => {
        if (chrome.runtime.lastError)
            chrome.notifications.create(id, Object.assign({ type: 'basic' }, base));
    });
}

/* The popup calls run() every second; clearing and re-setting the badge on each run made it
   visibly flicker. Only touch the badge when its text or color actually changes. */
let lastBadgeText = null;
let lastBadgeColor = null;
function setBadge(text, color) {
    if (text !== lastBadgeText) {
        chrome.action.setBadgeText({ 'text': text });
        lastBadgeText = text;
    }
    if (text && color !== lastBadgeColor) {
        chrome.action.setBadgeBackgroundColor({ 'color': color });
        lastBadgeColor = color;
    }
}

function extensionOps() {

    let isRamadan = false;
    let enHijriDate = new Intl.DateTimeFormat('en', { calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric' }).format(hijriCurrentTime);
    if (enHijriDate.indexOf('Ramadan') >= 0)
        isRamadan = true;

    let elapsedText = appData.i18n.elapsedTimeTitle + ' ' + diffBetweenTimes(currentVakit.time24, currentTimeString);

    let nextText = currentVakit.nextVakitIn;
    let nextTextTitle = appData.i18n.nextTextTitle;

    if (isRamadan && currentVakit.name === 'Asr')
        nextTextTitle = appData.i18n.remainingForIftarTitle;


    appData.iconColor = iconColor;
    appData.iconTextColor = iconTextColor;
    appData.todaysDate = new Date().toLocaleString((appData.i18n.languageCode ?? navigator.language), { timeZone: appData.settings.timeZoneID, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    appData.todaysDateArabic = hijriDate;

    if (currentTimeString === currentVakit.time24 && appData.settings.desktopNotifications) {
        chrome.storage.local.get(['lastAlert'], (result) => {

            let lastAlertString = currentVakit.name + (new Date().toLocaleString("en-US", { day: 'numeric', month: 'numeric', year: 'numeric', minute: '2-digit' })).replace(/[\/, ]/g, '-');

            if (result.lastAlert && result.lastAlert === lastAlertString) {
                /* already alerted for this vakit */

            }
            else {
                chrome.storage.local.set({ 'lastAlert': lastAlertString });
                showNotification('notification', nextText, appData.settings.address);
            }

        });
    }

    chrome.action.setTitle({ title: (clockFaceVakit ? '[' + clockFaceVakit + '] ' : '') + nextTextTitle + ' ' + nextText + ' -> ' + appData.i18n[nextVakit.name.toLowerCase() + 'Text'] });

    if (currentTimeString === currentVakit.time24) {

        callAdhan();

        nextTextTitle = appData.i18n.azanTimeTitle;

        if (currentVakit.name === 'Imsak' || currentVakit.name === 'Sunrise' || currentVakit.name === 'Duha' || currentVakit.name === 'Duhaend' || currentVakit.name === 'Midnight')
            nextTextTitle = '&nbsp;';
        if (currentVakit.name !== 'Duhaend') {
            nextText = appData.i18n[currentVakit.name.toLowerCase() + 'Text'];
            chrome.action.setTitle({ title: nextText });
        }

    }

    /* While playing, name the current surah on hover instead of the prayer countdown (which stays
       on the icon's corner badge). */
    if (quranPlaying)
        chrome.action.setTitle({ title: quranNowPlayingTitle() });

    checkAlarms();

    if (nextText.length < 4)
        nextText = ' ' + nextText + ' ';

    if (adhanStatus.isBeingCalled) {
        /* An adhan or alarm is calling: the whole toolbar icon becomes red pause bars — the same
           treatment as the green Qur'an icon below, but red to match the red stop-adhan button
           (#stopAdhanDiv) in the popup, so it's obvious where the audio is coming from (click it to
           open the popup and stop it). Checked before quranPlaying because an adhan pauses the
           Qur'an; the prayer countdown stays in Chrome's native corner badge as usual. */
        chrome.action.setIcon({ imageData: { [iconSize]: pauseIconData(ADHAN_RED) } });
        setBadge(nextText, badgeBackgroundColor);
    }
    else if (quranPlaying) {
        /* Qur'an is playing: the whole toolbar icon becomes green pause bars so it's obvious where
           the audio is coming from (click it to open the popup for surah + time left). The prayer
           countdown is kept as Chrome's native corner badge — rendered crisply, unlike text baked
           into a 16px icon — so both icon styles still show the time while playing. The badge keeps
           the normal badge background (dark gray, or tomato in the last hour) for consistency. */
        chrome.action.setIcon({ imageData: { [iconSize]: pauseIconData(QURAN_GREEN) } });
        setBadge(nextText, badgeBackgroundColor);
    }
    else if (appData.settings.iconStyle === "badge") {
        setBadge(nextText, badgeBackgroundColor);
        chrome.action.setIcon({ imageData: { [iconSize]: btx.getImageData(0, 0, iconSize, iconSize) } });
    }
    else {
        setBadge('', badgeBackgroundColor);
        chrome.action.setIcon({ imageData: { [iconSize]: itx.getImageData(0, 0, iconSize, iconSize) } });
    }

    appData.nextText = nextText;
    appData.nextTextTitle = nextTextTitle;

    appData.elapsedText = elapsedText;

    appData.settings.iconStyle = appData.settings.iconStyle ?? "badge";

    appData.remainingForIftar = null;
    if (isRamadan && currentVakit.name !== 'Asr' && currentVakit.name !== 'Maghrib' && currentVakit.name !== 'Isha' && currentVakit.name !== 'Midnight')
        appData.remainingForIftar = appData.i18n.remainingForIftarTitle + ' ' + diffBetweenTimes(currentTimeString, getPrayerTime('maghrib'));

    itx.canvas.convertToBlob().then((blob) => {
        let reader1 = new FileReader();
        reader1.readAsDataURL(blob);
        reader1.onloadend = () => {

            appData.icon = reader1.result;

            btx.canvas.convertToBlob().then((blob) => {
                let reader2 = new FileReader();
                reader2.readAsDataURL(blob);
                reader2.onloadend = () => {
                    appData.bar = reader2.result;
                    ctx.canvas.convertToBlob().then((blob) => {
                        let reader3 = new FileReader();
                        reader3.readAsDataURL(blob);
                        reader3.onloadend = () => {

                            appData.clock = reader3.result;
                            appData.lastRun = new Date().getTime();

                            chrome.storage.local.set({ 'appData': appData }, function () {
                                chrome.runtime.sendMessage({ runApp: true }, function (response) {
                                    if (!chrome.runtime.lastError) {
                                        /* msg is received */
                                    }
                                    else {
                                        /* popup not open to receive the msg */
                                    }
                                });
                            });
                        }
                    });
                }
            });

        }
    });

    return true;

}

function getPrayerTime(vakit) { return prayerTimes[vakit].replace(/^0/, ''); }

function print(canvas, text, size, color, y) {
    canvas.save();
    if (!y)
        y = 0;
    canvas.font = 'bold ' + Math.floor(size) + 'px Arial';
    canvas.fillStyle = color;
    canvas.textBaseline = "middle";
    canvas.textAlign = 'center';
    canvas.fillText(text, 0, y);
    canvas.restore();
}

function printAt(canvas, text, size, color, r, angle) {
    canvas.save();
    canvas.textBaseline = "middle";
    canvas.fillStyle = color;
    canvas.textAlign = "center";
    canvas.font = size + "px Arial";
    let ang = angle - Math.PI / 2;
    canvas.rotate(ang);
    canvas.translate(0, r);
    canvas.rotate(-ang);
    canvas.fillText(text, 0, 0);
    canvas.restore();

}

function drawArc(canvas, startAngle, endAngle, radius, lineWidth, color) {
    canvas.save();
    canvas.beginPath();
    canvas.arc(0, 0, radius, startAngle, endAngle, false);
    canvas.lineWidth = lineWidth;
    canvas.lineCap = "butt";
    canvas.strokeStyle = color;
    canvas.stroke();
    canvas.restore();
}

function drawNumbers12(canvas, r, color) {
    let p;
    for (let n = 0; n < 12; n++) {
        canvas.save();
        canvas.textBaseline = "middle";
        canvas.fillStyle = color;
        canvas.textAlign = "center";
        canvas.font = "bold " + r * 0.15 + "px Arial";
        let ang = n * Math.PI / 6 - Math.PI;
        canvas.rotate(ang);
        canvas.translate(0, r * 1.35);
        canvas.rotate(-ang);
        p = n;
        if (n === 0)
            p = 12;
        canvas.fillText(p, 0, 0);
        canvas.restore();
    }
    for (let m = 0; m < 144; m++) {
        canvas.save();
        canvas.textBaseline = "middle";
        canvas.fillStyle = color;
        canvas.textAlign = "center";
        let ang = m * Math.PI / 30;
        canvas.rotate(ang);
        canvas.translate(0, r * 1.29);
        if (m % 5 !== 0) {
            canvas.font = r * 0.19 + "px Arial";
            canvas.fillText(".", 0, 0);
        }
        canvas.restore();
    }
}

function fillCircle(canvas, r, x, y, color) {
    canvas.save();
    canvas.beginPath();
    canvas.arc(x, y, r, 0, Math.PI * 2);
    canvas.fillStyle = color;
    canvas.fill();
    canvas.restore();
}

function drawHand(canvas, angle, from, to, lineWidth, color) {
    canvas.save();
    canvas.beginPath();
    canvas.rotate(angle);
    canvas.moveTo(from, 0);
    canvas.lineTo(to, 0);
    canvas.lineWidth = lineWidth;
    canvas.strokeStyle = color;
    canvas.lineCap = "round";
    canvas.stroke();
    canvas.restore();
}

function drawArrow(canvas, angle, x, width, height, color) {
    canvas.save();
    canvas.beginPath();
    canvas.rotate(angle);
    canvas.moveTo(x, -width);
    canvas.lineTo(x, width);
    canvas.lineTo(x + height, 0);
    canvas.fillStyle = color;
    canvas.fill();
    canvas.restore();
}

/* Minutes from now until this alarm next actually rings, honoring its frequency
   (E = every day, W = weekdays). Returns Infinity if it never fires. */
function minutesUntilNextAlarm(a) {
    let nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    let parts = a.time.split(':');
    let alarmMinutes = parts[0] * 60 + parts[1] * 1;
    let today = currentTime.getDay(); /* 0=Sun .. 6=Sat */

    for (let d = 0; d <= 7; d++) {
        let weekday = (today + d) % 7;
        let fires = (a.frequency === 'E') || (a.frequency === 'W' && weekday > 0 && weekday < 6);
        if (!fires)
            continue;
        let delta = d * 1440 + alarmMinutes - nowMinutes;
        if (delta >= 0)
            return delta;
    }
    return Infinity;
}

function markAlarms(canvas, r) {

    let alarms = appData.settings.alarms || [];
    let naflAlarms = appData.settings.naflAlarms || [];

    if (alarms.length === 0 && naflAlarms.length === 0)
        return;

    let markerRadius = r * 1.19;

    /* The clock face is a 12h dial, so a 9:30am and a 9:30pm alarm would land on
       the exact same spot. Only show the dot while the alarm is the next thing due
       within 12h, so its position always matches when it will actually ring. */
    alarms.forEach((a) => {
        if (minutesUntilNextAlarm(a) <= 720)
            drawIndicator(canvas, markerRadius, timeToRadians(a.time, 12), '#ffc107');
    });

    if (naflAlarms.length > 0) {

        let totalMinutesInIsha = diffMinutesBetweenTimes(getPrayerTime('maghrib'), getPrayerTime('fajr'));
        let oneThird = totalMinutesInIsha / 3;
        let oneThirdTime = addMinutesToTime(getPrayerTime('maghrib'), oneThird);
        let twoThirdTime = addMinutesToTime(getPrayerTime('maghrib'), oneThird * 2);
        let midnightTime = getPrayerTime('midnight');

        naflAlarms.forEach((a) => {
            let base;
            if (a.vakit.indexOf('1/3') === 0)
                base = oneThirdTime;
            else if (a.vakit.indexOf('2/3') === 0)
                base = twoThirdTime;
            else if (a.vakit.indexOf('Midnight') === 0)
                base = midnightTime;
            else
                base = getPrayerTime(a.vakit.toLowerCase());

            let addMinutes = a.when === 'before' ? -a.minutes : a.minutes;
            let naflTime = addMinutesToTime(base, addMinutes);
            /* Nafl alarms ring every day (see checkAlarms), so apply the same 12h window. */
            if (minutesUntilNextAlarm({ time: naflTime, frequency: 'E' }) <= 720)
                drawIndicator(canvas, markerRadius, timeToRadians(naflTime, 12), '#198754');
        });
    }
}

function drawIndicator(canvas, radius, angle, color) {
    canvas.save();
    canvas.rotate(angle);
    canvas.beginPath();
    canvas.arc(radius, 0, r * 0.075, 0, Math.PI * 2);
    canvas.fillStyle = color;
    canvas.fill();
    canvas.lineWidth = 2.5;
    canvas.strokeStyle = colors.silver;
    canvas.stroke();
    canvas.restore();
}

/* ImageData for the toolbar "pause button" icon shown while audio is playing (green QURAN_GREEN
   for the Qur'an, red ADHAN_RED while an adhan/alarm calls — see drawPauseIcon), drawn on its own
   canvas so it never touches itx/btx or the blobs (appData.icon / appData.bar) that feed the
   popup's icon-style previews (#iconImg / #barImg). */
function pauseIconData(color) {
    clearCanvas(ptx);
    drawPauseIcon(ptx, color);
    return ptx.getImageData(0, 0, iconSize, iconSize);
}

/* The audio-playing toolbar icon: two pause bars in `color` on a transparent background (no tile).
   It replaces the clock/bar icon entirely; green matches the Qur'an UI, red matches the stop-adhan
   button, and both show on light and dark toolbars. The bars sit high, clear of the bottom badge. */
function drawPauseIcon(canvas, color) {
    const cx = iconSize / 2, cy = iconSize * 0.26;   /* pushed up near the top edge (small margin) */
    const bw = iconSize * 0.20, bh = iconSize * 0.44, gap = iconSize * 0.13, rr = bw * 0.35;
    const y = cy - bh / 2;
    const xs = [cx - gap / 2 - bw, cx + gap / 2];
    canvas.save();
    canvas.fillStyle = color;
    xs.forEach((x) => {
        canvas.beginPath();
        if (canvas.roundRect) canvas.roundRect(x, y, bw, bh, rr);
        else canvas.rect(x, y, bw, bh);
        canvas.fill();
    });
    canvas.restore();
}

/* Localized Qur'an UI string (mirrors quranT in index.js), read from quranLocale in vars.js —
   pulled into the worker via praytimes.js's importScripts. Falls back to English, then the key. */
function quranStr(key) {
    const lang = (appData && appData.i18n && appData.i18n.languageCode) || 'en';
    const table = (typeof quranLocale !== 'undefined') ? quranLocale : {};
    const t = table[lang] || table.en || {};
    return t[key] || (table.en && table.en[key]) || key;
}

/* Hover tooltip shown while playing, e.g. "Surah Al-Faatiha" (en/tr); Arabic uses the surah's
   own self-contained Arabic name. Surah data is js/quran-surahs.js. */
function quranNowPlayingTitle() {
    const n = quranPlayingSurah || 1;
    const s = (typeof quranSurahs !== 'undefined') ? quranSurahs.find((x) => x.number === n) : null;
    const lang = (appData && appData.i18n && appData.i18n.languageCode) || 'en';
    if (s) return (lang === 'ar') ? s.name : (quranStr('surah') + ' ' + s.englishName);
    return quranStr('surah') + ' ' + n;
}

function isAdhanAvailable() {
    return appData.settings.areAdhansEnabled && appData.currentVakitAdhanAudioID > 0;
}

/* - - - - - - - - - - - - - - - - - */
async function callAdhan() {
    if (isAdhanAvailable()) {
        let callString = appData.timeNow24 + '-' + currentVakit.name + '-' + appData.currentVakitAdhanAudioID;
        if (adhanStatus.lastCall && adhanStatus.lastCall === callString) {
            console.log('Already called for ' + callString);
        }
        else {
            adhanStatus.lastCall = callString;
            adhanStatus.isBeingCalled = true;
            await chrome.storage.local.set({ 'adhanStatus': adhanStatus });
            await quranPauseForAdhan();
            await createOffscreen();
            await chrome.runtime.sendMessage({ audioID: appData.currentVakitAdhanAudioID, volume: appData.settings.volume });
        }
    }
}

function checkAlarms() {

    let alarms = appData.settings.alarms || [];
    let naflAlarms = appData.settings.naflAlarms || [];

    if (alarms.length === 0 && naflAlarms.length === 0)
        return;

    let isWeekDay = currentTime.getDay() > 0 && currentTime.getDay() < 6;

    alarms.forEach((a) => {
        if (currentTimeString === a.time && ((a.frequency === 'E') || (a.frequency === 'W' && isWeekDay))) {
            callAlarm(a.id, 'f-' + a.time + '-' + a.frequency);
        }
    });

    if (naflAlarms.length > 0) {

        let totalMinutesInIsha = diffMinutesBetweenTimes(getPrayerTime('maghrib'), getPrayerTime('fajr'));
        let oneThird = totalMinutesInIsha / 3;
        let oneThirdTime = addMinutesToTime(getPrayerTime('maghrib'), oneThird);
        let twoThirdTime = addMinutesToTime(getPrayerTime('maghrib'), oneThird * 2);
        let midnightTime = getPrayerTime('midnight');

        naflAlarms.forEach((a) => {
            let base;
            if (a.vakit.indexOf('1/3') === 0)
                base = oneThirdTime;
            else if (a.vakit.indexOf('2/3') === 0)
                base = twoThirdTime;
            else if (a.vakit.indexOf('Midnight') === 0)
                base = midnightTime;
            else
                base = getPrayerTime(a.vakit.toLowerCase());

            let addMinutes = a.when === 'before' ? -a.minutes : a.minutes;
            let alarmTime = addMinutesToTime(base, addMinutes);

            if (currentTimeString === alarmTime) {
                callAlarm(a.id, 'n-' + a.vakit + '-' + a.when + '-' + a.minutes);
            }
        });
    }
}

async function callAlarm(audioID, tag) {
    let callString = appData.timeNow24 + '-alarm-' + tag + '-' + audioID;
    if (adhanStatus.lastAlarmCall === callString) {
        console.log('Alarm already called for ' + callString);
        return;
    }
    adhanStatus.lastAlarmCall = callString;
    adhanStatus.isBeingCalled = true;
    await chrome.storage.local.set({ 'adhanStatus': adhanStatus });
    await quranPauseForAdhan();
    await createOffscreen();
    await chrome.runtime.sendMessage({ audioID: audioID, volume: appData.settings.volume });
}

async function endAdhanCall() {
    chrome.runtime.sendMessage({ stopAdhanCall: true });
    let result = await chrome.storage.local.get(['adhanStatus']);
    if (result.adhanStatus) {
        adhanStatus = result.adhanStatus;
        adhanStatus.isBeingCalled = false;
        await chrome.storage.local.set({ 'adhanStatus': adhanStatus });   /* awaited so the run() below reads back isBeingCalled=false, not the stale true */
    }
    await quranResumeAfterAdhan();
    await run('adhanEnded');   /* repaint now: drop the red pause icon the moment the adhan ends/stops (quranResumeAfterAdhan already repaints green when the Qur'an resumes) */
}

/* - - - - - - - - Qur'an playback (offscreen player; continues after the popup closes) - - - - - - - - */
/* State: chrome.storage.local `quranState` = { currentSurah, currentTime, duration, isPlaying,
   wasPlayingBeforeAdhan }. One global reciter (appData.settings.quran.reciter). Advance is strictly
   sequential; a finished surah is auto-marked completed in the separate `quranCompleted` key (a
   visual marker only — it never changes what plays next). A manual pause → play resumes from the
   exact spot; auto-resume after an adhan/alarm rewinds QURAN_ADHAN_RESUME_REWIND seconds for
   context; navigating (next/prev/jump) starts a surah from the beginning. */

let quranErrorStreak = 0;

/* After a surah finishes, hold on it briefly so the freshly-earned green check (surah checkmark
   + khatm segment) is visible before auto-advancing — completing a surah should read as a step,
   not an instant jump to the next one. */
const QURAN_ADVANCE_DELAY_MS = 1500;

async function quranGetContext() {
    const r = await chrome.storage.local.get(['appData', 'quranState']);
    const settings = (r.appData && r.appData.settings) || {};
    return {
        quran: settings.quran || {},
        volume: (typeof settings.volume === 'number') ? settings.volume : 7,
        state: r.quranState || { currentSurah: 1, currentTime: 0, isPlaying: false }
    };
}

async function quranSetState(state) {
    await chrome.storage.local.set({ quranState: state });
    /* Repaint the toolbar icon only when playback actually starts/stops, so the every-3s progress
       writes don't trigger a redraw. run() re-reads quranState and swaps the pause icon in/out. */
    const nowPlaying = !!state.isPlaying;
    if (nowPlaying !== quranPlaying) {
        quranPlaying = nowPlaying;
        quranPlayingSurah = state.currentSurah || quranPlayingSurah;
        await run('quranIndicator');
    } else if (nowPlaying && (state.currentSurah || 1) !== quranPlayingSurah) {
        /* Same play state, new surah (auto-advance or jump): only the hover tooltip changes,
           so update just the title instead of a full repaint. */
        quranPlayingSurah = state.currentSurah || 1;
        chrome.action.setTitle({ title: quranNowPlayingTitle() });
    }
}

/* Persist position/duration reported by the offscreen player (which has no chrome.storage).
   isPlaying is owned by the play/pause/advance paths, so it is not touched here — that avoids
   a stale progress message re-flipping a just-issued pause. */
async function quranPersistProgress(p) {
    if (!p) return;
    const r = await chrome.storage.local.get(['quranState']);
    const state = r.quranState || {};
    if (p.surah) state.currentSurah = p.surah;
    state.currentTime = p.currentTime || 0;
    if (p.duration && isFinite(p.duration) && p.duration > 0) state.duration = p.duration;
    await quranSetState(state);
}

/* `completed` lives in its own key (not appData) so the frequent appData writes in run()
   can never clobber it. Visual marker only. */
async function quranMarkCompleted(surah, value) {
    const r = await chrome.storage.local.get(['quranCompleted']);
    const set = new Set(r.quranCompleted || []);
    if (value) set.add(surah); else set.delete(surah);
    await chrome.storage.local.set({ quranCompleted: Array.from(set).sort((a, b) => a - b) });
    quranDbg('SW markCompleted surah=' + surah + ' value=' + value + ' -> ' + JSON.stringify(Array.from(set).sort((a, b) => a - b)));
    return set.size;   /* how many surahs are now completed (for khatm-complete detection) */
}

async function quranPlayAt(surah, startTime) {
    const { quran, volume } = await quranGetContext();
    surah = Math.round(surah);
    if (surah < 1) surah = 1;
    if (surah > QURAN_SURAH_COUNT) surah = QURAN_SURAH_COUNT;
    const src = quranSurahAudioUrl(surah, quranReciter(quran));
    await createOffscreen();   /* create the player BEFORE persisting isPlaying, so run()'s
                                  stale-state check never sees "playing" without an offscreen doc */
    await quranSetState({ currentSurah: surah, currentTime: startTime || 0, duration: 0, isPlaying: true });
    chrome.runtime.sendMessage({ quranPlay: { src, startTime: startTime || 0, surah, quranVolume: volume } }).catch(() => { });
}

async function quranToggle() {
    const { state } = await quranGetContext();
    if (state.isPlaying) {
        state.isPlaying = false;
        await quranSetState(state);
        chrome.runtime.sendMessage({ quranPause: true }).catch(() => { });
    } else {
        quranErrorStreak = 0;
        await quranStopAdhanForPlay();   /* pressing play during an adhan/alarm silences it and the Qur'an takes over */
        const surah = state.currentSurah || 1;
        /* manual pause → play resumes from the exact spot; if an adhan had paused it mid-recitation,
           rewind a little for context just like the automatic resume does */
        const rewind = state.wasPlayingBeforeAdhan ? QURAN_ADHAN_RESUME_REWIND : 0;
        const time = Math.max(0, (state.currentTime || 0) - rewind);
        await quranPlayAt(surah, time);   /* writes a fresh quranState, clearing wasPlayingBeforeAdhan */
    }
}

/* Stop a calling adhan/alarm without endAdhanCall()'s auto-resume (the caller is about to start
   the Qur'an itself). quranPlayAt's isPlaying flip then repaints the icon from red to green. */
async function quranStopAdhanForPlay() {
    const r = await chrome.storage.local.get(['adhanStatus']);
    if (!r.adhanStatus || !r.adhanStatus.isBeingCalled) return;
    chrome.runtime.sendMessage({ stopAdhanCall: true }).catch(() => { });
    adhanStatus = r.adhanStatus;
    adhanStatus.isBeingCalled = false;
    await chrome.storage.local.set({ 'adhanStatus': adhanStatus });
}

async function quranStep(delta) {
    const { state } = await quranGetContext();
    const next = (state.currentSurah || 1) + delta;
    if (next < 1 || next > QURAN_SURAH_COUNT) return;        /* clamp at the ends */
    await quranSelectSurah(next);
}

/* Load a surah into the player WITHOUT starting it: back / forward and picking from the surah
   list all just cue the surah up (position 0, stopped) — the listener presses play to hear it.
   Any audio currently playing is stopped so the shown surah and the sound never disagree.
   (Natural end-of-surah auto-advance — quranAdvance — is unaffected and keeps playing on.) */
async function quranSelectSurah(surah) {
    surah = Math.round(surah);
    if (surah < 1) surah = 1;
    if (surah > QURAN_SURAH_COUNT) surah = QURAN_SURAH_COUNT;
    await quranSetState({ currentSurah: surah, currentTime: 0, duration: 0, isPlaying: false });
    chrome.runtime.sendMessage({ quranStopAudio: true }).catch(() => { });
}

async function quranSeek(seconds) {
    const { state } = await quranGetContext();
    state.currentTime = Math.max(0, seconds || 0);
    await quranSetState(state);
    chrome.runtime.sendMessage({ quranSeek: state.currentTime }).catch(() => { });
}

async function quranReload() {   /* reciter changed → stop; the new reciter loads on the next play */
    const { state } = await quranGetContext();
    await quranSelectSurah(state.currentSurah || 1);   /* cue the current surah at 0:00, stopped */
}

async function quranAdvance() {
    const { state, quran } = await quranGetContext();
    const finished = state.currentSurah || 1;
    quranDbg('SW quranAdvance finished=' + finished);
    const completedCount = await quranMarkCompleted(finished, true);   /* auto-mark on finish (visual only) */
    quranErrorStreak = 0;
    if (completedCount >= QURAN_SURAH_COUNT) {              /* this finish completed the whole khatm (any order) */
        await quranStopAll();                              /* → surah 1 @ 0:00, stopped; the popup shows the celebration */
        return;
    }
    if (finished >= QURAN_SURAH_COUNT) {                    /* played to surah 114 but some earlier surahs are still unread */
        await quranSetState({ currentSurah: finished, currentTime: 0, duration: 0, isPlaying: false });
        chrome.runtime.sendMessage({ quranStopAudio: true }).catch(() => { });
        return;
    }
    /* Auto-continue toggle OFF: cue the next surah but leave it paused — the listener starts it.
       (The finished surah was still auto-marked complete above, so the khatm keeps advancing.) */
    if (quran.autoContinue === false) {
        await quranSelectSurah(finished + 1);
        return;
    }
    /* Let the green check land before moving on (the onMessage handler returned true, so the
       worker stays alive across this await). */
    await new Promise((resolve) => setTimeout(resolve, QURAN_ADVANCE_DELAY_MS));
    await quranPlayAt(finished + 1, 0);
}

async function quranHandleError() {
    quranErrorStreak++;
    if (quranErrorStreak > 5) { quranErrorStreak = 0; await quranStopAll(); return; }
    const { state } = await quranGetContext();
    if ((state.currentSurah || 1) >= QURAN_SURAH_COUNT) { await quranStopAll(); return; }
    await quranPlayAt((state.currentSurah || 1) + 1, 0);        /* skip a surah that failed to load */
}

async function quranStopAll() {
    await quranSetState({ currentSurah: 1, currentTime: 0, duration: 0, isPlaying: false });
    chrome.runtime.sendMessage({ quranStopAudio: true }).catch(() => { });
}

async function quranSetVolume(v) {
    chrome.runtime.sendMessage({ quranVolume: v }).catch(() => { });
}

async function quranPauseForAdhan() {
    const { state } = await quranGetContext();
    if (state.isPlaying) {
        state.isPlaying = false;
        state.wasPlayingBeforeAdhan = true;
        await quranSetState(state);
        chrome.runtime.sendMessage({ quranPause: true }).catch(() => { });
    }
}

async function quranResumeAfterAdhan() {
    const { state } = await quranGetContext();
    if (state.wasPlayingBeforeAdhan) {
        state.wasPlayingBeforeAdhan = false;
        state.isPlaying = true;
        const time = Math.max(0, (state.currentTime || 0) - QURAN_ADHAN_RESUME_REWIND);  /* rewind for context after an adhan/alarm */
        state.currentTime = time;
        await createOffscreen();   /* offscreen doc first, then persist isPlaying (see quranPlayAt) */
        await quranSetState(state);
        chrome.runtime.sendMessage({ quranResume: { startTime: time } }).catch(() => { });
    }
}

async function createOffscreen() {
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Playing adhan, alarm, or Qur\'an audio.'
    }).catch(() => { });
}

const offScreenDocumentAvailable = async () => {
    const OFFSCREEN_DOCUMENT_PATH = chrome.runtime.getURL('offscreen.html');
    if ('getContexts' in chrome.runtime) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [OFFSCREEN_DOCUMENT_PATH]
        });
        return Boolean(contexts.length);
    } else {
        const matchedClients = await clients.matchAll();
        return await matchedClients.some(client => {
            client.url.includes(chrome.runtime.id);
        });
    }
}

/* - - - - - - - - - - - - - - - - - */