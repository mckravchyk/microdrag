import { SnapPlugin } from 'src/plugins/snap';
import { ContainmentPlugin, Draggable } from 'xydrag';

/* eslint-disable no-new */

Draggable.addGlobalStyles();

new Draggable({
  element: document.getElementById('Draggable-1-1')!,
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
  element: document.getElementById('Draggable-1-2')!,
  plugins: [
    new SnapPlugin({
      threshold: 10,
    }),
    new ContainmentPlugin({
      container: 'viewport',
    }),
  ],
});
