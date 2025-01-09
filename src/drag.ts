import {
  getAbsOffset,
  getClientHeight,
  getClientWidth,
  getScrollLeft,
  getScrollTop,
} from './lib/dom';

import {
  getCursorEventType,
  getCursorId,
  getCursorType,
} from './lib/cursor_events';

import type { CursorEvent } from './lib/cursor_events';

import type { Options } from './draggable';

import {
  createCallbackHandlersCollection,
  getPublicEventProps,
  fireEvent,
  fireDragEvent,
  applyPositionFilters,
  type CallbackHandlersCollection,
  type DragProperties,
  type NonDragPropertiesPriv,
} from './events';

/**
 * If pointer is out of range of the element on drag init, the element position will be sanitized
 * so it is underneath the pointer. This is the distance the pointer will have from the right or
 * bottom edge of the element in that situation.
 */
const POINTER_OUT_OF_RANGE_PADDING = 10;

export interface DragContext {
  event: NonDragPropertiesPriv

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

  /**
   * Whether dragging has been disabled by the filter.
   */
  isDragDisabled: boolean
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

/**
 * Reads the environment data on input start and creates the context.
 */
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

  let absPointerX0: number;
  let absPointerY0: number;

  if (eventType === 'Touch') {
    absPointerX0 = (e as TouchEvent).touches[0].clientX;
    absPointerY0 = (e as TouchEvent).touches[0].clientY;
  }
  else {
    absPointerX0 = (e as MouseEvent | PointerEvent).clientX;
    absPointerY0 = (e as MouseEvent | PointerEvent).clientY;
  }

  let refX = 0;
  let refY = 0;
  let refScrollLeft = 0;
  let refScrollTop = 0;
  let refWidth = 0;
  let refHeight = 0;

  if (props.options.refFrame) {
    const refOffset = getAbsOffset(props.options.refFrame);
    refX = refOffset.left;
    refY = refOffset.top;
    refScrollLeft = getScrollLeft(props.options.refFrame);
    refScrollTop = getScrollTop(props.options.refFrame);
    refWidth = getClientWidth(props.options.refFrame);
    refHeight = getClientHeight(props.options.refFrame);
  }

  const pointerX0 = absPointerX0 - refX;
  const pointerY0 = absPointerY0 - refY;

  const ctx: DragContext = {
    event: {
      absPointerX: absPointerX0,
      absPointerY: absPointerY0,
      absPointerX0,
      absPointerY0,
      ctrlKey: (inputDevice === 'mouse' && e.ctrlKey),
      eventType,
      refScrollLeft,
      refScrollTop,
      refX,
      refY,
      refWidth,
      refHeight,
      inputDevice,
      target: props.target,
      pointerId: getCursorId(e),
      pointerX: pointerX0,
      pointerY: pointerY0,
      pointerX0,
      pointerY0,
      refFrame: props.options.refFrame || 'viewport',
    },
    drag: null,
    options: props.options,
    callbacks: props.callbacks,
    hasDragCallback: props.callbacks.onDrag.length > 0,
    hasDragFilter: props.callbacks.filterPosition.length > 0,
    dragInitDistance,
    lastMoveEvent: null,
    isDragDisabled: false,
  };

  return ctx;
}

