import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { IpsuService } from '../../services/ipsu.service';
import { EboardService } from '../../services/eboard.service';

@Component({
    selector: 'app-eboard-compose',
    templateUrl: './eboard-compose.component.html',
    styleUrls: ['./eboard-compose.component.scss'],
    standalone: true,
    imports: [CommonModule, FormsModule, IonicModule],
})
export class EboardComposeComponent implements OnInit, AfterViewInit {
    @Input() post: any = null;
    @Input() modal?: HTMLIonModalElement;
    @ViewChild('textarea') textarea?: ElementRef<HTMLTextAreaElement>;

    content = '';
    isSaving = false;

    private originalContent = '';

    constructor(
        public ipsu: IpsuService,
        public eboard: EboardService,
        private modalController: ModalController,
    ) { }

    ngOnInit() {
        this.content = this.post?.content || '';
        this.originalContent = this.content;

        if (this.modal) this.modal.canDismiss = (_data?: any, role?: string) => this.CanDismiss(role);
    }

    ngAfterViewInit() {
        setTimeout(() => this.textarea?.nativeElement.focus(), 350);
    }

    get isEdit(): boolean {
        return !!this.post?.id;
    }

    get length(): number {
        return Array.from(this.content.trim()).length;
    }

    get isOverLimit(): boolean {
        return this.length > this.eboard.postMaxLength;
    }

    get canSubmit(): boolean {
        return !this.isSaving && this.length > 0 && !this.isOverLimit && this.isDirty;
    }

    get isDirty(): boolean {
        return this.content.trim() !== this.originalContent.trim();
    }

    get myAuthor(): any {
        return { name_th: this.ipsu.auth.fullname_th, name_en: this.ipsu.auth.fullname_en };
    }

    async Submit() {
        if (!this.canSubmit) return;
        this.isSaving = true;
        const res = await this.eboard.Save({ id: this.post?.id, content: this.content.trim() });
        this.isSaving = false;
        if (res.status === 'ok') {
            this.ipsu.ShowToast(this.ipsu.T(this.isEdit ? 'eboard.saved' : 'eboard.posted'));
            await this.modalController.dismiss({ post: res.post }, 'saved');
        }
    }

    Close() {
        this.modalController.dismiss(null, 'cancel');
    }

    private async CanDismiss(role?: string): Promise<boolean> {
        if (role === 'saved' || !this.isDirty || this.content.trim() === '') return true;
        return !!(await this.ipsu.ShowConfirm(
            this.ipsu.T('eboard.discard_confirm'),
            this.ipsu.T('eboard.discard_title'),
            this.ipsu.T('eboard.discard_button'),
            this.ipsu.T('eboard.keep_editing'),
            true,
        ));
    }
}
