import type { DragEvent, DraggablePlugin } from '../events';

import { deepClone } from '../lib/deep_clone';

import { isAncestor } from '../lib/dom';
import { computeRelativeBoxArea } from './util';

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
   * Defines the position of the snap edge relative to the `edgesBase` edges. If not set, the offset
   * is 0.
   */
  offset?: number
}

export interface SnapOptions extends Thresholds {
  /**
   * An element which edges serve as the reference / base for the snap edges that together with
   * offsets form the snap edges. If not set, this is the reference frame.
   */
  edgesBase?: HTMLElement | 'viewport'

  /**
   * Configuration for each edge:
   * - If not set, the default is { top: 0, right: 0, bottom: 0, left: 0}
   * - If set, only the edges defined will have snap active.
   * - `number` stands for the `offset` and is the short syntax that can be used if edge-specific
   * threshold configuration is not required. The default value for offset is `0` and must
   * be set in order for snap to be enabled for the edge.
   */
  // FIXME: Consider using 0 by default and require explicit false to disable an edge
  edges?: {
    top?: number /* offset */ | EdgeOptions
    right?: number /* offset */ | EdgeOptions
    bottom?: number /* offset */ | EdgeOptions
    left?: number /* offset */ | EdgeOptions
  }
  // ^ It could be a Record but it's more readable this way
}

type Edge = 'top' | 'right' | 'bottom' | 'left';

export const DEFAULT_SNAP_THRESHOLD = 10;

// TODO: Recalculate on screen resize.

/**
 * Sets up a box to which edges the dragged element will snap (jump) to when approaching them.
 *
 * To define multiple snap boxes, initialize and add a plugin for each box.
 */
export class SnapPlugin implements DraggablePlugin<'DragStart' | 'Position' | 'RefFrameScroll'> {
  public priority = {
    DragStart: 10,
    Position: 10,
    RefFrameScroll: 10,
  };

  private options: SnapOptions;

  private edgeOptions: Exclude<SnapOptions['edges'], undefined>;

  private thresholds: Partial<Record<Edge, Required<Thresholds>>> = { };

  /**
   * Snap edges (the x or the y coordinate depending on the edge) of the edge. Note that the right
   * and bottom edges are shifted (decreased) by elements width and height respectively in order to
   * simplify the comparison calculation on drag.
   */
  private edges: Partial<Record<Edge, number>> = { };

  private needsEdgesRecompute = false;

  public constructor(options: SnapOptions) {
    this.options = deepClone(options);

    // eslint-disable-next-line object-curly-newline
    this.edgeOptions = this.options.edges || { top: 0, right: 0, bottom: 0, left: 0 };

    for (const edge of Object.keys(this.edgeOptions)) {
      this.thresholds[edge as Edge] = this.computeThreshold(edge as Edge);
    }
  }

  // Exists because of a limitation of the plugin API of not being able to access the Draggable
  // instance and its options.
  private getSnapBase(e: DragEvent): HTMLElement | 'viewport' {
    return this.options.edgesBase || e.refFrame;
  }

  /**
   * Schedules edges to be recomputed mid-drag just before the position filter is applied. It
   * should be called when the position of `snapBase` changes relative to the ref frame while
   * dragging in scenarios which are not covered by default.
   *
   * Note that if it's known that the edges shifted by a certain amount, `shiftEdges` should be
   * used instead for much better performance.
   *
   * Currently by default containment is recaluclated automatically on the scroll event of the ref
   * frame if the containment is an ancestor of the ref frame and on screen resize - other scenarios
   * need to be handled manually by either calling this method or `shiftEdges`.
   */
  public scheduleEdgesRecompute() {
    this.needsEdgesRecompute = true;
  }

  /**
   * Shifts snap edges by (x, y) - while dragging, prefer it over full recompute whenever possible.
   */
  public shiftEdges(x: number, y: number): void {
    if (typeof this.edges.left !== 'undefined') {
      this.edges.left += x;
    }

    if (typeof this.edges.right !== 'undefined') {
      this.edges.right += x;
    }

    if (typeof this.edges.top !== 'undefined') {
      this.edges.top += y;
    }

    if (typeof this.edges.bottom !== 'undefined') {
      this.edges.bottom += y;
    }
  }

  public onDragStart = (e: DragEvent): void => {
    this.computeEdges(e);
  };

  public onRefFrameScroll = (e: DragEvent) => {
    const snapBase = this.getSnapBase(e);

    // With ref frame scroll, the only scenario where the position of the edges changes relative
    // to the reframe is when it's the ref frame's ancestor - the snap box will not move together
    // with the frame when it's outside of it. However, if it's inside, it's going to move together
    // with the frame so it's position does not change relative to the ref frame.
    if (
      e.refFrame !== this.getSnapBase(e)
      && (snapBase === 'viewport' || isAncestor(snapBase, e.refFrame as HTMLElement))
    ) {
      this.shiftEdges(e.refScrollLeftDelta, e.refScrollTopDelta);
    }
  };

  public filterPosition = (event: DragEvent): [number, number] | false => {
    if (this.needsEdgesRecompute) {
      this.computeEdges(event);
    }

    let x = event.draggedX;
    let y = event.draggedY;

    if (typeof this.edges.left !== 'undefined' && (
      (x >= this.edges.left && x - this.edges.left <= this.thresholds.left!.threshold)
      || (x < this.edges.left && this.edges.left - x <= this.thresholds.left!.outerThreshold)
    )) {
      x = this.edges.left!;
    }
    else if (typeof this.edges.right !== 'undefined' && (
      (x <= this.edges.right && this.edges.right - x <= this.thresholds.right!.threshold)
      || (x > this.edges.right && x - this.edges.right <= this.thresholds.right!.outerThreshold)
    )) {
      x = this.edges.right;
    }

    if (typeof this.edges.top !== 'undefined' && (
      (y >= this.edges.top && y - this.edges.top <= this.thresholds.top!.threshold)
      || (y < this.edges.top && this.edges.top - y <= this.thresholds.top!.outerThreshold)
    )) {
      y = this.edges.top;
    }
    else if (typeof this.edges.bottom !== 'undefined' && (
      (y <= this.edges.bottom && this.edges.bottom - y <= this.thresholds.bottom!.threshold)
      || (y > this.edges.bottom && y - this.edges.bottom <= this.thresholds.bottom!.outerThreshold)
    )) {
      y = this.edges.bottom;
    }

    return [x, y];
  };

  private getEdgeOffset(edge: Edge): number {
    const option = this.edgeOptions[edge];

    if (typeof option === 'undefined') {
      throw new Error(`Trying to calculate coord for a disabled edge: ${edge}`);
    }

    return typeof option === 'object' ? (option.offset || 0) : option;
  }

  private computeEdges(e: DragEvent): void {
    // eslint-disable-next-line object-curly-newline, max-len
    const { x, y, width, height } = computeRelativeBoxArea(this.getSnapBase(e), e.refFrame, e.refX, e.refY);

    const left = x + this.getEdgeOffset('left');
    const top = y + this.getEdgeOffset('top');
    const right = x + width - e.activeElementWidth - this.getEdgeOffset('right');
    const bottom = y + height - e.activeElementHeight - this.getEdgeOffset('bottom');

    this.edges = { top, left, right, bottom }; // eslint-disable-line object-curly-newline

    this.needsEdgesRecompute = false;
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
