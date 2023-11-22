import {
  getWindowWidth,
  getWindowHeight,
  getClientX,
  getClientY,
} from './util/dom';

import {
  getCursorEventType,
  getCursorId,
  getCursorType,
} from './util/cursor_events';

import type { CursorEvent } from './util/cursor_events';

import type { Options } from './draggable';

import {
  createCallbackHandlersCollection,
  type CallbackHandlersCollection,
  type DragProperties,
  type SharedEventProperties,
  getPublicEventProps,
  fireEvent,
} from './events';

/**
 * If pointer is out of range of the element on drag init, the element position will be sanitized
 * so it is underneath the pointer. This is the distance the pointer will have from the right or
 * bottom edge of the element in that situation.
 */
const POINTER_OUT_OF_RANGE_PADDING = 10;

export interface DragContext {
  event: SharedEventProperties

  /**
   * Drag properties, initialized at dragInit()
   */
  drag: DragProperties | null

  options: Options

  callbacks: CallbackHandlersCollection

  dragInitDistance: number

  /**
   * Since the options don't change gather this information in the constructor to optimize the move
   * event.
   */
  hasDragCallback: boolean

  hasDragFilter: boolean

  /**
   * Caching the last move event for onDrag callback and position filter - the callbacks are called
   * from requestAnimationFrame and need to rely on previously cached value.
   */
  lastMoveEvent: CursorEvent | null
}

export interface CreateDragContextProps {
  /**
   * The initiating start event (mousedown, pointerdown or touchstart)
   */
  event: CursorEvent

  target: HTMLElement

  options: Options

  callbacks: CallbackHandlersCollection
}

export function createDragContext(props: CreateDragContextProps): DragContext {
  // TODO: Ensure that when the drag context is created the callbacks cannot be changed
  // externally mid-drag - pass re-constructed callback arrays.

  const dragInitDistance = typeof props.options.dragInitDistance === 'number'
    ? Math.abs(props.options.dragInitDistance) : 2;

  const e = props.event;

  // Get the event type: mouse, touch or pointer
  const eventType = getCursorEventType(e);

  // Get the input device: mouse or touch
  const inputDevice = getCursorType(e);

  let pointerX0 : number;
  let pointerY0 : number;

  if (eventType === 'Touch') {
    pointerX0 = (e as TouchEvent).touches[0].clientX;
    pointerY0 = (e as TouchEvent).touches[0].clientY;
  }
  else {
    pointerX0 = (e as MouseEvent | PointerEvent).clientX;
    pointerY0 = (e as MouseEvent | PointerEvent).clientY;
  }

  const ctx: DragContext = {
    event: {
      eventType,
      inputDevice,
      pointerId: getCursorId(e),
      ctrlKey: (inputDevice === 'mouse' && e.ctrlKey),
      originalElement: props.target,
      pointerX0,
      pointerY0,
      pointerX: pointerX0,
      pointerY: pointerY0,
    },
    drag: null,
    options: props.options,
    callbacks: props.callbacks,
    hasDragCallback: props.callbacks.onDrag.length > 0,
    hasDragFilter: props.callbacks.filterPosition.length > 0,
    dragInitDistance,
    lastMoveEvent: null,
  };

  return ctx;
}

function initializeDrag(ctx: DragContext, e: CursorEvent) {
  let draggedElement : HTMLElement;

  let deltaX = 0;
  let deltaY = 0;
  let elementX = 0;
  let elementY = 0;

  let snap: DragProperties['snap'] = null;

  if (ctx.options.clone) {
    draggedElement = ctx.event.originalElement.cloneNode(true) as HTMLElement; // @domWrite
    draggedElement.setAttribute('id', ''); // @domWrite
    ctx.options.clone.attachTo.appendChild(draggedElement); // @domWrite
  }
  else {
    draggedElement = ctx.event.originalElement;
  }

  draggedElement.classList.add('draggable-element-is-dragging'); // @domWrite
  document.body.classList.add('draggable-is-dragging'); // @domWrite

  // FIXME: Make it available in event props
  const elementWidth = draggedElement.offsetWidth; // @domRead
  const elementHeight = draggedElement.offsetHeight;// @domRead

  // Calculate snap edges
  if (ctx.options.snap) {
    // @domRead
    snap = {
      top: ctx.options.snap.edges.top,
      bottom: getWindowHeight() - elementHeight - ctx.options.snap.edges.bottom,
      left: ctx.options.snap.edges.left,
      right: getWindowWidth() - elementWidth - ctx.options.snap.edges.right,
    };
  }

  elementX = getClientX(ctx.event.originalElement);
  elementY = getClientY(ctx.event.originalElement);

  // Sanitize pointer position to be at the end of element (with some padding) if it's out of
  // range. This can happen when the clone helper is smaller than the original element.
  if (elementX + elementWidth <= ctx.event.pointerX0) {
    elementX = ctx.event.pointerX0 - elementWidth + POINTER_OUT_OF_RANGE_PADDING;
  }
  if (elementY + elementHeight <= ctx.event.pointerY0) {
    elementY = ctx.event.pointerY0 - elementHeight + POINTER_OUT_OF_RANGE_PADDING;
  }

  // Difference between initial pointer position and helper position.
  deltaX = ctx.event.pointerX0 - elementX;
  deltaY = ctx.event.pointerY0 - elementY;

  ctx.drag = {
    draggedElement,
    deltaX,
    deltaY,
    elementX,
    elementY,
    elementX0: elementX,
    elementY0: elementY,
    lastProcessedX: null,
    lastProcessedY: null,
    rafFrameId: null,
    snap,
  };

  fireEvent(ctx, 'DragStart', e);
}

