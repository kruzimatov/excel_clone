import type { FileDescriptor } from '../types';

export type AppLanguage = 'uz' | 'ru';

const LANGUAGE_STORAGE_KEY = 'excel-clone-language';

const MESSAGES = {
  uz: {
    appTitle: 'Hisobot',
    untitledSpreadsheet: 'Nomsiz jadval',
    homeKicker: 'Asosiy',
    homeTitle: 'Fayllaringiz',
    homeSubtitle: 'Yangi jadval yarating, fayl oching va saqlangan ishni davom ettiring.',
    newSpreadsheet: 'Yangi jadval',
    openFile: 'Fayl ochish',
    loadingFile: 'Fayl yuklanmoqda...',
    storageUnavailable: 'Saqlangan fayllar hozircha ko‘rinmayapti.',
    checkingFiles: 'Fayllar tekshirilmoqda...',
    latestSession: 'Oxirgi sessiya',
    files: 'Fayllar',
    recent: 'So‘nggilar',
    continue: 'Davom etish',
    download: 'Yuklab olish',
    rename: 'Nomini o‘zgartirish',
    delete: 'O‘chirish',
    noFiles: 'Hali fayl yo‘q.',
    noFilesHint: 'Boshlash uchun yangi jadval yarating yoki `.xlsx` fayl oching.',
    justNow: 'Hozirgina',
    today: 'Bugun',
    yesterday: 'Kecha',
    actionsForFile: '{title} uchun amallar',
    home: 'Asosiy',
    closeWorkbook: 'Jadvalni yopib asosiy sahifaga qaytish',
    renameWorkbook: 'Jadval nomini o‘zgartirish',
    save: 'Saqlash',
    saving: 'Saqlanmoqda...',
    sourceBackend: 'Saqlangan ish maydoni',
    sourcePostgres: 'Saqlangan ish maydoni',
    sourceDevice: 'Qurilmadan ochilgan fayl',
    range: 'Oraliq',
    confirm: 'Tasdiqlash',
    cancel: 'Bekor qilish',
    rangeStartHint: '1-katak -> tugma -> 2-katak',
    rangePickFirstCell: 'Birinchi katakni tanlang',
    rangePickEndFrom: '{cell} dan tugash katagini tanlang',
    rangeSelectSecondCell: 'Ikkinchi katakni tanlang: {cell}',
    rangeModeTapFirst: 'Oraliq rejimi: BIRINCHI katakka bosing',
    rangeModeTapSecond: 'Oraliq rejimi: IKKINCHI katakka bosing ({cell})',
    rangeSelected: 'Tanlangan oraliq: {range}',
    clear: 'Tozalash',
    add: 'Qo‘shish',
    addAmount: '{amount} qo‘shish',
    addRowsPlaceholder: 'Qator soni',
    topMenus: 'Yuqori menyu',
    topMenusSubtitle: 'Formula qatorini yo‘qotmasdan boshqaruv tugmalarini oching yoki yoping.',
    hideMenus: 'Menyuni yashirish',
    showMenus: 'Menyuni ko‘rsatish',
    menu: 'Menyu',
    cells: 'Kataklar',
    bigger: 'Kattaroq',
    undo: 'Ortga',
    redo: 'Qaytarish',
    bold: 'Qalin',
    italic: 'Kursiv',
    fill: 'Fon',
    text: 'Matn',
    currency: 'Valyuta',
    custom: 'Maxsus',
    plainNumber: 'Oddiy son',
    typeValueOrSum: 'Qiymat yoki =СУММ kiriting',
    fillColor: 'Fon rangi',
    textColor: 'Matn rangi',
    currencyFormat: 'Valyuta formati',
    formatValuesAs: 'Qiymatlarni {symbol} sifatida formatlash',
    keepNumbersPlain: 'Sonlarni valyuta belgisiz qoldirish',
    done: 'Tayyor',
    functionSuggestions: 'Funksiya tavsiyalari',
    sheetName: 'Varaq nomi',
    cannotDeleteLastSheet: 'Oxirgi varaqni o‘chirib bo‘lmaydi',
    deleteSheetConfirm: '"{name}" varag‘i o‘chirilsinmi?',
    copy: 'Nusxa olish',
    cut: 'Kesish',
    paste: 'Qo‘yish',
    pasteValueOnly: 'Faqat qiymatni qo‘yish',
    pasteStyleOnly: 'Faqat stilni qo‘yish',
    copyFormat: 'Formatni nusxalash',
    copyFormatHint: 'Keyin kataklarni tanlab qo‘llang',
    applyFormatHere: 'Formatni shu yerga qo‘llash',
    formulas: 'Formulalar',
    deleteRow: 'Qatorni o‘chirish',
    deleteRows: '{count} qatorni o‘chirish',
    clearCells: 'Kataklarni tozalash',
    statusSum: 'Yig‘indi',
    statusAverage: 'O‘rtacha',
    statusCount: 'Soni',
    saveFailed: 'Saqlash xatosi: {message}',
    openFailed: 'Ochishda xato: {message}',
    downloadFailed: 'Yuklab olish xatosi: {message}',
    renameFailed: 'Nomini o‘zgartirish xatosi: {message}',
    deleteFailed: 'O‘chirish xatosi: {message}',
    renameWorkbookPrompt: 'Jadvalning yangi nomi',
    deleteWorkbookConfirm: '"{title}" saqlangan fayllardan o‘chirilsinmi?',
    deleteRowsConfirm: '{count} qator o‘chirilsinmi?',
    showNewestFirst: 'Yangilar tepada',
    showOldestFirst: 'Eskilar tepada',
  },
  ru: {
    appTitle: 'Отчет',
    untitledSpreadsheet: 'Новая таблица',
    homeKicker: 'Главная',
    homeTitle: 'Ваши файлы',
    homeSubtitle: 'Создайте новую таблицу, откройте файл и продолжайте сохраненную работу.',
    newSpreadsheet: 'Новая таблица',
    openFile: 'Открыть файл',
    loadingFile: 'Файл загружается...',
    storageUnavailable: 'Сохраненные файлы временно недоступны.',
    checkingFiles: 'Проверяем файлы...',
    latestSession: 'Последняя сессия',
    files: 'Файлы',
    recent: 'Недавние',
    continue: 'Продолжить',
    download: 'Скачать',
    rename: 'Переименовать',
    delete: 'Удалить',
    noFiles: 'Файлов пока нет.',
    noFilesHint: 'Создайте таблицу или откройте `.xlsx`, чтобы начать.',
    justNow: 'Только что',
    today: 'Сегодня',
    yesterday: 'Вчера',
    actionsForFile: 'Действия для {title}',
    home: 'Главная',
    closeWorkbook: 'Закрыть таблицу и вернуться на главную',
    renameWorkbook: 'Переименовать таблицу',
    save: 'Сохранить',
    saving: 'Сохранение...',
    sourceBackend: 'Сохраненное рабочее пространство',
    sourcePostgres: 'Сохраненное рабочее пространство',
    sourceDevice: 'Файл, открытый с устройства',
    range: 'Диапазон',
    confirm: 'Готово',
    cancel: 'Отмена',
    rangeStartHint: '1-я ячейка -> кнопка -> 2-я ячейка',
    rangePickFirstCell: 'Выберите первую ячейку',
    rangePickEndFrom: 'Выберите конец от {cell}',
    rangeSelectSecondCell: 'Выберите вторую ячейку: {cell}',
    rangeModeTapFirst: 'Режим диапазона: нажмите ПЕРВУЮ ячейку',
    rangeModeTapSecond: 'Режим диапазона: нажмите ВТОРУЮ ячейку ({cell})',
    rangeSelected: 'Выбран диапазон: {range}',
    clear: 'Очистить',
    add: 'Добавить',
    addAmount: 'Добавить {amount}',
    addRowsPlaceholder: 'Количество строк',
    topMenus: 'Верхнее меню',
    topMenusSubtitle: 'Открывайте и скрывайте панель, не теряя строку формулы.',
    hideMenus: 'Скрыть меню',
    showMenus: 'Показать меню',
    menu: 'Меню',
    cells: 'Ячейки',
    bigger: 'Крупнее',
    undo: 'Назад',
    redo: 'Повтор',
    bold: 'Жирный',
    italic: 'Курсив',
    fill: 'Заливка',
    text: 'Текст',
    currency: 'Валюта',
    custom: 'Свое',
    plainNumber: 'Обычное число',
    typeValueOrSum: 'Введите значение или =СУММ',
    fillColor: 'Цвет заливки',
    textColor: 'Цвет текста',
    currencyFormat: 'Формат валюты',
    formatValuesAs: 'Форматировать значения как {symbol}',
    keepNumbersPlain: 'Оставить числа без знака валюты',
    done: 'Готово',
    functionSuggestions: 'Подсказки функций',
    sheetName: 'Имя листа',
    cannotDeleteLastSheet: 'Нельзя удалить последний лист',
    deleteSheetConfirm: 'Удалить лист "{name}"?',
    copy: 'Копировать',
    cut: 'Вырезать',
    paste: 'Вставить',
    pasteValueOnly: 'Вставить только значение',
    pasteStyleOnly: 'Вставить только стиль',
    copyFormat: 'Копировать формат',
    copyFormatHint: 'Потом выберите ячейки и примените',
    applyFormatHere: 'Применить формат сюда',
    formulas: 'Формулы',
    deleteRow: 'Удалить строку',
    deleteRows: 'Удалить {count} строк',
    clearCells: 'Очистить ячейки',
    statusSum: 'Сумма',
    statusAverage: 'Среднее',
    statusCount: 'Кол-во',
    saveFailed: 'Ошибка сохранения: {message}',
    openFailed: 'Ошибка открытия: {message}',
    downloadFailed: 'Ошибка загрузки: {message}',
    renameFailed: 'Ошибка переименования: {message}',
    deleteFailed: 'Ошибка удаления: {message}',
    renameWorkbookPrompt: 'Новое имя таблицы',
    deleteWorkbookConfirm: 'Удалить "{title}" из сохраненных файлов?',
    deleteRowsConfirm: 'Удалить {count} строк?',
    showNewestFirst: 'Новые сверху',
    showOldestFirst: 'Старые сверху',
  },
} as const;

