# DeepCode.Antifraud — PRD v0.8

**Дата:** 11 мая 2026  
**Статус:** Draft, hackathon edition — добавлена OpenAPI 3.1 спека для server-side helpers (см. companion `deepcode-antifraud-api-v0.1.yaml`)  
**Автор:** Konstantin Skobeltsyn (Deep-Code.AI / ООО Научная студия)  
**Deliverable:** работающий MVP к воскресенью  
**Питч-аудитория:** жюри хакатона; вторично — YC S26 / a16z Speedrun

---

## TL;DR

React-библиотека для поведенческого антифрод-скоринга, навешивающаяся на любое поддерево компонентов через декларативную обёртку `<DeepFraud>`. Мониторит поведение пользователя, окружение исполнения, контент DOM и среду рантайма; выдаёт непрерывный risk score с объяснимыми reason codes и триггерит challenge при подозрении. Целится в класс атак "социнженерия в процессе" (Social Engineering In Progress, SEIP), который классический транзакционный антифрод не видит.

**Differentiators:**
1. **SEIP detection** — orthogonal layer к существующему банковскому антифроду
2. **Declarative React API** — DX moat, не имитируется существующими SDK (Castle, Sift, Sardine — все imperative)
3. **Multi-layer interception** — DOM events + browser APIs + DOM content + runtime integrity + auth state
4. **Visual challenge с face count detection** — кол-во людей в кадре (детект shoulder surfing) + liveness, через MediaPipe in-browser
5. **Session/cookie injection detection** — ловит session takeover и replay атаки, когда токен появился в браузере за секунды до транзакции
6. **Privacy-first** — metadata-only by default, raw данные не покидают устройство
7. **Explainable scoring** — reason codes, не black-box, регулятор-compatible

---

## 1. Проблема

В CIS-банкинге в 2025–2026 топовый вектор фрода — Authorized Push Payment (APP) под социнженерным давлением:

- "Служба безопасности банка" по телефону → жертва переводит сама
- "Безопасный счёт ЦБ" → жертва переводит сама  
- Дипфейк голоса родственника → жертва переводит сама
- Spoofed caller ID совпадает с реальным номером банка

Классический антифрод (Falcon, SAS, R-Style, NICE Actimize) проверяет **транзакцию**: сумма, получатель, риск-скор счёта-получателя. Но в SEIP всё легитно с транзакционной точки зрения: свой девайс, свой биометрический логин, свой OTP. Транзакционный антифрод слепнет.

Нужна **проверка состояния пользователя в момент транзакции**:
- Под давлением ли он сейчас?
- Его ли это поведение?  
- Видит ли он сейчас то, что должен видеть, или его манипулируют контентом?
- В нормальной ли среде исполняется приложение?

Из брифа хакатона: *"Банки хотят внедрять поведенческую антифрод-защиту, но не знают, какие именно признаки и модели реально работают быстро и без больших бэкендов."*

---

## 2. Решение

Декларативная React-обёртка `<DeepFraud>`. Один компонент покрывает четыре слоя детекции:

1. **DOM events** — keystroke, pointer, touch, paste, scroll, focus, submit (capture-phase event delegation на корневом узле)
2. **Browser APIs** — fetch/XHR/WebSocket, clipboard, getUserMedia, localStorage, History (monkey-patch с allow-list на старте)
3. **DOM content** — MutationObserver + weighted regex по русским SE-паттернам
4. **Runtime integrity** — детект патчинга native функций, DevTools, WebDriver, root/jailbreak

Выдаёт:
- Непрерывный `score: 0..100` через `onScore(score, breakdown)` для live-визуализации
- `onDecision({ level: 'monitor' | 'step_up' | 'block', reasons })` при пересечении порога
- Опциональный встроенный challenge через `challengeRenderer` slot

---

## 3. Цели и non-goals

### Цели хакатона

- `<DeepFraud>` React-компонент с типизированным API
- 45 транзакционных факторов в семи категориях (см. §8) включая behavioral interaction, content threats, runtime integrity, identity & context, server-side helpers, mobile sensors + visual challenge signals (см. §14.1 для приоритизации live/mock/paper)
- Live risk meter в демо-приложении
- **Visual challenge с детекцией количества людей в кадре** (1 — пропуск, 0 или 2+ — block) — anti-shoulder-surfing
- Три challenge mechanisms: recall question + face count check + face liveness — все рабочие, не stubs
- ONNX-инференс в браузере для двух моделей: keystroke dynamics (обучена на CMU dataset) + phishing URL (urlbert-tiny-v4)
- Face analytics через MediaPipe FaceLandmarker в challenge-mode (включается на step_up, разовый camera permission)
- Два side-by-side демо-сценария: нормальный платёж vs SEIP-сценарий
- Storybook как презентационная поверхность
- p95 latency <1 сек от события до решения (без учёта первой загрузки ML моделей)
- Core+react сборка <100KB gzipped; ML модели lazy-loaded
- Все зависимости — non-toxic permissive (MIT/Apache-2.0/BSD/ISC)

### Non-goals

- Mobile-native (React Native / iOS / Android)
- Synthetic identity / KYC onboarding
- Mule graph analysis (DGL/PyG backend)
- Production server SDK (только заглушка)
- Multi-tenancy
- Compliance docs (152-ФЗ / GDPR)
- Полноценная NLP-модель для русских SE-паттернов (regex + веса достаточно)
- Voice biometrics / read-aloud challenge
- Passive face/camera monitoring (face analytics только в challenge-mode, не постоянное наблюдение)
- Custom training pipeline для phishing URL (используем готовый urlbert-tiny-v4)

---

## 4. Целевая аудитория

| Stakeholder | Описание | Что им важно |
|---|---|---|
| **Покупатель (B2B)** | Антифрод-команда банка, 5–15 человек, репортит CISO. В CIS: Сбер, Тинькофф, ВТБ, Альфа. В РУз: Asia Alliance Bank, NBU, Trustbank. В KZ: Kaspi, Halyk. | False-positive rate, объяснимость, интеграция в существующий стек |
| **Интегратор** | Frontend dev team банка (React/Vue/Angular) | Простота интеграции, размер бандла, не ломает существующую функциональность |
| **Конечный пользователь** | Клиент банка | Прозрачность challenge, не вызывает frustration на легитимных операциях |
| **Регулятор** | ЦБ РФ, ЦБ РУз, НБК | Объяснимость решений, соответствие 152-ФЗ / GDPR |

