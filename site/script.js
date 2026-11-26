/**
 * Chess Assistant — Showcase Website Script
 * Поддержка переключения вкладок (ПК / Телефон) и двух языков (RU / EN)
 */

const translations = {
  ru: {
    pageTitle: "Chess Assistant — Умный шахматный ассистент (Stockfish 19)",
    navFeatures: "Возможности",
    navBrowsers: "Браузеры",
    navInstall: "Установка",
    heroBadge: "Stockfish 19 WASM • Версия 2.4 Релиз",
    heroTitle1: "Побеждай уверенно.",
    heroTitle2: "Умный шахматный ассистент",
    heroSubtitle: "Визуальные стрелки лучших ходов, расчёт глубоких премувов и точная шкала преимущества в реальном времени на Chess.com и Lichess.org.",
    heroFriendTag: "your free and opensource friend ^-^",
    downloadPcBtn: "Скачать для ПК",
    downloadPhoneBtn: "Скачать для Телефона",
    tgChannelBtn: "Telegram Канал",
    githubBtn: "Исходный код",
    mockEvalLabel: "📊 Оценка:",
    mockStatus: "🎯 Преимущество белых (в твою пользу! 🎉)",
    mockBullet: "⚡ Пуля (150мс)",
    mockBlitz: "🎯 Блиц",
    mockRapid: "🧠 Рапид",
    mockLog: "⬛ 1-й: D2 ➔ D4 [+0.4 • в твою пользу]<br>◽ 2-й: F1 ➔ E1 [+0.3 • в твою пользу]<br>⬜ 3-й: A2 ➔ A4 [+0.2 • в твою пользу]",
    browsersTitle: "Под какие браузеры подходит?",
    browsersSubtitle: "Плагин разработан в формате открытого стандарта расширений <strong>.xpi</strong>, что гарантирует максимальную производительность движка WebAssembly и отсутствие ограничений.",
    recommendedBadge: "⭐ Идеальный выбор",
    waterfoxDesc: "Лучший браузер для шахматного ассистента! Полная свобода установки сторонних дополнений из файлов, сверхбыстрый движок и поддержка как на ПК, так и на смартфоне.",
    firefoxDesc: "Классический браузер с мощным WebAssembly JIT-компилятором. На ПК поддерживается в Firefox Developer Edition / Nightly / ESR (с отключённой проверкой подписи), на Android — в Firefox Nightly или Waterfox.",
    librewolfDesc: "Ориентированный на приватность браузер на базе Gecko. Отлично подходит для запуска плагина на ПК без лишней слежки и телеметрии.",
    chromeNote: "<strong>Почему не Google Chrome / Edge / Opera?</strong> Chromium-браузеры заблокировали удобный формат дополнений <code>.xpi</code> и искусственно ограничивают производительность WebAssembly. Браузеры на базе Gecko (Waterfox / Firefox) работают на 40% быстрее и не блокируют работу шахматных нейросетей!",
    featuresTitle: "Возможности и преимущества",
    featuresSubtitle: "Всё для максимального комфорта, глубокого анализа и побед.",
    feat1Title: "Мульти-стрелки ходов",
    feat1Desc: "Показ лучшего хода (чёрный), второго (серый) и третьего (белый), либо режим 5 стрелок с бейджами оценки позиции.",
    feat2Title: "Умный расчёт премувов",
    feat2Desc: "Пока соперник думает над своим ходом, движок уже рассчитывает твой ответный ход и моментально показывает зелёную стрелку премува.",
    feat3Title: "Шкала преимущества (Eval Bar)",
    feat3Desc: "Точный процент шансов на победу в режиме реального времени, пересчёт преимущества в пешечном эквиваленте или количестве ходов до мата.",
    feat4Title: "4 режима скорости",
    feat4Desc: "От ультра-быстрой Пули (50–150 мс) до глубокого позиционного анализа в Рапиде и Ультра-режиме (до 26 ходов глубины).",
    feat5Title: "Защита от пропадания стрелок",
    feat5Desc: "Стрелки не исчезают, когда ты берёшь фигуру в руку и перетаскиваешь её по доске. Ты всегда видишь, куда ставить фигуру.",
    feat6Title: "Русский и Английский (RU/EN)",
    feat6Desc: "Мгновенный выбор языка интерфейса в настройках виджета. Автоматическое определение языка браузера.",
    installTitle: "Как установить плагин",
    installSubtitle: "Простая установка в три шага без сторонних магазинов расширений.",
    tabPcBtn: "💻 Компьютер (Windows / Mac / Linux)",
    tabPhoneBtn: "📱 Смартфон (Android)",
    stepPc1Title: "Скачай файл расширения",
    stepPc1Desc: "Скачай файл <code>chess-assistant.xpi</code> по кнопке ниже:",
    stepPcDownloadBtn: "📥 Скачать chess-assistant.xpi (75 МБ)",
    stepPc2Title: "Открой управление дополнениями",
    stepPc2Desc: "В браузере Waterfox или Firefox открой страницу дополнений (нажми комбинацию клавиш <code>Ctrl + Shift + A</code> или введи в адресную строку <code>about:addons</code>).",
    stepPc3Title: "Установи из файла",
    stepPc3Desc: "Нажми на значок шестерёнки ⚙️ в правом верхнем углу ➔ выбери <strong>«Установить дополнение из файла…»</strong> (Install Add-on From File) и укажи скачанный <code>.xpi</code>. Готово!",
    stepPh1Title: "Установи браузер на смартфон",
    stepPh1Desc: "Установи браузер <strong>Waterfox</strong> или <strong>Firefox Nightly</strong> из Google Play или официального сайта.",
    stepPh2Title: "Скачай мобильную версию плагина",
    stepPh2Desc: "Скачай ультра-лёгкий пакет <code>chess-assistant_phone.xpi</code> (всего 1.2 МБ):",
    stepPhDownloadBtn: "📥 Скачать chess-assistant_phone.xpi (1.2 МБ)",
    stepPh3Title: "Установи дополнение в браузере",
    stepPh3Desc: "В мобильном Waterfox нажми меню (три точки ☰) ➔ <strong>Дополнения</strong> ➔ значок шестерёнки ⚙️ ➔ <strong>«Установить дополнение из файла»</strong>. Выбери скачанный файл — и побеждай с телефона!",
    tgBannerTitle: "Официальный Telegram-канал",
    tgBannerDesc: "Свежие обновления движка, новые функции, настройки под блиц/пулю и общение игроков в нашем Telegram-сообществе!",
    tgJoinBtn: "Присоединиться к Telegram",
    footerDesc: "Свободное и открытое расширение для анализа шахматных партий.",
    footerColProject: "Проект",
    footerColCommunity: "Сообщество"
  },
  en: {
    pageTitle: "Chess Assistant — Smart Chess Assistant (Stockfish 19)",
    navFeatures: "Features",
    navBrowsers: "Browsers",
    navInstall: "Installation",
    heroBadge: "Stockfish 19 WASM • Version 2.4 Release",
    heroTitle1: "Dominate Every Match.",
    heroTitle2: "Smart Chess Assistant",
    heroSubtitle: "Live best-move arrows, smart opponent pre-calculation, and real-time win probability evaluation on Chess.com and Lichess.org.",
    heroFriendTag: "your free and opensource friend ^-^",
    downloadPcBtn: "Download for PC",
    downloadPhoneBtn: "Download for Mobile",
    tgChannelBtn: "Telegram Channel",
    githubBtn: "Source Code",
    mockEvalLabel: "📊 Eval:",
    mockStatus: "🎯 White is winning (in your favor! 🎉)",
    mockBullet: "⚡ Bullet (150ms)",
    mockBlitz: "🎯 Blitz",
    mockRapid: "🧠 Rapid",
    mockLog: "⬛ 1st: D2 ➔ D4 [+0.4 • in your favor]<br>◽ 2nd: F1 ➔ E1 [+0.3 • in your favor]<br>⬜ 3rd: A2 ➔ A4 [+0.2 • in your favor]",
    browsersTitle: "Supported Browsers",
    browsersSubtitle: "Built with the open standard <strong>.xpi</strong> extension format, unlocking maximum WebAssembly performance with zero restrictions.",
    recommendedBadge: "⭐ Recommended Choice",
    waterfoxDesc: "The best browser for Chess Assistant! Complete freedom to install add-ons from files, blazing fast engine, and full support on PC & Android.",
    firefoxDesc: "Classic browser with a high-performance WebAssembly JIT compiler. Supported on PC via Firefox Developer Edition / Nightly / ESR (with signature check disabled), and on Android via Firefox Nightly or Waterfox.",
    librewolfDesc: "Privacy-oriented Gecko browser. Perfect for running the assistant on desktop without background tracking or telemetry.",
    chromeNote: "<strong>Why not Chrome / Edge / Opera?</strong> Chromium browsers restrict <code>.xpi</code> add-ons and throttle WebAssembly memory. Gecko browsers (Waterfox / Firefox) are up to 40% faster and let chess neural networks unleash their full potential!",
    featuresTitle: "Features & Highlights",
    featuresSubtitle: "Engineered for deep tactical analysis, speed, and consistent victories.",
    feat1Title: "Multi-Move Evaluation Arrows",
    feat1Desc: "Display best move (black), 2nd best (grey), and 3rd best (white), or expand up to 5 arrows with live evaluation tags.",
    feat2Title: "Instant Premove Engine",
    feat2Desc: "While your opponent is thinking, the engine pre-computes the optimal response and draws an instant green premove arrow.",
    feat3Title: "Dynamic Advantage Bar",
    feat3Desc: "Real-time win chance percentages, centipawn advantage calculations, and countdown to forced mate.",
    feat4Title: "4 Tailored Speed Profiles",
    feat4Desc: "From lightning-fast Bullet (50–150ms) to master-level positional analysis in Rapid & Ultra mode (up to depth 26).",
    feat5Title: "Persistent Board Dragging",
    feat5Desc: "Arrows stay locked on board while dragging and dropping pieces. Never lose track of your tactical plan mid-move.",
    feat6Title: "Dual Language Support (RU/EN)",
    feat6Desc: "Switch between Russian and English with a single tap in extension settings. Automatic browser language detection.",
    installTitle: "How to Install the Extension",
    installSubtitle: "Simple 3-step installation without third-party store approvals.",
    tabPcBtn: "💻 Desktop (Windows / Mac / Linux)",
    tabPhoneBtn: "📱 Smartphone (Android)",
    stepPc1Title: "Download the Extension File",
    stepPc1Desc: "Download <code>chess-assistant.xpi</code> using the button below:",
    stepPcDownloadBtn: "📥 Download chess-assistant.xpi (75 MB)",
    stepPc2Title: "Open Add-ons Manager",
    stepPc2Desc: "In Waterfox or Firefox, open the Add-ons manager (press <code>Ctrl + Shift + A</code> or type <code>about:addons</code> into the address bar).",
    stepPc3Title: "Install from File",
    stepPc3Desc: "Click the gear icon ⚙️ in the top right ➔ select <strong>'Install Add-on From File…'</strong> and pick the downloaded <code>.xpi</code>. You're ready to play!",
    stepPh1Title: "Install a Supported Mobile Browser",
    stepPh1Desc: "Install <strong>Waterfox</strong> or <strong>Firefox Nightly</strong> from Google Play or the official website.",
    stepPh2Title: "Download the Mobile Extension",
    stepPh2Desc: "Download the lightweight <code>chess-assistant_phone.xpi</code> build (only 1.2 MB):",
    stepPhDownloadBtn: "📥 Download chess-assistant_phone.xpi (1.2 MB)",
    stepPh3Title: "Install Add-on in Browser",
    stepPh3Desc: "In mobile Waterfox tap menu (three dots ☰) ➔ <strong>Add-ons</strong> ➔ gear icon ⚙️ ➔ <strong>'Install Add-on From File'</strong>. Choose the downloaded file and dominate from your phone!",
    tgBannerTitle: "Official Telegram Community",
    tgBannerDesc: "Fresh engine updates, release alerts, speed tuning configs, and community support in our Telegram channel!",
    tgJoinBtn: "Join Telegram Channel",
    footerDesc: "Free and open-source chess tactical analysis extension.",
    footerColProject: "Project",
    footerColCommunity: "Community"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // 1. Управление вкладками установки (ПК / Телефон)
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // 2. Управление переключением языков (RU / EN)
  const btnRu = document.getElementById("btn-lang-ru");
  const btnEn = document.getElementById("btn-lang-en");

  function setLanguage(lang) {
    const dict = translations[lang] || translations.ru;

    document.querySelectorAll("[data-i18n]").forEach((elem) => {
      const key = elem.getAttribute("data-i18n");
      if (dict[key]) {
        if (elem.tagName === "TITLE") {
          document.title = dict[key];
        } else {
          elem.innerHTML = dict[key];
        }
      }
    });

    if (btnRu && btnEn) {
      if (lang === "en") {
        btnEn.classList.add("active");
        btnRu.classList.remove("active");
        document.documentElement.lang = "en";
      } else {
        btnRu.classList.add("active");
        btnEn.classList.remove("active");
        document.documentElement.lang = "ru";
      }
    }

    try {
      localStorage.setItem("chess_site_lang", lang);
    } catch (_) {}
  }

  if (btnRu && btnEn) {
    btnRu.addEventListener("click", () => setLanguage("ru"));
    btnEn.addEventListener("click", () => setLanguage("en"));
  }

  // Определяем сохраненный язык или язык системы (безопасно в приватных браузерах)
  let savedLang = null;
  try {
    savedLang = localStorage.getItem("chess_site_lang");
  } catch (_) {}

  const browserLang = (typeof navigator !== "undefined" && navigator.language) ? navigator.language : "ru";
  if (savedLang === "en" || (!savedLang && !browserLang.startsWith("ru"))) {
    setLanguage("en");
  } else {
    setLanguage("ru");
  }
});
