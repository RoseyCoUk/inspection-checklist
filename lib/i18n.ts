"use client";
import { useEffect, useState } from "react";

export type Lang = "en" | "ar";

const dict = {
  en: {
    appTitle: "Raha Resort",
    inspection: "Inspection",
    welcome: "Welcome",
    enterName: "Enter your name to begin today's inspection.",
    yourName: "Your name",
    startInspection: "Start inspection",
    rooms: "Rooms",
    reports: "Reports",
    managerView: "Manager View",
    home: "Home",
    back: "Back",
    backToRooms: "Back to rooms",
    backToReports: "Back to reports",
    changeWorker: "Change worker",
    floor: "Floor",
    roomsCount: "rooms",
    room: "Room",
    checked: "checked",
    of: "of",
    good: "Good",
    issue: "Issue",
    goodOrIssue: "How is it?",
    describeIssue: "Describe the issue",
    photo: "Photo",
    save: "Save",
    cancel: "Cancel",
    submitReport: "Submit report",
    saving: "Saving…",
    itemsLeft: "item(s) left",
    addNotePhoto: "Add note + photo for issues",
    reportSaved: "Report saved.",
    pickNext: "Pick the next room.",
    loading: "Loading…",
    noReports: "No reports yet.",
    date: "Date",
    worker: "Worker",
    issues: "Issues",
    allGood: "All Good",
    clean: "Clean",
    bad: "Bad",
    villas: "Villas",
    villa: "Villa",
    category: "Category",
    allCategories: "All categories",
    specificIssue: "Specific issue",
    allIssues: "All issues",
    cat_paint: "Paint",
    cat_mechanical: "Mechanical",
    cat_plumbing: "Plumbing",
    cat_electrical: "Electrical",
    cat_furniture: "Furniture",
    cat_cleaning: "Cleaning",
    cat_other: "Other",
  },
  ar: {
    appTitle: "منتجع راحة",
    inspection: "التفتيش",
    welcome: "مرحباً",
    enterName: "أدخل اسمك لبدء تفتيش اليوم.",
    yourName: "اسمك",
    startInspection: "ابدأ التفتيش",
    rooms: "الغرف",
    reports: "التقارير",
    managerView: "عرض المدير",
    home: "الرئيسية",
    back: "رجوع",
    backToRooms: "العودة للغرف",
    backToReports: "العودة للتقارير",
    changeWorker: "تغيير العامل",
    floor: "الطابق",
    roomsCount: "غرف",
    room: "غرفة",
    checked: "تم فحصه",
    of: "من",
    good: "جيد",
    issue: "مشكلة",
    goodOrIssue: "ما هي الحالة؟",
    describeIssue: "صف المشكلة",
    photo: "صورة",
    save: "حفظ",
    cancel: "إلغاء",
    submitReport: "إرسال التقرير",
    saving: "جارٍ الحفظ…",
    itemsLeft: "عنصر متبقي",
    addNotePhoto: "أضف ملاحظة وصورة للمشاكل",
    reportSaved: "تم حفظ التقرير.",
    pickNext: "اختر الغرفة التالية.",
    loading: "جارٍ التحميل…",
    noReports: "لا توجد تقارير بعد.",
    date: "التاريخ",
    worker: "العامل",
    issues: "المشاكل",
    allGood: "كل شيء جيد",
    clean: "نظيف",
    bad: "سيء",
    villas: "الفلل",
    villa: "فيلا",
    category: "الفئة",
    allCategories: "كل الفئات",
    specificIssue: "مشكلة محددة",
    allIssues: "كل المشاكل",
    cat_paint: "الطلاء",
    cat_mechanical: "الميكانيكا",
    cat_plumbing: "السباكة",
    cat_electrical: "الكهرباء",
    cat_furniture: "الأثاث",
    cat_cleaning: "التنظيف",
    cat_other: "أخرى",
  },
} as const;

export type Key = keyof typeof dict.en;

export const itemLabels: Record<string, string> = {
  "Balcony (paint condition)": "الشرفة (حالة الطلاء)",
  "Aluminum (finishes door hand)": "الألمنيوم (تشطيبات مقبض الباب)",
  "Aluminum handles": "مقابض الألمنيوم",
  "Curtains": "الستائر",
  "Paint behind curtains": "الطلاء خلف الستائر",
  "Wallpaper": "ورق الجدران",
  "Artwork": "اللوحات الفنية",
  "Woodwork": "الأعمال الخشبية",
  "Headboard": "اللوح الأمامي للسرير",
  "Evacuation sign": "لوحة الإخلاء",
  "Basin": "الحوض",
  "Toilet accessories": "إكسسوارات المرحاض",
  "Shower robeh": "رأس الدش",
  "Joints around accessories": "الفواصل حول الإكسسوارات",
  "Tiles": "البلاط",
  "Light accessories": "إكسسوارات الإضاءة",
  "Maintenance holes (covered/condition)": "فتحات الصيانة (مغطاة/الحالة)",
  "Mini bar": "الميني بار",
  "TV (working)": "التلفاز (يعمل)",
  "Room amenities (5 pcs)": "مستلزمات الغرفة (٥ قطع)",
  "Cleanliness (rate 1-10, use note)": "النظافة (قيم من ١ إلى ١٠ في الملاحظة)",
  "Safe box (installed)": "الخزنة (مركبة)",
  "Nightstand (balanced)": "الكومودينو (متوازن)",
  "Phone (working)": "الهاتف (يعمل)",
  "Paint in general": "الطلاء بشكل عام",
  "Paint condition": "حالة الطلاء",
  "Aluminum": "الألمنيوم",
  "Mosquito net": "الناموسية",
  "Showers": "الدش",
  "Tiles, robeh": "البلاط، الروبيه",
  "Light spots (up/down etc.)": "نقاط الإضاءة (علوية/سفلية)",
  "Kitchen": "المطبخ",
  "BBQ area": "منطقة الشواء",
  "Pool area": "منطقة المسبح",
  "Main door paint and handle": "طلاء ومقبض الباب الرئيسي",
  "Garden grass area": "منطقة عشب الحديقة",
};

export function translateItem(label: string, lang: Lang): string {
  if (lang === "ar" && itemLabels[label]) return itemLabels[label];
  return label;
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const raw = localStorage.getItem("lang");
    const saved: Lang = raw === "ar" ? "ar" : "en";
    setLangState(saved);
    document.documentElement.lang = saved;
    document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    const handler = (e: Event) => {
      const l = (e as CustomEvent).detail as Lang;
      setLangState(l);
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    };
    window.addEventListener("langchange", handler);
    return () => window.removeEventListener("langchange", handler);
  }, []);

  function setLang(l: Lang) {
    localStorage.setItem("lang", l);
    window.dispatchEvent(new CustomEvent("langchange", { detail: l }));
  }

  return [lang, setLang];
}

export function useT(): (k: Key) => string {
  const [lang] = useLang();
  return (k: Key) => dict[lang][k];
}