---

## 5. Демо-сценарии

Демо — две `<DeepFraud>`-обёртки на идентичной платёжной форме в Storybook, питающиеся разными потоками событий.

### Сценарий A: Анна оплачивает коммуналку (легитный)

| Step | Action | Signal |
|---|---|---|
| 1 | Тапает по сохранённому получателю "УК Жилкомсервис" | Known recipient |
| 2 | Вводит сумму 4 380 ₽ (P50 коммунальных) | Amount in range |
| 3 | Читает экран подтверждения 4 сек | Warning dwell OK |
| 4 | Подтверждает Touch ID | — |

**Risk meter:** растёт до 8, остаётся → **`allow`** без challenge.

### Сценарий B: Бабушку Марию разводит "служба безопасности" (SEIP)

| Step | Action | Signal | Score delta |
|---|---|---|---|
| 0 | В WhatsApp Web в соседней вкладке (mic активен) | `concurrent_media` | +35 |
| 1 | Тапает "Новый получатель" | `new_recipient` | +25 |
| 2 | Вставляет IBAN из clipboard | `copy_paste_recipient` | +40 |
| 3 | Вводит 87 000 ₽ (top decile её истории) | Amount anomaly (server) | +15 |
| 4 | В DOM появляется уведомление "Это безопасный счёт ЦБ для защиты ваших средств" + ссылка на фишинговый домен | `phishing_text_dom` + `phishing_url` (urlbert-tiny через ONNX) | +50 (capped) |
| 5 | Скипает warning за 0.7 сек | `warning_dwell` | +20 |
| 6 | Длинные паузы между keystrokes (её инструктируют) | `keystroke_dynamics` ONNX-модель flags anomaly | +25 |

**Risk meter:** 0 → 25 → 50 → 75 → 90  
**На 60 триггерится:** `step_up` → запуск visual challenge (camera permission ask)  
**Challenge stage 1:** Face presence check — MediaPipe FaceLandmarker детектит количество лиц в кадре  
**Challenge stage 2 (если 1 face):** Face liveness — moргание + микро-движения (анти-фото-атака)  
**Challenge stage 3 (если liveness OK):** Recall question по реальной истории транзакций

В демо-сценарии B камера показывает **второе лицо** (скаммер заглядывает через плечо или жертва передала телефон) — challenge fails на stage 1, транзакция блокируется с reason `shoulder_surfing_detected`.

Альтернативная демо-ветка: только бабушка в кадре, проходит stage 1+2, fails на recall question → `block`.

Каждый шаг визуализируется в Storybook с подписями reason codes.

---

## 6. Архитектура

```
┌────────────────────────────────────────────────────────┐
│         Bank's web app (React/Vue/Angular)             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  <DeepFraudRoot> (page-global setup)             │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  <DeepFraud scope="transaction">           │  │  │
│  │  │      <PaymentForm />                       │  │  │
│  │  │  </DeepFraud>                              │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
             │            │            │           │
        DOM events   Patched APIs  MutObserver  Runtime
         (Layer 1)    (Layer 2)    (Layer 3)   integrity
             │            │            │           │
             └────────────┴────────────┴───────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            Feature collectors    ONNX inference engine
                    │              (lazy-loaded)
                    │           ┌──────┴──────┐
                    │           │             │
                    │      keystroke      urlbert-tiny
                    │      classifier      (phishing URL)
                    │           │             │
                    └───────────┴─────────────┘
                              │
                    Feature vector builder
                              │
                  ┌───────────┴───────────┐
                  │                       │
            Rule engine          Server helpers
       (json-rules-engine)     (race, timeout)
                  │                       │
                  └───────────┬───────────┘
                              │
                         Decision
                  (score + reasons + level)
                              │
                  ┌───────────┴───────────┐
                  │                       │
              onScore                 onDecision
       (continuous, live)         (threshold crossed)
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                       challengeRenderer        Visual challenge
                       (recall question)       (MediaPipe Face)
```

### Пакеты

| Пакет | Содержание | Размер |
|---|---|---|
| `@deepcode/antifraud-core` | vanilla TS engine, signal collectors, rule runtime, feature vector builder | ~30KB gz |
| `@deepcode/antifraud-react` | `<DeepFraudRoot>`, `<DeepFraud>`, `useDeepFraud()`, `challengeRenderer` slot | ~10KB gz |
| `@deepcode/antifraud-ml` | ONNX Runtime wrappers + model loaders (keystroke, phishing URL) | ~5KB gz (модели lazy-loaded с CDN/static, см. §13) |
| `@deepcode/antifraud-visual` | MediaPipe FaceLandmarker wrapper для challenge mode | ~8KB gz + MediaPipe runtime lazy-loaded |
| `@deepcode/antifraud-demo` | Storybook + два сценария + risk meter | dev-only |

Для хакатона все живут в одном monorepo через npm workspaces.

---

## 7. API

