// The reader's choice of a variant of the code or of a package manager (website/build/variants.ts). Each set has its
// own choice, which holds for every group of that set on the site and is kept in `localStorage`.
//
// The first paint does not wait for this state. The script in the head of the page sets the attribute of each set on
// <html> (`data-variant`, `data-package-manager`), every variant of a group is in the HTML, and CSS
// (app/assets/css/main.css, "Code variants") shows the variant whose list of choices names that value. This state
// starts as null on the server and on the client, so that hydration matches, and app/plugins/code-variant.client.ts
// sets it after hydration. It then drives what CSS cannot: `aria-selected`, the focus and the marks of the menu.
import {codeSet, variantOfSlug, type VariantSet} from '~~/build/variants';

export function useCodeVariant(set: VariantSet = codeSet) {
    const choice = useState<string | null>(`code-variant-${set.id}`, () => null);

    function choose(slug: string) {
        if (!variantOfSlug(slug, set)) return;
        choice.value = slug;
        document.documentElement.setAttribute(set.attribute, slug);
        try { localStorage.setItem(set.key, slug); } catch { /* the storage can be blocked: the choice holds for this page */ }
    }

    return {choice, choose};
}
