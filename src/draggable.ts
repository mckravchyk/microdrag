import { EnhancedEventListener } from 'enhanced-event-listener';

import {
  getWindowWidth,
  getWindowHeight,
  getClientX,
  getClientY,
} from './util/dom';

import { deepClone } from './util/deep_clone';

import {
  EventListeners,
  Options,
  NonDragEvent,
  DragEvent,
  EventProperties,
  DragProperties,
  NonDragEventName,
  DragEventName,
  dragEventNames,
  GetCallbackEvent,
  CallbackName,
  CallbackHandlers,
  CallbackHandlerName,
  toHandlerName,
  handlerNames,
  EventName,
} from './types';

import {
  getCursorEventType,
  getCursorId,
  getCursorType,
} from './util/cursor_events';

import type { CursorEvent } from './util/cursor_events';

import { addCSS } from './style';
import { ArraifyObjectValues } from './util/type_functions';

addCSS();

/**
 * If pointer is out of range of the element on drag init, the element position will be sanitized
 * so it is underneath the pointer. This is the distance the pointer will have from the right or
 * bottom edge of the element in that situation.
 */
const POINTER_OUT_OF_RANGE_PADDING = 10;

/**
  * Simple, fast draggable library
  */
export class Draggable {
  /**
   * Control variable to ignore the event on elements targeted by this.options.cancel
   */
  private cancelled = false;

  private ev: EventProperties | null = null;

  private options : Options;

  /**
   * Container for eventListener references
   */
  private listeners : Record<EventListeners, EnhancedEventListener | null> = {
    start: null,
    cancelStart: null,
    move: null,
    end: null,
    contextmenu: null,
  };

  /**
   * Stores callbacks for each event - the callbacks attached in options as well as callbacks
   * registered in plugins. The index is the CallbackHandlerName and the entry is an array of
   * callbacks, sorted by priority and the time they were added.
   *
   * Pseudo-type: `Record<CallbackHandlerName, CallbackHandler[]>`
   */
  private callbacks: ArraifyObjectValues<CallbackHandlers>

  private dragInitDistance = 2;

  /**
   * Since the options don't change gather this information in the constructor to optimize the move
   * event.
   */
  private hasDragCallback = false;

  private hasDragFilter = false;

  /**
   * Caching the last move event for onDrag callback and position filter - the callbacks are called
   * from requestAnimationFrame and need to rely on previously cached value.
   */
  private lastMoveEvent: CursorEvent | null = null;

  // TODO: Validate options with ts-interface-builder/ts-interface-checker?
  constructor(options : Options) {
    const usePointerEvents = (
      typeof window.PointerEvent !== 'undefined'
      && options.noPointerEvent !== true
    );

    const startEventName = usePointerEvents ? 'pointerdown' : 'touchstart mousedown';

    if (options.cancel) {
      // Must be attached before the start event callback is attached.
      this.listeners.cancelStart = new EnhancedEventListener({
        target: options.element,
        eventName: startEventName,
        delegate: { selector: options.cancel },
        callback: this.onCancelPointerdown,
      });
    }

    options.element.classList.add('draggable-element');

    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias

    // Attach the start event on the draggable element
    this.listeners.start = new EnhancedEventListener({
      target: options.element,
      eventName: startEventName,
      callback(e: CursorEvent) {
        self.onInputStart(e, this as unknown as HTMLElement);
      },
    });

    this.options = deepClone(options);

    if (typeof options.dragInitDistance === 'number') {
      this.dragInitDistance = Math.abs(options.dragInitDistance);
    }

    this.callbacks = {
      onPointerDown: [],
      onClick: [],
      onDragStart: [],
      onDrag: [],
      onDragStop: [],
      onDragEnd: [],
      filterPosition: [],
    };

    const plugins = options.plugins || [];

    for (const plugin of plugins) {
      for (const eventName of Object.keys(plugin.priority)) {
        const handlerName = toHandlerName(eventName as CallbackName);
        this.addCallback(
          handlerName,
          plugin[handlerName] as CallbackHandlers[typeof handlerName],
          // FIXME: Non-null assertion may be dropped if exactOptionalPropertyTypes flag would
          // be enabled.
          plugin.priority[eventName as CallbackName]!,
        );
      }
    }

    for (const handlerName of handlerNames) {
      if (typeof options[handlerName] !== 'undefined') {
        this.addCallback(
          handlerName,
          options[handlerName] as CallbackHandlers[typeof handlerName],
          1000,
        );
      }
    }

    this.hasDragCallback = this.callbacks.onDrag.length > 0;
    this.hasDragFilter = this.callbacks.filterPosition.length > 0;
  }

