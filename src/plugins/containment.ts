import type { DragEvent, DraggablePlugin } from '../events';

import { deepClone } from '../lib/deep_clone';

import {
  getClientHeight,
  getClientWidth,
  getClientX,
  getClientY,
  getWindowHeight,
  getWindowWidth,
} from '../lib/dom';

type Box = {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ContainmentOptions {
  /**
   * The reference container for the containment edges.
   *
   * Note that the containment works on a coordinate system relative to the edge of the viewport. If
   * the container has overflow scroll, it does not have an effect - only its rendered dimensions
   * matter as the element is not dragged within container's coordinate system.
   */
  container: HTMLElement | 'viewport'

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

// TODO: The same idea as with the snap plugin could apply - accept a rectangle and add a function
// to calculate it based on the reference element + edges.

/**
 * Sets up a containment area which dragged elements cannot move past.
 */
export class ContainmentPlugin implements DraggablePlugin<'DragStart' | 'Position'> {
  public priority = {
    DragStart: 10,
    Position: 10,
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

  public constructor(options: ContainmentOptions) {
    const defaultEdges = {
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
    };

    this.options = deepClone(options);
    this.containerEdges = this.options.edges ? deepClone(this.options.edges) : defaultEdges;
  }

  public onDragStart = (e: DragEvent): void => {
    let left: number;
    let top: number;
    let right: number;
    let bottom: number;

    const windowWidth = getWindowWidth(); // @domRead
    const windowHeight = getWindowHeight();// @domRead

    let containerWidth: number;
    let containerHeight: number;
    let containerX = 0;
    let containerY = 0;

    if (this.options.container === 'viewport') {
      containerWidth = windowWidth;
      containerHeight = windowHeight;
    }
    else {
      containerWidth = getClientWidth(this.options.container); // @domRead
      containerHeight = getClientHeight(this.options.container); // @domRead
      containerX = getClientX(this.options.container);
      containerY = getClientY(this.options.container);
    }

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
      left = containerX + this.containerEdges.left;
    }
    else {
      left = containerY + Math.abs(this.containerEdges.left) - e.activeElementWidth;
    }

    if (this.containerEdges.top >= 0) {
      top = containerY + this.containerEdges.top;
    }
    else {
      top = containerY + Math.abs(this.containerEdges.top) - e.activeElementHeight;
    }

    if (this.containerEdges.right >= 0) {
      right = containerWidth + containerX - e.activeElementWidth - this.containerEdges.right;
    }
    else {
      right = containerX + containerWidth - Math.abs(this.containerEdges.right);
    }

    if (this.containerEdges.bottom >= 0) {
      bottom = containerHeight + containerY - e.activeElementHeight - this.containerEdges.bottom;
    }
    else {
      bottom = containerY + containerHeight - Math.abs(this.containerEdges.bottom);
    }

    // FIXME: Containment needs to be re-calculated on resize and scroll.
    this.containment = {
      top,
      right,
      bottom,
      left,
    };
  };

  public filterPosition = (event: DragEvent): [number, number] | false => {
    if (this.containment === null) {
      return false;
    }

    let x = event.elementX;
    let y = event.elementY;

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
}