function initializeDrag(ctx: DragContext, e: CursorEvent) {
  let dragged : HTMLElement;

  if (ctx.options.clone) {
    dragged = ctx.event.target.cloneNode(true) as HTMLElement; // @domWrite
    dragged.setAttribute('id', ''); // @domWrite
    ctx.options.clone.attachTo.appendChild(dragged); // @domWrite
  }
  else {
    dragged = ctx.event.target;
  }

  dragged.classList.add('draggable-element-is-dragging'); // @domWrite
  document.body.classList.add('draggable-is-dragging'); // @domWrite

  // The element dimensions need to be updated not just because the clone may be different but also
  // because adding the is-dragging class could potentially change its dimensions.

  // Must be calculated / re-calculated after adding the is-dragging class
  const draggedWidth = dragged.offsetWidth; // @domRead
  const draggedHeight = dragged.offsetHeight; // @domRead

  const absElementOffset = getAbsOffset(ctx.event.target);
  let absElementX = absElementOffset.left;
  let absElementY = absElementOffset.top;

  // Sanitize pointer position to be at the end of element (with some padding) if it's out of
  // range. This can happen when the clone helper is smaller than the original element.
  if (absElementX + draggedWidth <= ctx.event.absPointerX0) {
    absElementX = ctx.event.absPointerX0 - draggedWidth + POINTER_OUT_OF_RANGE_PADDING;
  }

  if (absElementY + draggedHeight <= ctx.event.absPointerY0) {
    absElementY = ctx.event.absPointerY0 - draggedHeight + POINTER_OUT_OF_RANGE_PADDING;
  }

  const draggedX = absElementX - ctx.event.refX;
  const draggedY = absElementY - ctx.event.refY;

  // Note that the pointer position from the start event is used and it's going to differ from the
  // current position by the drag threshold, this is intended, the element will be moved after drag
  // initializes and the original pointer position relative to the element is maintained (unless the
  // position of the element was sanitized above), unaffected by the threshold.
  // This approach also solves the scenario where drag is initialized from the scroll event.
  const deltaX = ctx.event.pointerX0 - draggedX;
  const deltaY = ctx.event.pointerY0 - draggedY;

  ctx.drag = {
    absElementX,
    absElementY,
    dragged,
    deltaX,
    deltaY,
    draggedX,
    draggedY,
    draggedX0: draggedX,
    draggedY0: draggedY,
    draggedWidth,
    draggedHeight,
    lastProcessedX: null,
    lastProcessedY: null,
    rafFrameId: null,
    refScrollLeftDelta: 0,
    refScrollTopDelta: 0,
  };

  fireEvent(ctx, 'DragStart', e);
}

