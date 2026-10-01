import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { IpsuService } from './ipsu.service';

export type MessageType = 'task' | 'alert' | 'message';
export type MessageAction = 'read' | 'save' | 'unsave' | 'delete';

export interface MessageItem {
    id: number;
    type: MessageType;
    title: string;
    detail: string;
    sender: string;
    addWhen: string;
    readWhen?: string;
    isRead: boolean;
    isSaved: boolean;
    domain?: string;
    url?: string;
    pendingDelete?: boolean;
}

export interface MessageCounts {
    task: number;
    alert: number;
    message: number;
}

export interface MessageCache {
    items: MessageItem[];
    total: number;
    loadedPages: number;
    hasMore: boolean;
    updatedAt: string;
}

export interface MessageMutationResult {
    queued: boolean;
    success: boolean;
    message?: string;
}

interface PendingMessageAction {
    key: string;
    action: MessageAction;
    ids: number[];
    createdAt: string;
}

interface MessagePageResponse {
    status: string;
    data?: any[];
    message?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        has_more?: boolean;
        counts?: Partial<MessageCounts>;
    };
}

@Injectable({
    providedIn: 'root'
})
export class MessageService {
    readonly pageSize = 20;
    readonly syncCompleted = new Subject<void>();
    private syncing = false;