export function processInputMove(ctx: DragContext, e : CursorEvent) {
  // This should never be expected since the context is looked up by pointer ID.
  if (getCursorId(e) !== ctx.event.pointerId) {
    throw new Error('Invalid pointer ID [VLazAaV8Zmb5]');
  }

  if (ctx.event.eventType === 'Touch') {
    ctx.event.pointerX = (<TouchEvent>e).changedTouches[0].clientX;
    ctx.event.pointerY = (<TouchEvent>e).changedTouches[0].clientY;
  }
  else {
    ctx.event.pointerX = (<PointerEvent|MouseEvent>e).clientX;
    ctx.event.pointerY = (<PointerEvent|MouseEvent>e).clientY;
  }

  // Note: This might be obvious, but don't think about trying to compare previous values of the
  // pointer to see if they changed - the event already does it.

  // Initialize drag if minimal distance has been reached.
  if (ctx.drag === null
    && Math.sqrt(
      /* eslint-disable max-len */
      (ctx.event.pointerX0 - ctx.event.pointerX) * (ctx.event.pointerX0 - ctx.event.pointerX)
      + (ctx.event.pointerY0 - ctx.event.pointerY) * (ctx.event.pointerY0 - ctx.event.pointerY),
      /* eslint-enable max-len */
    ) > ctx.dragInitDistance
  ) {
    initializeDrag(ctx, e);
  }

  // This must not be put in an else if - the preceeding if block can initialize drag, in which
  // case this block should execute on the same move.
  if (ctx.drag !== null) {
    e.preventDefault();
    e.stopPropagation();

    if (ctx.hasDragCallback || ctx.hasDragFilter) {
      ctx.lastMoveEvent = e;
    }

    // Schedule animation frame to process move
    if (ctx.drag.rafFrameId === null) {
      ctx.drag.rafFrameId = requestAnimationFrame(() => {
        rafProcessMove(ctx);
      });
      // Note: In some browsers it would be possible to skip requestAnimationFrame althogether
      // However there is no reliable way to check if the browser schedules
      // one move event per frame or not
    }
  }
}

function rafProcessMove(ctx: DragContext): void {
  // This must not be allowed as the render loop is expected to be cancelled on stop.
  if (ctx.drag === null) {
    throw new Error('Unexpected call');
  }

  // This indicates that the frame has been processed and another one will have to be scheduled.
  ctx.drag.rafFrameId = null;

  processMove(ctx);
}

