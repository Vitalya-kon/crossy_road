const counterDOM = document.getElementById("counter");
const scoreDOM = document.getElementById("score");
const endDOM = document.getElementById("end");
const startDOM = document.getElementById("start");
const restartButton = document.getElementById("restartButton");
const lastScoreDOM = document.getElementById("lastScore");
const characterSelectDOM = document.getElementById("characterSelect");
const soundToggleButton = document.getElementById("soundToggle");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const startButtonDOM = document.getElementById("startButton");
const retryButton = document.getElementById("retry");
const controllsDOM = document.getElementById("controlls");
const scoreLabelDOM = scoreDOM ? scoreDOM.firstElementChild : null;

const DEFAULT_LANGUAGE = "ru";
const SECONDARY_LANGUAGE = "en";

const translations = {
  ru: {
    scoreLabel: "Счёт:",
    startButton: "Старт",
    restartButton: "Заново",
    retryButton: "Заново",
    soundToggleTitle: "Включить/выключить звук",
    yourScore: ({ score }) => `Ваш счёт: ${score}`,
    characterTitles: {
      giraffe: "Жираф",
      lion: "Лев",
      zebra: "Зебра",
      hippo: "Бегемот"
    }
  },
  en: {
    scoreLabel: "Score:",
    startButton: "Start",
    restartButton: "Restart",
    retryButton: "Restart",
    soundToggleTitle: "Toggle sound",
    yourScore: ({ score }) => `Your score: ${score}`,
    characterTitles: {
      giraffe: "Giraffe",
      lion: "Lion",
      zebra: "Zebra",
      hippo: "Hippo"
    }
  }
};

let currentLanguageCode = null;
let lastScoreValue = null;

function resolveLanguageCode(langCode) {
  if (typeof langCode !== "string") {
    return DEFAULT_LANGUAGE;
  }
  const normalized = langCode.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_LANGUAGE;
  }
  if (translations[normalized]) {
    return normalized;
  }
  const short = normalized.split("-")[0];
  if (translations[short]) {
    return short;
  }
  if (normalized.startsWith("ru")) {
    return DEFAULT_LANGUAGE;
  }
  if (translations[SECONDARY_LANGUAGE]) {
    return SECONDARY_LANGUAGE;
  }
  return DEFAULT_LANGUAGE;
}

function translate(key, params = {}) {
  const activeLang =
    currentLanguageCode && translations[currentLanguageCode]
      ? currentLanguageCode
      : DEFAULT_LANGUAGE;
  const primaryDictionary = translations[activeLang] || {};
  const fallbackDictionary = translations[DEFAULT_LANGUAGE] || {};
  let value = primaryDictionary[key];
  if (value === undefined && activeLang !== DEFAULT_LANGUAGE) {
    value = fallbackDictionary[key];
  }
  if (typeof value === "function") {
    return value(params);
  }
  return value ?? "";
}

function translateCharacterTitle(characterKey) {
  const activeLang =
    currentLanguageCode && translations[currentLanguageCode]
      ? currentLanguageCode
      : DEFAULT_LANGUAGE;
  const activeTitles = translations[activeLang]?.characterTitles || {};
  if (activeTitles[characterKey]) {
    return activeTitles[characterKey];
  }
  const defaultTitles = translations[DEFAULT_LANGUAGE]?.characterTitles || {};
  if (defaultTitles[characterKey]) {
    return defaultTitles[characterKey];
  }
  const secondaryTitles = translations[SECONDARY_LANGUAGE]?.characterTitles || {};
  if (secondaryTitles[characterKey]) {
    return secondaryTitles[characterKey];
  }
  return characterKey || "";
}

function applyTranslations() {
  if (scoreLabelDOM) {
    const scoreLabel = translate("scoreLabel");
    if (scoreLabel) {
      scoreLabelDOM.textContent = scoreLabel;
    }
  }
  if (startButtonDOM) {
    startButtonDOM.textContent = translate("startButton");
  }
  if (restartButton) {
    restartButton.textContent = translate("restartButton");
  }
  if (retryButton) {
    retryButton.textContent = translate("retryButton");
  }
  if (soundToggleButton) {
    const soundTitle = translate("soundToggleTitle");
    if (soundTitle) {
      soundToggleButton.setAttribute("title", soundTitle);
      soundToggleButton.setAttribute("aria-label", soundTitle);
    }
  }
  if (characterSelectDOM) {
    const buttons = characterSelectDOM.querySelectorAll(".character-option");
    buttons.forEach((button) => {
      const characterKey = button.getAttribute("data-character");
      if (!characterKey) return;
      const titleValue = translateCharacterTitle(characterKey);
      if (titleValue) {
        button.setAttribute("title", titleValue);
        button.setAttribute("aria-label", titleValue);
      }
    });
  }
}

function setLanguage(langCode) {
  const resolved = resolveLanguageCode(langCode);
  if (resolved === currentLanguageCode) {
    return resolved;
  }
  currentLanguageCode = resolved;
  if (document && document.documentElement) {
    document.documentElement.setAttribute("lang", resolved);
  }
  applyTranslations();
  if (lastScoreValue !== null && lastScoreDOM) {
    lastScoreDOM.textContent = translate("yourScore", { score: lastScoreValue });
  }
  return resolved;
}

function detectLanguageFallback() {
  const browserLang =
    typeof navigator !== "undefined"
      ? navigator.language || navigator.userLanguage
      : "";
  if (browserLang) {
    const resolved = setLanguage(browserLang);
    console.log("[Localization] Browser language detected:", browserLang, "→", resolved);
  } else {
    const resolved = setLanguage(DEFAULT_LANGUAGE);
    console.log("[Localization] Browser language not available, fallback to", resolved);
  }
}

function detectLanguageFromSDK(sdk) {
  if (!sdk) {
    return;
  }
  const sdkLang =
    sdk?.environment?.i18n?.lang || sdk?.environment?.i18n?.locale;
  if (sdkLang) {
    const resolved = setLanguage(sdkLang);
    console.log("[Localization] SDK language detected:", sdkLang, "→", resolved);
  } else {
    console.log("[Localization] SDK did not provide language, using fallback.");
    detectLanguageFallback();
  }
}

setLanguage(DEFAULT_LANGUAGE);
detectLanguageFallback();

let gameStarted = false;
let selectedCharacter = "giraffe"; // default
let gameOverSoundPlayed = false; // Флаг для отслеживания воспроизведения звука окончания игры
let soundEnabled = true; // Флаг для управления звуком

// Переменные для поддержки ТВ-пульта
let isTVDevice = false;
let currentCharacterIndex = 0; // Индекс текущего выбранного персонажа для навигации с пульта
let yandexSDK = null;
let gameReadyCalled = false; // Флаг для отслеживания вызова GameReady API

// Инициализация Яндекс Игр SDK
if (typeof YaGames !== 'undefined') {
  YaGames.init().then(ysdk => {
    window.ysdk = ysdk;
    yandexSDK = ysdk;
    detectLanguageFromSDK(ysdk);
    const deviceInfo = ysdk.deviceInfo;
    if (deviceInfo && deviceInfo.type === 'tv') {
      isTVDevice = true;
      console.log('Обнаружено ТВ-устройство, включена поддержка пульта');
      // Добавляем класс для стилизации под ТВ
      document.body.classList.add('tv-device');
    }
    // GameReady API будет вызван после загрузки всех ресурсов
  }).catch(err => {
    console.log('Ошибка инициализации Яндекс Игр SDK:', err);
    // Если SDK не загрузился, все равно показываем игру
      detectLanguageFallback();
    callGameReady();
  });
} else {
  // Если SDK не доступен, все равно показываем игру
  detectLanguageFallback();
  setTimeout(callGameReady, 100);
}

// Web Audio API - инициализация
let audioContext = null;
let masterGainNode = null;

// Инициализация AudioContext (требуется пользовательское взаимодействие)
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      masterGainNode = audioContext.createGain();
      masterGainNode.connect(audioContext.destination);
      masterGainNode.gain.value = 1.0;
      
      // Восстанавливаем контекст, если он приостановлен
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
        }).catch(err => {
          console.error("[Audio] Ошибка при возобновлении AudioContext:", err);
        });
      }
    } catch (error) {
      console.error("[Audio] Ошибка инициализации AudioContext:", error);
    }
  } 
  return audioContext;
}

// Загрузка аудио буферов
const audioBuffers = {};
let audioBuffersLoaded = false;

async function loadAudioBuffer(url, name) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    
    if (!audioContext) {
      initAudioContext();
    }
    
    if (!audioContext) {
      throw new Error("AudioContext не удалось инициализировать");
    }
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers[name] = audioBuffer;
    return audioBuffer;
  } catch (error) {
    console.error(`[Audio] Ошибка загрузки аудио ${name}:`, error);
    return null;
  }
}

