// @vitest-environment happy-dom

// A test of the component stores.jsx, with Vitest, @testing-library/react and happy-dom.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import Stores from '../stores.jsx';

// happy-dom has no WebGL, so the test replaces MapJr with a stub. The stub reads the props that the test checks, and
// its ref has `moveTo`, as the ref of MapJr has. The other exports of the adapter stay as they are.
const {moveTo} = vi.hoisted(() => ({moveTo: vi.fn()}));
vi.mock('@map-jr/map-jr-gl/react', async importOriginal => {
  const {forwardRef, useImperativeHandle} = await import('react');
  return {
    ...await importOriginal(),
    MapJr: forwardRef(function MapJr({data}, ref) {
      useImperativeHandle(ref, () => ({moveTo}));
      return <div data-testid="map" data-stores={data.stores.features.length} />;
    }),
  };
});

afterEach(cleanup);

describe('Stores', () => {
  it('gives the map a point for each store', () => {
    render(<Stores />);
    expect(screen.getByTestId('map').dataset.stores).toBe('3');
  });

  it('moves the map to a store on a click', () => {
    render(<Stores />);
    fireEvent.click(screen.getByRole('button', {name: 'Midtown'}));
    expect(moveTo).toHaveBeenCalledWith(expect.objectContaining({center: [-73.9857, 40.7484], zoom: 15}));
  });
});