  public destroy(): void {
    // FIXME: Destroy timeout option may need to be re-introduced. Now there may be multiple
    // callbacks running onDragEnd and any of them destroying the instance would prevent further
    // callbacks from firing. It also should also check if not already destroyed.
    // OR use the filter that allows destroying the instance.
    for (const listener of Object.keys(this.listeners)) {
      if (this.listeners[listener as EventListeners] !== null) {
        this.listeners[listener as EventListeners]!.off();
        this.listeners[listener as EventListeners] = null;
      }
    }

    this.options.element.classList.remove('draggable-element');

    this.ev = null;

    // Hacky type conversion, but is much more practical than allowing null as a type for callbacks.
    this.callbacks = null as unknown as ArraifyObjectValues<CallbackHandlers>;
  }

  /**
   * Delegated pointerdown callback when the event target matches options.cancel selector.
   */
  private onCancelPointerdown = () => {
    this.cancelled = true;
  }

  private onInputStart = (e: CursorEvent, eventThis: HTMLElement) => {
    if (this.cancelled) {
      this.cancelled = false;
      return;
    }

    // Note: Not preventing default on input start.
    //
    // The only reason for using e.preventDefault() here is if it's a TouchEvent, to prevent
    // firing of MouseEvent sequence.
    //
    // Adding this here however, would also prevent contextmenu event - which might not be
    // desirable .Hence e.preventDefault is added onInputEnd(), which also successfully
    // stops MouseEvent sequence.

    // Exit if the event happens to be already active (this can be the case if another pointer
    // interacts with the event).
    if (this.ev !== null) {
      return;
    }

    if (this.listeners.move !== null || this.listeners.end !== null) {
      // This should never happen - if it does something is broken
      throw new Error('Event started but listeners are already registered.');
    }

    // Get the event type: mouse, touch or pointer
    const eventType = getCursorEventType(e);

    // Get the input device: mouse or touch
    const inputDevice = getCursorType(e);

    // Exit if not Left Mouse Button
    if (inputDevice === 'mouse' && (e as MouseEvent | PointerEvent).button !== 0) {
      return;
    }

    // Exit if not single touch.
    // FIXME: This only considers the Touch API. Implementation is missing for Pointer API
    if (eventType === 'Touch' && (e as TouchEvent).touches.length !== 1) {
      return;
    }

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

    this.ev = {
      eventType,
      inputDevice,
      pointerId: getCursorId(e),
      ctrlKey: (inputDevice === 'mouse' && e.ctrlKey),
      originalElement: eventThis,
      pointerX0,
      pointerY0,
      pointerX: pointerX0,
      pointerY: pointerY0,
      drag: null,
    };

    this.fireEvent('PointerDown', eventThis, this.getPublicEventProps('PointerDown', e));

    const eventNamePrefix = this.ev.eventType.toLocaleLowerCase();

    // eslint-disable-next-line
    // TODO: Implement a getEventName(eventType: cursorEventType, subEvent: 'start' | 'move' | 'end'); in  cursor_events.ts

    this.listeners.move = new EnhancedEventListener({
      target: window,
      eventName: `${eventNamePrefix}move`,
      // Passive events must be explicitly disabled, some browser default it to true in pointermove
      // event. If passive events are enabled, default cannot be prevented.
      passive: false,
      capture: true,
      callback: this.onInputMove,
    });

    const endEvent = <'mouseup'|'touchend'|'pointerup'> ((this.ev.eventType === 'Touch') ? `${eventNamePrefix}end` : `${eventNamePrefix}up`);

    this.listeners.end = new EnhancedEventListener({
      target: window,
      capture: true,
      eventName: endEvent,
      callback: this.onInputEnd,
    });

    this.listeners.contextmenu = new EnhancedEventListener({
      target: document,
      eventName: 'contextmenu',
      callback: this.onContextmenu,
    });
  }