```ts
// === Root (page-global setup) ===
interface DeepFraudRootProps {
  userId?: string;
  consent: 'minimal' | 'behavioral' | 'biometric';
  thresholds?: { monitor: number; step_up: number; block: number };
  servers?: ServerHelper[];
  children: ReactNode;
}

// === Scope (per-transaction or per-section) ===
interface DeepFraudProps {
  scope: 'session' | 'transaction' | 'field';
  factors: Factor[];
  onScore?: (score: number, breakdown: ScoreBreakdown) => void;
  onDecision?: (decision: Decision) => void;
  challengeRenderer?: (challenge: Challenge) => ReactNode;
  children: ReactNode;
}

// === Typed factor configuration (45 factors across 6 categories) ===
type Factor =
  // — 8.1 Behavioral interaction (14)
  | { kind: 'copy_paste_recipient' }
  | { kind: 'keystroke_dynamics'; baseline: 'local' | 'server'; engine?: 'manhattan' | 'onnx' }
  | { kind: 'pointer_pattern' }
  | { kind: 'page_visibility'; oscillationThreshold?: number; absenceMs?: number }
  | { kind: 'warning_dwell'; minMs?: number }
  | { kind: 'form_fill_order'; expectedOrder?: string[] }
  | { kind: 'focus_loss_during_input'; minPauseMs?: number }
  | { kind: 'back_navigation_pattern'; maxBackEvents?: number }
  | { kind: 'double_submit_attempts'; window?: 'session' | 'form' }
  | { kind: 'decision_latency'; minMs?: number; maxMs?: number }
  | { kind: 'idle_in_form'; maxIdleMs?: number }
  | { kind: 'back_button_during_warning' }
  | { kind: 'confirmation_hesitation'; maxHovers?: number }
  | { kind: 'text_input_in_amount_field' }

  // — 8.2 Content threats (3)
  | { kind: 'phishing_text_dom' }
  | { kind: 'phishing_url'; modelUrl?: string; threshold?: number }
  | { kind: 'clipboard_otp_pattern'; digitCount?: number }

  // — 8.3 Runtime integrity (8)
  | { kind: 'native_tampering' }
  | { kind: 'dev_environment' }
  | { kind: 'environment_conflicts'; checks?: ConflictCheck[] }
  | { kind: 'client_environment'; eolBrowserMonths?: number; emit?: 'always' | 'on_anomaly' }
  | { kind: 'recent_token_injection'; watchKeys?: string[]; snapshotOnInit?: boolean }
  | { kind: 'csp_violation_count'; threshold?: number }
  | { kind: 'sri_violation' }
  | { kind: 'client_clock_skew'; maxSkewMs?: number }

  // — 8.4 Identity & context (3)
  | { kind: 'bot_detection' }
  | { kind: 'concurrent_media' }
  | { kind: 'parallel_session'; channels?: ('mobile' | 'web' | 'atm')[] }

  // — 8.5 Server-side helpers (14)
  | { kind: 'new_recipient'; cooldownHours?: number }
  | { kind: 'amount_anomaly'; percentile?: number }
  | { kind: 'time_of_day_anomaly' }
  | { kind: 'velocity_anomaly'; windowMs?: number; maxActions?: number }
  | { kind: 'recipient_velocity'; lookbackHours?: number }
  | { kind: 'recipient_account_age'; minDays?: number }
  | { kind: 'geoip_jump'; maxKmPerHour?: number }
  | { kind: 'time_since_login'; minMs?: number; maxMs?: number }
  | { kind: 'tls_fingerprint' }
  | { kind: 'request_idempotency_breach' }
  | { kind: 'recent_password_change'; lookbackHours?: number }
  | { kind: 'recent_contact_change'; lookbackHours?: number }
  | { kind: 'device_id_per_user_ratio'; maxAccounts?: number }
  | { kind: 'shared_recipient_graph'; lookbackHours?: number }
  | { kind: 'incoming_call_correlation'; windowMs?: number }  // mobile-only

  // — 8.6 Sensors (mobile web only) (2)
  | { kind: 'device_motion'; sensitivity?: 'low' | 'med' | 'high' }
  | { kind: 'screen_orientation_change' }

  // — 8.8 Session-level (1)
  | { kind: 'device_fingerprint' };

// Конкретные проверки для environment_conflicts
type ConflictCheck =
  | 'ua_platform_vs_navigator_platform'
  | 'ua_os_vs_webgl_renderer'
  | 'ua_mobile_vs_touch_capability'
  | 'timezone_vs_accept_language'
  | 'webrtc_ip_vs_http_ip'
  | 'ua_version_vs_feature_set'
  | 'screen_resolution_vs_device_class'
  | 'languages_array_vs_accept_language'
  | 'vendor_vs_ua_browser'
  | 'fonts_list_vs_os'
  | 'audio_context_fingerprint_consistency'
  | 'plugins_legacy_consistency';

type ServerHelper = {
  name: string;
  fetch: (ctx: SignalContext) => Promise<Partial<FeatureContribution>>;
  timeoutMs: number;
  cacheTtlMs?: number;
  failureMode: 'ignore' | 'fail-open' | 'fail-closed';
};

type Decision = {
  level: 'ok' | 'monitor' | 'step_up' | 'block';
  score: number;
  reasons: Array<{ code: string; contribution: number; meta?: object }>;
  ts: number;
};

type Challenge =
  | { kind: 'recall_question'; question: string; options: string[]; correctIndex: number }
  | { kind: 'face_presence'; expectedFaceCount: 1; timeoutMs?: number }
  | { kind: 'face_liveness'; checks: Array<'blink' | 'micro_movement' | 'head_turn'> }
  | { kind: 'read_aloud'; phrase: string }
  | { kind: 'on_call_question' };

// === Challenge pipeline (cascading) ===
type ChallengePipeline = Challenge[];   // выполняются последовательно
                                        // fail на любом → block
```

### Пример использования

```tsx
<DeepFraudRoot userId="user-123" consent="behavioral">
  <App>
    <Routes>
      <Route path="/pay" element={
        <DeepFraud
          scope="transaction"
          factors={[
            { kind: 'copy_paste_recipient' },
            { kind: 'concurrent_media' },
            { kind: 'warning_dwell', minMs: 1500 },
            { kind: 'keystroke_dynamics', baseline: 'local' },
            { kind: 'phishing_text_dom' },
            { kind: 'native_tampering' },
            { kind: 'bot_detection' },
            { kind: 'pointer_pattern' },
            { kind: 'dev_environment' },
            { kind: 'device_fingerprint' }
          ]}
          onScore={(s, b) => riskMeter.update(s, b)}
          onDecision={(d) => {
            if (d.level === 'step_up') showRecallChallenge();
            if (d.level === 'block') blockTransaction(d.reasons);
          }}
          challengeRenderer={(c) => <RecallChallenge challenge={c} />}
        >
          <PaymentForm />
        </DeepFraud>
      } />
    </Routes>
  </App>
</DeepFraudRoot>
```

---

## 8. Каталог факторов (45 transaction + 1 session + 3 visual challenge)

Сгруппировано по категориям для удобства навигации. Каждый возвращает `contribution: 0..weight` в общий score. Финальный score нормализуется к 0..100 через **sum-with-cap + top-K aggregation** (топ-7 факторов по вкладу) — в production калибруется на real-data.