// Загрузка всех звуков
async function loadAllSounds() {
  
  // Загружаем файлы без AudioContext (только fetch)
  const soundFiles = [
    { url: "./assets/sounds/jump.wav", name: "jump" },
    { url: "./assets/sounds/sound.wav", name: "background" },
    { url: "./assets/sounds/traffic1.wav", name: "traffic" },
    { url: "./assets/sounds/game_over1.wav", name: "gameOver" }
  ];
  
  // Загружаем все файлы параллельно с обработкой ошибок
  const arrayBuffers = {};
  
  const loadPromises = soundFiles.map(async (sound) => {
    try {
      const startTime = Date.now();
      
      const response = await fetch(sound.url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} для ${sound.url}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const loadTime = Date.now() - startTime;
      
      arrayBuffers[sound.name] = arrayBuffer;
      return { name: sound.name, success: true, buffer: arrayBuffer };
    } catch (error) {
      console.error(`[Audio] ✗ Ошибка загрузки файла ${sound.name}:`, error);
      console.error(`[Audio] Детали ошибки:`, error.message, error.stack);
      arrayBuffers[sound.name] = null;
      return { name: sound.name, success: false, error: error.message };
    }
  });
  
  // Ждем загрузки всех файлов
  const results = await Promise.all(loadPromises);
  const loadedCount = results.filter(r => r.success).length;
  
  // Выводим детальные результаты
  results.forEach(result => {
    if (result.success) {
    } else {
      console.error(`[Audio] ✗ ${result.name} - ОШИБКА: ${result.error}`);
    }
  });
  
  // Декодируем только если AudioContext доступен
  // Если нет - декодируем позже при первом взаимодействии
  if (audioContext && audioContext.state !== 'closed') {
    for (const sound of soundFiles) {
      if (arrayBuffers[sound.name]) {
        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffers[sound.name].slice(0));
          audioBuffers[sound.name] = audioBuffer;
        } catch (error) {
          console.error(`[Audio] Ошибка декодирования ${sound.name}:`, error);
          audioBuffers[sound.name] = null;
        }
      }
    }
    audioBuffersLoaded = true;
  } else {
    // Сохраняем ArrayBuffer для декодирования позже
    window._pendingAudioBuffers = arrayBuffers;
    audioBuffersLoaded = false;
  }
  
  return arrayBuffers;
}

// Класс для управления воспроизведением звука
class SoundSource {
  constructor(buffer, volume = 1.0, loop = false, name = "unknown") {
    this.buffer = buffer;
    this.volume = volume;
    this.loop = loop;
    this.source = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.shouldStop = false; // Флаг для предотвращения автоперезапуска
    this.name = name; // Имя звука для логирования
  }

  play() {
    const timestamp = new Date().toISOString();
    
    console.log(`[SoundSource:${this.name}] PLAY вызван в ${timestamp}`, {
      isPlaying: this.isPlaying,
      hasSource: !!this.source,
      shouldStop: this.shouldStop,
      loop: this.loop,
      soundEnabled: soundEnabled,
      audioContextState: audioContext?.state
    });
    
    if (!audioContext) {
      console.warn(`[SoundSource:${this.name}] AudioContext не инициализирован!`);
      return;
    }
    
    if (!this.buffer) {
      console.warn(`[SoundSource:${this.name}] Буфер звука не загружен!`);
      return;
    }
    
    if (!soundEnabled) {
      console.log(`[SoundSource:${this.name}] Звук отключен, воспроизведение отменено`);
      return;
    }
    
    // Если звук уже играет и это зацикленный звук, не создаем новый источник
    if (this.isPlaying && this.loop) {
      console.log(`[SoundSource:${this.name}] Звук уже играет (loop), воспроизведение отменено`);
      return;
    }
    
    // Сбрасываем флаг остановки перед воспроизведением
    this.shouldStop = false;
    
    try {
      // Восстанавливаем контекст, если он приостановлен
      if (audioContext.state === 'suspended') {
        console.log(`[SoundSource:${this.name}] AudioContext приостановлен, возобновляем...`);
        audioContext.resume().then(() => {
          console.log(`[SoundSource:${this.name}] AudioContext возобновлен`);
        }).catch(err => {
          console.error(`[SoundSource:${this.name}] Ошибка при возобновлении:`, err);
        });
      }
      
      // Останавливаем предыдущий источник, если он есть
      if (this.source && this.isPlaying) {
        console.log(`[SoundSource:${this.name}] Останавливаем предыдущий источник перед запуском нового`);
        try {
          this.shouldStop = true; // Устанавливаем флаг перед остановкой
          this.source.onended = null; // Отключаем обработчик
          this.source.stop();
          console.log(`[SoundSource:${this.name}] Предыдущий источник остановлен`);
        } catch (e) {
          console.warn(`[SoundSource:${this.name}] Ошибка при остановке предыдущего источника:`, e);
        }
      }
      
      // Создаем новый источник для каждого воспроизведения
      this.source = audioContext.createBufferSource();
      this.gainNode = audioContext.createGain();
      
      this.source.buffer = this.buffer;
      this.source.loop = this.loop;
      
      this.gainNode.gain.value = this.volume;
      
      this.source.connect(this.gainNode);
      this.gainNode.connect(masterGainNode);
      
      // Сохраняем ссылку на текущий источник для проверки в обработчике
      const currentSource = this.source;
      const sourceId = Math.random().toString(36).substr(2, 9);
      console.log(`[SoundSource:${this.name}] Создан новый источник звука (ID: ${sourceId})`);
      
      this.source.onended = () => {
        console.log(`[SoundSource:${this.name}] onended вызван (ID: ${sourceId})`, {
          isCurrentSource: currentSource === this.source,
          shouldStop: this.shouldStop,
          loop: this.loop
        });
        
        // Проверяем, что это все еще текущий источник и не была запрошена остановка
        if (currentSource === this.source && !this.shouldStop) {
          this.isPlaying = false;
          console.log(`[SoundSource:${this.name}] Источник завершился, isPlaying = false`);
          // Для зацикленных звуков автоматически перезапускаем
          if (this.loop && soundEnabled && this.buffer && !this.shouldStop) {
            console.log(`[SoundSource:${this.name}] Автоперезапуск зацикленного звука`);
            this.play();
          }
        } else {
          this.isPlaying = false;
          console.log(`[SoundSource:${this.name}] Источник завершился, но автоперезапуск отменен`);
        }
      };
      
      this.source.start(0);
      this.isPlaying = true;
      console.log(`[SoundSource:${this.name}] Воспроизведение запущено (ID: ${sourceId})`, {
        isPlaying: this.isPlaying,
        loop: this.loop
      });
    } catch (error) {
      console.error(`[SoundSource:${this.name}] Ошибка воспроизведения звука:`, error);
      this.isPlaying = false;
    }
  }

  stop() {
    const timestamp = new Date().toISOString();
    console.log(`[SoundSource:${this.name}] STOP вызван в ${timestamp}`, {
      isPlaying: this.isPlaying,
      hasSource: !!this.source,
      shouldStop: this.shouldStop
    });
    
    // Устанавливаем флаг остановки
    this.shouldStop = true;
    
    if (this.source) {
      try {
        // Отключаем обработчик onended перед остановкой
        this.source.onended = null;
        console.log(`[SoundSource:${this.name}] Обработчик onended отключен`);
        
        // Останавливаем источник, если он еще играет
        if (this.isPlaying) {
          this.source.stop();
          console.log(`[SoundSource:${this.name}] Источник остановлен через stop()`);
        } else {
          console.log(`[SoundSource:${this.name}] Источник уже не играет (isPlaying = false)`);
        }
      } catch (error) {
        console.warn(`[SoundSource:${this.name}] Ошибка при остановке источника:`, error);
      }
    } else {
      console.log(`[SoundSource:${this.name}] Источник отсутствует (source = null)`);
    }
    
    // Очищаем состояние
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.source = null;
    this.gainNode = null;
    console.log(`[SoundSource:${this.name}] Состояние очищено`, {
      wasPlaying: wasPlaying,
      isPlaying: this.isPlaying,
      source: this.source,
      gainNode: this.gainNode
    });
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }
}

// Объекты для управления звуками
let jumpSound = null;
let backgroundMusic = null;
let trafficSound = null;
let gameOverSound = null;

// Инициализация звуков после загрузки буферов
function initSounds() {
  if (!audioBuffersLoaded) {
    console.warn("[Audio] Буферы еще не загружены!");
    return;
  }
  
  if (!audioContext) {
    console.warn("[Audio] AudioContext не инициализирован!");
    initAudioContext();
  }
  
  if (audioBuffers.jump) {
    jumpSound = new SoundSource(audioBuffers.jump, 0.5, false, "jump");
  } else {
    console.error("[Audio] Буфер jump не загружен!");
  }
  
  if (audioBuffers.background) {
    backgroundMusic = new SoundSource(audioBuffers.background, 0.3, true, "background");
  } else {
    console.error("[Audio] Буфер background не загружен!");
  }
  
  if (audioBuffers.traffic) {
    trafficSound = new SoundSource(audioBuffers.traffic, 0.4, true, "traffic");
  } else {
    console.error("[Audio] Буфер traffic не загружен!");
  }
  
  if (audioBuffers.gameOver) {
    gameOverSound = new SoundSource(audioBuffers.gameOver, 0.6, false, "gameOver");
  } else {
    console.error("[Audio] Буфер gameOver не загружен!");
  }
  
}

// Флаг для отслеживания, была ли запущена музыка
let musicStarted = false;

// Функция для запуска фоновой музыки
function startBackgroundMusic() {
  if (soundEnabled && backgroundMusic && !backgroundMusic.isPlaying) {
    backgroundMusic.play();
    musicStarted = true;
  } else {
    console.log("[Audio] Фоновая музыка не запущена:", {
      soundEnabled,
      hasBackgroundMusic: !!backgroundMusic,
      isPlaying: backgroundMusic?.isPlaying
    });
  }
}

// Функция для включения/выключения всех звуков
function toggleSound() {
  soundEnabled = !soundEnabled;
  
  if (soundEnabled) {
    // Включаем звук - показываем иконку паузы
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    
    // Возобновляем фоновую музыку и звук трафика, если игра начата
    startBackgroundMusic();
    if (gameStarted && trafficSound) {
      trafficSound.play();
    }
  } else {
    // Выключаем звук - показываем иконку воспроизведения
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    
    // Останавливаем все звуки
    if (backgroundMusic) backgroundMusic.stop();
    if (trafficSound) trafficSound.stop();
    if (jumpSound) jumpSound.stop();
    if (gameOverSound) gameOverSound.stop();
  }
}

