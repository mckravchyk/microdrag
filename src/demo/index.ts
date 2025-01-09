import {
  Microdrag,
  ContainmentPlugin,
  SnapPlugin,
  RefScrollPlugin,
} from 'microdrag';

import { createLogger } from './logger';

/* eslint-disable no-new */

createLogger();

Microdrag.addGlobalStyles();

const useCompositing = false;

// Draggables positioned relative to the viewport
new Microdrag({
  target: [
    document.getElementById('Draggable-F1')!,
    document.getElementById('Draggable-F2')!,
    document.getElementById('Draggable-F3')!,
  ],
  useCompositing,
  plugins: [
    new SnapPlugin({
      threshold: 10,
      edgesBase: 'viewport',
    }),
    new ContainmentPlugin({
      container: 'viewport',
    }),
  ],
});

// Draggables in the reference frame of the body
new Microdrag({
  target: {
    element: document.getElementById('DraggablesB')!,
    delegateSelector: '.Draggable',
  },
  refFrame: document.body,
  useCompositing,
  plugins: [
    new SnapPlugin({
      threshold: 10,
    }),
    new ContainmentPlugin(),
    new RefScrollPlugin(),
  ],
});

// A draggable using body as the reference frame but setting containment and snap on the viewport
new Microdrag({
  target: {
    element: document.getElementById('DraggablesC')!,
    delegateSelector: '.Draggable',
  },
  refFrame: document.body,
  useCompositing,
  plugins: [
    new SnapPlugin({
      threshold: 10,
      edgesBase: 'viewport',
    }),
    new ContainmentPlugin({
      container: 'viewport',
    }),
  ],
});

// A draggable using a scrollable container (other than body) as the reference frame
new Microdrag({
  target: {
    element: document.getElementById('DraggablesD')!,
    delegateSelector: '.Draggable',
  },
  refFrame: document.getElementById('DraggablesD')!,
  useCompositing,
  plugins: [
    new SnapPlugin({
      threshold: 10,
    }),
    new ContainmentPlugin(),
    new RefScrollPlugin(),
  ],
});
