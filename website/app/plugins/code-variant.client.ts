// Gives the state of the variant (app/composables/useCodeVariant.ts) the value that the script in the head set, once
// the page is hydrated, and follows a choice made in another tab.
import {variantKey, variantOfSlug} from '~~/build/variants';

export default defineNuxtPlugin((nuxtApp) => {
    const {choice} = useCodeVariant();
    nuxtApp.hook('app:suspense:resolve', () => {
        const slug = document.documentElement.getAttribute('data-variant');
        if (variantOfSlug(slug)) choice.value = slug;
    });
    window.addEventListener('storage', (event) => {
        if (event.key !== variantKey || !variantOfSlug(event.newValue)) return;
        choice.value = event.newValue;
        document.documentElement.setAttribute('data-variant', event.newValue!);
    });
});