// Обработчик для кнопки переключения звука
soundToggleButton.addEventListener("click", toggleSound);

// Звуки будут загружены в функции waitForResourcesLoaded

const scene = new THREE.Scene();

const distance = 500;
const camera = new THREE.OrthographicCamera(
  window.innerWidth / -2,
  window.innerWidth / 2,
  window.innerHeight / 2,
  window.innerHeight / -2,
  0.1,
  10000
);

camera.rotation.x = (50 * Math.PI) / 180;
camera.rotation.y = (20 * Math.PI) / 180;
camera.rotation.z = (10 * Math.PI) / 180;

const initialCameraPositionY = -Math.tan(camera.rotation.x) * distance;
const initialCameraPositionX =
  Math.tan(camera.rotation.y) *
  Math.sqrt(distance ** 2 + initialCameraPositionY ** 2);
camera.position.y = initialCameraPositionY;
camera.position.x = initialCameraPositionX;
camera.position.z = distance;

const zoom = 2;

const chickenSize = 15;

const positionWidth = 42;
const columns = 21;
const boardWidth = positionWidth * columns;

const stepTime = 200; // Miliseconds it takes for the chicken to take a step forward, backward, left or right

let lanes;
let currentLane;
let currentColumn;

let previousTimestamp;
let startMoving;
let moves;
let stepStartTimestamp;

const carFrontTexture = new Texture(40, 80, [{ x: 0, y: 10, w: 30, h: 60 }]);
const carBackTexture = new Texture(40, 80, [{ x: 10, y: 10, w: 30, h: 60 }]);
const carRightSideTexture = new Texture(110, 40, [
  { x: 10, y: 0, w: 50, h: 30 },
  { x: 70, y: 0, w: 30, h: 30 },
]);
const carLeftSideTexture = new Texture(110, 40, [
  { x: 10, y: 10, w: 50, h: 30 },
  { x: 70, y: 10, w: 30, h: 30 },
]);

const truckFrontTexture = new Texture(30, 30, [{ x: 15, y: 0, w: 10, h: 30 }]);
const truckRightSideTexture = new Texture(25, 30, [
  { x: 0, y: 15, w: 10, h: 10 },
]);
const truckLeftSideTexture = new Texture(25, 30, [
  { x: 0, y: 5, w: 10, h: 10 },
]);

const generateLanes = () =>
  [-11,-10,-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11]
    .map((index) => {
      const lane = new Lane(index);
      lane.mesh.position.y = index * positionWidth * zoom;
      scene.add(lane.mesh);
      return lane;
    })
    .filter((lane) => lane.index >= 0);

const addLane = () => {
  const index = lanes.length;
  const lane = new Lane(index);
  lane.mesh.position.y = index * positionWidth * zoom;
  scene.add(lane.mesh);
  lanes.push(lane);
};

let chicken = new Chicken(selectedCharacter);
scene.add(chicken);

hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
scene.add(hemiLight);

const initialDirLightPositionX = -100;
const initialDirLightPositionY = -100;
dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(initialDirLightPositionX, initialDirLightPositionY, 200);
dirLight.castShadow = true;
dirLight.target = chicken;
scene.add(dirLight);

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
var d = 500;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

// var helper = new THREE.CameraHelper( dirLight.shadow.camera );
// var helper = new THREE.CameraHelper( camera );
// scene.add(helper)

backLight = new THREE.DirectionalLight(0x000000, 0.4);
backLight.position.set(200, 200, 50);
backLight.castShadow = true;
scene.add(backLight);

const laneTypes = ["car", "truck", "forest"];
const laneSpeeds = [2, 2.5, 3];
const vechicleColors = [0xa52523, 0xbdb638, 0x78b14b];
const threeHeights = [20, 45, 60];

const initaliseValues = () => {
  lanes = generateLanes();

  currentLane = 0;
  currentColumn = Math.floor(columns / 2);

  previousTimestamp = null;

  startMoving = false;
  moves = [];
  stepStartTimestamp;

  chicken.position.x = 0;
  chicken.position.y = 0;

  camera.position.y = initialCameraPositionY;
  camera.position.x = initialCameraPositionX;

  dirLight.position.x = initialDirLightPositionX;
  dirLight.position.y = initialDirLightPositionY;
};

initaliseValues();

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Обработчик изменения размера окна для адаптации игрового поля
function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight + 50;
  
  // Обновляем размер рендерера
  renderer.setSize(width, height);
  
  // Определяем коэффициент масштабирования для мобильных устройств
  // На устройствах с шириной до 1024px увеличиваем поле зрения, чтобы показать больше контента
  const isMobile = width <= 1024;
  const scaleFactor = isMobile ? 1.4 : 1.0; // Увеличиваем поле зрения на 40% на мобильных
  
  // Обновляем параметры ортографической камеры с учетом масштабирования
  camera.left = (width / -2) * scaleFactor;
  camera.right = (width / 2) * scaleFactor;
  camera.top = (height / 2) * scaleFactor;
  camera.bottom = (height / -2) * scaleFactor;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', handleResize);
// Вызываем handleResize при инициализации для правильного применения масштабирования
handleResize();

// Предотвращение контекстного меню и выделения текста на сенсорных устройствах
const canvas = renderer.domElement;

// Предотвращение контекстного меню при правом клике мыши (десктоп)
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  return false;
});

// Дополнительная защита: блокировка правой кнопки мыши
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) { // Правая кнопка мыши
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
});

// Предотвращение выделения текста
canvas.addEventListener('selectstart', (e) => {
  e.preventDefault();
  return false;
});

// Предотвращение drag событий
canvas.addEventListener('dragstart', (e) => {
  e.preventDefault();
  return false;
});

// Дополнительная защита для touch событий
let touchStartTime = 0;
canvas.addEventListener('touchstart', (e) => {
  touchStartTime = Date.now();
  // Разрешаем touch события, но предотвращаем стандартное поведение браузера
  if (e.touches.length > 1) {
    e.preventDefault(); // Предотвращаем зум при мультитаче
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  // Предотвращаем контекстное меню только при длительном нажатии (более 500мс)
  const touchDuration = Date.now() - touchStartTime;
  if (touchDuration > 500) {
    e.preventDefault();
  }
}, { passive: false });

function Texture(width, height, rects) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(0,0,0,0.6)";
  rects.forEach((rect) => {
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
  });
  return new THREE.CanvasTexture(canvas);
}

function Wheel() {
  const wheel = new THREE.Mesh(
    new THREE.BoxBufferGeometry(12 * zoom, 33 * zoom, 12 * zoom),
    new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true })
  );
  wheel.position.z = 6 * zoom;
  return wheel;
}

function Car() {
  const car = new THREE.Group();
  const color =
    vechicleColors[Math.floor(Math.random() * vechicleColors.length)];

  const main = new THREE.Mesh(
    new THREE.BoxBufferGeometry(60 * zoom, 30 * zoom, 15 * zoom),
    new THREE.MeshPhongMaterial({ color, flatShading: true })
  );
  main.position.z = 12 * zoom;
  main.castShadow = true;
  main.receiveShadow = true;
  car.add(main);

  const cabin = new THREE.Mesh(
    new THREE.BoxBufferGeometry(33 * zoom, 24 * zoom, 12 * zoom),
    [
      new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        map: carBackTexture,
      }),
      new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        map: carFrontTexture,
      }),
      new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        map: carRightSideTexture,
      }),
      new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        map: carLeftSideTexture,
      }),
      new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }), // top
      new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }), // bottom
    ]
  );
  cabin.position.x = 6 * zoom;
  cabin.position.z = 25.5 * zoom;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  car.add(cabin);

  const frontWheel = new Wheel();
  frontWheel.position.x = -18 * zoom;
  car.add(frontWheel);

  const backWheel = new Wheel();
  backWheel.position.x = 18 * zoom;
  car.add(backWheel);

  car.castShadow = true;
  car.receiveShadow = false;

  return car;
}

function Truck() {
  const truck = new THREE.Group();
  const color =
    vechicleColors[Math.floor(Math.random() * vechicleColors.length)];

  const base = new THREE.Mesh(
    new THREE.BoxBufferGeometry(100 * zoom, 25 * zoom, 5 * zoom),
    new THREE.MeshLambertMaterial({ color: 0xb4c6fc, flatShading: true })
  );
  base.position.z = 10 * zoom;
  truck.add(base);

  const cargo = new THREE.Mesh(
    new THREE.BoxBufferGeometry(75 * zoom, 35 * zoom, 40 * zoom),
    new THREE.MeshPhongMaterial({ color: 0xb4c6fc, flatShading: true })
  );
  cargo.position.x = 15 * zoom;
  cargo.position.z = 30 * zoom;
  cargo.castShadow = true;
  cargo.receiveShadow = true;
  truck.add(cargo);

  const cabin = new THREE.Mesh(
    new THREE.BoxBufferGeometry(25 * zoom, 30 * zoom, 30 * zoom),
    [
      new THREE.MeshPhongMaterial({ color, flatShading: true }), // back
      new THREE.MeshPhongMaterial({
        color,
        flatShading: true,
        map: truckFrontTexture,
      }),
      new THREE.MeshPhongMaterial({
        color,
        flatShading: true,
        map: truckRightSideTexture,
      }),
      new THREE.MeshPhongMaterial({
        color,
        flatShading: true,
        map: truckLeftSideTexture,
      }),
      new THREE.MeshPhongMaterial({ color, flatShading: true }), // top
      new THREE.MeshPhongMaterial({ color, flatShading: true }), // bottom
    ]
  );
  cabin.position.x = -40 * zoom;
  cabin.position.z = 20 * zoom;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  truck.add(cabin);

  const frontWheel = new Wheel();
  frontWheel.position.x = -38 * zoom;
  truck.add(frontWheel);

  const middleWheel = new Wheel();
  middleWheel.position.x = -10 * zoom;
  truck.add(middleWheel);

  const backWheel = new Wheel();
  backWheel.position.x = 30 * zoom;
  truck.add(backWheel);

  return truck;
}

