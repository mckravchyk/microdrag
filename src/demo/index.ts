import { ContainmentPlugin, Draggable } from 'xydrag';

/* eslint-disable no-new */

Draggable.addGlobalStyles();

new Draggable({
  element: document.getElementById('Draggable-1-1')!,
});

new Draggable({
  element: document.getElementById('Draggable-1-2')!,
  plugins: [
    new ContainmentPlugin({
      container: 'viewport',
    }),
  ],
});