> **Calibration note:** при сумме max весов >1000 наивная мин-макс нормализация недооценивает single-factor события. Top-K aggregation решает эту проблему: реальная транзакция активирует 2–7 факторов, score = (sum of top 7 contributions) / (sum of top 7 max weights) × 100. На хакатоне используем именно эту формулу.

### 8.1 Behavioral interaction (14 факторов)

DOM-level сигналы поведения пользователя в форме. Дешёвая реализация, кросс-фреймворковая, без серверной зависимости.

| Kind | Max weight | Что детектит | Implementation |
|---|---|---|---|
| `copy_paste_recipient` | 40 | Вставка реквизитов получателя из буфера | `paste` event capture |
| `keystroke_dynamics` | 30 | Тайминги нажатий не соответствуют шаблону | ONNX (CMU dataset) + scaled Manhattan fallback |
| `pointer_pattern` | 20 | Линейные/хаотичные movements курсора | Curvature + jerk analysis |
| `page_visibility` | 25 | Frequent blur/focus, long absence + immediate action | `visibilitychange` + `blur/focus` |
| `warning_dwell` | 20 | Warning экран dwell <minMs | IntersectionObserver + timer |
| `form_fill_order` | 20 | Поля заполнены не в визуальном порядке (скаммер диктует) | Track focus order vs DOM tab-order |
| `focus_loss_during_input` | 20 | Поле теряет focus посреди ввода (слушает инструкцию) | `blur` event + buffer state |
| `back_navigation_pattern` | 15 | Юзер возвращается назад ≥3 раз в потоке | History API + counter |
| `double_submit_attempts` | 10 | Повторные клики на "Подтвердить" | Click handler debounce + counter |
| `decision_latency` | 15 | Время от показа опций до выбора аномально длинное или короткое | Timestamp от render до click |
| `idle_in_form` | 15 | Пауза >maxIdleMs внутри формы | activity timer |
| `back_button_during_warning` | 25 | Тапнул назад на warning → вернулся → подтвердил (скаммер уговорил) | History API + warning state |
| `confirmation_hesitation` | 15 | ≥maxHovers ховеров на "Подтвердить" перед кликом | mouseover counter |
| `text_input_in_amount_field` | 30 | Юзер вписал текст в amount поле (bypass валидации) | input event content type |

### 8.2 Content threats (3 фактора)

Анализ контента, который видит/использует пользователь.

| Kind | Max weight | Что детектит | Implementation |
|---|---|---|---|
| `phishing_text_dom` | 60 | SE-фразы в DOM (push, in-app сообщения, чат) | MutationObserver + 30 regex весов |
| `phishing_url` | 40 | Фишинговый URL в DOM/clipboard | ONNX urlbert-tiny-v4 (15MB lazy) |
| `clipboard_otp_pattern` | 50 | В clipboard 4–6 цифр перед submit (юзер скопировал OTP для скаммера) | `navigator.clipboard.readText` + regex `^\d{4,6}$` |

### 8.3 Runtime integrity (8 факторов)

Среда исполнения, патчинг, целостность кода.

| Kind | Max weight | Что детектит | Implementation |
|---|---|---|---|
| `native_tampering` | 40 | Native функции запатчены вне allow-list | `.toString()` snapshots |
| `dev_environment` | 15 | DevTools открыт OR `navigator.webdriver=true` | devtools-detect + webdriver flag |
| `environment_conflicts` | 35 | Внутренние противоречия в client fingerprint | 12 cross-checks |
| `client_environment` | 15 | Outdated/EOL/необычный браузер или OS | UA parse + caniuse EOL data |
| `recent_token_injection` | 40 | Session/auth токен изменился <60s назад вне normal flow | Cookie/storage diff |
| `csp_violation_count` | 20 | Content Security Policy violations | `securitypolicyviolation` event listener |
| `sri_violation` | 40 | Subresource Integrity hash mismatch | Native browser event на `<script integrity>` |
| `client_clock_skew` | 20 | `Date.now()` сильно отличается от server time (>5 мин) | timestamp в `ServerHelper` ответе |

### 8.4 Identity & context (3 фактора)

Идентификация бот vs человек, мультимедиа контекст.

| Kind | Max weight | Что детектит | Implementation |
|---|---|---|---|
| `bot_detection` | 50 | Selenium/Puppeteer/Playwright/headless | BotD library |
| `concurrent_media` | 35 | Активен мик/камера в другой вкладке/приложении | patched `getUserMedia` + `enumerateDevices` polling |
| `parallel_session` | 40 | Юзер активен в другом канале (mobile app в другой geo одновременно) | server helper |

### 8.5 Server-side helpers (14 факторов)

Требуют серверного контекста (история транзакций, граф получателей, AML базы). На хакатоне — **мокаются**, см. §14.1. **Контракт между SDK и бэкендом банка формализован в OpenAPI 3.1 спеке `deepcode-antifraud-api-v0.1.yaml`** (companion файл).

| Kind | Max weight | Что детектит | Implementation |
|---|---|---|---|
| `new_recipient` | 25 | Получатель появился <cooldownHours назад | server helper |
| `amount_anomaly` | 30 | Сумма в верхнем перцентиле личной истории | server helper (percentile P95+) |
| `time_of_day_anomaly` | 20 | Транзакция в нехарактерный час | server helper (per-user histogram) |
| `velocity_anomaly` | 25 | N действий за M минут (заменяет старый `session_velocity`) | server helper |
| `recipient_velocity` | 35 | Получатель получил много переводов за lookback (mule pattern) | server helper |
| `recipient_account_age` | 20 | Счёт получателя открыт <minDays назад | server helper |
| `geoip_jump` | 30 | IP location сменился >maxKmPerHour (impossible travel) | server helper |
| `time_since_login` | 15 | Слишком быстро после логина (<minMs) ИЛИ слишком долго (>maxMs) | session timestamp |
| `tls_fingerprint` | 30 | TLS JA3/JA4 не совпадает с UA-заявленным браузером | server helper (computed на edge) |
| `request_idempotency_breach` | 25 | Один payment hash отправлен N раз — retry-loop | server helper |
| `recent_password_change` | 35 | Пароль менялся <lookbackHours (SIM-swap pattern) | server helper |
| `recent_contact_change` | 30 | Phone/email менялись <lookbackHours | server helper |
| `device_id_per_user_ratio` | 50 | Одно устройство ассоциировано с >maxAccounts разными аккаунтами (mule farm) | server helper / graph query |
| `shared_recipient_graph` | 35 | Получатель получал от других юзеров за lookback (mule pattern) | server helper / graph query |
| `incoming_call_correlation` | 40 | Входящий звонок от unknown number за window до транзакции | mobile-only (TelephonyManager) |

