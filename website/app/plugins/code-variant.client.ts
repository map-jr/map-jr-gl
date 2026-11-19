// Gives the state of each set of variants (app/composables/useCodeVariant.ts) the value that the script in the head
// set, once the page is hydrated, and follows a choice made in another tab.
import {variantOfSlug, variantSets} from '~~/build/variants';

export default defineNuxtPlugin((nuxtApp) => {
    for (const set of variantSets) {
        const {choice} = useCodeVariant(set);
        nuxtApp.hook('app:suspense:resolve', () => {
            const slug = document.documentElement.getAttribute(set.attribute);
            if (variantOfSlug(slug, set)) choice.value = slug;
        });
        window.addEventListener('storage', (event) => {
            if (event.key !== set.key || !variantOfSlug(event.newValue, set)) return;
            choice.value = event.newValue;
            document.documentElement.setAttribute(set.attribute, event.newValue!);
        });
    }
});
