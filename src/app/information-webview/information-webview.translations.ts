import type { TranslationDictionary } from '../services/translation.types';

export const INFORMATION_WEBVIEW_TRANSLATIONS: TranslationDictionary = {
    th: {
        'information_webview.title': 'สารสนเทศ',
        'information_webview.system_title': 'ระบบสารสนเทศ',
        'information_webview.reload': 'รีเฟรชหน้าเว็บ',
        'information_webview.open_browser': 'เปิดในเบราว์เซอร์',
        'information_webview.loading': 'กำลังโหลด {{title}}...',
        'information_webview.please_wait': 'โปรดรอสักครู่',
        'information_webview.blocked_hint': 'หากหน้าเว็บไม่แสดงผล หรือถูกจำกัดด้วยระบบความปลอดภัย',
        'information_webview.missing_title': 'ไม่พบลิงก์บริการ',
        'information_webview.missing_description': 'ไม่สามารถเปิดหน้าเว็บได้เนื่องจากไม่มีที่อยู่ URL',
        'information_webview.back': 'ย้อนกลับ',
    },
    en: {
        'information_webview.title': 'Information',
        'information_webview.system_title': 'Information Service',
        'information_webview.reload': 'Reload web page',
        'information_webview.open_browser': 'Open in browser',
        'information_webview.loading': 'Loading {{title}}...',
        'information_webview.please_wait': 'Please wait a moment',
        'information_webview.blocked_hint': 'If the web page does not appear or is blocked by its security settings',
        'information_webview.missing_title': 'Service link not found',
        'information_webview.missing_description': 'The web page cannot be opened because no URL was provided.',
        'information_webview.back': 'Go back',
    }
};