    constructor(private ipsu: IpsuService) {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                const psuId = this.ipsu.auth?.psu_id || '';
                if (this.ipsu.auth?.status && psuId) {
                    this.syncPending(psuId);
                }
            });
        }
    }

    isOnline(): boolean {
        return typeof navigator === 'undefined' || navigator.onLine !== false;
    }

    async getCache(psuId: string, type: MessageType): Promise<MessageCache> {
        const cached = await this.ipsu.GetStorage(this.cacheKey(psuId, type));
        if (!cached || !Array.isArray(cached.items)) return this.emptyCache();

        return {
            items: cached.items.map((item: any) => this.normalizeItem(item, type)),
            total: Math.max(0, Number(cached.total) || 0),
            loadedPages: Math.max(0, Number(cached.loadedPages) || 0),
            hasMore: !!cached.hasMore,
            updatedAt: cached.updatedAt || ''
        };
    }

    async getCounts(psuId: string): Promise<MessageCounts> {
        const counts = await this.ipsu.GetStorage(this.countsKey(psuId));
        return this.normalizeCounts(counts);
    }

    async refresh(psuId: string, type: MessageType, minimumCount = this.pageSize): Promise<MessageCache> {
        if (!this.isOnline()) throw new Error('offline');

        const current = await this.getCache(psuId, type);
        const baseTargetCount = Math.max(this.pageSize, minimumCount, this.visibleItems(current).length);
        let targetCount = baseTargetCount;
        const remoteItems: MessageItem[] = [];
        let page = 1;
        let hasMore = true;
        let total = 0;
        let latestCounts = await this.getCounts(psuId);

        while (hasMore && remoteItems.length < targetCount) {
            const response = await this.fetchPage(psuId, type, page, page === 1);
            remoteItems.push(...response.items);
            hasMore = response.hasMore;
            total = response.total;
            if (response.counts) latestCounts = response.counts;
            if (page === 1 && current.loadedPages > 0) {
                const newItemDifference = Math.max(0, total - current.total);
                targetCount = baseTargetCount + newItemDifference;
            }
            page += 1;
        }

        const queue = await this.getQueue(psuId);
        const reconciled = type === 'message'
            ? this.applyPending(remoteItems, latestCounts, queue)
            : {
                items: remoteItems,
                counts: queue.length > 0
                    ? { ...latestCounts, message: (await this.getCounts(psuId)).message }
                    : latestCounts
            };
        const remoteIds = new Set(remoteItems.map(item => item.id));
        const pendingDeleteCount = type === 'message'
            ? new Set(
                queue
                    .filter(item => item.action === 'delete')
                    .flatMap(item => item.ids)
                    .filter(id => remoteIds.has(id))
            ).size
            : 0;
        const cache: MessageCache = {
            items: this.uniqueItems(reconciled.items),
            total: Math.max(0, total - pendingDeleteCount),
            loadedPages: Math.max(1, page - 1),
            hasMore,
            updatedAt: new Date().toISOString()
        };

        await Promise.all([
            this.saveCache(psuId, type, cache),
            this.saveCounts(psuId, reconciled.counts)
        ]);
        return cache;
    }

    async loadNext(psuId: string, type: MessageType): Promise<MessageCache> {
        const current = await this.getCache(psuId, type);
        if (!current.hasMore || !this.isOnline()) return current;

        const nextPage = Math.max(1, current.loadedPages + 1);
        const response = await this.fetchPage(psuId, type, nextPage, false);
        const queue = await this.getQueue(psuId);
        const currentCounts = await this.getCounts(psuId);
        const combined = this.uniqueItems([...current.items, ...response.items]);
        const reconciled = type === 'message'
            ? this.applyPending(combined, currentCounts, queue)
            : {
                items: combined,
                counts: queue.length > 0
                    ? { ...currentCounts, message: currentCounts.message }
                    : currentCounts
            };
        const combinedIds = new Set(combined.map(item => item.id));
        const pendingDeleteCount = type === 'message'
            ? new Set(
                queue
                    .filter(item => item.action === 'delete')
                    .flatMap(item => item.ids)
                    .filter(id => combinedIds.has(id))
            ).size
            : 0;
        const cache: MessageCache = {
            items: reconciled.items,
            total: Math.max(0, response.total - pendingDeleteCount),
            loadedPages: nextPage,
            hasMore: response.hasMore,
            updatedAt: new Date().toISOString()
        };

        await Promise.all([
            this.saveCache(psuId, type, cache),
            this.saveCounts(psuId, reconciled.counts)
        ]);
        return cache;
    }

    async mutate(psuId: string, action: MessageAction, ids: number[]): Promise<MessageMutationResult> {
        const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
        if (uniqueIds.length === 0) {
            return { success: false, queued: false, message: 'ไม่พบรายการที่ต้องการอัปเดต' };
        }

        const previousCache = await this.getCache(psuId, 'message');
        const previousCounts = await this.getCounts(psuId);
        const updated = this.applyAction(previousCache.items, previousCounts, action, uniqueIds);
        const optimisticCache: MessageCache = {
            ...previousCache,
            items: updated.items,
            total: action === 'delete'
                ? Math.max(0, previousCache.total - updated.affected)
                : previousCache.total,
            updatedAt: new Date().toISOString()
        };
        await Promise.all([
            this.saveCache(psuId, 'message', optimisticCache),
            this.saveCounts(psuId, updated.counts)
        ]);

        const chunks = this.chunkIds(uniqueIds);
        if (!this.isOnline()) {
            for (const chunk of chunks) await this.enqueue(psuId, action, chunk);
            return { success: true, queued: true };
        }

        try {
            for (const chunk of chunks) await this.sendAction(psuId, action, chunk);
            if (action === 'delete') await this.finalizeDelete(psuId, uniqueIds);
            return { success: true, queued: false };
        } catch (error: any) {
            if (this.isApplicationError(error)) {
                await Promise.all([
                    this.saveCache(psuId, 'message', previousCache),
                    this.saveCounts(psuId, previousCounts)
                ]);
                return {
                    success: false,
                    queued: false,
                    message: error?.message || 'ไม่สามารถอัปเดตข้อความได้'
                };
            }

            for (const chunk of chunks) await this.enqueue(psuId, action, chunk);
            return { success: true, queued: true };
        }
    }

    async syncPending(psuId: string): Promise<void> {
        if (this.syncing || !this.isOnline() || !psuId) return;
        this.syncing = true;

        try {
            let queue = await this.getQueue(psuId);
            while (queue.length > 0 && this.isOnline()) {
                const pending = queue[0];
                try {
                    await this.sendAction(psuId, pending.action, pending.ids);
                    if (pending.action === 'delete') {
                        await this.finalizeDelete(psuId, pending.ids);
                    }
                    queue = queue.slice(1);
                    await this.saveQueue(psuId, queue);
                } catch (error) {
                    if (this.isApplicationError(error)) {
                        queue = queue.slice(1);
                        await this.saveQueue(psuId, queue);
                        continue;
                    }
                    break;
                }
            }
        } finally {
            this.syncing = false;
            this.syncCompleted.next();
        }
    }

    visibleItems(cache: MessageCache): MessageItem[] {
        return cache.items.filter(item => !item.pendingDelete);
    }

    private async fetchPage(
        psuId: string,
        type: MessageType,
        page: number,
        includeCounts: boolean
    ): Promise<{
        items: MessageItem[];
        total: number;
        hasMore: boolean;
        counts?: MessageCounts;
    }> {
        const response: MessagePageResponse = await this.ipsu.Ajax(
            this.ipsu.api + 'message-list.php',
            {
                psu_id: psuId,
                message_type: type,
                page,
                limit: this.pageSize,
                include_counts: includeCounts
            },
            false
        ) as MessagePageResponse;

        if (!response || response.status !== 'ok' || !Array.isArray(response.data)) {
            const error: any = new Error(response?.message || 'ไม่สามารถโหลดข้อความได้');
            error.application = true;
            throw error;
        }

        return {
            items: response.data.map(item => this.normalizeItem(item, type)),
            total: Math.max(0, Number(response.meta?.total) || 0),
            hasMore: !!response.meta?.has_more,
            counts: response.meta?.counts
                ? this.normalizeCounts(response.meta.counts)
                : undefined
        };
    }

    private async sendAction(psuId: string, action: MessageAction, ids: number[]): Promise<void> {
        const response: any = await this.ipsu.Ajax(
            this.ipsu.api + 'message-action.php',
            { psu_id: psuId, action, ids },
            false
        );
        if (!response || response.status !== 'ok') {
            const error: any = new Error(response?.message || 'ไม่สามารถอัปเดตข้อความได้');
            error.application = true;
            throw error;
        }
    }

    private applyPending(items: MessageItem[], counts: MessageCounts, queue: PendingMessageAction[]) {
        let nextItems = items.map(item => ({ ...item }));
        let nextCounts = { ...counts };
        for (const pending of queue) {
            const result = this.applyAction(nextItems, nextCounts, pending.action, pending.ids);
            nextItems = result.items;
            nextCounts = result.counts;
        }
        return { items: nextItems, counts: nextCounts };
    }

    private applyAction(
        items: MessageItem[],
        counts: MessageCounts,
        action: MessageAction,
        ids: number[]
    ): { items: MessageItem[]; counts: MessageCounts; affected: number } {
        const idSet = new Set(ids);
        let unreadReduction = 0;
        let affected = 0;
        const now = new Date().toISOString();

        const nextItems = items.map(item => {
            if (!idSet.has(item.id)) return item;
            affected += 1;
            const next = { ...item };

            if (action === 'read' && !next.isRead) {
                next.isRead = true;
                next.readWhen = now;
                unreadReduction += 1;
            } else if (action === 'save') {
                next.isSaved = true;
            } else if (action === 'unsave') {
                next.isSaved = false;
            } else if (action === 'delete' && !next.pendingDelete) {
                next.pendingDelete = true;
                if (!next.isRead) unreadReduction += 1;
            }
            return next;
        });

        return {
            items: nextItems,
            counts: {
                ...counts,
                message: Math.max(0, counts.message - unreadReduction)
            },
            affected
        };
    }

    private async finalizeDelete(psuId: string, ids: number[]) {
        const cache = await this.getCache(psuId, 'message');
        const idSet = new Set(ids);
        cache.items = cache.items.filter(item => !idSet.has(item.id));
        cache.loadedPages = Math.floor(cache.items.length / this.pageSize);
        cache.hasMore = cache.items.length < cache.total;
        cache.updatedAt = new Date().toISOString();
        await this.saveCache(psuId, 'message', cache);
    }

    private async enqueue(psuId: string, action: MessageAction, ids: number[]) {
        let queue = await this.getQueue(psuId);
        const idSet = new Set(ids);

        queue = queue
            .map(item => {
                const shouldReplace = action === 'delete'
                    || (['save', 'unsave'].includes(action) && ['save', 'unsave'].includes(item.action))
                    || (action === 'read' && item.action === 'read');
                if (!shouldReplace) return item;
                return { ...item, ids: item.ids.filter(id => !idSet.has(id)) };
            })
            .filter(item => item.ids.length > 0);

        queue.push({
            key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            action,
            ids,
            createdAt: new Date().toISOString()
        });
        await this.saveQueue(psuId, queue);
    }

    private async getQueue(psuId: string): Promise<PendingMessageAction[]> {
        const queue = await this.ipsu.GetStorage(this.queueKey(psuId));
        if (!Array.isArray(queue)) return [];
        return queue.filter(item =>
            item &&
            ['read', 'save', 'unsave', 'delete'].includes(item.action) &&
            Array.isArray(item.ids)
        );
    }

    private saveQueue(psuId: string, queue: PendingMessageAction[]) {
        return this.ipsu.SetStorage(this.queueKey(psuId), queue);
    }

    private saveCache(psuId: string, type: MessageType, cache: MessageCache) {
        return this.ipsu.SetStorage(this.cacheKey(psuId, type), cache);
    }

    private saveCounts(psuId: string, counts: MessageCounts) {
        this.ipsu.unreadMessageCount = counts.task + counts.alert + counts.message;
        return this.ipsu.SetStorage(this.countsKey(psuId), counts);
    }

    private normalizeItem(item: any, fallbackType: MessageType): MessageItem {
        return {
            id: Number(item.id),
            type: (item.type || fallbackType) as MessageType,
            title: item.title || '',
            detail: item.detail || '',
            sender: item.sender || item.user || '',
            addWhen: item.add_when || item.addWhen || '',
            readWhen: item.read_when || item.readWhen || '',
            isRead: item.is_read === true || item.isRead === true,
            isSaved: item.is_saved === true || item.isSaved === true,
            domain: item.domain || '',
            url: item.url || '',
            pendingDelete: item.pendingDelete === true
        };
    }

    private normalizeCounts(counts: any): MessageCounts {
        return {
            task: Math.max(0, Number(counts?.task) || 0),
            alert: Math.max(0, Number(counts?.alert) || 0),
            message: Math.max(0, Number(counts?.message) || 0)
        };
    }

    private uniqueItems(items: MessageItem[]): MessageItem[] {
        const seen = new Set<number>();
        return items.filter(item => {
            if (!item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    }

    private chunkIds(ids: number[]): number[][] {
        const chunks: number[][] = [];
        for (let index = 0; index < ids.length; index += 100) {
            chunks.push(ids.slice(index, index + 100));
        }
        return chunks;
    }

    private isApplicationError(error: any): boolean {
        return error?.application === true;
    }

    private emptyCache(): MessageCache {
        return {
            items: [],
            total: 0,
            loadedPages: 0,
            hasMore: false,
            updatedAt: ''
        };
    }

    private cacheKey(psuId: string, type: MessageType): string {
        return `ipsu-message-v2-${psuId}-${type}`;
    }

    private countsKey(psuId: string): string {
        return `ipsu-message-v2-${psuId}-counts`;
    }

    private queueKey(psuId: string): string {
        return `ipsu-message-v2-${psuId}-queue`;
    }
}
