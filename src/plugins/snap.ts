import type { DragEvent, DraggablePlugin } from '../events';

import { deepClone } from '../util/deep_clone';

import {
  getWindowHeight,
  getWindowWidth,
} from '../util/dom';

interface Thresholds {
  /**
   * The maximum distance of the element's edge to the snap edge in which the element snaps. If not
   * set, the default is used.
   */
  threshold?: number

  /**
   * Optionally define a different snap threshold when the element is dragged on the outside of the
   * snap box. If not set, `threshold` will be used on both inner and outer approaches.
   */
  outerThreshold?: number
}

interface EdgeOptions extends Thresholds {
  /**
   * Distance of the snap edge from the edge of the snap box (the window by default). If
   * not set, the offset is 0 (the snap box's edge is the snap edge).
   */
  offset?: number
}

export interface SnapOptions extends Thresholds {
  /**
   * Configuration of each edge:
   * - If not set, the default is { top: 0, right: 0, bottom: 0, left: 0}
   * - If set, only the edges defined will have snap active.
   * - `number` stands for the `offset` and is the short syntax that can be used if edge-specific
   * threshold configuration is not required. The default value for offset is `0` and must
   * be set in order for snap to be enabled for the edge.
   */
  edges?: {
    top?: number /* offset */ | EdgeOptions
    right?: number /* offset */ | EdgeOptions
    bottom?: number /* offset */ | EdgeOptions
    left?: number /* offset */ | EdgeOptions
  }
  // ^ It could be a Record but it's more readable this way

  // TODO: Add an option to use an HTML element as a reference for the snap edges. Also, consider
  // an option that allows to define a box that can be relative to the window or relative to the
  // body (moves with scroll). Name this option `snapBox`

  // TODO: With the above implemented, consider simplifying it, eliminate `offset` and make the
  // plugin accept a snap box (top, right, bottom, left) and create a helper function that creates
  // a snap box from an Element container, with optional offsets. However, it would also need to be
  // a callback that creates the snap box actually, so it can be re-computed on scroll / resize.
  // In such configuration, simplified edges would define thresholds and explicit false would be
  // required to disable an edge rather than not setting it.
}

type Edge = 'top' | 'right' | 'bottom' | 'left';

export const DEFAULT_SNAP_THRESHOLD = 10;

/**
 * Sets up a box to which edges the dragged element will snap (jump) to when approaching them.
 *
 * To define multiple snap boxes, initialize and add a plugin for each box.
 */
export class SnapPlugin implements DraggablePlugin<'DragStart' | 'Position'> {
  public priority = {
    DragStart: 10,
    Position: 10,
  };

  private options: SnapOptions;

  private edgeOptions: Exclude<SnapOptions['edges'], undefined>;

  private thresholds: Partial<Record<Edge, Required<Thresholds>>> = { };

  /**
   * Snap edges (the x or the y coordinate depending on the edge) of the edge. Note that the right
   * and bottom edges are shifted (decreased) by elements width and height respectively in order to
   * simplify the comparison calculation on drag.
   */
  private snap: Partial<Record<Edge, number>> = { };

  public constructor(options: SnapOptions) {
    this.options = deepClone(options);

    this.edgeOptions = this.options.edges || { };

    for (const edge of Object.keys(this.edgeOptions)) {
      this.thresholds[edge as Edge] = this.computeThreshold(edge as Edge);
    }
  }

  public onDragStart = (e: DragEvent): void => {
    // FIXME: Make this available in event props
    const elementWidth = e.draggedElement.offsetWidth; // @domRead
    const elementHeight = e.draggedElement.offsetHeight;// @domRead

    // FIXME: This probably needs to be re-calculated on window resize and scroll. (yes, window
    // can resize while a pointer is active).
    for (const edge of Object.keys(this.edgeOptions)) {
      this.snap[edge as Edge] = this.computeEdge(edge as Edge, elementWidth, elementHeight);
    }
  };

  public filterPosition = (event: DragEvent): [number, number] | false => {
    let x = event.elementX;
    let y = event.elementY;

    if (typeof this.snap.left !== 'undefined' && (
      (x >= this.snap.left && x - this.snap.left <= this.thresholds.left!.threshold)
      || (x < this.snap.left && this.snap.left - x <= this.thresholds.left!.outerThreshold)
    )) {
      x = this.snap.left!;
    }
    else if (typeof this.snap.right !== 'undefined' && (
      (x <= this.snap.right && this.snap.right - x <= this.thresholds.right!.threshold)
      || (x > this.snap.right && x - this.snap.right <= this.thresholds.right!.outerThreshold)
    )) {
      x = this.snap.right;
    }

    if (typeof this.snap.top !== 'undefined' && (
      (y >= this.snap.top && y - this.snap.top <= this.thresholds.top!.threshold)
      || (y < this.snap.top && this.snap.top - y <= this.thresholds.top!.outerThreshold)
    )) {
      y = this.snap.top;
    }
    else if (typeof this.snap.bottom !== 'undefined' && (
      (y <= this.snap.bottom && this.snap.bottom - y <= this.thresholds.bottom!.threshold)
      || (y > this.snap.bottom && y - this.snap.bottom <= this.thresholds.bottom!.outerThreshold)
    )) {
      y = this.snap.bottom;
    }

    return [x, y];
  };

  private computeEdge(edge: Edge, eWidth: number, eHeight: number): number {
    const option = this.edgeOptions[edge];

    if (typeof option === 'undefined') {
      throw new Error(`Trying to calculate coord for a disabled edge: ${edge}`);
    }

    const base = typeof option === 'object' ? (option.offset || 0) : option;

    if (edge === 'top' || edge === 'left') {
      return base;
    }

    if (edge === 'right') {
      return getWindowWidth() - eWidth - base;
    }

    return getWindowHeight() - eHeight - base;
  }

  private computeThreshold(edge: Edge): Required<Thresholds> {
    const edgeOptions = this.edgeOptions[edge];

    // There's no snap in this case and it's not expected for this function to get called.
    if (typeof edgeOptions === 'undefined') {
      return { threshold: 0, outerThreshold: 0 };
    }

    if (typeof edgeOptions === 'number') {
      return { threshold: DEFAULT_SNAP_THRESHOLD, outerThreshold: DEFAULT_SNAP_THRESHOLD };
    }

    const threshold = typeof edgeOptions.threshold !== 'undefined'
      ? edgeOptions.threshold : DEFAULT_SNAP_THRESHOLD;

    const outerThreshold = typeof edgeOptions.outerThreshold !== 'undefined'
      ? edgeOptions.outerThreshold : threshold;

    return { threshold, outerThreshold };
  }
}
