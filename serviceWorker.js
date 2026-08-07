self.importScripts('js/praytimes.js', 'js/functions.js');

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

const r = 160;
const ir = 12;
const colors = { black: '#212529', silver: 'whitesmoke', tomato: '#F20031', gray: '#2E3338' };
const ctx = new OffscreenCanvas(470, 470).getContext("2d", { alpha: true, willReadFrequently: true });
const itx = new OffscreenCanvas(38, 38).getContext("2d", { alpha: true, willReadFrequently: true });
const btx = new OffscreenCanvas(38, 38).getContext("2d", { alpha: true, willReadFrequently: true });
const defaultAdhanSettings = { fajr: 12, dhuhr: 7, asr: 3, maghrib: 6, isha: 1 };

async function run(info) {

    appData = (await chrome.storage.local.get(['appData'])).appData;

    if (!appData) {
        return start();
    }

    let asResult = await chrome.storage.local.get(['adhanStatus']);
    if (asResult.adhanStatus)
        adhanStatus = asResult.adhanStatus;

    /* in case all chrome windows are closed during an adhan call */
    let isOffscreenDocAvailable = await offScreenDocumentAvailable();
    if (adhanStatus.isBeingCalled && !isOffscreenDocAvailable) {
        adhanStatus.isBeingCalled = false;
        await chrome.storage.local.set({ 'adhanStatus': adhanStatus });
    }

    let lastRunMS = new Date().getTime() - (appData.lastRun ?? 0);
    if (lastRunMS < 700 && info && info.indexOf('alarm') > 0) { return }

    populateVakitsAndVars();

    clearCanvas(ctx);
    updateClock(ctx, r);

    clearCanvas(itx);
    updateIcon(itx, ir);

    clearCanvas(btx);
    updateBar(btx, ir);

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
                volume: 5
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
    await chrome.storage.local.set({ 'appData': appData });
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

    let iWidth = 38;
    let iHeight = 16;
    let borderPadding = 1.8;
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
                chrome.notifications.clear('notification');
                chrome.notifications.create(
                    'notification',
                    {
                        type: "image",
                        imageUrl: 'images/notification.jpg',
                        iconUrl: 'images/icons/128.png',
                        title: nextText,
                        message: appData.settings.address
                    }
                );
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

    if (nextText.length < 4)
        nextText = ' ' + nextText + ' ';

    chrome.action.setBadgeText({ 'text': '' });

    if (appData.settings.iconStyle === "badge") {
        chrome.action.setBadgeText({ 'text': nextText });
        chrome.action.setBadgeBackgroundColor({ 'color': badgeBackgroundColor });
        chrome.action.setIcon({ imageData: { "38": btx.getImageData(0, 0, 38, 38) } });
    }
    else {
        chrome.action.setIcon({ imageData: { "38": itx.getImageData(0, 0, 38, 38) } });
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

function isAdhanAvailable() {
    return appData.settings.areAdhansEnabled && appData.currentVakitAdhanAudioID > 0;
}

/* - - - - - - - - - - - - - - - - - */
async function muteAllTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (!tab.mutedInfo || !tab.mutedInfo.muted) {
                await chrome.tabs.update(tab.id, { muted: true });
            }
        }
    } catch (e) {
        console.log('Error muting tabs: ' + e.message);
    }
}

async function callAdhan() {
    if (isAdhanAvailable()) {
        let callString = appData.timeNow24 + '-' + currentVakit.name + '-' + appData.currentVakitAdhanAudioID;
        if (adhanStatus.lastCall && adhanStatus.lastCall === callString) {
            console.log('Already called for ' + callString);
        }
        else {
            /* mute all browser tabs before playing the adhan */
            await muteAllTabs();
            await chrome.storage.local.set({ 'adhanStatus': { lastCall: callString, isBeingCalled: true } });
            await createOffscreen();
            await chrome.runtime.sendMessage({ audioID: appData.currentVakitAdhanAudioID, volume: appData.settings.volume });
        }
    }
}

async function endAdhanCall() {
    chrome.runtime.sendMessage({ stopAdhanCall: true });
    let result = await chrome.storage.local.get(['adhanStatus']);
    if (result.adhanStatus) {
        adhanStatus = result.adhanStatus;
        adhanStatus.isBeingCalled = false;
        chrome.storage.local.set({ 'adhanStatus': adhanStatus });
    }
}

async function createOffscreen() {
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Adhan is being called for prayers.'
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