# DeepCode.Antifraud — Scenarios Catalog v0.3

**Companion to** [PRD v0.5](./PRD_DeepCode_Antifraud_v0.5.md)  
**Дата:** 11 мая 2026  
**Обновления v0.3:** добавлены факторы `client_environment` (ENV-01…20) и `environment_conflicts` (CNF-01…20)  
**Назначение:** 340 тестовых сценариев — для (a) QA test suite, (b) данных для тренировки rule engine, (c) документации для banking integration teams, (d) питч-материала

---

## Как пользоваться этим документом

Каждый сценарий помечен типом:
- **TP** — true positive: фактор должен сработать, ожидается повышение score / step_up / block
- **TN** — true negative: фактор не должен сработать (или сработать минимально); ожидается allow
- **EDGE** — пограничный случай, нужно специальное правило или fallback логика
- **COMP** — composite: фактор работает в комбинации с другими, ожидается амплификация score

Verdict-уровни как в PRD: `allow` (0–29) / `monitor` (30–59) / `step_up` (60–84) / `block` (85+).

Сценарии помечены номерами 1–20 внутри каждого фактора. В тестах их можно адресовать как `CPY-01`, `CPY-02`, ..., `PGV-20` (см. соответствие в конце документа).

---

## 1. `copy_paste_recipient` (weight 40)

**Что детектит:** Пользователь вставил реквизиты получателя из буфера обмена вместо ручного ввода. В реальной банковской статистике CIS-региона этот сигнал ассоциирован с x10–x20 повышенной вероятностью фрода.

**Канал:** `paste` event + `navigator.clipboard.readText` patch на полях получателя (IBAN, телефон, карта, ФИО).

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Жертва получила IBAN в WhatsApp от "службы безопасности", скопировала и вставила в поле | step_up | - ok
| 2 | TP | Юзер вставил номер карты получателя из буфера обмена; до этого не было событий копирования из контактов | step_up |
| 3 | TP | Вставка расчётного счёта юр.лица; юзер физлицо без истории B2B-платежей | step_up |
| 4 | TP | Вставка номера телефона СБП; в clipboard history несколько разных номеров за час | step_up |
| 5 | TP | Вставка длинной строки (IBAN+БИК+название) сразу в несколько полей подряд | step_up |
| 6 | TP | Источник clipboard (где скопировано) — другое приложение / другой домен | step_up |
| 7 | TP | Юзер ни разу не нажимал клавишу в поле получателя — всё через paste | step_up |
| 8 | TN | Вставка из встроенного списка "Сохранённые получатели" банка | allow |
| 9 | TN | Autofill из браузерного password manager (input event с `inputType=insertReplacementText`) | allow |
| 10 | TN | Юзер вводит реквизиты вручную цифру за цифрой | allow |
| 11 | TN | Drag&drop карточки получателя из адресной книги банка | allow |
| 12 | TN | Голосовой ввод (speech-to-text API детектится) | monitor |
| 13 | EDGE | Юзер скопировал из легитимного email от знакомой компании (B2B регулярный счёт) | monitor |
| 14 | EDGE | Юзер вставляет из собственного шаблона "Платёжка ИП" | allow |
| 15 | EDGE | Программный paste через `navigator.clipboard.readText()` от расширения браузера | step_up |
| 16 | EDGE | Pull-to-paste из contextual menu vs Cmd+V — различать или нет? (в v0 — нет, оба = paste) | monitor |
| 17 | COMP | copy_paste + new_recipient + сумма > P95 истории юзера | block |
| 18 | COMP | copy_paste + concurrent_media (мик активен) | block |
| 19 | COMP | copy_paste + phishing_text_dom hit на "безопасный счёт" | block |
| 20 | COMP | copy_paste IBAN совпал с known scammer-получателем (server helper hit) | block |

---

## 2. `new_recipient` (weight 25)

**Что детектит:** Получатель добавлен <24h назад или используется впервые. Когда сочетается с другими сигналами — сильный SEIP-индикатор.

**Канал:** Server helper, возвращает `recipient_age_hours`, `tx_count_to_recipient`, `recipient_first_seen_ts`.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Новый получатель добавлен 10 минут назад + первая транзакция к нему | step_up |
| 2 | TP | Новый получатель + сумма > P95 личной истории платежей | block |
| 3 | TP | Получатель добавлен прямо в текущей сессии (без предыдущего использования) | step_up |
| 4 | TP | Серия из 3 новых получателей за последний час с разными суммами (layering pattern) | block |
| 5 | TP | Новый получатель + ФИО не похоже на круг общения (по графу контактов банка) | step_up |
| 6 | TP | Новый получатель в watchlist банка (known mule) | block |
| 7 | TP | Новый получатель — счёт в нехарактерном для юзера регионе/стране | step_up |
| 8 | TP | Новый получатель + комментарий "за услуги" + крупная сумма | step_up |
| 9 | TN | Получатель использовался 6 месяцев назад, не в текущем cooldown | allow |
| 10 | TN | Регулярный платёж (коммуналка, мобильная связь, аренда) | allow |
| 11 | TN | Новый получатель + сумма <500 ₽ + типичный pattern test-payment | monitor |
| 12 | TN | Новый получатель добавлен через QR-код от знакомого магазина | allow |
| 13 | TN | Юзер сам себе на другой банк (match по ФИО владельца) | allow |
| 14 | EDGE | Получатель добавлен 25 часов назад — сразу за пределами 24h cooldown | monitor |
| 15 | EDGE | Получатель — компания, которой юзер платил по другому счёту (тот же ИНН) | allow |
| 16 | EDGE | Получатель — Wildberries/Ozon, но добавлен впервые | monitor |
| 17 | EDGE | Onboarding нового юзера, без истории получателей вообще | monitor (отдельный путь) |
| 18 | COMP | new_recipient + copy_paste + concurrent_media | block |
| 19 | COMP | new_recipient + phishing_text_dom + warning skip | block |
| 20 | COMP | new_recipient + frequent_page_exits (PGV) + сумма в top 10% | block |

