let appData = {};
let adhanStatus = {};

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

chrome.runtime.onMessage.addListener((msg) => { if ('runApp' in msg) { runApp() } });

$(function () {
    applyLatestI18n();
    goGoRun('1stLoad');
    setInterval(goGoRun, 1000);
    maybeShowCalcAngleNotice();
});

const maybeShowCalcAngleNotice = async () => {
    const { calcAngleNotice } = await chrome.storage.local.get(['calcAngleNotice']);
    if (!calcAngleNotice) return;

    const data = (await chrome.storage.local.get(['appData'])).appData;
    const method = calcAngleNotice.method || (data && data.settings && data.settings.calculationMethod) || '';
    const message = (data && data.i18n && data.i18n.calcAngleUpdateNotice)
        || 'The prayer time calculation for your selected method (' + method + ') has been updated for improved accuracy. '
        + 'Any manual time adjustments (offsets) you had set were reset to 0. '
        + 'Please review your prayer times and re-apply offsets only if you still need them.';

    $('#calcAngleNoticeText').text(message.replace('{method}', method));
    $('#calcAngleNoticeClose').off('click').on('click', function () {
        $('#calcAngleNoticeBar').hide();
        chrome.storage.local.remove('calcAngleNotice');
    });
    $('#calcAngleNoticeBar').show();
};

const goGoRun = (info) => {
    navigator.serviceWorker.controller.postMessage({ goGoRun: (info ?? '') })
}

/* Apply the active locale's labels straight from the bundled messages file on popup
   open, so newly added i18n keys appear without waiting for a service-worker restart
   to refresh the cached appData.i18n. Local file read; DOM only, no storage write. */
const applyLatestI18n = async () => {
    try {
        const stored = (await chrome.storage.local.get(['appData'])).appData;
        const lc = (stored && stored.i18n && stored.i18n.languageCode) || '';
        const lang = languages.some(f => f.code == lc) ? lc : 'en';
        const data = await (await fetch('_locales/' + lang + '/messages.json')).json();
        Object.entries(data).forEach(function ([key, value]) {
            $('#' + key).text(value.message);
            $('.' + key).text(value.message);
        });
    } catch (e) { /* fall back to the cached i18n applied by runApp */ }
};

const runApp = async () => {

    appData = (await chrome.storage.local.get(['appData'])).appData;

    let asResult = await chrome.storage.local.get(['adhanStatus']);
    if (asResult.adhanStatus)
        adhanStatus = asResult.adhanStatus;

    $('#clock').attr("src", appData.clock);
    $('.menu-clock-img').attr("src", appData.icon);
    $('#iconImg').attr("src", appData.icon);
    $('#barImg').attr("src", appData.bar);

    $('#elapsedText').html(appData.elapsedText);
    $('#nextText').css("background-color", appData.iconColor);
    $('#nextText').css("color", appData.iconTextColor);
    $('#nextText').html(appData.nextText);
    $('#ntTitle').html(appData.nextTextTitle);

    $('#todaysDate').text(appData.todaysDate);
    $('.todaysDateArabic').text(appData.todaysDateArabic);

    $('#remainingForIftar').hide();
    if (appData.remainingForIftar) {
        $('#remainingForIftar').html(appData.remainingForIftar).show();
    }

    let langCode = (appData.i18n && appData.i18n.languageCode) || '';
    if (langCode !== runApp.appliedLang) {
        runApp.appliedLang = langCode;
        Object.entries(appData.i18n).forEach(function ([key, value]) {
            $('#' + key).text(value);
            $('.' + key).text(value);
        });
    }

    $('.vakitDiv').hide();
    for (let i = 0; i < appData.appVakits.length; i++) {
        let vakit = appData.appVakits[i].name.toLowerCase();
        let vd = $('.' + vakit + 'Div');
        let timeValue = appData.appVakits[i].displayTime;

        if (vakit === "duha") {
            let duhaend = appData.allVakits.find(f => f.name === 'Duhaend');
            let duhaendTime = duhaend.displayTime;
            timeValue += " - " + duhaendTime;
        }

        let dTitle = '';
        if (vakit === "midnight")
            dTitle = "2/3 @ " + appData.twoThirdTime;

        let vakitText = appData.i18n[vakit + 'Text'];
        if (appData.isJumua && vakit === 'dhuhr')
            vakitText = appData.i18n.jumuaText

        vd.html(`
                <div class="pt-1 small" title="${dTitle}">
                    ${vakitText}
                </div>
                <div class="p-1 vakitTime" title="${dTitle}">
                    ${timeValue}
                </div>
            `);

        let cClass = 'bg-dark border border-light rounded';
        vd.removeClass(cClass);
        if (appData.appVakits[i].isCurrentVakit == 1) {
            vd.addClass(cClass);
        }

        if (i < Math.ceil(appData.appVakits.length / 2))
            $('#vakitsRow1').append(vd);
        else
            $('#vakitsRow2').append(vd);
        vd.show();
    }

    for (let i = 0; i < appData.allVakits.length; i++) {
        let vakit = appData.allVakits[i].name.toLowerCase();
        $('#offset-' + vakit).html(appData.allVakits[i].displayTime);
    }

    setFields();

    if ($('#calendarTab').is(':visible') && !$('#calDays').children().length)
        renderCalendar();

}