### 8.6 Sensors (mobile web) (2 фактора)

Доступны только на mobile-web (browsers с DeviceMotion API). На desktop возвращают `not applicable`.

| Kind | Max weight | Что детектит | Implementation |
|---|---|---|---|
| `device_motion` | 25 | Телефон в наклоне = phone-at-ear (звонок), горизонталь = в руке | `DeviceMotionEvent` (требует HTTPS + permission на iOS 13+) |
| `screen_orientation_change` | 10 | Поворот экрана во время транзакции | `screen.orientation` events |

### 8.7 Visual challenge signals (challenge-mode, 3 сигнала)

Срабатывают **только** при step_up challenge, не транзакционные factors. См. PRD §10.

| Сигнал | Реализация | Что детектит |
|---|---|---|
| `face_count_check` | MediaPipe FaceLandmarker, 2–3 сек | Кол-во людей в кадре. 0 → block (user_not_present); 1 → pass; **2+ → block (shoulder_surfing_detected)** |
| `face_liveness_blink` | MediaPipe eye landmarks, 5 сек | Минимум одно моргание → pass; иначе → block |
| `face_liveness_movement` | Nose tip landmark | >2px смещение за 1 сек окно → pass; иначе → block |

### 8.8 Session-level (не суммируются в transaction score)

Влияют на login risk / force re-auth, не на конкретную транзакцию.

| Kind | Max weight (session) | Что детектит |
|---|---|---|
| `device_fingerprint` | 30 | ThumbmarkJS hash не совпадает с историей userId |

### Веса русских SE-паттернов (factor `phishing_text_dom`)

| Pattern (regex) | Weight | Reason code |
|---|---|---|
| `служб[аы] безопасности (банк\|сбер\|тинькоф)` | 35 | `fake_bank_security` |
| `безопасн(ый\|ого) (счёт\|счет\|ячейк)` | 60 | `safe_account_scam` |
| `(центробанк\|ЦБ РФ\|ЦБ).*(ячейк\|резерв)` | 45 | `fake_cb_authority` |
| `оформил[аи]?\s+(на вас\s+)?кредит` | 40 | `fake_loan_pretext` |
| `не\s+(клад\|вешай)те\s+трубку` | 60 | `stay_on_call` |
| `(никому\|никогда)\s+не\s+(говор\|сообщ)` | 50 | `enforced_secrecy` |
| `перевед[иь]те\s+сроч` | 30 | `urgency_transfer` |
| `госуслуг.{0,15}(взлом\|подозр\|компромет)` | 40 | `fake_gosuslugi` |
| `(сотрудник\|специалист)\s+(банк\|МВД\|ФСБ\|РКН)` | 35 | `fake_authority` |
| `код\s+из\s+(СМС\|смс\|сообщ)` | 55 | `otp_request` |

Полный список — 30+ паттернов в `se-patterns.ts`. Расширяется по реальным методичкам ЦБ.

---

## 9. Пороги и решения

| Score | Level | Action |
|---|---|---|
| 0–29 | `ok` | Allow, никаких действий |
| 30–59 | `monitor` | Allow, флаг в transaction log для аудита |
| 60–84 | `step_up` | Триггер challenge, повтор скоринга после ответа |
| 85+ | `block` | Отказ, выгрузка reason codes в SIEM |

Пороги конфигурируются банком через `DeepFraudRootProps.thresholds`. Дефолты — выше.

---

## 10. Challenge mechanism

### v0 (hackathon): Cascading challenge pipeline

При триггере `step_up` запускается последовательность challenges. Fail на любом этапе → `block`. Каждый этап работает независимо и может быть skipped в конфиге банка.

#### Этап 1: Face presence check (shoulder surfing detection)

Запрос camera permission → MediaPipe FaceLandmarker детектит лица в кадре в течение 2–3 сек:
- **0 faces** → `block` с reason `user_not_present` (или fail в `no_permission` если camera denied)
- **1 face** → pass, переход к этапу 2
- **2+ faces** → `block` с reason `shoulder_surfing_detected`

MediaPipe Apache-2.0, runs WASM в браузере, ~15ms на frame на современных устройствах.

#### Этап 2: Face liveness (anti-photo attack)

Те же MediaPipe landmarks → детектируем:
- **Blink** (закрытие глаз минимум один раз за 5 сек)
- **Micro-movement** (нос смещается на >2px за окно 1 сек = живой человек, не статичное фото)
- Опционально: **head turn** (попросить повернуть голову влево)

Pass всех 2–3 проверок → переход к этапу 3.  
Fail → `block` с reason `liveness_failed`.

#### Этап 3: Recall question

Спрашиваем факт из реальной истории транзакций:

> *"Какую сумму вы переводили в Магнит на прошлой неделе?  
> а) 1 200 ₽  
> б) 2 800 ₽  
> в) 4 100 ₽  
> г) Не переводил"*

**Источник:** server helper, возвращает 3 реальных транзакции последних 30 дней + 1 distractor.  
**Время на ответ:** 30 сек.  
**Неправильный** → `block` с reason `recall_failed`.  
**Правильный** → rescore с пониженным риском (вычитается 25 из current score).

### Fallback логика

Если у пользователя нет камеры или permission denied → пропускаем этапы 1 и 2, переходим сразу к recall question + добавляется +10 к risk score (отсутствие visual proof — soft penalty, не block).

### v1+ (roadmap)
- Read-aloud challenge с детекцией пауз/повторов через Web Audio API
- Direct ask: *"Вы сейчас разговариваете по телефону с кем-то по поводу этого перевода?"*
- Voice biometrics match
- 3D liveness через FaceLandmarker depth map + IR-сигналы на iPhone TrueDepth

