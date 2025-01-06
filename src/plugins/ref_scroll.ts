import type { DragEvent, DraggablePlugin } from '../events';

import {
  getScrollHeight,
  getScrollWidth,
  updateScrollLeft,
  updateScrollTop,
} from '../lib/dom';

export interface RefScrollOptions {
  /**
   * The threshold distance from the container boundary to start scrolling.
   */
  threshold?: number;

  /**
   * The amount of pixels to scroll per interval.
   */
  scrollAmount?: number;

  /**
   * The interval in milliseconds to scroll.
   */
  scrollInterval?: number;
}

export const DEFAULT_SCROLL_THRESHOLD = 30;

export const DEFAULT_SCROLL_AMOUNT = 10;

export const DEFAULT_SCROLL_INTERVAL = 100;

/**
 * Enables scrolling the reference container when the dragged element approaches its boundary.
 * Requires the `refFrame` option defined on the Draggable instance.
 */
export class RefScrollPlugin implements DraggablePlugin<'DragStart' | 'Drag' | 'DragEnd'> {
  public priority = {
    DragStart: 10,
    Drag: 10,
    DragEnd: 10,
  };

  private options: Required<RefScrollOptions>;

  private scrollLeftInterval: NodeJS.Timeout | null = null;

  private scrollTopInterval: NodeJS.Timeout | null = null;

  private container: HTMLElement | null = null;

  private canScrollX = false;

  private canScrollY = false;

  public constructor(options: ScrollOptions = {}) {
    this.options = {
      threshold: DEFAULT_SCROLL_THRESHOLD,
      scrollAmount: DEFAULT_SCROLL_AMOUNT,
      scrollInterval: DEFAULT_SCROLL_INTERVAL,
      ...options,
    };
  }

  public onDragStart = (e: DragEvent): void => {
    this.canScrollX = e.refFrame !== 'viewport' && getScrollWidth(e.refFrame) > e.refWidth;
    this.canScrollY = e.refFrame !== 'viewport' && getScrollHeight(e.refFrame) > e.refHeight;
    this.container = this.canScrollX || this.canScrollY ? e.refFrame as HTMLElement : null;
  };

  public onDrag = (e: DragEvent): void => {
    if (!this.container) {
      return;
    }

    let scrollLeftDelta = 0;
    let scrollTopDelta = 0;

    // Note: Pointer coordinates are relative to the frame of reference. The calculations make more
    // sense when you imagine absolute pointer coordinates (absPointerX = pointerX + refX) and +
    // refX on the other side of the comparison (cancels out). Also the container is scrollable,
    // pointer is relative to the container so if it's scrolled down for instance, pointerX will
    // be bigger by that scrollTop and it has to be balanced out on the other side of the equation.

    if (this.canScrollX) {
      // Checking if the element's left edge crosses the left boundary
      if (e.pointerX - e.deltaX < e.refScrollLeft + this.options.threshold) {
        scrollLeftDelta = -1 * this.options.scrollAmount;
      }
      // Right edge crosses the right boundary
      // eslint-disable-next-line max-len
      else if (e.pointerX + e.draggedWidth - e.deltaX > e.refWidth + e.refScrollLeft - this.options.threshold) {
        scrollLeftDelta = this.options.scrollAmount;
      }
    }

    if (this.canScrollY) {
      // Top edge crosses the top boundary
      if (e.pointerY - e.deltaY < e.refScrollTop + this.options.threshold) {
        scrollTopDelta = -1 * this.options.scrollAmount;
      }
      // Bottom edge crosses the bottom boundary
      // eslint-disable-next-line max-len
      else if (e.pointerY + e.draggedHeight - e.deltaY > e.refHeight + e.refScrollTop - this.options.threshold) {
        scrollTopDelta = this.options.scrollAmount;
      }
    }

    if (scrollLeftDelta !== 0) {
      if (this.scrollLeftInterval === null) {
        this.scrollLeftInterval = setInterval(() => {
          updateScrollLeft(this.container!, scrollLeftDelta);
        });
      }
    }
    else if (this.scrollLeftInterval !== null) {
      clearInterval(this.scrollLeftInterval);
      this.scrollLeftInterval = null;
    }

    if (scrollTopDelta !== 0) {
      if (this.scrollTopInterval === null) {
        this.scrollTopInterval = setInterval(() => {
          updateScrollTop(this.container!, scrollTopDelta);
        });
      }
    }
    else if (this.scrollTopInterval !== null) {
      clearInterval(this.scrollTopInterval);
      this.scrollTopInterval = null;
    }
  };

  public onDragEnd = (): void => {
    if (this.scrollLeftInterval !== null) {
      window.clearInterval(this.scrollLeftInterval);
      this.scrollLeftInterval = null;
    }

    if (this.scrollTopInterval !== null) {
      window.clearInterval(this.scrollTopInterval);
      this.scrollTopInterval = null;
    }

    this.container = null;
  };
}
