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

const alarmSounds = adhanAudios.filter(a => a.isAlarm);
const naflSounds = [...alarmSounds, ...adhanAudios.filter(a => !a.isAlarm)];
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

const calcAngleUpdatedMethods = ['JAKIM', 'KEMENAG'];

const settingsCodeFields = ['address', 'calculationMethod', 'adhans', 'timeZoneID', 'lat', 'lng', 'areAdhansEnabled',
	'adhans', 'vakitOffsets', 'timeFormat', 'showMidnight', 'showDuha', 'showImsak', 'hanafiAsr',
	'desktopNotifications', 'volume'
];

/* --- Calendar tab: Islamic (Hijri) holy days & localization --- */

/* Hijri month/day for each holy day. Month numbers follow the islamic-umalqura
   calendar used elsewhere in the app (1 = Muharram ... 9 = Ramadan ... 12 = Dhu al-Hijjah). */
const islamicHolidays = [
	{ key: 'hijriNewYear', month: 1, day: 1, emoji: '🌙' },
	{ key: 'ashura', month: 1, day: 10, emoji: '🕌' },
	{ key: 'mawlid', month: 3, day: 12, emoji: '🌹' },
	{ key: 'rajabStart', month: 7, day: 1, emoji: '🌙' },
	/* Laylat al-Raghaib: first Friday night of Rajab — its Hijri day varies by
	   year, so it is resolved from firstWeekday (5 = Friday) at render time. */
	{ key: 'laylatAlRaghaib', month: 7, firstWeekday: 5, emoji: '🤲' },
	{ key: 'israMiraj', month: 7, day: 27, emoji: '🕌' },
	{ key: 'midShaban', month: 8, day: 15, emoji: '🌕' },
	{ key: 'ramadanStart', month: 9, day: 1, emoji: '🌟' },
	{ key: 'laylatAlQadr', month: 9, day: 27, emoji: '✨' },
	{ key: 'eidAlFitr', month: 10, day: 1, emoji: '🎉' },
	{ key: 'dhulHijjahStart', month: 12, day: 1, emoji: '🌙' },
	{ key: 'tarwiyah', month: 12, day: 8, emoji: '🕋' },
	{ key: 'arafah', month: 12, day: 9, emoji: '🕌' },
	{ key: 'eidAlAdha', month: 12, day: 10, emoji: '🐏' }
];

/* Calendar UI + holy-day names. English (en) is the guaranteed fallback; any
   language without an entry (or a missing key) falls back to English. Gregorian
   and Hijri month/weekday names are localized automatically via Intl. */
