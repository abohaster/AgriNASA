import { AR_MESSAGES } from "./messages.ar";

/**
 * The backend composes some analysis sentences at runtime with numbers,
 * dates or indicator ids baked in. Exact-key lookup cannot match those, so
 * they are translated here by pattern. Numbers, units and acronyms are kept
 * verbatim; only the surrounding prose is localised.
 */
interface ArabicPattern {
  match: RegExp;
  render: (groups: string[], match: string) => string;
}

const INDICATORS: Record<string, string> = {
  heat: "حرارة",
  frost: "صقيع",
  water: "ماء",
  rain_anomaly: "شذوذ الأمطار",
  vegetation: "غطاء نباتي",
};

const CROP_NAMES: Record<string, string> = {
  wheat: "القمح",
  potato: "البطاطس",
  tomato: "الطماطم",
};

const STATUSES: Record<string, string> = {
  GOOD: "جيد",
  MODERATE: "معتدل",
  STRESSED: "مُجهَد",
  "INSUFFICIENT DATA": "بيانات غير كافية",
};

function indicatorList(text: string): string {
  return text
    .split(",")
    .map((id) => INDICATORS[id.trim()] ?? id.trim())
    .join("، ");
}

const PATTERNS: ArabicPattern[] = [
  // ── Irrigation demand reasons ───────────────────────────────────────────
  {
    match:
      /Root-zone depletion is (\d+)% of total available water \(moderate threshold (\d+)%, high (\d+)%\)\./g,
    render: ([depletion, moderate, high]) =>
      `نضوب منطقة الجذور يبلغ ${depletion}% من إجمالي الماء المتاح (عتبة الاعتدال ${moderate}%، وعتبة الارتفاع ${high}%).`,
  },
  {
    match: /Rainfall in the last 7 days: ([\d.]+) mm \((dry|some recharge)\)\./g,
    render: ([rain, state]) =>
      `الأمطار خلال آخر 7 أيام: ${rain} مم (${state === "dry" ? "جاف" : "بعض التغذية"}).`,
  },
  {
    match: /Current crop water use \(ETc\) is ([\d.]+) mm\/day\./g,
    render: ([etc]) => `استهلاك المحصول الحالي للماء (ETc) هو ${etc} مم/يوم.`,
  },
  {
    match: /(\d+) day\(s\) at or below the readily available water limit\./g,
    render: ([days]) => `${days} يوم عند حد الماء المتاح بسهولة أو أقل منه.`,
  },
  {
    match: /(\d+) day\(s\) exceeded ([\d.]+) °C \(hottest ([\d.]+) °C\)\. Watch the forecast around flowering\./g,
    render: ([days, threshold, hottest]) =>
      `${days} يوم تجاوز ${threshold} °C (الأشد حرارة ${hottest} °C). راقب التوقعات حول مرحلة الإزهار.`,
  },
  {
    match: /(\d+) of the last (\d+) days exceeded ([\d.]+) °C \(hottest ([\d.]+) °C\)\. Sustained heat can reduce yield\./g,
    render: ([count, window, threshold, hottest]) =>
      `${count} من آخر ${window} أيام تجاوزت ${threshold} °C (الأشد حرارة ${hottest} °C). قد يقلل الإجهاد الحراري المستمر من المحصول.`,
  },
  {
    match: /No day exceeded ([\d.]+) °C in the last (\d+) days \(hottest ([\d.]+) °C\)\./g,
    render: ([threshold, window, hottest]) =>
      `لم يتجاوز أي يوم ${threshold} °C خلال آخر ${window} أيام (الأشد حرارة ${hottest} °C).`,
  },
  {
    match: /(\d+) frost days in the last (\d+); coldest ([\d.-]+) °C\./g,
    render: ([count, window, coldest]) =>
      `${count} أيام صقيع خلال آخر ${window}؛ الأشد برودة ${coldest} °C.`,
  },
  {
    match: /(\d+) frost day\(s\) in the last (\d+); coldest ([\d.-]+) °C\./g,
    render: ([count, window, coldest]) =>
      `${count} يوم صقيع خلال آخر ${window}؛ الأشد برودة ${coldest} °C.`,
  },
  {
    match: /No frost in the last (\d+) days \(coldest ([\d.-]+) °C\)\./g,
    render: ([window, coldest]) =>
      `لا صقيع خلال آخر ${window} أيام (الأشد برودة ${coldest} °C).`,
  },
  {
    match: /Depletion is (\d+)% of total available water \((\d+) stressed day\(s\)\)\./g,
    render: ([percent, days]) =>
      `النضوب ${percent}% من إجمالي الماء المتاح (${days} يوم إجهاد).`,
  },
  {
    match: /Depletion is (\d+)% of total available water; approaching the stress threshold\./g,
    render: ([percent]) => `النضوب ${percent}% من إجمالي الماء المتاح؛ ويقترب من عتبة الإجهاد.`,
  },
  {
    match: /Depletion is (\d+)% of total available water; adequate for the crop stage\./g,
    render: ([percent]) => `النضوب ${percent}% من إجمالي الماء المتاح؛ وكافٍ لمرحلة المحصول.`,
  },
  {
    match:
      /Rainfall is (\d+)% below the climatological normal \(([\d.]+) mm vs ([\d.]+) mm\)\./g,
    render: ([percent, recent, normal]) =>
      `الأمطار أقل بنسبة ${percent}% من المعتاد المناخي (${recent} مم مقابل ${normal} مم).`,
  },
  {
    match: /Rainfall is (\d+)% below normal \(([\d.]+) mm vs ([\d.]+) mm\)\./g,
    render: ([percent, recent, normal]) =>
      `الأمطار أقل بنسبة ${percent}% من المعتاد (${recent} مم مقابل ${normal} مم).`,
  },
  {
    match: /Rainfall is (\d+)% above normal; waterlogging and runoff risk may increase\./g,
    render: ([percent]) =>
      `الأمطار أعلى بنسبة ${percent}% من المعتاد؛ وقد يزداد خطر التشبع بالماء والجريان السطحي.`,
  },
  {
    match: /Rainfall is near normal \(([+-]?\d+)%; ([\d.]+) mm vs ([\d.]+) mm\)\./g,
    render: ([percent, recent, normal]) =>
      `الأمطار قريبة من المعتاد (${percent}%؛ ${recent} مم مقابل ${normal} مم).`,
  },
  {
    match: /NDVI is ([\d.]+) and declining; inspect the field for stress or damage\./g,
    render: ([ndvi]) =>
      `قيمة NDVI هي ${ndvi} وهي متراجعة؛ افحص الحقل بحثًا عن إجهاد أو تلف.`,
  },
  {
    match: /NDVI is ([\d.]+) and improving\./g,
    render: ([ndvi]) => `قيمة NDVI هي ${ndvi} وهي في تحسّن.`,
  },
  {
    match: /NDVI is ([\d.]+) with a stable trend\. NDVI indicates condition, not disease\./g,
    render: ([ndvi]) =>
      `قيمة NDVI هي ${ndvi} باتجاه مستقر. يعبّر NDVI عن الحالة وليس عن المرض.`,
  },
  {
    match:
      /Only (\d+) environmental indicator\(s\) could be computed; at least two are required for a defensible assessment\./g,
    render: ([known]) =>
      `أمكن حساب ${known} مؤشر بيئي فقط؛ ويلزم مؤشران على الأقل لتقييم يمكن الدفاع عنه.`,
  },
  {
    match: /Stress-level indicator\(s\): (.+?)\./g,
    render: ([ids]) => `مؤشر(ات) بمستوى إجهاد: ${indicatorList(ids)}.`,
  },
  {
    match: /Watch-level indicator\(s\): (.+?)\./g,
    render: ([ids]) => `مؤشر(ات) بمستوى مراقبة: ${indicatorList(ids)}.`,
  },
  {
    match: /Crop health status: (GOOD|MODERATE|STRESSED|INSUFFICIENT DATA)\./g,
    render: ([status]) => `حالة صحة المحصول: ${STATUSES[status] ?? status}.`,
  },
  {
    match: /Heat-stress days \(Tmax ≥ ([\d.]+) °C\)/g,
    render: ([threshold]) => `أيام إجهاد حراري (Tmax ≥ ${threshold} °C)`,
  },
  {
    match: /Frost days \(Tmin ≤ ([\d.-]+) °C\)/g,
    render: ([threshold]) => `أيام صقيع (Tmin ≤ ${threshold} °C)`,
  },

  // ── Robot moisture availability ─────────────────────────────────────────
  {
    match:
      /The robot has not reported soil moisture within the last (\d+) hours\. Last reading shown; it is not used for a current irrigation decision\./g,
    render: ([hours]) =>
      `لم يرسل الروبوت رطوبة التربة خلال آخر ${hours} ساعات. تُعرض آخر قراءة، ولا تُستخدم لقرار ري حالي.`,
  },

  // ── Confidence reasons ──────────────────────────────────────────────────
  {
    match: /Only (\d+)% of days had complete ET₀ inputs; those gaps reduce certainty\./g,
    render: ([percent]) =>
      `${percent}% فقط من الأيام كانت مدخلات ET₀ فيها كاملة؛ هذه الفجوات تقلل اليقين.`,
  },
  {
    match: /Precipitation was missing on some days \((\d+)% coverage\)\./g,
    render: ([percent]) => `كانت الأمطار ناقصة في بعض الأيام (تغطية ${percent}%).`,
  },
  {
    match:
      /Only (\d+)% of days had complete ET₀ inputs; at least (\d+)% is required for a demand class\./g,
    render: ([actual, required]) =>
      `${actual}% فقط من الأيام كانت مدخلات ET₀ فيها كاملة؛ ويلزم ${required}% على الأقل لتحديد فئة الطلب.`,
  },

  // ── Irrigation model limitations, drivers and missing inputs ────────────
  {
    match:
      /Runoff is approximated as (\d+)% of daily rainfall because slope and cover data are unavailable\./g,
    render: ([percent]) =>
      `يُقدَّر الجريان السطحي بنسبة ${percent}% من الأمطار اليومية لعدم توفر بيانات الميل والغطاء.`,
  },
  {
    match:
      /ET₀ was unavailable on (\d+) day\(s\); those days were simulated without crop water use rather than filled with estimated weather\./g,
    render: ([days]) =>
      `لم يكن ET₀ متاحًا في ${days} يوم؛ حُوكت تلك الأيام دون استهلاك ماء للمحصول بدلًا من ملئها بطقس مُقدَّر.`,
  },
  {
    match:
      /ET₀ could be computed for (\d+)% of days; incomplete days are excluded rather than filled with estimated weather\./g,
    render: ([percent]) =>
      `أمكن حساب ET₀ في ${percent}% من الأيام؛ وتُستبعد الأيام الناقصة بدل ملئها بطقس مُقدَّر.`,
  },
  {
    match: /Latest day: (.+)$/gm,
    render: ([label]) => `أحدث يوم: ${AR_MESSAGES[label.trim()] ?? label.trim()}`,
  },
  {
    match: /Kc (.+?) × ET₀ for the current stage\./g,
    render: ([kc]) => `Kc ${kc} × ET₀ للمرحلة الحالية.`,
  },
  {
    match:
      /([\d.]+) mm depleted of ([\d.]+) mm total available water\./g,
    render: ([depleted, total]) => `نضوب ${depleted} مم من أصل ${total} مم ماء متاح.`,
  },
  {
    match: /Day (\d+) after planting; Kc interpolated by stage\./g,
    render: ([day]) => `اليوم ${day} بعد الزراعة؛ ويُستخرج Kc بالاستيفاء حسب المرحلة.`,
  },
  {
    match:
      /Model-derived wetness for the grid cell on ([\d-]+); context only, not used in the bucket\./g,
    render: ([day]) =>
      `رطوبة مشتقة من النموذج لخلية الشبكة في ${day}؛ للسياق فقط ولا تُستخدم في الموازنة.`,
  },
  {
    match: /(.+?) could not be computed\./g,
    render: ([label]) => `${autoTranslate(label.trim())} تعذّر حسابه.`,
  },

  // ── Satellite interpretation sentences ──────────────────────────────────
  {
    match: /NDVI ([\d.]+) indicates (sparse|moderate) canopy cover\./g,
    render: ([ndvi, condition]) =>
      `قيمة NDVI هي ${ndvi} وتشير إلى غطاء نباتي ${
        condition === "sparse" ? "متفرق" : "معتدل"
      }.`,
  },
  {
    match: /NDVI ([\d.]+) indicates a dense, active canopy\./g,
    render: ([ndvi]) =>
      `قيمة NDVI هي ${ndvi} وتشير إلى غطاء نباتي كثيف ونشط.`,
  },
  {
    match: /NDMI ([\d.-]+) indicates (low|moderate|high) canopy water content\./g,
    render: ([ndmi, condition]) => {
      const level =
        condition === "low" ? "منخفض" : condition === "high" ? "مرتفع" : "معتدل";
      return `قيمة NDMI هي ${ndmi} وتشير إلى محتوى مائي ${level} في الغطاء النباتي.`;
    },
  },
  {
    match: /These indices describe canopy condition only and do not diagnose disease\./g,
    render: () => "تصف هذه المؤشرات حالة الغطاء النباتي فقط ولا تشخّص المرض.",
  },
  {
    match:
      /Sentinel-2 NDVI ([\d.]+) on (\d{4}-\d{2}-\d{2}) from Google Earth Engine; trend (improving|declining|stable|unknown)\./g,
    render: ([ndvi, day, trend]) => {
      const direction =
        trend === "improving" ? "تحسّن" : trend === "declining" ? "تراجع" : trend === "stable" ? "استقرار" : "غير محدد";
      return `NDVI من سينتينل-2 ${ndvi} بتاريخ ${day} عبر Google Earth Engine؛ الاتجاه ${direction}.`;
    },
  },
  {
    match:
      /NDVI is ([\d.]+) in the latest usable scene\. A single acquisition does not establish a trend\./g,
    render: ([ndvi]) =>
      `NDVI هو ${ndvi} في أحدث مشهد صالح. والالتقاطة الواحدة لا تحدد اتجاهًا.`,
  },
  {
    match: /Date range must be (\d+) days or fewer\./g,
    render: ([days]) => `يجب ألا تتجاوز مدة النطاق الزمني ${days} يومًا.`,
  },
  {
    match:
      /The selected area is ([\d,.]+) ha; satellite analysis accepts between ([\d.]+) and ([\d,.]+) ha\./g,
    render: ([area, minimum, maximum]) =>
      `المساحة المحددة ${area} هكتار؛ ويقبل تحليل الأقمار الصناعية بين ${minimum} و${maximum} هكتار.`,
  },

  // ── Season completion and POWER latency ─────────────────────────────────
  {
    match:
      /The (\w+) season \((\d+) days\) ended on ([\d-]+); irrigation demand is not assessed after harvest\./g,
    render: ([crop, days, date]) =>
      `انتهى موسم ${CROP_NAMES[crop] ?? crop} (${days} يومًا) في ${date}؛ ولا يُقيَّم طلب الري بعد الحصاد.`,
  },
  {
    match:
      /The (\w+) season \((\d+) days\) ended on ([\d-]+); crop health is not assessed after harvest\./g,
    render: ([crop, days, date]) =>
      `انتهى موسم ${CROP_NAMES[crop] ?? crop} (${days} يومًا) في ${date}؛ ولا تُقيَّم صحة المحصول بعد الحصاد.`,
  },
  {
    match:
      /NASA POWER had not published complete ET₀ inputs for the most recent (\d+) day\(s\); the analysis ends at the latest complete day \(([\d-]+)\)\./g,
    render: ([days, date]) =>
      `لم تكن NASA POWER قد نشرت مدخلات ET₀ كاملة لأحدث ${days} يوم؛ وينتهي التحليل عند أحدث يوم كامل (${date}).`,
  },
  {
    match:
      /A 30-day anomaly needs at least 24 days of rainfall records; only (\d+) day\(s\) are available since planting\./g,
    render: ([days]) =>
      `يحتاج تحليل الشذوذ على 30 يومًا إلى 24 يومًا على الأقل من سجلات الأمطار؛ ولا يتوفر سوى ${days} يوم منذ الزراعة.`,
  },

  // ── Demo notices ────────────────────────────────────────────────────────
  {
    match:
      /Cached NASA POWER snapshot for (.+?)\. Not live data and not the user's field\. Crop stage uses the snapshot planting date \(([\d-]+)\)\./g,
    render: ([place, date]) =>
      `لقطة NASA POWER محفوظة لـ ${place}. ليست بيانات حية ولا تعود لحقلك. وتُستخدم مرحلة المحصول تاريخ زراعة اللقطة (${date}).`,
  },
  {
    match:
      /Demo snapshot: real NASA POWER values for (.+?), ([\d-]+) to ([\d-]+)\./g,
    render: ([place, start, end]) =>
      `لقطة تجريبية: قيم NASA POWER حقيقية لـ ${place}، من ${start} إلى ${end}.`,
  },
];

/** Translate a backend sentence where exact lookup failed. */
export function autoTranslate(text: string): string {
  if (!text) return text;

  const exact = AR_MESSAGES[text];
  if (exact) return exact;

  let output = text;
  for (const pattern of PATTERNS) {
    output = output.replace(pattern.match, (match, ...args) => {
      const groups = args.slice(0, -2).map((value) => String(value));
      return pattern.render(groups, match);
    });
  }
  return output;
}
