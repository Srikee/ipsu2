import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ItemReorderEventDetail, NavController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';

@Component({
    selector: 'app-quick-menu',
    templateUrl: './quick-menu.page.html',
    styleUrls: ['./quick-menu.page.scss'],
    standalone: false,
})
export class QuickMenuPage {
    public ipsu = inject(IpsuService);
    private router = inject(Router);
    private navController = inject(NavController);

    readonly maxSelected = 8;
    isLoading = true;
    isSaving = false;
    sections: any[] = [];
    selectedMenus: any[] = [];

    private get optionsCacheKey(): string {
        return this.ipsu.UserStorageKey('ipsu-quick-menu', 'options');
    }

    private get selectedCacheKey(): string {
        return this.ipsu.UserStorageKey('ipsu-quick-menu', 'selected');
    }

    async ionViewWillEnter() {
        if (!this.ipsu.auth.status) {
            await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
            return;
        }

        this.isLoading = true;
        const [cachedSections, cachedSelected] = await Promise.all([
            this.ipsu.GetStorage(this.optionsCacheKey),
            this.ipsu.GetStorage(this.selectedCacheKey),
        ]);

        if (Array.isArray(cachedSections)) {
            this.sections = cachedSections;
        }
        if (Array.isArray(cachedSelected)) {
            this.selectedMenus = cachedSelected.slice(0, this.maxSelected);
        }

        await this.loadOptions();
    }

    async loadOptions() {
        try {
            const response: any = await this.ipsu.Ajax(this.ipsu.api + 'information-quick-menu.php', {
                action: 'options',
                psu_id: this.ipsu.auth.psu_id,
                group: this.ipsu.auth.group || this.ipsu.auth.type,
            }, false);

            if (response?.status !== 'ok' || !Array.isArray(response.sections)) {
                throw new Error('Invalid quick menu response');
            }

            this.sections = response.sections;
            const allMenus = this.sections.flatMap((section: any) => section.items || []);
            const menuById = new Map(allMenus.map((item: any) => [Number(item.id), item]));
            this.selectedMenus = (response.selected_ids || [])
                .map((id: any) => menuById.get(Number(id)))
                .filter((item: any) => !!item)
                .slice(0, this.maxSelected);

            await Promise.all([
                this.ipsu.SetStorage(this.optionsCacheKey, this.sections),
                this.ipsu.SetStorage(this.selectedCacheKey, this.selectedMenus),
            ]);
        } catch (e) {
            if (this.sections.length === 0) {
                this.ipsu.ShowToast(this.ipsu.T('quick_menu.load_failed'), 2200);
            }
        } finally {
            this.isLoading = false;
        }
    }

    isSelected(menuId: number): boolean {
        return this.selectedMenus.some(item => Number(item.id) === Number(menuId));
    }

    selectedOrder(menuId: number): number {
        return this.selectedMenus.findIndex(item => Number(item.id) === Number(menuId)) + 1;
    }

    toggleMenu(item: any) {
        const index = this.selectedMenus.findIndex(menu => Number(menu.id) === Number(item.id));
        if (index >= 0) {
            this.selectedMenus.splice(index, 1);
            this.selectedMenus = [...this.selectedMenus];
            return;
        }

        if (this.selectedMenus.length >= this.maxSelected) {
            this.ipsu.ShowToast(this.ipsu.T('quick_menu.maximum_reached', { count: this.maxSelected }), 2000);
            return;
        }

        this.selectedMenus = [...this.selectedMenus, item];
    }

    removeMenu(menuId: number) {
        this.selectedMenus = this.selectedMenus.filter(item => Number(item.id) !== Number(menuId));
    }

    reorderSelected(event: CustomEvent<ItemReorderEventDetail>) {
        this.selectedMenus = event.detail.complete(this.selectedMenus);
    }

    cancel() {
        this.navController.navigateBack('/tabs/home');
    }

    async save() {
        if (this.isSaving) return;
        this.isSaving = true;

        try {
            const response: any = await this.ipsu.Ajax(this.ipsu.api + 'information-quick-menu.php', {
                action: 'save',
                psu_id: this.ipsu.auth.psu_id,
                group: this.ipsu.auth.group || this.ipsu.auth.type,
                menu_ids: this.selectedMenus.map(item => Number(item.id)),
            }, false);

            if (response?.status !== 'ok' || !Array.isArray(response.items)) {
                throw new Error('Unable to save quick menus');
            }

            this.selectedMenus = response.items;
            this.ipsu.quickMenuItems = [...this.selectedMenus];
            await this.ipsu.SetStorage(this.selectedCacheKey, this.selectedMenus);
            this.ipsu.ShowToast(this.ipsu.T('quick_menu.saved'), 1600);
            await this.navController.navigateBack('/tabs/home');
        } catch (e) {
            this.ipsu.ShowAlert(this.ipsu.T('quick_menu.save_failed'));
        } finally {
            this.isSaving = false;
        }
    }
}
