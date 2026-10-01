import { Injectable } from '@angular/core';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { IpsuService } from './ipsu.service';

export type EboardPostEvent =
    | { type: 'create'; post: any }
    | { type: 'update'; post: any }
    | { type: 'remove'; id: number };

@Injectable({
    providedIn: 'root'
})
export class EboardService {
    readonly postMaxLength = 2000;
    readonly commentMaxLength = 500;
    readonly postEvents = new Subject<EboardPostEvent>();

    isAdmin = false;

    private clockOffset = 0;

    constructor(
        private ipsu: IpsuService,
        private modalController: ModalController,
        private actionSheetController: ActionSheetController,
    ) { }

    async Call(file: string, data: any = {}, loading = false): Promise<any> {
        if (!this.ipsu.auth.status) return { status: 'guest' };

        const auth = this.ipsu.auth;
        let res: any;
        try {
            res = await this.ipsu.Ajax(this.ipsu.api + file, {
                ...data,
                psu_id: auth.psu_id,
                username: auth.username,
                group: auth.group || auth.type || 'student',
                fullname_th: auth.fullname_th,
                fullname_en: auth.fullname_en,
            }, loading);
        } catch (e) {
            this.ipsu.ShowToast(this.ipsu.T('common.server_unavailable'));
            return { status: 'error' };
        }

        if (res?.server_time) this.SyncClock(res.server_time);
        return res || { status: 'error' };
    }

    ShowError(res: any) {
        if (!res || res.status !== 'no') return;
        const key = `eboard.error.${res.message}`;
        const text = this.ipsu.T(key);
        this.ipsu.ShowAlert(text === key ? this.ipsu.T('eboard.error.unknown') : text);
    }

    // ---------------------------------------------------------------------
    // Posts
    // ---------------------------------------------------------------------
    async List(beforeId = 0) {
        const res = await this.Call('eboard-list.php', { before_id: beforeId });
        if (res.status === 'ok') this.isAdmin = !!res.is_admin;
        return res;
    }

    Detail(postId: number) {
        return this.Call('eboard-post.php', { action: 'detail', post_id: postId });
    }

    async Save(post: { id?: number; content: string }) {
        const action = post.id ? 'edit' : 'create';
        const res = await this.Call('eboard-post.php', { action, post_id: post.id || 0, content: post.content }, true);
        if (res.status === 'ok' && res.post) {
            this.postEvents.next({ type: action === 'create' ? 'create' : 'update', post: res.post });
        } else {
            this.ShowError(res);
        }
        return res;
    }

    async ToggleLike(post: any) {
        const previous = { liked: post.liked, like_count: post.like_count };
        post.liked = !post.liked;
        post.like_count = Math.max(0, post.like_count + (post.liked ? 1 : -1));

        const res = await this.Call('eboard-like.php', { post_id: post.id });
        if (res.status === 'ok') {
            post.liked = !!res.liked;
            post.like_count = Number(res.like_count) || 0;
            this.postEvents.next({ type: 'update', post });
        } else {
            post.liked = previous.liked;
            post.like_count = previous.like_count;
            this.ShowError(res);
        }
    }

    async OpenPostMenu(post: any): Promise<void> {
        const buttons: any[] = [];
        if (post.can_edit) {
            buttons.push({ text: this.ipsu.T('eboard.edit'), icon: 'create-outline', data: 'edit' });
        }
        buttons.push({ text: this.ipsu.T('eboard.copy'), icon: 'copy-outline', data: 'copy' });
        if (this.isAdmin) {
            buttons.push({ text: this.ipsu.T(post.is_pinned ? 'eboard.unpin' : 'eboard.pin'), icon: 'pin-outline', data: 'pin' });
            buttons.push({ text: this.ipsu.T(post.status === 'hidden' ? 'eboard.unhide' : 'eboard.hide'), icon: 'eye-off-outline', data: 'hide' });
        }
        if (!post.is_owner && !post.reported) {
            buttons.push({ text: this.ipsu.T('eboard.report'), icon: 'flag-outline', data: 'report' });
        }
        if (post.can_delete) {
            buttons.push({ text: this.ipsu.T('eboard.delete'), icon: 'trash-outline', role: 'destructive', data: 'delete' });
        }
        buttons.push({ text: this.ipsu.T('common.cancel'), icon: 'close-outline', role: 'cancel' });

        const sheet = await this.actionSheetController.create({
            header: this.ipsu.T('eboard.menu_title'),
            cssClass: 'eboard-action-sheet',
            mode: 'ios',
            buttons,
        });
        await sheet.present();
        const { data } = await sheet.onWillDismiss();

        if (data === 'edit') await this.OpenCompose(post);
        if (data === 'copy') await this.CopyText(post.content);
        if (data === 'pin') await this.Moderate(post, 'pin', !post.is_pinned);
        if (data === 'hide') await this.Moderate(post, 'hide', post.status !== 'hidden');
        if (data === 'report') await this.Report(post);
        if (data === 'delete') await this.Delete(post);
    }

    async OpenCompose(post: any = null) {
        const { EboardComposeComponent } = await import('../eboard/eboard-compose/eboard-compose.component');
        const modal = await this.modalController.create({
            component: EboardComposeComponent,
            componentProps: { post },
            cssClass: 'eboard-compose-modal',
        });
        await modal.present();
        return modal.onDidDismiss();
    }

