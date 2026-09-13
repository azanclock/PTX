const methods = [
	{ id: 'Algerian', name: 'Algerian Ministry of Religious Affairs', params: { fajr: 18, isha: 17 }, methodOffsets: {} },
	{ id: 'Egypt', name: 'Egyptian General Authority of Survey', params: { fajr: 19.5, isha: 17.5 }, methodOffsets: {} },
	{ id: 'FranceAngle18', name: 'France - 18° Angle', params: { fajr: 18, isha: 18 }, methodOffsets: {} },
	{ id: 'FranceUOIFAngle12', name: 'France UOIF - 12° Angle', params: { fajr: 12, isha: 12 }, methodOffsets: {} },
	{ id: 'ISNA', name: 'Islamic Society of North America (ISNA)', params: { fajr: 15, isha: 15 }, methodOffsets: {} },
	{ id: 'JAKIM', name: 'Jabatan Kemajuan Islam Malaysia', params: { fajr: 18, isha: 18 }, methodOffsets: { fajr: 2, dhuhr: 3, asr: 2, maghrib: 2, isha: 1 } },
	{ id: 'Jordan', name: 'Jordan Ministry of Awqaf', params: { fajr: 18, isha: 18 }, methodOffsets: { maghrib: 5 } },
	{ id: 'KEMENAG', name: 'Kementrian Agama Indonesia', params: { fajr: 20, isha: 18 }, methodOffsets: { fajr: 2, sunrise: -3, dhuhr: 3, asr: 2, maghrib: 3, isha: 2 } },
	{ id: 'Kuwait', name: 'Kuwait', params: { fajr: 18, isha: 17.5 }, methodOffsets: {} },
	{ id: 'UIPTL', name: 'London Unified Islamic Prayer Timetable', params: { fajr: 12, isha: 12 }, methodOffsets: {} },
	{ id: 'MUIS', name: 'Majlis Ugama Islam Singapura', params: { fajr: 20, isha: 18 }, methodOffsets: {} },
	{ id: 'MoonSightingCommittee', name: 'Moon Sighting Committee', params: { fajr: 18, isha: 18 }, methodOffsets: { dhuhr: 5, maghrib: 3 } },
	{ id: 'Habous', name: 'Moroccan Ministry of Habous and Islamic Affairs', params: { fajr: 19.1, isha: 17 }, methodOffsets: { sunrise: -5, dhuhr: 5, maghrib: 5 } },
	{ id: 'MWL', name: 'Muslim World League', params: { fajr: 18, isha: 17 }, methodOffsets: {} },
	{ id: 'Qatar', name: 'Qatar', params: { fajr: 18, isha: '90 min' }, methodOffsets: {} },
	{ id: 'Karachi', name: 'University of Islamic Sciences, Karachi', params: { fajr: 18, isha: 18 }, methodOffsets: {} },
	{ id: 'Makkah', name: 'Umm Al-Qura University, Makkah', params: { fajr: 18.5, isha: '90 min' }, methodOffsets: {} },
	{ id: 'Dubai', name: 'UAE / Dubai', params: { fajr: 18.2, isha: 18.2 }, methodOffsets: {} },
	{ id: 'Tunusian', name: 'Tunisian Ministry of Religious Affairs', params: { fajr: 18, isha: 18 }, methodOffsets: {} },
	{ id: 'TurkiyeDiyanet', name: 'Türkiye Diyanet İşleri Başkanlığı', params: { fajr: 18, isha: 17 }, methodOffsets: { sunrise: -7, fajr: -1, dhuhr: 5, asr: 5, maghrib: 8, isha: 1 } },
	{ id: 'EUDiyanet', name: 'Turkish Diyanet Offsets with 15° Angles', params: { fajr: 15, isha: 15 }, methodOffsets: { imsak: -1, sunrise: -9, dhuhr: 5, asr: 5, maghrib: 7, isha: -1 } },
	{ id: 'Tehran', name: 'University of Tehran', params: { fajr: 17.7, isha: 14, maghrib: 5.5, midnight: 'Jafari' }, methodOffsets: {} }
];

const calculationMethods = methods.reduce((acc, method) => {
	acc[method.id] = {
		name: method.name,
		params: method.params,
		methodOffsets: method.methodOffsets
	};
	return acc;
}, {});

