import { Draggable, type Options } from './draggable';

import { ContainmentPlugin } from './plugins/containment';

import { getClientX, getClientY } from './lib/dom';

import type { NonDragEvent, DragEvent } from './events';

import type { ContainmentOptions } from './plugins/containment';

export {
  Draggable,
  ContainmentPlugin,
  getClientX,
  getClientY,
};

export type {
  Options,
  NonDragEvent,
  DragEvent,
  ContainmentOptions,
};