function processMove(ctx: DragContext) {
  if (ctx.drag === null) {
    throw new Error('Unexpected call');
  }

  // Exit if the position didn't change
  if (
    ctx.drag.lastProcessedX === ctx.event.pointerX
    && ctx.drag.lastProcessedY === ctx.event.pointerY
  ) {
    return;
  }

  ctx.drag.lastProcessedX = ctx.event.pointerX;
  ctx.drag.lastProcessedY = ctx.event.pointerY;

  // Calculate the dragged element position
  let newLeft = ctx.event.pointerX - ctx.drag.deltaX;
  let newTop = ctx.event.pointerY - ctx.drag.deltaY;

  // Sanitize the position for the snap feature
  if (ctx.drag.snap !== null) {
    // X-axis
    // TODO: No magic numbers for sensitivity - add an option
    if (Math.abs(newLeft - ctx.drag.snap.left) < 10) {
      newLeft = ctx.drag.snap.left;
    }
    else if (Math.abs(newLeft - ctx.drag.snap.right) < 10) {
      newLeft = ctx.drag.snap.right;
    }

    // Y-axis
    if (Math.abs(newTop - ctx.drag.snap.top) < 10) {
      newTop = ctx.drag.snap.top;
    }
    else if (Math.abs(newTop - ctx.drag.snap.bottom) < 10) {
      newTop = ctx.drag.snap.bottom;
    }
  }

  ctx.drag.elementX = newLeft;
  ctx.drag.elementY = newTop;

  if (ctx.lastMoveEvent) {
    // Performance is critical here. It's better to share the event props rather than creating
    // a new copy of event props for each callback.
    const eventProps = getPublicEventProps(ctx, 'Drag', ctx.lastMoveEvent);

    if (ctx.hasDragFilter) {
      for (const callback of ctx.callbacks.filterPosition) {
        const result = callback.call(ctx.drag.draggedElement, eventProps);

        if (result) {
          ctx.drag.elementX = result[0];
          ctx.drag.elementY = result[1];
          eventProps.elementX = result[0];
          eventProps.elementY = result[1];
        }
      }
    }

    if (ctx.hasDragCallback) {
      fireEvent(ctx, 'Drag', ctx.lastMoveEvent, { noCloneProps: true });
    }
  }

  if (ctx.options.useCompositing) {
    const transformX = ctx.drag.elementX - ctx.drag.elementX0;
    const transformY = ctx.drag.elementY - ctx.drag.elementY0;
    ctx.drag.draggedElement.style.transform = `translate3d(${transformX}px,${transformY}px,0)`; // @domWrite
  }
  else {
    ctx.drag.draggedElement.style.left = `${ctx.drag.elementX}px`; // @domWrite
    ctx.drag.draggedElement.style.top = `${ctx.drag.elementY}px`; // @domWrite
  }
}

/**
 * Stops the event.
 */
export function stop(ctx: DragContext, initiatingEvent: CursorEvent) {
  if (ctx.drag !== null) {
    // Stop requestAnimationFrame if scheduled
    if (ctx.drag.rafFrameId !== null) {
      window.cancelAnimationFrame(ctx.drag.rafFrameId);
      ctx.drag.rafFrameId = null;
    }

    // Manually call processMove() to render the last frame
    ctx.lastMoveEvent = initiatingEvent;
    processMove(ctx);
    ctx.lastMoveEvent = null;

    fireEvent(ctx, 'DragStop', initiatingEvent);

    document.body.classList.remove('draggable-is-dragging');
    ctx.drag.draggedElement.classList.remove('draggable-element-is-dragging'); // @domWrite

    // If using composite layer - clean up the transform, apply the position as left/top position
    if (ctx.options.useCompositing) {
      // FIXME: What if the element has existing transformation applied?
      ctx.drag.draggedElement.style.left = `${ctx.drag.elementX}px`; // @domWrite
      ctx.drag.draggedElement.style.top = `${ctx.drag.elementY}px`;
      ctx.drag.draggedElement.style.transform = '';
    }

    if (ctx.options.clone) {
      ctx.options.clone.attachTo.removeChild(ctx.drag.draggedElement); // @domWrite
      // FIXME: It seems like relocating the dragged element is not part of the implementation?
    }

    // FIXME: Consider if there's a need for another event, first event before core dom
    // changes are applied, second event after core dom changes are applied. I.e. grid
    // functionality, before it was removed, executed some code at the end.
  }
  // Else if drag was not initialized.
  else {
    fireEvent(ctx, 'Click', initiatingEvent);
  }

  ctx.callbacks = createCallbackHandlersCollection();

  if (ctx.drag !== null) {
    ctx.drag = null;
    fireEvent(ctx, 'DragEnd', initiatingEvent);
  }
}

/**
 * Handles contextmenu event (expected to fire only for touch inputs).
 */
export function processContextmenuEvent(ctx: DragContext, e: CursorEvent) {
  if (getCursorId(e) !== ctx.event.pointerId) {
    throw new Error('Invalid pointer ID [yr06vkH0QvdT]');
  }

  // Prevent contextmenu if dragging
  if (ctx.drag !== null) {
    e.preventDefault();
  }
  // or stop the event and allow contextmenu to open
  else {
    stop(ctx, e);
  }
}

export function processInputEnd(ctx: DragContext, e: CursorEvent) {
  // Stop MouseEvent sequence if touch event. This is done onInputEnd(), rather than
  // onInputStart() to allow some default actions like contextmenu.
  if (ctx.event.eventType === 'Touch') {
    e.preventDefault();
  }

  if (getCursorId(e) !== ctx.event.pointerId) {
    throw new Error('Invalid pointer ID [KGfnx7WxJuff]');
  }

  ctx.event.ctrlKey = ctx.event.inputDevice === 'mouse' && e.ctrlKey;

  stop(ctx, e);
}
