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
