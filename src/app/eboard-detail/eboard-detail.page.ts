import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActionSheetController, IonContent, NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { IpsuService } from '../services/ipsu.service';
import { EboardPostEvent, EboardService } from '../services/eboard.service';

@Component({
    selector: 'app-eboard-detail',
    templateUrl: './eboard-detail.page.html',
    styleUrls: ['./eboard-detail.page.scss'],
    standalone: false,
})
export class EboardDetailPage implements OnInit, OnDestroy {
    @ViewChild(IonContent) content?: IonContent;
    @ViewChild('commentInput') commentInput?: ElementRef<HTMLTextAreaElement>;

    postId = 0;
    post: any = null;
    comments: any[] = [];
    isLoading = false;
    isSending = false;
    commentText = '';
    editingComment: any = null;

    private eventSub?: Subscription;

    constructor(
        public ipsu: IpsuService,
        public eboard: EboardService,
        private route: ActivatedRoute,
        private navCtrl: NavController,
        private actionSheetController: ActionSheetController,
    ) { }

    ngOnInit() {
        this.postId = Number(this.route.snapshot.paramMap.get('id')) || 0;
        this.eventSub = this.eboard.postEvents.subscribe(event => this.ApplyEvent(event));
    }

    ngOnDestroy() {
        this.eventSub?.unsubscribe();
    }

    ionViewWillEnter() {
        if (!this.ipsu.auth.status || !this.postId) {
            this.navCtrl.navigateRoot('/eboard');
            return;
        }
        this.LoadData();
    }

    get commentLength(): number {
        return Array.from(this.commentText.trim()).length;
    }

    get canSend(): boolean {
        return !this.isSending && this.commentLength > 0 && this.commentLength <= this.eboard.commentMaxLength;
    }

    async LoadData(refresher?: any) {
        this.isLoading = true;
        const [postRes, commentRes] = await Promise.all([
            this.eboard.Detail(this.postId),
            this.eboard.Comments(this.postId),
        ]);
        this.isLoading = false;
        refresher?.target?.complete();

        if (postRes.status === 'ok') {
            this.eboard.isAdmin = !!postRes.is_admin;
            this.post = postRes.post;
            this.comments = commentRes.status === 'ok' ? (commentRes.comments || []) : this.comments;
        } else if (postRes.status === 'no') {
            this.post = null;
            this.eboard.postEvents.next({ type: 'remove', id: this.postId });
            await this.ipsu.ShowAlert(this.ipsu.T('eboard.post_removed'));
            this.Back();
        }
    }

    Back() {
        if (window.history.length > 1) {
            this.navCtrl.back();
        } else {
            this.navCtrl.navigateRoot('/eboard');
        }
    }

    FocusComment() {
        this.commentInput?.nativeElement.focus();
    }

    AutoResize() {
        const el = this.commentInput?.nativeElement;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }

    async SendComment() {
        if (!this.canSend || !this.post) return;
        this.isSending = true;
        const editing = this.editingComment;
        const res = await this.eboard.SaveComment(this.post.id, this.commentText.trim(), editing?.id || 0);
        this.isSending = false;
        if (res.status !== 'ok') return;

        if (editing) {
            this.comments = this.comments.map(item => item.id === editing.id ? res.comment : item);
        } else {
            this.comments = [...this.comments, res.comment];
            this.post.comment_count = Number(res.comment_count) || this.comments.length;
            this.eboard.postEvents.next({ type: 'update', post: this.post });
            setTimeout(() => this.content?.scrollToBottom(300), 50);
        }
        this.CancelEdit();
    }

    async OpenCommentMenu(comment: any) {
        const buttons: any[] = [];
        if (comment.can_edit) buttons.push({ text: this.ipsu.T('eboard.edit'), icon: 'create-outline', data: 'edit' });
        buttons.push({ text: this.ipsu.T('eboard.copy'), icon: 'copy-outline', data: 'copy' });
        if (comment.can_delete) buttons.push({ text: this.ipsu.T('eboard.delete'), icon: 'trash-outline', role: 'destructive', data: 'delete' });
        buttons.push({ text: this.ipsu.T('common.cancel'), icon: 'close-outline', role: 'cancel' });

        const sheet = await this.actionSheetController.create({
            header: this.ipsu.T('eboard.comment_menu_title'),
            cssClass: 'eboard-action-sheet',
            mode: 'ios',
            buttons,
        });
        await sheet.present();
        const { data } = await sheet.onWillDismiss();

        if (data === 'edit') {
            this.editingComment = comment;
            this.commentText = comment.content;
            setTimeout(() => {
                this.AutoResize();
                this.FocusComment();
            }, 50);
        }
        if (data === 'copy') {
            try {
                await navigator.clipboard.writeText(comment.content || '');
                this.ipsu.ShowToast(this.ipsu.T('eboard.copied'));
            } catch (e) { }
        }
        if (data === 'delete') {
            const res = await this.eboard.DeleteComment(comment);
            if (res?.status === 'ok') {
                this.comments = this.comments.filter(item => item.id !== comment.id);
                this.post.comment_count = Number(res.comment_count) || 0;
                this.eboard.postEvents.next({ type: 'update', post: this.post });
                if (this.editingComment?.id === comment.id) this.CancelEdit();
            }
        }
    }

    CancelEdit() {
        this.editingComment = null;
        this.commentText = '';
        setTimeout(() => this.AutoResize(), 0);
    }

    TrackComment(_index: number, comment: any) {
        return comment.id;
    }

    private ApplyEvent(event: EboardPostEvent) {
        if (!this.post) return;
        if (event.type === 'remove' && event.id === this.post.id) {
            this.post = null;
            this.Back();
        } else if (event.type === 'update' && event.post.id === this.post.id && event.post !== this.post) {
            this.post = event.post;
        }
    }
}
