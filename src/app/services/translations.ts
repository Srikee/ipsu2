import type { AppLanguage, TranslationDictionary } from './translation.types';
import { ABOUT_TRANSLATIONS } from '../about/about.translations';
import { EBOARD_TRANSLATIONS } from '../eboard/eboard.translations';
import { GRADE_TRANSLATIONS } from '../grade/grade.translations';
import { HOME_TRANSLATIONS } from '../home/home.translations';
import { INFORMATION_TRANSLATIONS } from '../information/information.translations';
import { INFORMATION_WEBVIEW_TRANSLATIONS } from '../information-webview/information-webview.translations';
import { LOADING_TRANSLATIONS } from '../loading/loading.translations';
import { LOCK_TRANSLATIONS } from '../lock/lock.translations';
import { LOGIN_TRANSLATIONS } from '../login/login.translations';
import { MESSAGE_TRANSLATIONS } from '../message/message.translations';
import { PROFILE_TRANSLATIONS } from '../profile/profile.translations';
import { QUICK_MENU_TRANSLATIONS } from '../quick-menu/quick-menu.translations';
import { SCHEDULE_TRANSLATIONS } from '../schedule/schedule.translations';
import { SCHEDULE_EXAM_TRANSLATIONS } from '../schedule-exam/schedule-exam.translations';
import { SCHOLARSHIP_TRANSLATIONS } from '../scholarships/scholarships.translations';
import { TITLE_TRANSLATIONS } from '../title/title.translations';

export type { AppLanguage } from './translation.types';

const SHARED_TRANSLATIONS: TranslationDictionary = {
    th: {
        'common.ok': 'ตกลง',
        'common.cancel': 'ยกเลิก',
        'common.alert': 'แจ้งเตือน',
        'common.processing': 'กำลังประมวลผล',
        'common.server_unavailable': 'ไม่สามารถติดต่อเครื่องแม่ข่ายได้ในขณะนี้',
        'common.refresh': 'รีเฟรชข้อมูล',
        'common.try_again': 'ลองใหม่',
        'common.close_search': 'ปิดการค้นหา',
        'common.search_services': 'ค้นหาบริการ',
        'common.services_count': '{{count}} บริการ',
        'common.items_found': 'พบ {{count}} รายการ',
        'tabs.home': 'หน้าแรก',
        'tabs.message': 'ข้อความ',
        'tabs.eboard': 'eBoard',
        'tabs.information': 'สารสนเทศ',
        'tabs.profile': 'โปรไฟล์',
        'menu.campus': 'วิทยาเขตปัตตานี',
        'menu.welcome': 'ยินดีต้อนรับสู่ iPSU',
        'menu.guest_description': 'เข้าสู่ระบบเพื่อใช้งานบัตรดิจิทัล ตรวจสอบผลการเรียน และสารสนเทศ',
        'menu.login': 'เข้าสู่ระบบ PSU Passport',
        'menu.student': 'นักศึกษา ม.อ.',
        'menu.staff': 'บุคลากร ม.อ.',
        'menu.user': 'ผู้ใช้งาน iPSU',
        'menu.language': 'ภาษา',
        'menu.language_subtitle': 'เลือกภาษาที่ใช้ในแอปพลิเคชัน',
        'menu.theme': 'รูปแบบการแสดงผล',
        'menu.theme_subtitle': 'เลือกโหมดสว่างหรือโหมดมืด',
        'menu.about': 'เกี่ยวกับแอปพลิเคชัน',
        'menu.about_subtitle': 'iPSU Smart Campus และเครดิต',
        'menu.logout': 'ออกจากระบบ',
        'menu.copyright': 'มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี',
        'language.title': 'เลือกภาษา',
        'language.th': 'ไทย',
        'language.en': 'English',
        'language.changed': 'เปลี่ยนภาษาเป็นภาษาไทยแล้ว',
        'theme.title': 'เลือกรูปแบบการแสดงผล',
        'theme.system': 'ตามการตั้งค่าของเครื่อง',
        'theme.light': 'โหมดสว่าง',
        'theme.dark': 'โหมดมืด',
        'theme.changed': 'เปลี่ยนรูปแบบการแสดงผลแล้ว',
        'logout.confirm': 'คุณต้องการออกจากระบบใช่หรือไม่?',
        'logout.title': 'ออกจากระบบ',
    },
    en: {
        'common.ok': 'OK',
        'common.cancel': 'Cancel',
        'common.alert': 'Alert',
        'common.processing': 'Processing',
        'common.server_unavailable': 'Unable to contact the server right now.',
        'common.refresh': 'Refresh data',
        'common.try_again': 'Try again',
        'common.close_search': 'Close search',
        'common.search_services': 'Search services',
        'common.services_count': '{{count}} services',
        'common.items_found': '{{count}} items found',
        'tabs.home': 'Home',
        'tabs.message': 'Messages',
        'tabs.eboard': 'eBoard',
        'tabs.information': 'Information',
        'tabs.profile': 'Profile',
        'menu.campus': 'Pattani Campus',
        'menu.welcome': 'Welcome to iPSU',
        'menu.guest_description': 'Sign in to use your digital ID, view academic results, and access information services.',
        'menu.login': 'Sign in with PSU Passport',
        'menu.student': 'PSU Student',
        'menu.staff': 'PSU Staff',
        'menu.user': 'iPSU User',
        'menu.language': 'Language',
        'menu.language_subtitle': 'Choose the language used in the app',
        'menu.theme': 'Appearance',
        'menu.theme_subtitle': 'Choose light or dark mode',
        'menu.about': 'About the application',
        'menu.about_subtitle': 'iPSU Smart Campus and credits',
        'menu.logout': 'Sign out',
        'menu.copyright': 'Prince of Songkla University, Pattani Campus',
        'language.title': 'Choose language',
        'language.th': 'ไทย',
        'language.en': 'English',
        'language.changed': 'Language changed to English.',
        'theme.title': 'Choose appearance',
        'theme.system': 'Use device setting',
        'theme.light': 'Light mode',
        'theme.dark': 'Dark mode',
        'theme.changed': 'Appearance updated.',
        'logout.confirm': 'Do you want to sign out?',
        'logout.title': 'Sign out',
    }
};

