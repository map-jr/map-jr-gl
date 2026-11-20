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
                // The height that the browser shows, without its toolbars (`dvh`). With `vh`, the end of a long list
                // was below the toolbar of Safari on iOS and could not be reached (#1312).
                root: 'max-h-[calc(100dvh-var(--ui-header-height))]',
                container: 'lg:py-0 lg:my-8 legend-box',
                trigger: 'legend-title',
                link: 'legend-link',
                linkText: () => 'min-w-0 text-pretty',
                listWithChildren: 'legend-sublist',
                // On a phone, the list of entries leaves at once when it closes, so that useTocActive can scroll to
                // the chosen heading in the next frame (#1311).
                content: 'data-[state=closed]:animate-none',
            },
        },
        prose: {
            h2: {slots: {base: 'font-medium text-3xl mt-14 pb-2 border-b border-default'}},
            h3: {slots: {base: 'font-medium text-2xl'}},
            h4: {slots: {base: 'font-medium text-xl'}},
            // A code block never wraps its lines (#1250). The site formats the code to the width of the screen
            // (build/format.mjs); a line that is still longer scrolls sideways. The code is as wide as its longest
            // line, so that the background of a highlighted line reaches the end of the scroll.
            pre: {slots: {base: 'bg-(--site-sheet) border-accented whitespace-pre wrap-normal *:[code]:inline-block *:[code]:min-w-full'}},
            code: {slots: {base: 'font-normal'}},
            th: {slots: {base: 'label-text font-medium text-muted normal-case tracking-wider'}},
        },
    },
});