function Three() {
  const three = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.BoxBufferGeometry(15 * zoom, 15 * zoom, 20 * zoom),
    new THREE.MeshPhongMaterial({ color: 0x4d2926, flatShading: true })
  );
  trunk.position.z = 10 * zoom;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  three.add(trunk);

  height = threeHeights[Math.floor(Math.random() * threeHeights.length)];

  const crown = new THREE.Mesh(
    new THREE.BoxBufferGeometry(30 * zoom, 30 * zoom, height * zoom),
    new THREE.MeshLambertMaterial({ color: 0x7aa21d, flatShading: true })
  );
  crown.position.z = (height / 2 + 20) * zoom;
  crown.castShadow = true;
  crown.receiveShadow = false;
  three.add(crown);

  return three;
}

function Chicken(type = "giraffe") {
  const player = new THREE.Group();

  const makeLegs = (color, legZ = 5 * zoom, size = { x: 3, y: 3, z: 10 }) => {
    const legMaterial = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const legGeo = new THREE.BoxBufferGeometry(size.x * zoom, size.y * zoom, size.z * zoom);
    const legOffsetX = 5 * zoom;
    const legOffsetY = 4 * zoom;
    const legPositions = [
      { x: -legOffsetX, y: -legOffsetY },
      { x: legOffsetX, y: -legOffsetY },
      { x: -legOffsetX, y: legOffsetY },
      { x: legOffsetX, y: legOffsetY },
    ];
    legPositions.forEach((p) => {
      const leg = new THREE.Mesh(legGeo, legMaterial);
      leg.position.set(p.x, p.y, legZ);
      leg.castShadow = true;
      leg.receiveShadow = true;
      player.add(leg);
    });
  };

  if (type === "giraffe") {
    const body = new THREE.Mesh(
      new THREE.BoxBufferGeometry(15 * zoom, 12 * zoom, 12 * zoom),
      new THREE.MeshPhongMaterial({ color: 0xf0c060, flatShading: true })
    );
    body.position.z = 16 * zoom;
    body.castShadow = true;
    body.receiveShadow = true;
    player.add(body);

    makeLegs(0xcfa048);

    const neck = new THREE.Mesh(
      new THREE.BoxBufferGeometry(4 * zoom, 4 * zoom, 30 * zoom),
      new THREE.MeshLambertMaterial({ color: 0xf0c060, flatShading: true })
    );
    neck.position.set(6 * zoom, 5 * zoom, 31 * zoom);
    neck.castShadow = true;
    neck.receiveShadow = true;
    player.add(neck);

    const head = new THREE.Mesh(
      new THREE.BoxBufferGeometry(8 * zoom, 6 * zoom, 8 * zoom),
      new THREE.MeshPhongMaterial({ color: 0xf2c46f, flatShading: true })
    );
    head.position.set(6 * zoom, 8 * zoom, 40 * zoom);
    head.castShadow = true;
    head.receiveShadow = true;
    player.add(head);
  } else if (type === "lion") {
    const body = new THREE.Mesh(
      new THREE.BoxBufferGeometry(18 * zoom, 12 * zoom, 12 * zoom),
      new THREE.MeshPhongMaterial({ color: 0xd9923b, flatShading: true })
    );
    body.position.z = 14 * zoom;
    body.castShadow = true;
    body.receiveShadow = true;
    player.add(body);

    makeLegs(0xb5792f, 5 * zoom, { x: 3, y: 3, z: 9 });

    const head = new THREE.Mesh(
      new THREE.BoxBufferGeometry(10 * zoom, 10 * zoom, 10 * zoom),
      new THREE.MeshPhongMaterial({ color: 0xd9923b, flatShading: true })
    );
    head.position.set(6 * zoom, 6 * zoom, 20 * zoom);
    head.castShadow = true;
    head.receiveShadow = true;
    player.add(head);

    const mane = new THREE.Mesh(
      new THREE.BoxBufferGeometry(14 * zoom, 14 * zoom, 6 * zoom),
      new THREE.MeshLambertMaterial({ color: 0x8b4b1f, flatShading: true })
    );
    mane.position.set(6 * zoom, 6 * zoom, 20 * zoom);
    mane.castShadow = true;
    mane.receiveShadow = true;
    player.add(mane);
  } else if (type === "zebra") {
    const body = new THREE.Mesh(
      new THREE.BoxBufferGeometry(16 * zoom, 12 * zoom, 12 * zoom),
      new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true })
    );
    body.position.z = 15 * zoom;
    body.castShadow = true;
    body.receiveShadow = true;
    player.add(body);

    makeLegs(0xdddddd, 5 * zoom, { x: 3, y: 3, z: 10 });

    const head = new THREE.Mesh(
      new THREE.BoxBufferGeometry(8 * zoom, 6 * zoom, 8 * zoom),
      new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true })
    );
    head.position.set(6 * zoom, 6 * zoom, 22 * zoom);
    head.castShadow = true;
    head.receiveShadow = true;
    player.add(head);

    // simple stripe as a visual hint
    const stripe = new THREE.Mesh(
      new THREE.BoxBufferGeometry(2 * zoom, 12 * zoom, 12 * zoom),
      new THREE.MeshLambertMaterial({ color: 0x000000, flatShading: true })
    );
    stripe.position.set(0, 0, 15 * zoom);
    player.add(stripe);
  } else if (type === "hippo") {
    const body = new THREE.Mesh(
      new THREE.BoxBufferGeometry(20 * zoom, 14 * zoom, 12 * zoom),
      new THREE.MeshPhongMaterial({ color: 0x7b8aa0, flatShading: true })
    );
    body.position.z = 13 * zoom;
    body.castShadow = true;
    body.receiveShadow = true;
    player.add(body);

    makeLegs(0x6c7e94, 5 * zoom, { x: 4, y: 4, z: 8 });

    const head = new THREE.Mesh(
      new THREE.BoxBufferGeometry(10 * zoom, 9 * zoom, 9 * zoom),
      new THREE.MeshPhongMaterial({ color: 0x7b8aa0, flatShading: true })
    );
    head.position.set(6 * zoom, 4 * zoom, 18 * zoom);
    head.castShadow = true;
    head.receiveShadow = true;
    player.add(head);
  }

  return player;
}

function Road() {
  const road = new THREE.Group();

  const createSection = (color) =>
    new THREE.Mesh(
      new THREE.PlaneBufferGeometry(boardWidth * zoom, positionWidth * zoom),
      new THREE.MeshPhongMaterial({ color })
    );

  const middle = createSection(0x454a59);
  middle.receiveShadow = true;
  road.add(middle);

  const left = createSection(0x393d49);
  left.position.x = -boardWidth * zoom;
  road.add(left);

  const right = createSection(0x393d49);
  right.position.x = boardWidth * zoom;
  road.add(right);

  return road;
}

function Grass() {
  const grass = new THREE.Group();

  const createSection = (color) =>
    new THREE.Mesh(
      new THREE.BoxBufferGeometry(
        boardWidth * zoom,
        positionWidth * zoom,
        3 * zoom
      ),
      new THREE.MeshPhongMaterial({ color })
    );

  const middle = createSection(0xbaf455);
  middle.receiveShadow = true;
  grass.add(middle);

  const left = createSection(0x99c846);
  left.position.x = -boardWidth * zoom;
  grass.add(left);

  const right = createSection(0x99c846);
  right.position.x = boardWidth * zoom;
  grass.add(right);

  grass.position.z = 1.5 * zoom;
  return grass;
}

function Lane(index) {
  this.index = index;
  this.type =
    index <= 0
      ? "field"
      : laneTypes[Math.floor(Math.random() * laneTypes.length)];

  switch (this.type) {
    case "field": {
      this.type = "field";
      this.mesh = new Grass();
      break;
    }
    case "forest": {
      this.mesh = new Grass();

      this.occupiedPositions = new Set();
      this.threes = [1, 2, 3, 4].map(() => {
        const three = new Three();
        let position;
        do {
          position = Math.floor(Math.random() * columns);
        } while (this.occupiedPositions.has(position));
        this.occupiedPositions.add(position);
        three.position.x =
          (position * positionWidth + positionWidth / 2) * zoom -
          (boardWidth * zoom) / 2;
        this.mesh.add(three);
        return three;
      });
      break;
    }
    case "car": {
      this.mesh = new Road();
      this.direction = Math.random() >= 0.5;

      const occupiedPositions = new Set();
      this.vechicles = [1, 2, 3].map(() => {
        const vechicle = new Car();
        let position;
        do {
          position = Math.floor((Math.random() * columns) / 2);
        } while (occupiedPositions.has(position));
        occupiedPositions.add(position);
        vechicle.position.x =
          (position * positionWidth * 2 + positionWidth / 2) * zoom -
          (boardWidth * zoom) / 2;
        if (!this.direction) vechicle.rotation.z = Math.PI;
        this.mesh.add(vechicle);
        return vechicle;
      });

      this.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
      break;
    }
    case "truck": {
      this.mesh = new Road();
      this.direction = Math.random() >= 0.5;

      const occupiedPositions = new Set();
      this.vechicles = [1, 2].map(() => {
        const vechicle = new Truck();
        let position;
        do {
          position = Math.floor((Math.random() * columns) / 3);
        } while (occupiedPositions.has(position));
        occupiedPositions.add(position);
        vechicle.position.x =
          (position * positionWidth * 3 + positionWidth / 2) * zoom -
          (boardWidth * zoom) / 2;
        if (!this.direction) vechicle.rotation.z = Math.PI;
        this.mesh.add(vechicle);
        return vechicle;
      });

      this.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
      break;
    }
  }
}

