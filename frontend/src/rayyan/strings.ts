import { useI18n } from "../i18n/I18nContext";

type Pair = readonly [en: string, ar: string];

/**
 * Fale7-scoped string table.
 *
 * Kept inside `src/rayyan` so the shared `messages.ar.ts` file (a project file)
 * does not need editing to add this feature.
 */
const STRINGS = {
  "brand.subtitle": ["Gemini explanations", "تفسيرات Gemini"],
  "nav.assistant": ["Assistant", "المساعد"],
  "nav.settings": ["API settings", "إعدادات API"],
  "common.loading": ["Loading…", "جارٍ التحميل…"],
  "common.retry": ["Try again", "أعد المحاولة"],
  "common.cancel": ["Cancel", "إلغاء"],
  "common.refresh": ["Refresh", "تحديث"],
  "common.backToAssistant": ["Back to the assistant", "العودة إلى المساعد"],

  "settings.eyebrow": ["Google Gemini", "Google Gemini"],
  "settings.title": ["Fale7 API settings", "إعدادات Fale7 API"],
  "settings.description": [
    "Add, validate and switch the Google Gemini keys Fale7 may use. Keys are validated by the backend before they are stored.",
    "أضف مفاتيح Google Gemini التي يستخدمها Fale7 واختبرها وبدّل بينها. يتحقق الخادم من المفتاح قبل تخزينه.",
  ],
  "settings.connection": ["Connection", "الاتصال"],
  "settings.configured": ["Configured", "مُهيّأ"],
  "settings.notConfigured": ["Not configured", "غير مُهيّأ"],
  "settings.provider": ["Provider", "المزوّد"],
  "settings.providerName": ["Google Gemini", "Google Gemini"],
  "settings.activeKey": ["Active key", "المفتاح النشط"],
  "settings.noActiveKey": ["No active key", "لا يوجد مفتاح نشط"],
  "settings.source": ["Source", "المصدر"],
  "settings.sourceSaved": ["Saved key", "مفتاح محفوظ"],
  "settings.sourceEnv": ["Environment bootstrap", "مفتاح بيئة أولي"],
  "settings.sourceNone": ["None", "لا يوجد"],
  "settings.authMode": ["Management access", "صلاحية الإدارة"],
  "settings.authLoopback": ["This server only (loopback)", "هذا الخادم فقط"],
  "settings.authToken": ["Settings token required", "يلزم رمز الإعدادات"],
  "settings.selectedModel": ["Selected model", "النموذج المختار"],
  "settings.modelUnresolved": ["Resolved on first use", "يُحدَّد عند أول استخدام"],
  "settings.encryption": ["Encryption at rest", "التشفير أثناء التخزين"],
  "settings.storage": ["Key storage", "مكان تخزين المفاتيح"],
  "settings.storageValue": ["Server-side encrypted table", "جدول مشفَّر على الخادم"],
  "settings.rateLimit": ["Questions per hour", "أسئلة في الساعة"],

  "settings.addTitle": ["Add Gemini API key", "إضافة مفتاح Gemini"],
  "settings.addDescription": [
    "The key is sent once to the backend, validated with Google, then encrypted. Only a masked form is ever returned.",
    "يُرسل المفتاح مرة واحدة إلى الخادم، ويُتحقق منه مع Google، ثم يُشفّر. لا يُعاد إلى المتصفح سوى صيغة مقنّعة.",
  ],
  "settings.labelField": ["Label", "الاسم"],
  "settings.labelPlaceholder": ["e.g. Production key", "مثال: مفتاح الإنتاج"],
  "settings.keyField": ["Gemini API key", "مفتاح Gemini API"],
  "settings.keyPlaceholder": ["Paste the key — it is hidden after submission", "الصق المفتاح — يُخفى بعد الإرسال"],
  "settings.addSubmit": ["Validate and save", "تحقّق واحفظ"],
  "settings.adding": ["Validating the key with Google…", "جارٍ التحقق من المفتاح مع Google…"],
  "settings.addSuccess": ["Key validated and saved.", "تم التحقق من المفتاح وحفظه."],
  "settings.addFirstActive": ["Key validated, saved and activated.", "تم التحقق من المفتاح وحفظه وتنشيطه."],
  "settings.keyNote": [
    "This browser never stores the key. The field is cleared immediately after submission.",
    "لا يخزّن هذا المتصفح المفتاح. يُمسح الحقل فور الإرسال.",
  ],

  "settings.keysTitle": ["Saved keys", "المفاتيح المحفوظة"],
  "settings.keysEmpty": [
    "No keys saved yet. Fale7 will not send AI requests until a valid key is added and activated.",
    "لا توجد مفاتيح محفوظة. لن يرسل Fale7 أي طلب حتى يُضاف مفتاح صالح ويُنشّط.",
  ],
  "settings.maskedNote": [
    "Keys are shown masked only. The API never returns a complete key.",
    "تظهر المفاتيح مقنّعة فقط. لا يعيد الـ API المفتاح كاملًا أبدًا.",
  ],
  "settings.active": ["Active", "نشط"],
  "settings.statusValid": ["Valid", "صالح"],
  "settings.statusInvalid": ["Invalid", "غير صالح"],
  "settings.statusQuota": ["Quota limited", "بلغ حد الحصة"],
  "settings.test": ["Test", "اختبار"],
  "settings.testing": ["Testing…", "جارٍ الاختبار…"],
  "settings.activate": ["Activate", "تنشيط"],
  "settings.delete": ["Delete", "حذف"],
  "settings.confirmDelete": ["Confirm delete", "تأكيد الحذف"],
  "settings.created": ["Created", "أُنشئ"],
  "settings.lastChecked": ["Last checked", "آخر تحقق"],
  "settings.never": ["Never", "أبدًا"],
  "settings.lastError": ["Last error", "آخر خطأ"],
  "settings.modelLabel": ["Model", "النموذج"],
  "settings.changeModel": ["Use model", "استخدام النموذج"],
  "settings.loadModels": ["Load models", "تحميل النماذج"],
  "settings.loadingModels": ["Loading models…", "جارٍ تحميل النماذج…"],
  "settings.modelsUnavailable": ["Models could not be listed. Test the key first.", "تعذّر عرض النماذج. اختبر المفتاح أولًا."],
  "settings.modelsSourceLive": ["Fresh from Google", "مباشر من Google"],
  "settings.modelsSourceCached": ["From cache", "من الذاكرة المؤقتة"],
  "settings.modelSaved": ["Model saved for this key.", "تم حفظ النموذج لهذا المفتاح."],
  "settings.validationOk": ["Google accepted this key.", "قبلت Google هذا المفتاح."],
  "settings.validationQuota": ["The key is valid but currently over quota.", "المفتاح صالح لكنه تجاوز الحصة حاليًا."],
  "settings.validationFailed": ["Google rejected this key.", "رفضت Google هذا المفتاح."],
  "settings.validationTransient": ["The check did not complete; the saved status was unchanged.", "لم يكتمل التحقق؛ لم تتغيّر الحالة المحفوظة."],
  "settings.switchHint": [
    "Switching keys applies immediately to new questions. No restart or redeploy is needed.",
    "يُطبَّق تبديل المفاتيح فورًا على الأسئلة الجديدة دون إعادة تشغيل.",
  ],
  "settings.quotaHint": [
    "If the active key reaches its quota, activate another valid saved key here and Fale7 continues.",
    "إذا بلغ المفتاح النشط حصته، نشّط مفتاحًا صالحًا آخر هنا وسيكمل Fale7.",
  ],
  "settings.securityTitle": ["Security", "الأمان"],
  "settings.securityBody": [
    "Keys are encrypted server-side with Fernet (AES-128-CBC + HMAC-SHA256). The browser only receives masked hints, and keys are never written to logs.",
    "تُشفَّر المفاتيح على الخادم باستخدام Fernet. لا يتلقى المتصفح سوى صيغة مقنّعة، ولا تُكتب المفاتيح في السجلات.",
  ],
  "settings.envNote": [
    "The server also has a bootstrap key configured in its environment. Saved keys always take precedence.",
    "يوجد أيضًا مفتاح أولي مهيّأ في بيئة الخادم، والمفاتيح المحفوظة لها الأولوية دائمًا.",
  ],

  "token.title": ["This server protects API settings", "هذا الخادم يحمي إعدادات API"],
  "token.description": [
    "Enter the Fale7 settings token. It is kept in memory for this tab only and never stored in the browser.",
    "أدخل رمز إعدادات Fale7. يبقى في ذاكرة هذا التبويب فقط ولا يُخزَّن في المتصفح.",
  ],
  "token.field": ["Settings token", "رمز الإعدادات"],
  "token.submit": ["Unlock settings", "فتح الإعدادات"],
  "token.invalid": ["The settings token was not accepted.", "لم يُقبل رمز الإعدادات."],

  "chat.eyebrow": ["Grounded explanations", "تفسيرات مستندة إلى البيانات"],
  "chat.title": ["Fale7 assistant", "مساعد Fale7"],
  "chat.description": [
    "Fale7 explains AgriNASA's computed irrigation, weather and crop-health values with Google Gemini. Calculations stay in the AgriNASA services; the model only interprets them.",
    "يشرح Fale7 القيم المحسوبة في AgriNASA (الري والطقس وصحة المحصول) باستخدام Google Gemini. تبقى الحسابات في خدمات AgriNASA، والنموذج يفسّرها فقط.",
  ],
  "chat.notConnectedTitle": ["Gemini is not connected", "Gemini غير متصل"],
  "chat.notConnectedBody": [
    "Add and activate a Google Gemini API key to enable Fale7. Until then Fale7 sends no AI request and shows no simulated answer.",
    "أضف مفتاح Google Gemini ونشّطه لتمكين Fale7. حتى ذلك الحين لا يرسل Fale7 أي طلب ولا يعرض إجابة محاكاة.",
  ],
  "chat.openSettings": ["Open API settings", "فتح إعدادات API"],
  "chat.fieldLabel": ["Field", "الحقل"],
  "chat.fieldPlaceholder": ["Select a field…", "اختر حقلًا…"],
  "chat.noFields": ["No fields yet. Create a field in AgriNASA first.", "لا توجد حقول بعد. أنشئ حقلًا في AgriNASA أولًا."],
  "chat.inputPlaceholder": ["Ask about irrigation, rainfall, temperature or crop health…", "اسأل عن الري أو الأمطار أو الحرارة أو صحة المحصول…"],
  "chat.send": ["Send", "إرسال"],
  "chat.newChat": ["New conversation", "محادثة جديدة"],
  "chat.thinking": ["Recomputing field analyses and asking Gemini…", "جارٍ إعادة حساب تحليلات الحقل وسؤال Gemini…"],
  "chat.requestFailed": ["Fale7 could not answer.", "تعذّر على Fale7 الإجابة."],
  "chat.provider": ["Provider", "المزوّد"],
  "chat.providerGemini": ["Gemini", "Gemini"],
  "chat.providerFallback": ["Deterministic fallback (not AI)", "إجابة حتمية بديلة (ليست ذكاءً اصطناعيًا)"],
  "chat.model": ["Model", "النموذج"],
  "chat.key": ["Key", "المفتاح"],
  "chat.validation": ["Reply checks", "فحص الإجابة"],
  "chat.validationPassed": ["Passed", "ناجح"],
  "chat.validationRejected": ["Rejected — fallback used", "مرفوض — استُخدم البديل الحتمي"],
  "chat.validationSkipped": ["Skipped", "تم التخطي"],
  "chat.rejectedNumbers": ["Withheld numbers", "أرقام حُجبت"],
  "chat.robotTitle": ["Field robot", "روبوت الحقل"],
  "chat.robotDescription": [
    "Pair the ESP32 robot to this field so its soil, air and distance readings sit next to the satellite and model.",
    "اربط روبوت ESP32 بهذا الحقل لتظهر قراءات التربة والهواء والمسافة بجوار بيانات القمر الصناعي والنموذج.",
  ],
  "chat.openRobot": ["Open the robot page", "افتح صفحة الروبوت"],
  "chat.capabilitiesTitle": ["What Fale7 can use now", "ما يستطيع Fale7 استخدامه الآن"],
  "chat.capabilitiesDescription": [
    "Statuses reflect the live AgriNASA configuration and services, not an imagined feature list.",
    "تعكس الحالات تهيئة AgriNASA وخدماتها الفعلية، لا قائمة ميزات متخيَّلة.",
  ],
  "chat.sourcesTitle": ["Data sources in context", "مصادر البيانات في السياق"],
  "chat.ephemeral": [
    "This conversation is kept in memory only; it is not saved to the database.",
    "تبقى هذه المحادثة في الذاكرة فقط ولا تُحفظ في قاعدة البيانات.",
  ],
  "chat.demoNotice": [
    "Demo mode: answers describe the cached demo snapshot, not your field.",
    "وضع العرض: تصف الإجابات لقطة تجريبية مخزّنة وليس حقلك.",
  ],
  "chat.quotaTitle": ["The active key is over quota", "المفتاح النشط تجاوز الحصة"],
  "chat.quotaBody": ["Switch to another valid saved key, then ask again.", "بدّل إلى مفتاح صالح محفوظ ثم اسأل مجددًا."],
  "chat.invalidTitle": ["Google rejected the active key", "رفضت Google المفتاح النشط"],
  "chat.invalidBody": ["Validate or switch the key in API settings.", "اختبر المفتاح أو بدّله من إعدادات API."],
  "chat.noKeyTitle": ["No active Gemini key", "لا يوجد مفتاح Gemini نشط"],
  "chat.noKeyBody": ["Add and activate a key in API settings.", "أضف مفتاحًا ونشّطه من إعدادات API."],
  "chat.inspectContext": ["View data sent to Gemini", "عرض البيانات المرسلة إلى Gemini"],
  "chat.selectFieldFirst": ["Select a field to start.", "اختر حقلًا للبدء."],
  "chat.conversationNote": ["Conversation", "المحادثة"],
  "chat.usage": ["Token usage", "استخدام الرموز"],
  "chat.fallbackNotice": ["No AI answer was produced. This is a deterministic, labelled summary.", "لم تُنتج إجابة ذكاء اصطناعي. هذا ملخص حتمي مُوسَّم."],
  "chat.yourQuestion": ["You", "أنت"],
  "chat.rayyan": ["Fale7", "Fale7"],

  "fapi.title": ["Fale7 API", "واجهة Fale7 API"],
  "fapi.description": [
    "Use this API key to connect your application to Fale7 AI. The backend computes the field context; the model only explains it.",
    "استخدم مفتاح API هذا لربط تطبيقك بذكاء Fale7. يحسب الخادم سياق الحقل، والنموذج يفسّره فقط.",
  ],
  "fapi.statusActive": ["Active", "نشط"],
  "fapi.statusRevoked": ["Revoked", "ملغى"],
  "fapi.keyLabel": ["API key", "مفتاح API"],
  "fapi.keyOnce": [
    "This is the only time the full key is shown. Copy it now and store it safely.",
    "هذه المرة الوحيدة التي يظهر فيها المفتاح كاملًا. انسخه الآن واحفظه بأمان.",
  ],
  "fapi.copy": ["Copy API key", "نسخ مفتاح API"],
  "fapi.copied": ["Copied to the clipboard.", "تم النسخ إلى الحافظة."],
  "fapi.copyFailed": [
    "The key could not be copied. Select it and copy manually.",
    "تعذّر نسخ المفتاح. حدّده وانسخه يدويًا.",
  ],
  "fapi.copyViaLink": [
    "Copy through a secure link (shown once, then discarded)",
    "نسخ عبر رابط آمن (يُعرض مرة واحدة ثم يُهمل)",
  ],
  "fapi.regenerate": ["Regenerate key", "إعادة إنشاء المفتاح"],
  "fapi.generate": ["Generate key", "إنشاء مفتاح"],
  "fapi.revoke": ["Revoke key", "إلغاء المفتاح"],
  "fapi.confirmRegenerate": [
    "Regenerate the key? Every application using the current key stops working immediately.",
    "إعادة إنشاء المفتاح؟ سيتوقف كل تطبيق يستخدم المفتاح الحالي فورًا.",
  ],
  "fapi.confirmRevoke": [
    "Revoke the key? Every application using it stops working immediately.",
    "إلغاء المفتاح؟ سيتوقف كل تطبيق يستخدمه فورًا.",
  ],
  "fapi.generated": ["New key issued.", "تم إصدار مفتاح جديد."],
  "fapi.revoked": ["The key was revoked.", "تم إلغاء المفتاح."],
  "fapi.noKey": [
    "No key yet. One is created automatically when this section opens.",
    "لا يوجد مفتاح بعد. يُنشأ تلقائيًا عند فتح هذا القسم.",
  ],
  "fapi.protectedTitle": ["API management is protected", "إدارة API محمية"],
  "fapi.protectedBody": [
    "Unlock API settings in this browser with the settings token, or manage the key from the server that runs AgriNASA. Keys are never issued to an anonymous visitor.",
    "افتح إعدادات API في هذا المتصفح برمز الإعدادات، أو أدر المفتاح من الخادم الذي يشغّل AgriNASA. لا تُصدر المفاتيح لزائر مجهول.",
  ],
  "fapi.unlock": ["Open API settings", "فتح إعدادات API"],
  "fapi.qrTitle": ["QR code", "رمز QR"],
  "fapi.qrDescription": [
    "Scanning opens a secure page that shows the key once on your phone. Each code expires in {minutes} minutes and works once.",
    "يفتح المسح صفحة آمنة تعرض المفتاح مرة واحدة على هاتفك. ينتهي كل رمز خلال {minutes} دقائق ويعمل مرة واحدة.",
  ],
  "fapi.qrCreate": ["Create QR code", "إنشاء رمز QR"],
  "fapi.qrRefresh": ["New QR code", "رمز QR جديد"],
  "fapi.qrWarning": [
    "Scanning shows the key once. Do not refresh that page or share the QR.",
    "يظهر المفتاح مرة واحدة عند المسح. لا تحدّث تلك الصفحة ولا تشارك رمز QR.",
  ],
  "fapi.qrExpired": ["This QR code has expired. Create a new one.", "انتهت صلاحية رمز QR. أنشئ رمزًا جديدًا."],
  "fapi.usageTitle": ["API usage", "استخدام API"],
  "fapi.totalRequests": ["Requests so far", "إجمالي الطلبات"],
  "fapi.thisHour": ["This hour", "هذه الساعة"],
  "fapi.rateLimit": ["Rate limit", "حد الاستخدام"],
  "fapi.perHour": ["{count} per hour", "{count} في الساعة"],
  "fapi.lastRequest": ["Last request", "آخر طلب"],
  "fapi.never": ["Never", "أبدًا"],
  "fapi.lastStatus": ["Last status", "آخر حالة"],
  "fapi.resetAt": ["Window resets", "يتجدد الحد"],
  "fapi.keyPrefix": ["Key prefix", "بادئة المفتاح"],
  "fapi.created": ["Created", "أُنشئ"],
  "fapi.scope": ["Scope", "النطاق"],
  "fapi.scopeAsk": ["Ask about one field (read-only)", "سؤال عن حقل واحد (قراءة فقط)"],
  "fapi.autoFailed": ["The API key could not be created.", "تعذّر إنشاء مفتاح API."],

  "fapi.docsTitle": ["API documentation", "توثيق API"],
  "fapi.docsIntro": [
    "Any application can ask Fale7 about a field. Send your key with each request; never embed a real key in frontend code.",
    "يمكن لأي تطبيق سؤال Fale7 عن حقل. أرسل مفتاحك مع كل طلب، ولا تضع مفتاحًا حقيقيًا في كود الواجهة.",
  ],
  "fapi.docsAuthTitle": ["Authentication", "المصادقة"],
  "fapi.docsAuthBody": [
    "Send the key in the Authorization header of every request:",
    "أرسل المفتاح في ترويسة Authorization مع كل طلب:",
  ],
  "fapi.docsEndpointTitle": ["Endpoint", "نقطة النهاية"],
  "fapi.docsRequestTitle": ["Request body", "جسم الطلب"],
  "fapi.docsRequestBody": [
    "question (required, 2–1000 characters), field_id (required when the workspace has more than one field), crop (optional, must match the field), language (\"en\" or \"ar\"), conversation_id (optional, for follow-ups).",
    "question (مطلوب، 2–1000 حرف)، field_id (مطلوب عند وجود أكثر من حقل)، crop (اختياري ويجب أن يطابق الحقل)، language (\"en\" أو \"ar\")، conversation_id (اختياري للمتابعة).",
  ],
  "fapi.docsResponseTitle": ["Response", "الاستجابة"],
  "fapi.docsResponseBody": [
    "answer, recommendation, environmental_data, data_sources, warnings, limitations, confidence, provider, model, data_mode, validation and usage.",
    "answer و recommendation و environmental_data و data_sources و warnings و limitations و confidence و provider و model و data_mode و validation و usage.",
  ],
  "fapi.docsExampleRequest": ["Example request", "مثال على الطلب"],
  "fapi.docsExampleResponse": ["Example response (abridged)", "مثال على الاستجابة (مختصر)"],
  "fapi.docsRateTitle": ["Rate limits", "حدود الاستخدام"],
  "fapi.docsRateBody": [
    "Each key allows {count} requests per hour. Exceeding it returns HTTP 429 with the reset time in the message.",
    "يسمح كل مفتاح بـ {count} طلبًا في الساعة. تجاوزها يعيد HTTP 429 مع وقت التجدد في الرسالة.",
  ],
  "fapi.docsErrorsTitle": ["Error responses", "استجابات الأخطاء"],
  "fapi.docsErrorsMeaning": ["Meaning", "المعنى"],
  "fapi.docsErrorsBody": [
    "Errors use one envelope: {\"error\": {\"code\", \"message\", \"details\"}}.",
    "تستخدم الأخطاء غلافًا واحدًا: {\"error\": {\"code\", \"message\", \"details\"}}.",
  ],
  "fapi.docsNoSecret": [
    "The examples use a placeholder key. Never commit a real key to source code or a repository.",
    "تستخدم الأمثلة مفتاحًا بديلًا. لا تضع مفتاحًا حقيقيًا في الكود أو المستودع.",
  ],

  "access.title": ["Your Fale7 API key", "مفتاح Fale7 API"],
  "access.description": [
    "This secure page shows the key once. Copy it into your application now.",
    "تعرض هذه الصفحة الآمنة المفتاح مرة واحدة. انسخه إلى تطبيقك الآن.",
  ],
  "access.warning": [
    "Do not refresh this page: the link is single-use and will stop working.",
    "لا تحدّث هذه الصفحة: الرابط يعمل مرة واحدة وسيتوقف.",
  ],
  "access.goneTitle": ["This link can no longer be used", "لم يعد هذا الرابط صالحًا"],
  "access.goneBody": [
    "It expired, was already opened, or the key was regenerated. Create a new QR code on the Fale7 page.",
    "انتهت صلاحيته أو فُتح سابقًا أو أُعيد إنشاء المفتاح. أنشئ رمز QR جديدًا من صفحة Fale7.",
  ],
  "access.revokedTitle": ["This key was revoked", "تم إلغاء هذا المفتاح"],
  "access.revokedBody": [
    "Generate a new key on the Fale7 page to connect an application.",
    "أنشئ مفتاحًا جديدًا من صفحة Fale7 لربط تطبيق.",
  ],
  "access.back": ["Open Fale7", "افتح Fale7"],
  "access.checking": ["Opening the secure link…", "جارٍ فتح الرابط الآمن…"],
} as const satisfies Record<string, Pair>;