---

## 3. `concurrent_media` (weight 35)

**Что детектит:** Активен mic/camera в браузере или системе — индикатор того, что пользователь разговаривает по голосовой связи (часто с скаммером).

**Канал:** Patched `navigator.mediaDevices.getUserMedia` + polling `enumerateDevices()` каждые 2 сек для активных MediaStreamTracks.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | WhatsApp Web в другой вкладке имеет активный audio MediaStream | step_up |
| 2 | TP | Telegram Web с активным voice call в фоне | step_up |
| 3 | TP | Zoom meeting активен в системе (через `enumerateDevices`) | step_up |
| 4 | TP | Active mic после `getUserMedia` запрошенного 30 сек назад | step_up |
| 5 | TP | Microsoft Teams browser tab с активным meeting | step_up |
| 6 | TP | Discord Voice channel активен (web client) | step_up |
| 7 | TP | Skype Web с активным звонком | step_up |
| 8 | TP | Mic активен + длительность активного состояния > 2 минут | step_up |
| 9 | TN | Голосовой поиск Google только что отработал, mic уже закрыт | allow |
| 10 | TN | `getUserMedia` permission cached от прошлой сессии, но track не активен сейчас | allow |
| 11 | TN | Voice typing в notes app закрылся минуту назад | allow |
| 12 | TN | Spotify играет аудио (audio output, не input) | allow |
| 13 | EDGE | Camera активна для аватара в видеоконф, юзер выключил mic | step_up (видеоконф = подозрение) |
| 14 | EDGE | Mic активен в самом банковском приложении для voice-биометрии | allow (whitelist домена) |
| 15 | EDGE | Safari на iPhone не даёт детектить mic в других tabs (privacy) | allow (cannot detect, fall back) |
| 16 | EDGE | Запись подкаста (Anchor, Podbean) в другой вкладке | monitor |
| 17 | COMP | concurrent_media + new_recipient + copy_paste | block |
| 18 | COMP | concurrent_media + длинные паузы в keystroke (диктовка) | block |
| 19 | COMP | concurrent_media + frequent_page_exits = переключение app↔звонок | block |
| 20 | COMP | concurrent_media активен > 10 минут + транзакция в hi-amount tier | block |

---

## 4. `warning_dwell` (weight 20)

**Что детектит:** Пользователь проскипал warning-экран слишком быстро, не успев прочитать. Симптом того, что его торопят.

**Канал:** `IntersectionObserver` фиксирует видимость warning-компонента + таймер dwell времени до следующего user action.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Warning показан 600 ms — юзер тапнул "Подтвердить" | step_up |
| 2 | TP | Warning экран не получил scroll-событий, dwell < minMs | step_up |
| 3 | TP | Серия из 3 warning экранов, все проскипаны за <1с каждый | block |
| 4 | TP | Warning видимость в viewport < 1 сек полностью | step_up |
| 5 | TP | Юзер тапнул "Понимаю риск" без визуальной фиксации (focus event на кнопку <300ms) | step_up |
| 6 | TP | Warning о подозрительном получателе проскочен < 500ms | block |
| 7 | TP | Все 4 warning-экрана в потоке транзакции проскипаны под порог | block |
| 8 | TN | Warning виден 4+ секунды, юзер скроллил содержимое | allow |
| 9 | TN | Юзер прочитал warning, вернулся на предыдущий экран, потом вернулся и подтвердил | allow |
| 10 | TN | Dwell 2 сек + явное движение mouse к кнопке "Подтвердить" | allow |
| 11 | TN | Возвратный юзер видит знакомый warning, который видел 50 раз | monitor |
| 12 | EDGE | Юзер слепой / screen reader — warning озвучен, не виден визуально | allow (отдельный путь) |
| 13 | EDGE | Юзер на медленном устройстве, рендер занял >300ms | allow (компенсация рендер-латенси) |
| 14 | EDGE | Узкий экран — warning виден частично | step_up |
| 15 | EDGE | Юзер закрыл warning, потом вернулся через 5 минут — split events | monitor |
| 16 | EDGE | "Подтвердить" disabled первые 3 сек — проскипать нельзя | allow |
| 17 | COMP | skip warning + new_recipient + copy_paste | block |
| 18 | COMP | skip warning + concurrent_media | block |
| 19 | COMP | skip warning + phishing_text_dom = "не вешайте трубку" | block |
| 20 | COMP | skip warning + page_visibility events между warnings | block |

---

## 5. `keystroke_dynamics` (weight 30)

**Что детектит:** Тайминги нажатий не соответствуют локальному шаблону пользователя. Длинные паузы = пользователю диктуют. Слишком ровные = автоматика.

