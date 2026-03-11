/**
 * Manages navigation between different application views
 */
export class NavigationManager {
    constructor() {
        this.currentView = 'sim';
        this.pages = {
            sim: document.getElementById('nav-simulation'),
            cells: document.getElementById('nav-cells'),
            est: document.getElementById('nav-estimation'),
            business: document.getElementById('nav-business')
        };

        this.views = {
            workspace: document.querySelector('.workspace-wrapper'),
            estimation: document.getElementById('estimation-page'),
            business: document.getElementById('business-view'),
            sidebar: document.getElementById('sidebar-panel'),
            cellsSidebar: document.getElementById('cells-sidebar-panel')
        };

        this.subTabs = {
            plans: { btn: document.getElementById('subnav-plans'), page: document.getElementById('plans-page') },
            costs: { btn: document.getElementById('subnav-costs'), page: document.getElementById('costs-page') },
            quote: { btn: document.getElementById('subnav-quote'), page: document.getElementById('quote-page') }
        };
    }

    /**
     * Activates a specific page or sub-page
     */
    setActivePage(pageId) {
        // Reset actives
        Object.values(this.pages).forEach(b => b?.classList.remove('active'));
        Object.values(this.subTabs).forEach(st => {
            st.btn?.classList.remove('active');
            st.page?.classList.add('hidden');
        });

        // Hide all main containers
        Object.values(this.views).forEach(v => v?.classList.add('hidden'));

        if (['sim', 'cells'].includes(pageId)) {
            this.pages[pageId]?.classList.add('active');
            this.views.workspace?.classList.remove('hidden');
            if (pageId === 'sim') this.views.sidebar?.classList.remove('hidden');
            else this.views.cellsSidebar?.classList.remove('hidden');
        } else if (pageId === 'est') {
            this.pages.est?.classList.add('active');
            this.views.estimation?.classList.remove('hidden');
        } else if (['plans', 'costs', 'quote'].includes(pageId)) {
            this.pages.business?.classList.add('active');
            this.views.business?.classList.remove('hidden');
            this.subTabs[pageId].btn?.classList.add('active');
            this.subTabs[pageId].page?.classList.remove('remove'); // Note: index.html might use 'hidden'
            this.subTabs[pageId].page?.classList.remove('hidden');
        }

        this.currentView = pageId;
    }
}