if (retryButton) {
  retryButton.addEventListener("click", () => {
    // Блокируем рестарт до вызова GameReady API
    if (!gameReadyCalled) return;
    
    lanes.forEach((lane) => scene.remove(lane.mesh));
    initaliseValues();
    endDOM.style.visibility = "hidden";
    gameStarted = false;
    startDOM.style.visibility = "visible";
    scoreDOM.style.visibility = "hidden";
    if (restartButton) restartButton.style.display = "none";
    // Скрываем кнопки управления при возврате в меню
    if (controllsDOM) controllsDOM.style.display = "none";
    if (lastScoreDOM) lastScoreDOM.textContent = "";
    lastScoreValue = null;
    // Сброс индекса персонажа для навигации с пульта
    currentCharacterIndex = 0;
    // Синхронизация индекса с выбранным персонажем
    if (characterSelectDOM) {
      const characterButtons = characterSelectDOM.querySelectorAll(".character-option");
      characterButtons.forEach((el, index) => {
        if (el.classList.contains("selected")) {
          currentCharacterIndex = index;
        }
      });
    }
    // Сброс флага звука окончания игры
    gameOverSoundPlayed = false;
    // Остановка звука окончания игры
    if (gameOverSound) gameOverSound.stop();
    // Остановка звука трафика
    if (trafficSound) trafficSound.stop();
    // Фоновая музыка продолжает играть на стартовом экране
    // Сбрасываем флаг, чтобы музыка могла запуститься снова
    musicStarted = false;
    startBackgroundMusic();
  });
}

if (startButtonDOM) {
  startButtonDOM.addEventListener("click", async () => {
    // Блокируем запуск игры до вызова GameReady API
    if (!gameReadyCalled) return;
    
    // Убеждаемся, что звуки инициализированы при клике на старт
    if (!audioInitialized) {
      await initAudioOnInteraction();
      audioInitialized = true;
    }
    
    // Дополнительная проверка и инициализация звуков
    if (!jumpSound || !backgroundMusic || !trafficSound || !gameOverSound) {
      console.warn("[Audio] Некоторые звуки не инициализированы, пытаемся инициализировать...");
      if (audioBuffersLoaded) {
        initSounds();
      } else if (window._pendingAudioBuffers && audioContext) {
        await decodePendingBuffers();
        if (audioBuffersLoaded) {
          initSounds();
        }
      }
    }
    
    gameStarted = true;
    startDOM.style.visibility = "hidden";
    scoreDOM.style.visibility = "visible";
    counterDOM.innerHTML = 0;
    if (restartButton) restartButton.style.display = "block";
    // Показываем кнопки управления при начале игры
    if (controllsDOM) controllsDOM.style.display = "flex";
    // Сброс флага звука окончания игры для новой игры
    gameOverSoundPlayed = false;
    // Остановка звука окончания игры (если он еще играет)
    if (gameOverSound) gameOverSound.stop();
    // Фоновая музыка уже должна играть, но убеждаемся
    startBackgroundMusic();
    // Запуск звука трафика
    if (soundEnabled && trafficSound) {
      trafficSound.play();
    } else {
      console.warn("[Audio] trafficSound не воспроизведен:", {
        soundEnabled,
        hasTrafficSound: !!trafficSound,
        audioContext: !!audioContext,
        audioBuffersLoaded,
        hasPendingBuffers: !!window._pendingAudioBuffers
      });
    }
  });
}

if (restartButton) {
  restartButton.addEventListener("click", () => {
    // Блокируем рестарт до вызова GameReady API
    if (!gameReadyCalled) return;
    
    lanes.forEach((lane) => scene.remove(lane.mesh));
    initaliseValues();
    endDOM.style.visibility = "hidden";
    gameStarted = false;
    startDOM.style.visibility = "visible";
    scoreDOM.style.visibility = "hidden";
    restartButton.style.display = "none";
    // Скрываем кнопки управления при возврате в меню
    if (controllsDOM) controllsDOM.style.display = "none";
    if (lastScoreDOM) lastScoreDOM.textContent = "";
    lastScoreValue = null;
    // Сброс индекса персонажа для навигации с пульта
    currentCharacterIndex = 0;
    // Синхронизация индекса с выбранным персонажем
    if (characterSelectDOM) {
      const characterButtons = characterSelectDOM.querySelectorAll(".character-option");
      characterButtons.forEach((el, index) => {
        if (el.classList.contains("selected")) {
          currentCharacterIndex = index;
        }
      });
    }
    // Сброс флага звука окончания игры
    gameOverSoundPlayed = false;
    // Остановка звука окончания игры
    if (gameOverSound) gameOverSound.stop();
    // Остановка звука трафика
    if (trafficSound) trafficSound.stop();
    // Фоновая музыка продолжает играть на стартовом экране
    // Сбрасываем флаг, чтобы музыка могла запуститься снова
    musicStarted = false;
    startBackgroundMusic();
  });
}

// Character select events
if (characterSelectDOM) {
  characterSelectDOM.addEventListener("click", (e) => {
    // Блокируем выбор персонажа до вызова GameReady API
    if (!gameReadyCalled) return;
    
    const btn = e.target && (e.target.closest && e.target.closest(".character-option"));
    if (!btn || gameStarted) return;
    const type = btn.getAttribute("data-character");
    if (!type) return;
    selectedCharacter = type;
    // update UI selected state
    const all = characterSelectDOM.querySelectorAll(".character-option");
    all.forEach((el, index) => {
      el.classList.remove("selected");
      if (el === btn) {
        currentCharacterIndex = index; // Синхронизируем индекс при клике
      }
    });
    btn.classList.add("selected");
    // swap player mesh in scene
    scene.remove(chicken);
    chicken = new Chicken(selectedCharacter);
    chicken.position.set(0, 0, 0);
    scene.add(chicken);
    dirLight.target = chicken;
  });
  
  // Инициализация индекса при загрузке страницы
  const characterButtons = characterSelectDOM.querySelectorAll(".character-option");
  characterButtons.forEach((el, index) => {
    if (el.classList.contains("selected")) {
      currentCharacterIndex = index;
    }
  });
}

document
  .getElementById("forward")
  .addEventListener("click", () => {
    if (gameStarted) move("forward");
  });

document
  .getElementById("backward")
  .addEventListener("click", () => {
    if (gameStarted) move("backward");
  });

document.getElementById("left").addEventListener("click", () => {
  if (gameStarted) move("left");
});

document.getElementById("right").addEventListener("click", () => {
  if (gameStarted) move("right");
});

// Функция для навигации по меню выбора персонажа с помощью стрелок
function navigateCharacterMenu(direction) {
  if (!characterSelectDOM || gameStarted) return;
  
  const characterButtons = characterSelectDOM.querySelectorAll(".character-option");
  if (characterButtons.length === 0) return;
  
  if (direction === "left") {
    currentCharacterIndex = (currentCharacterIndex - 1 + characterButtons.length) % characterButtons.length;
  } else if (direction === "right") {
    currentCharacterIndex = (currentCharacterIndex + 1) % characterButtons.length;
  }
  
  // Обновляем визуальное выделение
  characterButtons.forEach((el, index) => {
    el.classList.toggle("selected", index === currentCharacterIndex);
  });
  
  // Обновляем выбранного персонажа
  const selectedButton = characterButtons[currentCharacterIndex];
  const type = selectedButton.getAttribute("data-character");
  if (type) {
    selectedCharacter = type;
    // Обновляем модель персонажа в сцене
    scene.remove(chicken);
    chicken = new Chicken(selectedCharacter);
    chicken.position.set(0, 0, 0);
    scene.add(chicken);
    dirLight.target = chicken;
  }
}

// Обработчик клавиатуры для поддержки ТВ-пульта и обычной клавиатуры
window.addEventListener("keydown", (event) => {
  const key = event.key;
  
  // Обработка кнопки Back (Escape)
  if (key === "Escape" || key === "Backspace") {
    if (gameStarted) {
      // Если игра запущена, можно добавить паузу или возврат в меню
      // Пока просто игнорируем
      return;
    } else if (endDOM.style.visibility === "visible") {
      // Если открыт экран окончания игры, возвращаемся в меню
      event.preventDefault();
      if (retryButton) retryButton.click();
    }
    return;
  }
  
  // Обработка Enter на экране окончания игры
  if (key === "Enter" && endDOM.style.visibility === "visible") {
    event.preventDefault();
    if (retryButton) retryButton.click();
    return;
  }
  
  // Если игра не запущена - обрабатываем меню
  if (!gameStarted) {
    // Обработка Enter на стартовом экране
    if (key === "Enter") {
      event.preventDefault();
      if (startButtonDOM && startDOM.style.visibility !== "hidden") {
        startButtonDOM.click();
      }
      return;
    }
    
    // Навигация по меню выбора персонажа стрелками
    if (key === "ArrowLeft") {
      event.preventDefault();
      navigateCharacterMenu("left");
      return;
    } else if (key === "ArrowRight") {
      event.preventDefault();
      navigateCharacterMenu("right");
      return;
    }
    
    // Если игра не запущена, не обрабатываем другие клавиши
    return;
  }
  
  // Обработка управления во время игры
  if (key === "ArrowUp" || key === "Up" || event.keyCode === 38) {
    event.preventDefault();
    move("forward");
  } else if (key === "ArrowDown" || key === "Down" || event.keyCode === 40) {
    event.preventDefault();
    move("backward");
  } else if (key === "ArrowLeft" || key === "Left" || event.keyCode === 37) {
    event.preventDefault();
    move("left");
  } else if (key === "ArrowRight" || key === "Right" || event.keyCode === 39) {
    event.preventDefault();
    move("right");
  }
});