---

## 11. Privacy & consent

Дефолты максимально консервативные.

| Consent level | Что собирается |
|---|---|
| `minimal` | Только session fingerprint, никакой записи поведения, никакой Layer 2 интерсепции |
| `behavioral` (рекомендованный default) | Inter-event timings, paste/copy события (только факт), getUserMedia state, native tampering flags |
| `biometric` (explicit opt-in) | Keystroke timing с восстановимыми характеристиками для биометрической верификации |

### Hard-coded restrictions (никогда)

- Значения полей `type="password"`, `autocomplete="cc-number" | "cc-csc" | "one-time-code"`
- Полные тексты сообщений (только classification verdict + reason code + hash)
- Полные fetch bodies (только metadata: URL hash, method, status, timing, size)
- Содержимое clipboard (только факт + длина + наличие patterns)

### Локальное хранение

- IndexedDB ring buffer на 10 минут поведения, hard cap 10MB на пользователя
- Сырые данные не покидают устройство
- На сервер уходят только агрегированный feature vector + reason codes

---

## 12. Стек и зависимости

| Категория | Выбор | Лицензия |
|---|---|---|
| Язык | TypeScript 5 | Apache-2.0 |
| UI framework | React 18+ | MIT |
| Browser fingerprint | ThumbmarkJS | MIT |
| Bot detection | BotD | MIT |
| Rule engine | json-rules-engine | ISC |
| ML inference runtime | ONNX Runtime Web | MIT |
| Face landmarks (visual challenge) | MediaPipe FaceLandmarker (Tasks Vision) | Apache-2.0 |
| Phishing URL model | `CrabInHoney/urlbert-tiny-v4-phishing-classifier` (ONNX) | Apache-2.0 |
| Keystroke model | Custom-trained на CMU Keystroke Dynamics (sklearn → ONNX) | Apache-2.0 (training pipeline) |
| Demo platform | Storybook 8 | MIT |
| Build | Vite | MIT |
| Tests | Vitest | MIT |

Все non-toxic permissive. Нет AGPL/SSPL/BUSL/GPL в зависимостях. Проверено на май 2026.

**Датасеты (training pipeline, не runtime):**
- CMU Keystroke Dynamics Benchmark — research-use, верифицировать ToS перед коммерческим использованием
- BrainRun (CC0) — для расширения keystroke training set

---

## 13. Non-functional requirements

| NFR | Target |
|---|---|
| Latency p95 (steady state) | < 1000ms от user action до `onScore` / `onDecision` |
| Latency p95 (cold start) | < 3000ms на первом скоринге (включает ленивую загрузку ONNX/MediaPipe моделей) |
| Bundle size (core libs) | `core + react + ml + visual` < 100KB gzipped |
| Lazy-loaded assets | urlbert-tiny ONNX ~15MB, keystroke ONNX ~1MB, MediaPipe runtime ~3MB. Загружаются с банковского CDN или static хостинга, кэшируются Service Worker'ом. |
| Memory | < 50MB heap на активной сессии (с учётом ONNX runtime) |
| CPU | < 5% sustained на main thread; ONNX inference в Web Worker |
| Browser support | Chrome 90+, Firefox 90+, Safari 14+, Edge 90+ (WebAssembly + IndexedDB) |
| External calls | Только через explicit `ServerHelper` + один-time fetch ML моделей (можно self-host) |
| Explainability | Каждое score change имеет reason code и contribution |
| Determinism | Одинаковый event stream → одинаковый score (ML модели — fixed weights, не online learning на клиенте) |

---

## 14. План реализации

С расширенным scope (visual challenge + 2 ONNX модели) работа требует **параллельных треков** для команды 3–4 человека. Если команда меньше — режем visual challenge или ONNX-keystroke (см. fallback в конце секции).

### Workstreams и owners

| Track | Owner |
|---|---|
| **A. Architecture + integration** | Konstantin |
| **B. Signal collectors (Layers 1–4)** | Dev #2 |
| **C. ML pipeline (ONNX обучение + интеграция)** | Dev #3 |
| **D. UX + visual challenge + demo** | Dev #4 (или Konstantin overflow) |

### Фаза 1 — Skeleton (все вместе)

- [ ] Monorepo: пакеты `core`, `react`, `ml`, `visual`, `demo`
- [ ] Storybook поднят с заглушкой `<DeepFraud>`
- [ ] Type definitions: `Factor`, `Decision`, `ServerHelper`, `Challenge`, `ChallengePipeline`
- [ ] Layer 1: capture-phase event delegation на root (Track A)
- [ ] IndexedDB ring buffer (Track A)
- [ ] ThumbmarkJS + BotD интегрированы как session-level factors (Track B)
- [ ] **ML pipeline (в фоне)**: train sklearn keystroke model на CMU dataset, export to ONNX (Track C)

### Фаза 2 — Параллельная реализация

**Track A — Architecture (Konstantin):**
- [ ] Layer 2: patched `getUserMedia`, `fetch`, `XHR`, `clipboard` с allow-list
- [ ] Layer 4: `native_tampering` + `dev_environment`
- [ ] Factor: `recent_token_injection` — snapshot cookies/localStorage/sessionStorage на init, диф против watch keys
- [ ] Rule engine: factors → contributions → final score
- [ ] `onScore` + `onDecision` callbacks
- [ ] `challengeRenderer` slot wiring

