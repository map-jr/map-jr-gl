// The one entry of the table of contents ("On this page") that is active: the section that the reader is in.
//
// The scroll-spy of `UContentToc` marks every heading that is on the screen (#1251). This composable picks one id
// instead, and the page gives that entry the active classes through the `class` of its link. The entry is:
// - the last heading whose top is above the place where a link to a heading puts it (its `scroll-margin-top`, which
//   is below the sticky header), plus a small offset;
// - the first heading while the reader is above it;
// - the last heading at the end of the page, when the last section is too short to reach that place.
// After a click on an entry, that entry stays active until the reader scrolls again.
//
// `open` is the state of the list of entries on a phone, where it opens above the page. A choice of an entry closes
// it (#1311).
//
// The id is null on the server and until the page is mounted, so that hydration matches and a page without
// JavaScript has no highlight.
type TocLink = {id: string; children?: TocLink[]};

const offset = 8;

export function useTocActive(links: () => TocLink[] | undefined) {
    const active = ref<string | null>(null);
    const open = ref(false);
    let held: string | null = null;
    let frame = 0;

    const ids = () => {
        const flat = (list: TocLink[]): string[] => list.flatMap(link => [link.id, ...flat(link.children ?? [])]);
        return flat(links() ?? []);
    };

    function update() {
        frame = 0;
        if (held) { active.value = held; return; }
        const headings = ids().map(id => document.getElementById(id)).filter((element): element is HTMLElement => !!element);
        if (!headings.length) { active.value = null; return; }
        const root = document.documentElement;
        if (window.scrollY > 0 && window.scrollY + window.innerHeight >= root.scrollHeight - 2) {
            active.value = headings[headings.length - 1]!.id;
            return;
        }
        let current = headings[0]!;
        for (const heading of headings) {
            const line = (parseFloat(getComputedStyle(heading).scrollMarginTop) || 0) + offset;
            if (heading.getBoundingClientRect().top > line) break;
            current = heading;
        }
        active.value = current.id;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    // A scroll that the reader starts ends the hold of a click; the scroll of the click itself does not.
    const release = () => { if (held) { held = null; schedule(); } };
    function choose(id: string) {
        held = id;
        active.value = id;
        if (!open.value) return;
        // The open list is in the flow above the page, so closing it moves the heading. A browser without scroll
        // anchoring (Safari before 27) leaves the heading above the screen: scroll to it again once the list is gone.
        open.value = false;
        nextTick(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView()));
    }

    const releaseEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    onMounted(() => {
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule, {passive: true});
        for (const name of releaseEvents) window.addEventListener(name, release, {passive: true});
        update();
    });
    onBeforeUnmount(() => {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        for (const name of releaseEvents) window.removeEventListener(name, release);
        if (frame) cancelAnimationFrame(frame);
    });
    // Another page of the same layout keeps this component: start again from its headings.
    watch(links, () => { held = null; nextTick(schedule); });

    return {active, open, choose};
}
