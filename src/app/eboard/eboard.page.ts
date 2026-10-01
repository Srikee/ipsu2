import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, ModalController, NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { IpsuService } from '../services/ipsu.service';
import { EboardPostEvent, EboardService } from '../services/eboard.service';
import { LoginPage } from '../login/login.page';

@Component({
    selector: 'app-eboard',
    templateUrl: './eboard.page.html',
    styleUrls: ['./eboard.page.scss'],
    standalone: false,
})
export class EboardPage implements OnInit, OnDestroy {
    @ViewChild(IonContent) content?: IonContent;

    pinned: any[] = [];
    posts: any[] = [];
    hasMore = false;
    isLoading = false;
    isLoaded = false;

    private loadedUser = '';
    private requestId = 0;
    private eventSub?: Subscription;

    constructor(
        public ipsu: IpsuService,
        public eboard: EboardService,
        private router: Router,
        private modalController: ModalController,
        private navCtrl: NavController,
    ) { }

    ngOnInit() {
        this.eventSub = this.eboard.postEvents.subscribe(event => this.ApplyEvent(event));
    }

    ngOnDestroy() {
        this.eventSub?.unsubscribe();
    }

    ionViewWillEnter() {
        this.PageEnter();
    }

    async PageEnter() {
        if (this.ipsu.auth.status) {
            const user = String(this.ipsu.auth.psu_id || this.ipsu.auth.username);
            if (user !== this.loadedUser || !this.isLoaded) {
                this.Reset();
                this.loadedUser = user;
                this.LoadFeed();
            }
            return;
        }

        this.Reset();
        this.ipsu.SetStorage('ipsu-callback', '/eboard');
        const rs = await this.ipsu.ShowConfirm(this.ipsu.T('eboard.login_required'));
        if (rs) {
            const modal = await this.modalController.create({ component: LoginPage });
            modal.onWillDismiss().then(() => this.PageEnter());
            return await modal.present();
        }
        this.navCtrl.navigateBack('/tabs/home');
    }

    get allPosts(): any[] {
        return [...this.pinned, ...this.posts];
    }

    Reset() {
        this.pinned = [];
        this.posts = [];
        this.hasMore = false;
        this.isLoaded = false;
        this.loadedUser = '';
    }

    async LoadFeed(refresher?: any) {
        const requestId = ++this.requestId;
        this.isLoading = true;
        const res = await this.eboard.List();
        if (requestId !== this.requestId) return;

        this.isLoading = false;
        refresher?.target?.complete();
        if (res.status === 'ok') {
            this.pinned = res.pinned || [];
            this.posts = res.posts || [];
            this.hasMore = !!res.has_more;
            this.isLoaded = true;
        } else if (res.status === 'no') {
            this.eboard.ShowError(res);
        }
    }

    async LoadMore(event: any) {
        const last = this.posts[this.posts.length - 1];
        if (!this.hasMore || !last) {
            event.target.complete();
            return;
        }
        const requestId = this.requestId;
        const res = await this.eboard.List(last.id);
        event.target.complete();
        if (requestId !== this.requestId || res.status !== 'ok') return;

        const known = new Set(this.posts.map(post => post.id));
        this.posts = [...this.posts, ...(res.posts || []).filter((post: any) => !known.has(post.id))];
        this.hasMore = !!res.has_more;
    }

    Refresh() {
        if (!this.isLoading) this.LoadFeed();
    }

    OpenPost(post: any) {
        this.router.navigate(['/eboard', post.id]);
    }

    async Compose() {
        const result = await this.eboard.OpenCompose();
        if (result?.data?.post) this.content?.scrollToTop(300);
    }

    TrackPost(_index: number, post: any) {
        return post.id;
    }

    private ApplyEvent(event: EboardPostEvent) {
        if (event.type === 'remove') {
            this.pinned = this.pinned.filter(post => post.id !== event.id);
            this.posts = this.posts.filter(post => post.id !== event.id);
            return;
        }

        const post = event.post;
        if (event.type === 'create') {
            this.posts = [post, ...this.posts];
            return;
        }

        const others = (list: any[]) => list.filter(item => item.id !== post.id);
        const wasListed = this.allPosts.some(item => item.id === post.id);
        if (!wasListed) return;

        if (post.is_pinned) {
            this.posts = others(this.posts);
            this.pinned = this.pinned.some(item => item.id === post.id)
                ? this.pinned.map(item => item.id === post.id ? post : item)
                : [post, ...this.pinned];
        } else {
            const wasPinned = this.pinned.some(item => item.id === post.id);
            this.pinned = others(this.pinned);
            this.posts = wasPinned
                ? [...this.posts, post].sort((a, b) => b.id - a.id)
                : this.posts.map(item => item.id === post.id ? post : item);
        }
    }

    async PromptLogin() {
        this.ipsu.SetStorage('ipsu-callback', '/eboard');
        const modal = await this.modalController.create({ component: LoginPage });
        modal.onWillDismiss().then(() => this.PageEnter());
        return await modal.present();
    }
}