**Track B — Signal collectors (Dev #2):**
- [ ] Factor: `copy_paste_recipient`
- [ ] Factor: `concurrent_media`
- [ ] Factor: `warning_dwell` + IntersectionObserver
- [ ] Factor: `pointer_pattern`
- [ ] Factor: `page_visibility` (`visibilitychange` + `blur/focus` + oscillation detection)
- [ ] Factor: `client_environment` — UA parse + version vs caniuse data
- [ ] Factor: `environment_conflicts` — 12 cross-checks (UA platform vs navigator, WebGL vs OS, timezone vs locale, etc.)
- [ ] Layer 3: MutationObserver + `phishing_text_dom` (regex set)

**Track C — ML (Dev #3):**
- [ ] Download urlbert-tiny-v4 ONNX, integration с ONNX Runtime Web
- [ ] Factor: `phishing_url` — extract URLs из DOM/clipboard, run inference, threshold
- [ ] Factor: `keystroke_dynamics` — ONNX-инференс с обученной моделью + Manhattan fallback
- [ ] Web Worker для всех инференсов (не блокировать main thread)
- [ ] Lazy-load + caching стратегия (Service Worker / IndexedDB)

**Track D — UX (Dev #4):**
- [ ] Live risk meter компонент (SVG + анимации)
- [ ] Recall question challenge: компонент + server helper заглушка с мок-транзакциями
- [ ] **MediaPipe FaceLandmarker integration** — wrapper, camera permission flow
- [ ] **Face presence challenge** — детект кол-ва лиц
- [ ] **Face liveness challenge** — blink + micro-movement детектор

### Фаза 3 — Интеграция

- [ ] Сборка всех треков в один Storybook
- [ ] Два демо-сценария: A (легит) и B (SEIP с visual challenge)
- [ ] Event playback scripts для имитации
- [ ] End-to-end тест: от события до challenge до решения

### Фаза 4 — Полировка

- [ ] Reason codes в UI (показываем жюри, **что** триггерило)
- [ ] Slides (5–7 штук): проблема, отличие от классики, как работает, демо, ML-стек, roadmap, business model
- [ ] Видеозапись демо как fallback (включая face challenge, который чувствителен к освещению)
- [ ] README с примером интеграции
- [ ] Резерв на тех-проблемы (камера, CDN, что-то отвалится)

### Финал — Питч.

### Fallback если команда 2–3 человека

Приоритеты на вылет (в этом порядке):
1. **Phishing URL ONNX** — сложнее всего по интеграции, можно заменить на простую regex-проверку доменов против PhishTank-feed (загруженного локально)
2. **Visual liveness** — оставить только face presence (kол-во лиц), без blink-детекции
3. **ONNX keystroke** — fallback к scaled Manhattan, упомянуть в питче "ONNX готов, не успели интегрировать"

**Никогда не урезать:** copy_paste, concurrent_media, phishing_text_dom, recall question challenge — это ядро differentiation.

---

## 14.1 Implementation priority (CRITICAL)

При 45 транзакционных факторах **физически невозможно** реализовать все за хакатон. Разделяю на три tier'а:

### Tier LIVE — реальная реализация для демо (12 факторов)

Эти должны работать на live-сценарии B и реально влиять на риск-метр:

| Factor | Track |
|---|---|
| `copy_paste_recipient` | B |
| `concurrent_media` | B |
| `phishing_text_dom` | B |
| `phishing_url` | C |
| `keystroke_dynamics` | C |
| `clipboard_otp_pattern` | B |
| `page_visibility` | B |
| `warning_dwell` | B |
| `focus_loss_during_input` | B |
| `native_tampering` | A |
| `dev_environment` | A |
| `bot_detection` | A |

Реалистично для команды 3–4 человека параллельно.

### Tier MOCK — stub-реализация (`ServerHelper` возвращает фиксированные значения для сценариев) (16 факторов)

Эти упоминаются в PRD и в reason codes, но реально не вычисляются — server helper возвращает hard-coded contribution исходя из сценария. Жюри это нормально воспримет как "MVP, server logic будет в production".

`new_recipient`, `amount_anomaly`, `time_of_day_anomaly`, `velocity_anomaly`, `recipient_velocity`, `recipient_account_age`, `geoip_jump`, `time_since_login`, `tls_fingerprint`, `request_idempotency_breach`, `recent_password_change`, `recent_contact_change`, `device_id_per_user_ratio`, `shared_recipient_graph`, `parallel_session`, `incoming_call_correlation`

**Реализация (Track D):** один `MockServerHelper` файл с predefined responses по `scenarioId`.

### Tier PAPER — в спецификации, не реализованы (17 факторов)

Реальной имплементации нет, но они существуют в TypeScript-типах и тестовых сценариях каталога — для completeness pitch'а ("у нас 45 факторов в плановой архитектуре"). Помечены в коде как `@todo/v1`.

`pointer_pattern`, `form_fill_order`, `back_navigation_pattern`, `double_submit_attempts`, `decision_latency`, `idle_in_form`, `back_button_during_warning`, `confirmation_hesitation`, `text_input_in_amount_field`, `environment_conflicts`, `client_environment`, `recent_token_injection`, `csp_violation_count`, `sri_violation`, `client_clock_skew`, `device_motion`, `screen_orientation_change`

**В питче формулируется так:** "12 факторов работают live в демо, 16 — через mock server helper (production-ready architecture), 17 — в roadmap. Все 45 имеют формализованные TypeScript-сигнатуры и QA-сценарии."

### Что показывать жюри явно

В UI live risk-метра отображать **активные факторы** разными цветами:
- 🟢 LIVE-факторы → contribute своим реальным score
- 🟡 MOCK-факторы → contribute через server helper (помечены звёздочкой)
- ⚪ PAPER-факторы → видны в спецификации но не активны (помечены "v1")

Это **честный** способ показать масштаб без вранья. Регулятор и серьёзные инвесторы оценят honesty over completeness.

---

## 15. Roadmap после хакатона

### v0.5
- Vanilla core отделён от React (multi-framework targeting)
- Vue 3 binding
- Angular binding
- Node.js server SDK (signed payload verification + rule replay)
- Pilot с одним банком (кандидаты: Asia Alliance Bank, Trustbank)

### v1.0
- React Native binding (mobile signals: TelephonyManager call state, accelerometer, root detection)
- Kotlin server SDK для JVM-стека банков (синергия с Agents.KT)
- Compliance docs: 152-ФЗ DPIA, GDPR DPA template
- Antifraud team dashboard: alerts, false-positive review, rule tuning

### v1.5
- Graph fraud detection (DGL/PyG) для mule/merchant networks
- Self-hosted vs SaaS deployment options
- Multi-tenant SaaS под key US/EU банки
- Fine-tuned phishing URL classifier (ONNX, in-browser)
- Read-aloud + on-call challenges

---

## 16. Бизнес-модель (roadmap)

**Open-source ядро** (`@deepcode/antifraud-core`, бинды): **MIT** — community trust, low-friction adoption.

**Commercial offering:**
- Server-side scoring engine (advanced rule sets, ML models, feature engineering)
- Antifraud team dashboard
- Signed payload tamper resistance
- Multi-tenant SaaS deployment
- 24/7 SLA support

**Pricing direction:**
- Self-hosted enterprise: $30–60K/year на банк tier (по MAU)
- SaaS: per-MAU + per-blocked-transaction success fee
- Pilot: free 90 дней + success fee 10% от prevented fraud (если измеримо)

---

## 17. Риски

| Риск | Severity | Mitigation |
|---|---|---|
| Browser API patching конфликтует с банковской analytics (Adobe, Mixpanel) | High | Documented allow-list для известных трекеров, integration testing |
| IndexedDB quota exceeded | Medium | Hard cap + auto-rotation; fallback к in-memory |
| False-positive на DOM analysis от легитимного контента | Medium | Threshold-based + manual review queue в roadmap |
| ThumbmarkJS/BotD деградируют на новых браузерах | Low | Активно поддерживаемые либы, мониторим updates |
| Регуляторное давление на behavioral biometrics в EU | High (для EU rollout) | Compliance v1 docs, explicit opt-in биометрика |
| Слабые SE-паттерны на узбекском/казахском | Medium | Партнёрство с локальными банками для расширения корпуса |
| Жюри не оценит "wrapper as moat" аргумент | Low | Сильное визуальное демо (live risk meter + visual challenge) снижает риск |
| **Camera permission denied → visual challenge не работает** | High | Fallback логика: skip visual stages, переход к recall question + +10 к score (см. §10) |
| **MediaPipe runtime ~3MB загружается медленно** | Medium | Lazy-load по триггеру step_up, не при инициализации; preload hint в `<head>` для критичных банков |
| **urlbert-tiny ONNX 15MB ломает мобильный 3G опыт** | High | CDN с edge caching, Service Worker для offline после первой загрузки, опциональное отключение фактора через config |
| **Лица в кадре варьируются от освещения** (false positives на face presence) | High | Min confidence threshold MediaPipe, retry до 3 раз перед block, тест на разных условиях освещения в demo |
| **Visual challenge может быть обойден показом видео-плейбэка** | Medium (но не critical для hackathon) | v0 hackathon: принять риск, упомянуть в roadmap 3D-liveness через depth |
| **CMU dataset не репрезентативен для русскоязычной QWERTY (раскладка ЙЦУКЕН)** | Medium | На демо тренируем на синтетических русских данных + CMU; в production — fine-tune на per-bank данных |
| **Scope недостаточен для всех треков одновременно** | High | Чёткий fallback план (см. §14), параллельные workstreams, не блочить друг друга. Tier LIVE/MOCK/PAPER приоритизация в §14.1. |
| **False positives на token injection от OAuth refresh flow** | Medium | Whitelist для known refresh patterns (HMAC signature, time window, preceding network call), мониторим preceding network state |
| **`document.cookie` не имеет change event — нужен polling** | Low | Polling каждые 500ms + `Object.defineProperty` patch на setter для real-time детекта (с risk of breaking some sites — fallback к polling если patch fails) |
| **Browser sync копирует cookies с другого устройства** | Medium | Корреляция с device_fingerprint: если fingerprint меняется одновременно — block, если стабилен — monitor (legit Chrome Sync) |
| **`environment_conflicts` false-positive на Tor / Brave / privacy extensions** | Medium | Распознавать известные подписи (Tor exit nodes, Brave's randomized canvas, anti-fingerprint extensions) и не флагать их как conflict |
| **`client_environment` ловит legit юзеров на старых телефонах** (в РУз/KZ много Android 8–9, всё ещё в обороте) | Medium | Низкий weight (15), не блочит сам по себе; whitelist для известных EOL-устройств которые ещё в обороте |
| **WebRTC IP leak detection не работает за corporate proxy / WAF** | Low | Skip check если detected NAT с corporate signature |
| **UA freeze (Chrome 100+ reduced UA)** | Low | Использовать Client Hints API (`navigator.userAgentData`) вместо UA parsing где возможно |

---

## 18. Открытые вопросы

1. **Позиционирование vs существующий банковский антифрод**: DeepCode как **дополнение** (orthogonal layer поверх Falcon/SAS) или **замена**? Для CIS — почти всегда дополнение, обсуждать в discovery-звонках.
2. **Pricing model**: per-MAU vs per-transaction-scored vs success-fee на prevented fraud? Решается в первом пилоте.
3. **Open-source vs proprietary border**: что отдаём в MIT, что держим за стеной? Текущая гипотеза: client libs MIT, server engine + dashboard commercial.
4. **Server SDK first language**: Node.js (быстрая интеграция) vs Kotlin (наш стек, банкам JVM ближе, синергия с Agents.KT)? Вероятно оба, но Kotlin first учитывая существующий стек.
5. **Brand**: имя "DeepCode.Antifraud" работает для CIS, но в EN-питче читается как "deep learning + fraud detection". Возможный ребренд: "DeepCode.Sentinel" / "DeepCode.Trustline" / "Sentline". Решение — после хакатона.
6. **GTM-канал**: прямые продажи банкам vs через системных интеграторов (Etton, R-Style, Diasoft) vs OEM-license для существующих антифрод-вендоров?

---

## Приложение A: Полная таблица SE-regex паттернов

См. отдельный файл `se-patterns.ts` в репозитории (TODO — расширение SE-pattern базы).

## Приложение B: References

- CMU Keystroke Dynamics Benchmark — cs.cmu.edu/~keystroke
- BrainRun dataset (CC0) — zenodo.org/records/2598135
- ThumbmarkJS — github.com/thumbmarkjs/thumbmarkjs
- BotD — github.com/fingerprintjs/BotD
- json-rules-engine — github.com/CacheControl/json-rules-engine
- ONNX Runtime Web — github.com/microsoft/onnxruntime
- Killourhy & Maxion, "Comparing Anomaly Detectors for Keystroke Dynamics" (2009)
- ЦБ РФ методические рекомендации по противодействию ФРМ — cbr.ru
- Бриф хакатона — внутренний документ

---

**Status:** Draft v0.7 — ждёт review команды и итераций по мере реализации