**Канал:** `keydown`/`keyup` timestamps + ONNX-модель обученная на CMU Keystroke Dynamics dataset + scaled Manhattan distance fallback.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Длинные паузы 800–2000ms между большинством keystrokes (пользователя инструктируют) | step_up |
| 2 | TP | Равномерные интервалы — все keystrokes 100±5ms (автоматика) | step_up |
| 3 | TP | Hold time на каждой клавише <30ms (нечеловеческие быстрые ходы) | step_up |
| 4 | TP | Полностью отсутствуют typing errors / backspace там, где обычно есть | monitor |
| 5 | TP | Ngram-паттерны не соответствуют шаблону юзера (любимые комбинации другие) | step_up |
| 6 | TP | Keystroke pattern matches Selenium SendKeys signature | block |
| 7 | TP | Bimodal распределение inter-key timing — двое набирают по очереди | step_up |
| 8 | TP | ONNX verdict: "not user" с confidence >0.9 | step_up |
| 9 | TN | Тайминги в пределах локального baseline (scaled Manhattan distance < threshold) | allow |
| 10 | TN | ONNX verdict: "match" с confidence >0.85 | allow |
| 11 | TN | Новый юзер — baseline недостаточно (skip factor) | monitor |
| 12 | TN | Юзер устал (вечер), набирает медленнее, но pattern остался его | allow |
| 13 | TN | Юзер торопится, набирает быстрее, но pattern его | allow |
| 14 | EDGE | Юзер переключился keyboard → phone — другой шаблон | monitor (split baseline) |
| 15 | EDGE | Раскладка изменилась (ENG ↔ RU) — другой ngram-набор | monitor |
| 16 | EDGE | Юзер набирает одной рукой (травма) | step_up (false positive риск) |
| 17 | EDGE | Voice-to-text вместо клавиатуры — нет keystroke событий | allow (фактор не применим) |
| 18 | COMP | keystroke anomaly + concurrent_media + frequent_page_exits | block |
| 19 | COMP | keystroke anomaly + копи-паст (ручного ввода вообще не было) | step_up |
| 20 | COMP | keystroke anomaly + first-time с этого устройства | block |

---

## 6. `pointer_pattern` (weight 20)

**Что детектит:** Аномалии в движении курсора — RAT auto-fill / бот / screen-share remote control.

