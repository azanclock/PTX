let appData = {};
let adhanStatus = {};

chrome.runtime.onMessage.addListener((msg) => { if ('runApp' in msg) { runApp() } });

$(function () {
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

    Object.entries(appData.i18n).forEach(function ([key, value]) {
        $('#' + key).text(value);
        $('.' + key).text(value);
    });

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
                chrome.notifications.create(
                    'test',
                    {
                        type: "image",
                        imageUrl: 'images/notification.jpg',
                        iconUrl: 'images/icons/128.png',
                        title: appData.i18n['desktopNotificationsOnTitle'],
                        message: appData.settings.address
                    }
                );
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
        adhanStatus = {};
        showLoading();
        chrome.storage.local.clear();
        goGoRun('extension reset');
        setTimeout(() => {
            $("#menu-div-clock").trigger("click");
            hideLoadingOnSuccess();
        }, 2000);
    });

    $("#reviewButton").click(function (e) {
        window.open('https://chromewebstore.google.com/detail/prayer-times-chrome-exten/fbkmgnkliklgbmanjkmiihkdioepnkce/reviews');
    });

    $("#audioPlayerDiv").click(function (e) {
        stopAudio();
    });

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

    let rvb = document.getElementById('reviewButton');
    let tooltipRV = bootstrap.Tooltip.getOrCreateInstance(rvb, { trigger: 'hover', customClass: 'custom-tooltip' });
    rvb.addEventListener('show.bs.tooltip', () => {
        tooltipRV._config.title = 'Review';
    });

});

document.addEventListener('click', function (event) {

    if (event.target && event.target.classList.contains('playAudioButton')) {
        playAudio(appData.settings.adhans[event.target.dataset.vakit]);
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

document.getElementById('volume').addEventListener('change', function (event) {
    chrome.storage.local.get(['appData'], function (result) {
        appData = result.appData;
        appData.settings.volume = event.target.value * 1;
        saveAppDataAndRefresh(appData);
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

    let hasAlarms = (appData.settings.alarms && appData.settings.alarms.length) || (appData.settings.naflAlarms && appData.settings.naflAlarms.length);
    $('#alarmDot').toggle(!!hasAlarms);

    if (!$('#basicSettings').is(':visible'))
        $('#address').val(appData.settings.address);

    let topAddressMaxLen = 14;
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

    $('#desktopNotificationsOn').hide();
    $('#desktopNotificationsOff').hide();
    if (appData.settings.desktopNotifications)
        $('#desktopNotificationsOn').show();
    else
        $('#desktopNotificationsOff').show();

    $('.hanafiAsrOption').hide();
    if (appData.settings.hanafiAsr)
        $('#hanafiAsrOn').show();
    else
        $('#hanafiAsrOff').show();

    $('.showImsakOption').hide();
    if (appData.settings.showImsak) {
        $('#showImsakOn').show();
    }
    else {
        $('#showImsakOff').show();
    }

    $('.showDuhaOption').hide();
    if (appData.settings.showDuha) {
        $('#showDuhaOn').show();
    }
    else {
        $('#showDuhaOff').show();
    }

    $('.showMidnightOption').hide();
    if (appData.settings.showMidnight) {
        $('#showMidnightOn').show();
    }
    else {
        $('#showMidnightOff').show();

    }

    $('.hour24Option').hide();
    if (appData.settings.timeFormat == 12) {
        $('#hour24Off').show();
    }
    else {
        $('#hour24On').show();
    }

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
    if (appData.settings.areAdhansEnabled)
        $('#volume').attr('disabled', false);
    else
        $('#volume').attr('disabled', true);
    if (!$('#adhanOffsetSettings').is(':visible'))
        displayAdhansAndOffsets();

    if ($('#alarmsSettings').is(':visible'))
        displayAlarms();

}

const displayAdhansAndOffsets = () => {

    $('#volume').val(appData.settings.volume);

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
            aoContent += `<img title='${thisAudioTitle}' class="${appData.settings.areAdhansEnabled ? 'adhanRecitorBtn pointerOn' : ''} ms-1 img-fluid" data-name=${v} src="images/mic${appData.settings.areAdhansEnabled ? '' : '-na'}.png"/>`;
            aoContent += `</div>`;
        }
        else {
            aoContent += `<div class="col-1"></div>`;
        }
        /* adhan settings, end */

        aoContent += '</div>';

        if (appData.settings.adhans.hasOwnProperty(v)) {

            aoContent += `<div class="adhanRow" id="adhanRow${v}" style="display:none;">`
            aoContent += `<div class="d-flex flex-row gap-1 mt-2 px-1 justify-content-between align-items-center">`
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

            aoContent += `<div><img src="images/play.png" class="playAudioButton pointer p-1 rounded" data-vakit="${v}" data-title="${thisAudioTitle}" /></div>`;

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
    $('.playAudioButton').attr('src', '/images/stop.png').addClass('bg-danger');
    audioPlayer.play();
    $('#audioPlayerDiv').show();
}

const stopAudio = () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    $('.playAudioButton').attr('src', '/images/play.png').removeClass('bg-danger');
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

    let day = new Date(new Date().toLocaleString('en-US', { timeZone: appData.settings.timeZoneID })).getDay();
    let isWeekDay = day > 0 && day < 6;

    let html = '';

    if (alarms.length === 0 && naflAlarms.length === 0) {
        let i18n = (appData && appData.i18n) || {};
        let noAlarms = i18n.noAlarmsText || 'No alarms set.';
        let note = i18n.alarmsNoteText || 'Alarms always play, even when adhan calls are off.';
        let bulb = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffc107" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:3px;"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
        let noneIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
        html = `<div class="alarm-empty small d-flex align-items-center gap-2">${noneIcon}<span>${noAlarms}</span></div>
                <div class="alarm-tip small d-flex align-items-start gap-2">${bulb}<span>${note}</span></div>`;
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
        <div class="alarm-card bg-darkish rounded px-2 py-2 mb-1">
            <div class="d-flex flex-row justify-content-between align-items-center gap-2">
                <div class="text-truncate">
                    <span class="${dotClass}"></span> <b class="small">${name}</b>
                    <div class="small text-secondary">${schedule}</div>
                </div>
                <div>
                    <button type="button" class="btn btn-sm btn-danger removeAlarmBtn py-0 px-2"
                        data-type="${type}" data-index="${index}">&times;</button>
                </div>
            </div>
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
        const holy = islamicHolidays.find(x => x.month === h.hm && x.day === h.hd);

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
            const base = calHijriToGregorian(hy, hol.month, hol.day);
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
