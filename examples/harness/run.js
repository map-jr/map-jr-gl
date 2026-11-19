// The harness page: examples/run.html?id=<example>&form=<form> runs one form of one example and nothing else. The
// tests and scripts/screenshots.mjs open this page, so they do not depend on the page that shows the examples to
// visitors.
//
// The page has the same elements as a row of the gallery: <article id="<example>"> with the map in `.map > .live`, the
// line of text of the example in `.readout` and its buttons in `.actions`. When the map exists, it is
// `window.maps[<example>]`. When the example cannot run, `window.exampleError` is the message.
import {configure} from '@map-jr/map-jr-gl';
import {mount} from './mount.js';

const query = new URLSearchParams(location.search), id = query.get('id') ?? '', form = query.get('form') ?? 'core';
// Add &renderer=main (or worker) to the address to choose where the map is drawn.
configure({renderer: query.get('renderer') ?? 'auto'});

const article = document.createElement('article');
article.id = id;
article.innerHTML = '<div class="map"><div class="live"></div></div><div class="readout"></div><div class="actions"></div>';
const readout = article.querySelector('.readout');
document.body.append(article);
document.title = `${id} (${form})`;
mount(id, form, {stage: article.querySelector('.live'), actions: article.querySelector('.actions'), out: text => { readout.textContent = text; }})
    .then(map => { (window.maps ||= {})[id] = map; }, err => { window.exampleError = readout.textContent = String(err.message); console.error(err); });