const adhanAudios = [
	{ id: 1, name: 'Bosnian Style by Eldin Huseinbegovic (3:05)', isFajrAdhan: false, isAdhan: true },
	{ id: 2, name: 'Dubai Style by Abdulrahman Al-Hindi (2:25)', isFajrAdhan: false, isAdhan: true },
	{ id: 3, name: 'Egyptian Style (3:25)', isFajrAdhan: false, isAdhan: true },
	{ id: 5, name: 'Makkah Al-Mukarramah Style (3:44)', isFajrAdhan: false, isAdhan: true },
	{ id: 6, name: 'Masjid Al-Aqsa Style (4:07)', isFajrAdhan: false, isAdhan: true },
	{ id: 7, name: 'Mishary Al-Afasy (4:17)', isFajrAdhan: false, isAdhan: true },
	{ id: 8, name: 'Ottoman Style by Shaykh Nazım (2:38)', isFajrAdhan: false, isAdhan: true },
	{ id: 9, name: 'Turkish Style by Remzi Er (4:08)', isFajrAdhan: false, isAdhan: true },
	{ id: 11, name: 'Mishary Al-Afasy (3:24)', isFajrAdhan: true, isAdhan: false },
	{ id: 12, name: 'Shaykh Surayhi (4:54)', isFajrAdhan: true, isAdhan: false },
	{ id: 13, name: 'Shaykh Ali Ahmed Mullah (4:35)', isFajrAdhan: true, isAdhan: false },
	{ id: 14, name: 'Madinah Style by Muhammad Marwan Qassas (4:10)', isFajrAdhan: false, isAdhan: true },
	{ id: 15, name: 'Madinah Style by Muhammad Marwan Qassas (5:03)', isFajrAdhan: true, isAdhan: false },
	{ id: 101, name: 'Bismillahirrahmanirrahim (0:05)', isFajrAdhan: true, isAdhan: true, isAlarm: true },
	{ id: 102, name: 'Soft Beep Sound (0:01)', isFajrAdhan: true, isAdhan: true, isAlarm: true },
];

/* Alarm sounds: short tones suitable for a wake-up / reminder alarm. */
const alarmSounds = adhanAudios.filter(a => a.isAlarm);
/* Nafl prayer alarm sounds: short tones plus the full adhan recitations. */
const naflSounds = [...alarmSounds, ...adhanAudios.filter(a => !a.isAlarm)];
/* Vakits (and night fractions) a nafl prayer alarm can be anchored to. */
const naflVakits = [
	{ value: 'Fajr', i18n: 'fajrText' },
	{ value: 'Sunrise', i18n: 'sunriseText' },
	{ value: 'Dhuhr', i18n: 'dhuhrText' },
	{ value: 'Asr', i18n: 'asrText' },
	{ value: 'Maghrib', i18n: 'maghribText' },
	{ value: 'Isha', i18n: 'ishaText' },
	{ value: '1/3 of Night', i18n: 'oneThirdText' },
	{ value: 'Midnight', i18n: 'midnightText' },
	{ value: '2/3 of Night', i18n: 'twoThirdText' }
];

const languages = [
	{ code: 'ar', name: 'عرب' },
	{ code: 'id', name: 'Ind' },
	{ code: 'ms', name: 'Mly' },
	{ code: 'de', name: 'Deu' },
	{ code: 'en', name: 'Eng' },
	{ code: 'es', name: 'Esp' },
	{ code: 'fr', name: 'Fra' },
	{ code: 'nl', name: 'Ned' },
	{ code: 'it', name: 'Ita' },
	{ code: 'pl', name: 'Pol' },
	{ code: 'pt', name: 'Por' },
	{ code: 'sv', name: 'Swe' },
	{ code: 'ru', name: 'Рус' },
	{ code: 'vi', name: 'Vie' },
	{ code: 'tr', name: 'Trk' },
	{ code: 'uk', name: 'Укр' },
	{ code: 'fa', name: 'فار' },
	{ code: 'hi', name: 'हिन' },
	{ code: 'bn', name: 'বাং' },
	{ code: 'ta', name: 'தம' },
	{ code: 'th', name: 'ไทย' },
	{ code: 'ko', name: '한글' },
	{ code: 'ja', name: '日本' }
];

const imsakDefaultOffset = -10;
const duhaDefaultOffset = 15;
const duhaendDefaultOffset = -10;

/* Methods whose twilight angles / method offsets changed in v2.0.20.
   Users on these methods get a one-time manual-offset reset + notice,
   so previously dialed-in corrections don't stack on top of the fix. */
const calcAngleUpdatedMethods = ['JAKIM', 'KEMENAG'];

const settingsCodeFields = ['address', 'calculationMethod', 'adhans', 'timeZoneID', 'lat', 'lng', 'areAdhansEnabled',
	'adhans', 'vakitOffsets', 'timeFormat', 'showMidnight', 'showDuha', 'showImsak', 'hanafiAsr',
	'desktopNotifications', 'volume'
];