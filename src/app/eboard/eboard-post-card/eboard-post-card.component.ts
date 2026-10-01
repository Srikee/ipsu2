import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { IpsuService } from '../../services/ipsu.service';
import { EboardService } from '../../services/eboard.service';

@Component({
    selector: 'app-eboard-post-card',
    templateUrl: './eboard-post-card.component.html',
    styleUrls: ['./eboard-post-card.component.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule],
})
export class EboardPostCardComponent {
    @Input() post: any;
    @Input() full = false;
    @Output() open = new EventEmitter<any>();

    constructor(public ipsu: IpsuService, public eboard: EboardService) { }

    get isLong(): boolean {
        const content = String(this.post?.content || '');
        return content.length > 170 || content.split('\n').length > 4;
    }

    OpenPost() {
        if (!this.full) this.open.emit(this.post);
    }

    ToggleLike(event: Event) {
        event.stopPropagation();
        this.eboard.ToggleLike(this.post);
    }

    OpenMenu(event: Event) {
        event.stopPropagation();
        this.eboard.OpenPostMenu(this.post);
    }
}