const FILL_COLOR_LABELS = {
  uz: ['Oq', 'Mint', 'Yashil', 'Havorang', 'Pushti', 'Sariq', 'Ko‘k', 'Sage', 'Shaftoli', 'Kulrang'],
  ru: ['Белый', 'Мята', 'Зеленый', 'Небесный', 'Розовый', 'Желтый', 'Синий', 'Сейдж', 'Персик', 'Серый'],
} as const;

const TEXT_COLOR_LABELS = {
  uz: ['Qora', 'Qizil', 'Yashil', 'Ko‘k', 'Binafsha', 'To‘q sariq', 'Kulrang', 'Yorqin qizil', 'Yorqin yashil', 'Aksent ko‘k'],
  ru: ['Черный', 'Красный', 'Зеленый', 'Синий', 'Фиолетовый', 'Оранжевый', 'Серый', 'Ярко-красный', 'Ярко-зеленый', 'Акцентный синий'],
} as const;

const CURRENCY_LABELS = {
  uz: {
    USD: 'AQSh dollari',
    RUB: 'Rubl',
    UZS: 'So‘m',
    EUR: 'Yevro',
    plain: MESSAGES.uz.plainNumber,
  },
  ru: {
    USD: 'Доллар США',
    RUB: 'Рубль',
    UZS: 'Сум',
    EUR: 'Евро',
    plain: MESSAGES.ru.plainNumber,
  },
} as const;

