import { SnapPlugin } from 'src/plugins/snap';
import { ContainmentPlugin, Draggable } from 'xydrag';
import { createLogger } from './logger';

/* eslint-disable no-new */

createLogger();

Draggable.addGlobalStyles();

new Draggable({
  target: document.getElementById('Draggable-1-1')!,
  plugins: [
    new SnapPlugin({
      threshold: 20,
      edges: {
        top: 0,
        right: { offset: 200, threshold: 40, outerThreshold: 100 },
        bottom: 30,
        left: 40,
      },
    }),
  ],
});

new Draggable({
  target: document.getElementById('Draggable-1-2')!,
  plugins: [
    new SnapPlugin({
      threshold: 10,
    }),
    new ContainmentPlugin({
      container: 'viewport',
    }),
  ],
});

new Draggable({
  target: [
    document.getElementById('Draggable-A1')!,
    document.getElementById('Draggable-A2')!,
    document.getElementById('Draggable-A3')!,
    // {
    //   target: document.getElementById('DraggablesB')!,
    //   delegateSelector: '.Draggable',
    // },
  ],
  plugins: [
    new SnapPlugin({
      threshold: 10,
    }),
    new ContainmentPlugin({
      container: document.body,
    }),
  ],
});

new Draggable({
  target: {
    element: document.getElementById('DraggablesB')!,
    delegateSelector: '.Draggable',
  },
  plugins: [
    new SnapPlugin({
      threshold: 10,
    }),
    new ContainmentPlugin({
      container: 'viewport',
    }),
  ],
});
