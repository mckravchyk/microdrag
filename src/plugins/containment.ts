import type { DragEvent, DraggablePlugin } from '../events';

import { deepClone } from '../lib/deep_clone';

import { isAncestor } from '../lib/dom';
import { computeRelativeBoxArea } from './util';

interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ContainmentOptions {
  /**
   * The reference of the containment that together with edges forms the containment. If not set,
   * this is the drag frame of reference.
   */
  container?: HTMLElement | 'viewport'

  /**
   * Edge offsets relative to the container's edges that define the containment.
   *
   * - If the edges are not defined, each edge has a value of 0
   *
   * - If the number is non-negative, this is the distance from the container's edge.
   *
   * - If the number is negative, the dragged element can go past the boundary until only x
   * pixels of it are visible, x being the absolute value of the boundary edge value. I.e. - if
   * the right boundary is set to -30px, the element can be dragged all the way right until only
   * 30px of it on its left side are within the container.
   */
  edges?: Box
}

// TODO: Recalculate on screen resize.

/**
 * Sets up a containment area which dragged elements cannot move past.
 */
export class ContainmentPlugin implements DraggablePlugin<'DragStart' | 'Position' | 'RefFrameScroll'> {
  public priority = {
    DragStart: 10,
    Position: 10,
    RefFrameScroll: 10,
  };

  private options: ContainmentOptions;

  /**
   * Edges relative to the container, as defined in the options.
   */
  private containerEdges: Box;

  /**
   * Edges relative to the viewport.
   */
  private containment: Box | null = null;

  private needsContainmentRecompute = false;

  public constructor(options: ContainmentOptions = {}) {
    const defaultEdges = {
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
    };

    this.options = deepClone(options);
    this.containerEdges = this.options.edges ? deepClone(this.options.edges) : defaultEdges;
  }

  // Exists because of a limitation of the plugin API of not being able to access the Draggable
  // instance and its options.
  private getContainer(e: DragEvent): HTMLElement | 'viewport' {
    return this.options.container || e.refFrame;
  }

  /**
   * Schedules containment to be recomputed mid-drag just before the position filter is applied. It
   * should be called when the position of `container changes relative to the frame of reference
   * while dragging in scenarios which are not covered by default.
   *
   * Note that if it's known that the containment shifted by a certain amount, `shiftContainment`
   * should be used instead for much better performance.
   *
   * Currently by default containment is recaluclated automatically on the scroll event of the ref
   * frame if the containment is an ancestor of the ref frame and on screen resize - other scenarios
   * need to be handled manually by either calling this method or `shiftContainment`.
   */
  public scheduleContainmentRecompute() {
    this.needsContainmentRecompute = true;
  }

  /**
   * Shifts snap edges by (x, y) - while dragging, prefer it over full recompute whenever possible.
   */
  public shiftContainment(x: number, y: number): void {
    if (this.containment) {
      this.containment.left += x;
      this.containment.right += x;
      this.containment.top += y;
      this.containment.bottom += y;
    }
  }

  public onDragStart = (e: DragEvent): void => {
    // Always recompute on drag start
    this.computeContainment(e);
  };

  public onRefFrameScroll = (e: DragEvent) => {
    const container = this.getContainer(e);

    // With ref frame scroll, the only scenario where the position of the container changes relative
    // to the reframe is when it's the ref frame's ancestor - the container will not move together
    // with the frame when it's outside of it. However, if it's inside, it's going to move together
    // with the frame so it's position does not change relative to the ref frame.
    if (
      e.refFrame !== this.getContainer(e)
      && (container === 'viewport' || isAncestor(container, e.refFrame as HTMLElement))
    ) {
      this.shiftContainment(e.refScrollLeftDelta, e.refScrollTopDelta);
    }
  };

  public filterPosition = (event: DragEvent): [number, number] | false => {
    if (this.containment === null) {
      return false;
    }

    if (this.needsContainmentRecompute) {
      this.computeContainment(event);
    }

    let x = event.draggedX;
    let y = event.draggedY;

    if (x < this.containment.left) {
      x = this.containment.left;
    }
    else if (x > this.containment.right) {
      x = this.containment.right;
    }

    if (y < this.containment.top) {
      y = this.containment.top;
    }
    else if (y > this.containment.bottom) {
      y = this.containment.bottom;
    }

    return [x, y];
  };

  private computeContainment(e: DragEvent) {
    // eslint-disable-next-line object-curly-newline, max-len
    const { x, y, width, height } = computeRelativeBoxArea(this.getContainer(e), e.refFrame, e.refX, e.refY);

    let left: number;
    let top: number;
    let right: number;
    let bottom: number;

    // A note about container edges < 0
    //
    // If a boundary is negative, it allows the element to go past the boundary edge
    // The element can go as deep as x pxs from the opposite side of the element
    //
    // For example, if the right boundary is set to -100px, the element
    // can be dragged past the right edge all the way until 100px of the element's
    // left side is still visible

    // The below equations can be easily understood with a drawing of the situation. Edges
    // for left and top, right and bottom are calculated in the same way, respectively.

    if (this.containerEdges.left >= 0) {
      left = x + this.containerEdges.left;
    }
    else {
      left = y + Math.abs(this.containerEdges.left) - e.activeElementWidth;
    }

    if (this.containerEdges.top >= 0) {
      top = y + this.containerEdges.top;
    }
    else {
      top = y + Math.abs(this.containerEdges.top) - e.activeElementHeight;
    }

    if (this.containerEdges.right >= 0) {
      right = width + x - e.activeElementWidth - this.containerEdges.right;
    }
    else {
      right = x + width - Math.abs(this.containerEdges.right);
    }

    if (this.containerEdges.bottom >= 0) {
      bottom = height + y - e.activeElementHeight - this.containerEdges.bottom;
    }
    else {
      bottom = y + height - Math.abs(this.containerEdges.bottom);
    }

    this.containment = {
      top,
      right,
      bottom,
      left,
    };

    this.needsContainmentRecompute = false;
  }
}
