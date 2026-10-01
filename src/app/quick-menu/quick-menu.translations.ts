import type { TranslationDictionary } from '../services/translation.types';

export const QUICK_MENU_TRANSLATIONS: TranslationDictionary = {
    th: {
        'quick_menu.title': 'จัดการบริการด่วน',
        'quick_menu.heading': 'บริการของคุณ',
        'quick_menu.description': 'เลือกได้ไม่เกิน {{count}} เมนู และลากเพื่อจัดลำดับการแสดงผล',
        'quick_menu.selected': 'เมนูที่เลือก',
        'quick_menu.drag_hint': 'แตะค้างที่ไอคอนด้านขวาแล้วลากเพื่อสลับลำดับ',
        'quick_menu.empty_selected': 'เลือกเมนูจากรายการด้านล่าง',
        'quick_menu.remove': 'นำออกจากบริการด่วน',
        'quick_menu.maximum_reached': 'เลือกบริการด่วนได้ไม่เกิน {{count}} เมนู',
        'quick_menu.save_selection': 'บันทึกบริการด่วน',
        'quick_menu.saved': 'บันทึกบริการด่วนแล้ว',
        'quick_menu.load_failed': 'ไม่สามารถโหลดรายการเมนูได้',
        'quick_menu.save_failed': 'ไม่สามารถบันทึกบริการด่วนได้ กรุณาลองใหม่อีกครั้ง',
        'quick_menu.no_options': 'ยังไม่มีเมนูที่เลือกได้',
        'quick_menu.no_options_desc': 'บริการสำหรับบัญชีของคุณอยู่ระหว่างการเตรียมข้อมูล',
    },
    en: {
        'quick_menu.title': 'Manage quick services',
        'quick_menu.heading': 'Your services',
        'quick_menu.description': 'Choose up to {{count}} menus and drag to arrange their display order.',
        'quick_menu.selected': 'Selected menus',
        'quick_menu.drag_hint': 'Press and hold the icon on the right, then drag to reorder.',
        'quick_menu.empty_selected': 'Choose menus from the list below.',
        'quick_menu.remove': 'Remove from quick services',
        'quick_menu.maximum_reached': 'You can choose up to {{count}} quick services.',
        'quick_menu.save_selection': 'Save quick services',
        'quick_menu.saved': 'Quick services saved.',
        'quick_menu.load_failed': 'Unable to load menu options.',
        'quick_menu.save_failed': 'Unable to save quick services. Please try again.',
        'quick_menu.no_options': 'No menus available',
        'quick_menu.no_options_desc': 'Services for your account are being prepared.',
    }
};
