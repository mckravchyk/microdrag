import { getAbsOffset } from './lib/dom';

// TODO: This, together with DOM utility functions and anything else that could be used for plugin
// development should be exported to a special subpath.
import { computeRelativeBoxArea } from './plugins/util';

import { Draggable, type Options } from './draggable';
import type { NonDragEvent, DragEvent, DraggablePlugin } from './events';

import { ContainmentPlugin, type ContainmentOptions } from './plugins/containment';
import { SnapPlugin, type SnapOptions } from './plugins/snap';
import { RefScrollPlugin, type RefScrollOptions } from './plugins/ref_scroll';

export {
  Draggable,

  type Options,
  type NonDragEvent,
  type DragEvent,

  // TODO: Plugins, if possible, should be exported to their own subpath so they are excluded from
  // the main bundle by default.

  type DraggablePlugin,

  ContainmentPlugin,
  type ContainmentOptions,

  SnapPlugin,
  type SnapOptions,

  RefScrollPlugin,
  type RefScrollOptions,

  getAbsOffset,
  computeRelativeBoxArea,
};
