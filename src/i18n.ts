export type Lang = "ko" | "en";

const translations = {
  ko: {
    title: "영상 압축기",
    dropText: "영상 파일을 드래그하거나 클릭하여 선택",
    dropHint: "MP4, AVI, MKV, MOV 등",
    size: "크기",
    resolution: "해상도",
    duration: "길이",
    startCompress: "압축 시작",
    cancel: "취소",
    compressing: "압축 중...",
    done: "압축 완료!",
    original: "원본",
    compressed: "압축",
    savings: "절감",
    openFolder: "폴더 열기",
    anotherFile: "다른 파일",
    error: "오류 발생",
    retry: "다시 시도",
    quality: "압축 품질",
    qualityLight: "가벼운 압축",
    qualityLightDesc: "빠르고 화질 유지",
    qualityRecommended: "권장",
    qualityRecommendedDesc: "균형 잡힌 압축",
    qualityHigh: "높은 압축",
    qualityHighDesc: "용량 최소화",
    qualityMax: "최대 압축",
    qualityMaxDesc: "최소 용량, 화질 저하",
    recommended: "권장",
  },
  en: {
    title: "Video Compressor",
    dropText: "Drag & drop a video or click to select",
    dropHint: "MP4, AVI, MKV, MOV, etc.",
    size: "Size",
    resolution: "Resolution",
    duration: "Duration",
    startCompress: "Start Compress",
    cancel: "Cancel",
    compressing: "Compressing...",
    done: "Compression Complete!",
    original: "Original",
    compressed: "Compressed",
    savings: "Saved",
    openFolder: "Open Folder",
    anotherFile: "Another File",
    error: "Error Occurred",
    retry: "Try Again",
    quality: "Compression Quality",
    qualityLight: "Light",
    qualityLightDesc: "Fast, preserves quality",
    qualityRecommended: "Recommended",
    qualityRecommendedDesc: "Balanced compression",
    qualityHigh: "High",
    qualityHighDesc: "Minimize file size",
    qualityMax: "Maximum",
    qualityMaxDesc: "Smallest size, lower quality",
    recommended: "Recommended",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["ko"];

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang][key];
}

export function getDefaultLang(): Lang {
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("ko")) return "ko";
  return "en";
}