$(function () {

    $("#menu-div-clock").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('#menu-div-clock').addClass('bg-secondary');
        $('.tabDiv').hide();
        $('#times').show();
        $('#footer').show();
        $('.fdate').show();
    });

    $(".menu-settings").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('#menu-div-settings').addClass('bg-secondary');
        $('.tabDiv').hide();
        $('#basicSettings').show();
        $('#footer').show();
        $('.fdate').hide();
    });

    $(".menu-adhans-offsets").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('#menu-div-adhans-offsets').addClass('bg-secondary');
        $('.tabDiv').hide();
        $('#adhanOffsetSettings').show();
        $('#footer').hide();
    });

    $(".menu-alarms").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('#menu-div-alarms').addClass('bg-secondary');
        $('.tabDiv').hide();
        $('#alarmsSettings').show();
        $('#footer').hide();
        showAlarmList();
        displayAlarms();
    });

    $(".menu-calendar").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('#menu-div-calendar').addClass('bg-secondary');
        $('.tabDiv').hide();
        $('#calendarTab').show();
        $('#footer').hide();
        const now = new Date();
        calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
        renderCalendar();
    });

    /* --- Qur'an tab --- */
    $(".menu-quran").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('#menu-div-quran').addClass('bg-secondary');
        $('.tabDiv').hide();
        $('#quranTab').show();
        $('#footer').hide();
        renderQuranPlayer();
    });

    $('#quranToggleBtn').click(() => quranSend({ quranToggle: true }));
    $('#quranPrevBtn').click(() => quranSend({ quranPrev: true }));
    $('#quranNextBtn').click(() => quranSend({ quranNext: true }));
    $('#quranDispPrevBtn').click(() => quranSend({ quranPrev: true }));   /* gold arrows flanking the surah display */
    $('#quranDispNextBtn').click(() => quranSend({ quranNext: true }));
    $('#quranBack10Btn').click(() => quranSkip(-10));
    $('#quranFwd10Btn').click(() => quranSkip(10));
    $('#quranProgress').on('input', quranOnScrub).on('change', quranOnSeek);
    $('#quranSurahCheck').click(function (e) { e.stopPropagation(); quranToggleCompleted(); });
    $('#quranKhatmReset').click(quranResetKhatm);
    $('#quranAutoContinueToggle').click(quranToggleAutoContinue);

    /* header play/pause toggle (visible on every tab) */
    $('#quranHeaderToggle').click(() => quranSend({ quranToggle: true }));
    chrome.storage.local.get(['quranState'], (r) => quranUpdateHeaderToggle(!!(r.quranState && r.quranState.isPlaying)));

    /* hide the Qur'an tab + header toggle when there's no internet connection */
    quranUpdateConnectivity();
    window.addEventListener('online', quranUpdateConnectivity);
    window.addEventListener('offline', quranUpdateConnectivity);

    $('#quranReciterBtn').click(quranOpenReciterPicker);
    $('#quranSurahBtn, #quranSurahArabic').click(quranOpenSurahPicker);
    $('#quranPickerClose').click(quranCloseReciterPicker);
    $('#quranSurahPickerClose').click(quranCloseSurahPicker);

    $('#quranReciterList').on('click', '.quran-reciter-fav', function (e) {
        e.stopPropagation();                                   /* heart only — don't also pick the reciter */
        quranToggleFavorite(this);
    });
    $('#quranReciterList').on('click', '.quran-picker-item', function () {
        quranSetReciter(this.dataset.id);
        quranCloseReciterPicker();
    });
    $('#quranSurahList').on('click', '.quran-srow-check', function (e) {
        e.stopPropagation();                                   /* don't also trigger the row (jump) */
        quranToggleCompleted(parseInt(this.dataset.surah, 10));
    });
    $('#quranSurahList').on('click', '.quran-srow', function () {
        quranSend({ quranSelectSurah: parseInt(this.dataset.surah, 10) });
        quranCloseSurahPicker();
    });

    $("#infoIcon").click(function (e) {
        $('.menu-div').removeClass('bg-secondary');
        $('.tabDiv').hide();
        $('#infoTab').show();
        $('#footer').hide();
    });

    $('#calPrev').click(function () {
        calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1);
        renderCalendar();
    });

    $('#calNext').click(function () {
        calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1);
        renderCalendar();
    });

    $('#calTitle').click(function () {
        const now = new Date();
        calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
        renderCalendar();
    });

    $("#calculationMethod").change(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.calculationMethod = $('#calculationMethod').val();
            saveAppDataAndRefresh(appData);
        });
    });

    $("#desktopNotificationsToggle").click(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.desktopNotifications = !appData.settings.desktopNotifications;
            saveAppDataAndRefresh(appData);
            chrome.notifications.clear('test');
            if (appData.settings.desktopNotifications) {
                showNotification('test', appData.i18n['desktopNotificationsOnTitle'], appData.settings.address);
                chrome.storage.local.set({ 'lastAlert': 'settingUpdate' });
            }
        });
    });

    $("#showImsakToggle").click(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.showImsak = !appData.settings.showImsak;
            saveAppDataAndRefresh(appData);
        });
    });

    $("#showDuhaToggle").click(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.showDuha = !appData.settings.showDuha;
            saveAppDataAndRefresh(appData);
        });
    });

    $("#showMidnightToggle").click(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.showMidnight = !appData.settings.showMidnight;
            saveAppDataAndRefresh(appData);
        });
    });

    $("#hour24Toggle").click(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.timeFormat = (appData.settings.timeFormat == 12) ? 24 : 12;
            saveAppDataAndRefresh(appData);
        });
    });

    $(".adhansToggle").click(function () {
        navigator.serviceWorker.controller.postMessage({ endAdhanCall: true });
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.areAdhansEnabled = !appData.settings.areAdhansEnabled;
            saveAppDataAndRefresh(appData);
            displayAdhansAndOffsets();
        });
    });

    $("#hanafiAsrToggle").click(function () {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.hanafiAsr = !appData.settings.hanafiAsr;
            saveAppDataAndRefresh(appData);
        });
    });

    $(".iconButton").click(function (e) {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.iconStyle = e.currentTarget.value;
            saveAppDataAndRefresh(appData);
        });
    });

    $("#googleMapsButton").click(function (e) {
        window.open('https://maps.google.com/?q=' + appData.settings.address)
    });

    $(".lastHourHilite").click(function (e) {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.lastHourHilite = ((appData.lastHourHilite ?? 0) + 1) % 2;
            saveAppDataAndRefresh(appData);
        });
    });

    $("#addressForm").submit(function (event) {

        event.preventDefault();
        showLoading();
        $('#addressButton').attr('disabled', true);

        chrome.storage.local.get(['appData'], function (result) {

            appData = result.appData;

            let ceCallURL = 'https://smartazanclock.com/geosettings?address=' + $('#address').val();

            fetch(ceCallURL, { method: 'POST' }).then((response) => {
                if (response.status == 200) {
                    response.json().then((data) => {

                        settingsCodeFields.forEach(field => {
                            if (field in data) {
                                appData.settings[field] = data[field];
                            }
                        });

                        chrome.storage.local.set({ 'appData': appData }, () => {
                            goGoRun('address updated');
                            $('#address').val(appData.settings.address);
                            $('#addressButton').attr('disabled', false);
                            $('#loadingImg').attr('src', '/images/check.png');
                            $(':focus').blur();
                            hideLoadingOnSuccess();
                        });
                    });
                }
                else
                    addressSearchFail()

            }).catch((err) => { addressSearchFail() });

        });

    });

    $("#hijriDateIncrease").click(function (e) {
        saveHijriDateOffset('+');
    });

    $("#hijriDateDecrease").click(function (e) {
        saveHijriDateOffset('-');
    });

    $("#displayLanguage").change(function (e) {
        let code = e.target.value;
        let i18nValues = {};
        let lang = languages.some(f => f.code == code) ? code : 'en';
        fetch('_locales/' + lang + '/messages.json').then((response) => {
            response.json().then((data) => {
                Object.entries(data).forEach(([key, value]) => { i18nValues[key] = value.message });
                appData.i18n = i18nValues;
                saveAppDataAndRefresh(appData);
                displayAdhansAndOffsets();
            });
        });
    });

    $("#appResetButton").click(function (e) {
        document.getSelection().removeAllRanges();
        navigator.serviceWorker.controller.postMessage({ endAdhanCall: true });
        quranSend({ quranStop: true });
        adhanStatus = {};
        showLoading();
        chrome.storage.local.clear();
        goGoRun('extension reset');
        setTimeout(() => {
            $("#menu-div-clock").trigger("click");
            hideLoadingOnSuccess();
        }, 2000);
    });

    $("#audioPlayerDiv").click(function (e) {
        stopAudio();
    });

    $("#showAlarmFormBtn").click(showAlarmForm);
    $("#alarmFormBackBtn").click(showAlarmList);
    $("#addAlarmButton").click(addAlarm);
    $("#addNaflButton").click(addNaflAlarm);
    $("#alarmsList").on('click', '.removeAlarmBtn', function () {
        removeAlarm(this.dataset.type, this.dataset.index * 1);
    });

    $("#stopAdhanDiv").click(() => {
        navigator.serviceWorker.controller.postMessage({ endAdhanCall: true });
    });

    $("#settingsCodeButton").click(async function () {
        const $button = $(this);
        if ($button.prop('disabled')) return;
        let originalButtonText = $button.html();
        $button.prop('disabled', true);
        try {
            const myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/json");
            const requestOptions = { method: "POST", headers: myHeaders, body: JSON.stringify(appData.settings) };
            const response = await fetch("https://smartazanclock.com/settings-code", requestOptions);
            const data = await response.json();
            const backupCode = data.id;
            await navigator.clipboard.writeText(backupCode);
            $button.html(`
                    <span><img src="images/check-mini.png" /></span>
                    <span>${backupCode} <small>${appData.i18n.copiedText}</small></span>
                `);
        } catch (err) {
            $button.html('Error!');
        } finally {
            setTimeout(() => {
                $button.html(originalButtonText);
                $button.prop('disabled', false);
            }, 1200);
        }
    });

    let scb = document.getElementById('settingsCodeButton');
    let tooltip = bootstrap.Tooltip.getOrCreateInstance(scb, { trigger: 'hover', customClass: 'custom-tooltip' });
    scb.addEventListener('show.bs.tooltip', () => {
        const currentContent = tooltip._config.title;
        if (currentContent !== appData.i18n.settingsCodeInfo) {
            tooltip._config.title = appData.i18n.settingsCodeInfo;
        }
    });

    let arb = document.getElementById('appResetButton');
    let tooltipAR = bootstrap.Tooltip.getOrCreateInstance(arb, { trigger: 'hover', customClass: 'custom-red-tooltip' });
    arb.addEventListener('show.bs.tooltip', () => {
        tooltipAR._config.title = 'Reset Version ' + chrome.runtime.getManifest().version;
    });

});

document.addEventListener('click', function (event) {

    const playBtn = event.target && event.target.closest && event.target.closest('.playAudioButton');
    if (playBtn) {
        playAudio(appData.settings.adhans[playBtn.dataset.vakit]);
    }

    if (event.target && event.target.classList.contains('adhanRecitorBtn')) {
        let isVisible = $('#adhanRow' + event.target.dataset.name).is(':visible')
        $('.adhanRow').slideUp();
        if (!isVisible) {
            $('#adhanRow' + event.target.dataset.name).slideToggle();
        }
    }

    if (event.target && event.target.classList.contains('offsetIncrease')) {
        let vakit = event.target.dataset.vakit;
        saveOffset(vakit, '+');
    }

    if (event.target && event.target.classList.contains('offsetDecrease')) {
        let vakit = event.target.dataset.vakit;
        saveOffset(vakit, '-');
    }

});

document.getElementById('adhanOffsetSettings').addEventListener('change', function (event) {
    if (event.target && event.target.matches('select.adhanDD')) {
        chrome.storage.local.get(['appData'], function (result) {
            appData = result.appData;
            appData.settings.adhans[event.target.dataset.name] = event.target.value * 1;
            saveAppDataAndRefresh(appData);
            if (event.target.value != 0) {
                $('#adhanRow' + event.target.dataset.name).removeClass('d-none');
            }
        });
    }
});

/* paint the blue fill of the volume bar (value 1–10 → 0–100%), mirroring quranFillBar */
function volumeFillBar(range) {
    range = range || document.getElementById('volume');
    if (!range) return;
    const min = (+range.min) || 0, max = (+range.max) || 100;
    const pct = (max > min) ? ((range.value - min) / (max - min)) * 100 : 0;
    range.style.setProperty('--vol-pct', pct + '%');
}

document.getElementById('volume').addEventListener('input', function (event) {
    volumeFillBar(event.target);   /* grow the blue fill live while dragging */
});

document.getElementById('volume').addEventListener('change', function (event) {
    chrome.storage.local.get(['appData'], function (result) {
        appData = result.appData;
        appData.settings.volume = event.target.value * 1;
        saveAppDataAndRefresh(appData);
        quranSend({ quranSetVolume: appData.settings.volume });   /* live volume for Qur'an playback */
        playAudio(102);
    });
});

