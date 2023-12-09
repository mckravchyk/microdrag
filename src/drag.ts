import {
  getAbsLeft,
  getAbsTop,
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

  if (props.options.refFrame) {
    refX = getAbsLeft(props.options.refFrame);
    refY = getAbsTop(props.options.refFrame);
    refScrollLeft = getScrollLeft(props.options.refFrame);
    refScrollTop = getScrollTop(props.options.refFrame);
  }

  const pointerX0 = absPointerX0 - refX;
  const pointerY0 = absPointerY0 - refY;

  const ctx: DragContext = {
    event: {
      absPointerX: absPointerX0,
      absPointerY: absPointerY0,
      absPointerX0,
      absPointerY0,
      activeElement: props.target,
      activeElementWidth: props.target.offsetWidth, // @domRead
      activeElementHeight: props.target.offsetHeight, // @domRead
      ctrlKey: (inputDevice === 'mouse' && e.ctrlKey),
      eventType,
      refScrollLeft,
      refScrollTop,
      refX,
      refY,
      inputDevice,
      originalElement: props.target,
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
  };

  return ctx;
}

function initializeDrag(ctx: DragContext, e: CursorEvent) {
  let draggedElement : HTMLElement;

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

  ctx.event.activeElement = draggedElement;

  // The element dimensions need to be updated not just because the clone may be different but also
  // because adding the is-dragging class could potentially change its dimensions.
  ctx.event.activeElementWidth = draggedElement.offsetWidth; // @domRead
  ctx.event.activeElementHeight = draggedElement.offsetHeight; // @domRead

  let absElementX = getAbsLeft(ctx.event.originalElement);
  let absElementY = getAbsTop(ctx.event.originalElement);

  // Sanitize pointer position to be at the end of element (with some padding) if it's out of
  // range. This can happen when the clone helper is smaller than the original element.
  if (absElementX + ctx.event.activeElementWidth <= ctx.event.absPointerX0) {
    // eslint-disable-next-line max-len
    absElementX = ctx.event.absPointerX0 - ctx.event.activeElementWidth + POINTER_OUT_OF_RANGE_PADDING;
  }

  if (absElementY + ctx.event.activeElementHeight <= ctx.event.absPointerY0) {
    // eslint-disable-next-line max-len
    absElementY = ctx.event.absPointerY0 - ctx.event.activeElementHeight + POINTER_OUT_OF_RANGE_PADDING;
  }

  const elementX = absElementX - ctx.event.refX;
  const elementY = absElementY - ctx.event.refY;

  // Note that the pointer position from the start event is used and it's going to differ from the
  // current position by the drag threshold, this is intended, the element will be moved after drag
  // initializes and the original pointer position relative to the element is maintained (unless the
  // position of the element was sanitized above), unaffected by the threshold.
  const deltaX = ctx.event.pointerX0 - elementX;
  const deltaY = ctx.event.pointerY0 - elementY;

  ctx.drag = {
    absElementX,
    absElementY,
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

  if (ctx.drag === null
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
  if (ctx.drag === null) {
    stop(ctx, e);
    return;
  }

  const refFrame = ctx.event.refFrame as HTMLElement;

  ctx.drag.refScrollLeftDelta = getScrollLeft(refFrame) - ctx.event.refScrollLeft;
  ctx.drag.refScrollTopDelta = getScrollTop(refFrame) - ctx.event.refScrollTop;
  ctx.event.refScrollLeft += ctx.drag.refScrollLeftDelta;
  ctx.event.refScrollTop += ctx.drag.refScrollTopDelta;
  ctx.event.refX -= ctx.drag.refScrollLeftDelta;
  ctx.event.refY -= ctx.drag.refScrollTopDelta;

  ctx.event.pointerX = ctx.event.absPointerX - ctx.event.refX;
  ctx.event.pointerY = ctx.event.absPointerY - ctx.event.refY;

  if (ctx.hasDragCallback || ctx.hasDragFilter) {
    ctx.lastMoveEvent = e;
  }

  scheduleProcessMove(ctx);

  fireEvent(ctx, 'RefFrameScroll', e);
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

  ctx.drag.elementX = ctx.event.pointerX - ctx.drag.deltaX;
  ctx.drag.elementY = ctx.event.pointerY - ctx.drag.deltaY;

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
      ctx.event.activeElement = ctx.event.originalElement;
      ctx.options.clone.attachTo.removeChild(ctx.drag.draggedElement); // @domWrite
      // FIXME: It seems like relocating the dragged element is not part of the implementation?
    }

    // Again, it needs to be updated even if clone was not used because the dimensions could have
    // changed due to classes.
    ctx.event.activeElementWidth = ctx.event.activeElement.offsetWidth; // @domRead
    ctx.event.activeElementHeight = ctx.event.activeElement.offsetHeight; // @domRead

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