const calendarLocale = {
	en: {
		calendarTitle: 'Calendar', upcomingHolydays: 'Upcoming Holy Days',
		today: 'Today', tomorrow: 'Tomorrow', inDays: 'in {n} days',
		noUpcoming: 'No upcoming holy days',
		hijriNewYear: 'Islamic New Year', ashura: 'Day of Ashura',
		mawlid: "Mawlid (Prophet's Birthday ﷺ)", israMiraj: "Isra and Mi'raj",
		rajabStart: 'First Day of Rajab', laylatAlRaghaib: 'Laylat al-Raghaib',
		midShaban: "Mid-Sha'ban", ramadanStart: 'First Day of Ramadan',
		laylatAlQadr: 'Laylat al-Qadr', eidAlFitr: 'Eid al-Fitr',
		dhulHijjahStart: 'First Day of Dhu al-Hijjah', tarwiyah: 'Day of Tarwiyah',
		arafah: 'Day of Arafah', eidAlAdha: 'Eid al-Adha'
	},
	ar: {
		calendarTitle: 'التقويم', upcomingHolydays: 'الأيام المباركة القادمة',
		today: 'اليوم', tomorrow: 'غدًا', inDays: 'بعد {n} يوم',
		noUpcoming: 'لا توجد أيام مباركة قادمة',
		hijriNewYear: 'رأس السنة الهجرية', ashura: 'يوم عاشوراء',
		mawlid: 'المولد النبوي ﷺ', israMiraj: 'الإسراء والمعراج',
		rajabStart: 'أول أيام رجب', laylatAlRaghaib: 'ليلة الرغائب',
		midShaban: 'ليلة النصف من شعبان', ramadanStart: 'أول أيام رمضان',
		laylatAlQadr: 'ليلة القدر', eidAlFitr: 'عيد الفطر',
		dhulHijjahStart: 'أول أيام ذي الحجة', tarwiyah: 'يوم التروية',
		arafah: 'يوم عرفة', eidAlAdha: 'عيد الأضحى'
	},
	tr: {
		calendarTitle: 'Takvim', upcomingHolydays: 'Yaklaşan Mübarek Günler',
		today: 'Bugün', tomorrow: 'Yarın', inDays: '{n} gün sonra',
		noUpcoming: 'Yaklaşan mübarek gün yok',
		hijriNewYear: 'Hicri Yılbaşı', ashura: 'Aşure Günü',
		mawlid: 'Mevlid Kandili ﷺ', israMiraj: 'İsra ve Miraç',
		rajabStart: "Recep'in İlk Günü", laylatAlRaghaib: 'Regaib Kandili',
		midShaban: 'Berat Kandili', ramadanStart: "Ramazan'ın İlk Günü",
		laylatAlQadr: 'Kadir Gecesi', eidAlFitr: 'Ramazan Bayramı',
		dhulHijjahStart: "Zilhicce'nin İlk Günü", tarwiyah: 'Terviye Günü',
		arafah: 'Arefe Günü', eidAlAdha: 'Kurban Bayramı'
	},
	de: {
		calendarTitle: 'Kalender', upcomingHolydays: 'Kommende Feiertage',
		today: 'Heute', tomorrow: 'Morgen', inDays: 'in {n} Tagen',
		noUpcoming: 'Keine bevorstehenden Feiertage',
		hijriNewYear: 'Islamisches Neujahr', ashura: 'Aschura-Tag',
		mawlid: 'Mawlid (Geburtstag des Propheten ﷺ)', israMiraj: 'Isra und Miradsch',
		rajabStart: 'Erster Tag des Radschab', laylatAlRaghaib: 'Laylat al-Raghaib (Nacht der Wünsche)',
		midShaban: 'Mitte Schaban', ramadanStart: 'Erster Tag des Ramadan',
		laylatAlQadr: 'Laylat al-Qadr (Nacht der Bestimmung)', eidAlFitr: 'Eid al-Fitr (Fest des Fastenbrechens)',
		dhulHijjahStart: 'Erster Tag des Dhu al-Hidscha', tarwiyah: 'Tag von Tarwiya',
		arafah: 'Tag von Arafat', eidAlAdha: 'Eid al-Adha (Opferfest)'
	},
	fr: {
		calendarTitle: 'Calendrier', upcomingHolydays: 'Fêtes à venir',
		today: "Aujourd'hui", tomorrow: 'Demain', inDays: 'dans {n} jours',
		noUpcoming: 'Aucune fête à venir',
		hijriNewYear: 'Nouvel An hégirien', ashura: "Jour de l'Achoura",
		mawlid: 'Mawlid (naissance du Prophète ﷺ)', israMiraj: 'Isra et Miraj',
		rajabStart: 'Premier jour de Rajab', laylatAlRaghaib: 'Laylat al-Raghaib (Nuit des Souhaits)',
		midShaban: 'Mi-Chaabane', ramadanStart: 'Premier jour du Ramadan',
		laylatAlQadr: 'Laylat al-Qadr (Nuit du Destin)', eidAlFitr: 'Aïd el-Fitr',
		dhulHijjahStart: 'Premier jour de Dhou al-Hijja', tarwiyah: 'Jour de Tarwiyah',
		arafah: "Jour d'Arafat", eidAlAdha: 'Aïd el-Adha'
	},
	es: {
		calendarTitle: 'Calendario', upcomingHolydays: 'Próximas fiestas sagradas',
		today: 'Hoy', tomorrow: 'Mañana', inDays: 'en {n} días',
		noUpcoming: 'No hay fiestas próximas',
		hijriNewYear: 'Año Nuevo islámico', ashura: 'Día de la Ashura',
		mawlid: 'Mawlid (Nacimiento del Profeta ﷺ)', israMiraj: "Isra y Mi'ray",
		rajabStart: 'Primer día de Rayab', laylatAlRaghaib: 'Laylat al-Raghaib (Noche de los Deseos)',
		midShaban: "Mitad de Sha'bán", ramadanStart: 'Primer día del Ramadán',
		laylatAlQadr: 'Laylat al-Qadr (Noche del Destino)', eidAlFitr: 'Eid al-Fitr',
		dhulHijjahStart: 'Primer día de Dhu al-Hiyyah', tarwiyah: 'Día de Tarwiya',
		arafah: 'Día de Arafat', eidAlAdha: 'Eid al-Adha'
	},
	it: {
		calendarTitle: 'Calendario', upcomingHolydays: 'Prossime festività',
		today: 'Oggi', tomorrow: 'Domani', inDays: 'tra {n} giorni',
		noUpcoming: 'Nessuna festività in arrivo',
		hijriNewYear: 'Capodanno islamico', ashura: "Giorno dell'Ashura",
		mawlid: 'Mawlid (Nascita del Profeta ﷺ)', israMiraj: "Isra e Mi'raj",
		rajabStart: 'Primo giorno di Rajab', laylatAlRaghaib: 'Laylat al-Raghaib (Notte dei Desideri)',
		midShaban: "Metà di Sha'ban", ramadanStart: 'Primo giorno del Ramadan',
		laylatAlQadr: 'Laylat al-Qadr (Notte del Destino)', eidAlFitr: 'Eid al-Fitr',
		dhulHijjahStart: 'Primo giorno di Dhu al-Hijja', tarwiyah: 'Giorno di Tarwiya',
		arafah: 'Giorno di Arafat', eidAlAdha: 'Eid al-Adha'
	},
	nl: {
		calendarTitle: 'Kalender', upcomingHolydays: 'Aankomende feestdagen',
		today: 'Vandaag', tomorrow: 'Morgen', inDays: 'over {n} dagen',
		noUpcoming: 'Geen aankomende feestdagen',
		hijriNewYear: 'Islamitisch Nieuwjaar', ashura: 'Asjoera',
		mawlid: 'Mawlid (geboortedag van de Profeet ﷺ)', israMiraj: "Isra en Mi'raj",
		rajabStart: 'Eerste dag van Rajab', laylatAlRaghaib: 'Laylat al-Raghaib (Nacht van de Wensen)',
		midShaban: "Halverwege Sha'ban", ramadanStart: 'Eerste dag van de Ramadan',
		laylatAlQadr: 'Laylat al-Qadr (Nacht van de Beschikking)', eidAlFitr: 'Eid al-Fitr (Suikerfeest)',
		dhulHijjahStart: 'Eerste dag van Dhu al-Hijja', tarwiyah: 'Dag van Tarwiyah',
		arafah: 'Dag van Arafat', eidAlAdha: 'Eid al-Adha (Offerfeest)'
	},
	pt: {
		calendarTitle: 'Calendário', upcomingHolydays: 'Próximas datas sagradas',
		today: 'Hoje', tomorrow: 'Amanhã', inDays: 'em {n} dias',
		noUpcoming: 'Nenhuma data sagrada próxima',
		hijriNewYear: 'Ano Novo Islâmico', ashura: 'Dia de Ashura',
		mawlid: 'Mawlid (Nascimento do Profeta ﷺ)', israMiraj: 'Isra e Miraj',
		rajabStart: 'Primeiro dia de Rajab', laylatAlRaghaib: 'Laylat al-Raghaib (Noite dos Desejos)',
		midShaban: "Metade de Sha'ban", ramadanStart: 'Primeiro dia do Ramadã',
		laylatAlQadr: 'Laylat al-Qadr (Noite do Destino)', eidAlFitr: 'Eid al-Fitr',
		dhulHijjahStart: 'Primeiro dia de Dhul-Hijjah', tarwiyah: 'Dia de Tarwiyah',
		arafah: 'Dia de Arafat', eidAlAdha: 'Eid al-Adha'
	},
	id: {
		calendarTitle: 'Kalender', upcomingHolydays: 'Hari Besar Mendatang',
		today: 'Hari ini', tomorrow: 'Besok', inDays: 'dalam {n} hari',
		noUpcoming: 'Tidak ada hari besar mendatang',
		hijriNewYear: 'Tahun Baru Hijriah', ashura: 'Hari Asyura',
		mawlid: 'Maulid Nabi ﷺ', israMiraj: 'Isra Mikraj',
		rajabStart: 'Hari Pertama Rajab', laylatAlRaghaib: 'Lailatulragaib',
		midShaban: 'Nisfu Syaban', ramadanStart: 'Hari Pertama Ramadan',
		laylatAlQadr: 'Lailatulqadar', eidAlFitr: 'Idulfitri',
		dhulHijjahStart: 'Hari Pertama Zulhijah', tarwiyah: 'Hari Tarwiyah',
		arafah: 'Hari Arafah', eidAlAdha: 'Iduladha'
	},
	ms: {
		calendarTitle: 'Kalendar', upcomingHolydays: 'Hari Kebesaran Akan Datang',
		today: 'Hari ini', tomorrow: 'Esok', inDays: 'dalam {n} hari',
		noUpcoming: 'Tiada hari kebesaran akan datang',
		hijriNewYear: 'Tahun Baru Hijrah', ashura: 'Hari Asyura',
		mawlid: 'Maulidur Rasul ﷺ', israMiraj: 'Israk Mikraj',
		rajabStart: 'Hari Pertama Rejab', laylatAlRaghaib: 'Lailaturagaib',
		midShaban: 'Nisfu Syaaban', ramadanStart: 'Hari Pertama Ramadan',
		laylatAlQadr: 'Lailatulqadar', eidAlFitr: 'Hari Raya Aidilfitri',
		dhulHijjahStart: 'Hari Pertama Zulhijah', tarwiyah: 'Hari Tarwiah',
		arafah: 'Hari Arafah', eidAlAdha: 'Hari Raya Aidiladha'
	},
	ru: {
		calendarTitle: 'Календарь', upcomingHolydays: 'Предстоящие священные дни',
		today: 'Сегодня', tomorrow: 'Завтра', inDays: 'через {n} дн.',
		noUpcoming: 'Нет предстоящих священных дней',
		hijriNewYear: 'Исламский Новый год', ashura: 'День Ашура',
		mawlid: 'Мавлид (рождение Пророка ﷺ)', israMiraj: 'Исра и Мирадж',
		rajabStart: 'Первый день Раджаба', laylatAlRaghaib: 'Ляйлят ар-Рагаиб (Ночь желаний)',
		midShaban: 'Ночь середины Шаабана', ramadanStart: 'Первый день Рамадана',
		laylatAlQadr: 'Ляйлят аль-Кадр (Ночь предопределения)', eidAlFitr: 'Ид аль-Фитр (Ураза-байрам)',
		dhulHijjahStart: 'Первый день Зуль-хиджа', tarwiyah: 'День Тарвия',
		arafah: 'День Арафа', eidAlAdha: 'Ид аль-Адха (Курбан-байрам)'
	},
	fa: {
		calendarTitle: 'تقویم', upcomingHolydays: 'مناسبت‌های پیش رو',
		today: 'امروز', tomorrow: 'فردا', inDays: '{n} روز دیگر',
		noUpcoming: 'مناسبتی پیش رو نیست',
		hijriNewYear: 'سال نو هجری قمری', ashura: 'عاشورا',
		mawlid: 'میلاد پیامبر ﷺ', israMiraj: 'اسرا و معراج',
		rajabStart: 'نخستین روز ماه رجب', laylatAlRaghaib: 'شب رغائب',
		midShaban: 'نیمه شعبان', ramadanStart: 'نخستین روز ماه رمضان',
		laylatAlQadr: 'شب قدر', eidAlFitr: 'عید فطر',
		dhulHijjahStart: 'نخستین روز ماه ذی‌الحجه', tarwiyah: 'روز ترویه',
		arafah: 'روز عرفه', eidAlAdha: 'عید قربان'
	}
};