const saveAppDataAndRefresh = (appData) => {
    chrome.storage.local.set({ 'appData': appData }, function () {
        goGoRun('appData updated');
        $(':focus').blur();
    });
}

const setFields = async () => {

    $('#stopAdhanDiv').hide();
    if (adhanStatus.isBeingCalled)
        $('#stopAdhanDiv').show();

    /* the adhan and Qur'an share the offscreen audio, so hide the header Qur'an play/pause
       toggle while an adhan is being called (the red stop-adhan button takes its place) */
    $('#quranHeaderToggle').toggleClass('adhan-hidden', !!adhanStatus.isBeingCalled);

    let hasAlarms = (appData.settings.alarms && appData.settings.alarms.length) || (appData.settings.naflAlarms && appData.settings.naflAlarms.length);
    $('#alarmMenuIcon').attr('src', hasAlarms ? 'images/alarm-active.svg' : 'images/alarm.svg');

    if (!$('#basicSettings').is(':visible'))
        $('#address').val(appData.settings.address);

    let topAddressMaxLen = 10;
    let topAddress = appData.settings.address.substring(0, topAddressMaxLen).trimEnd() + ((appData.settings.address.length > topAddressMaxLen) ? '…' : '');
    $('#addressMenuText').html(topAddress);
    $('.timeNowTitle').html(appData.timeNow).attr('title', 'Current Time in ' + appData.settings.timeZoneID);
    const calculationMethodEl = document.getElementById('calculationMethod');
    const isCalculationMethodActive = document.activeElement === calculationMethodEl;
    if (!isCalculationMethodActive) {
        $('#calculationMethod').val(appData.settings.calculationMethod);
    }

    $('#fajrAngle').html(appData.i18n['fajrText'] + ' ' + appData.fajrAngle);
    $('#ishaAngle').html(appData.i18n['ishaText'] + ' ' + appData.ishaAngle);

    $('.iconButton').removeClass('btn-primary').addClass('btn-darkish');
    $('#' + appData.settings.iconStyle.toLowerCase() + 'Button').removeClass('btn-darkish').addClass("btn-primary");

    $('#desktopNotificationsSwitch').toggleClass('on', !!appData.settings.desktopNotifications);

    $('#hanafiAsrSwitch').toggleClass('on', !!appData.settings.hanafiAsr);

    $('#showImsakSwitch').toggleClass('on', !!appData.settings.showImsak);

    $('#showDuhaSwitch').toggleClass('on', !!appData.settings.showDuha);

    $('#showMidnightSwitch').toggleClass('on', !!appData.settings.showMidnight);

    $('#hour24Switch').toggleClass('on', appData.settings.timeFormat != 12);

    $('.lastHourHilite').hide();
    if (appData.settings.isLastHour) {
        if (appData.lastHourHilite == 0) {
            $('#lastHourHiliteOff').show();
        }
        else {
            $('#lastHourHiliteOn').show();
        }
    }

    const dispLangEl = document.getElementById('displayLanguage');
    const isDisplayLanguageActive = document.activeElement === dispLangEl;
    if (!isDisplayLanguageActive) {
        dispLangEl.innerHTML = '';
        languages.forEach(language => {
            const option = document.createElement('option');
            option.value = language.code;
            option.textContent = language.name;
            option.selected = appData.i18n.languageCode == language.code;
            option.classList.add(`flag-${language.code}`)
            dispLangEl.appendChild(option);
        });
    }

    if (!isCalculationMethodActive) {
        const calculationMethod = document.getElementById('calculationMethod');
        calculationMethod.innerHTML = '';
        methods.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.name;
            if (appData.settings.calculationMethod == m.id)
                option.selected = true;
            calculationMethod.appendChild(option);
        });
    }

    $('#audioVolumeIcon').attr('src', 'images/audio-' + appData.settings.volume + '.png');
    $('#audioVolumeDiv').attr('title', 'Audio Volume: ' + appData.settings.volume);
    /* Volume applies to both adhan and alarm audio (see callAlarm in
       serviceWorker.js), so keep the slider enabled even when adhan calls are
       disabled — alarms may still be on. */
    $('#volume').attr('disabled', false);
    if (!$('#adhanOffsetSettings').is(':visible'))
        displayAdhansAndOffsets();

    if ($('#alarmsSettings').is(':visible'))
        displayAlarms();

}

const displayAdhansAndOffsets = () => {

    $('#volume').val(appData.settings.volume);
    volumeFillBar();   /* paint the blue fill on load/refresh */

    $('.offsetCurrentVakit').removeClass('offsetCurrentVakit');
    let adhanVakits = ['imsak', 'fajr', 'duha', 'duhaend', 'dhuhr', 'asr', 'maghrib', 'isha'];
    let aoContent = `<div class="badge p-0 mt-0">${appData.i18n.adhansAndOffsetsTitle}</div>`;
    let offsetPresent = false;
    let imsakOffset = imsakDefaultOffset + (appData.settings.vakitOffsets && appData.settings.vakitOffsets.imsak ? appData.settings.vakitOffsets.imsak : 0);
    let duhaOffset = duhaDefaultOffset + (appData.settings.vakitOffsets && appData.settings.vakitOffsets.duha ? appData.settings.vakitOffsets.duha : 0);
    let duhaendOffset = duhaendDefaultOffset + (appData.settings.vakitOffsets && appData.settings.vakitOffsets.duhaend ? appData.settings.vakitOffsets.duhaend : 0);
    let currentVakit = appData.allVakits.find(f => f.isCurrentVakit).name.toLowerCase();

    $('.adhan-on').hide();
    $('.adhan-off').hide();
    if (appData.settings.areAdhansEnabled)
        $('.adhan-on').show();
    else
        $('.adhan-off').show();
    $('#adhanEnabledSwitch').toggleClass('on', !!appData.settings.areAdhansEnabled);

    adhanVakits.forEach((v) => {
        let thisTime = appData.allVakits.find(f => f.name.toLowerCase() == v);
        let timeValue = thisTime.displayTime;
        let fajrAdhans = adhanAudios.filter(a => a.isFajrAdhan);
        let adhans = adhanAudios.filter(a => a.isAdhan);
        let thisAdhanAudioID = appData.settings.adhans[v] ?? 0;
        let thisAudioTitle = adhanAudios.find(a => a.id == thisAdhanAudioID)?.name;
        aoContent += `<div id=settingBox${v} class="bg-darkish px-1
                    ${v == 'duha' ? 'rounded-top pt-1' : (v == 'duhaend' ? 'rounded-bottom pb-1' : 'rounded py-2')}
                    ${v != 'duha' ? 'mb-1' : ''}
                    ${thisTime.isCurrentVakit || (v == 'duhaend' && currentVakit == 'duha') ? 'border-start border-3 border-light' : ''}">`;
        aoContent += `<div class="d-flex flex-row justify-content-between">`;

        aoContent += `<div class="col-4">`;
        if (v != 'duhaend')
            aoContent += `<span class="badge">${appData.i18n[v + 'Text']}</span>`;

        if (v == 'imsak')
            aoContent += `<img title="${appData.i18n.fajrText + imsakOffset}" class="img-fluid" src="/images/info.png">`

        if (v == 'duha')
            aoContent += `<img title="(${appData.i18n.sunriseText}+${duhaOffset}) - (${appData.i18n.dhuhrText}${duhaendOffset})" class="img-fluid" src="/images/info.png">`

        if (v == 'isha')
            aoContent += `<img title="${appData.i18n.midnightText} @ ${appData.allVakits[9].displayTime} - 2/3 @ ${appData.twoThirdTime}" class="img-fluid" src="/images/info.png">`

        aoContent += '</div>';

        aoContent += `<div class="col-2"><span id="offset-${v}" class="badge">${timeValue}</span></div>`

        /* offsets */

        let offsetValue = appData.settings.vakitOffsets && appData.settings.vakitOffsets[v] ? appData.settings.vakitOffsets[v] : 0;
        if (offsetValue != 0)
            offsetPresent = true;
        let stdLimit = 90;
        if (v == 'duha' || v == 'maghrib')
            stdLimit = 45;

        let increaseDisabled = false;
        let decreaseDisabled = false;

        if (offsetValue >= stdLimit)
            increaseDisabled = true;

        if (offsetValue <= -stdLimit)
            decreaseDisabled = true;

        if (v == 'imsak' && offsetValue >= 0)
            increaseDisabled = true;

        if (v == 'duha' && offsetValue <= 0)
            decreaseDisabled = true;

        if (v == 'duhaend' && offsetValue >= 0)
            increaseDisabled = true;

        if (v == 'maghrib' && offsetValue <= -3)
            decreaseDisabled = true;


        aoContent += '<div class="col-5">';
        aoContent += `
                            <div class="d-flex flex-row gap-1 justify-content-center">
                                <div><button ${decreaseDisabled ? 'disabled' : ''} class="btn btn-dark btn-xs offsetDecrease" id="${v}OffsetDecrease"
                                        data-vakit="${v}">-</button></div>
                                <div>
                                    <span id="${v}Offset" class="badge ${offsetValue != 0 ? 'bg-danger text-light' : 'bg-light text-dark'}">${offsetValue}</span>
                                </div>
                                <div>
                                    <button ${increaseDisabled ? 'disabled' : ''} class="btn btn-dark btn-xs offsetIncrease" id="${v}OffsetIncrease"
                                        data-vakit="${v}">+</button>
                                </div>
                            </div>
            `;
        aoContent += '</div>';
        /* offsets, end */

        /* adhan settings */
        if (appData.settings.adhans.hasOwnProperty(v)) {
            aoContent += `<div class="col-1">`;
            aoContent += `<img title='${thisAudioTitle}' class="${appData.settings.areAdhansEnabled ? 'adhanRecitorBtn pointerOn' : ''} ms-1 img-fluid" data-name=${v} src="images/mic${appData.settings.areAdhansEnabled ? '.svg' : '-na.png'}"/>`;
            aoContent += `</div>`;
        }
        else {
            aoContent += `<div class="col-1"></div>`;
        }
        /* adhan settings, end */

        aoContent += '</div>';

        if (appData.settings.adhans.hasOwnProperty(v)) {

            aoContent += `<div class="adhanRow" id="adhanRow${v}" style="display:none;">`
            aoContent += `<div class="d-flex flex-row gap-1 mt-1 px-1 justify-content-between align-items-center">`
            aoContent += `<div class="flex-fill">`
            aoContent += `<select class="form-control form-control-sm adhanDD" 
                                data-name="${v}">
                                `;
            if (v == 'fajr') {
                fajrAdhans.forEach(a => {
                    aoContent += `<option ${thisAdhanAudioID == a.id ? "selected" : ""} value=${a.id}>${a.name}</option>`
                })
            }
            else {
                adhans.forEach(a => {
                    aoContent += `<option ${thisAdhanAudioID == a.id ? "selected" : ""} value=${a.id}>${a.name}</option>`
                })
            }
            aoContent += "</select>";
            aoContent += "</div>";

            aoContent += `<div><button type="button" class="playAudioButton${audioPlayer.paused ? '' : ' playing'}" data-vakit="${v}" data-title="${thisAudioTitle}">`
                + `<svg class="aicon aplay" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>`
                + `<svg class="aicon apause" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>`
                + `</button></div>`;

            aoContent += '</div>';
            aoContent += '</div>';

        }

        aoContent += '</div>';

    });

    let hijriDateOffset = appData.settings.hijriDateOffset ?? 0;

    $('#hijriDateOffset').html(hijriDateOffset);
    $('#hijriDateIncrease').attr("disabled", false);
    $('#hijriDateDecrease').attr("disabled", false);

    if (hijriDateOffset != 0) {
        $('#hijriDateOffset').removeClass('bg-light text-dark').addClass('bg-danger text-light');
        offsetPresent = true;
    }
    else {
        $('#hijriDateOffset').removeClass('bg-danger text-light').addClass('bg-light text-dark');
    }
    if (hijriDateOffset >= 2)
        $('#hijriDateIncrease').attr("disabled", true);

    if (hijriDateOffset <= -2)
        $('#hijriDateDecrease').attr("disabled", true);


    $('.offset-adjustments').hide();
    if (offsetPresent) {
        $('#offset-adjustments-red').show();
    }
    else {
        $('#offset-adjustments-blank').show();
    }
    if (offsetPresent) {
        $('#adhan-on').show();
    }
    else {
        $('#offset-adjustments-blank').show();
    }

    $('#adhanOffsetSettingsContent').html(aoContent);

}

