import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  DatabaseIcon,
  DropIcon,
  GaugeIcon,
  LeafIcon,
  MapPinIcon,
  PlusIcon,
  SparkIcon,
  WheatIcon,
} from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { useI18n } from "../i18n/I18nContext";

type Lang = "en" | "ar";

interface GuideStep {
  title: string;
  body: string[];
  tip?: string;
}

interface GuideCopy {
  back: string;
  eyebrow: string;
  title: string;
  intro: string;
  contents: string;
  contentsLinks: { id: string; label: string }[];
  stepsTitle: string;
  stepLabel: (number: number) => string;
  steps: GuideStep[];
  unitsTitle: string;
  unitsNote: string;
  units: { label: string; value: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  caveat: string;
  createField: string;
  overview: string;
}

const COPY: Record<Lang, GuideCopy> = {
  en: {
    back: "← Back to overview",
    eyebrow: "User guide",
    title: "How to use AgriNASA",
    intro:
      "A practical walkthrough for growers of wheat, potato and tomato, and agronomists in Egypt. Every screen follows one rule: measured data is shown, estimates are labelled, and nothing is invented.",
    contents: "Contents",
    contentsLinks: [
      { id: "guide-steps", label: "Step by step" },
      { id: "guide-units", label: "Numbers and units" },
      { id: "guide-faq", label: "Common questions" },
      { id: "guide-limits", label: "Limits" },
    ],
    stepsTitle: "Step by step",
    stepLabel: (number) => `Step ${number}`,
    steps: [
      {
        title: "Create your field",
        body: [
          "Open Fields → New field. Give the field a name, choose a crop (wheat, potato or tomato) and enter the planting date. Search for the nearest village or farm, click the map once, or type latitude and longitude.",
          "Soil texture, irrigation system and area are optional. Providing them improves the water balance; leaving them blank makes the app assume loam soil and no irrigation efficiency.",
        ],
        tip: "In Egypt, wheat and winter potato are planted in October–November, while the main tomato crop is transplanted in August–September. Always use the real date of your field, not the typical season.",
      },
      {
        title: "Draw the field outline (optional)",
        body: [
          "Press Draw field boundary on the map, then click the four corners of the field in order around its edge. The corners are joined automatically and the estimated area appears in hectares and feddan.",
          "Use Undo corner or Clear outline to correct the shape. Fewer than four corners cannot be saved as an outline: clear the drawing to save a point-only field, or finish the fourth corner.",
        ],
        tip: "The app stores the outline exactly as you click it. It is your drawing, not a satellite measurement or a surveyed boundary. The area is an estimate, not a land-registry figure.",
      },
      {
        title: "Read the dashboard",
        body: [
          "The dashboard shows the latest temperature, rainfall, humidity, wind, solar radiation and reference evapotranspiration (ET₀) for the nearest NASA POWER grid cell, with a trend for each variable.",
          "The water-demand badge and the confidence reasons tell you whether demand is low, moderate or high, and which inputs supported that classification.",
        ],
      },
      {
        title: "Check irrigation",
        body: [
          "The irrigation page simulates root-zone water depletion from planting to the latest complete NASA POWER day using the FAO-56 water balance. It reports the crop stage, Kc, ETc, net and gross water requirement in millimetres, and the assumptions used.",
          "To convert depth to volume: 1 mm over 1 hectare equals 10 m³ of water. Multiply by your field area before ordering water.",
        ],
        tip: "The requirement is an estimate from weather and crop coefficients, not a fixed irrigation schedule. Check soil moisture in the field before irrigating.",
      },
      {
        title: "Review crop health",
        body: [
          "Indicators compare rainfall, heat, root-zone wetness and satellite NDVI with typical ranges for the current growth stage. Every status comes with a reason, and missing inputs are listed instead of hidden.",
          "The indicator-agreement percentage is the share of available indicators that are not at stress level. It is a descriptive count, not a probability of crop health and not a yield prediction.",
          "This is an environmental stress summary. It is not a plant-disease diagnosis — confirm any concern with a local agronomist.",
        ],
      },
      {
        title: "Inspect satellite indices",
        body: [
          "The Satellite tab sends the saved boundary (or the field centre with a 0.5 km buffer) to the backend, which reads Sentinel-1 and Sentinel-2 scenes through Google Earth Engine. It reports a relative surface-wetness class, NDVI, NDMI and NDWI, the acquisition dates and display layers on the map.",
          "This integration needs Earth Engine service-account credentials configured on the server. If they are missing, the page says so; demo mode never simulates satellite values.",
        ],
        tip: "The Sentinel-1 class is a relative surface signal, not volumetric soil moisture. Use it with the irrigation balance, never as a replacement for it.",
      },
      {
        title: "Ask the assistant",
        body: [
          "Ask in English or Arabic about the selected field. The backend computes the numbers first, then the language model explains them using that exact context. The context is stored with the answer.",
          "If no AI key is configured, the assistant returns a rule-based answer and labels it clearly. AI never receives your keys from the browser, and keys are never exposed in the frontend.",
        ],
      },
      {
        title: "Use demo mode",
        body: [
          "The Demo data switch replays a cached NASA POWER snapshot for Qena, Egypt. Every demo result carries a label. Use it to explore the app or to demonstrate it without waiting for live requests.",
          "Turn demo mode off before making decisions for a real field.",
        ],
      },
    ],
    unitsTitle: "Numbers and units",
    unitsNote:
      "The interface uses hectares; the feddan equivalent is shown for drawn areas. All weather values are daily values for the NASA POWER grid cell.",
    units: [
      { label: "Area", value: "1 ha = 10,000 m² = 2.381 feddan · 1 feddan = 0.4201 ha ≈ 4,200 m²" },
      { label: "Irrigation depth", value: "1 mm over 1 ha = 10 m³ of water" },
      { label: "Temperature", value: "°C" },
      { label: "Rain and ET₀", value: "mm (rain totals) · mm/day (ET₀ and ETc)" },
      { label: "NDVI", value: "unitless, −1 to +1; vegetated fields are typically 0.2–0.9" },
      {
        label: "Satellite wetness",
        value: "relative score 0–1 from VV backscatter; not a volumetric moisture percentage",
      },
    ],
    faqTitle: "Common questions",
    faq: [
      {
        q: "Does drawing a boundary change the weather data?",
        a: "No. NASA POWER provides a coarse grid of roughly 0.5° × 0.625° (tens of kilometres). The app samples the grid cell nearest the saved field centre. The polygon is stored for display and area only; it is never used to average or interpolate weather.",
      },
      {
        q: "Where do the coordinates come from?",
        a: "Only from what you enter: a place search (OpenStreetMap Nominatim through the backend), a click on the map, or typed latitude and longitude. The browser does not read your GPS location automatically.",
      },
      {
        q: "Why does a result say “insufficient data”?",
        a: "A field planted in the future, a very new field, or missing variables may not support a defensible answer. The app reports that instead of filling gaps with invented values.",
      },
      {
        q: "Why does the analysis end a few days before today?",
        a: "NASA POWER publishes daily data with a lag. The app ends the analysis on the latest day where every ET₀ input is complete, names the skipped days under Limitations, and never fills them with estimates.",
      },
      {
        q: "What does “season complete” mean?",
        a: "A wheat season is 150 days, potato 120 days and tomato 140 days from the planting date you entered. After that date irrigation demand and crop health are no longer assessed, because post-harvest weather is not crop demand. Create a new field with the next planting date for the new season.",
      },
      {
        q: "Is AgriNASA an official NASA service?",
        a: "No. It is an independent educational prototype. It uses publicly available NASA data, but it is not affiliated with, endorsed by, or operated by NASA.",
      },
      {
        q: "Why does the Satellite tab say it is not configured?",
        a: "Satellite retrieval runs through Google Earth Engine on the backend and needs a service account. Without GEE_SERVICE_ACCOUNT, GEE_PROJECT and a private key, the API returns GEE_UNAVAILABLE and the page explains the setup instead of showing placeholder values.",
      },
      {
        q: "Does it work without internet?",
        a: "The interface needs to reach the backend. Live analyses call NASA POWER, map tiles come from OpenStreetMap, and both need internet. Demo mode uses a cached NASA POWER snapshot, so the weather part can run without a new live request.",
      },
      {
        q: "Who can see my fields and questions?",
        a: "Fields and conversations are stored in the project database on the machine running the backend. If an AI key is configured, the question and the computed field context are sent to that AI provider; no API key is ever sent to the browser.",
      },
    ],
    caveat:
      "Estimates only. This tool supports decisions; it does not replace field observation, soil tests, or professional agronomic advice. Check soil moisture and local conditions before irrigating.",
    createField: "Create a field",
    overview: "Back to overview",
  },
  ar: {
    back: "العودة إلى النظرة العامة",
    eyebrow: "دليل الاستخدام",
    title: "كيف تستخدم AgriNASA",
    intro:
      "دليل عملي لمزارعي القمح والبطاطس والطماطم والمهندسين الزراعيين في مصر. كل شاشة تتبع قاعدة واحدة: نعرض البيانات المقاسة، ونوضّح التقديرات، ولا نخترع أي أرقام.",
    contents: "المحتويات",
    contentsLinks: [
      { id: "guide-steps", label: "خطوات الاستخدام" },
      { id: "guide-units", label: "الأرقام والوحدات" },
      { id: "guide-faq", label: "أسئلة شائعة" },
      { id: "guide-limits", label: "حدود الاستخدام" },
    ],
    stepsTitle: "خطوات الاستخدام",
    stepLabel: (number) => `الخطوة ${number}`,
    steps: [
      {
        title: "أنشئ حقلًا",
        body: [
          "افتح «الحقول» ثم «حقل جديد». أدخل اسم الحقل، واختر المحصول (قمح أو بطاطس أو طماطم)، وأدخل تاريخ الزراعة. ابحث عن أقرب قرية أو مزرعة، أو انقر مرة واحدة على الخريطة، أو اكتب خط الطول وخط العرض.",
          "نوع التربة ونظام الري والمساحة اختيارية. إدخالها يحسّن حساب الموازنة المائية؛ وتركها فارغة يجعل التطبيق يفترض تربة طميية ولا يطبّق كفاءة لنظام الري.",
        ],
        tip: "في مصر يُزرع القمح والبطاطس الشتوية في أكتوبر–نوفمبر، بينما تُنقل شتلات الطماطم الرئيسية في أغسطس–سبتمبر. استخدم دائمًا التاريخ الفعلي لحقلك وليس الموسم المعتاد.",
      },
      {
        title: "ارسم حدود الحقل (اختياري)",
        body: [
          "اضغط «رسم حدود الحقل» على الخريطة، ثم انقر على زوايا الحقل الأربع بالترتيب حول الحافة. تُوصَل الزوايا تلقائيًا وتظهر المساحة التقديرية بالهكتار والفدان.",
          "استخدم «التراجع عن آخر زاوية» أو «مسح الرسم» لتصحيح الشكل. لا يمكن حفظ أقل من أربع زوايا كحدود: امسح الرسم لحفظ الحقل كنقطة فقط، أو أكمل الزاوية الرابعة.",
        ],
        tip: "يحفظ التطبيق الرسم كما نقرت عليه تمامًا. هو رسمك أنت، وليس قياسًا من الأقمار الصناعية ولا حدودًا مساحية رسمية. والمساحة تقديرية وليست رقمًا من الشهر العقاري.",
      },
      {
        title: "اقرأ لوحة المتابعة",
        body: [
          "تعرض لوحة المتابعة أحدث قيم الحرارة والأمطار والرطوبة والرياح والإشعاع الشمسي والتبخّر المرجعي (ET₀) لخلية NASA POWER الأقرب، مع اتجاه التغيّر لكل متغيّر.",
          "توضّح شارة الطلب المائي وأسباب الثقة ما إذا كان الطلب منخفضًا أو متوسطًا أو مرتفعًا، وما المدخلات التي بني عليها التصنيف.",
        ],
      },
      {
        title: "راجع الري",
        body: [
          "تحاكي صفحة الري نقص الماء في منطقة الجذور من الزراعة حتى أحدث يوم كامل في NASA POWER باستخدام موازنة FAO-56 المائية. وتعرض مرحلة النمو، ومعامل المحصول Kc، والاحتياج الصافي والكلي للماء بالمليمتر، والافتراضات المستخدمة.",
          "لتحويل عمق الماء إلى حجم: 1 مم على هكتار واحد يساوي 10 م³ من الماء. اضرب في مساحة حقلك قبل طلب مياه الري.",
        ],
        tip: "الاحتياج تقدير مبني على الطقس ومعاملات المحصول، وليس جدول ري ثابتًا. تحقّق من رطوبة التربة في الحقل قبل الري.",
      },
      {
        title: "تابع صحة المحصول",
        body: [
          "تقارن المؤشرات الأمطار والحرارة ورطوبة منطقة الجذور ومؤشر NDVI الفضائي بالنطاقات المعتادة لمرحلة النمو الحالية. كل تصنيف مرفق بسببه، وتُعرض المدخلات الناقصة بدل إخفائها.",
          "نسبة توافق المؤشرات هي حصة المؤشرات المتاحة التي ليست عند مستوى إجهاد. وهي عدد وصفي، وليست احتمالًا لصحة المحصول ولا تنبؤًا بالمحصول.",
          "هذا ملخص للإجهاد البيئي، وليس تشخيصًا لمرض نباتي. راجع المهندس الزراعي المحلي عند وجود شك في مرض أو إصابة.",
        ],
      },
      {
        title: "راجع مؤشرات الأقمار الصناعية",
        body: [
          "تُرسل تبويبة «الأقمار الصناعية» الحدود المحفوظة (أو مركز الحقل مع نطاق 0.5 كم) إلى الخادم، الذي يقرأ مشاهد سينتينل-1 وسينتينل-2 عبر Google Earth Engine. وتعرض فئة رطوبة سطح نسبية وNDVI وNDMI وNDWI وتواريخ الالتقاط وطبقات العرض على الخريطة.",
          "يتطلب هذا التكامل تهيئة بيانات اعتماد حساب خدمة Earth Engine على الخادم. وإذا كانت غائبة تقول الصفحة ذلك؛ ولا يحاكي الوضع التجريبي قيم الأقمار الصناعية.",
        ],
        tip: "فئة سينتينل-1 إشارة سطحية نسبية وليست رطوبة تربة حجمية. استخدمها مع موازنة الري، لا بديلًا عنها.",
      },
      {
        title: "اسأل المساعد",
        body: [
          "اسأل بالعربية أو الإنجليزية عن الحقل المحدد. يحسب الخادم الأرقام أولًا، ثم يشرحها نموذج اللغة مستندًا إلى هذا السياق بالتحديد، ويُحفظ السياق مع الإجابة.",
          "إذا لم يُضبط مفتاح ذكاء اصطناعي، يعيد المساعد إجابة قائمة على قواعد ويوسمها بوضوح. لا يستلم المتصفح أي مفتاح، ولا تظهر المفاتيح أبدًا في واجهة الموقع.",
        ],
      },
      {
        title: "استخدم الوضع التجريبي",
        body: [
          "يعيد مفتاح «بيانات تجريبية» تشغيل لقطة محفوظة من NASA POWER لقنا في مصر. كل نتيجة تجريبية تحمل وسمًا واضحًا. استخدمها للاستكشاف أو للعرض دون انتظار الطلبات الحية.",
          "أوقف الوضع التجريبي قبل اتخاذ قرارات تخص حقلًا حقيقيًا.",
        ],
      },
    ],
    unitsTitle: "الأرقام والوحدات",
    unitsNote:
      "تستخدم الواجهة الهكتار، وتُعرض القيمة المقابلة بالفدان للمساحات المرسومة. جميع قيم الطقس يومية وخاصة بخلية NASA POWER.",
    units: [
      { label: "المساحة", value: "1 هكتار = 10,000 م² = 2.381 فدان · 1 فدان = 0.4201 هكتار ≈ 4,200 م²" },
      { label: "عمق الري", value: "1 مم على هكتار = 10 م³ من الماء" },
      { label: "الحرارة", value: "°م" },
      { label: "الأمطار والـ ET₀", value: "مم (تراكم الأمطار) · مم/يوم (ET₀ و ETc)" },
      { label: "NDVI", value: "بلا وحدة، من −1 إلى +1؛ الحقول المزروعة عادةً بين 0.2 و0.9" },
      {
        label: "الرطوبة الفضائية",
        value: "درجة نسبية من 0 إلى 1 من ارتداد VV؛ وليست نسبة رطوبة حجمية",
      },
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      {
        q: "هل يغيّر رسم الحدود بيانات الطقس؟",
        a: "لا. توفّر NASA POWER شبكة تقريبية بخطوة نحو 0.5° × 0.625° (عشرات الكيلومترات). يأخذ التطبيق الخلية الأقرب لمركز الحقل المحفوظ. يُحفظ المضلع للعرض والمساحة فقط، ولا يُستخدم لمتوسط أو استقراء قيم الطقس.",
      },
      {
        q: "من أين تأتي الإحداثيات؟",
        a: "فقط مما تدخله أنت: البحث عن مكان (OpenStreetMap Nominatim عبر الخادم)، أو النقر على الخريطة، أو كتابة خط الطول وخط العرض. لا يقرأ المتصفح موقعك عبر GPS تلقائيًا.",
      },
      {
        q: "لماذا تظهر نتيجة «بيانات غير كافية»؟",
        a: "الحقل المزروع في تاريخ مستقبلي، أو الحقل الحديث جدًا، أو المتغيّرات الناقصة قد لا تكفي لإجابة موثوقة. يعرض التطبيق ذلك بدل ملء الفراغات بقيم مخترعة.",
      },
      {
        q: "لماذا ينتهي التحليل قبل اليوم بعدة أيام؟",
        a: "تنشر NASA POWER البيانات اليومية متأخرة بضعة أيام. وينتهي التحليل في التطبيق عند أحدث يوم تكتمل فيه جميع مدخلات ET₀، وتُذكر الأيام المتجاوزة ضمن القيود، ولا تُملأ أبدًا بقيم تقديرية.",
      },
      {
        q: "ماذا يعني «انتهى الموسم»؟",
        a: "موسم القمح 150 يومًا، والبطاطس 120 يومًا، والطماطم 140 يومًا من تاريخ الزراعة الذي أدخلته. وبعد ذلك التاريخ لا يُقيَّم طلب الري ولا صحة المحصول، لأن طقس ما بعد الحصاد ليس طلبًا للمحصول. أنشئ حقلًا جديدًا بتاريخ الزراعة القادم للموسم الجديد.",
      },
      {
        q: "هل AgriNASA خدمة رسمية من ناسا؟",
        a: "لا. هو نموذج تعليمي مستقل يستخدم بيانات ناسا المتاحة للعامة، وليس تابعًا لناسا أو معتمدًا منها أو مُدارًا بواسطتها.",
      },
      {
        q: "لماذا تقول تبويبة الأقمار الصناعية إنها غير مُهيَّأة؟",
        a: "يجري استرجاع بيانات الأقمار الصناعية عبر Google Earth Engine على الخادم ويحتاج إلى حساب خدمة. وبدون GEE_SERVICE_ACCOUNT وGEE_PROJECT ومفتاح خاص، تعيد الواجهة البرمجية GEE_UNAVAILABLE وتشرح الصفحة خطوات التهيئة بدل عرض قيم بديلة.",
      },
      {
        q: "هل يعمل دون إنترنت؟",
        a: "تحتاج الواجهة إلى الوصول إلى الخادم. التحليلات الحية تستدعي NASA POWER، وبلاطات الخريطة تأتي من OpenStreetMap، وكلاهما يحتاج إنترنت. أما الوضع التجريبي فيستخدم لقطة NASA POWER محفوظة، فيمكن لجزء الطقس أن يعمل دون طلب حي جديد.",
      },
      {
        q: "من يرى حقولي وأسئلتي؟",
        a: "تُحفظ الحقول والمحادثات في قاعدة بيانات المشروع على الجهاز الذي يشغّل الخادم. وإذا ضُبط مفتاح ذكاء اصطناعي، يُرسل السؤال وسياق الحقل المحسوب إلى مزوّد الذكاء الاصطناعي، ولا يُرسل أي مفتاح إلى المتصفح.",
      },
    ],
    caveat:
      "تقديرات فقط. تساعدك الأداة على اتخاذ القرار، لكنها لا تُغني عن الملاحظة الميدانية أو تحليل التربة أو المشورة الزراعية المتخصصة. تحقّق دائمًا من رطوبة التربة والظروف المحلية قبل الري.",
    createField: "أنشئ حقلًا",
    overview: "العودة إلى النظرة العامة",
  },
};

const STEP_ICONS: ReactNode[] = [
  <WheatIcon key="create" size={17} />,
  <MapPinIcon key="draw" size={17} />,
  <GaugeIcon key="dashboard" size={17} />,
  <DropIcon key="irrigation" size={17} />,
  <LeafIcon key="health" size={17} />,
  <SparkIcon key="assistant" size={17} />,
  <DatabaseIcon key="demo" size={17} />,
];

/**
 * Bilingual user guide for Egyptian users.
 *
 * The language follows the site-wide toggle, including text direction, so the
 * guide never disagrees with the header. Arabic deliberately uses a Naskh-first
 * font stack and no letter-spacing, because tracked uppercase typography breaks
 * Arabic joining.
 */
export function GuidePage() {
  const { lang, setLang } = useI18n();
  const copy = COPY[lang as Lang];
  const rtl = lang === "ar";

  return (
    <div className="container-narrow py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="link-underline text-xs">
          {copy.back}
        </Link>
        <div
          className="inline-flex overflow-hidden rounded-md border border-line bg-card text-xs"
          role="group"
          aria-label="Guide language / لغة الدليل"
        >
          <button
            type="button"
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            className={`px-3 py-1.5 transition-colors ${
              lang === "en" ? "bg-forest-800 font-semibold text-paper" : "text-muted hover:text-ink"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("ar")}
            aria-pressed={lang === "ar"}
            lang="ar"
            className={`px-3 py-1.5 transition-colors ${
              lang === "ar" ? "bg-forest-800 font-semibold text-paper" : "text-muted hover:text-ink"
            }`}
          >
            العربية
          </button>
        </div>
      </div>

      <article lang={lang} dir={rtl ? "rtl" : "ltr"} className={rtl ? "font-arabic" : undefined}>
        <header className="mt-6 rounded-card border border-line bg-card p-6 shadow-card sm:p-8">
          <p
            className={
              rtl
                ? "text-xs font-semibold text-forest-600"
                : "font-mono text-2xs font-medium uppercase tracking-[0.16em] text-forest-600"
            }
          >
            {copy.eyebrow}
          </p>
          <h1 className={`mt-2 text-2xl sm:text-3xl ${rtl ? "tracking-normal" : "tracking-[-0.025em]"}`}>
            {copy.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{copy.intro}</p>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label={copy.contents}>
            {copy.contentsLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="rounded-full border border-line bg-sage-50 px-3 py-1 text-2xs text-forest-700 transition-colors hover:border-forest-300 hover:bg-forest-50"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </header>

        <section id="guide-steps" className="mt-10 scroll-mt-24">
          <h2 className="text-xl sm:text-2xl">{copy.stepsTitle}</h2>
          <ol className="mt-4 space-y-3">
            {copy.steps.map((step, index) => (
              <li key={step.title} className="card card-pad">
                <div className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-forest-50 text-forest-700">
                    {STEP_ICONS[index]}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={
                        rtl
                          ? "text-2xs font-semibold text-muted"
                          : "font-mono text-2xs uppercase tracking-[0.12em] text-muted"
                      }
                    >
                      {copy.stepLabel(index + 1)}
                    </p>
                    <h3 className="mt-1 text-base">{step.title}</h3>
                    {step.body.map((paragraph) => (
                      <p key={paragraph} className="mt-1.5 text-sm leading-relaxed text-muted">
                        {paragraph}
                      </p>
                    ))}
                    {step.tip && (
                      <p className="mt-2 rounded border border-clay-200 bg-clay-50 px-3 py-2 text-2xs leading-relaxed text-clay-600">
                        {step.tip}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="guide-units" className="mt-10 scroll-mt-24">
          <div className="card card-pad">
            <h2 className="text-xl sm:text-2xl">{copy.unitsTitle}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{copy.unitsNote}</p>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {copy.units.map((unit) => (
                <div key={unit.label} className="rounded-md border border-line bg-sage-50/60 px-3 py-2">
                  <dt className="text-2xs font-semibold text-muted">{unit.label}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-ink" dir="auto">
                    {unit.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="guide-faq" className="mt-10 scroll-mt-24">
          <h2 className="text-xl sm:text-2xl">{copy.faqTitle}</h2>
          <div className="mt-4 space-y-2">
            {copy.faq.map((item) => (
              <details key={item.q} className="group rounded-md border border-line bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="shrink-0 text-muted transition-transform group-open:rotate-45">
                    <PlusIcon size={14} />
                  </span>
                </summary>
                <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-muted">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section id="guide-limits" className="mt-10 scroll-mt-24">
          <InfoNote title={rtl ? "حدود الاستخدام" : "Limits"} tone="warn">
            {copy.caveat}
          </InfoNote>
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link to="/fields/new" className="btn-primary btn-sm">
            {copy.createField}
            <ArrowRightIcon size={14} />
          </Link>
          <Link to="/" className="btn-secondary btn-sm">
            {copy.overview}
          </Link>
        </div>
      </article>
    </div>
  );
}