**Канал:** `pointermove` events, curvature/jerk analysis, hover-explore-click ratio.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Перемещения курсора строго линейные (RAT auto-fill) | step_up |
| 2 | TP | Точное попадание в кнопки без hover-исследования (no hover→exit→hover patterns) | step_up |
| 3 | TP | Скорость постоянная (нет ускорений / замедлений человека) | step_up |
| 4 | TP | Курсор телепортируется (jump >200px без промежуточных событий) | step_up |
| 5 | TP | Нет естественного "drift" в покое | monitor |
| 6 | TP | Чрезмерно гладкая Безье-кривая (бот пытается имитировать человека) | step_up |
| 7 | TP | Хаотичные нечеловеческие движения (наивный adversarial bot) | step_up |
| 8 | TP | Дабл-клики строго одинаковой длительности | monitor |
| 9 | TN | Естественные curved trajectories с микро-вибрациями | allow |
| 10 | TN | Hover-explore-click с парой ошибочных движений | allow |
| 11 | TN | Курсор замедляется ближе к target (Fitts' law) | allow |
| 12 | TN | Юзер на touchpad — другой шаблон, но человеческий | allow |
| 13 | EDGE | Touch-only устройство, нет mouse events | allow (фактор не применим) |
| 14 | EDGE | Юзер с тремором (Паркинсон) | monitor (false positive риск) |
| 15 | EDGE | Юзер с трекболом — необычный паттерн | monitor |
| 16 | EDGE | Stylus на планшете — гладкие движения | monitor |
| 17 | COMP | pointer anomaly + native_tampering | block |
| 18 | COMP | pointer anomaly + bot_detection (BotD) | block |
| 19 | COMP | pointer anomaly + screen sharing heuristic | block |
| 20 | COMP | pointer anomaly + всё произошло за <5 сек на форме, требующей чтения | block |

---

## 7. `native_tampering` (weight 40)

**Что детектит:** Native JS-функции запатчены кем-то, кроме DeepCode (RAT, malicious extension, banking trojan).

**Канал:** На init — snapshot `.toString()` критичных native functions + allow-list собственных патчей. Periodic re-check.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | `window.fetch.toString()` не содержит `[native code]`, вне allow-list | block |
| 2 | TP | `XMLHttpRequest.prototype.send` запатчен расширением | step_up |
| 3 | TP | `addEventListener` обернут malicious script | block |
| 4 | TP | `crypto.subtle.encrypt` подменён | block |
| 5 | TP | `document.createElement` запатчен — RAT injection | block |
| 6 | TP | `WebSocket.prototype.send` запатчен — потенциальная exfiltration | block |
| 7 | TP | `navigator.mediaDevices.getUserMedia` запатчен не нами | block |
| 8 | TP | `console.log` запатчен — пытаются скрыть собственные логи | monitor |
| 9 | TN | Все native functions показывают `[native code]` | allow |
| 10 | TN | DeepCode сам запатчил fetch — записан в allow-list | allow |
| 11 | TN | Bank's own monitoring tool в allow-list | allow |
| 12 | EDGE | Patch установлен ДО DeepCode init — snapshot уже грязный | step_up (нет clean baseline) |
| 13 | EDGE | Polyfill в старом браузере выглядит как patch | allow (fingerprint известного polyfill) |
| 14 | EDGE | Browser extension с легитимным purpose (Grammarly, password manager) | monitor (warn user) |
| 15 | EDGE | Chrome built-in extension changes function signature | allow (browser-native source) |
| 16 | EDGE | Service Worker hijacks fetch — global pattern | step_up |
| 17 | COMP | native tampering + bot_detection | block |
| 18 | COMP | native tampering + dev_environment | block |
| 19 | COMP | native tampering + pointer anomaly | block |
| 20 | COMP | native tampering + первая транзакция с этого устройства | block |

---

## 8. `dev_environment` (weight 15)

**Что детектит:** DevTools открыт, navigator.webdriver=true, automation tools. Soft signal — низкий вес, потому что у legit айтишников DevTools постоянно открыт.

**Канал:** `devtools-detect` heuristic + `navigator.webdriver` check + `window.callPhantom` / `window._phantom` probes.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | DevTools открыт + console.log активность от внешнего скрипта | step_up |
| 2 | TP | DevTools открыт + paste длинной строки JS в console | step_up |
| 3 | TP | `navigator.webdriver === true` | block |
| 4 | TP | `window.callPhantom` defined | block |
| 5 | TP | DevTools opened во время заполнения платёжной формы | step_up |
| 6 | TP | DevTools opened + native_tampering | block |
| 7 | TP | DevTools opened + paste длинной JS-строки в console (self-XSS) | block |
| 8 | TN | DevTools всегда открыт у data-аналитика банка (рабочий аккаунт) | allow |
| 9 | TN | DevTools никогда не открывался в сессии | allow |
| 10 | TN | Юзер открыл DevTools на 5 сек посмотреть HTML и закрыл | monitor |
| 11 | EDGE | Mobile remote debugging (Chrome USB) | step_up |
| 12 | EDGE | Headless browser с DevTools открытым (тест-стенд) | block |
| 13 | EDGE | DevTools auto-opened by extension | step_up |
| 14 | EDGE | Юзер открыл DevTools после транзакции (post-event) | allow |
| 15 | EDGE | Firefox Responsive Design Mode | monitor |
| 16 | EDGE | Юзер на developer-friendly сайте в соседней вкладке (Stack Overflow) | allow |
| 17 | COMP | DevTools + paste JS-строки + new_recipient | block |
| 18 | COMP | DevTools + WebDriver = automated harvesting | block |
| 19 | COMP | DevTools + concurrent_media + warning skip | block |
| 20 | COMP | DevTools + phishing_text_dom hit на console output | block |

---
шз
## 9. `bot_detection` (weight 50)

**Что детектит:** Автоматизированные клиенты (Selenium, Puppeteer, Playwright, PhantomJS, headless Chrome).

**Канал:** BotD library (MIT, FingerprintJS). Дополнительные ручные probes.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | BotD detects Selenium WebDriver | block |
| 2 | TP | BotD detects Puppeteer headless | block |
| 3 | TP | BotD detects Playwright | block |
| 4 | TP | BotD detects PhantomJS | block |
| 5 | TP | BotD detects NodeJS user agent | block |
| 6 | TP | BotD detects automation framework signature | block |
| 7 | TP | Headless Chrome без CDP detection, но другие сигналы есть | block |
| 8 | TP | Юзер запускает script через ChromeDriver | block |
| 9 | TN | BotD verdict: human, никаких automation признаков | allow |
| 10 | TN | Accessibility tools (screen reader) — не bot | allow |
| 11 | TN | Brave, Vivaldi — нестандартные браузеры, BotD не флагает | allow |
| 12 | TN | Старый браузер без некоторых APIs — BotD различает | allow |
| 13 | EDGE | Headed Puppeteer для legit testing | block (default), allow только в test env |
| 14 | EDGE | Extension эмулирует webdriver flag (privacy tool) | monitor |
| 15 | EDGE | Tor Browser — необычные fingerprints | monitor |
| 16 | EDGE | Mobile webview embedded в native app | varies (нужен контекст app-id) |
| 17 | COMP | bot detected + new_recipient | block |
| 18 | COMP | bot detected + native_tampering | block |
| 19 | COMP | bot detected + concurrent_media | block |
| 20 | COMP | bot detected + phishing_url paste | block |

---

## 10. `phishing_text_dom` (weight 60)

**Что детектит:** SE-фразы появились в DOM (push, in-app сообщения, чат поддержки, поле комментария).

**Канал:** `MutationObserver` на childList + characterData + 30+ weighted regex по русским SE-паттернам.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | В DOM появилась фраза "служба безопасности Сбербанка" в push-уведомлении | step_up |
| 2 | TP | "переведите на безопасный счёт ЦБ" в in-app сообщении | block |
| 3 | TP | "не кладите трубку, я диктую" в чате интернет-банка | block |
| 4 | TP | "оформили на вас кредит на 500 тыс" в SMS-просмотрщике | step_up |
| 5 | TP | "Госуслуги взломаны, подтвердите личность кодом" | step_up |
| 6 | TP | "никому не говорите этот код" + контекст просьбы перевода | block |
| 7 | TP | "переведите срочно" + "сейчас же" + новый получатель | block |
| 8 | TP | "сотрудник МВД ждёт вашего ответа" — поддельная авторитетность | step_up |
| 9 | TP | "ваша карта привязана к мошенникам" — panicking | step_up |
| 10 | TP | Сумма прописью + спешка (anti-OCR pattern) | step_up |
| 11 | TN | Легитимный warning от банка с похожими словами в правильном контексте (whitelist) | allow |
| 12 | TN | Юзер читает статью на форуме о фроде — слова в кавычках | monitor (context) |
| 13 | TN | Образовательный контент банка "как защититься" с примерами | allow |
| 14 | TN | Newsletter ЦБ с информацией о новых схемах | allow |
| 15 | EDGE | Юзер цитирует мошенника в собственном письме в чат поддержки | monitor |
| 16 | EDGE | Подозрительная фраза в скриншоте (image), не в text DOM | allow (фактор не применим) |
| 17 | EDGE | Подозрительная фраза в title страницы внешнего iframe | varies |
| 18 | COMP | phishing text + concurrent_media + copy_paste | block |
| 19 | COMP | phishing text + warning skip | block |
| 20 | COMP | phishing text + frequent_page_exits | block |

---

## 11. `phishing_url` (weight 40)

**Что детектит:** Фишинговый URL в DOM, clipboard или paste. ONNX-инференс urlbert-tiny-v4-phishing-classifier.

**Канал:** Extract URLs из DOM (regex) и clipboard, batch inference в Web Worker через ONNX Runtime.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | В DOM URL `sberbank-online-secure.shop` — typosquat | step_up |
| 2 | TP | В clipboard URL `gosuslugi-confirm.com` — typo с госуслугами | step_up |
| 3 | TP | URL с newly-registered domain (<7 дней) | step_up |
| 4 | TP | urlbert-tiny verdict: phishing > 0.9 | block |
| 5 | TP | URL содержит Unicode-обман (cyrillic 'о' в "sberbank") | block |
| 6 | TP | URL с подозрительной TLD (.tk, .ml, .ga) + бренд банка | step_up |
| 7 | TP | URL содержит IP вместо домена | step_up |
| 8 | TP | URL с self-signed certificate signal | step_up |
| 9 | TN | Легитимный URL банка `sberbank.ru` | allow |
| 10 | TN | URL Google / Microsoft в техническом контексте | allow |
| 11 | TN | URL партнёра банка (Mir Pay, СБП) в whitelist | allow |
| 12 | TN | urlbert-tiny verdict: benign > 0.95 | allow |
| 13 | EDGE | URL shortener (bit.ly) → unknown destination | monitor (нужен expansion) |
| 14 | EDGE | URL с очень длинным path (попытка скрыть домен) | monitor |
| 15 | EDGE | Deeplink на банковское приложение `sberbankonline://` | allow (custom protocol) |
| 16 | EDGE | Punycode URL `xn--80akf...` представляющий cyrillic | step_up |
| 17 | COMP | phishing URL + phishing_text_dom | block |
| 18 | COMP | phishing URL + copy_paste recipient | block |
| 19 | COMP | phishing URL + concurrent_media | block |
| 20 | COMP | phishing URL + новый получатель, добавленный через этот URL | block |

---

## 12. `page_visibility` (weight 25) — NEW в v0.3

**Что детектит:** Аномальные паттерны переключения между вкладками / окнами / приложениями. Когда юзер ушёл-вернулся-сделал-ушёл — это паттерн "слушаю инструкции". Длительное отсутствие + быстрое действие при возврате — паттерн "получил указание, выполнил".

**Канал:** `document.visibilitychange` + `window.blur`/`focus` + `pagehide`/`pageshow` events. Heuristics: oscillation count, max absence duration, return→action latency.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | 5+ blur/focus событий за 2 минуты во время заполнения платёжной формы | step_up |
| 2 | TP | Уход с страницы на 45 сек → возврат → сразу клик "Подтвердить перевод" | step_up |
| 3 | TP | Юзер ушёл в WhatsApp Web (другая вкладка), вернулся через 30 сек и продолжил | step_up |
| 4 | TP | Oscillating tabs: страница банка ↔ другая вкладка 8+ раз за 5 минут | block |
| 5 | TP | Уход + paste IBAN сразу при возврате (скаммер продиктовал) | block |
| 6 | TP | Длительное отсутствие (>5 минут) + возврат и быстрая последовательность действий | step_up |
| 7 | TP | Множество кратковременных blurs (3–5 сек каждый) — слушает инструкции на телефоне | step_up |
| 8 | TP | Blur → action → blur → action — повторяющийся паттерн "получи указание, выполни" | step_up |
| 9 | TN | Один blur на 2 сек чтобы посмотреть push-уведомление, потом возврат | allow |
| 10 | TN | Длительное idle (отошёл, потом вернулся) — нет patterns переключений | allow |
| 11 | TN | Юзер минимизировал окно во время загрузки страницы | allow |
| 12 | TN | Smooth visibility события — типичный паттерн без oscillation | allow |
| 13 | TN | Только один blur за сессию | allow |
| 14 | EDGE | Mobile: blur каждый раз при notification на телефоне | monitor (mobile-aware threshold) |
| 15 | EDGE | Multitasker user с большим количеством вкладок | monitor |
| 16 | EDGE | Юзер открыл инструкцию банка в другой вкладке и сверяется (легит) | monitor |
| 17 | EDGE | Юзер потерял фокус из-за всплывающего окна Windows (Update notification) | allow |
| 18 | COMP | frequent_page_exits + concurrent_media + copy_paste | block |
| 19 | COMP | frequent_page_exits + keystroke pauses (corroborates "слушает инструкцию") | step_up |
| 20 | COMP | long_absence + new_recipient + phishing_text_dom | block |

---

## 13. `recent_token_injection` (weight 40) — NEW в v0.2

**Что детектит:** Session cookie / auth token / CSRF token появился или изменился в браузере недавно (<60 сек) вне нормального login/refresh flow. Сигнал session hijacking, cookie replay, XSS exfiltration, malicious extension инжекта.

**Канал:** На init `<DeepFraudRoot>` — snapshot всех cookies (`document.cookie`) + watch keys в localStorage/sessionStorage (`access_token`, `id_token`, `refresh_token`, `session_id`, `jwt`, `csrf_token`, `_ga`, и список из конфига). Periodic polling (500ms) для cookie diff + `Object.defineProperty` patch на `document.cookie` setter для real-time детекта. Storage API через `storage` event (for cross-tab) + ручной wrap для current-tab.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Session cookie появился 30 сек назад, action = крупный перевод | block |
| 2 | TP | JWT в `localStorage.access_token` заменён 15 сек назад без preceding login flow | step_up |
| 3 | TP | `document.cookie` получил Set-Cookie от malicious script (cookie value не из known fetch response) | block |
| 4 | TP | Auth token изменился, но `window.location.href` не менялась — типичный session takeover | block |
| 5 | TP | Multiple auth tokens одновременно (старый + новый JWT в localStorage) | step_up |
| 6 | TP | Session ID timestamp (10 сек назад) << login event timestamp (24 часа назад) — replay attack | block |
| 7 | TP | `csrf_token` изменился между моментом login и текущим действием | step_up |
| 8 | TP | localStorage `access_token` появился без preceding `POST /auth/login` в network log | block |
| 9 | TP | Новый OAuth bearer token добавлен без redirect flow visible в History API | step_up |
| 10 | TP | Cookie с домена, отличного от текущего, появился через XSS injection | block |
| 11 | TN | Token refresh — нормальный OAuth refresh flow visible (preceding POST к `/oauth/token`) | allow |
| 12 | TN | Session создан на login и неизменно used since | allow |
| 13 | TN | CSRF token меняется на каждый request — нормальное behavior для some backends (по whitelist) | allow |
| 14 | TN | Cookie с expiry в будущем, session_id stable весь сессион | allow |
| 15 | EDGE | Service Worker re-issued session due to cache invalidation | monitor |
| 16 | EDGE | Юзер открыл duplicate tab — session shared между ними | allow |
| 17 | EDGE | Browser Sync (Chrome Sync) скопировал cookies с другого устройства юзера | monitor (см. device_fingerprint correlation) |
| 18 | EDGE | OAuth provider rotated tokens из-за security policy (Google, Yandex) | allow (rate-limited refresh recognized) |
| 19 | COMP | recent_token_injection + new `device_fingerprint` | block (классический session takeover) |
| 20 | COMP | recent_token_injection + `native_tampering` + `bot_detection` | block |

---

## Visual Challenge Scenarios (challenge-mode, не factor)

**Канал:** MediaPipe FaceLandmarker в Web Worker. Активируется только при `step_up`. Camera permission запрашивается разово.

Эти сценарии — не транзакционные factors, а исходы challenge pipeline (см. PRD §10). Каждый сценарий описывает поведение visual challenge с конкретным выходом.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | В кадре только жертва — face_count=1 → pass этапа 1 | continue |
| 2 | TP | В кадре жертва + кто-то за плечом (буквальное shoulder surfing) → face_count=2 → block | block |
| 3 | TP | В кадре никого — face_count=0 (отвернулся / отошёл) → block | block |
| 4 | TP | В кадре 3 человека (например, скаммер показывает жертве "сотрудника банка" по видеосвязи) → block | block |
| 5 | TP | Юзер показал в камеру фото получателя (статичное изображение, нет моргания за 5 сек) → liveness_failed_blink → block | block |
| 6 | TP | Юзер показал распечатку лица другого человека (нос не сдвигается) → liveness_failed_static → block | block |
| 7 | TP | Показан экран другого устройства с записанным видео лица (всё нормально detected, но head_turn пропускается) → block (на head_turn challenge) | block |
| 8 | TP | Скаммер на видеосвязи "помогает" — видны он + жертва → face_count=2 → block | block |
| 9 | TN | Юзер один в кадре, моргает, лицо живое → pass all stages → переход к recall question | continue |
| 10 | TN | Юзер с очками — детект работает (MediaPipe handles glasses) | continue |
| 11 | TN | Юзер с бородой / маской до подбородка — детект работает | continue |
| 12 | TN | Юзер в плохом освещении — увеличенный timeout (5 сек), retry если confidence low | continue |
| 13 | EDGE | Юзер с младенцем на руках — face_count=2, ребёнок не угроза | block (false positive риск); v1 distinguish by face size |
| 14 | EDGE | Камера направлена на постер с лицами — face_count=N | block (liveness не пройдёт) |
| 15 | EDGE | Юзер с домашним питомцем (кот на коленях смотрит в камеру) — face_count может быть 2 если MediaPipe считает кошачье | edge: tune model для human-only |
| 16 | EDGE | Юзер на iPhone Front Camera, FaceID активен параллельно — может конфликтовать с getUserMedia | varies; fallback к recall question |
| 17 | EDGE | Юзер с пораной/пирсингом который меняет landmarks confidence | retry до 3 раз; если fail → fallback |
| 18 | EDGE | Юзер пользуется screen reader, не видит prompt — нужен audio cue | UX: audio prompt + tactile feedback |
| 19 | EDGE | Camera permission denied | skip visual stages, +10 score, переход к recall question (см. PRD §10) |
| 20 | COMP | Visual challenge passed all stages + recall question wrong → block с reason `recall_failed_after_visual_pass` (скаммер мог быть рядом до challenge, но отошёл) | block |

---

## 14. `client_environment` (weight 15) — NEW в v0.3

**Что детектит:** Outdated / EOL / необычная среда исполнения. Браузер и OS сами по себе слабый сигнал, но устаревшие системы — обычная мишень для banking trojans, а Node.js / headless / нерелевантные user-agents — почти всегда автоматика.

**Канал:** UA parse + `navigator.userAgentData` (Client Hints на Chromium) + comparison против caniuse / browserlist EOL data + emit browser/version/OS как context.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | IE 11 user agent | step_up |
| 2 | TP | Chrome версия >2 лет (например 105 в 2026) | monitor (+ outdated_browser reason) |
| 3 | TP | Windows 7 user agent (EOL Microsoft 2020, EOL extended 2023) | step_up |
| 4 | TP | Windows XP user agent (extreme outdated) | block |
| 5 | TP | macOS ≤10.13 High Sierra (EOL 2020) | step_up |
| 6 | TP | Android <8.0 Oreo (EOL Google support) | monitor |
| 7 | TP | iOS <14 (EOL Apple) | monitor |
| 8 | TP | Node.js user agent в transaction context | block |
| 9 | TP | UA указывает известную compromised browser version (специфичный CVE) | step_up |
| 10 | TP | Headless Chrome UA pattern (без BotD-проверок) | step_up |
| 11 | TN | Latest stable Chrome на Windows 11 | allow |
| 12 | TN | Latest Safari на macOS Sequoia | allow |
| 13 | TN | iPhone с iOS 18 — последняя версия | allow |
| 14 | TN | Android с свежим security patch level | allow |
| 15 | TN | Старая версия, которую юзер consistently использует 2+ года (recognized device) | allow |
| 16 | EDGE | UA freeze включён (Chrome 100+ reduced UA) — точная версия скрыта | monitor + fallback к Client Hints |
| 17 | EDGE | Lite / Embedded browser (Yandex.Browser Lite, MIUI Browser, Samsung Internet) — реально много юзеров в РУз/KZ | monitor (whitelist по market share) |
| 18 | EDGE | Enterprise locked browser (Edge in corp environment, Chrome managed) | allow (corp signature) |
| 19 | COMP | client_environment outdated + native_tampering | block (компрометация устаревшей системы вероятна) |
| 20 | COMP | client_environment EOL + new_recipient + первая транзакция | step_up |

---

## 15. `environment_conflicts` (weight 35) — NEW в v0.3

**Что детектит:** Внутренние противоречия между UA, navigator.platform, WebGL, screen, languages, timezone, WebRTC IP, и т.д. У здоровых юзеров эти поля consistent. У ботов, spoofed клиентов, VPN-через-чужой-stack, headless с masking — они противоречат друг другу.

**Канал:** 12 cross-checks, каждый возвращает pass/fail. Финальный score = (количество fails / 12) × 35.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | UA говорит iPhone, но `navigator.platform === "Win32"` | block |
| 2 | TP | UA Chrome on Windows, но WebGL renderer = "Mesa Intel" (Linux pattern) | step_up |
| 3 | TP | UA iOS Safari, но `ontouchstart` undefined и `TouchEvent` не существует | block |
| 4 | TP | UA desktop Chrome, но `navigator.maxTouchPoints > 5` (мобильный hardware spoofing desktop) | step_up |
| 5 | TP | Timezone = UTC+3 (Москва), Accept-Language = "ja-JP" (несвязные) | step_up |
| 6 | TP | UA Chrome 120, но Permissions API отсутствует (была в Chrome <100) — UA spoofed | step_up |
| 7 | TP | Screen 1920×1080 + UA говорит мобильный (виртуалка не emulating screen) | step_up |
| 8 | TP | `navigator.userAgentData.platform` (Client Hints) ≠ UA platform | step_up |
| 9 | TP | WebRTC reveals IP в Бразилии, HTTP IP в России | step_up |
| 10 | TP | `navigator.languages` массив пустой (bot забыл заспуфить) | step_up |
| 11 | TP | UA Firefox 100+, но window.InstallTrigger undefined (Firefox-specific) | step_up |
| 12 | TP | UA Vendor = "Google Inc.", но UA Browser = "Safari" — несоответствие | step_up |
| 13 | TP | Canvas fingerprint matches известному automation framework (Puppeteer signature) | block |
| 14 | TP | Plugins содержит "ActiveX Object" на non-IE UA — древняя escape техника | step_up |
| 15 | TN | Все 12 проверок passing — consistent fingerprint | allow |
| 16 | TN | Один minor conflict от privacy extension (uBlock, Decentraleyes — known signatures) | allow (whitelist) |
| 17 | TN | Legitimate VPN: WebRTC reveals VPN IP, HTTP shows same VPN IP — internal consistency | allow |
| 18 | EDGE | Tor Browser: intentionally minimal/uniform fingerprint — известная подпись | monitor (не block — легитимные privacy-conscious users; banks принимают решение) |
| 19 | EDGE | iOS Lockdown Mode: reduces некоторые signals (легит, есть signature) | allow |
| 20 | COMP | environment_conflicts (4+ fails) + bot_detection (BotD) — корреляция | block |

---

## 16. `device_fingerprint` (session-level, weight 30)

**Что детектит:** ThumbmarkJS hash не совпадает с историей этого аккаунта. Session-level фактор, влияет на login risk, а не на transaction score напрямую.

**Канал:** ThumbmarkJS + server-side comparison против last N known fingerprints для userId.

| # | Type | Сценарий | Verdict |
|---|---|---|---|
| 1 | TP | Новый device fingerprint, юзер никогда не видим на этом устройстве | step_up |
| 2 | TP | Fingerprint совпадает с device из watchlist (known шпионский ноут) | block |
| 3 | TP | Fingerprint mismatch + GeoIP jump > 2000 км за 30 минут | block |
| 4 | TP | Fingerprint меняется внутри одной сессии (browser switch via session takeover) | block |
| 5 | TP | Headless browser fingerprint signature | block |
| 6 | TP | TLS fingerprint mismatch при том же UA | step_up |
| 7 | TP | Datacenter ASN детектируется в IP | step_up |
| 8 | TP | Residential proxy паттерн (rotating IP с одинаковым fingerprint) | step_up |
| 9 | TN | Fingerprint matches known device юзера | allow |
| 10 | TN | Fingerprint слегка изменился из-за browser update | monitor |
| 11 | TN | Fingerprint matches один из 3 known devices (home, work, phone) | allow |
| 12 | EDGE | Incognito mode → fingerprint менее уникальный | monitor |
| 13 | EDGE | Privacy browser (Brave с randomized canvas) — fingerprint каждый раз другой | step_up (false positive риск) |
| 14 | EDGE | Юзер купил новый телефон и впервые логинится с него | step_up (recall question может закрыть) |
| 15 | EDGE | Анти-fingerprinting extension от self-protective юзера | monitor |
| 16 | EDGE | Юзер переехал — новый IP, тот же device | allow (device match wins) |
| 17 | COMP | new fingerprint + new_recipient + concurrent_media | block |
| 18 | COMP | new fingerprint + bot_detection | block |
| 19 | COMP | new fingerprint + первая транзакция = high-value | step_up |
| 20 | COMP | new fingerprint + native_tampering | block |

---

## Соответствие scenario ID → factor

Для использования в тестах:

| Factor / pipeline | Code prefix | Range |
|---|---|---|
| `copy_paste_recipient` | CPY | CPY-01 … CPY-20 |
| `new_recipient` | NRC | NRC-01 … NRC-20 |
| `concurrent_media` | CMD | CMD-01 … CMD-20 |
| `warning_dwell` | WDW | WDW-01 … WDW-20 |
| `keystroke_dynamics` | KST | KST-01 … KST-20 |
| `pointer_pattern` | PTR | PTR-01 … PTR-20 |
| `native_tampering` | NTV | NTV-01 … NTV-20 |
| `dev_environment` | DEV | DEV-01 … DEV-20 |
| `bot_detection` | BOT | BOT-01 … BOT-20 |
| `phishing_text_dom` | PTD | PTD-01 … PTD-20 |
| `phishing_url` | PUL | PUL-01 … PUL-20 |
| `page_visibility` | PGV | PGV-01 … PGV-20 |
| `recent_token_injection` | TKN | TKN-01 … TKN-20 |
| `client_environment` | ENV | ENV-01 … ENV-20 |
| `environment_conflicts` | CNF | CNF-01 … CNF-20 |
| Visual challenge pipeline | VIS | VIS-01 … VIS-20 |
| `device_fingerprint` | DFP | DFP-01 … DFP-20 |

**Итого:** 340 сценариев (15 транзакционных факторов × 20 + 20 visual challenge + 20 session-level device_fingerprint).

---

## Композитные SEIP-сценарии (top-10 для демо B и тестирования)

Эти сценарии комбинируют несколько факторов и являются реалистичными "канонами" CIS-фрода. Прогнать их через систему — главный показатель работоспособности.

| # | Название | Combo факторов | Expected verdict |
|---|---|---|---|
| C1 | Бабушка переводит "безопасный счёт ЦБ" по звонку | CMD-01 + PTD-02 + CPY-01 + WDW-06 + KST-01 + PGV-07 | block (visual challenge + recall) |
| C2 | Юзер под удалённым доступом (RAT) на счёте сотрудника | PTR-01 + NTV-05 + BOT-07 + DFP-04 | block |
| C3 | Self-XSS через console (Facebook-style scam) | DEV-02 + NTV-08 + PUL-03 | block |
| C4 | Romance / pig-butchering, крупный перевод "на инвестиции" | NRC-02 + CPY-03 + PTD-09 + PGV-04 | block (recall question key) |
| C5 | Дроповод-юзер layering на 5 счетов | NRC-04 + KST-02 + BOT-03 + DFP-02 | block |
| C6 | Дипфейк голоса родственника просит срочно перевести | CMD-07 + NRC-01 + PTD-07 + WDW-01 | block (visual challenge) |
| C7 | Job-scam mule recruitment: юзер сам — невольный mule | NRC-06 + DFP-01 + KST-10 | step_up + manual review |
| C8 | Phishing-сайт собрал креды, скаммер сейчас логинится | DFP-01 + DFP-05 + BOT-01 + PUL-01 | block (на login уже) |
| C9 | SIM-swap → перехват OTP → перевод на свежий счёт | DFP-01 + NRC-01 + DFP-03 | block (на login) |
| C10 | Авторитет: "сотрудник МВД" звонит и диктует перевод | CMD-01 + PTD-08 + CPY-01 + PGV-02 + KST-01 | block |

---

## Использование каталога

### Для QA (Saturday)
Превратить каждую строку TP/TN в Vitest unit test:
```ts
describe('copy_paste_recipient', () => {
  test('CPY-01: WhatsApp IBAN paste triggers step_up', () => {
    const score = simulateScenario('CPY-01');
    expect(score.level).toBe('step_up');
  });
  // ...
});
```

### Для калибровки весов (Sunday утро)
Прогнать все TP — должны давать score ≥ соответствующий порог.  
Прогнать все TN — должны оставаться ≤ 29.  
Edge-кейсы → ручной review, скорее всего нужны kill-switch правила.

### Для питч-демо
Live-проиграть сценарии C1 и одну легитную транзакцию side-by-side. Зрительно — risk meter заполняется по мере накопления событий, breakdown по reason codes виден в UI.

### Для расширения корпуса
Сценарии TP — кандидаты в обучающую выборку для будущей синтетической fraud dataset (для fine-tune NLP-классификатора и keystroke ONNX-модели).

---

**Status:** Draft v0.1 — будет уточняться по мере реализации факторов. Edge-cases с пометкой "false positive риск" — кандидаты на дополнительный whitelist / consent flow.