export const APP_TRANSLATIONS: TranslationDictionary = {
    th: {
        ...SHARED_TRANSLATIONS.th,
        ...ABOUT_TRANSLATIONS.th,
        ...EBOARD_TRANSLATIONS.th,
        ...GRADE_TRANSLATIONS.th,
        ...HOME_TRANSLATIONS.th,
        ...INFORMATION_TRANSLATIONS.th,
        ...INFORMATION_WEBVIEW_TRANSLATIONS.th,
        ...LOADING_TRANSLATIONS.th,
        ...LOCK_TRANSLATIONS.th,
        ...LOGIN_TRANSLATIONS.th,
        ...MESSAGE_TRANSLATIONS.th,
        ...PROFILE_TRANSLATIONS.th,
        ...QUICK_MENU_TRANSLATIONS.th,
        ...SCHEDULE_TRANSLATIONS.th,
        ...SCHEDULE_EXAM_TRANSLATIONS.th,
        ...SCHOLARSHIP_TRANSLATIONS.th,
        ...TITLE_TRANSLATIONS.th,
    },
    en: {
        ...SHARED_TRANSLATIONS.en,
        ...ABOUT_TRANSLATIONS.en,
        ...EBOARD_TRANSLATIONS.en,
        ...GRADE_TRANSLATIONS.en,
        ...HOME_TRANSLATIONS.en,
        ...INFORMATION_TRANSLATIONS.en,
        ...INFORMATION_WEBVIEW_TRANSLATIONS.en,
        ...LOADING_TRANSLATIONS.en,
        ...LOCK_TRANSLATIONS.en,
        ...LOGIN_TRANSLATIONS.en,
        ...MESSAGE_TRANSLATIONS.en,
        ...PROFILE_TRANSLATIONS.en,
        ...QUICK_MENU_TRANSLATIONS.en,
        ...SCHEDULE_TRANSLATIONS.en,
        ...SCHEDULE_EXAM_TRANSLATIONS.en,
        ...SCHOLARSHIP_TRANSLATIONS.en,
        ...TITLE_TRANSLATIONS.en,
    }
};
