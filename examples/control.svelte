<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {navigation, custom} from '@map-jr/map-jr-gl/controls';

  const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
  let current = $state(0);
  // The element of the control. The map moves it into its corner once the element exists. (The <div> around it stays
  // where it is, so that Svelte finds its own elements when it removes the component.)
  let button = $state(null);
  // A change is a new description. The map finds what is different.
  const description = $derived({
    style: `https://styles.map-jr.org/1/${styles[current]}.json`,
    initialView: {center: [-74.0065, 40.7085], zoom: 13},
    attribution: {compact: true},
    // `key` names the control: the map keeps it while the list has a control with this key.
    controls: button ? [navigation(), custom({key: 'next-style', position: 'top-left', element: button})] : [navigation()],
  });
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
<p>Style: {styles[current]}</p>
<div hidden>
  <button bind:this={button} class="next" onclick={() => current = (current + 1) % styles.length}>Next style</button>
</div>

<style>
  .next { padding: 6px 12px; border: 0; border-radius: 16px; background: #fff; color: #222; font: 13px system-ui, sans-serif; box-shadow: 0 1px 4px #0004; cursor: pointer; }
</style>