export type RayyanStringKey = keyof typeof STRINGS;

/**
 * Arabic labels for the backend capability registry. The backend text stays the
 * authoritative description in both languages; only the short label is localized.
 */
const CAPABILITY_LABELS_AR: Record<string, string> = {
  nasa_power: "طقس NASA POWER اليومي",
  fao56_irrigation: "تحليل الري FAO-56",
  crop_health_indicators: "مؤشرات الإجهاد البيئي",
  sentinel2_ndvi: "Sentinel-2 NDVI / NDMI",
  nasa_gibs: "صور NASA GIBS satellite",
  open_meteo_forecast: "توقعات طقس 5 أيام",
  geocoding: "البحث عن الأماكن والعنوان العكسي",
  farmer_guide: "دليل المزارع المبسّط",
  demo_snapshot: "لقطة البيانات التجريبية",
  disease_diagnosis: "تشخيص الأمراض",
  pest_identification: "تحديد الآفات",
  nutrient_deficiency: "تشخيص نقص العناصر",
  yield_prediction: "توقع المحصول",
  machine_learning: "استدلال تعلّم آلي",
  continuous_monitoring: "مراقبة مستمرة للحقل",
  on_farm_sensors: "بيانات حساسات ميدانية",
  soil_lab_tests: "تحاليل تربة مخبرية",
  irrigation_schedule: "جدولة الري",
  pesticide_prescription: "وصفة مبيد أو سماد",
  satellite_visual_interpretation: "تفسير الصور والصور الجوية",
  historical_ndvi_trends: "تحليل اتجاه NDVI طويل الأمد",
  forecast_beyond_five_days: "توقعات أبعد من 5 أيام",
  field_comparison: "مقارنة بين الحقول",
};

export function capabilityLabel(lang: "en" | "ar", id: string, fallback: string): string {
  return lang === "ar" ? CAPABILITY_LABELS_AR[id] ?? fallback : fallback;
}

export function rayyanText(lang: "en" | "ar", key: RayyanStringKey): string {
  const pair = STRINGS[key];
  return lang === "ar" ? pair[1] : pair[0];
}

/** Translate Fale7 strings with `{name}` interpolation. */
export function useRayyanT(): {
  t: (key: RayyanStringKey, vars?: Record<string, string | number>) => string;
} {
  const { lang } = useI18n();
  const t = (key: RayyanStringKey, vars?: Record<string, string | number>) => {
    let value = rayyanText(lang, key);
    if (vars) {
      value = value.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    }
    return value;
  };
  return { t };
}