function move(direction) {
  // Блокируем движение до вызова GameReady API
  if (!gameReadyCalled) return;
  
  const finalPositions = moves.reduce(
    (position, move) => {
      if (move === "forward")
        return { lane: position.lane + 1, column: position.column };
      if (move === "backward")
        return { lane: position.lane - 1, column: position.column };
      if (move === "left")
        return { lane: position.lane, column: position.column - 1 };
      if (move === "right")
        return { lane: position.lane, column: position.column + 1 };
    },
    { lane: currentLane, column: currentColumn }
  );

  if (direction === "forward") {
    if (
      lanes[finalPositions.lane + 1].type === "forest" &&
      lanes[finalPositions.lane + 1].occupiedPositions.has(
        finalPositions.column
      )
    )
      return;
    if (!stepStartTimestamp) startMoving = true;
    addLane();
  } else if (direction === "backward") {
    if (finalPositions.lane === 0) return;
    if (
      lanes[finalPositions.lane - 1].type === "forest" &&
      lanes[finalPositions.lane - 1].occupiedPositions.has(
        finalPositions.column
      )
    )
      return;
    if (!stepStartTimestamp) startMoving = true;
  } else if (direction === "left") {
    if (finalPositions.column === 0) return;
    if (
      lanes[finalPositions.lane].type === "forest" &&
      lanes[finalPositions.lane].occupiedPositions.has(
        finalPositions.column - 1
      )
    )
      return;
    if (!stepStartTimestamp) startMoving = true;
  } else if (direction === "right") {
    if (finalPositions.column === columns - 1) return;
    if (
      lanes[finalPositions.lane].type === "forest" &&
      lanes[finalPositions.lane].occupiedPositions.has(
        finalPositions.column + 1
      )
    )
      return;
    if (!stepStartTimestamp) startMoving = true;
  }
  moves.push(direction);
  // Воспроизведение звука прыжка
  if (soundEnabled && jumpSound) {
    jumpSound.play();
  } else {
    console.warn("[Audio] jumpSound не воспроизведен:", { soundEnabled, hasJumpSound: !!jumpSound });
  }
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (!previousTimestamp) previousTimestamp = timestamp;
  const delta = timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  // Animate cars and trucks moving on the lane
  lanes.forEach((lane) => {
    if (lane.type === "car" || lane.type === "truck") {
      const aBitBeforeTheBeginingOfLane =
        (-boardWidth * zoom) / 2 - positionWidth * 2 * zoom;
      const aBitAfterTheEndOFLane =
        (boardWidth * zoom) / 2 + positionWidth * 2 * zoom;
      lane.vechicles.forEach((vechicle) => {
        if (lane.direction) {
          vechicle.position.x =
            vechicle.position.x < aBitBeforeTheBeginingOfLane
              ? aBitAfterTheEndOFLane
              : (vechicle.position.x -= (lane.speed / 16) * delta);
        } else {
          vechicle.position.x =
            vechicle.position.x > aBitAfterTheEndOFLane
              ? aBitBeforeTheBeginingOfLane
              : (vechicle.position.x += (lane.speed / 16) * delta);
        }
      });
    }
  });

  if (startMoving) {
    stepStartTimestamp = timestamp;
    startMoving = false;
  }

  if (stepStartTimestamp) {
    const moveDeltaTime = timestamp - stepStartTimestamp;
    const moveDeltaDistance =
      Math.min(moveDeltaTime / stepTime, 1) * positionWidth * zoom;
    const jumpDeltaDistance =
      Math.sin(Math.min(moveDeltaTime / stepTime, 1) * Math.PI) * 8 * zoom;
    switch (moves[0]) {
      case "forward": {
        const positionY =
          currentLane * positionWidth * zoom + moveDeltaDistance;
        camera.position.y = initialCameraPositionY + positionY;
        dirLight.position.y = initialDirLightPositionY + positionY;
        chicken.position.y = positionY; // initial chicken position is 0

        chicken.position.z = jumpDeltaDistance;
        break;
      }
      case "backward": {
        positionY = currentLane * positionWidth * zoom - moveDeltaDistance;
        camera.position.y = initialCameraPositionY + positionY;
        dirLight.position.y = initialDirLightPositionY + positionY;
        chicken.position.y = positionY;

        chicken.position.z = jumpDeltaDistance;
        break;
      }
      case "left": {
        const positionX =
          (currentColumn * positionWidth + positionWidth / 2) * zoom -
          (boardWidth * zoom) / 2 -
          moveDeltaDistance;
        camera.position.x = initialCameraPositionX + positionX;
        dirLight.position.x = initialDirLightPositionX + positionX;
        chicken.position.x = positionX; // initial chicken position is 0
        chicken.position.z = jumpDeltaDistance;
        break;
      }
      case "right": {
        const positionX =
          (currentColumn * positionWidth + positionWidth / 2) * zoom -
          (boardWidth * zoom) / 2 +
          moveDeltaDistance;
        camera.position.x = initialCameraPositionX + positionX;
        dirLight.position.x = initialDirLightPositionX + positionX;
        chicken.position.x = positionX;

        chicken.position.z = jumpDeltaDistance;
        break;
      }
    }
    // Once a step has ended
    if (moveDeltaTime > stepTime) {
      switch (moves[0]) {
        case "forward": {
          currentLane++;
          counterDOM.innerHTML = currentLane;
          break;
        }
        case "backward": {
          currentLane--;
          counterDOM.innerHTML = currentLane;
          break;
        }
        case "left": {
          currentColumn--;
          break;
        }
        case "right": {
          currentColumn++;
          break;
        }
      }
      moves.shift();
      // If more steps are to be taken then restart counter otherwise stop stepping
      stepStartTimestamp = moves.length === 0 ? null : timestamp;
    }
  }

  // Hit test
  if (
    lanes[currentLane].type === "car" ||
    lanes[currentLane].type === "truck"
  ) {
    const chickenMinX = chicken.position.x - (chickenSize * zoom) / 2;
    const chickenMaxX = chicken.position.x + (chickenSize * zoom) / 2;
    const vechicleLength = { car: 60, truck: 105 }[lanes[currentLane].type];
    lanes[currentLane].vechicles.forEach((vechicle) => {
      const carMinX = vechicle.position.x - (vechicleLength * zoom) / 2;
      const carMaxX = vechicle.position.x + (vechicleLength * zoom) / 2;
      if (chickenMaxX > carMinX && chickenMinX < carMaxX) {
        const score = parseInt(counterDOM.innerHTML, 10) || 0;
        try {
          localStorage.setItem("lastScore", String(score));
        } catch (e) {}
        if (lastScoreDOM) {
          lastScoreValue = score;
          lastScoreDOM.textContent = translate("yourScore", { score });
          lastScoreDOM.style.display = "block";
        }
        endDOM.style.visibility = "visible";
        // Block controls and stop any ongoing movement after collision
        gameStarted = false;
        moves = [];
        stepStartTimestamp = null;
        startMoving = false;
        if (restartButton) restartButton.style.display = "none";
        // Скрываем кнопки управления при окончании игры
        if (controllsDOM) controllsDOM.style.display = "none";
        // Воспроизведение звука окончания игры (только один раз)
        if (!gameOverSoundPlayed && soundEnabled && gameOverSound) {
          gameOverSound.play();
          gameOverSoundPlayed = true; // Отмечаем, что звук уже воспроизведен
        } else {
          console.warn("[Audio] gameOverSound не воспроизведен:", { gameOverSoundPlayed, soundEnabled, hasGameOverSound: !!gameOverSound });
        }
        
        // Остановка фоновой музыки при столкновении
        if (backgroundMusic) backgroundMusic.stop();
        // Остановка звука трафика при столкновении
        if (trafficSound) trafficSound.stop();
      }
    });
  }
  renderer.render(scene, camera);
}

// Функция для вызова GameReady API после загрузки всех ресурсов
function callGameReady() {
  if (gameReadyCalled) return;
  gameReadyCalled = true;
  
  // Вызываем GameReady API перед тем, как игра станет доступной для игры
  if (yandexSDK && yandexSDK.features && yandexSDK.features.LoadingAPI) {
    try {
      yandexSDK.features.LoadingAPI.ready();
      console.log('GameReady API вызван');
    } catch (error) {
      console.log('Ошибка при вызове GameReady API:', error);
    }
  }
  
  // Показываем игровой интерфейс только после вызова GameReady API
  if (startDOM) {
    startDOM.style.visibility = "visible";
  }
  if (scoreDOM) {
    scoreDOM.style.visibility = "hidden";
  }
  if (endDOM) {
    endDOM.style.visibility = "hidden";
  }
}

// Ожидание загрузки всех ресурсов перед вызовом GameReady API
function waitForResourcesLoaded() {
  const resourcesToLoad = [];
  
  // Проверяем загрузку Web Audio буферов
  const audioLoadPromise = loadAllSounds().then((loadedBuffers) => {
    
    // Если AudioContext доступен и буферы декодированы, инициализируем звуки
    if (audioContext && audioBuffersLoaded) {
      initSounds();
    } else {
      console.log("[Audio] Звуки будут инициализированы при первом взаимодействии пользователя");
    }
  }).catch(error => {
    console.error("[Audio] Критическая ошибка при загрузке звуков:", error);
    console.error("[Audio] Stack trace:", error.stack);
  });
  resourcesToLoad.push(audioLoadPromise);
  
  // Проверяем загрузку изображений персонажей
  const characterImages = document.querySelectorAll('.character-option img');
  characterImages.forEach(img => {
    if (!img.complete) {
      const promise = new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 2000);
      });
      resourcesToLoad.push(promise);
    }
  });
  
  // Ждем загрузки всех ресурсов
  Promise.all(resourcesToLoad).then(() => {
    // Дополнительная небольшая задержка для полной инициализации 3D сцены
    setTimeout(() => {
      callGameReady();
    }, 100);
  }).catch(() => {
    // В случае ошибки все равно вызываем GameReady API
    setTimeout(() => {
      callGameReady();
    }, 100);
  });
  
  // Таймаут на случай, если загрузка затянется
  setTimeout(() => {
    if (!gameReadyCalled) {
      console.log('Таймаут загрузки ресурсов, вызываем GameReady API');
      callGameReady();
    }
  }, 3000);
}

