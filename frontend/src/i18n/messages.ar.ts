/**
 * Arabic copy keyed by the exact English source string used in `t()`.
 *
 * English stays the source of truth: any key that is missing here falls back to
 * English rather than showing a blank or a machine-like string. Values that
 * contain numbers (weather figures, dates) are interpolated by `t()`.
 */
export const AR_MESSAGES: Record<string, string> = {
  "% · higher values reduce atmospheric demand": "٪ · القيم الأعلى تقلّل الطلب الجوي",
  "(optional)": "(اختياري)",
  "+{n} more indicators on the health page.": "+{n} مؤشرات أخرى في صفحة صحة المحصول.",
  ", so the range controls are disabled.": "، لذلك تُعطّل أدوات اختيار المدة.",
  "/ {n} d": "/ {n} يوم",
  "0–1 fraction · not used as a measured input to the bucket model":
    "كسر من 0 إلى 1 · لا يُستخدم كمدخل مقيس في نموذج خزان التربة",
  "100% deterministic": "100% حتمي",
  "135–150 days": "135–150 يومًا",
  "404 · No such field": "404 · لا يوجد حقل بهذا العنوان",
  "55% moderate": "55% متوسط",
  "80% high": "80% مرتفع",
  "A decision-support tool you can audit": "أداة لدعم القرار يمكنك مراجعتها",
  "A grid cell is not a field": "خلية الشبكة ليست حقلاً",
  "A root-zone water balance estimates depletion and refill demand.":
    "تحسب الموازنة المائية لمنطقة الجذور مقدار النقص والاحتياج إلى إعادة التعبئة.",
  "AI assistant": "المساعد الذكي",
  "AI explanation": "شرح بالذكاء الاصطناعي",
  "AI field assistant": "مساعد الحقل الذكي",
  "Active field": "الحقل النشط",
  "AgriNASA answers a narrow, practical question for the supported crops: given coarse NASA climate data, the planting date and basic soil assumptions, how much water has the root zone lost — and how much should you care this week?":
    "يجيب AgriNASA عن سؤال عملي محدّد للمحاصيل المدعومة: بالنظر إلى بيانات NASA المناخية التقريبية وتاريخ الزراعة والافتراضات الأساسية للتربة، كم فقدت منطقة الجذور من الماء — وإلى أي مدى يجب أن تقلق هذا الأسبوع؟",
  "AgriNASA home": "الصفحة الرئيسية لـ AgriNASA",
  "AgriNASA · educational decision-support prototype": "AgriNASA · نموذج تعليمي لدعم القرار",
  "Air temperature": "حرارة الهواء",
  "All-sky shortwave downward irradiance — the energy input to evapotranspiration.":
    "الإشعاع الشمسي القصير الموجة النازل في كل الأحوال الجوية — مصدر الطاقة للتبخّر والنتح.",
  "Answers are built from the current NASA POWER data, irrigation model and crop-health indicators. If a value is missing, the assistant is instructed to say so.":
    "تُبنى الإجابات من بيانات NASA POWER الحالية ونموذج الري ومؤشرات صحة المحصول. وإذا كانت قيمة ما ناقصة، فالمساعد مُوجَّه إلى الإفصاح عن ذلك.",
  "Answers will describe the cached Qena snapshot, not your field. The banner above every page repeats this. Switch to live data to ask about the selected field.":
    "ستصف الإجابات لقطة قنا المحفوظة، لا حقلك. يكرّر الشريط أعلى كل صفحة ذلك. انتقل إلى البيانات الحية للسؤال عن الحقل المحدد.",
  "Approximate extent for {n} ha — not a surveyed field boundary":
    "امتداد تقريبي لمساحة {n} هكتار — ليس حدودًا مساحية للحقل",
  "Area": "المساحة",
  "Area (ha)": "المساحة (هكتار)",
  "Area appears after the third corner; four corners are required to save the outline.":
    "تظهر المساحة بعد الزاوية الثالثة؛ وتلزم أربع زوايا لحفظ الحدود.",
  "Ask about irrigation, rainfall, temperature, crop health…":
    "اسأل عن الري أو الأمطار أو الحرارة أو صحة المحصول…",
  "Ask about the computed data": "اسأل عن البيانات المحسوبة",
  "Ask about this field": "اسأل عن هذا الحقل",
  "Ask the assistant": "اسأل المساعد",
  "Ask the field assistant": "اسأل مساعد الحقل",
  "Ask the field assistant a question": "اطرح سؤالًا على مساعد الحقل",
  "Assessed for {date} from weather, water-balance and optional vegetation inputs. This module does not diagnose disease, pests or nutrient deficiency.":
    "تم التقييم بتاريخ {date} من الطقس والموازنة المائية ومدخلات الغطاء النباتي الاختيارية. لا تشخّص هذه الوحدة الأمراض أو الآفات أو نقص العناصر الغذائية.",
  "Assessing environmental stress indicators…": "جارٍ تقييم مؤشرات الإجهاد البيئي…",
  "Assessing environmental stress…": "جارٍ تقييم الإجهاد البيئي…",
  "Assign a confidence percentage to a stress class.":
    "إسناد نسبة ثقة إلى تصنيف الإجهاد.",
  "Assistant": "المساعد",
  "Assistant preview": "معاينة المساعد",
  "Assumed loam": "تربة طميية مفترضة",
  "Available": "متاح",
  "Back to fields": "العودة إلى الحقول",
  "Browse fields": "تصفّح الحقول",
  "Built for one crop, designed for more": "مبني لمحصول واحد، ومصمم لمزيد",
  "Calculation chain": "سلسلة الحساب",
  "Cancel": "إلغاء",
  "Capabilities": "الإمكانات",
  "Change over the last {n} days": "التغيّر خلال آخر {n} أيام",
  "Chart date range": "المدة الزمنية للرسم",
  "Checking vegetation observations…": "جارٍ التحقق من أرصاد الغطاء النباتي…",
  "Choose a field before opening analytics.": "اختر حقلًا قبل فتح التحليلات.",
  "Choose a field before opening irrigation analysis.":
    "اختر حقلًا قبل فتح تحليل الري.",
  "Choose a field before opening the assistant.": "اختر حقلًا قبل فتح المساعد.",
  "Choose a field before opening the crop-health analysis.":
    "اختر حقلًا قبل فتح تحليل صحة المحصول.",
  "Choose both a start and end date.": "اختر تاريخ البداية وتاريخ النهاية.",
  "Choose or create a field to open its dashboard.":
    "اختر حقلًا أو أنشئ حقلًا لفتح لوحة متابعته.",
  "Clear outline": "مسح الرسم",
  "Click the map once to set the field point, or start drawing to outline the field with four corners.":
    "انقر على الخريطة مرة واحدة لتحديد موقع الحقل، أو ابدأ الرسم لتحديد حدوده بأربع زوايا.",
  "Click the map to place corner {n} of 4. Corners are joined in the order you click.":
    "انقر على الخريطة لإضافة الزاوية {n} من 4. تُوصَل الزوايا بترتيب النقر.",
  "Clicked point": "النقطة المنقورة",
  "Close menu": "إغلاق القائمة",
  "Computed inputs": "المدخلات المحسوبة",
  "Conditions over time": "الأحوال على مدار الوقت",
  "Confidence": "الثقة",
  "Contributing factors": "العوامل المساهمة",
  "Coordinates select the NASA POWER grid cell. Crop and planting date drive the growth-stage coefficients. Soil and irrigation details improve the water-balance estimate but are optional.":
    "تحدد الإحداثيات خلية NASA POWER. ويحدد المحصول وتاريخ الزراعة معاملات مرحلة النمو. وتفاصيل التربة والري تحسّن تقدير الموازنة المائية لكنها اختيارية.",
  "Corner {n}": "الزاوية {n}",
  "Could not create the field": "تعذّر إنشاء الحقل",
  "Create a field": "أنشئ حقلًا",
  "Create a field profile": "أنشئ ملف حقل",
  "Create a field profile, then open its dashboard for NASA POWER conditions, FAO-56 irrigation demand and environmental crop-health indicators.":
    "أنشئ ملف حقل، ثم افتح لوحة متابعته لأحوال NASA POWER وطلب الري وفق FAO-56 ومؤشرات صحة المحصول البيئية.",
  "Create field": "إنشاء حقل",
  "Create your first field": "أنشئ حقلك الأول",
  "Create your first field to start a location-aware analysis. You can use the demo snapshot to explore the platform without live NASA requests.":
    "أنشئ حقلك الأول لبدء تحليل مرتبط بالموقع. ويمكنك استخدام اللقطة التجريبية لاستكشاف المنصة دون طلبات NASA الحية.",
  "Creating…": "جارٍ الإنشاء…",
  "Crop": "المحصول",
  "Crop age": "عمر المحصول",
  "Crop health": "صحة المحصول",
  "Crop health analysis": "تحليل صحة المحصول",
  "Crop health analysis unavailable": "تحليل صحة المحصول غير متاح",
  "Crop health is STRESSED": "صحة المحصول تحت إجهاد",
  "Crop health unavailable": "صحة المحصول غير متاحة",
  "Crop water demand": "طلب المحصول المائي",
  "Crop water use": "استهلاك المحصول للماء",
  "Crop-health indicators and NDVI availability for the field.":
    "مؤشرات صحة المحصول وتوافر NDVI للحقل.",
  "Current priorities": "الأولويات الحالية",
  "Current status": "الحالة الحالية",
  "Custom coordinates": "إحداثيات يدوية",
  "DEMO": "تجريبي",
  "DEMO DATA": "بيانات تجريبية",
  "Daily NASA POWER values for the field's grid cell. Every chart states its units and source; missing values are gaps, not zeroes.":
    "قيم NASA POWER اليومية لخلية الحقل. يوضّح كل رسم وحداته ومصدره؛ والقيم الناقصة تظهر كفراغات لا كأصفار.",
  "Daily mean relative humidity at 2 m.": "متوسط الرطوبة النسبية اليومية على ارتفاع مترين.",
  "Daily mean, maximum and minimum at 2 m.":
    "المتوسط والحد الأقصى والحد الأدنى اليومي على ارتفاع مترين.",
  "Daily means · °C / mm · bars are daily totals": "متوسطات يومية · °م / مم · الأعمدة تراكمات يومية",
  "Dark mode": "الوضع الداكن",
  "Data & method": "البيانات والمنهج",
  "Data & sources": "البيانات والمصادر",
  "Data handling": "التعامل مع البيانات",
  "Data provenance & limitations": "مصدر البيانات وحدودها",
  "Data source": "مصدر البيانات",
  "Data sources": "مصادر البيانات",
  "Data sources & limits": "المصادر والحدود",
  "Dataset": "مجموعة البيانات",
  "Date range": "المدة الزمنية",
  "Day {n}": "اليوم {n}",
  "Day {n} after planting": "اليوم {n} بعد الزراعة",
  "Days returned": "الأيام المُعادة",
  "Decision support for wheat, potato and tomato, built on NASA POWER environmental data and FAO-56 water-balance science. Deterministic models compute; AI explains.":
    "دعم قرار للقمح والبطاطس والطماطم، مبني على بيانات NASA POWER البيئية وعلم الموازنة المائية FAO-56. النماذج الحتمية تحسب؛ والذكاء الاصطناعي يشرح.",
  "Delete field": "حذف الحقل",
  "Delete {name}": "حذف {name}",
  "Demand classes have documented thresholds": "لتصنيفات الطلب حدود موثّقة",
  "Demand thresholds (55% and 80% of TAW) are documented agronomic heuristics, not a validated field prescription. See the backend ":
    "حدود الطلب (55% و80% من إجمالي الماء المتاح) قواعد زراعية موثّقة، وليست وصفة ميدانية معتمدة. راجع ملف الخادم ",
  "Demo data": "بيانات تجريبية",
  "Demo data off": "البيانات التجريبية متوقفة",
  "Demo data on": "البيانات التجريبية مفعّلة",
  "Demo mode is on": "الوضع التجريبي مفعّل",
  "Demo mode replays the cached Qena snapshot. Values, units and calculations are real; the location and dates are not this field's.":
    "يعيد الوضع التجريبي تشغيل لقطة قنا المحفوظة. القيم والوحدات والحسابات حقيقية؛ أما الموقع والتواريخ فليست لحقلك.",
  "Demo mode uses a fixed window": "الوضع التجريبي يستخدم مدة ثابتة",
  "Demo replay is clearly labelled": "الإعادة التجريبية موسومة بوضوح",
  "Demo snapshot season · not today": "موسم اللقطة التجريبية · ليس اليوم",
  "Demo snapshot selected": "تم اختيار اللقطة التجريبية",
  "Depletion": "النقص المائي",
  "Depletion is compared with readily available water (RAW), recent rainfall and ETc. The result is one of three classes with the contributing factors attached — not a generated recommendation.":
    "يُقارن النقص بالماء المتاح بسهولة (RAW) والأمطار الأخيرة وETc. والنتيجة واحدة من ثلاث فئات مرفقة بأسبابها — وليست توصية مُولَّدة.",
  "Deterministic FAO-56 calculation": "حساب حتمي وفق FAO-56",
  "Deterministic FAO-56 calculation for {date}. The model uses NASA POWER weather, a stage-based crop Kc curve and a root-zone water bucket.":
    "حساب حتمي وفق FAO-56 بتاريخ {date}. يستخدم النموذج طقس NASA POWER ومنحنى Kc للمحصول حسب مرحلة النمو وخزان ماء لمنطقة الجذور.",
  "Draw field boundary": "رسم حدود الحقل",
  "Drawing: click the map": "الرسم: انقر على الخريطة",
  "ET₀ (latest)": "ET₀ (الأحدث)",
  "ET₀ (mm/day)": "ET₀ (مم/يوم)",
  "ET₀ and the stage-based crop coefficient produce ETc.":
    "ينتج عن ET₀ ومعامل المحصول حسب المرحلة قيمة ETc.",
  "ET₀ input coverage": "تغطية مدخلات ET₀",
  "ET₀ {et0} mm/day from the latest day with complete temperature, humidity, wind, pressure and solar inputs.":
    "ET₀ = {et0} مم/يوم من آخر يوم تتوفر فيه مدخلات كاملة للحرارة والرطوبة والرياح والضغط والإشعاع الشمسي.",
  "Each known indicator is classified independently. The overall status needs at least two known indicators; otherwise it stays “insufficient data”. Unknown indicators are never treated as good.":
    "يُصنَّف كل مؤشر معروف على حدة. وتحتاج الحالة الإجمالية إلى مؤشرين معروفين على الأقل؛ وإلا بقيت «بيانات غير كافية». ولا تُعامَل المؤشرات المجهولة أبدًا كحالة جيدة.",
  "Each step has a single owner in the codebase, so you can trace any number back to its source.":
    "لكل خطوة مالك واحد في الشيفرة، فيمكنك تتبع أي رقم حتى مصدره.",
  "End": "النهاية",
  "Environmental analytics": "التحليلات البيئية",
  "Environmental data could not be loaded": "تعذّر تحميل البيانات البيئية",
  "Environmental data unavailable": "البيانات البيئية غير متاحة",
  "Environmental stress indicators": "مؤشرات الإجهاد البيئي",
  "Environmental stress indicators only — this is not a disease, pest or nutrient diagnosis.":
    "مؤشرات إجهاد بيئي فقط — وليس تشخيصًا لمرض أو آفة أو نقص عناصر غذائية.",
  "Environmental window {start} → {end}. NASA POWER values are model-derived for a coarse grid cell.":
    "النافذة البيئية {start} → {end}. قيم NASA POWER مشتقة من نموذج لخلية شبكة تقريبية.",
  "Estimated from the corners you clicked, not a survey. Used only when the area field is left blank.":
    "مقدّرة من الزوايا التي نقرتها، وليست مسحًا. تُستخدم فقط عند ترك خانة المساحة فارغة.",
  "Estimates are not a substitute for field observation or professional agronomic advice.":
    "التقديرات ليست بديلًا عن الملاحظة الميدانية أو المشورة الزراعية المتخصصة.",
  "Every dataset is named, classified and bounded": "كل مجموعة بيانات مسماة ومصنفة ومحدودة",
  "Explain these results": "اشرح هذه النتائج",
  "Explains computed values · cannot create measurements":
    "يشرح القيم المحسوبة · ولا ينشئ قياسات",
  "Explore without live data": "استكشف دون بيانات حية",
  "FAO-56 Table 12 defaults with linear stage interpolation (eq. 66–68). Not field-measured.":
    "قيم FAO-56 الافتراضية من الجدول 12 مع استقراء خطي بين المراحل (المعادلات 66–68). غير مقيسة ميدانيًا.",
  "FAO-56 irrigation paper": "ورقة الري FAO-56",
  "FAO-56 water balance, demand class, refill estimate and stage Kc.":
    "موازنة مائية FAO-56 وفئة الطلب وتقدير إعادة التعبئة وKc المرحلة.",
  "FAO-56, not a black box": "FAO-56، لا صندوق أسود",
  "Fetching weather and running the FAO-56 water balance…":
    "جارٍ جلب الطقس وتشغيل الموازنة المائية FAO-56…",
  "Field assistant": "مساعد الحقل",
  "Field could not be loaded": "تعذّر تحميل الحقل",
  "Field identity": "هوية الحقل",
  "Field location": "موقع الحقل",
  "Field location map": "خريطة موقع الحقل",
  "Field name": "اسم الحقل",
  "Field overview": "نظرة عامة على الحقل",
  "Field point": "نقطة الحقل",
  "Field sections": "أقسام الحقل",
  "Field workspace": "مساحة عمل الحقل",
  "Fields": "الحقول",
  "Fields could not be loaded": "تعذّر تحميل الحقول",
  "Five steps from coordinates to an explained answer":
    "خمس خطوات من الإحداثيات إلى إجابة مشروحة",
  "For the water-balance detail behind the stress indicator, open":
    "للاطلاع على تفاصيل الموازنة المائية وراء مؤشر الإجهاد، افتح",
  "Full health analysis": "تحليل الصحة الكامل",
  "Future dates are allowed for planning; analyses will report that the crop has not started.":
    "تُقبل التواريخ المستقبلية للتخطيط؛ وستفيد التحليلات بأن المحصول لم يبدأ بعد.",
  "Go to fields": "الانتقال إلى الحقول",
  "Grounded": "مستند",
  "Growth stage and Kc": "مرحلة النمو وKc",
  "Guide": "الدليل",
  "Hide NASA imagery": "إخفاء صور NASA",
  "Home": "الرئيسية",
  "How answers are grounded": "كيف تُستند الإجابات",
  "How it works": "كيف يعمل",
  "How the assistant works": "كيف يعمل المساعد",
  "How the status is decided": "كيف تُحدَّد الحالة",
  "Human-readable place name": "اسم المكان المقروء",
  "Humidity (%)": "الرطوبة (%)",
  "INSUFFICIENT DATA": "بيانات غير كافية",
  "Identify a disease, pest or nutrient deficiency.":
    "تحديد مرض أو آفة أو نقص عنصر غذائي.",
  "In {n} days": "خلال {n} أيام",
  "Incomplete variables in this window": "متغيرات ناقصة في هذه المدة",
  "Independent educational project. Not affiliated with, endorsed by, or operated by NASA. NASA data is publicly available and used under its open data policy.":
    "مشروع تعليمي مستقل. غير تابع لناسا ولا معتمد منها ولا مُدار بواسطتها. بيانات ناسا متاحة للعامة وتُستخدم وفق سياسة البيانات المفتوحة.",
  "Indicator definitions": "تعريفات المؤشرات",
  "Indicator method": "منهج المؤشرات",
  "Indicators": "المؤشرات",
  "Inputs": "المدخلات",
  "Inputs available to the assistant": "المدخلات المتاحة للمساعد",
  "Irrigation": "الري",
  "Irrigation analysis": "تحليل الري",
  "Irrigation analysis unavailable": "تحليل الري غير متاح",
  "Irrigation demand": "طلب الري",
  "Irrigation demand is HIGH": "طلب الري مرتفع",
  "Irrigation system": "نظام الري",
  "It can": "يستطيع",
  "It cannot": "لا يستطيع",
  "It does": "يفعل",
  "It does not": "لا يفعل",
  "It never measures.": "ولا يقيس أبدًا.",
  "Language model configured": "نموذج اللغة مُهيَّأ",
  "Last 30 days of NASA POWER daily values for this grid cell. Rainfall uses the right-hand axis.":
    "آخر 30 يومًا من قيم NASA POWER اليومية لهذه الخلية. الأمطار على المحور الأيمن.",
  "Latest observation {date} · trend": "أحدث رصد {date} · الاتجاه",
  "Latitude": "خط العرض",
  "Leave blank to use the drawn outline estimate.":
    "اتركها فارغة لاستخدام تقدير الرسم.",
  "Light mode": "الوضع الفاتح",
  "Limitations": "الحدود",
  "Linearly interpolated wheat crop coefficient across initial, development, mid-season and late stages, peaking at 1.15.":
    "معامل المحصول للقمح باستقراء خطي بين المراحل الأولية والنمو ومنتصف الموسم والنهاية، بذروة 1.15.",
  "Loading NASA POWER conditions…": "جارٍ تحميل أحوال NASA POWER…",
  "Loading daily NASA POWER data…": "جارٍ تحميل بيانات NASA POWER اليومية…",
  "Loading demo…": "جارٍ تحميل البيانات التجريبية…",
  "Loading field profile…": "جارٍ تحميل ملف الحقل…",
  "Loading fields…": "جارٍ تحميل الحقول…",
  "Loading saved conversation…": "جارٍ تحميل المحادثة المحفوظة…",
  "Loading the environmental window for this field.":
    "جارٍ تحميل النافذة البيئية لهذا الحقل.",
  "Location": "الموقع",
  "Location label": "اسم الموقع",
  "Location summary": "ملخص الموقع",
  "Longitude": "خط الطول",
  "Look up name": "البحث عن الاسم",
  "Looking for the irrigation interpretation? Open": "تبحث عن تفسير الري؟ افتح",
  "Looking up…": "جارٍ البحث…",
  "MERRA-2 model-derived wetness fraction. This is context for the water balance, not a soil-moisture probe.":
    "كسر رطوبة مشتق من نموذج MERRA-2. هذا سياق للموازنة المائية، وليس مسبار رطوبة تربة.",
  "MERRA-2 model-derived wetness — context only, not a soil probe or the bucket model.":
    "رطوبة مشتقة من نموذج MERRA-2 — سياق فقط، وليست مسبار تربة ولا نموذج الخزان.",
  "MJ/m²/day": "ميجاجول/م²/يوم",
  "Map and field outline": "الخريطة وحدود الحقل",
  "Map showing {name}": "خريطة تُظهر {name}",
  "Mean ET₀": "متوسط ET₀",
  "Mean temperature": "متوسط الحرارة",
  "Mean temperature (°C)": "متوسط الحرارة (°م)",
  "Mean wind speed at 2 m, used by the Penman–Monteith ET₀ equation.":
    "متوسط سرعة الرياح على ارتفاع مترين، المستخدم في معادلة بنمان–مونتيث لـ ET₀.",
  "Method & assumptions": "المنهج والافتراضات",
  "Missing inputs": "مدخلات ناقصة",
  "Model drivers": "محركات النموذج",
  "Model-derived": "مشتق من نموذج",
  "Most climate variables come from the MERRA-2 reanalysis, which blends observations with a physical model. GIBS imagery is satellite-observed; NDVI and NDMI are computed from Sentinel-2 through Google Earth Engine.":
    "معظم متغيرات المناخ تأتي من إعادة تحليل MERRA-2 التي تمزج الأرصاد بنموذج فيزيائي. وصور GIBS مرصودة بالأقمار الصناعية؛ ويُحسب NDVI وNDMI من سينتينل-2 عبر Google Earth Engine.",
  "NASA GIBS imagery": "صور NASA GIBS",
  "NASA GIBS imagery is optional visual context; no values are read from it.":
    "صور NASA GIBS سياق بصري اختياري؛ ولا تُقرأ منها أي قيم.",
  "NASA GIBS true-colour imagery ({date}). Visual context only — no values are read from it.":
    "صور NASA GIBS بالألوان الحقيقية ({date}). سياق بصري فقط — ولا تُقرأ منها أي قيم.",
  "NASA POWER cells are roughly 50 km wide. Soil wetness and rainfall are regional context, not on-farm measurements. The platform says this on every analysis rather than implying precision it does not have.":
    "خلية NASA POWER عرضها نحو 50 كم. ورطوبة التربة والأمطار سياق إقليمي، وليست قياسات داخل الحقل. وتذكر المنصة ذلك في كل تحليل بدل الإيحاء بدقة لا تملكها.",
  "NASA POWER could not be reached.": "تعذّر الوصول إلى NASA POWER.",
  "NASA POWER daily data is requested for the nearest grid cell.":
    "تُطلب بيانات NASA POWER اليومية لأقرب خلية شبكة.",
  "NASA POWER daily weather and ET₀ for the analysis window, with provenance.":
    "طقس NASA POWER اليومي وET₀ لنافذة التحليل، مع مصدرها.",
  "NASA POWER did not return data.": "لم تُعِد NASA POWER أي بيانات.",
  "NASA POWER needs no key": "NASA POWER لا يحتاج مفتاحًا",
  "NASA POWER requests are capped at 366 days. Choose a shorter range.":
    "طلبات NASA POWER محدودة بـ366 يومًا. اختر مدة أقصر.",
  "NASA POWER weather is sampled for the nearest grid cell of the saved centre. The outline is stored for display and area; it is not used to sample or average weather.":
    "يُؤخذ طقس NASA POWER من أقرب خلية شبكة للمركز المحفوظ. ويُحفظ الرسم للعرض والمساحة فقط؛ ولا يُستخدم لأخذ أو متوسط الطقس.",
  "NASA POWER · FAO-56 · grounded AI": "NASA POWER · FAO-56 · ذكاء اصطناعي مستند",
  "NASA data": "بيانات NASA",
  "NASA satellite imagery": "صور NASA الفضائية",
  "NDVI": "NDVI",
  "NDVI is not available for this field": "NDVI غير متاح لهذا الحقل",
  "NDMI": "NDMI",
  "Nature": "الطبيعة",
  "Need help reading this? Ask the": "تحتاج مساعدة في القراءة؟ اسأل",
  "New field": "حقل جديد",
  "One usable Sentinel-2 pass in the window": "تمريرة واحدة صالحة من سينتينل-2 في النافذة",
  "A trend needs two cloud-free acquisitions. The value above is the latest pass; a two-date comparison will appear after the next usable Sentinel-2 overpass.":
    "يحتاج الاتجاه إلى التقاطتين خاليتين من السحب. القيمة أعلاه من أحدث تمريرة؛ وسيظهر مقارنة بين تاريخين بعد التمريرة الصالحة التالية من سينتينل-2.",
  "No NDVI value is invented or substituted. Crop health continues to use the environmental indicators that are available.":
    "لا تُخترع قيمة NDVI أو تُستبدل. وتواصل صحة المحصول استخدام المؤشرات البيئية المتاحة.",
  "No daily values": "لا توجد قيم يومية",
  "No data": "لا بيانات",
  "No demand class is shown because the model's inputs are incomplete. Missing data is not replaced with estimates.":
    "لا تُعرض فئة طلب لأن مدخلات النموذج ناقصة. ولا تُستبدل البيانات الناقصة بتقديرات.",
  "No demand class is shown because the required inputs are incomplete.":
    "لا تُعرض فئة طلب لأن المدخلات المطلوبة ناقصة.",
  "No environmental points": "لا توجد نقاط بيئية",
  "No field selected": "لم يُحدَّد حقل",
  "No fields yet": "لا توجد حقول بعد",
  "No growth stage is available for this analysis date.":
    "لا تتوفر مرحلة نمو لهذا التاريخ.",
  "No simulated balance days": "لا توجد أيام موازنة محاكاة",
  "No value": "لا قيمة",
  "Earth Engine is not configured on this server.": "Earth Engine غير مهيأ على هذا الخادم.",
  "None — point only": "لا يوجد — نقطة فقط",
  "Not every value is a satellite pixel": "ليست كل قيمة بكسلًا فضائيًا",
  "Not provided": "غير مقدَّم",
  "Not provided (assume loam)": "غير مقدَّم (نفترض طميية)",
  "Not set": "غير محدد",
  "On every question the backend re-fetches the weather window and re-runs the irrigation and crop-health models for the requested mode.":
    "في كل سؤال يعيد الخادم جلب نافذة الطقس ويشغّل نموذجي الري وصحة المحصول للوضع المطلوب.",
  "One field is enough to begin.": "حقل واحد يكفي للبدء.",
  "Open dashboard": "فتح لوحة المتابعة",
  "Open menu": "فتح القائمة",
  "Optional": "اختياري",
  "Optional agronomy details": "تفاصيل زراعية اختيارية",
  "Outline": "الحدود",
  "Outline placed. Turn drawing back on to add corners, or clear the outline to move the field point.":
    "تم وضع الحدود. أعد تشغيل الرسم لإضافة زوايا، أو امسح الرسم لنقل نقطة الحقل.",
  "Overall assessment": "التقييم الإجمالي",
  "Overview": "نظرة عامة",
  "Pipeline · one field": "خط المعالجة · حقل واحد",
  "Planted": "تاريخ الزراعة",
  "Planting date": "تاريخ الزراعة",
  "Planting in {n} days": "الزراعة بعد {n} أيام",
  "Platform": "المنصة",
  "Precipitation is a daily total; ET₀ is the FAO-56 atmospheric demand calculated from the same weather inputs.":
    "الأمطار تراكم يومي؛ وET₀ هو الطلب الجوي وفق FAO-56 المحسوب من مدخلات الطقس نفسها.",
  "Prefill a field from the cached NASA POWER snapshot (real values for Qena, Egypt, 2025-11-01 → 2026-03-10). Demo analyses are labelled everywhere.":
    "املأ حقلًا من لقطة NASA POWER المحفوظة (قيم حقيقية لقنا في مصر، 2025-11-01 → 2026-03-10). التحليلات التجريبية موسومة في كل مكان.",
  "Primary navigation": "التنقل الرئيسي",
  "Pull NASA climate records for one field, run a transparent water balance, and let an assistant explain the result. Every number is computed by code; the AI only explains what it was given.":
    "اسحب سجلات مناخ NASA لحقل واحد، وشغّل موازنة مائية شفافة، ودع مساعدًا يشرح النتيجة. كل رقم يحسبه الكود؛ والذكاء الاصطناعي يشرح فقط ما أُعطي.",
  "Questions and answers are stored locally with the field so the conversation can be reopened. Requests are rate-limited per client.":
    "تُحفظ الأسئلة والأجوبة محليًا مع الحقل لإمكانية إعادة فتح المحادثة. والطلبات محدودة المعدل لكل عميل.",
  "Questions are answered from a compact JSON context: latest climate values, computed ET₀/ETc, water balance, demand reasons, confidence and missing-data flags. The system prompt forbids outside data, invented numbers and prescriptive volumes.":
    "تُجاب الأسئلة من سياق JSON مختصر: أحدث قيم المناخ، وET₀/ETc المحسوبة، والموازنة المائية، وأسباب الطلب، والثقة، وعلامات البيانات الناقصة. ويمنع توجيه النظام استخدام بيانات خارجية أو أرقام مخترعة أو كميات إرشادية.",
  "RAW": "RAW",
  "Rain, last 7 days": "الأمطار، آخر 7 أيام",
  "Rainfall (mm)": "الأمطار (مم)",
  "Rainfall and reference ET₀": "الأمطار والـ ET₀ المرجعي",
  "Rainfall total": "إجمالي الأمطار",
  "Readily available water (RAW)": "الماء المتاح بسهولة (RAW)",
  "Recomputing field analyses and preparing an answer…":
    "جارٍ إعادة حساب تحليلات الحقل وتجهيز الإجابة…",
  "Reference evapotranspiration": "التبخّر والنتح المرجعي",
  "Refill needed to return the assumed root zone toward field capacity. The baseline assumes no recorded irrigation events (I = 0); this is not a schedule or a measured application.":
    "الماء اللازم لإعادة منطقة الجذور المفترضة نحو السعة الحقلية. يفترض خط الأساس عدم تسجيل أي ري (I = 0)؛ وهذا ليس جدولًا ولا كمية مضافة مقيسة.",
  "Refill requirement": "احتياج إعادة التعبئة",
  "Relative humidity": "الرطوبة النسبية",
  "Replay a cached NASA POWER snapshot and label it clearly":
    "إعادة تشغيل لقطة NASA POWER محفوظة ووسمها بوضوح",
  "Required fields": "الحقول المطلوبة",
  "Required inputs that are missing": "المدخلات المطلوبة الناقصة",
  "Resolution": "الدقة",
  "Resolution: {value}": "الدقة: {value}",
  "Retry, or enable Demo data in the header to use the cached snapshot.":
    "أعد المحاولة، أو فعّل البيانات التجريبية في الشريط العلوي لاستخدام اللقطة المحفوظة.",
  "Review indicators": "مراجعة المؤشرات",
  "Root-zone depletion": "نقص منطقة الجذور",
  "Root-zone depletion as a percentage of total available water":
    "نقص منطقة الجذور كنسبة من إجمالي الماء المتاح",
  "Root-zone refill estimate": "تقدير إعادة تعبئة منطقة الجذور",
  "Root-zone soil wetness": "رطوبة تربة منطقة الجذور",
  "Root-zone water balance": "الموازنة المائية لمنطقة الجذور",
  "Rule-based": "قائم على قواعد",
  "Rule-based explanations": "شرح قائم على قواعد",
  "Running the irrigation model…": "جارٍ تشغيل نموذج الري…",
  "Runoff is a simple coefficient, initial depletion is 50% of TAW at planting, and soil water capacity comes from a texture class you select. Each assumption is exposed in the irrigation view and can be improved with local data.":
    "الجريان السطحي معامل بسيط، والنقص الأولي 50% من إجمالي الماء المتاح عند الزراعة، وسعة الماء في التربة من فئة القوام التي تختارها. كل افتراض معروض في صفحة الري ويمكن تحسينه ببيانات محلية.",
  "Sentinel-2 surface reflectance via Google Earth Engine. It describes canopy condition; it is not a crop-stage measurement and cannot identify disease.":
    "انعكاس سطح سينتينل-2 عبر Google Earth Engine. يصف حالة الغطاء النباتي وليس قياسًا لمرحلة المحصول، ولا يحدد المرض.",
  "Satellite observation, reanalysis and estimated values are not the same thing. The interface labels which is which, with resolution and attribution.":
    "الرصد الفضائي وإعادة التحليل والقيم المقدّرة ليست الشيء نفسه. توضّح الواجهة أيّها أيّ، مع الدقة والنسبة.",
  "Saved field centre": "مركز الحقل المحفوظ",
  "Scientific method": "المنهج العلمي",
  "Scientific model": "النموذج العلمي",
  "Scope of the assistant": "نطاق المساعد",
  "Search": "بحث",
  "Search for a place": "ابحث عن مكان",
  "Search uses OpenStreetMap Nominatim through the backend. It is not a NASA service.":
    "يستخدم البحث خدمة OpenStreetMap Nominatim عبر الخادم. وليست خدمة تابعة لناسا.",
  "Searching…": "جارٍ البحث…",
  "See": "راجع",
  "See calculation": "عرض الحساب",
  "See how it works": "شاهد كيف يعمل",
  "Select field…": "اختر حقلًا…",
  "Send question": "إرسال السؤال",
  "Set a location, a planting date and a soil texture. The platform handles the NASA request, QA, science and explanation. Add a boundary later when you have real survey data — never before.":
    "حدّد موقعًا وتاريخ زراعة وقوام تربة. تتولى المنصة طلب NASA والفحص والعلم والشرح. وأضف الحدود لاحقًا عندما تتوفر بيانات مسح حقيقية — وليس قبل ذلك.",
  "Simulated depletion compared with the readily available water (RAW) and total available water (TAW) limits.":
    "النقص المحاكى مقارنة بحدود الماء المتاح بسهولة (RAW) وإجمالي الماء المتاح (TAW).",
  "Skip to main content": "تجاوز إلى المحتوى الرئيسي",
  "Soil": "التربة",
  "Soil assumed loam": "التربة طميية مفترضة",
  "Soil texture": "قوام التربة",
  "Soil wetness (fraction)": "رطوبة التربة (كسر)",
  "Soil: {value}": "التربة: {value}",
  "Solar radiation": "الإشعاع الشمسي",
  "Solar radiation (MJ/m²/day)": "الإشعاع الشمسي (ميجاجول/م²/يوم)",
  "Some environmental inputs are incomplete": "بعض المدخلات البيئية ناقصة",
  "Source": "المصدر",
  "Start": "البداية",
  "Start small": "ابدأ صغيرًا",
  "Stress days": "أيام الإجهاد",
  "Sum of daily corrected precipitation for the most recent seven days.":
    "مجموع الأمطار اليومية المصححة لآخر سبعة أيام.",
  "Switch to Arabic": "التبديل إلى العربية",
  "Switch to English": "التبديل إلى الإنجليزية",
  "Switch to dark mode": "التبديل إلى الوضع الداكن",
  "Switch to light mode": "التبديل إلى الوضع الفاتح",
  "Switch to live data": "الانتقال إلى البيانات الحية",
  "System prompt · excerpt": "توجيه النظام · مقتطف",
  "T max (°C)": "الحرارة العظمى (°م)",
  "T mean (°C)": "متوسط الحرارة (°م)",
  "T min (°C)": "الحرارة الصغرى (°م)",
  "TAW": "TAW",
  "Temperature and rainfall": "الحرارة والأمطار",
  "The assistant could not answer.": "تعذّر على المساعد الإجابة.",
  "The assistant only explains computed data. It cannot invent measurements or irrigation volumes. Enter to send · Shift+Enter for a new line.":
    "المساعد يشرح البيانات المحسوبة فقط. ولا يستطيع اختراع قياسات أو كميات ري. Enter للإرسال · Shift+Enter لسطر جديد.",
  "The assistant receives a structured snapshot of this field's current analyses. It explains those numbers — it never produces new measurements, diagnoses or application rates.":
    "يتلقى المساعد لقطة منظمة لتحليلات هذا الحقل الحالية. ويشرح تلك الأرقام — ولا ينتج قياسات جديدة أو تشخيصات أو معدلات إضافة.",
  "The browser sends only your question and the selected field/mode. All model calls and API keys live on the backend; no secret is shipped to the frontend.":
    "يرسل المتصفح سؤالك والحقل/الوضع المحدد فقط. وكل استدعاءات النماذج ومفاتيح API تبقى في الخادم؛ ولا يُرسل أي سر إلى الواجهة.",
  "The cached Qena snapshot cannot change dates. Every request replays":
    "لا يمكن تغيير تواريخ لقطة قنا المحفوظة. كل طلب يعيد تشغيل",
  "The dashboard explains the result and its confidence.":
    "تشرح لوحة المتابعة النتيجة ودرجة الثقة فيها.",
  "The field assistant can explain why an indicator is flagged, using the same computed data shown here. It cannot add observations or diagnose a disease.":
    "يستطيع مساعد الحقل شرح سبب تنبيه أي مؤشر باستخدام البيانات المحسوبة نفسها المعروضة هنا. ولا يستطيع إضافة أرصاد أو تشخيص مرض.",
  "The field could not be deleted.": "تعذّر حذف الحقل.",
  "The field does not exist or was deleted.": "الحقل غير موجود أو تم حذفه.",
  "The health indicators could not be computed.": "تعذّر حساب مؤشرات الصحة.",
  "The irrigation module follows the dual-step FAO-56 approach: reference evapotranspiration, a crop coefficient that changes with growth stage, and a daily root-zone water balance.":
    "يتبع نموذج الري منهج FAO-56 ثنائي الخطوة: التبخّر والنتح المرجعي، ومعامل محصول يتغيّر بمرحلة النمو، وموازنة مائية يومية لمنطقة الجذور.",
  "The model assumes no irrigation events (I = 0). This is a refill estimate, not a schedule or applied volume.":
    "يفترض النموذج عدم وجود ري (I = 0). هذا تقدير لإعادة التعبئة، وليس جدولًا ولا كمية مضافة.",
  "The model explains.": "النموذج يشرح.",
  "The outline is drawn by you and stored exactly as clicked. It is not a satellite measurement or a surveyed boundary. NASA POWER weather is still sampled at the field point / grid cell, not averaged over the whole polygon.":
    "الحدود رسمتها أنت وتُحفظ كما نقرت تمامًا. وهي ليست قياسًا فضائيًا ولا حدودًا مساحية. ويظل طقس NASA POWER مأخوذًا من نقطة الحقل / خلية الشبكة، لا متوسطًا على المضلع كله.",
  "The page you requested does not exist. Head back to your fields to continue.":
    "الصفحة المطلوبة غير موجودة. عد إلى حقولك للمتابعة.",
  "The reply is generated from that object alone. Expand":
    "تُولَّد الإجابة من ذلك الكائن وحده. وسّع",
  "The selected window returned no daily values. Try a different range.":
    "لم تُعِد المدة المحددة أي قيم يومية. جرّب مدة أخرى.",
  "The selected window returned no environmental points.":
    "لم تُعِد المدة المحددة أي نقاط بيئية.",
  "The server did not return the field list.": "لم يُعِد الخادم قائمة الحقول.",
  "The start date must be on or before the end date.":
    "يجب أن يكون تاريخ البداية في يوم تاريخ النهاية أو قبله.",
  "NDVI is unavailable, so vegetation condition cannot confirm the water balance.":
    "NDVI غير متاح، لذلك لا يمكن لحالة الغطاء النباتي أن تؤكد الموازنة المائية.",
  "The water balance could not be computed.": "تعذّر حساب الموازنة المائية.",
  "The water balance has no days to display. This usually means the crop had not been planted in the analysis window.":
    "لا تحتوي الموازنة المائية على أيام للعرض. يعني هذا عادةً أن المحصول لم يكن مزروعًا في نافذة التحليل.",
  "These are shown as gaps; the platform does not fill them with estimated weather.":
    "تظهر هذه كفراغات؛ ولا تملؤها المنصة بطقس مقدَّر.",
  "These improve the water balance. If omitted, the model uses loam soil and does not apply an irrigation-system efficiency.":
    "تحسّن هذه الموازنة المائية. وإذا تُركت، يستخدم النموذج تربة طميية ولا يطبّق كفاءة نظام الري.",
  "This is an environmental screening tool. It is not a disease, pest or nutrient diagnosis, and no confidence percentage is attached to a stress class.":
    "هذه أداة فحص بيئي. وليست تشخيصًا لمرض أو آفة أو نقص عنصر غذائي، ولا تُرفق نسبة ثقة بتصنيف الإجهاد.",
  "This page is outside the field boundary.": "هذه الصفحة خارج حدود الحقل.",
  "Those results are packaged into one structured context object, including missing variables and limitations.":
    "تُجمَّع تلك النتائج في كائن سياق منظم واحد، يشمل المتغيرات الناقصة والحدود.",
  "Total available water (TAW)": "إجمالي الماء المتاح (TAW)",
  "Treat missing indicators as healthy.": "معاملة المؤشرات الناقصة كحالة سليمة.",
  "Trend unavailable": "الاتجاه غير متاح",
  "Try a shorter range, retry, or enable Demo data in the header.":
    "جرّب مدة أقصر، أو أعد المحاولة، أو فعّل البيانات التجريبية في الشريط العلوي.",
  "Try again": "أعد المحاولة",
  "Try it on a field": "جرّبه على حقل",
  "Unavailable": "غير متاح",
  "Undo corner": "التراجع عن الزاوية",
  "Use demo field values": "استخدام قيم الحقل التجريبي",
  "User guide": "دليل الاستخدام",
  "Variable": "المتغير",
  "Vegetation index": "مؤشر الغطاء النباتي",
  "Vegetation index (NDVI)": "مؤشر الغطاء النباتي (NDVI)",
  "View calculation": "عرض الحساب",
  "View data sent to the assistant": "عرض البيانات المُرسلة إلى المساعد",
  "Weather values are grid-cell estimates, not on-farm sensor readings. The assistant is instructed to preserve that distinction.":
    "قيم الطقس تقديرات لخلية شبكة، وليست قراءات مستشعرات داخل الحقل. والمساعد مُوجَّه إلى الحفاظ على هذا التمييز.",
  "What happens next": "ما يحدث بعد ذلك",
  "What is assumed": "ما المفترض",
  "What is missing": "ما هو ناقص",
  "What this is": "ما هذه الأداة",
  "What this page will not do": "ما لن تفعله هذه الصفحة",
  "Wheat Kc curve · default": "منحنى Kc للقمح · افتراضي",
  "Crop decisions,": "قرارات المحاصيل،",
  "Crop intelligence": "ذكاء المحاصيل",
  "Wheat, potato and tomato ship with validated growth curves. Crops live in a registry so another crop can be added without touching the models.":
    "تأتي القمح والبطاطس والطماطم بمنحنيات نمو معتمدة. والمحاصيل في سجل، فيمكن إضافة محصول آخر دون تعديل النماذج.",
  "When no language-model credential is configured, answers are produced by a deterministic rule-based explainer over the same context — never by a mock or fabricated response.":
    "عندما لا يُهيَّأ اعتماد لنموذج لغوي، تُنتَج الإجابات بشرح حتمي قائم على قواعد من السياق نفسه — لا برد مزيف أو مُختلق.",
  "Why this class?": "لماذا هذه الفئة؟",
  "Wind (m/s)": "الرياح (م/ث)",
  "Wind speed": "سرعة الرياح",
  "Works without an API key using a labelled rule-based fallback.":
    "يعمل دون مفتاح API باستخدام بديل قائم على قواعد وموسوم بوضوح.",
  "You can retry, or switch on Demo data in the header to use the cached snapshot.":
    "يمكنك إعادة المحاولة، أو تفعيل البيانات التجريبية في الشريط العلوي لاستخدام اللقطة المحفوظة.",
  "Your fields": "حقولك",
  "demo replay": "إعادة تجريبية",
  "development": "النمو",
  "e.g. North pivot — wheat 2026": "مثال: المحور الشمالي — قمح 2026",
  "e.g. Qena, Egypt or a farm address": "مثال: قنا، مصر أو عنوان مزرعة",
  "field assistant": "مساعد الحقل",
  "for the full calculation chain.": "لسلسلة الحساب الكاملة.",
  "for the source badges and": "لشارات المصدر و",
  "gross": "إجمالي",
  "grounded in Earth data.": "مستندة إلى بيانات الأرض.",
  "initial": "أولي",
  "irrigation analysis": "تحليل الري",
  "late": "متأخر",
  "m/s": "م/ث",
  "mid-season": "منتصف الموسم",
  "mm": "مم",
  "mm and mm/day · bars are rainfall": "مم ومم/يوم · الأعمدة للأمطار",
  "mm · deterministic bucket model · no irrigation events assumed":
    "مم · نموذج خزان حتمي · لا يُفترض وجود ري",
  "mm/day": "مم/يوم",
  "net": "صافي",
  "of TAW": "من TAW",
  "planted {date}": "زُرع في {date}",
  "the dashboard": "لوحة المتابعة",
  "the same fixed snapshot period": "الفترة الثابتة نفسها للقطة",
  "under any answer to inspect the exact context.":
    "أسفل أي إجابة لفحص السياق الدقيق.",
  "{days} day(s) lacked complete ET₀ inputs. Those days were simulated without crop water use; the model did not fill weather values.":
    "افتقرت {days} يومًا إلى مدخلات ET₀ كاملة. حُوكيت تلك الأيام دون استهلاك ماء للمحصول؛ ولم يملأ النموذج قيم الطقس.",
  "{name} — coordinate only, no boundary supplied": "{name} — إحداثيات فقط، دون حدود",
  "{n} corners placed and joined in order. Click more corners to refine the outline, or switch drawing off when finished.":
    "وُضعت {n} زوايا ووُصلت بالترتيب. انقر زوايا إضافية لتحسين الحدود، أو أوقف الرسم عند الانتهاء.",
  "{n} corners, closed": "{n} زوايا، مغلقة",
  "{n} feddan": "{n} فدان",
  "{n} of 4 corners": "{n} من 4 زوايا",
  "{n}% efficiency": "كفاءة {n}%",
  "{n}% of days in this window have a complete set of ET₀ inputs. Missing values are shown as unavailable, never filled by estimation.":
    "{n}% من أيام هذه المدة لديها مجموعة كاملة من مدخلات ET₀. وتظهر القيم الناقصة كغير متاحة، ولا تُملأ بتقدير.",
  "{stage} · day {day} after planting · Kc {kc}":
    "{stage} · اليوم {day} بعد الزراعة · Kc {kc}",
  "{value} ha (entered)": "{value} هكتار (مُدخلة)",
  "{value} ha (estimate)": "{value} هكتار (تقدير)",
  "{value} mm gross at {percent}% application efficiency":
    "{value} مم إجمالي بكفاءة إضافة {percent}%",
  "{value}% of TAW": "{value}% من TAW",
  "°C · NASA POWER daily values": "°م · قيم NASA POWER اليومية",
  "ΔS = P + I − ETc − D − R over {days} day(s), with I = 0, initial depletion {depletion} mm, runoff {runoff} mm and drainage {drainage} mm.":
    "ΔS = P + I − ETc − D − R على مدى {days} يومًا، مع I = 0، والنقص الأولي {depletion} مم، والجريان السطحي {runoff} مم، والصرف العميق {drainage} مم.",
  "— every value on this page replays a fixed, cached NASA POWER snapshot (Qena, Egypt · 2025 season) instead of your field's live data. Units and calculations are real; the location and dates are not yours.":
    "— كل قيمة في هذه الصفحة تعيد تشغيل لقطة NASA POWER ثابتة ومحفوظة (قنا، مصر · موسم 2025) بدل بيانات حقلك الحية. الوحدات والحسابات حقيقية؛ أما الموقع والتواريخ فليست لك.",
  "“View data sent to the assistant”": "«عرض البيانات المُرسلة إلى المساعد»",

  // Metadata from lib/labels.ts
  "Mean air temperature": "متوسط حرارة الهواء",
  "Temperature": "الحرارة",
  "Maximum temperature": "الحرارة العظمى",
  "T max": "العظمى",
  "Minimum temperature": "الحرارة الصغرى",
  "T min": "الصغرى",
  "Humidity": "الرطوبة",
  "Precipitation": "الأمطار",
  "Rainfall": "الأمطار",
  "Wind speed (2 m)": "سرعة الرياح (2 م)",
  "Wind": "الرياح",
  "Radiation": "الإشعاع",
  "Atmospheric pressure": "الضغط الجوي",
  "Pressure": "الضغط",
  "Soil wetness": "رطوبة التربة",
  "fraction": "كسر",
  "ET₀": "ET₀",
  "Satellite observation": "رصد فضائي",
  "Reanalysis (model)": "إعادة تحليل (نموذج)",
  "Assimilated product": "منتج مُدمج",
  "Estimated": "مقدَّر",
  "Derived value": "قيمة مشتقة",
  "Calculated": "محسوب",
  "Optional interface": "واجهة اختيارية",
  "Low": "منخفض",
  "Moderate": "متوسط",
  "High": "مرتفع",
  "Unknown": "غير معروف",
  "Low confidence": "ثقة منخفضة",
  "Medium confidence": "ثقة متوسطة",
  "High confidence": "ثقة عالية",
  "Good": "جيد",
  "Stressed": "تحت إجهاد",
  "Insufficient data": "بيانات غير كافية",
  "watch": "مراقبة",
  "stress": "إجهاد",
  "unknown": "غير معروف",
  "good": "جيد",
  "moderate": "معتدل",
  "stable": "مستقر",
  "improving": "تحسّن",
  "declining": "تراجع",
  "Sand": "الرمل",
  "Loamy sand": "رملية طميية",
  "Sandy loam": "طميية رملية",
  "Loam": "طميية",
  "Silt loam": "غرينية طميية",
  "Clay loam": "طينية طميية",
  "Clay": "الطين",
  "Drip": "بالتنقيط",
  "Sprinkler": "بالرش",
  "Surface / furrow": "سطحي / أخاديد",
  "Surface": "سطحي",
  "None": "بدون",
  "Rainfed (no irrigation)": "بعلي (بدون ري)",
  "Wheat": "القمح",
  "FAO-56 wheat curve: 150-day season, Kc 0.40 → 1.15 → 0.30, roots 0.15–1.50 m, depletion fraction 0.55.":
    "منحنى القمح وفق FAO-56: موسم 150 يومًا، معامل المحصول Kc من 0.40 إلى 1.15 إلى 0.30، عمق الجذور 0.15–1.50 م، ونسبة الاستنفاد 0.55.",
  "FAO-56 potato curve: 120-day season, Kc 0.50 → 1.15 → 0.75, tuber planting, shallow roots (0.15–0.50 m).":
    "منحنى البطاطس وفق FAO-56: موسم 120 يومًا، معامل المحصول Kc من 0.50 إلى 1.15 إلى 0.75، زراعة الدرنات، وجذور سطحية (0.15–0.50 م).",
  "FAO-56 tomato curve: 140-day season, Kc 0.60 → 1.15 → 0.80, transplanting, deeper roots (0.15–1.00 m).":
    "منحنى الطماطم وفق FAO-56: موسم 140 يومًا، معامل المحصول Kc من 0.60 إلى 1.15 إلى 0.80، زراعة الشتلات، وجذور أعمق (0.15–1.00 م).",

  // Backend static text that renders through t()
  "Root-zone depletion could not be computed from the available data.":
    "تعذّر حساب نقص منطقة الجذور من البيانات المتاحة.",
  "Recent rainfall is unavailable, so only depletion was used.":
    "الأمطار الأخيرة غير متاحة، لذلك استُخدم النقص فقط.",
  "Depletion has crossed the high-demand threshold.":
    "تجاوز النقص حد الطلب المرتفع.",
  "Depletion has passed the readily available water fraction for wheat.":
    "تجاوز النقص نسبة الماء المتاح بسهولة للقمح.",
  "Depletion remains below the readily available water fraction for wheat.":
    "ظل النقص دون نسبة الماء المتاح بسهولة للقمح.",
  "Root-zone water stress": "إجهاد مائي في منطقة الجذور",
  "Rainfall anomaly (30 days)": "شذوذ الأمطار (30 يومًا)",
  "days": "أيام",
  "fraction of TAW": "كسر من TAW",
  "% vs normal": "% عن المعتاد",
  "Heat stress": "إجهاد حراري",
  "Frost risk": "خطر الصقيع",
  "Water stress": "إجهاد مائي",
  "Rainfall anomaly": "شذوذ الأمطار",
  "slope of the saturation vapour-pressure curve": "ميل منحنى ضغط البخار المشبع",
  "net radiation (MJ/m²/day)": "الإشعاع الصافي (ميجاجول/م²/يوم)",
  "mean air temperature (°C)": "متوسط حرارة الهواء (°م)",
  "wind speed at 2 m (m/s)": "سرعة الرياح على ارتفاع مترين (م/ث)",
  "vapour-pressure deficit (kPa)": "عجز ضغط البخار (كيلوباسكال)",
  "psychrometric constant (kPa/°C)": "الثابت السيكرومتري (كيلوباسكال/°م)",
  "G is assumed zero for daily steps. Missing inputs produce no ET₀ value rather than an invented one.":
    "يُفترض أن G صفر في الخطوات اليومية. والمدخلات الناقصة تنتج غياب قيمة ET₀ بدل اختراع قيمة.",
  "stage-dependent crop coefficient (linear interpolation)":
    "معامل المحصول حسب المرحلة (استقراء خطي)",
  "reference evapotranspiration (mm/day)": "التبخّر والنتح المرجعي (مم/يوم)",
  "precipitation (mm)": "الأمطار (مم)",
  "irrigation — assumed 0 in the baseline": "الري — يُفترض صفرًا في خط الأساس",
  "crop evapotranspiration (mm)": "التبخّر والنتح للمحصول (مم)",
  "deep drainage (mm)": "الصرف العميق (مم)",
  "runoff — 10% of daily rain": "الجريان السطحي — 10% من أمطار اليوم",
  "daily maximum air temperature (°C)": "أقصى حرارة هواء يومية (°م)",
  "25–30 °C is flagged for monitoring": "25–30 °م تُوسم للمراقبة",
  "Thresholds are documented agronomic heuristics, not a crop model.":
    "الحدود قواعد زراعية موثقة، وليست نموذج محصول.",
  "daily minimum air temperature (°C)": "أدنى حرارة هواء يومية (°م)",
  "0–3 °C is flagged for monitoring": "0–3 °م تُوسم للمراقبة",
  "root-zone water deficit from the bucket model":
    "عجز الماء في منطقة الجذور من نموذج الخزان",
  "total available water for the assumed soil": "إجمالي الماء المتاح للتربة المفترضة",
  "Inherits every assumption of the irrigation model.":
    "يرث كل افتراضات نموذج الري.",
  "observed precipitation in the analysis window": "الأمطار المرصودة في نافذة التحليل",
  "1991–2020 monthly normals for the same months":
    "معدلات شهرية 1991–2020 للأشهر نفسها",
  "Shown as unknown when climatology is unavailable — no value is substituted.":
    "يظهر غير معروف عند غياب المعدلات المناخية — ولا تُستبدل قيمة.",
  "The field has not been planted as of the analysis date, so no crop water balance exists.":
    "لم يكن الحقل مزروعًا في تاريخ التحليل، لذلك لا توجد موازنة مائية للمحصول.",
  "Baseline assumes no recorded irrigation events (I = 0); the output is a refill requirement, not applied water.":
    "يفترض خط الأساس عدم تسجيل أي ري (I = 0)؛ والمخرج احتياج إعادة تعبئة، وليس ماءً مضافًا.",
  "Initial root-zone depletion is assumed to be 50% of total available water at planting.":
    "يُفترض أن النقص الأولي في منطقة الجذور 50% من إجمالي الماء المتاح عند الزراعة.",
  "Demand thresholds are documented agronomic heuristics, not a validated field prescription.":
    "حدود الطلب قواعد زراعية موثقة، وليست وصفة ميدانية معتمدة.",
  "Soil texture was not provided; loam defaults (field capacity 0.29, wilting point 0.14) were used.":
    "لم يُقدَّم قوام التربة؛ استُخدمت قيم طميية افتراضية (السعة الحقلية 0.29 ونقطة الذبول 0.14).",
  "NDVI is unavailable; vegetation condition cannot corroborate the water balance.":
    "NDVI غير متاح؛ فلا يمكن لحالة الغطاء النباتي أن تدعم الموازنة المائية.",
  "Complete daily precipitation series": "سلسلة أمطار يومية كاملة",
  "User-provided soil texture": "قوام تربة مقدَّم من المستخدم",
  "Reference ET₀": "ET₀ المرجعي",
  "Crop water use (ETc)": "استهلاك المحصول للماء (ETc)",
  "MERRA-2 root-zone wetness": "رطوبة منطقة الجذور من MERRA-2",
  "0–1 fraction": "كسر من 0 إلى 1",
  "Rainfall, last 7 days": "الأمطار، آخر 7 أيام",
  "Days after planting must be ≥ 0.": "يجب أن يكون عدد الأيام بعد الزراعة ≥ 0.",
  "No irrigation class is shown rather than presenting an unreliable recommendation.":
    "لا تُعرض فئة ري بدل تقديم توصية غير موثوقة.",
  "Crop health status: {status}.": "حالة صحة المحصول: {status}.",
  "No disease diagnosis is performed; the crop-health module reports environmental stress indicators only.":
    "لا يُجري تشخيصًا للأمراض؛ فوحدة صحة المحصول تعرض مؤشرات الإجهاد البيئي فقط.",
  "NASA POWER values are reanalysis/model-derived and spatially coarse (~50 km); they are not on-farm measurements.":
    "قيم NASA POWER مشتقة من إعادة تحليل/نموذج وهي تقريبية مكانيًا (~50 كم)؛ وليست قياسات داخل الحقل.",
  "Irrigation output is a decision-support estimate, not a validated prescription or sensor reading.":
    "مخرج الري تقدير لدعم القرار، وليس وصفة معتمدة أو قراءة مستشعر.",
  "Stress thresholds are documented agronomic heuristics (Tmax ≥ 30 °C, depletion fraction ≥ 0.80), not calibrated yield predictions.":
    "حدود الإجهاد قواعد زراعية موثقة (العظمى ≥ 30 °م، ونسبة النقص ≥ 0.80)، وليست تنبؤات إنتاج معايرة.",
  "Dashboard": "لوحة المتابعة",
  "Analytics": "التحليلات",
  "Initial (emergence–tillering)": "المرحلة الأولية (الإنبات–التفريع)",
  "Development (stem elongation)": "مرحلة النمو (استطالة الساق)",
  "Mid-season (heading–grain fill)": "منتصف الموسم (طرد السنابل–امتلاء الحبوب)",
  "Late season (ripening)": "آخر الموسم (النضج)",
  "Initial": "المرحلة الأولية",
  "Development": "مرحلة النمو",
  "Mid-season": "منتصف الموسم",
  "Late season": "آخر الموسم",
  "After harvest": "بعد الحصاد",
  "Recent rainfall recharges the root zone.": "الأمطار الأخيرة تغذي منطقة الجذور.",
  "Little or no rain contributed to the root zone recently.":
    "لم تسهم إلا أمطار قليلة أو معدومة في منطقة الجذور مؤخرًا.",
  "Precipitation coverage is insufficient to total recent rainfall.":
    "تغطية الأمطار غير كافية لحساب مجموع الأمطار الأخيرة.",
  "index": "مؤشر",
  "% of TAW": "% من TAW",
  "Same as input series · daily": "مثل السلسلة المدخلة · يوميًا",
  "0.5° × 0.625° · daily": "0.5° × 0.625° · يوميًا",
  "Tile-dependent": "يعتمد على المربّع",
  "250–500 m": "250–500 م",
  "Depletion is above 65% while rainfall is negligible and atmospheric demand is high; the deficit is likely to cross the high threshold soon.":
    "النقص فوق 65% مع أمطار مهملة وطلب جوي مرتفع؛ ويُرجَّح أن يتجاوز العجز العتبة المرتفعة قريبًا.",
  "NASA POWER is a ~50 km reanalysis product; field-scale soil water cannot be resolved, so this analysis is capped at medium confidence.":
    "NASA POWER منتج إعادة تحليل بدقة ~50 كم؛ ولا يمكن تحليل ماء التربة على مقياس الحقل، لذلك تُحدَّد ثقة هذا التحليل بالمتوسطة كحد أقصى.",
  "Soil texture was not provided; loam values were assumed for field capacity and wilting point.":
    "لم يُقدَّم قوام التربة؛ افتراض قيم طميية للسعة الحقلية ونقطة الذبول.",
  "Soil texture was supplied, but class-average water capacity is still an approximation.":
    "قُدِّم قوام التربة، لكن السعة المائية المتوسطة للفئة تبقى تقريبية.",
  "Fewer than 14 days were simulated, so the bucket has little time to adjust.":
    "حُوكيت أقل من 14 يومًا، لذا لدى الموازنة وقت قليل للتكيّف.",
  "No irrigation system was specified, so only a net refill requirement is reported.":
    "لم يُحدَّد نظام ري، لذلك تُعرض احتياجات إعادة التعبئة الصافية فقط.",
  "Complete ET₀ inputs (Tmax, Tmin, RH, wind, solar) on at least 80% of planting-to-date days":
    "مدخلات ET₀ كاملة (Tmax وTmin والرطوبة والرياح والإشعاع) في 80% على الأقل من أيام الزراعة حتى اليوم",
  "Atmospheric demand for the latest day with complete inputs.":
    "الطلب الجوي في أحدث يوم تتوفر فيه مدخلات كاملة.",
  "Maximum temperature is unavailable, so heat stress cannot be assessed.":
    "أقصى حرارة غير متاحة، لذلك لا يمكن تقييم الإجهاد الحراري.",
  "Minimum temperature is unavailable, so frost cannot be assessed.":
    "أدنى حرارة غير متاحة، لذلك لا يمكن تقييم الصقيع.",
  "The water balance could not be computed, so water stress is unknown.":
    "تعذّر حساب الموازنة المائية، لذلك الإجهاد المائي غير معروف.",
  "A climatological normal is unavailable, so the rainfall anomaly cannot be computed.":
    "المعدل المناخي غير متاح، لذلك لا يمكن حساب شذوذ الأمطار.",
  "No NDVI observation is available for this field, so vegetation condition is not assessed rather than guessed.":
    "لا يوجد رصد NDVI لهذا الحقل، لذلك لا تُقيَّم حالة الغطاء النباتي بدل تخمينها.",
  "All computable environmental indicators are within their acceptable ranges.":
    "جميع المؤشرات البيئية القابلة للحساب ضمن نطاقاتها المقبولة.",
  "The demo snapshot could not be loaded. Live data mode is still available.":
    "تعذّر تحميل اللقطة التجريبية. ولا يزال وضع البيانات الحية متاحًا.",
  "Demo analyses ignore the field's coordinates and planting date for crop stage.":
    "تتجاهل التحليلات التجريبية إحداثيات الحقل وتاريخ زراعته عند تحديد مرحلة المحصول.",
  "A rainfall anomaly normal is a 30-year monthly climatology, not a forecast for this season.":
    "معدل شذوذ الأمطار معدل مناخي شهري لـ30 سنة، وليس توقعًا لهذا الموسم.",
  "Water-stress context inherits the coarse resolution and assumptions of the irrigation model.":
    "سياق الإجهاد المائي يرث دقة نموذج الري التقريبية وافتراضاته.",
  "NDVI is unavailable for this field; vegetation condition is not inferred from weather surrogates.":
    "NDVI غير متاح لهذا الحقل؛ ولا تُستنتج حالة الغطاء النباتي من بدائل الطقس.",
  "NDVI indicates vegetation condition; it does not identify a specific disease, pest or nutrient deficiency.":
    "يشير NDVI إلى حالة الغطاء النباتي؛ ولا يحدد مرضًا أو آفة أو نقص عنصر غذائي بعينه.",
  "NDVI compositing, clouds and mixed pixels introduce uncertainty at field scale.":
    "تركيب NDVI والسحب والاختلاط البكسلي تُدخل عدم يقين على مقياس الحقل.",

  // Home page and assistant capability copy
  "A deterministic root-zone balance driven by FAO-56 ET₀ and a stage-varying crop Kc, reported as Low / Moderate / High with reasons.":
    "موازنة حتمية لمنطقة الجذور مبنية على ET₀ وفق FAO-56 ومعامل Kc للمحصول متغيّر بالمرحلة، تُعرض منخفضة/متوسطة/مرتفعة مع الأسباب.",
  "A qualitative confidence label derived from input completeness, spatial mismatch and documented model assumptions.":
    "وسم ثقة نوعي مشتق من اكتمال المدخلات وعدم التطابق المكاني وافتراضات النموذج الموثقة.",
  "Ask why demand changed. Answers cite the exact structured data sent to the model, which is shown alongside the reply.":
    "اسأل عن سبب تغيّر الطلب. تستشهد الإجابات بالبيانات المنظمة الدقيقة المرسلة إلى النموذج، وتُعرض بجانب الرد.",
  "Classify irrigation demand with visible reasons":
    "تصنيف طلب الري بأسباب ظاهرة",
  "Compute ET₀, ETc and a daily soil-water balance":
    "حساب ET₀ وETc وموازنة ماء التربة اليومية",
  "Confidence, not percentages": "ثقة، لا نسب مئوية",
  "Crop ET and root-zone balance": "نتح المحصول وموازنة منطقة الجذور",
  "Crop stress indicators": "مؤشرات إجهاد المحصول",
  "Diagnose diseases from satellite pixels": "تشخيص الأمراض من بكسلات الأقمار الصناعية",
  "Explain results from structured data": "شرح النتائج من بيانات منظمة",
  "Explain, don't invent": "اشرح، ولا تخترع",
  "FAO-56 science": "علم FAO-56",
  "Field map with NASA imagery": "خريطة الحقل بصور NASA",
  "Grounded assistant": "مساعد مستند",
  "Heat, water and rainfall-anomaly indicators for the supported crops. Environmental stress only — never a disease diagnosis.":
    "مؤشرات الحرارة والماء وشذوذ الأمطار للمحاصيل المدعومة. إجهاد بيئي فقط — وليس تشخيصًا للمرض أبدًا.",
  "Invent values when data is missing": "اختراع قيم عند غياب البيانات",
  "Irrigation classes are code, never generated text":
    "تصنيفات الري كود برمجي، وليست نصًا مُولَّدًا",
  "LLM reads JSON, never invents": "نموذج اللغة يقرأ JSON، ولا يخترع",
  "Locate the field": "حدّد موقع الحقل",
  "Measure your field with sensors": "قياس حقلك بالمستشعرات",
  "Model-derived baseline": "خط أساس مشتق من نموذج",
  "Model-derived wetness fraction, not a probe":
    "كسر رطوبة مشتق من نموذج، وليس مسبارًا",
  "Monthly normals": "معدلات شهرية",
  "NASA POWER grid — coarse by design, disclosed everywhere":
    "شبكة NASA POWER — تقريبية بحكم التصميم، ومُفصح عنها في كل مكان",
  "No false diagnoses": "لا تشخيصات زائفة",
  "Normalise & QA": "التوحيد وفحص الجودة",
  "30-year rainfall normals": "معدلات الأمطار لثلاثين عامًا",
  "OpenStreetMap base plus NASA GIBS satellite imagery. If no boundary exists, the field is drawn honestly as a point.":
    "أساس OpenStreetMap مع صور NASA GIBS الفضائية. وإذا لم توجد حدود، يُرسم الحقل بأمانة كنقطة.",
  "Google Earth Engine · Sentinel-2": "Google Earth Engine · سينتينل-2",
  "Penman–Monteith ET₀, stage-based Kc, ETc and a daily root-zone water balance produce a demand class and confidence.":
    "ينتج عن ET₀ وفق بنمان–مونتيث وKc حسب المرحلة وETc وموازنة يومية لمنطقة الجذور فئة طلب ودرجة ثقة.",
  "Penman–Monteith reference ET₀": "ET₀ المرجعي وفق بنمان–مونتيث",
  "Process and check": "المعالجة والفحص",
  "Promise a precise irrigation litres figure": "الوعد برقم دقيق للترات المطلوبة للري",
  "Reanalysis / model-derived (MERRA-2)": "إعادة تحليل / مشتق من نموذج (MERRA-2)",
  "Report confidence and missing inputs": "الإبلاغ عن الثقة والمدخلات الناقصة",
  "Retrieve NASA data": "جلب بيانات NASA",
  "Root-zone soil wetness (GWETROOT)": "رطوبة تربة منطقة الجذور (GWETROOT)",
  "Run the science": "تشغيل الحسابات العلمية",
  "Satellite imagery basemap": "خريطة أساس بالصور الفضائية",
  "Satellite observation (MODIS/VIIRS layers)": "رصد فضائي (طبقات MODIS/VIIRS)",
  "Satellite observation — requires credentials": "رصد فضائي — يتطلب اعتمادًا",
  "Search a place, click the map, enter coordinates or draw the field outline. A point-only field is never given an invented boundary.":
    "ابحث عن مكان، أو انقر على الخريطة، أو أدخل الإحداثيات، أو ارسم حدود الحقل. ولا يُعطى الحقل النقطي حدودًا مخترعة.",
  "Seven-day to custom-range charts for temperature, rainfall, humidity, wind, radiation and soil wetness, each with source and units.":
    "رسوم من سبعة أيام إلى مدة مخصصة للحرارة والأمطار والرطوبة والرياح والإشعاع ورطوبة التربة، لكل منها مصدرها ووحداتها.",
  "Show me how ET₀ was calculated.": "أرني كيف حُسبت ET₀.",
  "Structured context": "سياق منظم",
  "The assistant receives the computed facts as structured JSON and explains them. It cannot alter a number.":
    "يتلقى المساعد الحقائق المحسوبة كـ JSON منظم ويشرحها. ولا يستطيع تغيير أي رقم.",
  "The backend requests NASA POWER daily climate variables for the planting-to-today window, with a cache.":
    "يطلب الخادم متغيرات مناخ NASA POWER اليومية من الزراعة حتى اليوم، مع ذاكرة تخزين مؤقت.",
  "Units are converted, dates aligned and gaps flagged. Missing variables stay missing — they are never filled with guesses.":
    "تُحوَّل الوحدات وتُوحَّد التواريخ وتُوسم الفراغات. وتبقى المتغيرات الناقصة ناقصة — ولا تُملأ بتخمينات.",
  "What changed this week?": "ما الذي تغيّر هذا الأسبوع؟",
  "Wheat season span the Kc curve is defined over":
    "مدى موسم القمح الذي يُعرَّف عليه منحنى Kc",
  "Which environmental factor should worry me most?":
    "أي عامل بيئي يجب أن يقلقني أكثر؟",
  "Why is irrigation demand high?": "لماذا طلب الري مرتفع؟",
  "Explain the temperature trend.": "اشرح اتجاه الحرارة.",
  "ET₀ · Kc · water balance": "ET₀ · Kc · الموازنة المائية",
  "daily climate · keyless": "مناخ يومي · دون مفتاح",
  "units · missing values · dates": "الوحدات · القيم الناقصة · التواريخ",
  "Explain the current irrigation demand class and the factors behind it.":
    "اشرح فئة طلب الري الحالية والعوامل وراءها.",
  "Walk through ET₀, the crop Kc stage and the ETc calculation.":
    "اشرح خطوة بخطوة ET₀ وKc لمرحلة المحصول وحساب ETc.",
  "Summarise recent rainfall, temperature and soil-wetness changes.":
    "لخّص تغيّرات الأمطار والحرارة ورطوبة التربة الأخيرة.",
  "Explain which crop-health indicators are flagged and why.":
    "اشرح أي مؤشرات صحة محصول موسومة ولماذا.",
  "State which inputs are missing or which limitations apply.":
    "بيّن المدخلات الناقصة أو الحدود المنطبقة.",
  "Invent, interpolate or “fill in” a missing measurement.":
    "اختراع قياس ناقص أو استقرائه أو «ملء» فراغه.",
  "Prescribe an irrigation volume, date or schedule.":
    "وصف كمية ري أو تاريخ أو جدول زمني.",
  "Diagnose a disease, pest or nutrient deficiency.":
    "تشخيص مرض أو آفة أو نقص عنصر غذائي.",
  "Claim an ML prediction, accuracy or confidence percentage.":
    "الادعاء بتنبؤ تعلّم آلي أو دقة أو نسبة ثقة.",
  "Use data from outside the context shown with the answer.":
    "استخدام بيانات من خارج السياق المعروض مع الإجابة.",

  // Shared label descriptions
  "Root-zone moisture is adequate for the current crop stage.":
    "رطوبة منطقة الجذور كافية لمرحلة المحصول الحالية.",
  "Depletion is approaching the readily available water limit.":
    "يقترب النقص من حد الماء المتاح بسهولة.",
  "Depletion has crossed the management threshold; irrigation should be planned.":
    "تجاوز النقص حد الإدارة؛ ينبغي التخطيط للري.",
  "There is not enough data for a reliable demand class.":
    "لا توجد بيانات كافية لفئة طلب موثوقة.",
  "Environmental indicators are within typical ranges for this growth stage.":
    "المؤشرات البيئية ضمن النطاقات المعتادة لمرحلة النمو هذه.",
  "One or more indicators are outside the preferred range; monitor closely.":
    "مؤشر واحد أو أكثر خارج النطاق المفضل؛ راقب عن قرب.",
  "Indicators suggest meaningful heat or water stress. Agronomic review is advised.":
    "تشير المؤشرات إلى إجهاد حراري أو مائي ملموس. يُنصح بمراجعة زراعية.",
  "The available inputs cannot support a defensible stress assessment.":
    "المدخلات المتاحة لا تدعم تقييم إجهاد يمكن الدفاع عنه.",

  // Form and shared state messages
  "A boundary can have at most 24 corners in this version.":
    "يمكن أن تحتوي الحدود على 24 زاوية كحد أقصى في هذه النسخة.",
  "Choose a planting date.": "اختر تاريخ زراعة.",
  "Demo information could not be loaded.": "تعذّر تحميل معلومات العرض التجريبي.",
  "Enter at least two characters to search.": "أدخل حرفين على الأقل للبحث.",
  "Field area must be a positive number of hectares, or left blank.":
    "يجب أن تكون مساحة الحقل عددًا موجبًا بالهكتار، أو تُترك فارغة.",
  "Give the field a name so you can recognise it later.":
    "أعطِ الحقل اسمًا لتتعرف عليه لاحقًا.",
  "Location search is unavailable.": "البحث عن المواقع غير متاح.",
  "No matching place found. You can enter coordinates manually or click the map.":
    "لم يُعثر على مكان مطابق. يمكنك إدخال الإحداثيات يدويًا أو النقر على الخريطة.",
  "Select a location with the search box, a map click, or valid latitude/longitude.":
    "حدّد موقعًا بمربع البحث أو بنقرة على الخريطة أو بخط عرض وخط طول صحيحين.",
  "The demo snapshot is not available. You can still create a field with live data.":
    "اللقطة التجريبية غير متاحة. ويمكنك إنشاء حقل ببيانات حية.",
  "The field could not be created.": "تعذّر إنشاء الحقل.",
  "The location name could not be looked up.": "تعذّر البحث عن اسم الموقع.",
  "The map outline needs four corners. Place the remaining corners, or clear the drawing to save a point-only field.":
    "تحتاج حدود الخريطة إلى أربع زوايا. ضع الزوايا المتبقية، أو امسح الرسم لحفظ حقل نقطي فقط.",
  "The outline crosses itself. Undo the last corner or clear the drawing, then re-draw the field in order around its edge.":
    "الحدود تتقاطع مع نفسها. تراجع عن الزاوية الأخيرة أو امسح الرسم، ثم أعد رسم الحقل بالترتيب حول حافته.",
  "Loading data…": "جارٍ تحميل البيانات…",
  "Something went wrong": "حدث خطأ ما",
  "Data unavailable": "البيانات غير متاحة",
  "Why is irrigation demand at this level?": "لماذا طلب الري بهذا المستوى؟",
  "What changed in the last 7 days?": "ما الذي تغيّر في آخر 7 أيام؟",
  "Explain the ET₀ and Kc calculation.": "اشرح حساب ET₀ وKc.",
  "How confident is this analysis?": "ما مدى الثقة في هذا التحليل؟",
  "Which data is missing?": "أي بيانات ناقصة؟",
  "Boundary supplied by the field profile.": "الحدود مقدَّمة من ملف الحقل.",
  "Coordinate point only — no field boundary is stored, so none is drawn.":
    "نقطة إحداثية فقط — لا حدود محفوظة للحقل، لذلك لا يُرسم أي حد.",
  "The root-zone water balance has crossed the high-demand threshold.":
    "تجاوزت الموازنة المائية لمنطقة الجذور حد الطلب المرتفع.",
  "The server could not be reached. Check that the backend is running on port 8000.":
    "تعذّر الوصول إلى الخادم. تحقق من تشغيل الخادم على المنفذ 8000.",
  "net radiation (MJ m⁻² d⁻¹)": "الإشعاع الصافي (ميجاجول م⁻² يوم⁻¹)",
  "wind speed at 2 m (m s⁻¹)": "سرعة الرياح على ارتفاع مترين (م ث⁻¹)",
  "vapour pressure deficit (kPa)": "عجز ضغط البخار (كيلوباسكال)",
  "root-zone depletion (mm)": "نقص منطقة الجذور (مم)",
  "precipitation, irrigation (mm)": "الأمطار، الري (مم)",
  "runoff, deep drainage (mm)": "الجريان السطحي، الصرف العميق (مم)",
  "total available water (mm)": "إجمالي الماء المتاح (مم)",

  // ── Satellite analysis (Sentinel-1/2 via Google Earth Engine) ───────────
  "Satellite": "الأقمار الصناعية",
  "Latest Sentinel observations": "أحدث أرصاد سينتينل",
  "Sentinel-1 C-band SAR for relative surface wetness and Sentinel-2 optical indices for canopy condition, reduced over the field geometry by Google Earth Engine.":
    "رادار الفتحة الصناعية (SAR) للنطاق C من سينتينل-1 لرطوبة السطح النسبية، ومؤشرات سينتينل-2 البصرية لحالة الغطاء النباتي، محسوبة على شكل الحقل عبر Google Earth Engine.",
  "Saved boundary": "حدود محفوظة",
  "Centre + 0.5 km buffer": "المركز + نطاق 0.5 كم",
  "Analysis settings": "إعدادات التحليل",
  "Start date": "تاريخ البداية",
  "End date": "تاريخ النهاية",
  "Max cloud cover": "أقصى تغطية سحابية",
  "Analysing…": "جارٍ التحليل…",
  "Run satellite analysis": "تشغيل تحليل الأقمار الصناعية",
  "Choose a start date on or before the end date, and no future dates.":
    "اختر تاريخ بداية يسبق تاريخ النهاية أو يساويه، دون تواريخ مستقبلية.",
  "The analysis uses the saved boundary when one exists; otherwise it uses the field centre plus a 0.5 km buffer. The window can be at most 90 days.":
    "يستخدم التحليل الحدود المحفوظة إن وُجدت؛ وإلا استخدم مركز الحقل مع نطاق 0.5 كم. وأقصى مدة للنافذة 90 يومًا.",
  "Earth Engine is reducing satellite pixels…": "يقوم Earth Engine بتجميع بكسلات الأقمار الصناعية…",
  "The first analysis can take up to a minute while Earth Engine starts.":
    "قد يستغرق التحليل الأول حتى دقيقة أثناء بدء تشغيل Earth Engine.",
  "Satellite analysis is not enabled on this server": "تحليل الأقمار الصناعية غير مُفعّل على هذا الخادم",
  "The backend needs an Earth Engine service account. Set GEE_SERVICE_ACCOUNT, GEE_PROJECT and either GEE_PRIVATE_KEY_FILE or GEE_PRIVATE_KEY_JSON, then restart the API.":
    "يحتاج الخادم الخلفي إلى حساب خدمة Earth Engine. اضبط GEE_SERVICE_ACCOUNT وGEE_PROJECT وإما GEE_PRIVATE_KEY_FILE أو GEE_PRIVATE_KEY_JSON، ثم أعد تشغيل الواجهة البرمجية.",
  "No satellite values are invented while the integration is disabled; the rest of the platform keeps using NASA POWER and FAO-56.":
    "لا تُختلق أي قيم للأقمار الصناعية أثناء تعطيل التكامل؛ وتواصل بقية المنصة استخدام NASA POWER وFAO-56.",
  "Retry": "إعادة المحاولة",
  "Back to dashboard": "العودة إلى لوحة المعلومات",
  "Satellite analysis unavailable": "تحليل الأقمار الصناعية غير متاح",
  "The satellite analysis could not be completed.": "تعذّر إكمال تحليل الأقمار الصناعية.",
  "Check the date window, or try again in a few minutes.":
    "تحقق من النطاق الزمني، أو أعد المحاولة بعد بضع دقائق.",
  "Choose a field before opening the satellite analysis.":
    "اختر حقلًا قبل فتح تحليل الأقمار الصناعية.",
  "Surface wetness (relative)": "رطوبة السطح (نسبية)",
  "Sentinel-1 · C-band SAR": "سينتينل-1 · رادار النطاق C",
  "Dry": "جاف",
  "Near normal": "قريب من المعتاد",
  "Wet": "رطب",
  "relative score {value} of 1": "الدرجة النسبية {value} من 1",
  "≈ {percent}% of the documented VV range": "≈ {percent}% من نطاق VV الموثق",
  "Acquisition": "تاريخ الالتقاط",
  "Scenes in window": "المشاهد في النافذة",
  "Valid pixels": "البكسلات الصالحة",
  "No Sentinel-1 classification is available.": "لا يوجد تصنيف متاح من سينتينل-1.",
  "Canopy condition": "حالة الغطاء النباتي",
  "Sentinel-2 · optical": "سينتينل-2 · بصري",
  "No Sentinel-2 indices are available.": "لا توجد مؤشرات متاحة من سينتينل-2.",
  "Sparse canopy": "غطاء متفرق",
  "Moderate canopy": "غطاء معتدل",
  "Dense canopy": "غطاء كثيف",
  "Low canopy water": "محتوى مائي منخفض في الغطاء",
  "Moderate canopy water": "محتوى مائي معتدل في الغطاء",
  "High canopy water": "محتوى مائي مرتفع في الغطاء",
  "Median composite": "مركّب وسيط",
  "Latest usable scene": "أحدث مشهد صالح",
  "Scene cloud cover": "التغطية السحابية للمشهد",
  "Valid fraction": "نسبة البكسلات الصالحة",
  "Analysis window": "نافذة التحليل",
  "Geometry": "الشكل الهندسي",
  "saved field boundary": "حدود الحقل المحفوظة",
  "field centre + buffer": "مركز الحقل + نطاق",
  "Generated": "تاريخ الإنشاء",
  "Satellite map": "خريطة الأقمار الصناعية",
  "Layer map": "خريطة الطبقات",
  "No display layers returned": "لم تُرجع طبقات عرض",
  "The numeric results are still shown above, but Earth Engine returned no tile URLs for this window.":
    "لا تزال النتائج الرقمية معروضة أعلاه، لكن Earth Engine لم يُرجع روابط بلاطات لهذه النافذة.",
  "Index definitions": "تعريفات المؤشرات",
  "How the indices are computed": "كيف تُحسب المؤشرات",
  "Earth Engine reduces cloud-masked pixels inside the selected geometry. The formulas are standard, but the classes are documented heuristic thresholds.":
    "يجمع Earth Engine البكسلات المصفّاة من السحب داخل الشكل المحدد. والصيغ قياسية، أما الفئات فهي حدود تقديرية موثقة.",
  "near-infrared surface reflectance": "الانعكاس السطحي للأشعة تحت الحمراء القريبة",
  "red surface reflectance": "الانعكاس السطحي للأشعة الحمراء",
  "short-wave infrared (20 m) surface reflectance":
    "الانعكاس السطحي للأشعة تحت الحمراء القصيرة (20 م)",
  "green surface reflectance": "الانعكاس السطحي للأشعة الخضراء",
  "NDVI describes canopy greenness, not disease or yield.":
    "يعبّر NDVI عن اخضرار الغطاء النباتي، وليس عن المرض أو المحصول.",
  "NDMI tracks canopy water content; it is not volumetric soil moisture.":
    "يتابع NDMI محتوى الماء في الغطاء النباتي؛ وليس رطوبة التربة الحجمية.",
  "NDWI is sensitive to open water and surface moisture in vegetation.":
    "يتأثر NDWI بالمياه المكشوفة والرطوبة السطحية في الغطاء النباتي.",
  "Relative wetness": "الرطوبة النسبية",
  "Sentinel-1 VV backscatter in dB (speckle-filtered)":
    "الارتداد الخلفي VV من سينتينل-1 بالديسيبل (مصفّى من التشويش النقطي)",
  "dry < −17 dB · near normal −17…−12 dB · wet > −12 dB":
    "جاف < −17 dB · قريب من المعتاد −17…−12 dB · رطب > −12 dB",
  "A relative surface signal: roughness and canopy also change VV.":
    "إشارة سطحية نسبية: خشونة السطح والغطاء النباتي يغيّران VV أيضًا.",
  "No satellite values are simulated in demo mode. If Earth Engine is not configured, this page says so instead of showing mock data.":
    "لا تُحاكى قيم الأقمار الصناعية في الوضع التجريبي. وإذا لم يُهيَّأ Earth Engine، تقول الصفحة ذلك بدل عرض بيانات وهمية.",
  "Related analyses": "تحليلات ذات صلة",
  "Satellite indices are an independent observation. Compare them with the water balance and environmental indicators rather than treating either as a measurement of the other.":
    "مؤشرات الأقمار الصناعية رصد مستقل. قارنها بالموازنة المائية والمؤشرات البيئية بدل اعتبار أي منها قياسًا للآخر.",
  "Surface wetness": "رطوبة السطح",
  "Satellite map showing {name}": "خريطة الأقمار الصناعية للحقل {name}",
  "Satellite analysis map": "خريطة تحليل الأقمار الصناعية",
  "Analysis extent: field centre plus a {km} km buffer":
    "نطاق التحليل: مركز الحقل مع نطاق {km} كم",
  "No Earth Engine layer is currently visible.": "لا تظهر أي طبقة من Earth Engine حاليًا.",
  "Earth Engine layers are temporary display tiles. Values reported on this page come from server-side reductions, not from the rendered colours.":
    "طبقات Earth Engine بلاطات عرض مؤقتة. والقيم المعروضة في هذه الصفحة مصدرها تجميع على الخادم وليس الألوان المعروضة.",

  // Backend satellite interpretations, reasons and limitations
  "VV backscatter is in the dry band for this heuristic. The surface return suggests low near-surface wetness; confirm with the irrigation balance before irrigating.":
    "الارتداد الخلفي VV ضمن النطاق الجاف لهذا التقدير. وتشير الإشارة السطحية إلى رطوبة قريبة من السطح منخفضة؛ تحقق من موازنة الري قبل الري.",
  "VV backscatter is in the wet band for this heuristic. The surface return suggests high near-surface wetness, which may also reflect roughness or dense canopy rather than water alone.":
    "الارتداد الخلفي VV ضمن النطاق الرطب لهذا التقدير. وتشير الإشارة السطحية إلى رطوبة عالية قريبة من السطح، وقد تعكس أيضًا خشونة السطح أو غطاءً كثيفًا لا الماء وحده.",
  "VV backscatter sits inside the mid band. Surface wetness is not anomalous in either direction for this heuristic.":
    "الارتداد الخلفي VV داخل النطاق الأوسط. ورطوبة السطح ليست شاذة في أي اتجاه وفق هذا التقدير.",
  "Sentinel-1 backscatter is unavailable, so surface wetness is not classified.":
    "الارتداد الخلفي من سينتينل-1 غير متاح، لذلك لا تُصنَّف رطوبة السطح.",
  "Sentinel-2 indices are unavailable for the selected window, so canopy condition is not classified.":
    "مؤشرات سينتينل-2 غير متاحة للنافذة المحددة، لذلك لا تُصنَّف حالة الغطاء النباتي.",
  "These indices describe canopy condition only and do not diagnose disease.":
    "تصف هذه المؤشرات حالة الغطاء النباتي فقط ولا تشخّص المرض.",
  "No Sentinel-1 IW scene with both VV and VH polarisation intersected the area inside the selected window.":
    "لم يتقاطع أي مشهد من سينتينل-1 (وضع IW) بقطبي VV وVH مع المنطقة خلال النافذة المحددة.",
  "No valid Sentinel-1 pixels remained inside the geometry.":
    "لم تتبقَّ بكسلات صالحة من سينتينل-1 داخل الشكل المحدد.",
  "No Sentinel-2 scene below the cloud threshold intersected the area inside the selected window.":
    "لم يتقاطع أي مشهد من سينتينل-2 دون حد السحب مع المنطقة خلال النافذة المحددة.",
  "The latest scene had too few cloud-free pixels over the field; indices come from a median composite of the window.":
    "كان أحدث مشهد يضم بكسلات خالية من السحب قليلة جدًا فوق الحقل؛ وتأتي المؤشرات من مركّب وسيط للنافذة.",
  "No valid Sentinel-2 pixels remained inside the geometry after cloud masking.":
    "لم تتبقَّ بكسلات صالحة من سينتينل-2 داخل الشكل المحدد بعد تصفية السحب.",
  "Sentinel-1 backscatter is a relative surface signal. Roughness, crop structure and incidence angle also change it, so the wetness class is not volumetric soil moisture.":
    "الارتداد الخلفي من سينتينل-1 إشارة سطحية نسبية. وتغيّره أيضًا خشونة السطح وبنية المحصول وزاوية السقوط، لذا فئة الرطوبة ليست رطوبة تربة حجمية.",
  "Sentinel-2 indices are cloud-masked with the SCL band. When the latest scene is mostly cloud-covered, a median composite across the window is used and mixes dates.":
    "تُصفّى مؤشرات سينتينل-2 من السحب باستخدام نطاق SCL. وعندما يكون أحدث مشهد مغطى بالسحب غالبًا، يُستخدم مركّب وسيط على النافذة يمزج تواريخ متعددة.",
  "Values are pixel averages over the selected geometry at 10 m and may include non-crop pixels such as tracks, channels or bare soil.":
    "القيم متوسطات بكسلات على الشكل المحدد بدقة 10 م، وقد تشمل بكسلات غير زراعية كالمسارات والقنوات والتربة العارية.",
  "Satellite overpasses are not continuous; the acquisition date is the most recent usable pass inside the selected window, not a real-time measurement.":
    "مرور الأقمار الصناعية ليس مستمرًا؛ وتاريخ الالتقاط هو أحدث مرور صالح داخل النافذة المحددة، وليس قياسًا آنيًا.",
  "Trend": "الاتجاه",
  "Sentinel-2 pass {date}": "تمريرة سينتينل-2 {date}",
  "Cloud cover {percent}%": "التغطية السحابية {percent}%",
  "{count} scenes in the window": "{count} مشهدًا في النافذة",
  "Demo mode does not call Google Earth Engine; switch to live data to read Sentinel-2 NDVI for this field.":
    "الوضع التجريبي لا يستدعي Google Earth Engine؛ بدّل إلى البيانات الحية لقراءة NDVI من سينتينل-2 لهذا الحقل.",
  "Satellite observation at 10 m": "رصد فضائي بدقة 10 م",
  "Most recent usable pass": "أحدث تمريرة صالحة",
  "Earth Engine tile URLs are temporary display layers. The numeric values come from server-side reductions, not from the rendered tiles.":
    "روابط بلاطات Earth Engine طبقات عرض مؤقتة. والقيم الرقمية تأتي من تجميع على الخادم وليس من البلاطات المعروضة.",
  "Satellite analysis is not configured on this server. Add Earth Engine service-account credentials to enable it.":
    "تحليل الأقمار الصناعية غير مُهيَّأ على هذا الخادم. أضف بيانات اعتماد حساب خدمة Earth Engine لتفعيله.",
  "Earth Engine could not complete the satellite analysis. Try again later.":
    "تعذّر على Earth Engine إكمال تحليل الأقمار الصناعية. أعد المحاولة لاحقًا.",
  "Earth Engine authentication failed. Check the service-account credentials and project registration.":
    "فشلت مصادقة Earth Engine. تحقق من بيانات اعتماد حساب الخدمة وتسجيل المشروع.",
  "The Earth Engine client library is not installed on the server.":
    "مكتبة عميل Earth Engine غير مثبتة على الخادم.",
  "The Earth Engine service-account key file was not found on the server.":
    "لم يُعثر على ملف مفتاح حساب خدمة Earth Engine على الخادم.",
  "The Earth Engine service-account key is not valid JSON.":
    "مفتاح حساب خدمة Earth Engine ليس بصيغة JSON صالحة.",
  "Earth Engine credentials are not configured on the server.":
    "بيانات اعتماد Earth Engine غير مُهيَّأة على الخادم.",

  // ── Season completion and indicator agreement ───────────────────────────
  "SEASON COMPLETE": "انتهى الموسم",
  "Season complete": "انتهى الموسم",
  "Season status": "حالة الموسم",
  "The crop season has ended. No irrigation demand is assessed after harvest.":
    "انتهى موسم المحصول. لا يُقيَّم طلب الري بعد الحصاد.",
  "The crop season has ended. Crop health is not assessed after harvest.":
    "انتهى موسم المحصول. لا تُقيَّم صحة المحصول بعد الحصاد.",
  "Weather after harvest is not crop water demand, so no demand class is shown.":
    "الطقس بعد الحصاد ليس طلبًا مائيًا للمحصول، لذلك لا تُعرض فئة طلب.",
  "The crop season has ended; weather after harvest does not describe crop health.":
    "انتهى موسم المحصول؛ والطقس بعد الحصاد لا يصف صحة المحصول.",
  "Create a new field with the next planting date to analyse the new season.":
    "أنشئ حقلًا جديدًا بتاريخ الزراعة القادم لتحليل الموسم الجديد.",
  "Indicator agreement": "توافق المؤشرات",
  "Not at stress level: {clean} of {known} available indicators.":
    "ليست عند مستوى إجهاد: {clean} من {known} مؤشرات متاحة.",
  "Share of available indicators that are not at stress level. This is indicator agreement, not a probability of crop health or a yield estimate.":
    "نسبة المؤشرات المتاحة التي ليست عند مستوى إجهاد. هذا توافق بين المؤشرات، وليس احتمالًا لصحة المحصول ولا تقديرًا للمحصول.",

  // ── Simplified farmer guide ─────────────────────────────────────────────
  "Simple farmer guide": "دليل المزارع المبسط",
  "Maize": "الذرة",
  "Tomato": "الطماطم",
  "Potato": "البطاطس",
  "Egyptian clover (berseem)": "البرسيم",
  "Sugarcane": "قصب السكر",
  "Cotton": "القطن",
  "Rice": "الأرز",

  "Irrigate early in the morning to reduce evaporation.":
    "اسقِ في الصباح الباكر لتقليل تبخّر الماء.",
  "Protect seedlings from frost overnight.": "احمِ الشتلات من الصقيع خلال الليل.",
  "Hold irrigation if the expected rain is enough.":
    "أجّل الري إذا كانت الأمطار المتوقعة كافية.",
  "Delay spraying or foliar feeding while the wind is strong.":
    "أجّل الرش أو التغذية الورقية ما دامت الرياح قوية.",
  "The weather is suitable for farm work.": "الطقس مناسب للعمل في الحقل.",

  "The soil is dry — irrigation is advised today.": "التربة جافة — يُنصح بالري اليوم.",
  "The soil is moist — no irrigation is needed today.":
    "التربة رطبة — لا حاجة للري اليوم.",
  "No recent soil reading — check the soil by hand.":
    "لا توجد قراءة حديثة للتربة — افحص التربة بيدك.",
  "A light irrigation before sowing is advised.": "يُنصح بريّة خفيفة قبل البذر.",
  "Wait for the soil to drain a little before sowing.":
    "انتظر حتى تصرّف التربة قليلًا من الماء قبل البذر.",
  "Soil moisture is suitable for sowing.": "رطوبة التربة مناسبة للبذر.",

  "A hot spell is expected": "يُتوقع موجة حرارة",
  "Frost risk is expected": "يُتوقع خطر صقيع",
  "Rain is expected": "يُتوقع مطر",
  "Strong wind is expected": "تُتوقع رياح قوية",
  "Stable, suitable weather": "طقس مستقر ومناسب",
  "The forecast is unavailable": "التوقعات غير متاحة",

  "Excellent": "ممتازة",
  "Fair — needs follow-up": "متوسطة وتحتاج متابعة",
  "Weak — needs follow-up": "ضعيفة وتحتاج متابعة",
  "Very weak": "ضعيفة جدًا",
  "Not available": "غير متاح",

  "The crop looks in excellent condition in the latest image.":
    "يبدو المحصول في حالة ممتازة في أحدث صورة.",
  "The crop looks in good condition.": "يبدو المحصول في حالة جيدة.",
  "Condition is moderate — keep an eye on the crop during the coming days.":
    "الحالة متوسطة — راقب المحصول في الأيام القادمة.",
  "Condition is weak — check irrigation and the crop in the field.":
    "الحالة ضعيفة — راجع الري والمحصول في الحقل.",
  "Condition is very weak — review the crop with an agronomist.":
    "الحالة ضعيفة جدًا — راجع المحصول مع مهندس زراعي.",

  "Suitable for planting now": "مناسب للزراعة الآن",
  "Suitable with caution": "مناسب بحذر",
  "Not suitable right now": "غير مناسب حاليًا",
  "Cannot be assessed right now": "لا يمكن التقييم حاليًا",

  "Moisture is in the suitable range": "الرطوبة في المدى المناسب",
  "Very wet": "رطبة جدًا",

  "Weather today": "الطقس اليوم",
  "Weather data is not available right now.": "بيانات الطقس غير متاحة حاليًا.",
  "Observed by NASA POWER on {date}": "أرصاد NASA POWER بتاريخ {date}",
  "Forecast and advice": "التوقعات والنصيحة",
  "No weather forecast is available right now. Today's conditions are shown above.":
    "لا توجد توقعات طقس متاحة حاليًا. أحوال اليوم معروضة أعلاه.",
  "Forecast from Open-Meteo, not from NASA POWER.":
    "التوقعات من Open-Meteo وليست من NASA POWER.",

  "{month} is the best month to plant {crop} in Egypt.":
    "{month} هو أفضل شهر لزراعة {crop} في مصر.",
  "{month} is an acceptable planting month for {crop}; the best is {months}.":
    "{month} شهر مقبول لزراعة {crop}؛ والأفضل هو {months}.",
  "{month} is outside the usual planting window for {crop} in Egypt ({months}).":
    "{month} خارج موعد الزراعة المعتاد لـ{crop} في مصر ({months}).",
  "Today's mean temperature, {temp}°, is above the suitable range ({min}–{max}°).":
    "متوسط حرارة اليوم {temp}° أعلى من المدى المناسب ({min}–{max}°).",
  "Today's mean temperature, {temp}°, is below the suitable range ({min}–{max}°).":
    "متوسط حرارة اليوم {temp}° أقل من المدى المناسب ({min}–{max}°).",
  "Today's mean temperature, {temp}°, is inside the suitable range ({min}–{max}°).":
    "متوسط حرارة اليوم {temp}° داخل المدى المناسب ({min}–{max}°).",
  "The radar reading shows soil moisture in the suitable range for sowing.":
    "تظهر قراءة الرادار أن رطوبة التربة في المدى المناسب للبذر.",
  "The surface looks dry; a light irrigation before sowing is advised.":
    "يبدو السطح جافًا؛ ويُنصح بريّة خفيفة قبل البذر.",
  "The surface looks saturated; wait for it to drain before sowing.":
    "يبدو السطح مشبعًا بالماء؛ انتظر حتى يصرّف قبل البذر.",
  "No recent radar reading of the soil is available, so this result rests on month and temperature.":
    "لا تتوفر قراءة رادار حديثة للتربة، لذلك تعتمد هذه النتيجة على الشهر والحرارة.",
  "No recent weather is available, so a readiness percentage cannot be computed.":
    "لا يتوفر طقس حديث، لذلك لا يمكن حساب نسبة الجاهزية.",

  "Planting suitability": "ملاءمة الزراعة",
  "A percentage cannot be computed without recent weather.":
    "لا يمكن حساب النسبة دون طقس حديث.",
  "Month": "الشهر",
  "Best planting months": "أفضل شهور الزراعة",
  "Suitable temperature": "الحرارة المناسبة",
  "Today: {temp}°": "اليوم: {temp}°",
  "Soil moisture": "رطوبة التربة",

  "Satellite imagery is not enabled on this server.":
    "صور الأقمار الصناعية غير مفعّلة على هذا الخادم.",
  "A recent satellite image could not be retrieved. Try again a little later.":
    "تعذّر جلب صورة حديثة من القمر الصناعي. أعد المحاولة بعد قليل.",
  "There is no recent cloud-free image for this location.":
    "لا توجد صورة حديثة خالية من السحب لهذا الموقع.",
  "Crop health score": "درجة صحة المحصول",
  "Last satellite image": "أحدث صورة من القمر الصناعي",
  "Radar reading on {date}": "قراءة الرادار بتاريخ {date}",

  "My current location": "موقعي الحالي",
  "Selected point on the map": "النقطة المحددة على الخريطة",
  "This browser does not support location.": "هذا المتصفح لا يدعم تحديد الموقع.",
  "Location permission was denied. Choose a governorate or tap the map.":
    "تم رفض إذن الموقع. اختر محافظة أو انقر على الخريطة.",
  "Select your farm location first.": "حدّد موقع مزرعتك أولًا.",
  "Choose whether you want to plant now or the crop is already planted.":
    "اختر: تريد الزراعة الآن أم المحصول مزروع بالفعل.",
  "The check could not be completed.": "تعذّر إكمال الفحص.",

  "Check your farm in one minute": "افحص مزرعتك في دقيقة",
  "Choose your farm, your crop and your situation. We show clear percentages and advice from satellite and weather data — without technical terms.":
    "اختر مزرعتك ومحصولك وحالتك. نعرض نسبًا واضحة ونصائح من بيانات الأقمار الصناعية والطقس — دون مصطلحات فنية.",
  "This page needs live satellite and weather data.":
    "تحتاج هذه الصفحة إلى بيانات حية من الأقمار الصناعية والطقس.",
  "Where is your farm?": "أين تقع مزرعتك؟",
  "Finding your location…": "جارٍ تحديد موقعك…",
  "Use my current location": "استخدم موقعي الحالي",
  "Or choose your governorate": "أو اختر محافظتك",
  "Choose a governorate…": "اختر محافظة…",
  "The governorate pin is approximate. Move it on the map for your exact farm.":
    "علامة المحافظة تقريبية. حرّكها على الخريطة لتحديد مزرعتك بدقة.",
  "Farm location": "موقع المزرعة",
  "Tap the map to place the farm pin.": "انقر على الخريطة لوضع علامة المزرعة.",
  "Your location is used only for this analysis and is not saved by this page.":
    "يُستخدم موقعك لهذا الفحص فقط ولا تُحفظه هذه الصفحة.",
  "Which crop?": "ما المحصول؟",
  "What is your situation?": "ما حالتك؟",
  "I want to plant now": "أريد الزراعة الآن",
  "We check the month, the weather and the soil before sowing.":
    "نتحقق من الشهر والطقس والتربة قبل البذر.",
  "The crop is already planted": "المحصول مزروع بالفعل",
  "We check crop health, soil moisture and the weather.":
    "نتحقق من صحة المحصول ورطوبة التربة والطقس.",
  "Checking your farm…": "جارٍ فحص مزرعتك…",
  "Show result": "اعرض النتيجة",
  "Result": "النتيجة",
  "Assessed on {date}": "التقييم بتاريخ {date}",
  "Result unavailable": "النتيجة غير متاحة",
  "This page needs live satellite and weather data, and demo mode cannot describe today's field.":
    "تحتاج هذه الصفحة إلى بيانات حية من الأقمار الصناعية والطقس، والوضع التجريبي لا يصف حقل اليوم.",
  "These numbers are descriptive scores from satellite and weather data. They do not diagnose disease, do not predict yield and do not replace field inspection.":
    "هذه الأرقام درجات وصفية من بيانات الأقمار الصناعية والطقس. لا تشخّص الأمراض ولا تتنبأ بالمحصول ولا تغني عن المعاينة الميدانية.",
  "Open the detailed dashboard": "افتح لوحة المتابعة التفصيلية",
  "Satellite data: Copernicus Sentinel-1/2 via Google Earth Engine. Weather: NASA POWER and Open-Meteo.":
    "بيانات الأقمار: كوبرنيكوس سينتينل-1/2 عبر Google Earth Engine. الطقس: NASA POWER وOpen-Meteo.",

  // Timeline guidance
  "Timeline guidance": "إرشادات الجدول الزمني",
  "Planted on {date} · day {n}": "زُرع في {date} · اليوم {n}",
  "Expected emergence window": "نافذة الإنبات المتوقعة",
  "What you should know": "ما يجب أن تعرفه",
  "No specific risk is flagged for the coming days.": "لا توجد مخاطر محددة مُنبَّه إليها للأيام القادمة.",
  "What to do": "ما يجب فعله",
  "Plant at a depth of {min}–{max} cm for this crop.": "ازرع على عمق {min}–{max} سم لهذا المحصول.",
  "Plant certified seed tubers in ridges; plant whole tubers rather than cut ones.":
    "ازرع درنات تقاوي معتمدة في خطوط مرتفعة، واستخدم درنات كاملة بدلًا من المقطوعة.",
  "Harden the seedlings for a few days before moving them to the field.":
    "قسِّ الشتلات تدريجيًا لعدة أيام قبل نقلها إلى الحقل.",
  "Transplant the seedlings at the recommended spacing when conditions are suitable.":
    "انقل الشتلات إلى الحقل بالمسافات الموصى بها عندما تكون الظروف مناسبة.",
  "Check the transplants for wilting or gaps and replace missing plants.":
    "افحص الشتلات بحثًا عن الذبول أو الفراغات واستبدل النباتات الغائبة.",
  "Earth up the ridges around the stems to protect the developing tubers.":
    "ارفع التراب حول السيقان لحماية الدرنات النامية.",
  "Stake or trellis the plants so the growing stems stay off the ground.":
    "ادعم النباتات بالدعامات أو الشبك حتى تبقى السيقان النامية بعيدة عن الأرض.",
  "Before planting / land preparation": "قبل الزراعة / تجهيز الأرض",
  "Planted a few days ago": "زُرع منذ أيام قليلة",
  "Established crop": "محصول في مرحلة متقدمة",
  "This is what matters in the week before sowing.": "هذا ما يهم في الأسبوع الذي يسبق البذر.",
  "This is what matters during germination and the first weeks.": "هذا ما يهم أثناء الإنبات والأسابيع الأولى.",
  "The crop is past the seedling stage; keep monitoring it.": "تجاوز المحصول مرحلة البادرة؛ واصل متابعته.",
  "The seedbed looks dry — seeds may not get enough moisture to germinate.":
    "مهد البذور يبدو جافًا — قد لا تحصل البذور على رطوبة كافية للإنبات.",
  "The surface is very wet; waterlogging can harm seeds and young roots.":
    "السطح شديد الرطوبة؛ قد يضر الغرق البذور والجذور الصغيرة.",
  "Rain is expected and can form a crust that blocks seedling emergence.":
    "مطر متوقع وقد يكوّن قشرة تمنع ظهور البادرات.",
  "High temperatures are expected and can stress the crop.":
    "درجات حرارة مرتفعة متوقعة وقد تُجهد المحصول.",
  "Cold nights are expected and can damage young plants.":
    "ليالٍ باردة متوقعة وقد تضر النباتات الصغيرة.",
  "Strong wind is expected and can damage seedlings or dry the surface.":
    "رياح قوية متوقعة وقد تضر البادرات أو تجفف سطح التربة.",
  "The latest satellite image shows weak canopy condition.":
    "تُظهر أحدث صورة قمر صناعي ضعفًا في حالة الغطاء النباتي.",
  "The expected emergence window has passed — check the stand in the field.":
    "انتهت نافذة الإنبات المتوقعة — افحص كثافة النباتات في الحقل.",
  "Prepare a fine, level seedbed with tillage before sowing.":
    "جهّز مهد بذور ناعمًا ومستويًا بالحراثة قبل البذر.",
  "The soil is dry — irrigate lightly before sowing to settle the seedbed.":
    "التربة جافة — اروِ ريّا خفيفة قبل البذر لتستقر التربة.",
  "Wait for the soil to drain before sowing.": "انتظر حتى تتصرّف التربة الماء قبل البذر.",
  "Conditions are suitable — sow inside the recommended window.":
    "الظروف مناسبة — ازرع داخل النافذة الموصى بها.",
  "Sow at the recommended depth for this crop.": "ازرع على العمق الموصى به لهذا المحصول.",
  "Apply the basal fertiliser at sowing according to a soil test or extension advice.":
    "أضف السماد الأساسي عند الزراعة وفق تحليل التربة أو إرشاد جهة الإرشاد الزراعي.",
  "If irrigation is needed, apply it early in the morning.": "إذا لزم الري، فطبّقه في الصباح الباكر.",
  "Check seedbed moisture by hand every day until emergence.":
    "افحص رطوبة مهد البذور يدويًا كل يوم حتى الإنبات.",
  "Give a light irrigation to keep the seedbed moist without flooding.":
    "أعطِ ريّا خفيفة للحفاظ على رطوبة مهد البذور دون إغراق.",
  "Do not irrigate until the surface drains; excess water can rot the seed.":
    "لا تروِ حتى يتصرّف سطح التربة؛ الماء الزائد قد يعفّن البذور.",
  "Check the field for emergence during the expected window.":
    "افحص الحقل بحثًا عن الإنبات خلال النافذة المتوقعة.",
  "Avoid deep hoeing or machinery over the rows to protect young roots.":
    "تجنّب العزيق العميق أو مرور الآلات فوق الخطوط لحماية الجذور الصغيرة.",
  "Check for early weeds competing with the seedlings.": "افحص الأعشاب المبكرة المنافسة للبادرات.",
  "Inspect for early pests such as cutworm or aphids; ask an agronomist if unsure.":
    "افحص الآفات المبكرة مثل الدودة القارضة أو المن؛ استشر مهندسًا زراعيًا عند الشك.",
  "Keep monitoring the crop and soil every few days.": "واصل مراقبة المحصول والتربة كل بضعة أيام.",
  "Protect the crop from frost overnight.": "احمِ المحصول من الصقيع ليلًا.",

  // Planting date presets and demo fields
  "3 days ago": "قبل 3 أيام",
  "About a week ago": "قبل أسبوع تقريبًا",
  "About two weeks ago": "قبل أسبوعين تقريبًا",
  "More than three weeks ago": "قبل أكثر من ثلاثة أسابيع",
  "When did you plant?": "متى زرعت؟",
  "With this choice the crop is treated as past the seedling stage.":
    "بهذا الاختيار يُعامَل المحصول كأنه تجاوز مرحلة البادرة.",
  "Try a real example field": "جرّب حقلًا حقيقيًا كنموذج",
  "Tap one of these real locations to run the full satellite and weather check instantly.":
    "انقر على أحد هذه المواقع الحقيقية لتشغيل فحص الأقمار والطقس كاملًا فورًا.",
  "Preparing to plant": "يستعد للزراعة",
  "Already planted": "مزروع بالفعل",

  // Result map and corrections
  "Switch between vegetation health, soil moisture and the natural-colour image.":
    "بدّل بين صحة النبات ورطوبة التربة وصورة القمر الصناعي الطبيعية الألوان.",
  "Some readings were automatically corrected before display ({n}).":
    "صُحّحت بعض القراءات تلقائيًا قبل العرض ({n}).",
  "Vegetation health (NDVI)": "صحة النبات (NDVI)",
  "Soil moisture (Sentinel-1)": "رطوبة التربة (Sentinel-1)",
  "True colour image (RGB)": "صورة القمر الصناعي الطبيعية (RGB)",
  "Natural-colour Sentinel-2 composite.": "تركيب سينتينل-2 بالألوان الطبيعية.",
  "No satellite layer is available for this field right now.":
    "لا تتوفر طبقة أقمار صناعية لهذا الحقل الآن.",
  "The coloured layer is a temporary display tile. The percentages and advice on this page come from server-side calculations, not from the tile colours.":
    "الطبقة الملوّنة صورة عرض مؤقتة. النسب والنصائح في هذه الصفحة تأتي من حسابات الخادم وليس من ألوان الصورة.",

  // Field-tool demo trials
  "Demo trials": "التجارب التجريبية",
  "Loading demo trials…": "جارٍ تحميل التجارب…",
  "Demo trials could not be loaded.": "تعذّر تحميل التجارب.",
  "The demo field could not be prepared.": "تعذّر تجهيز الحقل التجريبي.",
  "Start from a real example field": "ابدأ من حقل حقيقي كنموذج",
  "Try this tool on four real fields": "جرّب هذه الأداة على أربعة حقول حقيقية",
  "These are real Egyptian locations. A tap fills the form and the boundary; nothing is submitted until you create the field.":
    "هذه مواقع مصرية حقيقية. النقرة تملأ النموذج والحدود، ولا يُنشأ الحقل حتى تضغط زر الإنشاء.",
  "Each tap opens a clearly labelled demo field and runs the live analysis of this page. Satellite and weather values are never predefined.":
    "كل نقرة تفتح حقلًا تجريبيًا مُعلَّمًا بوضوح وتشغّل التحليل الحيّ لهذه الصفحة. لا تُحدَّد قيم الأقمار أو الطقس مسبقًا.",
  "Trial 1": "التجربة 1",
  "Trial 2": "التجربة 2",
  "Trial 3": "التجربة 3",
  "Trial 4": "التجربة 4",
  "Trial": "تجربة",
  "Open": "مفتوح",
  "Preparing the demo field…": "جارٍ تجهيز الحقل التجريبي…",
  "Demo trial values are filled in. Review the location and boundary, then create the field to run the analyses.":
    "تم تعبئة قيم التجربة. راجع الموقع والحدود ثم أنشئ الحقل لتشغيل التحليلات.",

  // Map display controls
  "Layer opacity": "شفافية الطبقة",
  "Opacity": "الشفافية",

  // Explore Map
  "Explore map": "استكشاف الخريطة",
  "Inspect any point or field": "افحص أي نقطة أو حقل",
  "Click the map, search for a place, or draw a field outline. Analyses use openly licensed weather, soil and satellite services through this app's backend.":
    "اضغط على الخريطة أو ابحث عن مكان أو ارسم حدود الحقل. تستخدم التحليلات خدمات طقس وتربة وأقمار مفتوحة الترخيص عبر خادم التطبيق.",
  "My location": "موقعي",
  "Locating…": "جارٍ تحديد الموقع…",
  "Drawing: click corners": "الرسم: اضغط على الزوايا",
  "e.g. Qena, Egypt or a village name": "مثال: قنا، مصر أو اسم قرية",
  "Place search uses OpenStreetMap Nominatim through the backend. It names a place; it is not a measurement.":
    "يستخدم بحث الأماكن خدمة OpenStreetMap Nominatim عبر الخادم. هو يسمّي المكان ولا يمثّل قياسًا.",
  "No matching place found. Try a nearby town, or click the map directly.":
    "لم يُعثر على مكان مطابق. جرّب بلدة قريبة أو اضغط على الخريطة مباشرة.",
  "This browser does not provide a location.": "هذا المتصفح لا يوفّر خدمة تحديد الموقع.",
  "The browser could not determine your position. You can click the map instead.":
    "تعذّر على المتصفح تحديد موقعك. يمكنك الضغط على الخريطة بدلًا من ذلك.",
  "Corners are joined in click order. A polygon is sent only when you choose Analyse field.":
    "تُوصل الزوايا بترتيب الضغط. لا يُرسل المضلع إلا عند اختيار «تحليل الحقل».",
  "Click anywhere to select a coordinate. NASA GIBS imagery is optional visual context only.":
    "اضغط في أي مكان لاختيار إحداثيات. صور NASA GIBS سياق بصري اختياري فقط.",
  "Drawn field": "الحقل المرسوم",
  "Corners": "الزوايا",
  "Centre": "المركز",
  "The outline crosses itself. Undo a corner so the edges do not intersect.":
    "الحدود تتقاطع مع نفسها. تراجع عن زاوية حتى لا تتقاطع الأضلاع.",
  "Analyse field": "تحليل الحقل",
  "Weather is sampled at the centre of the outline. Area is planar geometry from your corners, not a survey.":
    "يُؤخذ الطقس عند مركز الحدود. المساحة هندسة مستوية من زواياك وليست مسحًا ميدانيًا.",
  "Reading current conditions…": "جارٍ قراءة الأحوال الحالية…",
  "Conditions unavailable": "الأحوال غير متاحة",
  "The location service could not answer.": "لم تستجب خدمة الموقع.",
  "Live": "مباشر",
  "Selected point": "نقطة مختارة",
  "Crop suitability": "ملاءمة المحصول",
  "How to start": "كيف تبدأ",
  "Search for a town or address, then choose a result.": "ابحث عن بلدة أو عنوان ثم اختر نتيجة.",
  "Or click any point on the map.": "أو اضغط على أي نقطة في الخريطة.",
  "To analyse a whole field, draw its outline and choose Analyse field.":
    "لتحليل حقل كامل، ارسم حدوده ثم اختر «تحليل الحقل».",
  "Saved field profiles stay available from Fields and the field switcher.":
    "تبقى ملفات الحقول المحفوظة متاحة من صفحة الحقول ومُبدّل الحقول.",
  "Open-Meteo, NASA POWER and satellite products are models or gridded estimates. They are not measurements taken in this field.":
    "Open-Meteo وNASA POWER ومنتجات الأقمار نماذج أو تقديرات شبكية، وليست قياسات أُخذت في هذا الحقل.",

  // Location analysis
  "Location analysis": "تحليل الموقع",
  "Live analysis": "تحليل مباشر",
  "Partly unavailable": "متاح جزئيًا",
  "Current conditions": "الأحوال الحالية",
  "Weather": "الطقس",
  "Water": "المياه",
  "Vegetation": "الغطاء النباتي",
  "Historical data": "البيانات التاريخية",
  "Where this is": "أين يقع هذا",
  "Country": "الدولة",
  "Region": "المنطقة",
  "County / district": "المقاطعة / المركز",
  "Nearest place": "أقرب مكان",
  "Suburb": "الضاحية",
  "Road": "الطريق",
  "Analysis cell": "خلية التحليل",
  "Point": "نقطة",
  "Polygon field": "حقل مضلّع",
  "Name": "الاسم",
  "Coordinates": "الإحداثيات",
  "Save as a field": "حفظ كحقل",
  "Loading the saved field…": "جارٍ تحميل الحقل المحفوظ…",
  "No location selected": "لم يُحدَّد موقع",
  "Choose a point or draw a field on the Explore Map first.":
    "اختر نقطة أو ارسم حقلًا في خريطة الاستكشاف أولًا.",
  "Open Explore Map": "افتح خريطة الاستكشاف",
  "Location analysis sections": "أقسام تحليل الموقع",
  "Reading current conditions and the last 30 days…": "جارٍ قراءة الأحوال الحالية وآخر 30 يومًا…",
  "Location overview unavailable": "ملخص الموقع غير متاح",
  "Water balance, last {n} days": "الموازنة المائية، آخر {n} يومًا",
  "Rain": "المطر",
  "Balance": "الموازنة",
  "Surplus": "فائض",
  "Near balance": "قريب من التوازن",
  "Deficit": "عجز",
  "Severe deficit": "عجز شديد",
  "Rain minus ET₀. A model balance, not a soil probe.":
    "المطر ناقص ET₀. موازنة نموذجية وليست قياسًا لرطوبة التربة.",
  "Water deficit": "عجز مائي",
  "Daily weather, last {n} days": "الطقس اليومي، آخر {n} يومًا",
  "Temperature lines use the left axis; rainfall bars use the right axis.":
    "خطوط الحرارة على المحور الأيسر وأعمدة المطر على المحور الأيمن.",
  "Period summary": "ملخص المدة",
  "Weather values are model or gridded estimates for the nearest cell, not readings from an on-farm station. The window ends at the latest date the source reliably covers.":
    "قيم الطقس تقديرات نموذجية أو شبكية لأقرب خلية، وليست قراءات من محطة داخل الحقل. تنتهي المدة عند آخر تاريخ يغطيه المصدر بموثوقية.",
  "Water readings": "قراءات المياه",
  "Rainfall, ET₀ and cumulative balance": "المطر وET₀ والموازنة التراكمية",
  "Bars are daily rain, the left line is daily reference ET₀, and the right line is the running rain-minus-ET₀ balance.":
    "الأعمدة مطر يومي، والخط الأيسر ET₀ اليومي، والخط الأيمن موازنة المطر ناقص ET₀ التراكمية.",
  "Balance is a climatological water balance over the period, not an irrigation schedule.":
    "الموازنة مناخية لهذه المدة وليست جدول ري.",
  "Rain (mm/day)": "المطر (مم/يوم)",
  "Cumulative balance (mm)": "الموازنة التراكمية (مم)",
  "Balance classification: {value}": "تصنيف الموازنة: {value}",
  "A negative balance means atmospheric demand exceeded rainfall; it does not by itself prove crop water stress. Soil water-holding capacity and irrigation are not included.":
    "الموازنة السالبة تعني أن الطلب الجوي تجاوز المطر، ولا تثبت وحدها إجهاد المحصول المائي. لا تُحتسب سعة احتفاظ التربة ولا الري.",
  "Reading SoilGrids modelled soil properties…": "جارٍ قراءة خصائص التربة النموذجية من SoilGrids…",
  "Soil data unavailable": "بيانات التربة غير متاحة",
  "The soil service could not answer.": "لم تستجب خدمة التربة.",
  "No soil properties for this location": "لا توجد خصائص تربة لهذا الموقع",
  "The soil source returned no values for this cell.": "لم يُرجع مصدر التربة قيمًا لهذه الخلية.",
  "Texture class": "صنف القوام",
  "Topsoil values, 0–30 cm": "قيم التربة السطحية، 0–30 سم",
  "Silt": "الغرين",
  "Soil properties by depth": "خصائص التربة حسب العمق",
  "SoilGrids modelled values at 250 m resolution. Units follow the source.":
    "قيم SoilGrids النموذجية بدقة 250 م. الوحدات وفق المصدر.",
  "Depth": "العمق",
  "SOC g/kg": "الكربون العضوي غ/كغ",
  "Clay %": "الطين ٪",
  "Sand %": "الرمل ٪",
  "Silt %": "الغرين ٪",
  "N g/kg": "النيتروجين غ/كغ",
  "SoilGrids is a global model, not a soil test. Use laboratory analysis before fertiliser or lime decisions.":
    "SoilGrids نموذج عالمي وليس تحليل تربة. استخدم تحليلًا مخبريًا قبل قرارات التسميد أو الجير.",
  "Soil alerts": "تنبيهات التربة",
  "Vegetation indices": "مؤشرات الغطاء النباتي",
  "Latest compositing window: {start} → {end}": "أحدث نافذة تركيب: {start} ← {end}",
  "History": "الفترة السابقة",
  "3 months": "3 أشهر",
  "6 months": "6 أشهر",
  "12 months": "12 شهرًا",
  "24 months": "24 شهرًا",
  "Sentinel-2 surface reflectance composite": "مركّب انعكاس سطح Sentinel-2",
  "Less saturated in dense canopies": "أقل تشبعًا في الغطاء الكثيف",
  "Canopy moisture index, not soil water": "مؤشر رطوبة الغطاء وليس ماء التربة",
  "NDVI change": "تغير NDVI",
  "Greener": "أكثر اخضرارًا",
  "Less green": "أقل اخضرارًا",
  "Compared with {start} → {end}": "مقارنةً بـ {start} ← {end}",
  "No comparable previous window": "لا توجد نافذة سابقة قابلة للمقارنة",
  "Monthly NDVI": "NDVI الشهري",
  "Monthly mean of cloud-masked Sentinel-2 scenes. Gaps mean no usable scene, not zero vegetation.":
    "متوسط شهري لمشاهد Sentinel-2 بعد إزالة السحاب. الفجوات تعني عدم وجود مشهد صالح وليس انعدام الغطاء.",
  "{n} months · index values, unitless.": "{n} أشهر · قيم مؤشرات بلا وحدة.",
  "No monthly NDVI": "لا يوجد NDVI شهري",
  "Land cover": "الغطاء الأرضي",
  "Dynamic World class for the latest composite.": "صنف Dynamic World لأحدث مركّب.",
  "SMAP surface soil moisture": "رطوبة التربة السطحية SMAP",
  "No SMAP value for this period.": "لا توجد قيمة SMAP لهذه المدة.",
  "GPM monthly precipitation": "هطول GPM الشهري",
  "No monthly GPM value.": "لا توجد قيمة GPM شهرية.",
  "Reading SoilGrids modelled soil properties… ": "جارٍ قراءة خصائص التربة النموذجية… ",
  "Asking Google Earth Engine for Sentinel-2 and SMAP… this can take a minute.":
    "جارٍ طلب Sentinel-2 وSMAP من Google Earth Engine… قد يستغرق دقيقة.",
  "Vegetation data unavailable": "بيانات الغطاء النباتي غير متاحة",
  "The satellite service could not answer.": "لم تستجب خدمة الأقمار.",
  "Earth Engine may be unauthenticated on this machine. The field pages still work.":
    "قد يكون Earth Engine غير مُوثَّق على هذا الجهاز. صفحات الحقول تعمل رغم ذلك.",
  "No satellite vegetation summary": "لا يوجد ملخص نباتي بالأقمار",
  "Earth Engine returned no usable observations for this area.": "لم يُرجع Earth Engine مشاهدات صالحة لهذه المنطقة.",

  // Historical
  "Historical climate": "المناخ التاريخي",
  "Available {start} → {end}.": "المتاح {start} ← {end}.",
  "Window": "المدة",
  "3 years": "3 سنوات",
  "5 years": "5 سنوات",
  "10 years": "10 سنوات",
  "This period compared": "مقارنة هذه المدة",
  "Anomalies are against the long-term baseline of the same calendar window. Missing comparison periods are omitted.":
    "الشذوذ مقارنةً بالمعدل الطويل لنفس النافذة التقويمية. تُحذف فترات المقارنة غير المتاحة.",
  "Period": "الفترة",
  "Mean temp": "متوسط الحرارة",
  "Temp anomaly": "شذوذ الحرارة",
  "Rain anomaly": "شذوذ المطر",
  "Drought screen: {value}": "فحص الجفاف: {value}",
  "Monthly temperature and rainfall": "الحرارة والمطر الشهريان",
  "Every month the archive returned in the selected window. Rainfall uses the right axis.":
    "كل شهر أرجعه الأرشيف في المدة المختارة. المطر على المحور الأيمن.",
  "Year by year": "سنة بسنة",
  "Annual mean temperature and total rainfall for complete archive years, plus the current partial year.":
    "متوسط الحرارة السنوي وإجمالي المطر للسنوات المكتملة مع السنة الجارية الجزئية.",
  "Partial years are marked by fewer days present; they are not extrapolated.":
    "تُعلَّم السنوات الجزئية بعدد أيام أقل، ولا تُستقرأ قيمها.",
  "Historical data unavailable": "البيانات التاريخية غير متاحة",
  "The archive service could not answer.": "لم تستجب خدمة الأرشيف.",
  "No historical series": "لا توجد سلسلة تاريخية",
  "The archive returned no usable daily values for this point.":
    "لم يُرجع الأرشيف قيمًا يومية صالحة لهذه النقطة.",
  "Building the climate record from Open-Meteo ERA5… the first request can take up to a minute.":
    "جارٍ بناء السجل المناخي من Open-Meteo ERA5… قد يستغرق الطلب الأول دقيقة.",
  "{rain} mm over the last {days} days sits at the {pct}th {method}":
    "{rain} مم خلال آخر {days} يومًا؛ الترتيب المئوي {pct} ({method})",
  "Loading the crop catalogue…": "جارٍ تحميل قائمة المحاصيل…",
  "Crop catalogue unavailable": "قائمة المحاصيل غير متاحة",
  "The crop list could not be loaded.": "تعذّر تحميل قائمة المحاصيل.",

  // Crop intelligence
  "Choose crops to compare": "اختر محاصيل للمقارنة",
  "Select up to {n}. Calendars are regional Egyptian extension defaults.":
    "اختر حتى {n}. التقاويم افتراضات إرشادية إقليمية مصرية.",
  "Side-by-side": "مقارنة جانبية",
  "Verdict": "الحكم",
  "Score": "الدرجة",
  "Ideal planting": "الزراعة المثلى",
  "No crop selected": "لم يُختر محصول",
  "Choose at least one crop above.": "اختر محصولًا واحدًا على الأقل أعلاه.",
  "Suitable": "مناسب",
  "Marginal": "هامشي",
  "Not suitable": "غير مناسب",
  "Not assessed": "لم يُقيَّم",
  "Screening score from retrieved soil and climate data — not a yield forecast.":
    "درجة فحص من بيانات تربة ومناخ مسترجعة، وليست توقع إنتاجية.",
  "Suitability score": "درجة الملاءمة",
  "Planting window": "نافذة الزراعة",
  "Ideal months": "الأشهر المثلى",
  "Acceptable months": "الأشهر المقبولة",
  "Season length": "طول الموسم",
  "Establishment": "طريقة التأسيس",
  "Soil and water context": "سياق التربة والمياه",
  "Texture": "القوام",
  "pH": "الحموضة pH",
  "Organic carbon": "الكربون العضوي",
  "Season ET₀": "ET₀ الموسم",
  "Estimated crop ET": "النتح المقدر للمحصول",
  "Season rain": "مطر الموسم",
  "Effective rain (80%)": "المطر الفعّال (80٪)",
  "Net irrigation estimate": "تقدير صافي الري",
  "Crop water range": "نطاق ماء المحصول",
  "Screening factors": "عوامل الفحص",
  "Each factor uses retrieved data; a low score is shown with its explanation, not hidden.":
    "كل عامل يستند إلى بيانات مسترجعة، والدرجة المنخفضة تُعرض مع تفسيرها ولا تُخفى.",
  "Environmental risks": "المخاطر البيئية",
  "High risk": "خطر مرتفع",
  "Moderate risk": "خطر متوسط",
  "Low risk": "خطر منخفض",
  "Practical recommendations": "توصيات عملية",
  "Screening score from retrieved soil and climate data — not a yield forecast. ":
    "درجة فحص من بيانات تربة ومناخ مسترجعة، وليست توقع إنتاجية. ",
  "{crop} could not be assessed": "تعذّر تقييم {crop}",
  "Required soil or climate inputs are unavailable for this location.":
    "مدخلات التربة أو المناخ المطلوبة غير متاحة لهذا الموقع.",
  "Crop assessment unavailable": "تقييم المحصول غير متاح",
  "The assessment service could not answer.": "لم تستجب خدمة التقييم.",
  "Reducing the number of compared crops can help if a source timed out.":
    "تقليل عدد المحاصيل المقارنة قد يساعد إذا انتهت مهلة أحد المصادر.",
  "Assessing selected crops against soil and climate data… this can take a minute on first use.":
    "جارٍ تقييم المحاصيل المختارة مقابل بيانات التربة والمناخ… قد يستغرق دقيقة في أول استخدام.",
  "Screen crop choices against retrieved soil, climate and water data for this location. The score is a screening aid; it is not a yield guarantee.":
    "افحص خيارات المحاصيل مقابل بيانات التربة والمناخ والمياه لهذا الموقع. الدرجة أداة فحص وليست ضمانًا للإنتاجية.",
  "Crop suitability is a transparent screening score built from soil, temperature, rainfall and calendar data. It cannot promise a harvest, price or profit. Disease identification needs field photographs.":
    "ملاءمة المحصول درجة فحص شفافة مبنية على التربة والحرارة والمطر والتقويم. لا يمكنها ضمان حصاد أو سعر أو ربح. تشخيص الأمراض يحتاج صورًا ميدانية.",
  "Ask Fale7 about this field": "اسأل فالح عن هذا الحقل",
  "Soil properties": "خصائص التربة",
  "Creating the field…": "جارٍ إنشاء الحقل…",
  "Location intelligence": "ذكاء الموقع",
  "Alerts": "التنبيهات",
  "Area: {n} ha": "المساحة: {n} هكتار",
  "Drawn outline for this analysis": "حدود مرسومة لهذا التحليل",
  "Stored field boundary/point": "حدود/نقطة حقل محفوظة",
  "Point selection — no field boundary": "اختيار نقطة — بلا حدود حقل",
  "Period: {value}": "المدة: {value}",
  "Observed: {value}": "وقت الرصد: {value}",
  "Point {lat}, {lon}. Weather and soil values come from the nearest model cell; a drawn field is analysed over its area where the source supports it.":
    "نقطة {lat}، {lon}. قيم الطقس والتربة من أقرب خلية نموذجية؛ ويُحلَّل الحقل المرسوم على كامل مساحته حيث يدعم المصدر ذلك.",
  "Administrative names come from OpenStreetMap. An empty name means the geocoder returned none; none is invented.":
    "الأسماء الإدارية من OpenStreetMap. الاسم الفارغ يعني أن خدمة الترميز الجغرافي لم تُرجع اسمًا، ولا يُختلق أي اسم.",
  "Model and satellite estimates are not on-farm measurements. SoilGrids is modelled, SMAP/Open-Meteo soil moisture is not a depth probe, and crop screening is not a yield forecast.":
    "تقديرات النماذج والأقمار ليست قياسات داخل الحقل. SoilGrids نموذج، ورطوبة تربة SMAP/Open-Meteo ليست مسبار عمق، وفحص المحاصيل ليس توقع إنتاجية.",
  "Confidence: {value}": "درجة الثقة: {value}",
  "high": "عالية",
  "medium": "متوسطة",
  "low": "منخفضة",
  "Elevation": "الارتفاع",
  "Generated {value}. Values older than the stated period are not presented as current.":
    "أُنشئ في {value}. القيم الأقدم من المدة المذكورة لا تُعرض كأنها حالية.",
  "Feels like": "الإحساس الفعلي",
  "Precipitation (current step)": "الهطول (الخطوة الحالية)",
  "Wind direction": "اتجاه الرياح",
  "Surface pressure": "الضغط السطحي",
  "Cloud cover": "الغطاء السحابي",
  "Soil moisture (0-7 cm, model)": "رطوبة التربة (0-7 سم، نموذج)",
  "Soil temperature (6 cm, model)": "حرارة التربة (6 سم، نموذج)",
  "Reference ET₀ today": "ET₀ المرجعي اليوم",
  "Solar radiation today": "الإشعاع الشمسي اليوم",
  "ERA5-Land model value, not a probe.": "قيمة نموذج ERA5-Land وليست قراءة مسبار.",
  "FAO-56 reference evapotranspiration computed by Open-Meteo.":
    "نتح مرجعي وفق FAO-56 محسوب بواسطة Open-Meteo.",
  "Sum of daily precipitation": "مجموع الهطول اليومي",
  "Grass reference evapotranspiration, FAO-56": "نتح مرجعي للمرج، FAO-56",
  "Reference ET₀ total": "إجمالي ET₀ المرجعي",
  "Topsoil pH": "حموضة التربة السطحية",
  "Bulk density": "الكثافة الظاهرية",
  "Cation exchange capacity": "سعة التبادل الكاتيوني",
  "Total nitrogen": "النيتروجين الكلي",
  "approximate USDA class from modelled fractions": "صنف USDA تقريبي من النسب النموذجية",
  "Fetched: {value}": "وقت الجلب: {value}",
  "Modelled, not a laboratory test.": "قيمة نموذجية وليست تحليلًا مخبريًا.",
  "Calendars are regional Egyptian extension defaults. Suitability is a screening score from retrieved soil and climate data, not a yield forecast.":
    "التقاويم افتراضات إرشادية إقليمية مصرية. الملاءمة درجة فحص من بيانات تربة ومناخ مسترجعة وليست توقع إنتاجية.",
  "marginal": "هامشي",
  "poor": "ضعيف",
  "seed": "بذور",
  "Temperature suitability": "ملاءمة الحرارة",
  "Soil pH": "حموضة التربة",
  "Water availability": "توافر المياه",
  "Trees": "أشجار",
  "Grass": "أعشاب",
  "Flooded vegetation": "غطاء نباتي مغمور",
  "Crops": "محاصيل",
  "Shrub and scrub": "شجيرات وأدغال",
  "Built area": "منطقة مبنية",
  "Bare ground": "أرض عارية",
  "Snow and ice": "ثلج وجليد",
  "Dominant Dynamic World class over the area; class probabilities are not averaged here.":
    "صنف Dynamic World السائد على المساحة؛ ولا تُتوسط احتمالات الأصناف هنا.",
  "SMAP L4 surface (~0-5 cm) at ~9-11 km; not a field probe.":
    "سطح SMAP L4 (نحو 0-5 سم) بدقة 9-11 كم تقريبًا؛ وليس مسبارًا ميدانيًا.",
  "NASA GPM IMERG monthly satellite estimate (~0.1°), not a rain gauge.":
    "تقدير GPM IMERG الشهري بالأقمار (نحو 0.1°) وليس مقياس مطر أرضيًا.",
  "Water balance, 30 days": "الموازنة المائية، 30 يومًا",
  "Rain minus reference evapotranspiration. Model output, not a soil probe.":
    "المطر ناقص النتح المرجعي. مخرجات نموذج وليست قياسًا لرطوبة التربة.",
  "Current weather is unavailable.": "الطقس الحالي غير متاح.",
  "Selected period": "الفترة المختارة",
  "Date / time period": "التاريخ / الفترة الزمنية",
  "Quick periods": "فترات سريعة",
  "Today": "اليوم",
  "Yesterday": "أمس",
  "Last 7 days": "آخر 7 أيام",
  "Last 30 days": "آخر 30 يومًا",
  "This month": "هذا الشهر",
  "Previous month": "الشهر الماضي",
  "This season": "هذا الموسم",
  "This year": "هذه السنة",
  "Custom period": "فترة مخصصة",
  "From": "من",
  "To": "إلى",
  "NASA POWER requests are capped at 366 days; the start date was moved forward to fit.":
    "طلبات NASA POWER محدودة بـ 366 يومًا؛ تم تقديم تاريخ البداية لتناسب المدة.",
  "Rolling periods end yesterday because NASA POWER publishes with a delay. The selected dates are sent to the API; the charts show only the data actually returned.":
    "الفترات المتجددة تنتهي أمس لأن NASA POWER ينشر بياناته متأخرًا. التواريخ المختارة تُرسل إلى الخادم، والرسوم تعرض البيانات المُعادة فعليًا فقط.",
  "Actual data window: {start} → {end}": "نطاق البيانات الفعلي: {start} → {end}",
  "Source coverage: NASA POWER daily archive, 1981 → present (published with a delay).":
    "تغطية المصدر: أرشيف NASA POWER اليومي من 1981 حتى الآن (يُنشر بتأخير).",
  "The cached Qena snapshot cannot change dates. Switch to live data in the header to query a different period.":
    "لقطة قنا المحفوظة لا تغيّر تواريخها. فعّل البيانات الحية من الأعلى لطلب فترة مختلفة.",
  "Data unavailable for this period.": "لا توجد بيانات متاحة لهذه الفترة.",
  "NASA POWER returned no usable daily values for the selected window. Choose another period; missing values are never filled with estimates.":
    "لم يُعد NASA POWER أي قيم يومية صالحة خلال الفترة المختارة. اختر فترة أخرى؛ ولا تُملأ القيم الناقصة بتقديرات.",
  "Rain, selected period": "الأمطار خلال الفترة المختارة",
  "Sum of daily corrected precipitation for the selected period.":
    "مجموع الأمطار اليومية المصححة خلال الفترة المختارة.",
  "Daily NASA POWER values for {start} → {end}. Rainfall uses the right-hand axis.":
    "قيم NASA POWER اليومية من {start} → {end}. الأمطار على المحور الأيمن.",
  "The selected period returned no environmental points.":
    "لم تُعد الفترة المختارة أي نقاط بيئية.",
  "Analysis as of {date}": "التحليل حتى {date}",
  "Simple farmer view": "عرض مبسّط للفلاح",
  "For Farmers": "للفلاح",
  "What is happening in the field, and what should I do? No scientific terms by default.":
    "إيه اللي بيحصل في الأرض، وإيه اللي تعمله؟ من غير مصطلحات علمية في البداية.",
  "Step-by-step farmer guide": "دليل الفلاح خطوة بخطوة",
  "My Fields": "أراضي",
  "Loading your fields…": "بنحمّل أراضيك…",
  "Your fields could not be loaded": "مقدرناش نحمّل أراضيك",
  "The server could not be reached.": "مقدرناش نوصل للخادم.",
  "Add a field first, then this page will show simple advice for it.":
    "ضيف أرضك الأول، وبعدها الصفحة دي هتعرض نصائح بسيطة ليها.",
  "Add a field": "أضف أرض",
  "Choose a field": "اختر الأرض",
  "Needs attention": "تحتاج متابعة",
  "Critical": "حرجة",
  "Status unknown": "الحالة غير معروفة",
  "The available indicators do not show a problem in this field.":
    "المؤشرات المتاحة مش بتوضح مشكلة في الأرض دي.",
  "One indicator needs a look. Check the notes below.":
    "فيه مؤشر محتاج نظرة. راجع الملاحظات تحت.",
  "The field needs action soon. Read the important alerts.":
    "الأرض محتاجة إجراء قريب. اقرأ التنبيهات المهمة.",
  "Field status": "حالة الأرض",
  "Planting planned for {date}": "الزراعة مخطط لها في {date}",
  "Open the full dashboard": "افتح لوحة البيانات الكاملة",
  "Checking the water balance…": "بنتأكد من موازنة المياه…",
  "Water data could not be loaded right now.": "بيانات المياه مش متاحة دلوقتي.",
  "The season has ended; irrigation is not assessed for this crop.":
    "الموسم خلص؛ مفيش حساب ري للمحصول ده.",
  "The field needs irrigation": "الأرض محتاجة ري",
  "The field will soon need irrigation": "الأرض قربت تحتاج ري",
  "The soil is moist right now": "الأرض رطبة حاليًا",
  "Not enough data to judge irrigation right now.":
    "مش عندنا بيانات كفاية نحكم على احتياج الري دلوقتي.",
  "Best time to irrigate: early morning or after sunset.":
    "أفضل وقت للري: الصبح بدري أو بعد المغرب.",
  "Approximate irrigation need: {value} mm": "تقريبًا محتاجة {value} مم ري",
  "Rain in the last 7 days is unavailable.": "بيانات مطر آخر 7 أيام غير متاحة.",
  "Rain in the last 7 days: {value} mm": "المطر آخر 7 أيام: {value} مم",
  "No rain recorded in the last 7 days.": "مفيش مطر مسجل آخر 7 أيام.",
  "Soil moisture: dry": "رطوبة التربة: الأرض جافة",
  "Soil moisture: suitable": "رطوبة التربة: مناسبة",
  "Soil moisture: very wet": "رطوبة التربة: رطبة جدًا",
  "Soil moisture reading is unavailable right now.":
    "قراءة رطوبة التربة غير متاحة دلوقتي.",
  "Expected rain may reduce the need for irrigation.":
    "المطر المتوقع ممكن يقلل الاحتياج للري.",
  "Loading today's weather…": "بنحمّل طقس النهارده…",
  "Expected rain": "الأمطار المتوقعة",
  "Latest weather reading: {date}": "آخر قراءة للطقس: {date}",
  "Crop condition": "حالة المحصول",
  "The season has ended; crop condition is not assessed.":
    "الموسم خلص؛ مفيش تقييم لحالة المحصول.",
  "The crop looks good.": "حالة النبات جيدة.",
  "The crop looks moderate; keep watching it.": "حالة النبات متوسطة، خليك متابع.",
  "The crop may be under stress; inspect the field.":
    "النبات ممكن يكون تحت إجهاد؛ افحص الأرض.",
  "Crop condition cannot be assessed right now.":
    "مش قادرين نقيّم حالة المحصول دلوقتي.",
  "Checking the crop…": "بنفحص المحصول…",
  "Latest satellite reading: {date}": "آخر قراءة فضائية: {date}",
  "Keep watching it in the coming days.": "خليك متابع في الأيام الجاية.",
  "Inspect the plants in the marked area.": "افحص النباتات في المنطقة المحددة.",
  "Weather warnings": "تحذيرات الطقس",
  "No warning": "مفيش تحذير",
  "Attention": "انتبه",
  "No weather warnings right now.": "مفيش تحذيرات طقس دلوقتي.",
  "Important alerts": "تنبيهات مهمة",
  "No important alerts right now.": "مفيش تنبيهات مهمة دلوقتي.",
  "Keep checking the field every few days.": "افضل تابع الأرض كل كام يوم.",
  "The field needs irrigation.": "تحتاج الأرض إلى ري.",
  "Possible crop stress.": "يوجد احتمال إجهاد للمحصول.",
  "Unusually high temperature.": "يوجد ارتفاع غير طبيعي في الحرارة.",
  "Frost risk; protect the plants.": "خطر صقيع؛ احمِ النباتات.",
  "Rain is expected.": "الأمطار متوقعة.",
  "The crop has not been planted yet; the planting guide can help.":
    "المحصول لسه ما اتزرعش؛ دليل الزراعة ممكن يساعد.",
  "More details": "تفاصيل أكثر",
  "Hide details": "إخفاء التفاصيل",
  "Need a step-by-step guide? Open the detailed farmer guide":
    "محتاج دليل خطوة بخطوة؟ افتح دليل الفلاح التفصيلي",
  "Advanced data": "بيانات متقدمة",
  "These numbers come from satellites and models, not from on-farm sensors.":
    "الأرقام دي جاية من أقمار صناعية ونماذج، مش من حساسات في الأرض.",
  "NDVI (vegetation index)": "مؤشر الغطاء النباتي (NDVI)",
  "Reference evapotranspiration (ET₀)": "النتح المرجعي (ET₀)",
  "Root-zone soil wetness (model)": "رطوبة التربة الجذرية (نموذج)",
  "Rain in the last 7 days": "أمطار آخر 7 أيام",
  "Irrigation demand class": "تصنيف احتياج الري",
  "Some data is unavailable right now": "بعض البيانات غير متاحة دلوقتي",
  "What is shown is real. Missing values are not estimated or replaced.":
    "اللي ظاهر حقيقي. والقيم الناقصة مش مقدّرة ولا متعوّضة.",
  "Values come from the cached Qena snapshot. Calculations are real; the location and dates are not this field's.":
    "القيم من لقطة قنا المحفوظة. الحسابات حقيقية، لكن الموقع والتواريخ مش بتاعة الأرض دي.",
  "Map": "الخريطة",
  "Historical Data": "البيانات التاريخية",
  "Crop Intelligence": "ذكاء المحاصيل",
  "Data Sources": "مصادر البيانات",
  "Fale7": "Fale7",

  // Data Sources page
  "Data provenance": "مصدر البيانات",
  "Every dataset AgriNASA actually reads, what it means in plain words, and who it helps. A dataset appears here only when the backend can fetch it.":
    "كل مجموعة بيانات AgriNASA بيقرأها فعلًا، معناها بكلام بسيط، وبتفيد مين. المجموعة بتظهر هنا بس لما السيرفر يقدر يجيبها.",
  "Read the setup notes": "اقرأ ملاحظات التشغيل",
  "Loading the dataset catalogue…": "بنحمّل قائمة مصادر البيانات…",
  "The dataset catalogue could not be loaded": "تعذّر تحميل قائمة مصادر البيانات",
  "The server did not return its source catalogue.": "السيرفر مرجّعش قائمة المصادر.",
  "No datasets are connected": "مفيش مصادر بيانات متصلة",
  "The server reported an empty source catalogue, so no dataset claims are shown.":
    "السيرفر رجّع قائمة مصادر فاضية، فمفيش ادعاءات عن بيانات بتتعرض.",
  "Only connected datasets are listed": "المصادر المتصلة بس هي اللي بتظهر",
  "This page is generated from the server's source catalogue. If a provider is not configured or is not used by the code, it is not presented as a working data source.":
    "الصفحة دي متولّدة من قائمة المصادر بتاعة السيرفر. أي مزوّد مش متظبط أو مش مستخدم في الكود مش بيتعرض كمصدر بيانات شغّال.",
  "Data mode": "وضع البيانات",
  "How to read a reliability badge": "إزاي تقرأ شارة الموثوقية",
  "Measured": "مقاسة",
  "Satellite-derived": "مشتقة من الأقمار الصناعية",
  "Modeled / estimated": "نمذجة / تقديرية",
  "Forecast": "تنبؤات",
  "Directly measured by an instrument or a weather station.":
    "مقاسة مباشرة بجهاز أو محطة أرصاد.",
  "Calculated or observed from satellite data.": "محسوبة أو مرصودة من بيانات الأقمار الصناعية.",
  "Produced by scientific models, reanalysis or interpolation — not a measurement at the field.":
    "ناتجة من نماذج علمية أو إعادة تحليل أو استيفاء — مش قياس في الأرض.",
  "A prediction of conditions that have not happened yet.": "توقّع لحالة لسه ما حصلتش.",
  "No measured source is connected yet": "مفيش مصدر مقاس متصل لحد الآن",
  "AgriNASA does not currently connect to on-farm sensors or a weather-station feed, so no dataset on this page is classified as measured. Field-level values come from reanalysis, satellites, models or forecasts, and each one says so.":
    "AgriNASA مش متصلة حاليًا بحساسات في الأرض ولا ببثّ محطة أرصاد، فمفيش مجموعة هنا مصنّفة إنها مقاسة. قيم الأرض جاية من إعادة تحليل أو أقمار صناعية أو نماذج أو تنبؤات، وكل واحدة بتقول ده.",
  "Dataset catalogue": "قائمة مصادر البيانات",
  "datasets served by the backend": "مجموعة بيانات بيوفّرها السيرفر",
  "When data is missing": "لما البيانات تكون ناقصة",
  "If a provider fails, a range predates its coverage, or an API key is not configured, the app shows the gap and states that data is unavailable. It never fills the gap with simulated values.":
    "لو مزوّد فشل، أو الفترة أقدم من تغطيته، أو مفتاح API مش متظبط، التطبيق بيوضّح النقص ويقول إن البيانات غير متاحة. وعمره ما يملأ النقص بقيم محاكاة.",
  "Credentials stay on the server": "بيانات الدخول بتفضل على السيرفر",
  "Datasets that need credentials (Google Earth Engine and the optional WaPOR token) are configured through backend environment variables. Keys are never shipped to the browser.":
    "المصادر اللي محتاجة بيانات دخول (Google Earth Engine و WaPOR الاختياري) بتتظبط من متغيرات بيئة على السيرفر. المفاتيح عمرها ما بتتبعت للمتصفح.",
  "Not enabled": "غير مفعّلة",
  "Coverage": "التغطية",
  "Not applicable": "لا ينطبق",
  "Attribution": "الإسناد",
  "What you see in the app": "اللي بتشوفه في التطبيق",
  "Who benefits": "مين اللي بيستفيد",
  "Small farmer": "الفلاح البسيط",
  "Farm owner / large farmer": "صاحب المزرعة / الفلاح الكبير",
  "Agricultural engineer": "المهندس الزراعي",
  "Open the dataset page": "افتح صفحة مجموعة البيانات",
  "Reference tables run by the AgriNASA backend": "جداول مرجعية بيشغّلها سيرفر AgriNASA",

  // Dataset variables
  "Temperature (mean, max, min)": "الحرارة (المتوسط، العظمى، الصغرى)",
  "Wind speed at 2 m": "سرعة الرياح على ارتفاع 2 متر",
  "Long-term monthly rainfall normals (1991-2020)": "معدلات الأمطار الشهرية طويلة الأمد (1991-2020)",
  "Crop evapotranspiration (ETc)": "نتح المحصول (ETc)",
  "Satellite imagery tiles (visual context)": "صور الأقمار الصناعية (سياق بصري)",
  "Daily maximum and minimum temperature": "الحرارة العظمى والصغرى اليومية",
  "Maximum wind": "أقصى سرعة للرياح",
  "Short weather outlook": "نظرة قصيرة على الطقس",
  "Current temperature and feels-like": "الحرارة الحالية والإحساس بها",
  "Wind speed and direction": "سرعة الرياح واتجاهها",
  "Daily temperature, rain, wind and solar radiation": "الحرارة والأمطار والرياح والإشعاع الشمسي يوميًا",
  "Monthly and yearly summaries": "ملخصات شهرية وسنوية",
  "Historical comparisons": "مقارنات تاريخية",
  "Clay, sand and silt fractions": "نسب الطين والرمل والسلت",
  "Approximate texture class": "تصنيف تقريبي لقوام التربة",
  "EVI": "EVI",
  "Dominant land-cover class": "فئة الغطاء الأرضي السائدة",
  "Surface soil moisture (about 0-5 cm)": "رطوبة سطح التربة (حوالي 0-5 سم)",
  "Monthly rainfall": "الأمطار الشهرية",
  "Temperature range": "نطاق الحرارة",
  "Soil pH range": "نطاق حموضة التربة",
  "Texture preference": "القوام المفضل",
  "Water reference range": "نطاق الاحتياج المائي المرجعي",
  "Per-factor scores": "درجات كل عامل",
  "Risks": "المخاطر",
  "Recommendations": "التوصيات",
  "Actual evapotranspiration": "النتح الفعلي",
  "Water productivity (not enabled)": "إنتاجية المياه (غير مفعّلة)",

  // Dataset coverage
  "1981 → present · daily · published with a short delay": "1981 → الآن · يوميًا · بينشر بتأخير بسيط",
  "1991-2020 monthly normals": "معدلات شهرية 1991-2020",
  "Same dates as the input NASA POWER series": "نفس تواريخ سلسلة NASA POWER المدخلة",
  "MODIS/VIIRS imagery · 2000 → present (layer dependent)": "صور MODIS/VIIRS · 2000 → الآن (حسب الطبقة)",
  "Sentinel-2 · June 2015 → present · cloud-free passes": "Sentinel-2 · يونيو 2015 → الآن · مرور بدون سحب",
  "Forecast · up to about 7 days ahead": "تنبؤات · لحد حوالي 7 أيام قدام",
  "Current model analysis · updated hourly": "تحليل نموذج حالي · بيتحدّث كل ساعة",
  "ERA5 / ERA5-Land archive · 1940 → about 5 days behind real time":
    "أرشيف ERA5 / ERA5-Land · 1940 → متأخر حوالي 5 أيام عن الوقت الحقيقي",
  "Static 250 m global prediction · no time dimension": "توقع عالمي ثابت بدقة 250 متر · بدون بُعد زمني",
  "Sentinel-2 · June 2015 → present": "Sentinel-2 · يونيو 2015 → الآن",
  "Dynamic World near-real-time · June 2015 → present": "Dynamic World شبه فوري · يونيو 2015 → الآن",
  "SMAP L4 · 2015 → present": "SMAP L4 · 2015 → الآن",
  "GPM IMERG monthly · June 2000 → present": "GPM IMERG شهري · يونيو 2000 → الآن",
  "Static reference tables · FAO-56 and Egyptian extension calendars":
    "جداول مرجعية ثابتة · FAO-56 والتقويم الإرشادي المصري",
  "Calculated for the selected crop and location": "محسوبة للمحصول والموقع المختار",
  "FAO WaPOR 3.0 · requires a free FAO API token": "FAO WaPOR 3.0 · يحتاج توكن مجاني من FAO",

  // Dataset descriptions
  "Daily weather for the grid cell around the field, built from NASA's MERRA-2 reanalysis and interpolated to the point.":
    "طقس يومي لخلية الشبكة حول الأرض، مبني على إعادة تحليل MERRA-2 من NASA ومستوفى لنقطة الموقع.",
  "Thirty-year monthly averages used as the normal when recent rainfall is compared with the past.":
    "متوسطات شهرية على مدى 30 سنة بتُستخدم كخط أساس عند مقارنة الأمطار الحديثة بالماضي.",
  "FAO-56 calculations run by AgriNASA on top of the NASA POWER weather; the numbers are deterministic, not measured.":
    "حسابات FAO-56 بيشغّلها AgriNASA على بيانات طقس NASA POWER؛ الأرقام محسوبة بشكل ثابت، مش مقاسة.",
  "NASA satellite imagery shown behind the map as visual context.":
    "صور أقمار صناعية من NASA بتظهر خلف الخريطة كسياق بصري.",
  "Satellite vegetation and canopy-moisture indices reduced over the field outline.":
    "مؤشرات نباتية ورطوبة غطاء نباتي من الأقمار الصناعية، محسوبة على حدود الأرض.",
  "A short-term weather forecast for the field point.": "تنبؤ قصير المدى بالطقس لنقطة الأرض.",
  "The latest model conditions for the selected point.": "أحدث ظروف نموذجية للنقطة المختارة.",
  "Long historical weather for the point, used for historical comparisons and crop-suitability screening.":
    "طقس تاريخي طويل للنقطة، بيُستخدم في المقارنات التاريخية وفحص ملاءمة المحاصيل.",
  "Modelled soil properties for the location, produced by ISRIC SoilGrids 2.0.":
    "خصائص تربة نموذجية للموقع، من ISRIC SoilGrids 2.0.",
  "Enhanced Vegetation Index, a second canopy indicator that is less saturated than NDVI in dense crops.":
    "مؤشر الغطاء النباتي المحسّن (EVI)، مؤشر تاني للغطاء وأقل تشبعًا من NDVI في الزراعات الكثيفة.",
  "Land-cover class around the field: crops, trees, grass, built area, bare ground and similar classes.":
    "فئة الغطاء الأرضي حول الأرض: محاصيل، أشجار، حشيش، مبانٍ، أرض جرداء وما شابه.",
  "Satellite estimate of water in the top few centimetres of soil.":
    "تقدير من الأقمار الصناعية لكمية المياه في السنتيمترات العليا من التربة.",
  "Satellite rainfall totals for the area.": "إجماليات الأمطار من الأقمار الصناعية للمنطقة.",
  "Agronomic reference ranges used to screen whether a crop fits the location.":
    "نطاقات زراعية مرجعية بتُستخدم لفحص هل المحصول يناسب الموقع.",
  "A transparent screening score built from soil, climate and crop references, with per-factor reasons.":
    "درجة فحص واضحة مبنية على التربة والمناخ ومراجع المحصول، مع أسباب لكل عامل.",
  "An optional FAO interface for evapotranspiration and water-productivity layers.":
    "واجهة اختيارية من FAO لطبقات النتح وإنتاجية المياه.",

  // Dataset benefits
  "Tells you whether it is hot or cold and whether rain fell, so you can plan work in the field.":
    "بيقولك الجو حر ولا برد، ونزل مطر ولا لأ، عشان تعرف ترتب شغل الأرض.",
  "Tells you whether this year's rain is more or less than usual.":
    "بيقولك المطر السنة دي أكتر ولا أقل من المعتاد.",
  "Tells you whether the field needs irrigation, and roughly how much.":
    "بيقولك الأرض محتاجة ري ولا لأ، وتقريبًا محتاجة قد إيه.",
  "Photos from space help you see the field, but no numbers are read from them.":
    "صور من الفضاء تساعدك تشوف الأرض، بس مش بنقرأ منها أرقام.",
  "Tells you whether the plants are green and healthy or under stress.":
    "بيقولك النبات أخضر وصحته كويسة ولا فيه إجهاد.",
  "Tells you what the weather will be like in the coming days and whether rain is expected.":
    "بيقولك الجو هيبقى عامل إيه كام يوم قدام، وهينزل مطر ولا لأ.",
  "Tells you the weather at the place you chose right now.":
    "بيقولك الجو دلوقتي في المكان اللي اخترته.",
  "Tells you what the weather was like in past years.":
    "بيقولك الجو كان عامل إيه في السنين اللي فاتت.",
  "Tells you whether the soil is clay or sandy and how acidic it is.":
    "بيقولك الأرض طين ولا رمل، وحامضيتها عاملة إيه.",
  "A second plant-health indicator that supports the NDVI picture.":
    "مؤشر تاني لصحة النبات، بيكمل صورة NDVI.",
  "Tells you what is around the field: crops, buildings or bare land.":
    "بيقولك الأرض حواليها إيه: زرع، مباني، ولا أرض فاضية.",
  "Tells you whether the topsoil is wet or dry.": "بيقولك التربة فوق رطبة ولا ناشفة.",
  "Tells you how much rain the area received, seen from satellites.":
    "بيقولك نزل مطر قد إيه في المنطقة من الأقمار.",
  "Tells you whether this crop suits your land and climate.":
    "بيقولك المحصول ده يناسب أرضك وجوّك ولا لأ.",
  "Adds the information together and tells you whether the crop is suitable or needs something.":
    "بيجمع المعلومات ويقولك المحصول مناسب ولا محتاج حاجة.",
  "An extra water service, not switched on yet.": "خدمة إضافية للمياه، لسه مش مفعّلة.",
  "Helps plan irrigation and spraying, follow rainfall and heat spells, and compare one period with another.":
    "بيساعدك تخطط الري والرش، وتتابع موجات الأمطار والحرارة، وتقارن فترة بفترة.",
  "Adds seasonal context: whether recent rain is normal, dry or wet for this month.":
    "بيضيف سياق موسمي: هل أمطار الشهر ده طبيعية ولا جافة ولا غزيرة.",
  "Gives a demand class and a refill estimate to organise irrigation while reducing unnecessary water use.":
    "بيدي تصنيف للاحتياج وتقدير كمية الري لتنظيم الجدول وتقليل المياه الزايدة.",
  "Visual context for locating the field and comparing nearby areas.":
    "سياق بصري لتحديد الأرض ومقارنة المناطق القريبة.",
  "Shows whether the canopy is healthy and whether stress is developing across the field.":
    "بيبين هل الغطاء النباتي سليم وهل الإجهاد بيزيد في أجزاء الأرض.",
  "Helps time irrigation, spraying and field work around expected rain, heat, wind or frost.":
    "بيساعدك تحدد مواعيد الري والرش وشغل الأرض حسب الأمطار والحرارة والرياح والصقيع المتوقع.",
  "Immediate conditions for field visits, spraying and irrigation decisions.":
    "ظروف فورية لزيارة الأرض وقرارات الرش والري.",
  "Compares this season with previous years to plan water and crop timing.":
    "بيقارن الموسم الحالي بالسنين اللي فاتت لتخطيط المياه ومواعيد الزراعة.",
  "Supports soil and irrigation planning and choosing suitable crops.":
    "بيدعم تخطيط التربة والري واختيار المحاصيل المناسبة.",
  "Adds a second view of canopy vigour for dense crops.":
    "بيضيف رؤية تانية لقوة النبات في الزراعات الكثيفة.",
  "Context for interpreting satellite values and neighbouring land use.":
    "سياق لتفسير قيم الأقمار الصناعية واستخدام الأراضي المجاورة.",
  "An early signal of surface dryness or wetness; deeper root-zone water comes from the water balance.":
    "إشارة مبكرة لجفاف أو رطوبة السطح؛ مياه منطقة الجذور بتيجي من اتزان المياه.",
  "Cross-checks rainfall between seasons and areas where gauges are sparse.":
    "بيتحقق من الأمطار بين المواسم والمناطق اللي مفيهاش محطات كتير.",
  "Guides crop choice and the planting window before land and water are committed.":
    "بيساعد في اختيار المحصول وميعاد الزراعة قبل حجز الأرض والمياه.",
  "Compares crops before committing land and water.":
    "بيقارن المحاصيل قبل ما تحجز الأرض والمياه.",
  "Would add field-scale ET products when a token is configured.":
    "هيضيف منتجات نتح على مستوى الحقل لما يتم ظبط التوكن.",
  "Supplies the weather inputs for FAO-56 ET₀, the root-zone water balance and crop-stress indicators, with a disclosed coarse-grid resolution.":
    "بيوفّر مدخلات الطقس لحساب ET₀ بطريقة FAO-56 واتزان مياه منطقة الجذور ومؤشرات إجهاد المحصول، مع توضيح دقة الشبكة الخشنة.",
  "Used for the 30-day rainfall anomaly. It is a climatological baseline, not a forecast for this season.":
    "بيُستخدم لحساب شذوذ الأمطار خلال 30 يوم. ده خط أساس مناخي، مش تنبؤ للموسم.",
  "Penman-Monteith ET₀, stage-based Kc, ETc and a daily bucket model with documented thresholds, assumptions and missing-input rules.":
    "معادلة Penman-Monteith لـ ET₀، ومعاملات Kc حسب المرحلة، وETc، ونموذج خزان يومي بحدود وافتراضات وقواعد واضحة للنواقص.",
  "Imagery tiles only; no values are sampled from the pixels.":
    "طبقات صور بس؛ مفيش قيم بتُقرأ من البكسلات.",
  "10 m Sentinel-2 surface-reflectance indices reduced over the field geometry, cloud-screened, with acquisition date and scene count.":
    "مؤشرات انعكاس سطحي من Sentinel-2 بدقة 10 متر محسوبة على شكل الأرض، بعد فلترة السحب، مع تاريخ الالتقاط وعدد المشاهد.",
  "Open-Meteo numerical forecast on a model grid. When it is unreachable the page says so; no values are substituted.":
    "تنبؤ رقمي من Open-Meteo على شبكة نموذج. لو مش متاح الصفحة بتقول كده؛ مفيش قيم بديلة.",
  "ERA5-Land and model-analysis values. Every reading states its observation/model time and is explicitly not a station reading.":
    "قيم ERA5-Land وتحليل النموذج. كل قراءة بتوضّح وقتها وبتكون صريحة إنها مش قراءة محطة.",
  "ERA5 reanalysis with a documented lag; monthly and yearly aggregates report how many days are present.":
    "إعادة تحليل ERA5 بتأخير موثّق؛ الملخصات الشهرية والسنوية بتوضّح عدد الأيام المتاحة.",
  "Machine-learning prediction at 250 m, not a laboratory test. Depth layers, aggregation and fetch date are disclosed.":
    "توقع تعلّم آلي بدقة 250 متر، مش تحليل معمل. طبقات العمق وطريقة التجميع وتاريخ السحب موضّحة.",
  "10 m Sentinel-2 EVI composite; an area mean, not a ground measurement.":
    "مركّب EVI من Sentinel-2 بدقة 10 متر؛ متوسط مساحة، مش قياس أرضي.",
  "Dynamic World per-pixel classification; the dominant class is reported without averaging probabilities.":
    "تصنيف Dynamic World لكل بكسل؛ الفئة السائدة بتُعرض من غير حساب متوسط احتمالات.",
  "SMAP L4 at about 9-11 km. Surface layer only, not a probe at root depth.":
    "SMAP L4 بدقة حوالي 9-11 كم. طبقة سطحية بس، مش مسبار على عمق الجذور.",
  "IMERG monthly estimate at about 0.1°. A rain gauge remains the local reference.":
    "تقدير IMERG شهري بدقة حوالي 0.1°. مقياس المطر يفضل المرجع المحلي.",
  "Deterministic screening ranges. They are not variety-specific and are not a yield prediction.":
    "نطاقات فحص ثابتة. مش خاصة بصنف معين ومش تنبؤ بالإنتاجية.",
  "Every factor reports its source and score. It is a screening indicator, not a yield forecast.":
    "كل عامل بيوضّح مصدره ودرجته. ده مؤشر فحص، مش تنبؤ بالإنتاجية.",
  "Not connected by default. The app uses the Open-Meteo / NASA POWER water balance instead.":
    "مش متصلة افتراضيًا. التطبيق بيستخدم اتزان المياه من Open-Meteo / NASA POWER بدالها.",
  "Soil moisture: getting dry": "رطوبة التربة: بتبدأ تنشف",
  "Surface soil moisture (satellite): dry": "رطوبة سطح التربة (قمر صناعي): ناشفة",
  "Surface soil moisture (satellite): suitable": "رطوبة سطح التربة (قمر صناعي): مناسبة",
  "Surface soil moisture (satellite): very wet": "رطوبة سطح التربة (قمر صناعي): رطبة جدًا",
  "Water needed to refill the root zone: {value} mm": "كمية الري التقريبية اللي ترجّع رطوبة منطقة الجذور: {value} مم",
  "Rain since {date}": "الأمطار من {date}",
  "Rain since {date}: {value} mm": "الأمطار من {date}: {value} مم",
  "No rain recorded since {date}.": "مفيش أمطار مسجلة من {date}.",
  "Analysis date": "تاريخ التحليل",
  "Season-to-date analysis": "تحليل من بداية الموسم لحد التاريخ المحدد",
  "Most recent available day": "أحدث يوم متاح",
  "Season-to-date analysis from planting through {date}. The backend defaults to the most recent available day.":
    "التحليل من تاريخ الزراعة لحد {date}. لو مفيش تاريخ محدد، الخادم بيستخدم أحدث يوم متاح.",
  "The satellite index always shows the latest usable pass, not the selected date.":
    "مؤشر الأقمار الصناعية بيعرض دائمًا أحدث صورة صالحة، مش التاريخ المحدد.",
};


