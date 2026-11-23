<!--
  A road shield of the styles of map-jr/map-jr-styles, drawn as the map draws it: the SVG template of the shape (a copy of
  shields/<shape>.svg of that repository) with its slots filled, stretched around the route number in the columns that
  `icon-text-fit` stretches (`SHAPES` of shields/shields.mjs). The other columns keep their width, so the points at the top
  of a US Highway shield and the crown of an Interstate shield keep their form.
-->
<script setup lang="ts">
const shapes = {
    us_interstate: {width: 22, height: 22, stretch: [[5, 8], [14, 17]], content: [5.6, 8.6, 16.4, 18.2], font: 7.2,
        svg: '<defs><clipPath id="ID"><path d="M2.6 3.9c2.9.9 5.8.5 8.400-1.300 2.600 1.800 5.500 2.200 8.400 1.300 1.400 6.600-.9 12.600-8.400 16.100C3.500 16.500 1.200 10.500 2.600 3.900z"/></clipPath></defs><path d="M1.500 2.200C4.900 3.500 8.100 3 11 .8c2.900 2.200 6.100 2.700 9.500 1.400 2 8-.6 15.200-9.500 19C2.100 17.400-.5 10.200 1.500 2.200z" fill="{{border}}"/><g clip-path="url(#ID)"><path d="M0 0h22v22H0z" fill="{{background}}"/><path d="M0 0h22v7.300H0z" fill="{{color}}"/><path d="M0 7.300h22v.9H0z" fill="{{border}}"/></g>'},
    us_highway: {width: 22, height: 20, stretch: [[9.2, 10.4], [11.6, 12.8]], content: [5.5, 3, 16.5, 15], font: 7.6,
        svg: '<path d="M3.600 1c1.300 1.200 3.500 1.200 4.700 0h5.400c1.200 1.200 3.400 1.200 4.700 0l2.200 2.200c-1.500 2.300-1.300 5.100 0 7.300 1.100 3.700-1.500 6.500-5.600 6.900-1.900.2-3.300.8-4 1.800-.7-1-2.100-1.600-4-1.800-4.100-.4-6.700-3.200-5.600-6.900 1.300-2.200 1.500-5 0-7.300z" fill="{{background}}" stroke="{{border}}" stroke-width="1.300" stroke-linejoin="round"/>'},
    pill: {width: 22, height: 16, stretch: [[9, 13]], content: [5.5, 2, 16.5, 14], font: 7.6,
        svg: '<rect x=".75" y=".75" width="20.5" height="14.5" rx="7.25" fill="{{background}}" stroke="{{border}}" stroke-width="1.5"/>'},
    hex: {width: 24, height: 16, stretch: [[8, 16]], content: [6, 2, 18, 14], font: 7.6,
        svg: '<path d="M5.5.75h13L23.25 8l-4.750 7.250h-13L.75 8z" fill="{{background}}" stroke="{{border}}" stroke-width="1.5" stroke-linejoin="round"/>'},
    rect: {width: 20, height: 16, stretch: [[5, 15]], content: [4, 2, 16, 14], font: 7.6,
        svg: '<rect x=".75" y=".75" width="18.5" height="14.5" rx="3" fill="{{background}}" stroke="{{border}}" stroke-width="1.5"/>'},
};
const props = defineProps<{shape: keyof typeof shapes; text: string; background: string; border: string; color?: string; textColor: string; fontFamily: string}>();
const uid = useId();

// The slices of the template from left to right, and where each one is drawn. A slice of a stretch column gets its share of the
// width that the number needs beyond the content box.
const drawn = computed(() => {
    const shape = shapes[props.shape];
    const needed = props.text.length * shape.font * 0.6;
    const extra = Math.max(0, needed - (shape.content[2]! - shape.content[0]!));
    const edges = [0, ...shape.stretch.flat(), shape.width];
    let x = 0;
    const slices = edges.slice(0, -1).map((from, index) => {
        const width = edges[index + 1]! - from, grows = index % 2 === 1;
        const slice = {from, width, x, drawnWidth: width + (grows ? extra / shape.stretch.length : 0)};
        x += slice.drawnWidth;
        return slice;
    });
    const fill = (name: string, value: string) => (text: string) => text.replaceAll(`{{${name}}}`, value);
    const markup = [fill('background', props.background), fill('border', props.border), fill('color', props.color ?? props.background)].reduce((text, apply) => apply(text), shape.svg);
    return {shape, slices, width: x, markup, textX: shape.content[0]! + (shape.content[2]! - shape.content[0]! + extra) / 2, textY: (shape.content[1]! + shape.content[3]!) / 2};
});
</script>

<template>
  <svg :viewBox="`0 0 ${drawn.width} ${drawn.shape.height}`" :width="drawn.width * 2.4" :height="drawn.shape.height * 2.4" role="img" :aria-label="`Road shield ${text}`" class="home-shield-svg">
    <!-- eslint-disable vue/no-v-html -- the template of this file with colors of the page, not input -->
    <svg
      v-for="(slice, index) in drawn.slices" :key="index" :x="slice.x - (index ? 0.04 : 0)" y="0" :width="slice.drawnWidth + (index ? 0.04 : 0)" :height="drawn.shape.height"
      :viewBox="`${slice.from} 0 ${slice.width} ${drawn.shape.height}`" preserveAspectRatio="none" v-html="drawn.markup.replaceAll('ID', `${uid}-${index}`)"
    />
    <!-- eslint-enable vue/no-v-html -->
    <text :x="drawn.textX" :y="drawn.textY" text-anchor="middle" dominant-baseline="central" :font-size="drawn.shape.font" font-weight="700" :fill="textColor" :style="{fontFamily}">{{ text }}</text>
  </svg>
</template>

<style>
.home-shield-svg { display: block; overflow: visible; filter: drop-shadow(0 0 0.5px rgb(0 0 0 / 0.45)); }
</style>