// Скрываем интерфейс до загрузки всех ресурсов
if (startDOM) {
  startDOM.style.visibility = "hidden";
}
if (scoreDOM) {
  scoreDOM.style.visibility = "hidden";
}
if (endDOM) {
  endDOM.style.visibility = "hidden";
}

// Декодирование сохраненных буферов после инициализации AudioContext
async function decodePendingBuffers() {
  if (!window._pendingAudioBuffers) {
    return;
  }
  
  if (!audioContext) {
    return;
  }
  
  if (audioContext.state === 'closed') {
    return;
  }
  const pendingBuffers = window._pendingAudioBuffers;
  
  let decodedCount = 0;
  for (const [name, arrayBuffer] of Object.entries(pendingBuffers)) {
    if (arrayBuffer && !audioBuffers[name]) {
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        audioBuffers[name] = audioBuffer;
        decodedCount++;
      } catch (error) {
        console.error(`[Audio] Ошибка декодирования ${name}:`, error);
        audioBuffers[name] = null;
      }
    } else if (audioBuffers[name]) {
      decodedCount++;
    }
  }
  
  audioBuffersLoaded = true;
  delete window._pendingAudioBuffers;
}

// Инициализация AudioContext при первом взаимодействии пользователя
async function initAudioOnInteraction() {
  
  if (!audioContext) {
    initAudioContext();
    
    // Небольшая задержка для инициализации AudioContext
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Декодируем сохраненные буферы, если они есть
    await decodePendingBuffers();
    
    // Инициализируем звуки
    if (audioBuffersLoaded) {
      initSounds();
      if (soundEnabled) {
        startBackgroundMusic();
      }
    } else {
      console.warn("[Audio] Буферы еще не загружены! Проверяем _pendingAudioBuffers...");
      if (window._pendingAudioBuffers) {
        await decodePendingBuffers();
        if (audioBuffersLoaded) {
          initSounds();
          if (soundEnabled) {
            startBackgroundMusic();
          }
        }
      }
    }
  } else {
    // Восстанавливаем контекст, если он приостановлен
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
      });
    }
    
    // Декодируем сохраненные буферы, если они есть
    await decodePendingBuffers();
    
    // Переинициализируем звуки, если они еще не инициализированы
    if (audioBuffersLoaded && (!jumpSound || !backgroundMusic || !trafficSound || !gameOverSound)) {
      initSounds();
      if (soundEnabled) {
        startBackgroundMusic();
      }
    }
  }
}

// Флаг для отслеживания, была ли выполнена инициализация
let audioInitialized = false;

// Инициализируем AudioContext при первом взаимодействии (убираем once: true, чтобы можно было повторить)
function setupAudioOnInteraction() {
  if (!audioInitialized) {
    initAudioOnInteraction().then(() => {
      audioInitialized = true;
    }).catch(error => {
      console.error("[Audio] Ошибка при инициализации звуков:", error);
    });
  }
}

document.addEventListener("click", setupAudioOnInteraction, { once: true });
document.addEventListener("keydown", setupAudioOnInteraction, { once: true });
document.addEventListener("mousedown", setupAudioOnInteraction, { once: true });

// Также пытаемся инициализировать при загрузке страницы, если файлы уже загружены
window.addEventListener("load", () => {
  setTimeout(() => {
    if (!audioInitialized && window._pendingAudioBuffers) {
    }
  }, 1000);
});

// Запускаем ожидание загрузки ресурсов после инициализации сцены
waitForResourcesLoaded();

requestAnimationFrame(animate);

// Попытка запуска фоновой музыки на стартовом экране
// (может быть заблокирована браузером без взаимодействия пользователя)
//startBackgroundMusic();

// Запуск музыки при первом взаимодействии пользователя
document.addEventListener("click", () => {
  startBackgroundMusic();
}, { once: true });

document.addEventListener("keydown", () => {
  startBackgroundMusic();
}, { once: true });

// Также запускаем музыку при взаимодействии с кнопками
document.addEventListener("mousedown", () => {
  startBackgroundMusic();
}, { once: true });

// Флаги для отслеживания состояния звуков перед остановкой
let wasBackgroundMusicPlaying = false;
let wasTrafficSoundPlaying = false;
let isPausing = false; // Флаг для предотвращения одновременной остановки
let resumeTimeout = null; // Таймер для отмены возобновления

// Обработчик для переключения вкладок и сворачивания окна
function handlePageVisibilityChange() {
  const timestamp = new Date().toISOString();
  console.log(`[VisibilityChange] Событие вызвано в ${timestamp}`, {
    hidden: document.hidden,
    visibilityState: document.visibilityState,
    isPausing: isPausing,
    hasResumeTimeout: !!resumeTimeout
  });
  
  if (document.hidden || document.visibilityState === "hidden") {
    console.log(`[VisibilityChange] Страница скрыта - останавливаем звуки`);
    
    // Отменяем запланированное возобновление, если оно было
    if (resumeTimeout) {
      console.log(`[VisibilityChange] Отменяем запланированное возобновление`);
      clearTimeout(resumeTimeout);
      resumeTimeout = null;
    }
    
    // Предотвращаем повторную остановку, если уже идет процесс остановки
    if (isPausing) {
      console.log(`[VisibilityChange] Остановка уже идет, пропускаем`);
      return;
    }
    
    isPausing = true;
    console.log(`[VisibilityChange] Устанавливаем флаг isPausing = true`);
    
    // Сохраняем состояние звуков перед остановкой
    wasBackgroundMusicPlaying = backgroundMusic && backgroundMusic.isPlaying;
    wasTrafficSoundPlaying = trafficSound && trafficSound.isPlaying;
    console.log(`[VisibilityChange] Сохраняем состояние звуков:`, {
      wasBackgroundMusicPlaying: wasBackgroundMusicPlaying,
      wasTrafficSoundPlaying: wasTrafficSoundPlaying
    });
    
    // Останавливаем все звуки при сворачивании/переключении вкладки
    pauseAllSounds();
    
    // Приостанавливаем AudioContext для экономии ресурсов
    if (audioContext && audioContext.state !== 'suspended' && audioContext.state !== 'closed') {
      console.log(`[VisibilityChange] Приостанавливаем AudioContext (текущее состояние: ${audioContext.state})`);
      audioContext.suspend().then(() => {
        console.log(`[VisibilityChange] AudioContext приостановлен`);
      }).catch(err => {
        console.error("[VisibilityChange] Ошибка при приостановке AudioContext:", err);
      });
    } else {
      console.log(`[VisibilityChange] AudioContext не нужно приостанавливать (состояние: ${audioContext?.state})`);
    }
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      isPausing = false;
      console.log(`[VisibilityChange] Сбрасываем флаг isPausing = false`);
    }, 200);
  } else if (document.visibilityState === "visible") {
    console.log(`[VisibilityChange] Страница видна - возобновляем звуки`);
    
    // Отменяем предыдущее запланированное возобновление
    if (resumeTimeout) {
      console.log(`[VisibilityChange] Отменяем предыдущее запланированное возобновление`);
      clearTimeout(resumeTimeout);
    }
    
    // Возобновляем AudioContext при возврате на вкладку
    if (audioContext && audioContext.state === 'suspended') {
      console.log(`[VisibilityChange] Возобновляем AudioContext (текущее состояние: ${audioContext.state})`);
      audioContext.resume().then(() => {
        console.log(`[VisibilityChange] AudioContext возобновлен`);
        // Возобновляем звуки при возврате на вкладку (если звук включен)
        if (soundEnabled) {
          resumeAllSounds();
        } else {
          console.log(`[VisibilityChange] Звук отключен, не возобновляем`);
        }
      }).catch(err => {
        console.error("[VisibilityChange] Ошибка при возобновлении AudioContext:", err);
      });
    } else if (soundEnabled) {
      console.log(`[VisibilityChange] AudioContext уже активен (состояние: ${audioContext?.state}), возобновляем звуки`);
      // Если AudioContext уже активен, просто возобновляем звуки
      resumeAllSounds();
    } else {
      console.log(`[VisibilityChange] Звук отключен, не возобновляем`);
    }
  }
}