const playAudio = (id) => {
    audioPlayer.src = '/adhans/' + id + '.mp3';
    audioPlayer.volume = appData.settings.volume / 10;
    $('.playAudioButton').addClass('playing');
    audioPlayer.play();
    $('#audioPlayerDiv').show();
}

const stopAudio = () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    $('.playAudioButton').removeClass('playing');
    $('#audioPlayerDiv').hide();
}

audioPlayer.onended = () => {
    stopAudio();
}

const saveOffset = (name, action) => {
    chrome.storage.local.get(['appData'], function (result) {

        appData = result.appData;

        if (!appData.settings.vakitOffsets)
            appData.settings.vakitOffsets = {};

        let cv = appData.settings.vakitOffsets[name] ?? 0;

        if (action == '+')
            cv++;
        else
            cv--;
        appData.settings.vakitOffsets[name] = cv;
        chrome.storage.local.set({ 'appData': appData }, function () {
            goGoRun('offset update');
            $(':focus').blur();
            displayAdhansAndOffsets();
        });

    });
}

const saveHijriDateOffset = (action) => {

    chrome.storage.local.get(['appData'], function (result) {

        appData = result.appData;

        if (!appData.settings.hijriDateOffset)
            appData.settings.hijriDateOffset = 0;

        let cv = appData.settings.hijriDateOffset;

        if (action == '+')
            cv++;
        else
            cv--;

        appData.settings.hijriDateOffset = cv;

        chrome.storage.local.set({ 'appData': appData }, function () {
            goGoRun('hijri date offset updated');
            $(':focus').blur();
            displayAdhansAndOffsets();
        });

    });

}

const displayAlarms = () => {
    initAlarmControls();
    if (!appData || !appData.settings)
        return;
    renderAlarmsList();
};

/* The alarm page opens on the list (count + Add button); the form only appears
   after the user taps Add, and any add/remove returns them to the list. */
const showAlarmForm = () => {
    $('#alarmListView').addClass('alarm-hidden');
    $('#alarmFormView').removeClass('alarm-hidden');
};

const showAlarmList = () => {
    $('#alarmFormView').addClass('alarm-hidden');
    $('#alarmListView').removeClass('alarm-hidden');
};

const initAlarmControls = () => {
    if ($('#alarmHour option').length === 0) {

        $('#alarmSound').html(alarmSounds.map(a => `<option value="${a.id}">${a.name}</option>`).join(''));
        $('#naflSound').html(naflSounds.map(a => `<option value="${a.id}">${a.name}</option>`).join(''));

        let hours = '';
        for (let i = 1; i <= 12; i++)
            hours += `<option value="${i}">${i}</option>`;
        $('#alarmHour').html(hours);

        let minutes = '';
        for (let i = 0; i < 60; i++) {
            let mv = i < 10 ? '0' + i : i;
            minutes += `<option value="${mv}">${mv}</option>`;
        }
        $('#alarmMinute').html(minutes);

        $('#naflVakit').html(naflVakits.map(v => `<option value="${v.value}" class="${v.i18n}">${(appData.i18n && appData.i18n[v.i18n]) || v.value}</option>`).join(''));
    }

    let lang = (appData && appData.i18n && appData.i18n.languageCode) || '';
    if (lang !== initAlarmControls.lang) {
        initAlarmControls.lang = lang;
        let minWord = (appData && appData.i18n && appData.i18n.minText) || 'min';
        let selected = $('#naflMinutes').val();
        let naflMinutes = '';
        for (let i = 1; i <= 60; i++)
            naflMinutes += `<option value="${i}">${i} ${minWord}</option>`;
        $('#naflMinutes').html(naflMinutes);
        if (selected)
            $('#naflMinutes').val(selected);
    }
};

const renderAlarmsList = () => {
    let alarms = (appData.settings && appData.settings.alarms) || [];
    let naflAlarms = (appData.settings && appData.settings.naflAlarms) || [];
    let i18n = (appData && appData.i18n) || {};

    /* The localized word ("Alarms") is filled from the class-based i18n pass
       (runApp / applyLatestI18n); here we only keep the (N) count current. */
    $('#alarmsCount').text('(' + (alarms.length + naflAlarms.length) + ')');

    let day = new Date(new Date().toLocaleString('en-US', { timeZone: appData.settings.timeZoneID })).getDay();
    let isWeekDay = day > 0 && day < 6;

    let html = '';

    if (alarms.length === 0 && naflAlarms.length === 0) {
        let noAlarms = i18n.noAlarmsText || 'No alarms set.';
        let note = i18n.alarmsNoteText || 'Alarms always play, even when adhan calls are off.';
        let bulb = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
        html = `<div class="alarm-tip small d-flex align-items-start gap-2">
                    ${bulb}
                    <div class="flex-grow-1">
                        <div>${noAlarms}</div>
                        <hr class="alarm-tip-hr">
                        <div>${note}</div>
                    </div>
                </div>`;
    }

    alarms.forEach((a, index) => {
        let name = adhanAudios.find(x => x.id == a.id)?.name ?? '';
        let active = (a.frequency === 'E') || (a.frequency === 'W' && isWeekDay);
        html += alarmCard(active ? 'alarm-dot' : 'gray-dot', name,
            `${a.frequency === 'W' ? 'Weekdays' : 'Everyday'} at ${a.hour}:${a.minute}${a.ap}`, 'alarm', index);
    });

    naflAlarms.forEach((a, index) => {
        let name = adhanAudios.find(x => x.id == a.id)?.name ?? '';
        html += alarmCard('nafl-alarm-dot', name,
            `${a.minutes} min${a.minutes > 1 ? 's' : ''} ${a.when} ${a.vakit}`, 'nafl', index);
    });

    $('#alarmsList').html(html);
};

