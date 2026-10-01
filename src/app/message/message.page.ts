import { Component, OnDestroy, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { Subscription } from 'rxjs';
import { LoginPage } from '../login/login.page';
import { IpsuService } from '../services/ipsu.service';
import {
    MessageAction,
    MessageCounts,
    MessageItem,
    MessageService,
    MessageType
} from '../services/message.service';

@Component({
    selector: 'app-message',
    templateUrl: './message.page.html',
    styleUrls: ['./message.page.scss'],
    standalone: false,
})
export class MessagePage implements OnDestroy {
    public ipsu = inject(IpsuService);
    private modalController = inject(ModalController);
    private messageService = inject(MessageService);
    private inAppBrowser = inject(InAppBrowser);

    isLoading = true;
    isRefreshing = false;
    isLoadingMore = false;
    isOffline = false;
    hasMore = false;
    message_type: MessageType = 'task';
    message: MessageItem[] = [];
    filteredMessages: MessageItem[] = [];
    searchQuery = '';
    isSearchVisible = false;

    isSelectionMode = false;
    selectedIds = new Set<number>();
    private longPressTimer: ReturnType<typeof setTimeout> | null = null;
    private longPressTriggered = false;
    private longPressStartX = 0;
    private longPressStartY = 0;

    unreadCounts: MessageCounts = {
        task: 0,
        alert: 0,
        message: 0
    };

    selectedMessage: MessageItem | null = null;
    isDetailModalOpen = false;

    private syncSubscription: Subscription;
    private readonly onlineHandler = () => {
        this.isOffline = false;
    };
    private readonly offlineHandler = () => {
        this.isOffline = true;
    };

    constructor() {
        this.syncSubscription = this.messageService.syncCompleted.subscribe(async () => {
            if (!this.ipsu.auth.status) return;
            await this.loadCounts();
            await this.loadCachedType(this.message_type);
        });
    }

    ionViewWillEnter() {
        this.isOffline = !this.messageService.isOnline();
        window.addEventListener('online', this.onlineHandler);
        window.addEventListener('offline', this.offlineHandler);
        this.PageEnter();
    }

    ionViewWillLeave() {
        window.removeEventListener('online', this.onlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
        this.clearLongPressTimer();
        this.exitSelectionMode();
    }

    ngOnDestroy() {
        this.syncSubscription.unsubscribe();
        window.removeEventListener('online', this.onlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
    }

    async PageEnter() {
        if (!this.ipsu.auth.status) {
            await this.requestLogin();
            return;
        }

        this.isLoading = true;
        await Promise.all([
            this.loadCounts(),
            this.loadCachedType(this.message_type)
        ]);

        if (this.messageService.isOnline()) {
            await this.messageService.syncPending(this.ipsu.auth.psu_id);
            await this.LoadData(false);
        }
        this.isLoading = false;
    }

    async LoadData(showLoading = false): Promise<void> {
        if (!this.ipsu.auth.status) return;
        if (!this.messageService.isOnline()) {
            this.isOffline = true;
            await this.ipsu.ShowToast(this.ipsu.T('message.cached_data'), 1800);
            return;
        }

        if (showLoading && this.message.length === 0) this.isLoading = true;
        try {
            const targetCount = Math.max(this.message.length, this.messageService.pageSize);
            const cache = await this.messageService.refresh(
                this.ipsu.auth.psu_id,
                this.message_type,
                targetCount
            );
            this.applyCache(cache);
            await this.loadCounts();
            this.isOffline = false;
        } catch (error: any) {
            this.isOffline = !this.messageService.isOnline();
            if (showLoading) {
                await this.ipsu.ShowToast(
                    error?.message || this.ipsu.T('message.load_failed_cache'),
                    2200
                );
            }
        } finally {
            this.isLoading = false;
        }
    }

    async selectSegment(type: MessageType) {
        if (this.message_type === type) return;
        this.exitSelectionMode();
        this.message_type = type;
        this.searchQuery = '';
        this.isLoading = true;
        await this.loadCachedType(type);
        await this.LoadData(false);
        this.isLoading = false;
    }

    async handleRefresh(event: any) {
        this.isRefreshing = true;
        await this.LoadData(false);
        this.isRefreshing = false;
        event?.target?.complete();
    }

    async loadMore(event: any) {
        if (this.isLoadingMore || !this.hasMore) {
            event?.target?.complete();
            return;
        }
        if (!this.messageService.isOnline()) {
            this.isOffline = true;
            event?.target?.complete();
            await this.ipsu.ShowToast(this.ipsu.T('message.online_more'), 1800);
            return;
        }

        this.isLoadingMore = true;
        try {
            const cache = await this.messageService.loadNext(
                this.ipsu.auth.psu_id,
                this.message_type
            );
            this.applyCache(cache);
            await this.loadCounts();
        } catch (error: any) {
            await this.ipsu.ShowToast(error?.message || this.ipsu.T('message.load_more_failed'), 1800);
        } finally {
            this.isLoadingMore = false;
            event?.target?.complete();
        }
    }

    toggleSearch() {
        this.isSearchVisible = !this.isSearchVisible;
        if (!this.isSearchVisible) this.clearSearch();
    }

    clearSearch() {
        this.searchQuery = '';
        this.filterList();
    }

    get searchPlaceholder(): string {
        if (this.message_type === 'task') return this.ipsu.T('message.search_task');
        if (this.message_type === 'alert') return this.ipsu.T('message.search_alert');
        return this.ipsu.T('message.search_message');
    }

    filterList() {
        if (!this.searchQuery.trim()) {
            this.filteredMessages = this.message;
            return;
        }
        const query = this.searchQuery.toLowerCase().trim();
        this.filteredMessages = this.message.filter(item =>
            item.title.toLowerCase().includes(query)
            || item.detail.toLowerCase().includes(query)
            || item.sender.toLowerCase().includes(query)
        );
    }

    async openMessageDetail(item: MessageItem) {
        this.selectedMessage = item;
        this.isDetailModalOpen = true;

        if (item.type === 'message' && !item.isRead) {
            item.isRead = true;
            await this.runMutation('read', [item.id], false);
            this.selectedMessage = this.message.find(message => message.id === item.id) || item;
        }
    }

    closeMessageDetail() {
        this.isDetailModalOpen = false;
        this.selectedMessage = null;
    }

    async toggleSaved(item: MessageItem) {
        const action: MessageAction = item.isSaved ? 'unsave' : 'save';
        const result = await this.runMutation(action, [item.id]);
        if (result) {
            this.selectedMessage = this.message.find(message => message.id === item.id) || null;
        }
    }

    async deleteMessage(item: MessageItem, event?: Event) {
        event?.stopPropagation();
        if (item.type !== 'message') return;

        const confirmed = await this.ipsu.ShowConfirm(
            this.ipsu.T('message.delete_confirm'),
            this.ipsu.T('message.delete_title'),
            this.ipsu.T('message.delete_title'),
            this.ipsu.T('common.cancel'),
            true
        );
        if (!confirmed) return;

        const success = await this.runMutation('delete', [item.id]);
        if (success) {
            this.closeMessageDetail();
            await this.ipsu.ShowToast(this.ipsu.T('message.deleted'), 1800);
        }
    }

    openItemLink(item: MessageItem) {
        const link = this.getItemLink(item);
        if (!link) return;
        if (!this.messageService.isOnline()) {
            this.ipsu.ShowToast(this.ipsu.T('message.online_link'), 1800);
            return;
        }

        try {
            if (this.ipsu.GetPlatform() !== 'browser') {
                this.inAppBrowser.create(link, '_blank', { location: 'yes' });
            } else {
                window.open(link, '_blank', 'noopener');
            }
        } catch (error) {
            window.open(link, '_blank', 'noopener');
        }
    }

    getItemLink(item: MessageItem | null): string {
        if (!item?.domain?.trim() || !item?.url?.trim()) return '';
        const domain = item.domain.trim().replace(/\/+$/, '');
        const path = item.url.trim().replace(/^\/+/, '');
        return `${domain}/${path}`;
    }

    enterSelectionMode(initialId?: number) {
        if (this.message_type !== 'message') return;
        this.isSelectionMode = true;
        this.ipsu.isMessageSelectionMode = true;
        if (initialId !== undefined) this.selectedIds.add(initialId);
    }

    exitSelectionMode() {
        this.isSelectionMode = false;
        this.ipsu.isMessageSelectionMode = false;
        this.selectedIds.clear();
    }

    toggleSelectionMode() {
        if (this.isSelectionMode) this.exitSelectionMode();
        else this.enterSelectionMode();
    }

    onAvatarClick(item: MessageItem, event: Event) {
        event.stopPropagation();
        if (!this.isSelectionMode) this.enterSelectionMode(item.id);
        else this.toggleSelect(item);
    }

    toggleSelect(item: MessageItem, event?: Event) {
        event?.stopPropagation();
        if (this.selectedIds.has(item.id)) this.selectedIds.delete(item.id);
        else this.selectedIds.add(item.id);
    }

    startMessageLongPress(item: MessageItem, event: PointerEvent) {
        if (event.button !== 0 || item.type !== 'message') return;
        this.clearLongPressTimer();
        this.longPressTriggered = false;
        if (this.isSelectionMode) return;

        this.longPressStartX = event.clientX;
        this.longPressStartY = event.clientY;
        this.longPressTimer = setTimeout(() => {
            this.longPressTriggered = true;
            this.enterSelectionMode(item.id);
            navigator.vibrate?.(35);
            this.longPressTimer = null;
        }, 550);
    }

    moveMessageLongPress(event: PointerEvent) {
        if (Math.abs(event.clientX - this.longPressStartX) > 10
            || Math.abs(event.clientY - this.longPressStartY) > 10) {
            this.clearLongPressTimer();
        }
    }

    endMessageLongPress() {
        this.clearLongPressTimer();
    }

    onMessageContextMenu(item: MessageItem, event: Event) {
        if (item.type !== 'message') return;
        event.preventDefault();
        this.clearLongPressTimer();
        if (!this.isSelectionMode) {
            this.longPressTriggered = true;
            this.enterSelectionMode(item.id);
        }
    }

    onCardClick(item: MessageItem) {
        if (this.longPressTriggered) {
            this.longPressTriggered = false;
            return;
        }
        if (this.isSelectionMode) this.toggleSelect(item);
        else this.openMessageDetail(item);
    }

    toggleSelectAll() {
        if (this.isAllSelected()) this.selectedIds.clear();
        else this.filteredMessages.forEach(item => this.selectedIds.add(item.id));
    }

    isAllSelected(): boolean {
        return this.filteredMessages.length > 0
            && this.filteredMessages.every(item => this.selectedIds.has(item.id));
    }

    isItemSelected(id: number): boolean {
        return this.selectedIds.has(id);
    }

    async deleteSelected() {
        if (!this.ensureSelected()) return;
        const count = this.selectedIds.size;
        const confirmed = await this.ipsu.ShowConfirm(
            this.ipsu.T('message.delete_selected_confirm', { count }),
            this.ipsu.T('message.delete_selected_title', { count }),
            this.ipsu.T('message.delete_selected'),
            this.ipsu.T('common.cancel'),
            true
        );
        if (!confirmed) return;

        const success = await this.runMutation('delete', [...this.selectedIds]);
        if (success) {
            this.exitSelectionMode();
            await this.ipsu.ShowToast(this.ipsu.T('message.deleted_count', { count }), 1800);
        }
    }

    async markSelectedAsRead() {
        if (!this.ensureSelected()) return;
        const unreadIds = this.message
            .filter(item => this.selectedIds.has(item.id) && !item.isRead)
            .map(item => item.id);
        if (unreadIds.length === 0) {
            await this.ipsu.ShowToast(this.ipsu.T('message.all_read'), 1500);
            return;
        }
        const count = unreadIds.length;
        const success = await this.runMutation('read', unreadIds);
        if (success) {
            this.exitSelectionMode();
            await this.ipsu.ShowToast(this.ipsu.T('message.marked_read_count', { count }), 1800);
        }
    }

    async toggleSelectedSaved() {
        if (!this.ensureSelected()) return;
        const selected = this.message.filter(item => this.selectedIds.has(item.id));
        const shouldUnsave = selected.length > 0 && selected.every(item => item.isSaved);
        const action: MessageAction = shouldUnsave ? 'unsave' : 'save';
        const count = selected.length;
        const success = await this.runMutation(action, selected.map(item => item.id));
        if (success) {
            this.exitSelectionMode();
            await this.ipsu.ShowToast(
                `${shouldUnsave ? 'ยกเลิกการบันทึก' : 'บันทึก'}ข้อความ ${count} รายการแล้ว`,
                1800
            );
        }
    }

    selectedAreSaved(): boolean {
        const selected = this.message.filter(item => this.selectedIds.has(item.id));
        return selected.length > 0 && selected.every(item => item.isSaved);
    }

    formatMessageDate(value: string): string {
        if (!value) return '';
        const date = new Date(value.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return value;

        const dateText = new Intl.DateTimeFormat('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
        const timeText = new Intl.DateTimeFormat('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
        return `${dateText} ${timeText} น.`;
    }

    async promptLogin() {
        const modal = await this.modalController.create({ component: LoginPage });
        modal.onWillDismiss().then(() => this.PageEnter());
        return await modal.present();
    }

    private async requestLogin() {
        await this.ipsu.SetStorage('ipsu-callback', '/tabs/message');
        const confirmed = await this.ipsu.ShowConfirm(
            this.ipsu.T('message.login_required'),
            this.ipsu.T('login.title'),
            this.ipsu.T('login.sign_in'),
            'ไว้ทีหลัง',
            false
        );
        if (confirmed) await this.promptLogin();
        else this.ipsu.LinkTo('/tabs/home');
    }

    private async loadCachedType(type: MessageType) {
        const cache = await this.messageService.getCache(this.ipsu.auth.psu_id, type);
        this.applyCache(cache);
    }

    private applyCache(cache: any) {
        this.message = this.messageService.visibleItems(cache);
        this.hasMore = cache.hasMore;
        this.filterList();
    }

    private async loadCounts() {
        this.unreadCounts = await this.messageService.getCounts(this.ipsu.auth.psu_id);
        this.ipsu.unreadMessageCount = this.unreadCounts.task
            + this.unreadCounts.alert
            + this.unreadCounts.message;
    }

    private async runMutation(action: MessageAction, ids: number[], showQueuedToast = true): Promise<boolean> {
        const result = await this.messageService.mutate(this.ipsu.auth.psu_id, action, ids);
        await Promise.all([
            this.loadCachedType(this.message_type),
            this.loadCounts()
        ]);

        if (!result.success) {
            await this.ipsu.ShowToast(result.message || this.ipsu.T('message.update_failed'), 2200);
            return false;
        }
        if (result.queued && showQueuedToast) {
            await this.ipsu.ShowToast(this.ipsu.T('message.queued'), 2200);
        }
        return true;
    }

    private ensureSelected(): boolean {
        if (this.message_type !== 'message' || this.selectedIds.size === 0) {
            this.ipsu.ShowToast(this.ipsu.T('message.select_required'), 1500);
            return false;
        }
        return true;
    }

    private clearLongPressTimer() {
        if (this.longPressTimer !== null) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
}