const FUNCTION_DESCRIPTIONS = {
  uz: {
    SUM: 'Oraliqdagi barcha sonlarni qo‘shadi',
    AVERAGE: 'Sonlarning o‘rtacha qiymatini hisoblaydi',
    COUNT: 'Son bor kataklarni sanaydi',
    COUNTA: 'Bo‘sh bo‘lmagan kataklarni sanaydi',
    MIN: 'Eng kichik qiymatni qaytaradi',
    MAX: 'Eng katta qiymatni qaytaradi',
    ABS: 'Mutlaq qiymatni qaytaradi',
    ROUND: 'Berilgan xonagacha yaxlitlaydi',
    IF: 'Shartli mantiq',
    AND: 'Barcha shartlar rost bo‘lsa TRUE qaytaradi',
    OR: 'Kamida bitta shart rost bo‘lsa TRUE qaytaradi',
  },
  ru: {
    SUM: 'Складывает все числа в диапазоне',
    AVERAGE: 'Вычисляет среднее значение чисел',
    COUNT: 'Считает ячейки с числами',
    COUNTA: 'Считает непустые ячейки',
    MIN: 'Возвращает минимальное значение',
    MAX: 'Возвращает максимальное значение',
    ABS: 'Возвращает абсолютное значение',
    ROUND: 'Округляет до указанного количества знаков',
    IF: 'Условная логика',
    AND: 'Возвращает TRUE, если все условия истинны',
    OR: 'Возвращает TRUE, если истинно хотя бы одно условие',
  },
} as const;