const alarmCard = (dotClass, name, schedule, type, index) => {
    return `
        <div class="alarm-item">
            <div class="alarm-item-icon"><span class="${dotClass}"></span></div>
            <div class="alarm-item-info">
                <div class="alarm-item-name">${name}</div>
                <div class="alarm-item-schedule">${schedule}</div>
            </div>
            <button type="button" class="alarm-item-remove removeAlarmBtn"
                data-type="${type}" data-index="${index}" aria-label="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`;
};

const addAlarm = () => {
    chrome.storage.local.get(['appData'], function (result) {
        appData = result.appData;
        if (!appData.settings.alarms)
            appData.settings.alarms = [];

        let id = $('#alarmSound').val() * 1;
        let frequency = $('#alarmFrequency').val();
        let hour = $('#alarmHour').val();
        let minute = $('#alarmMinute').val();
        let ap = $('#alarmAp').val();
        let time = (hour === '12' ? (ap === 'pm' ? 12 : 0) : (ap === 'pm' ? hour * 1 + 12 : hour)) + ':' + minute;

        let existingIndex = appData.settings.alarms.findIndex(f => f.hour === hour && f.minute === minute && f.ap === ap && f.frequency === frequency);
        if (existingIndex >= 0)
            appData.settings.alarms.splice(existingIndex, 1);

        appData.settings.alarms.push({ id, frequency, hour, minute, ap, time });
        saveAlarmsAndRefresh();
    });
};

const addNaflAlarm = () => {
    chrome.storage.local.get(['appData'], function (result) {
        appData = result.appData;
        if (!appData.settings.naflAlarms)
            appData.settings.naflAlarms = [];

        let id = $('#naflSound').val() * 1;
        let minutes = $('#naflMinutes').val() * 1;
        let when = $('#naflWhen').val();
        let vakit = $('#naflVakit').val();

        let existingIndex = appData.settings.naflAlarms.findIndex(f => f.minutes === minutes && f.when === when && f.vakit === vakit);
        if (existingIndex >= 0)
            appData.settings.naflAlarms.splice(existingIndex, 1);

        appData.settings.naflAlarms.push({ id, minutes, when, vakit });
        saveAlarmsAndRefresh();
    });
};

const removeAlarm = (type, index) => {
    chrome.storage.local.get(['appData'], function (result) {
        appData = result.appData;
        if (type === 'alarm' && appData.settings.alarms)
            appData.settings.alarms.splice(index, 1);
        else if (type === 'nafl' && appData.settings.naflAlarms)
            appData.settings.naflAlarms.splice(index, 1);
        saveAlarmsAndRefresh();
    });
};

const saveAlarmsAndRefresh = () => {
    chrome.storage.local.set({ 'appData': appData }, function () {
        goGoRun('alarms updated');
        renderAlarmsList();
        showAlarmList();
        $(':focus').blur();
    });
};

const addressSearchFail = () => {
    $('#addressButton').attr('disabled', false);
    $('#address').val(appData.settings.address);
    $(':focus').blur();
    hideLoadingOnError();
}

const showLoading = () => {
    $('#loadingImg').attr('src', '/images/loading.png');
    $('#loading').show();
}

const hideLoadingOnSuccess = () => {
    $('#loadingImg').attr('src', '/images/check.png');
    setTimeout(() => { $('#loading').hide() }, 500);
}

const hideLoadingOnError = () => {
    $('#loadingImg').attr('src', '/images/x.png');
    setTimeout(() => { $('#loading').hide() }, 500);
}

/* ---------- Calendar tab: combined Hijri + Gregorian view ---------- */

let calViewDate = null; /* first day of the Gregorian month currently in view */

const calAddDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

const calStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const calLang = () => (appData && appData.i18n && appData.i18n.languageCode) || navigator.language || 'en';

const calHijriOffset = () => (appData && appData.settings && appData.settings.hijriDateOffset) || 0;

const calEsc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Calendar/holy-day strings, with English fallback (see calendarLocale in vars.js). */
const calT = (key) => {
    const table = (typeof calendarLocale !== 'undefined') ? calendarLocale : {};
    const lang = calLang();
    const base = lang.split(/[-_]/)[0];
    return (table[lang] && table[lang][key])
        || (table[base] && table[base][key])
        || (table.en && table.en[key])
        || key;
};

/* Hijri (islamic-umalqura) components for a date, as integers. Uses the 'en'
   locale so digits are always ASCII and safe to parse. */
const calGetHijriParts = (date) => {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',
        { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    const o = {};
    for (const p of parts) {
        if (p.type === 'year') o.hy = parseInt(p.value.replace(/[^0-9]/g, ''), 10);
        else if (p.type === 'month') o.hm = parseInt(p.value, 10);
        else if (p.type === 'day') o.hd = parseInt(p.value, 10);
    }
    return o;
};

/* Localized number (e.g. Arabic-Indic digits for ar/fa), without digit grouping
   so years render as "1448" rather than "1,448". */
const calNum = (n) => {
    try { return new Intl.NumberFormat(calLang(), { useGrouping: false }).format(n); }
    catch (e) { return String(n); }
};

/* Localized Hijri month name for the Hijri month that `date` falls in. */
const calHijriMonthName = (date, style) => {
    try {
        return new Intl.DateTimeFormat(calLang() + '-u-ca-islamic-umalqura', { month: style }).format(date);
    } catch (e) {
        return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: style }).format(date);
    }
};

/* Full localized Hijri date string, e.g. "10 Muharram 1449". `offset` shifts the
   Hijri reckoning to stay consistent with the rest of the app (hijriDateOffset). */