  private dragInit(e: CursorEvent) {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    let draggedElement : HTMLElement;

    let deltaX = 0;
    let deltaY = 0;
    let elementX = 0;
    let elementY = 0;

    let snap: DragProperties['snap'] = null;

    if (this.options.clone) {
      draggedElement = this.ev.originalElement.cloneNode(true) as HTMLElement; // @domWrite
      draggedElement.setAttribute('id', ''); // @domWrite
      this.options.clone.attachTo.appendChild(draggedElement); // @domWrite
    }
    else {
      draggedElement = this.ev.originalElement;
    }

    draggedElement.classList.add('draggable-element-is-dragging'); // @domWrite
    document.body.classList.add('draggable-is-dragging'); // @domWrite

    // FIXME: Make it available in event props
    const elementWidth = draggedElement.offsetWidth; // @domRead
    const elementHeight = draggedElement.offsetHeight;// @domRead

    // Calculate snap edges
    if (this.options.snap) {
      // @domRead
      snap = {
        top: this.options.snap.edges.top,
        bottom: getWindowHeight() - elementHeight - this.options.snap.edges.bottom,
        left: this.options.snap.edges.left,
        right: getWindowWidth() - elementWidth - this.options.snap.edges.right,
      };
    }

    elementX = getClientX(this.ev.originalElement);
    elementY = getClientY(this.ev.originalElement);

    // Sanitize pointer position to be at the end of element (with some padding) if it's out of
    // range. This can happen when the clone helper is smaller than the original element.
    if (elementX + elementWidth <= this.ev.pointerX0) {
      elementX = this.ev.pointerX0 - elementWidth + POINTER_OUT_OF_RANGE_PADDING;
    }
    if (elementY + elementHeight <= this.ev.pointerY0) {
      elementY = this.ev.pointerY0 - elementHeight + POINTER_OUT_OF_RANGE_PADDING;
    }

    // Difference between initial pointer position and helper position.
    deltaX = this.ev.pointerX0 - elementX;
    deltaY = this.ev.pointerY0 - elementY;

    this.ev.drag = {
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

    this.fireEvent('DragStart', draggedElement, this.getPublicEventProps('DragStart', e));
  }

  private onInputMove = (e : CursorEvent) => {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    // Ignore move events on a different pointer
    if (!this.checkPointerId(e)) {
      return;
    }

    if (this.ev.eventType === 'Touch') {
      this.ev.pointerX = (<TouchEvent>e).changedTouches[0].clientX;
      this.ev.pointerY = (<TouchEvent>e).changedTouches[0].clientY;
    }
    else {
      this.ev.pointerX = (<PointerEvent|MouseEvent>e).clientX;
      this.ev.pointerY = (<PointerEvent|MouseEvent>e).clientY;
    }

    // Note: This might be obvious, but don't think about trying to compare previous values of the
    // pointer to see if they changed - the event already does it.

    // Initialize drag if minimal distance has been reached.
    if (this.ev.drag === null
      && Math.sqrt(
        (this.ev.pointerX0 - this.ev.pointerX) * (this.ev.pointerX0 - this.ev.pointerX)
        + (this.ev.pointerY0 - this.ev.pointerY) * (this.ev.pointerY0 - this.ev.pointerY),
      ) > this.dragInitDistance
    ) {
      this.dragInit(e);
    }

    // This must not be put in an else if - the preceeding if block can initialize drag, in which
    // case this block should execute on the same move.
    if (this.ev.drag !== null) {
      e.preventDefault();
      e.stopPropagation();

      if (this.hasDragCallback || this.hasDragFilter) {
        this.lastMoveEvent = e;
      }

      // Schedule animation frame to process move
      if (this.ev.drag.rafFrameId === null) {
        this.ev.drag.rafFrameId = requestAnimationFrame(() => {
          this.rafProcessMove();
        });
        // Note: In some browsers it would be possible to skip requestAnimationFrame althogether
        // However there is no reliable way to check if the browser schedules
        // one move event per frame or not
      }
    }
  }

  private rafProcessMove(): void {
    // This must not be allowed as the render loop is expected to be cancelled on stop.
    if (this.ev === null || this.ev.drag === null) {
      throw new Error('Unexpected call');
    }

    // This indicates that the frame has been processed and another one will have to be scheduled.
    this.ev.drag.rafFrameId = null;

    // Call the process move functions
    this.processMove();
  }

  private processMove() {
    if (this.ev === null || this.ev.drag === null) {
      throw new Error('Unexpected call');
    }

    // Exit if the position didn't change
    if (
      this.ev.drag.lastProcessedX === this.ev.pointerX
      && this.ev.drag.lastProcessedY === this.ev.pointerY
    ) {
      return;
    }

    this.ev.drag.lastProcessedX = this.ev.pointerX;
    this.ev.drag.lastProcessedY = this.ev.pointerY;

    // Calculate the dragged element position
    let newLeft = this.ev.pointerX - this.ev.drag.deltaX;
    let newTop = this.ev.pointerY - this.ev.drag.deltaY;

    // Sanitize the position for the snap feature
    if (this.ev.drag.snap !== null) {
      // X-axis
      // TODO: No magic numbers for sensitivity - add an option
      if (Math.abs(newLeft - this.ev.drag.snap.left) < 10) {
        newLeft = this.ev.drag.snap.left;
      }
      else if (Math.abs(newLeft - this.ev.drag.snap.right) < 10) {
        newLeft = this.ev.drag.snap.right;
      }

      // Y-axis
      if (Math.abs(newTop - this.ev.drag.snap.top) < 10) {
        newTop = this.ev.drag.snap.top;
      }
      else if (Math.abs(newTop - this.ev.drag.snap.bottom) < 10) {
        newTop = this.ev.drag.snap.bottom;
      }
    }

    this.ev.drag.elementX = newLeft;
    this.ev.drag.elementY = newTop;

    if (this.lastMoveEvent) {
      // Performance is critical here. It's better to share the event props rather than creating
      // a new copy of event props for each callback.
      const eventProps = this.getPublicEventProps('Drag', this.lastMoveEvent);

      if (this.hasDragFilter) {
        for (const callback of this.callbacks.filterPosition) {
          const result = callback.call(this.ev.drag.draggedElement, eventProps);

          if (result) {
            this.ev.drag.elementX = result[0];
            this.ev.drag.elementY = result[1];
            eventProps.elementX = result[0];
            eventProps.elementY = result[1];
          }
        }
      }

      if (this.hasDragCallback) {
        this.fireEvent('Drag', this.ev.drag.draggedElement, eventProps, { noCloneProps: true });
      }
    }

    if (this.options.useCompositing) {
      const transformX = this.ev.drag.elementX - this.ev.drag.elementX0;
      const transformY = this.ev.drag.elementY - this.ev.drag.elementY0;
      this.ev.drag.draggedElement.style.transform = `translate3d(${transformX}px,${transformY}px,0)`; // @domWrite
    }
    else {
      this.ev.drag.draggedElement.style.left = `${this.ev.drag.elementX}px`; // @domWrite
      this.ev.drag.draggedElement.style.top = `${this.ev.drag.elementY}px`; // @domWrite
    }
  }

  /**
   * Handles contextmenu event (expected to fire only for touch inputs).
   */
  private onContextmenu = (e: CursorEvent) => {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    // Prevent contextmenu if dragging
    if (this.ev.drag !== null) {
      e.preventDefault();
    }
    // or stop the event and allow contextmenu to open
    else {
      this.stop(e);
    }
  }

  private onInputEnd = (e : CursorEvent) => {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    // Stop MouseEvent sequence if touch event. This is done onInputEnd(), rather than
    // onInputStart() to allow some default actions like contextmenu.
    if (this.ev.eventType === 'Touch') {
      e.preventDefault();
    }

    if (!this.checkPointerId(e)) {
      return;
    }

    this.ev.ctrlKey = (this.ev.inputDevice === 'mouse' && e.ctrlKey);

    this.stop(e);
  }

  /**
   * Stops the event.
   */
  private stop(initiatingEvent: CursorEvent) {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    if (this.ev.drag !== null) {
      // Stop requestAnimationFrame if scheduled
      if (this.ev.drag.rafFrameId !== null) {
        window.cancelAnimationFrame(this.ev.drag.rafFrameId);
        this.ev.drag.rafFrameId = null;
      }

      // Manually call processMove() to render the last frame
      this.lastMoveEvent = initiatingEvent;
      this.processMove();
      this.lastMoveEvent = null;

      this.fireEvent('DragStop', this.ev.drag.draggedElement, this.getPublicEventProps('DragStop', initiatingEvent));

      document.body.classList.remove('draggable-is-dragging');
      this.ev.drag.draggedElement.classList.remove('draggable-element-is-dragging'); // @domWrite

      // If using composite layer - clean up the transform, apply the position as left/top position
      if (this.options.useCompositing) {
        // FIXME: What if the element has existing transformation applied?
        this.ev.drag.draggedElement.style.left = `${this.ev.drag.elementX}px`; // @domWrite
        this.ev.drag.draggedElement.style.top = `${this.ev.drag.elementY}px`;
        this.ev.drag.draggedElement.style.transform = '';
      }

      if (this.options.clone) {
        this.options.clone.attachTo.removeChild(this.ev.drag.draggedElement); // @domWrite
        // FIXME: It seems like relocating the dragged element is not part of the implementation?
      }

      // FIXME: Consider if there's a need for another event, first event before core dom
      // changes are applied, second event after core dom changes are applied. I.e. grid
      // functionality, before it was removed, executed some code at the end.
    }
    // Else if drag was not initialized.
    else {
      this.fireEvent('Click', this.ev.originalElement, this.getPublicEventProps('Click', initiatingEvent));
    }

    for (const listener of ['move', 'contextmenu', 'end'] as const) {
      if (this.listeners[listener] !== null) {
        this.listeners[listener]!.off();
        this.listeners[listener] = null;
      }
    }

    // TODO: Perhaps instead of destroy timeout, I could add a filter here to destroy draggable, it
    // would return true or false. Then DragEnd event could be removed.

    if (this.ev.drag !== null) {
      this.ev.drag = null;
      this.fireEvent('DragEnd', this.ev.originalElement, this.getPublicEventProps('DragEnd', initiatingEvent));
    }

    this.ev = null;
  }

  private addCallback<T extends CallbackHandlerName>(
    handlerName: T,
    callback: CallbackHandlers[T],
    // FIXME: Priority is not implemented. The callbacks in the array should be arranged in order
    // of priority.
    priority: number,
  ): void {
    this.callbacks[handlerName].push(callback as CallbackHandlers[T]);
  }

  private fireEvent<T extends EventName>(
    eventName: T,
    eventThis: HTMLElement,
    eventProps: GetCallbackEvent<T>,
    options: { noCloneProps?: boolean } = { },
  ): void {
    const handlerName = toHandlerName(eventName);

    for (const callback of this.callbacks[handlerName]) {
      const props = options.noCloneProps ? eventProps : deepClone(eventProps);
      // The type casting is a hack, it's not a DragEvent. For whatever reasons TS expects a
      // DragEvent in .call() argument, it could be that it sees DragEvent as the lowest common
      // denominator since it's compatible with both types.
      callback.call(eventThis, props as DragEvent);
    }
  }

  private getPublicEventProps<T extends NonDragEventName | DragEventName>(
    eventName: T,
    originalEvent: CursorEvent,
  ) : GetCallbackEvent<T> {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    // Do not use deep clone here (for performance reasons) and mind to not add deeply-nested
    // objects to event properties.
    const nonDragProps: NonDragEvent = {
      eventType: this.ev.eventType,
      inputDevice: this.ev.inputDevice,
      pointerId: this.ev.pointerId,
      originalElement: this.ev.originalElement,
      pointerX: this.ev.pointerX,
      pointerY: this.ev.pointerY,
      pointerX0: this.ev.pointerX0,
      pointerY0: this.ev.pointerY0,
      ctrlKey: this.ev.ctrlKey,
      eventName,
      originalEvent,
    };

    if (Draggable.isDragEventName(eventName)) {
      const dragProps: DragEvent = {
        ...nonDragProps,
        elementX: this.ev.drag!.elementX,
        elementY: this.ev.drag!.elementY,
        draggedElement: this.ev.drag!.draggedElement,
        deltaX: this.ev.drag!.deltaX,
        deltaY: this.ev.drag!.deltaY,
      };

      return dragProps as GetCallbackEvent<T>;
    }

    return nonDragProps as GetCallbackEvent<T>;
  }

  /**
   * Checks if the DOM Event pointer id matches the pointer which initiated drag
   */
  private checkPointerId(e: CursorEvent) {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }
    return (getCursorId(e) === this.ev.pointerId);
  }

  private static isDragEventName(
    eventName: DragEventName | NonDragEventName,
  ): eventName is DragEventName {
    return dragEventNames.includes(eventName as DragEventName);
  }
}
