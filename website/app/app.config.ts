// The colours and the classes of the components of Nuxt UI. The scales `paper` and `survey` and the other tokens
// are in app/assets/css/main.css.
export default defineAppConfig({
    ui: {
        colors: {
            primary: 'survey',
            neutral: 'paper',
            secondary: 'sky',
            info: 'sky',
            success: 'emerald',
            warning: 'amber',
            error: 'rose',
        },
        header: {
            slots: {
                root: 'bg-default/85 border-accented',
                title: 'font-normal text-base items-center',
            },
        },
        navigationMenu: {
            slots: {
                link: 'font-medium',
            },
        },
        pageHeader: {
            slots: {
                root: 'border-accented py-10',
                headline: 'label-text font-medium',
                title: 'font-display font-medium tracking-tight text-4xl sm:text-5xl',
            },
        },
        contentNavigation: {
            slots: {
                trigger: 'label-text font-medium text-muted',
                listWithChildren: 'ms-0 border-s-0',
            },
        },
        contentToc: {
            slots: {
                container: 'lg:py-0 lg:my-8 legend-box',
                trigger: 'legend-title',
                link: 'legend-link',
                linkText: () => 'min-w-0 text-pretty',
                listWithChildren: 'legend-sublist',
            },
        },
        prose: {
            h2: {slots: {base: 'font-medium text-3xl mt-14 pb-2 border-b border-default'}},
            h3: {slots: {base: 'font-medium text-2xl'}},
            h4: {slots: {base: 'font-medium text-xl'}},
            pre: {slots: {base: 'bg-(--site-sheet) border-accented'}},
            code: {slots: {base: 'font-normal'}},
            th: {slots: {base: 'label-text font-medium text-muted normal-case tracking-wider'}},
        },
    },
});