const calHijriDateString = (date, offset) => {
    const d = calAddDays(date, offset);
    try {
        return new Intl.DateTimeFormat(calLang() + '-u-ca-islamic-umalqura',
            { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (e) {
        return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',
            { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    }
};

/* Convert a Hijri (year, month, day) to the Gregorian Date on which it falls,
   matched against the same islamic-umalqura calendar the app uses. */
const calHijriToGregorian = (hy, hm, hd) => {
    const targetTotal = (hy - 1) * 354.367 + (hm - 1) * 29.53 + hd;
    let guess = new Date();
    guess.setHours(12, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
        const p = calGetHijriParts(guess);
        const gt = (p.hy - 1) * 354.367 + (p.hm - 1) * 29.53 + p.hd;
        const diff = Math.round(targetTotal - gt);
        if (diff === 0) break;
        guess = calAddDays(guess, diff);
    }
    for (let off = 0; off <= 20; off++) {
        const steps = off === 0 ? [0] : [off, -off];
        for (const s of steps) {
            const d = calAddDays(guess, s);
            const p = calGetHijriParts(d);
            if (p.hy === hy && p.hm === hm && p.hd === hd) return calStartOfDay(d);
        }
    }
    return null;
};

/* Resolve a holiday's Hijri day-of-month for a given Hijri year. Most entries
   carry a fixed `day`; an entry with `firstWeekday` instead (0 = Sunday ... 6 =
   Saturday) falls on the first such weekday of its month, so its Hijri day shifts
   from year to year — e.g. Laylat al-Raghaib, the first Friday night of Rajab. */
const calHolidayDay = (hol, hy) => {
    if (typeof hol.day === 'number') return hol.day;
    if (typeof hol.firstWeekday === 'number') {
        const first = calHijriToGregorian(hy, hol.month, 1);
        if (!first) return null;
        return 1 + ((hol.firstWeekday - first.getDay() + 7) % 7);
    }
    return null;
};

/* First day of the week for a locale (JS convention: 0 = Sunday ... 6 = Saturday). */
const calFirstDayOfWeek = (lang) => {
    try {
        const loc = new Intl.Locale(lang);
        const wi = (typeof loc.getWeekInfo === 'function') ? loc.getWeekInfo() : loc.weekInfo;
        if (wi && wi.firstDay) return wi.firstDay % 7; /* ISO 1..7 (Mon..Sun) -> 0..6 (Sun..Sat) */
    } catch (e) { /* fall through */ }
    return 0;
};

const calDateKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

const renderCalendar = () => {
    if (!appData || !appData.i18n) return;
    if (!calViewDate) {
        const now = new Date();
        calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const lang = calLang();
    const offset = calHijriOffset();
    const viewYear = calViewDate.getFullYear();
    const viewMonth = calViewDate.getMonth();

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

    /* --- Title: Gregorian month/year + the Hijri month(s) spanning it --- */
    const gregTitle = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(firstOfMonth);
    const hFirst = calGetHijriParts(calAddDays(firstOfMonth, offset));
    const hLast = calGetHijriParts(calAddDays(lastOfMonth, offset));
    const hNameFirst = calHijriMonthName(calAddDays(firstOfMonth, offset), 'long');
    let hijriTitle;
    if (hFirst.hm === hLast.hm && hFirst.hy === hLast.hy) {
        hijriTitle = hNameFirst + ' ' + calNum(hFirst.hy);
    } else {
        const hNameLast = calHijriMonthName(calAddDays(lastOfMonth, offset), 'long');
        if (hFirst.hy === hLast.hy)
            hijriTitle = hNameFirst + ' – ' + hNameLast + ' ' + calNum(hLast.hy);
        else
            hijriTitle = hNameFirst + ' ' + calNum(hFirst.hy) + ' – ' + hNameLast + ' ' + calNum(hLast.hy);
    }
    $('#calTitle').html('<div class="cal-title-greg">' + calEsc(gregTitle) + '</div>'
        + '<div class="cal-title-hijri">' + calEsc(hijriTitle) + '</div>');
    $('#calTitle').attr('title', calT('today'));

    /* --- Weekday header --- */
    const firstDow = calFirstDayOfWeek(lang);
    const weekdayFmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    const knownSunday = new Date(2023, 0, 1); /* Jan 1 2023 was a Sunday */
    let wkHtml = '';
    for (let i = 0; i < 7; i++) {
        const dow = (firstDow + i) % 7;
        wkHtml += '<div>' + calEsc(weekdayFmt.format(calAddDays(knownSunday, dow))) + '</div>';
    }
    $('#calWeekdays').html(wkHtml);

    /* --- Day grid (6 weeks) --- */
    const lead = (firstOfMonth.getDay() - firstDow + 7) % 7;
    const gridStart = calAddDays(firstOfMonth, -lead);
    const today = calStartOfDay(new Date());

    let daysHtml = '';
    for (let i = 0; i < 42; i++) {
        const d = calStartOfDay(calAddDays(gridStart, i));
        const h = calGetHijriParts(calAddDays(d, offset));
        const isOther = d.getMonth() !== viewMonth;
        const isToday = d.getTime() === today.getTime();
        const holy = islamicHolidays.find(x => x.month === h.hm && calHolidayDay(x, h.hy) === h.hd);

        /* Show the Hijri month (short) when a new Hijri month starts, else the day. */
        const hijriDisplay = (h.hd === 1)
            ? calHijriMonthName(calAddDays(d, offset), 'short')
            : calNum(h.hd);

        let cls = 'cal-day';
        if (isOther) cls += ' other-month';
        if (isToday) cls += ' today';
        if (h.hd === 1) cls += ' cal-hijri-month-start';
        if (holy) cls += ' holyday';

        const title = holy ? ' title="' + calEsc(calT(holy.key)) + '"' : '';
        daysHtml += '<div class="' + cls + '"' + title + '>'
            + (holy ? '<span class="cal-dot"></span>' : '')
            + '<span class="cal-greg">' + d.getDate() + '</span>'
            + '<span class="cal-hijri">' + calEsc(hijriDisplay) + '</span>'
            + '</div>';
    }
    $('#calDays').html(daysHtml);

    renderUpcomingHolydays();
};

/* Future holy days (today onward), next occurrence of each, sorted by date. */
const renderUpcomingHolydays = () => {
    const lang = calLang();
    const offset = calHijriOffset();
    const today = calStartOfDay(new Date());
    const todayH = calGetHijriParts(calAddDays(today, offset));

    let items = [];
    for (const hy of [todayH.hy, todayH.hy + 1]) {
        for (const hol of islamicHolidays) {
            const hd = calHolidayDay(hol, hy);
            if (!hd) continue;
            const base = calHijriToGregorian(hy, hol.month, hd);
            if (!base) continue;
            const gd = calStartOfDay(calAddDays(base, -offset));
            const daysRemaining = Math.round((gd.getTime() - today.getTime()) / 86400000);
            if (daysRemaining < 0) continue;
            items.push({ hol, date: gd, daysRemaining });
        }
    }

    items.sort((a, b) => a.daysRemaining - b.daysRemaining);

    /* Keep only the soonest future occurrence of each holy day. */
    const seen = {};
    const upcoming = [];
    for (const it of items) {
        if (seen[it.hol.key]) continue;
        seen[it.hol.key] = true;
        upcoming.push(it);
    }

    $('#calUpcomingTitle').text(calT('upcomingHolydays'));

    if (!upcoming.length) {
        $('#calUpcoming').html('<div class="cal-upcoming-empty">' + calEsc(calT('noUpcoming')) + '</div>');
        return;
    }

    const gregFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' });
    let html = '';
    for (const it of upcoming) {
        const name = calT(it.hol.key);
        const gregStr = gregFmt.format(it.date);
        const hijriStr = calHijriDateString(it.date, offset);

        let remaining, remClass = '';
        if (it.daysRemaining === 0) { remaining = calT('today'); remClass = ' remaining-today'; }
        else if (it.daysRemaining === 1) { remaining = calT('tomorrow'); }
        else { remaining = calT('inDays').replace('{n}', calNum(it.daysRemaining)); }

        const soon = it.daysRemaining <= 7 ? ' is-soon' : '';
        html += '<div class="cal-holyday-item' + soon + '">'
            + '<div class="cal-holyday-emoji">' + it.hol.emoji + '</div>'
            + '<div class="cal-holyday-info">'
            + '<div class="cal-holyday-name">' + calEsc(name) + '</div>'
            + '<div class="cal-holyday-dates">'
            + '<div class="cal-holyday-greg">' + calEsc(gregStr) + '</div>'
            + '<div class="cal-holyday-hijri">' + calEsc(hijriStr) + '</div>'
            + '</div>'
            + '</div>'
            + '<div class="cal-holyday-remaining' + remClass + '">' + calEsc(remaining) + '</div>'
            + '</div>';
    }
    $('#calUpcoming').html(html);
};


/* - - - - - - - - - - Qur'an tab - - - - - - - - - - */
/* Data: quranSurahs (js/quran-surahs.js), quranReciters (js/quran-reciters.js).
   Helpers: quranReciter / quranSurahAudioUrl / QURAN_DEFAULT_RECITER (js/quran-shared.js).
   Playback runs in the service worker + offscreen player. The tab renders the player and
   reflects quranState / quranCompleted live. Surah + reciter are chosen from full-card
   picker overlays; the surah picker doubles as the completed-toggle list. */

const quranSend = (msg) => {
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage(msg);
};

/* localized UI string with English fallback (see quranLocale in vars.js) */
const quranT = (key) => {
    const table = (typeof quranLocale !== 'undefined') ? quranLocale : {};
    const t = table[calLang()] || table.en || {};
    return t[key] || (table.en && table.en[key]) || key;
};

const quranSetText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

/* m:ss normally; h:mm:ss (e.g. 1:12:34) once we cross an hour. `withHours` forces the
   hour form so the elapsed + total pair stays aligned when the surah runs over an hour. */
const quranFmtTime = (sec, withHours) => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const ss = (s < 10 ? '0' : '') + s;
    if (withHours || h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
    return m + ':' + ss;
};

const quranReciterName = (id) => {
    const list = (typeof quranReciters !== 'undefined') ? quranReciters : [];
    const r = list.find(x => x.identifier === id);
    return r ? r.englishName : id;
};

let quranBuilt = false;
let quranKhatmLoaded = false;
let quranCurrentSurahNum = 1;
let quranCurrentReciter = QURAN_DEFAULT_RECITER;
let quranFavReciters = new Set();   /* identifiers the user has hearted; sorted to the top of the picker */
let quranCompletedSet = new Set();
let quranScrubbing = false;
let quranTick = null;
let quranBase = { time: 0, wall: 0, duration: 0, playing: false };
let quranLastLabeledSurah = 0;   /* so the title fade-in fires only on an actual surah change */
let quranTitleShown = false;     /* skip the fade on the first render (no animation when the tab loads) */

/* ---- pickers (surah + reciter), full-card overlays ---- */

/* Reciters with the favourited ones first (each group keeps the source list's order), so
   hearted reciters float to the top of the picker. */
function quranSortedReciters() {
    const reciters = (typeof quranReciters !== 'undefined') ? quranReciters : [];
    const fav = [], rest = [];
    reciters.forEach(r => (quranFavReciters.has(r.identifier) ? fav : rest).push(r));
    return fav.concat(rest);
}

/* Heart outline (Feather/Lucide); CSS fills it gold for .faved rows. */
const QURAN_HEART_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23'
    + 'l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

/* (Re)paint the reciter list, favourites on top. Called once on build and again each time the
   picker opens, so a heart toggled while it's open takes its new spot on the next open. */
function quranRenderReciterList() {
    const rbox = document.getElementById('quranReciterList');
    if (!rbox) return;
    const favLabel = calEsc(quranT('favorite'));
    rbox.innerHTML = quranSortedReciters().map(r => {
        const faved = quranFavReciters.has(r.identifier);
        return '<div class="quran-picker-item" data-id="' + calEsc(r.identifier) + '">'
            + '<span class="quran-picker-item-text">'
            + '<span class="quran-picker-item-name">' + calEsc(r.englishName) + '</span>'
            + '<span class="quran-picker-item-ar">' + calEsc(r.name) + '</span>'
            + '</span>'
            + '<button type="button" class="quran-reciter-fav' + (faved ? ' faved' : '') + '" data-id="'
            + calEsc(r.identifier) + '" aria-label="' + favLabel + '" title="' + favLabel + '" aria-pressed="'
            + (faved ? 'true' : 'false') + '">' + QURAN_HEART_SVG + '</button>'
            + '</div>';
    }).join('');
}

function quranBuildPickers() {
    quranRenderReciterList();

    const surahs = (typeof quranSurahs !== 'undefined') ? quranSurahs : [];
    const check = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
        + ' stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const hasSajda = (typeof quranSajdaSurahs !== 'undefined') ? quranSajdaSurahs : new Set();
    const sajdaMark = (n) => hasSajda.has(n)
        ? '<span class="quran-srow-sajda" title="' + calEsc(quranT('sajdaTip')) + '" aria-label="'
          + calEsc(quranT('sajdaTip')) + '">۩</span>'
        : '';
    const sbox = document.getElementById('quranSurahList');
    if (sbox) sbox.innerHTML = surahs.map(s =>
        '<div class="quran-srow" data-surah="' + s.number + '">'
        + '<span class="quran-srow-num">' + s.number + '</span>'
        + '<span class="quran-srow-name">' + calEsc(s.englishName) + '</span>'
        + sajdaMark(s.number)
        + '<span class="quran-srow-ar">' + calEsc(s.name) + '</span>'
        + '<button type="button" class="quran-srow-check" data-surah="' + s.number + '" aria-label="'
        + calEsc(quranT('markCompleted')) + '">' + check + '</button>'
        + '</div>').join('');
}

function quranUpdateSurahPickerMarks() {
    const sbox = document.getElementById('quranSurahList');
    if (!sbox) return;
    sbox.querySelectorAll('.quran-srow').forEach(row => {
        const n = parseInt(row.dataset.surah, 10);
        row.classList.toggle('current', n === quranCurrentSurahNum);
        const chk = row.querySelector('.quran-srow-check');
        if (chk) chk.classList.toggle('done', quranCompletedSet.has(n));
    });
}

function quranOpenReciterPicker() {
    quranRenderReciterList();   /* re-sort so any newly hearted reciters are now on top */
    const box = document.getElementById('quranReciterList');
    if (box) {
        box.querySelectorAll('.quran-picker-item').forEach(el =>
            el.classList.toggle('current', el.dataset.id === quranCurrentReciter));
        const cur = box.querySelector('.quran-picker-item.current');
        if (cur) cur.scrollIntoView({ block: 'nearest' });
    }
    const p = document.getElementById('quranReciterPicker');
    if (p) p.style.display = 'flex';
}
function quranCloseReciterPicker() {
    const p = document.getElementById('quranReciterPicker');
    if (p) p.style.display = 'none';
}

function quranOpenSurahPicker() {
    quranUpdateSurahPickerMarks();
    const p = document.getElementById('quranSurahPicker');
    if (p) p.style.display = 'flex';
    const cur = document.querySelector('#quranSurahList .quran-srow.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
}
function quranCloseSurahPicker() {
    const p = document.getElementById('quranSurahPicker');
    if (p) p.style.display = 'none';
}

/* ---- labels + progress ---- */
function quranSetReciterLabel(id) {
    quranCurrentReciter = id || QURAN_DEFAULT_RECITER;
    const name = quranReciterName(quranCurrentReciter);
    quranSetText('quranReciterName', name);
    const btn = document.getElementById('quranReciterBtn');
    if (btn) btn.title = quranT('reciter') + ': ' + name;   /* full name also on hover */
}

function quranSetSurahLabel(n) {
    const surahs = (typeof quranSurahs !== 'undefined') ? quranSurahs : [];
    const s = surahs.find(x => x.number === n);
    quranSetText('quranSurahNumber', String(n));
    const cap = document.getElementById('quranSurahCaption');
    if (cap) cap.setAttribute('aria-label', quranT('surah') + ' ' + n);   /* keep the spoken label */
    quranSetText('quranSurahName', s ? s.englishName : ('Surah ' + n));
    quranSetText('quranSurahArabic', s ? s.name : '');

    /* the flanking gold arrows have nowhere to go at the first / last surah */
    const dPrev = document.getElementById('quranDispPrevBtn');
    const dNext = document.getElementById('quranDispNextBtn');
    if (dPrev) dPrev.disabled = (n <= 1);
    if (dNext) dNext.disabled = (n >= QURAN_SURAH_COUNT);

    /* deep link to this surah on quran.com (e.g. https://quran.com/33, label "quran.com/33") */
    const qcom = document.getElementById('quranComLink');
    if (qcom) qcom.href = 'https://quran.com/' + n;
    quranSetText('quranComLinkText', 'quran.com/' + n);

    /* prostration marker — shown only for surahs that contain an ayat as-sajdah */
    const sajda = document.getElementById('quranSajdaBadge');
    if (sajda) {
        const has = (typeof quranSajdaSurahs !== 'undefined') && quranSajdaSurahs.has(n);
        sajda.style.display = has ? 'inline-flex' : 'none';
    }

    /* gentle fade/scale-in of the title — only when the surah actually changes,
       not on the first render (no animation when the tab loads) nor on the ~3s
       progress refreshes that also call this */
    if (n !== quranLastLabeledSurah) {
        const firstRender = !quranTitleShown;
        quranTitleShown = true;
        quranLastLabeledSurah = n;
        const disp = document.querySelector('#quranTab .quran-display');
        if (disp && !firstRender) {
            disp.classList.remove('quran-anim');
            void disp.offsetWidth;   /* force reflow so the animation restarts */
            disp.classList.add('quran-anim');
        }
    }
}

function quranUpdateCompleteBtn() {
    const chk = document.getElementById('quranSurahCheck');   /* green check next to the surah name */
    if (chk) chk.classList.toggle('done', quranCompletedSet.has(quranCurrentSurahNum));
}

/* paint the green fill of the custom seek track (value is 0–1000 → 0–100%) */
function quranFillBar(range) {
    if (range) range.style.setProperty('--quran-pct', ((range.value || 0) / 10) + '%');
}

function quranPaintProgress(cur, dur) {
    const range = document.getElementById('quranProgress');
    if (range && !quranScrubbing) {
        range.value = (dur > 0) ? Math.round((cur / dur) * 1000) : 0;
        quranFillBar(range);
    }
    const withHours = dur >= 3600;   /* surah over an hour → show both as h:mm:ss */
    quranSetText('quranTimeCur', quranFmtTime(cur, withHours));
    quranSetText('quranTimeDur', quranFmtTime(dur, withHours));
}

function quranTickOnce() {
    if (quranScrubbing || !quranBase.playing) return;
    let cur = quranBase.time + (Date.now() - quranBase.wall) / 1000;
    if (quranBase.duration > 0 && cur > quranBase.duration) cur = quranBase.duration;
    quranPaintProgress(cur, quranBase.duration);
}
function quranManageTicker(playing) {
    if (playing && !quranTick) quranTick = setInterval(quranTickOnce, 500);
    else if (!playing && quranTick) { clearInterval(quranTick); quranTick = null; }
}

/* green Qur'an play/pause toggle in the header (every tab): pause icon while playing, play icon otherwise.
   Also gilds the book menu icon's lines (#menu-div-quran) while audio plays. */
function quranUpdateHeaderToggle(playing) {
    const btn = document.getElementById('quranHeaderToggle');
    if (btn) btn.classList.toggle('playing', !!playing);
    const menu = document.getElementById('menu-div-quran');
    if (menu) menu.classList.toggle('playing', !!playing);
}

/* Qur'an playback streams every surah from a CDN, so with no internet the feature can't
   work: hide both entry points (the menu icon + the header play/pause toggle) while the
   device is offline, and fall back to the clock tab if the Qur'an tab happens to be open
   when the connection drops. Wired to the window online/offline events, so it reappears
   automatically once connectivity returns. */
function quranUpdateConnectivity() {
    const online = navigator.onLine;
    const menu = document.getElementById('menu-div-quran');
    const toggle = document.getElementById('quranHeaderToggle');
    if (menu) menu.classList.toggle('quran-offline-hidden', !online);
    if (toggle) toggle.classList.toggle('quran-offline-hidden', !online);
    if (!online && $('#quranTab').is(':visible')) $('#menu-div-clock').click();
}

/* ---- khatm progress bar (images/quran-progress.svg fetched once, segments flipped) ---- */
function quranRenderKhatm() {
    const host = document.getElementById('quranKhatmBar');
    if (!host) return;
    if (quranKhatmLoaded) { quranApplyKhatm(); return; }
    fetch('images/quran-progress.svg').then(r => r.text()).then(txt => {
        host.innerHTML = txt;
        const svg = host.querySelector('svg');
        if (svg) {                        /* crop to the bar; the 8px numbers are sub-pixel at popup width */
            svg.setAttribute('viewBox', '0 111 1000 42');
            svg.removeAttribute('width');
            svg.removeAttribute('height');
        }
        quranKhatmLoaded = true;
        quranApplyKhatm();
    }).catch(() => { });
}
function quranApplyKhatm() {
    const host = document.getElementById('quranKhatmBar');
    if (host) {
        for (let n = 1; n <= QURAN_SURAH_COUNT; n++) {
            const g = host.querySelector('#surah-' + String(n).padStart(3, '0'));
            if (g) {
                const done = quranCompletedSet.has(n);
                /* completion wins: a completed surah is green even when it's the one loaded now.
                   Otherwise the currently-loaded surah is gold, the rest slate. Mutually exclusive
                   so there's never a fill conflict; quranMarkCurrentSurah keeps this in sync as the
                   loaded surah changes without a completion change. */
                const current = !done && n === quranCurrentSurahNum;
                g.classList.toggle('read', done);
                g.classList.toggle('current', current);
                g.classList.toggle('unread', !done && !current);
            }
        }
    }
    quranSetText('quranKhatmCount', quranCompletedSet.size + ' / ' + QURAN_SURAH_COUNT);
    /* warm-gold celebration overlay — shown while the khatm is complete; the only way out is Restart.
       Nested in #quranTab, so it hides with the tab and can't cover another one. */
    const congrats = document.getElementById('quranCongrats');
    if (congrats) {
        congrats.style.display = (quranCompletedSet.size >= QURAN_SURAH_COUNT) ? 'flex' : 'none';
    }
}

/* re-tint the khatm bar for the surah now loaded in the player, without recomputing every
   segment: clear the old gold and gild the current one (unless it's already read → stays green).
   The SVG's own `transition: fill .3s` fades the colour as the loaded surah changes. */
function quranMarkCurrentSurah() {
    const host = document.getElementById('quranKhatmBar');
    if (!host) return;
    host.querySelectorAll('.surah.current').forEach(g => {
        g.classList.remove('current');
        /* completion-aware in case the surah we're un-gilding was just auto-marked read */
        const done = quranCompletedSet.has(parseInt(g.dataset.surah, 10));
        g.classList.toggle('read', done);
        g.classList.toggle('unread', !done);
    });
    if (!quranCompletedSet.has(quranCurrentSurahNum)) {
        const g = host.querySelector('#surah-' + String(quranCurrentSurahNum).padStart(3, '0'));
        if (g) { g.classList.remove('unread'); g.classList.add('current'); }
    }
}

/* ---- render (tab open) + live refresh ---- */
function renderQuranPlayer() {
    if (!document.getElementById('quranTab')) return;
    if (!quranBuilt) {
        quranBuildPickers();
        quranSetText('quranPickerTitle', quranT('reciter'));
        quranSetText('quranSurahPickerTitle', quranT('surah'));
        quranSetText('quranKhatmTitle', quranT('progress'));
        quranSetText('quranCongratsText', quranT('congrats'));
        quranSetText('quranKhatmReset', quranT('reset'));
        quranSetText('quranAutoContinueLabel', quranT('autoContinue'));
        const sajdaBadge = document.getElementById('quranSajdaBadge');
        if (sajdaBadge) sajdaBadge.title = quranT('sajdaTip');
        quranBuilt = true;
    }
    quranCloseReciterPicker();
    quranCloseSurahPicker();
    chrome.storage.local.get(['quranState', 'quranCompleted', 'appData'], (r) => {
        quranCompletedSet = new Set(r.quranCompleted || []);
        const sq = (r.appData && r.appData.settings && r.appData.settings.quran) || {};
        quranFavReciters = new Set(Array.isArray(sq.favoriteReciters) ? sq.favoriteReciters : []);
        quranSetReciterLabel(sq.reciter || QURAN_DEFAULT_RECITER);
        quranSetAutoContinue(sq.autoContinue !== false);   /* default ON when unset */
        quranRenderKhatm();
        quranRefresh(r.quranState);
    });
}

function quranRefresh(state) {
    const proceed = (st) => {
        st = st || { currentSurah: 1, currentTime: 0, duration: 0, isPlaying: false };
        quranCurrentSurahNum = (st.currentSurah >= 1 && st.currentSurah <= QURAN_SURAH_COUNT) ? st.currentSurah : 1;
        quranSetSurahLabel(quranCurrentSurahNum);
        quranUpdateCompleteBtn();
        quranMarkCurrentSurah();   /* gild the surah now loaded in the player (green if already read) */

        const btn = document.getElementById('quranToggleBtn');
        if (btn) {
            btn.classList.toggle('playing', !!st.isPlaying);
            btn.setAttribute('aria-label', st.isPlaying ? quranT('pause') : quranT('listen'));
        }
        quranUpdateHeaderToggle(!!st.isPlaying);

        if (!quranScrubbing) {
            quranBase = { time: st.currentTime || 0, wall: Date.now(), duration: st.duration || 0, playing: !!st.isPlaying };
            quranPaintProgress(quranBase.time, quranBase.duration);
        }
        quranManageTicker(!!st.isPlaying);

        const sp = document.getElementById('quranSurahPicker');
        if (sp && sp.style.display === 'flex') quranUpdateSurahPickerMarks();
    };
    if (state) proceed(state);
    else chrome.storage.local.get(['quranState'], (r) => proceed(r.quranState));
}

function quranSetReciter(identifier) {
    quranSetReciterLabel(identifier);
    chrome.storage.local.get(['appData'], (r) => {
        appData = r.appData;
        if (!appData.settings.quran) appData.settings.quran = {};
        appData.settings.quran.reciter = identifier;
        saveAppDataAndRefresh(appData);
        quranSend({ quranReload: true });   /* changing reciter stops playback; new reciter loads on next play */
    });
}

/* auto-continue toggle (bottom of the tab): ON = the next surah starts automatically when the current
   one finishes; OFF = the next surah is cued up but stays paused until the listener starts it.
   Default ON — the long-standing behaviour. The service worker reads appData.settings.quran
   .autoContinue in quranAdvance; here we only flip the setting and repaint the switch. */
function quranSetAutoContinue(on) {
    const btn = document.getElementById('quranAutoContinueToggle');
    if (btn) btn.setAttribute('aria-checked', on ? 'true' : 'false');
}

function quranToggleAutoContinue() {
    chrome.storage.local.get(['appData'], (r) => {
        appData = r.appData;
        if (!appData.settings.quran) appData.settings.quran = {};
        const on = appData.settings.quran.autoContinue === false;   /* flip: OFF→ON, else ON→OFF */
        appData.settings.quran.autoContinue = on;
        quranSetAutoContinue(on);
        saveAppDataAndRefresh(appData);
    });
}

/* heart / un-heart a reciter (btn = the tapped heart). Persists to
   appData.settings.quran.favoriteReciters and flips the heart in place; the row keeps its spot
   until the picker is next opened (see quranRenderReciterList), so tapping never yanks the row
   out from under the finger. */
function quranToggleFavorite(btn) {
    const identifier = btn && btn.dataset.id;
    if (!identifier) return;
    const on = !quranFavReciters.has(identifier);
    if (on) quranFavReciters.add(identifier); else quranFavReciters.delete(identifier);
    btn.classList.toggle('faved', on);                       /* immediate feedback, no re-sort while open */
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    chrome.storage.local.get(['appData'], (r) => {
        appData = r.appData;
        if (!appData.settings.quran) appData.settings.quran = {};
        appData.settings.quran.favoriteReciters = Array.from(quranFavReciters);
        saveAppDataAndRefresh(appData);
    });
}

/* manual mark/unmark from a surah-picker row */
function quranToggleCompleted(surah) {
    surah = surah || quranCurrentSurahNum;
    const done = !quranCompletedSet.has(surah);
    chrome.storage.local.get(['quranCompleted'], (r) => {
        const set = new Set(r.quranCompleted || []);
        if (done) set.add(surah); else set.delete(surah);
        chrome.storage.local.set({ quranCompleted: Array.from(set).sort((a, b) => a - b) }, () => {
            quranCompletedSet = set;
            quranUpdateSurahPickerMarks();
            quranUpdateCompleteBtn();
            quranApplyKhatm();
        });
    });
}

/* Restart — start a fresh khatm: clear all completed surahs and reset playback to the very start
   (surah 1 @ 0:00, stopped), as if opening the Qur'an tab for the first time. */
function quranResetKhatm() {
    chrome.storage.local.set({ quranCompleted: [] }, () => {
        quranCompletedSet = new Set();
        quranUpdateSurahPickerMarks();
        quranUpdateCompleteBtn();
        quranApplyKhatm();                  /* no longer complete → hides the celebration */
        quranSend({ quranStop: true });     /* SW resets quranState to surah 1 / 0:00 / stopped */
    });
}

/* current position (interpolated while playing), for the ±5s skip buttons */
function quranCurrentPos() {
    let cur = (quranBase.time || 0) + (quranBase.playing ? (Date.now() - quranBase.wall) / 1000 : 0);
    if (quranBase.duration > 0) cur = Math.min(cur, quranBase.duration);
    return Math.max(0, cur);
}

function quranSkip(delta) {
    if (quranBase.duration <= 0) return;   /* wait until the surah's duration is known */
    const target = Math.max(0, Math.min(quranBase.duration, quranCurrentPos() + delta));
    quranSend({ quranSeek: target });
}

function quranOnScrub() {
    quranScrubbing = true;
    const range = document.getElementById('quranProgress');
    quranFillBar(range);   /* keep the green fill under the thumb while dragging */
    quranSetText('quranTimeCur', quranFmtTime(((range.value || 0) / 1000) * (quranBase.duration || 0), (quranBase.duration || 0) >= 3600));
}
function quranOnSeek() {
    const range = document.getElementById('quranProgress');
    const seconds = ((range.value || 0) / 1000) * (quranBase.duration || 0);
    quranScrubbing = false;
    if (quranBase.duration > 0) quranSend({ quranSeek: seconds });
}

/* live-update the bar when the SW / offscreen change playback or completion state */
chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes.quranState) quranRefresh(changes.quranState.newValue);
    if (changes.quranCompleted) {
        quranCompletedSet = new Set(changes.quranCompleted.newValue || []);
        quranUpdateSurahPickerMarks();
        quranUpdateCompleteBtn();
        quranApplyKhatm();
    }
});
