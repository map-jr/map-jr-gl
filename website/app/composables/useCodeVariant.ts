// The reader's choice of the variant of the code (website/build/variants.ts). It holds for every group of the site
// and is kept in `localStorage`.
//
// The first paint does not wait for this state. The script in the head of the page sets `data-variant` on <html>,
// every variant of a group is in the HTML, and CSS (app/assets/css/main.css, "Code variants") shows the variant
// whose `data-shows` names that value. This state starts as null on the server and on the client, so that
// hydration matches, and app/plugins/code-variant.client.ts sets it after hydration. It then drives what CSS
// cannot: `aria-selected`, the focus and the marks of the menu.
import {variantKey, variantOfSlug} from '~~/build/variants';

export function useCodeVariant() {
    const choice = useState<string | null>('code-variant', () => null);

    function choose(slug: string) {
        if (!variantOfSlug(slug)) return;
        choice.value = slug;
        document.documentElement.setAttribute('data-variant', slug);
        try { localStorage.setItem(variantKey, slug); } catch { /* the storage can be blocked: the choice holds for this page */ }
    }

    return {choice, choose};
}