type MessageKey = keyof typeof MESSAGES.uz;

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'uz';
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'ru' ? 'ru' : 'uz';
}

export function persistLanguage(language: AppLanguage) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function t(
  language: AppLanguage,
  key: MessageKey,
  params?: Record<string, string | number>,
) {
  return interpolate(MESSAGES[language][key], params);
}

export function formatAppDate(language: AppLanguage, value?: string | null) {
  if (!value) return t(language, 'justNow');

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t(language, 'justNow');

  return new Intl.DateTimeFormat(language === 'uz' ? 'uz-UZ' : 'ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatCompactAppDate(language: AppLanguage, value?: string | null) {
  if (!value) return t(language, 'justNow');

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t(language, 'justNow');

  const locale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  if (dayDiff === 0) {
    return `${t(language, 'today')}, ${timeText}`;
  }

  if (dayDiff === 1) {
    return `${t(language, 'yesterday')}, ${timeText}`;
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getFillColorOptions(language: AppLanguage, colors: readonly string[]) {
  return colors.map((color, index) => ({
    value: color,
    label: FILL_COLOR_LABELS[language][index] ?? t(language, 'custom'),
  }));
}

export function getTextColorOptions(language: AppLanguage, colors: readonly string[]) {
  return colors.map((color, index) => ({
    value: color,
    label: TEXT_COLOR_LABELS[language][index] ?? t(language, 'custom'),
  }));
}

export function getCurrencyLabel(language: AppLanguage, currency: 'USD' | 'RUB' | 'UZS' | 'EUR' | '') {
  if (!currency) return CURRENCY_LABELS[language].plain;
  return CURRENCY_LABELS[language][currency];
}

export function getCurrencyHint(language: AppLanguage, currency: 'USD' | 'RUB' | 'UZS' | 'EUR' | '', symbol: string) {
  if (!currency) return t(language, 'keepNumbersPlain');
  return t(language, 'formatValuesAs', { symbol });
}

export function getFunctionDescription(language: AppLanguage, functionName: string, fallback: string) {
  return FUNCTION_DESCRIPTIONS[language][functionName as keyof typeof FUNCTION_DESCRIPTIONS.uz] ?? fallback;
}

export function getFileSourceLabel(language: AppLanguage, file: FileDescriptor | null) {
  if (!file) return t(language, 'sourceBackend');
  if (file.source === 'backend') return t(language, 'sourcePostgres');
  if (file.source === 'device') return t(language, 'sourceDevice');
  return t(language, 'sourceBackend');
}

export function buildDefaultWorkbookTitle(language: AppLanguage) {
  return t(language, 'appTitle');
}

export function buildUntitledWorkbookTitle(language: AppLanguage) {
  return t(language, 'untitledSpreadsheet');
}

export function buildDefaultSheetName(language: AppLanguage, index: number) {
  return language === 'ru' ? `Лист ${index}` : `Varaq ${index}`;
}