// Обработчик для сворачивания/разворачивания окна браузера
function handleWindowBlur() {
  const timestamp = new Date().toISOString();
  console.log(`[WindowBlur] Событие вызвано в ${timestamp}`, {
    isPausing: isPausing,
    hasResumeTimeout: !!resumeTimeout
  });
  
  // Отменяем запланированное возобновление, если оно было
  if (resumeTimeout) {
    console.log(`[WindowBlur] Отменяем запланированное возобновление`);
    clearTimeout(resumeTimeout);
    resumeTimeout = null;
  }
  
  // Предотвращаем повторную остановку, если уже идет процесс остановки
  if (isPausing) {
    console.log(`[WindowBlur] Остановка уже идет, пропускаем`);
    return;
  }
  
  isPausing = true;
  console.log(`[WindowBlur] Устанавливаем флаг isPausing = true`);
  
  // Сохраняем состояние звуков перед остановкой
  wasBackgroundMusicPlaying = backgroundMusic && backgroundMusic.isPlaying;
  wasTrafficSoundPlaying = trafficSound && trafficSound.isPlaying;
  console.log(`[WindowBlur] Сохраняем состояние звуков:`, {
    wasBackgroundMusicPlaying: wasBackgroundMusicPlaying,
    wasTrafficSoundPlaying: wasTrafficSoundPlaying
  });
  
  // Останавливаем все звуки при сворачивании окна
  pauseAllSounds();
  
  // Приостанавливаем AudioContext для экономии ресурсов
  if (audioContext && audioContext.state !== 'suspended' && audioContext.state !== 'closed') {
    console.log(`[WindowBlur] Приостанавливаем AudioContext (текущее состояние: ${audioContext.state})`);
    audioContext.suspend().then(() => {
      console.log(`[WindowBlur] AudioContext приостановлен`);
    }).catch(err => {
      console.error("[WindowBlur] Ошибка при приостановке AudioContext:", err);
    });
  } else {
    console.log(`[WindowBlur] AudioContext не нужно приостанавливать (состояние: ${audioContext?.state})`);
  }
  
  // Сбрасываем флаг через небольшую задержку
  setTimeout(() => {
    isPausing = false;
    console.log(`[WindowBlur] Сбрасываем флаг isPausing = false`);
  }, 200);
}

function handleWindowFocus() {
  const timestamp = new Date().toISOString();
  console.log(`[WindowFocus] Событие вызвано в ${timestamp}`, {
    hasResumeTimeout: !!resumeTimeout,
    audioContextState: audioContext?.state,
    soundEnabled: soundEnabled
  });
  
  // Отменяем предыдущее запланированное возобновление
  if (resumeTimeout) {
    console.log(`[WindowFocus] Отменяем предыдущее запланированное возобновление`);
    clearTimeout(resumeTimeout);
  }
  
  // Возобновляем AudioContext при разворачивании окна
  if (audioContext && audioContext.state === 'suspended') {
    console.log(`[WindowFocus] Возобновляем AudioContext (текущее состояние: ${audioContext.state})`);
    audioContext.resume().then(() => {
      console.log(`[WindowFocus] AudioContext возобновлен`);
      // Возобновляем звуки при разворачивании окна (если звук включен)
      if (soundEnabled) {
        resumeAllSounds();
      } else {
        console.log(`[WindowFocus] Звук отключен, не возобновляем`);
      }
    }).catch(err => {
      console.error("[WindowFocus] Ошибка при возобновлении AudioContext:", err);
    });
  } else if (soundEnabled) {
    console.log(`[WindowFocus] AudioContext уже активен (состояние: ${audioContext?.state}), возобновляем звуки`);
    // Если AudioContext уже активен, просто возобновляем звуки
    resumeAllSounds();
  } else {
    console.log(`[WindowFocus] Звук отключен, не возобновляем`);
  }
}

// Подписываемся на события видимости страницы
document.addEventListener("visibilitychange", handlePageVisibilityChange);

// Подписываемся на события сворачивания/разворачивания окна
window.addEventListener("blur", handleWindowBlur);
window.addEventListener("focus", handleWindowFocus);

// Функция для остановки всех звуков
function pauseAllSounds() {
  const timestamp = new Date().toISOString();
  console.log(`[pauseAllSounds] Вызвана в ${timestamp}`);
  
  // Проверяем состояние звуков перед остановкой
  const stateBefore = {
    backgroundMusic: backgroundMusic ? {
      exists: true,
      isPlaying: backgroundMusic.isPlaying,
      hasSource: !!backgroundMusic.source
    } : { exists: false },
    trafficSound: trafficSound ? {
      exists: true,
      isPlaying: trafficSound.isPlaying,
      hasSource: !!trafficSound.source
    } : { exists: false },
    jumpSound: jumpSound ? {
      exists: true,
      isPlaying: jumpSound.isPlaying,
      hasSource: !!jumpSound.source
    } : { exists: false },
    gameOverSound: gameOverSound ? {
      exists: true,
      isPlaying: gameOverSound.isPlaying,
      hasSource: !!gameOverSound.source
    } : { exists: false }
  };
  console.log(`[pauseAllSounds] Состояние звуков перед остановкой:`, stateBefore);
  
  // Принудительно останавливаем все звуки
  // Останавливаем независимо от состояния isPlaying, чтобы убедиться в полной остановке
  if (backgroundMusic) {
    console.log(`[pauseAllSounds] Останавливаем backgroundMusic`);
    backgroundMusic.stop();
  }
  if (trafficSound) {
    console.log(`[pauseAllSounds] Останавливаем trafficSound`);
    trafficSound.stop();
  }
  if (jumpSound) {
    console.log(`[pauseAllSounds] Останавливаем jumpSound`);
    jumpSound.stop();
  }
  if (gameOverSound) {
    console.log(`[pauseAllSounds] Останавливаем gameOverSound`);
    gameOverSound.stop();
  }
  
  // Небольшая задержка для гарантии полной остановки всех источников
  // Это предотвращает наложение звуков при быстром переключении
  setTimeout(() => {
    console.log(`[pauseAllSounds] Проверка через 50ms после остановки`);
    // Дополнительная проверка и остановка на случай, если что-то осталось
    const stillPlaying = [];
    if (backgroundMusic && backgroundMusic.isPlaying) {
      console.log(`[pauseAllSounds] backgroundMusic все еще играет, останавливаем снова`);
      stillPlaying.push('backgroundMusic');
      backgroundMusic.stop();
    }
    if (trafficSound && trafficSound.isPlaying) {
      console.log(`[pauseAllSounds] trafficSound все еще играет, останавливаем снова`);
      stillPlaying.push('trafficSound');
      trafficSound.stop();
    }
    if (jumpSound && jumpSound.isPlaying) {
      console.log(`[pauseAllSounds] jumpSound все еще играет, останавливаем снова`);
      stillPlaying.push('jumpSound');
      jumpSound.stop();
    }
    if (gameOverSound && gameOverSound.isPlaying) {
      console.log(`[pauseAllSounds] gameOverSound все еще играет, останавливаем снова`);
      stillPlaying.push('gameOverSound');
      gameOverSound.stop();
    }
    
    if (stillPlaying.length > 0) {
      console.warn(`[pauseAllSounds] ВНИМАНИЕ: Некоторые звуки все еще играют после остановки:`, stillPlaying);
    } else {
      console.log(`[pauseAllSounds] Все звуки успешно остановлены`);
    }
  }, 50);
}

// Функция для возобновления звуков
function resumeAllSounds() {
  const timestamp = new Date().toISOString();
  console.log(`[resumeAllSounds] Вызвана в ${timestamp}`, {
    soundEnabled: soundEnabled,
    gameStarted: gameStarted,
    wasBackgroundMusicPlaying: wasBackgroundMusicPlaying,
    wasTrafficSoundPlaying: wasTrafficSoundPlaying,
    hasResumeTimeout: !!resumeTimeout
  });
  
  // Отменяем предыдущее запланированное возобновление, если оно было
  if (resumeTimeout) {
    console.log(`[resumeAllSounds] Отменяем предыдущее запланированное возобновление`);
    clearTimeout(resumeTimeout);
    resumeTimeout = null;
  }
  
  // Добавляем небольшую задержку перед возобновлением, чтобы убедиться, что все звуки остановлены
  resumeTimeout = setTimeout(() => {
    resumeTimeout = null;
    console.log(`[resumeAllSounds] Выполняем возобновление через 150ms`);
    
    // Проверяем состояние звуков перед возобновлением
    const stateBeforeResume = {
      backgroundMusic: backgroundMusic ? {
        exists: true,
        isPlaying: backgroundMusic.isPlaying,
        hasSource: !!backgroundMusic.source
      } : { exists: false },
      trafficSound: trafficSound ? {
        exists: true,
        isPlaying: trafficSound.isPlaying,
        hasSource: !!trafficSound.source
      } : { exists: false }
    };
    console.log(`[resumeAllSounds] Состояние звуков перед возобновлением:`, stateBeforeResume);
    
    // Дополнительная проверка, что звуки действительно остановлены
    if (backgroundMusic && backgroundMusic.isPlaying) {
      console.warn(`[resumeAllSounds] ВНИМАНИЕ: backgroundMusic все еще играет перед возобновлением, останавливаем`);
      backgroundMusic.stop();
    }
    if (trafficSound && trafficSound.isPlaying) {
      console.warn(`[resumeAllSounds] ВНИМАНИЕ: trafficSound все еще играет перед возобновлением, останавливаем`);
      trafficSound.stop();
    }
    
    // Возобновляем фоновую музыку (если звук включен)
    // Фоновая музыка должна играть всегда, когда звук включен
    if (soundEnabled && backgroundMusic && !backgroundMusic.isPlaying) {
      console.log(`[resumeAllSounds] Возобновляем backgroundMusic`);
      backgroundMusic.play();
    } else {
      console.log(`[resumeAllSounds] backgroundMusic не возобновляем:`, {
        soundEnabled: soundEnabled,
        hasBackgroundMusic: !!backgroundMusic,
        isPlaying: backgroundMusic?.isPlaying
      });
    }
    
    // Возобновляем звук трафика, если игра запущена и он играл (если звук включен)
    if (gameStarted && soundEnabled && trafficSound && !trafficSound.isPlaying && wasTrafficSoundPlaying) {
      console.log(`[resumeAllSounds] Возобновляем trafficSound`);
      trafficSound.play();
    } else {
      console.log(`[resumeAllSounds] trafficSound не возобновляем:`, {
        gameStarted: gameStarted,
        soundEnabled: soundEnabled,
        hasTrafficSound: !!trafficSound,
        isPlaying: trafficSound?.isPlaying,
        wasTrafficSoundPlaying: wasTrafficSoundPlaying
      });
    }
  }, 150);
}