    private async Delete(post: any) {
        const ok = await this.ipsu.ShowConfirm(
            this.ipsu.T('eboard.delete_confirm'),
            this.ipsu.T('eboard.delete_title'),
            this.ipsu.T('eboard.delete'),
            this.ipsu.T('common.cancel'),
            true,
        );
        if (!ok) return;
        const res = await this.Call('eboard-post.php', { action: 'delete', post_id: post.id }, true);
        if (res.status === 'ok') {
            this.postEvents.next({ type: 'remove', id: post.id });
            this.ipsu.ShowToast(this.ipsu.T('eboard.deleted'));
        } else {
            this.ShowError(res);
        }
    }

    private async Report(post: any) {
        const ok = await this.ipsu.ShowConfirm(
            this.ipsu.T('eboard.report_confirm'),
            this.ipsu.T('eboard.report_title'),
            this.ipsu.T('eboard.report_button'),
            this.ipsu.T('common.cancel'),
            true,
        );
        if (!ok) return;
        const res = await this.Call('eboard-report.php', { post_id: post.id }, true);
        if (res.status === 'ok') {
            post.reported = true;
            if (res.hidden && !this.isAdmin) {
                this.postEvents.next({ type: 'remove', id: post.id });
            } else {
                this.postEvents.next({ type: 'update', post });
            }
            this.ipsu.ShowToast(this.ipsu.T(res.hidden ? 'eboard.reported_hidden' : 'eboard.reported'), 2500);
        } else {
            this.ShowError(res);
        }
    }

    private async Moderate(post: any, action: 'hide' | 'pin', value: boolean) {
        const res = await this.Call('eboard-post.php', { action, post_id: post.id, value }, true);
        if (res.status === 'ok' && res.post) {
            this.postEvents.next({ type: 'update', post: res.post });
            const key = action === 'pin'
                ? (value ? 'eboard.pinned_done' : 'eboard.unpinned_done')
                : (value ? 'eboard.hidden_done' : 'eboard.unhidden_done');
            this.ipsu.ShowToast(this.ipsu.T(key));
        } else {
            this.ShowError(res);
        }
    }

    private async CopyText(text: string) {
        try {
            await navigator.clipboard.writeText(text || '');
            this.ipsu.ShowToast(this.ipsu.T('eboard.copied'));
        } catch (e) {
            this.ShowError({ status: 'no', message: 'unknown' });
        }
    }

    // ---------------------------------------------------------------------
    // Comments
    // ---------------------------------------------------------------------
    Comments(postId: number) {
        return this.Call('eboard-comment.php', { action: 'list', post_id: postId });
    }

    async SaveComment(postId: number, content: string, commentId = 0) {
        const action = commentId ? 'edit' : 'create';
        const res = await this.Call('eboard-comment.php', { action, post_id: postId, comment_id: commentId, content });
        if (res.status !== 'ok') this.ShowError(res);
        return res;
    }

    async DeleteComment(comment: any) {
        const ok = await this.ipsu.ShowConfirm(
            this.ipsu.T('eboard.comment_delete_confirm'),
            this.ipsu.T('eboard.comment_delete_title'),
            this.ipsu.T('eboard.delete'),
            this.ipsu.T('common.cancel'),
            true,
        );
        if (!ok) return null;
        const res = await this.Call('eboard-comment.php', { action: 'delete', comment_id: comment.id }, true);
        if (res.status === 'ok') {
            this.ipsu.ShowToast(this.ipsu.T('eboard.comment_deleted'));
        } else {
            this.ShowError(res);
        }
        return res;
    }

    // ---------------------------------------------------------------------
    // Display helpers
    // ---------------------------------------------------------------------
    AuthorName(author: any): string {
        return this.ipsu.Localized(author, 'name') || '-';
    }

    AuthorInitial(author: any): string {
        const name = this.AuthorName(author).trim();
        return name ? Array.from(name)[0].toUpperCase() : '?';
    }

    AuthorImage(item: any): string {
        if (item?.is_owner && this.ipsu.auth.image) {
            const image = String(this.ipsu.auth.image);
            return image.startsWith('data:') || image.startsWith('http') ? image : `data:image/jpeg;base64,${image}`;
        }
        return item?.author?.image || '';
    }

    AvatarColor(author: any): string {
        const palette = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#db2777', '#dc2626', '#0891b2', '#4f46e5'];
        const name = this.AuthorName(author);
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
        return palette[hash % palette.length];
    }

    GroupLabel(group: string): string {
        return this.ipsu.T(group === 'staff' ? 'eboard.staff' : 'eboard.student');
    }

    TimeAgo(value: string): string {
        const time = this.ParseTime(value);
        if (!time) return '';
        const seconds = Math.max(0, Math.floor((Date.now() + this.clockOffset - time) / 1000));
        if (seconds < 60) return this.ipsu.T('eboard.just_now');
        if (seconds < 3600) return this.ipsu.T('eboard.minutes_ago', { count: Math.floor(seconds / 60) });
        if (seconds < 86400) return this.ipsu.T('eboard.hours_ago', { count: Math.floor(seconds / 3600) });
        if (seconds < 7 * 86400) return this.ipsu.T('eboard.days_ago', { count: Math.floor(seconds / 86400) });
        return new Intl.DateTimeFormat(this.ipsu.language === 'en' ? 'en-GB' : 'th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(new Date(time));
    }

    private SyncClock(serverTime: string) {
        const time = this.ParseTime(serverTime);
        if (time) this.clockOffset = time - Date.now();
    }

    private ParseTime(value: string): number {
        if (!value) return 0;
        const time = new Date(String(value).replace(' ', 'T')).getTime();
        return Number.isFinite(time) ? time : 0;
    }
}