export function processInputMove(ctx: DragContext, e : CursorEvent) {
  // This should never be expected since the context is looked up by pointer ID.
  if (getCursorId(e) !== ctx.event.pointerId) {
    throw new Error('Invalid pointer ID [VLazAaV8Zmb5]');
  }

  if (ctx.event.eventType === 'Touch') {
    ctx.event.absPointerX = (<TouchEvent>e).changedTouches[0].clientX;
    ctx.event.absPointerY = (<TouchEvent>e).changedTouches[0].clientY;
  }
  else {
    ctx.event.absPointerX = (<PointerEvent|MouseEvent>e).clientX;
    ctx.event.absPointerY = (<PointerEvent|MouseEvent>e).clientY;
  }

  ctx.event.pointerX = ctx.event.absPointerX - ctx.event.refX;
  ctx.event.pointerY = ctx.event.absPointerY - ctx.event.refY;

  // Note: This might be obvious, but don't think about trying to compare previous values of the
  // pointer to see if they changed - the event will fire only if the pointer actually moved.

  // Not a function so it's faster
  if (ctx.drag === null
    && !ctx.isDragDisabled
    && Math.sqrt(
      (ctx.event.pointerX0 - ctx.event.pointerX) * (ctx.event.pointerX0 - ctx.event.pointerX)
      + (ctx.event.pointerY0 - ctx.event.pointerY) * (ctx.event.pointerY0 - ctx.event.pointerY),
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

    scheduleProcessMove(ctx);
  }
}

/**
 * Processes the scroll event of the frame of reference.
 *
 * When the frame of reference scrolls it moves but the absolute pointer position is the same. From
 * the perspective of movement inside the frame of reference, the pointer moves relative to it which
 * triggers a move of the draggable (otherwise the draggable would move away from the pointer).
 */
export function processRefFrameScroll(ctx: DragContext, e: MouseEvent): void {
  const refFrame = ctx.event.refFrame as HTMLElement;

  const refScrollLeftDelta = getScrollLeft(refFrame) - ctx.event.refScrollLeft;
  const refScrollTopDelta = getScrollTop(refFrame) - ctx.event.refScrollTop;

  ctx.event.refX -= refScrollLeftDelta;
  ctx.event.refY -= refScrollTopDelta;
  ctx.event.refScrollLeft += refScrollLeftDelta;
  ctx.event.refScrollTop += refScrollTopDelta;
  ctx.event.pointerX = ctx.event.absPointerX - ctx.event.refX;
  ctx.event.pointerY = ctx.event.absPointerY - ctx.event.refY;

  // Not a function so it's faster
  if (ctx.drag === null && !ctx.isDragDisabled && Math.sqrt(
    (ctx.event.pointerX0 - ctx.event.pointerX) * (ctx.event.pointerX0 - ctx.event.pointerX)
    + (ctx.event.pointerY0 - ctx.event.pointerY) * (ctx.event.pointerY0 - ctx.event.pointerY),
  ) > ctx.dragInitDistance) {
    initializeDrag(ctx, e);
  }

  if (ctx.drag !== null) {
    ctx.drag.refScrollLeftDelta = refScrollLeftDelta;
    ctx.drag.refScrollTopDelta = refScrollTopDelta;

    if (ctx.hasDragCallback || ctx.hasDragFilter) {
      ctx.lastMoveEvent = e;
    }

    scheduleProcessMove(ctx);
    fireEvent(ctx, 'RefFrameScroll', e);
  }
}

/**
 * Schedules processing of updated pointer position (to update the element position) on the next
 * animation frame.
 *
 * Chromium does not fire more than one move event per frame, other browsers likely do not either,
 * however, the move can be caused not only be `pointermove` but also `scroll` which can fire in the
 * very same frame - using `requestAnimationFrame` ensures that no matter what, the position is
 * updated only once per frame.
 */
function scheduleProcessMove(ctx: DragContext): void {
  // Schedule animation frame to process move
  if (ctx.drag && ctx.drag.rafFrameId === null) {
    ctx.drag.rafFrameId = requestAnimationFrame(() => {
      rafProcessMove(ctx);
    });
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

  ctx.drag.draggedX = ctx.event.pointerX - ctx.drag.deltaX;
  ctx.drag.draggedY = ctx.event.pointerY - ctx.drag.deltaY;

  if (ctx.lastMoveEvent && (ctx.hasDragFilter || ctx.hasDragCallback)) {
    const eventProps = getPublicEventProps(ctx, 'Drag', ctx.lastMoveEvent);

    if (ctx.hasDragFilter) {
      applyPositionFilters(ctx, eventProps);
    }

    if (ctx.hasDragCallback) {
      fireDragEvent(ctx, eventProps);
    }
  }

  if (ctx.options.useCompositing) {
    const transformX = ctx.drag.draggedX - ctx.drag.draggedX0;
    const transformY = ctx.drag.draggedY - ctx.drag.draggedY0;
    ctx.drag.dragged.style.transform = `translate3d(${transformX}px,${transformY}px,0)`; // @domWrite
  }
  else {
    ctx.drag.dragged.style.left = `${ctx.drag.draggedX}px`; // @domWrite
    ctx.drag.dragged.style.top = `${ctx.drag.draggedY}px`; // @domWrite
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
    ctx.drag.dragged.classList.remove('draggable-element-is-dragging'); // @domWrite

    // If using composite layer - clean up the transform, apply the position as left/top position
    if (ctx.options.useCompositing) {
      // FIXME: What if the element has existing transformation applied?
      ctx.drag.dragged.style.left = `${ctx.drag.draggedX}px`; // @domWrite
      ctx.drag.dragged.style.top = `${ctx.drag.draggedY}px`;
      ctx.drag.dragged.style.transform = '';
    }

    if (ctx.options.clone) {
      ctx.options.clone.attachTo.removeChild(ctx.drag.dragged); // @domWrite
      // FIXME: It seems like relocating the dragged element is not part of the implementation?
    }

    // FIXME: Consider if there's a need for another event, first event before core dom
    // changes are applied, second event after core dom changes are applied. I.e. grid
    // functionality, before it was removed, executed some code at the end.
  }
  else if (initiatingEvent.type === 'scroll') {
    fireEvent(ctx, 'Cancel', initiatingEvent);
  }
  else {
    fireEvent(ctx, 'Click', initiatingEvent);
  }

  if (ctx.drag !== null) {
    ctx.drag = null;
    // Note that this is a "non-drag event".
    fireEvent(ctx, 'DragEnd', initiatingEvent);
  }

  ctx.callbacks = createCallbackHandlersCollection();
}

/**
 * Handles contextmenu event (expected to fire only for touch inputs).
 */
export function processContextmenuEvent(ctx: DragContext, e: CursorEvent) {
  if (getCursorId(e) !== ctx.event.pointerId) {
    throw new Error('Invalid pointer ID [yr06vkH0QvdT]');
  }

  // FIXME: Emit a ContextMenu event

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
