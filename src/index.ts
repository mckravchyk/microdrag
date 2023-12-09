import { Draggable, type Options } from './draggable';

import { ContainmentPlugin } from './plugins/containment';

import { getAbsLeft, getAbsTop } from './lib/dom';

import type { NonDragEvent, DragEvent } from './events';

import type { ContainmentOptions } from './plugins/containment';

// TODO: This, together with DOM utility functions and anything else that could be used for plugin
// development should be exported to a special subpath.
import { computeRelativeBoxArea } from './plugins/util';

export {
  Draggable,
  // TODO: Plugins, if possible, should be exported to their own subpath so they are excluded from
  // the main bundle by default.
  ContainmentPlugin,
  getAbsLeft,
  getAbsTop,
};

export type {
  Options,
  NonDragEvent,
  DragEvent,
  ContainmentOptions,
  computeRelativeBoxArea,
};
