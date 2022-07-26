import { EnhancedEventListener } from 'enhanced-event-listener';

import {
  getWidth,
  getHeight,
  getWindowWidth,
  getWindowHeight,
  getClientX,
  getClientY,
} from './util/dom';

import { deepClone } from './util/deep_clone';

import type {
  GridMap,
  EventListeners,
  Options,
  DraggableEvent,
  EventProperties,
  DragProperties,
} from './types';

import {
  getCursorEventType,
  getCursorId,
  getCursorType,
} from './util/cursor_events';

import type { CursorEvent } from './util/cursor_events';

import { addCSS } from './style';

addCSS();

/**
  * Simple, fast draggable library
  */
export class Draggable {
  /**
   * Control variable to ignore the event on elements targeted by this.options.cancel
   */
  private cancelled = false;

  private ev: EventProperties| null = null;

  private options : Options;

  /**
   * Grid map representation (if this.options.grid)
   */
  private gridMap: (GridMap|null) = null;

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

    if (typeof options.grid !== 'undefined') {
      this.gridMap = deepClone(options.grid.map);
    }

    this.options = deepClone(options);
  }

  /**
   * Destroys the instance. Returns a prmise that indicates the instance was destroyed.
   *
   * @param timeout If a number is supplied the destroy operation will be executed with a timeout.
   * This is required when the draggable instance is set to be destroyed in the onDragStop callback,
   * after the callback fires there are still some pending operations so destoying immediately would
   * result in an error - setting just 0ms timeout can allow to safely destroy the instance in the
   * onDragStop callback.
   */
  public destroy(timeout?: number | false): Promise<void> {
    let resolve: () => void;

    const promise = new Promise<void>((r) => {
      resolve = r;
    });

    const destroy = () => {
      for (const listener of Object.keys(this.listeners)) {
        if (this.listeners[listener as EventListeners] !== null) {
          this.listeners[listener as EventListeners]!.off();
          this.listeners[listener as EventListeners] = null;
        }
      }

      this.options.element.classList.remove('draggable-element');

      this.ev = null;

      resolve();
    };

    if (typeof timeout !== 'number') {
      destroy();
    }
    else {
      setTimeout(destroy, timeout);
    }

    return promise;
  }

  public getOption<T extends(keyof Options & string)>(option: T): Options[T] {
    return deepClone(this.options[option]);
  }

  public setOption<T extends keyof Options>(option : T, value : Options[T]): void {
    // TODO: Validate options?
    this.options[option] = deepClone(value);

    if (option === 'grid') {
      this.gridMap = deepClone((value as Options['grid'])!.map);
    }
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

    if (typeof this.options.onPointerDown === 'function') {
      this.options.onPointerDown.call(eventThis, this.getPublicEventProps('pointerdown', e));
    }

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
    let elementX0 = 0;
    let elementY0 = 0;

    let containment: DragProperties['containment'] = null;
    let snap: DragProperties['containment'] = null;

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

    const elementWidth = draggedElement.offsetWidth; // @domRead
    const elementHeight = draggedElement.offsetHeight;// @domRead

    // Set containment boundaries: minX, maxX, minY, maxY
    if (this.options.containment) {
      let minX;
      let minY;
      let maxX;
      let maxY;

      const c = this.options.containment;

      const windowWidth = getWindowWidth(); // @domRead
      const windowHeight = getWindowHeight();// @domRead

      const containerWidth = c.container ? getWidth(c.container) : windowWidth; // @domRead
      const containerHeight = c.container ? getHeight(c.container) : windowHeight; // @domRead

      // A note about negative boundaries c < 0
      //
      // If a boundary is negative, it allows the element to go past the boundary edge
      // The element can go as deep as x pxs from the opposite side of the element
      //
      // For example, if the right boundary is set to -100px, the element
      // can be dragged past the right edge all the way until 100px of the element's
      // left side are still visible

      // minY (top boundary)
      if (c.edges.top >= 0) {
        minY = c.edges.top;
      }
      else {
        minY = -elementHeight - c.edges.top;
      }

      // maxX (right boundary)
      if (c.edges.right >= 0) {
        maxX = containerWidth - elementWidth - c.edges.right;
      }
      else {
        maxX = windowWidth + c.edges.right;
      }

      // maxY (bottom boundary)
      if (c.edges.bottom >= 0) {
        maxY = containerHeight - elementHeight - c.edges.bottom;
      }
      else {
        maxY = windowHeight + c.edges.bottom;
      }

      // minX (left boundary)
      if (c.edges.left >= 0) {
        minX = c.edges.left;
      }
      else {
        minX = -elementWidth - c.edges.left;
      }

      // TODO: This will probably need to be re-calculated after scroll when using element as a
      // container.
      containment = {
        top: minY,
        right: maxX,
        bottom: maxY,
        left: minX,
      };
    }

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

    // Difference between initial pointer position and helper position.
    deltaX = this.ev.pointerX0 - elementX;
    deltaY = this.ev.pointerY0 - elementY;

    elementX0 = elementX;
    elementY0 = elementY;

    this.ev.drag = {
      draggedElement,
      deltaX,
      deltaY,
      elementX,
      elementY,
      elementX0,
      elementY0,
      lastProcessedX: null,
      lastProcessedY: null,
      rafFrameId: null,
      containment,
      snap,
      grid: null, // Grid will be initialized in dragInitGrid() - below
    };

    if (typeof this.options.grid !== 'undefined') {
      this.dragInitGrid();
    }

    if (typeof this.options.onDragStart === 'function') {
      this.options.onDragStart.call(draggedElement, this.getPublicEventProps('dragStart', e));
    }
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
      ) > 2 // FIXME: It should be an option, or at least, a constant.
    ) {
      this.dragInit(e);
    }

    if (this.ev.drag !== null) {
      e.preventDefault();
      e.stopPropagation();

      if (typeof this.options.onDrag === 'function') {
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

    // TODO: Add a filter position callback and allow extra features such as containment, snap
    // and drag as plugins?

    // Sanitize the position by containment boundaries
    if (this.ev.drag.containment !== null) {
      // X-axis
      if (newLeft < this.ev.drag.containment.left) {
        newLeft = this.ev.drag.containment.left;
      }
      else if (newLeft > this.ev.drag.containment.right) {
        newLeft = this.ev.drag.containment.right;
      }

      // Y-axis
      if (newTop < this.ev.drag.containment.top) {
        newTop = this.ev.drag.containment.top;
      }
      else if (newTop > this.ev.drag.containment.bottom) {
        newTop = this.ev.drag.containment.bottom;
      }
    }

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

    this.renderMove();
  }

  private renderMove() : void {
    if (this.ev === null || this.ev.drag === null) {
      throw new Error('Unexpected call');
    }

    if (typeof this.options.onDrag === 'function' && this.lastMoveEvent) {
      // FIXME: Perhaps it would be better to not expose the move event at all? It's a bit hacky
      // render move is also called on stop()
      this.options.onDrag.call(this.ev.drag.draggedElement, this.getPublicEventProps('drag', this.lastMoveEvent));
    }

    if (this.options.enableCompositing) {
      const transformX = this.ev.drag.elementX - this.ev.drag.elementX0;
      const transformY = this.ev.drag.elementY - this.ev.drag.elementY0;
      this.ev.drag.draggedElement.style.transform = `translate3d(${transformX}px,${transformY}px,0)`; // @domWrite
    }
    else {
      this.ev.drag.draggedElement.style.left = `${this.ev.drag.elementX}px`; // @domWrite
      this.ev.drag.draggedElement.style.top = `${this.ev.drag.elementY}px`; // @domWrite
    }

    // Process grid changes if using grid, this will also update the swapped element position
    if (this.ev.drag.grid !== null) {
      this.processGridUpdate();
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

      if (typeof this.options.onDragStop === 'function') {
        this.options.onDragStop.call(this.ev.drag.draggedElement, this.getPublicEventProps('dragStop', initiatingEvent));
      }

      document.body.classList.remove('draggable-is-dragging');
      this.ev.drag.draggedElement.classList.remove('draggable-element-is-dragging'); // @domWrite

      // If using composite layer - clean up the transform, apply the position as left/top position
      if (this.options.enableCompositing) {
        // FIXME: What if the element has existing transformation applied?
        this.ev.drag.draggedElement.style.left = `${this.ev.drag.elementX}px`; // @domWrite
        this.ev.drag.draggedElement.style.top = `${this.ev.drag.elementY}px`;
        this.ev.drag.draggedElement.style.transform = '';
      }

      if (this.options.clone) {
        this.options.clone.attachTo.removeChild(this.ev.drag.draggedElement); // @domWrite
        // FIXME: It seems like relocating the dragged element is not part of the implementation?
      }

      // If grid - update set the final position of the element
      if (this.ev.drag.grid !== null) {
        // @domWrite
        this.ev.originalElement.style.left = `${(this.ev.drag.grid.gridX * this.ev.drag.grid.cellWidth)}px`;
        this.ev.originalElement.style.top = `${(this.ev.drag.grid.gridY * this.ev.drag.grid.cellHeight)}px`;
      }
    }
    // Else if drag was not initialized.
    else if (typeof this.options.onClick === 'function') {
      this.options.onClick.call(this.ev.originalElement, this.getPublicEventProps('click', initiatingEvent));
    }

    for (const listener of ['move', 'contextmenu', 'end'] as const) {
      if (this.listeners[listener] !== null) {
        this.listeners[listener]!.off();
        this.listeners[listener] = null;
      }
    }

    this.ev.drag = null;
    this.ev = null;
  }

  private getPublicEventProps(eventName: string, originalEvent: CursorEvent) : DraggableEvent {
    if (this.ev === null) {
      throw new Error('Unexpected call');
    }

    return deepClone({
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
      elementX: (this.ev.drag !== null) ? this.ev.drag.elementX : null,
      elementY: (this.ev.drag !== null) ? this.ev.drag.elementY : null,
      draggedElement: (this.ev.drag !== null) ? this.ev.drag.draggedElement : null,
    });
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

  /**
   * Calculate the dragged element position to be set on a grid
   */
  private calculateGridHelperPosition() {
    if (
      this.ev === null
      || this.ev.drag === null
      || this.ev.drag.grid === null
    ) {
      throw new Error('Unexpected call');
    }

    if (this.ev.drag.elementX !== this.ev.pointerX - this.ev.drag.deltaX) {
      // console.log('Warning: X difference');
    }

    if (this.ev.drag.elementY !== this.ev.pointerY - this.ev.drag.deltaY) {
      // console.log('Warning: Y difference');
    }

    let x = this.ev.drag.elementX;
    x = Math.round(x / this.ev.drag.grid.cellWidth);

    let y = this.ev.drag.elementY;
    y = Math.round(y / this.ev.drag.grid.cellHeight);

    this.ev.drag.grid.gridX = x;
    this.ev.drag.grid.gridY = y;
  }

  /**
   * Sets up grid functionality. Called at dragInit()
   */
  private dragInitGrid() {
    if (this.ev === null || this.ev.drag === null || typeof this.options.grid === 'undefined') {
      throw new Error('Unexpected call');
    }

    this.ev.drag.grid = {
      // FIXME: Assign grid ids
      gridId: parseInt(this.ev.originalElement.dataset.gridId || '', 10), // @domRead
      container: this.options.grid.container,
      cellWidth: this.options.grid.cellWidth,
      cellHeight: this.options.grid.cellHeight,
      gridX: 0,
      gridY: 0,
      lastGridX: 0,
      lastGridY: 0,
    };

    // This will populate gridX and gridY properties of eventVars.grid
    this.calculateGridHelperPosition();

    // Populate the last position variables
    this.ev.drag.grid.lastGridX = this.ev.drag.grid.gridX;
    this.ev.drag.grid.lastGridY = this.ev.drag.grid.gridY;

    // gridSwapped = null;
  }

  /**
   * Updates the grid representation and position of the swapped element. It's called at
   * renderMove()
   */
  private processGridUpdate() : void {
    if (this.ev === null || this.ev.drag === null
      || this.ev.drag.grid === null || this.gridMap === null) {
      throw new Error('Unexpected call');
    }

    // A very old note (from the legacy version) - not touching it until I'm doing any work
    // on the grid functionality.
    //
    // on drag init element starts with helperGridX and helperGridY
    // get current position, if changed continue
    // if there was element swapped previously, restore it to the previous position
    // if another element lays on current position,
    // swap it with the old positions (prevHelperGridX, prevHelperGridY)
    //
    // check if the grid position changed and then execute proper actions
    // get and store the position of the dragged element
    // if the position changed, find element under that position and if it exists, swap it
    // swappedElementID = -1 or ID

    this.calculateGridHelperPosition();

    // If the position of the helper changes in the grid
    if (
      this.ev.drag.grid.gridX !== this.ev.drag.grid.lastGridX
      || this.ev.drag.grid.gridY !== this.ev.drag.grid.lastGridY
    ) {
      // Swap grid elements
      //
      // When the dragged element enters the place on the grid of another element,
      // the element which is there has to be swapped to the previous grid position
      // of the dragged element

      // Id of the element which is to be swapped/replaced by the dragged element
      let swappedElementID : number | null = null;

      if (
        typeof this.gridMap[this.ev.drag.grid.gridY] !== 'undefined'
        && typeof this.gridMap[this.ev.drag.grid.gridY][this.ev.drag.grid.gridX] !== 'undefined'
      ) {
        swappedElementID = this.gridMap[this.ev.drag.grid.gridY][this.ev.drag.grid.gridX];
      }

      // If element exists - swap it with the old position
      if (swappedElementID !== null) {
        const swapped = <HTMLElement> this.ev.drag.grid.container.querySelector(`[data-id="${swappedElementID}"]`); // @domRead

        // Put the swapped element on the previous slot in the grid
        this.gridMap[this.ev.drag.grid.lastGridY][this.ev.drag.grid.lastGridX] = swappedElementID;

        // Update swapped element position in the dom
        swapped.style.left = `${(this.ev.drag.grid.lastGridX * this.ev.drag.grid.cellWidth)}px`; // @domWrite
        swapped.style.top = `${(this.ev.drag.grid.lastGridY * this.ev.drag.grid.cellHeight)}px`; // @domWrite
      }
      else {
        // Indicate that the previous position on the grid is empty (no element was swapped)
        this.gridMap[this.ev.drag.grid.lastGridY][this.ev.drag.grid.lastGridX] = null;
      }

      // Put the dragged element in the current slot on the grid
      this.gridMap[this.ev.drag.grid.gridY][this.ev.drag.grid.gridX] = this.ev.drag.grid.gridId;

      // Note: The dragged element position has already been updated before this if block

      // console.log(`Grid X: ${this.ev.drag.grid.gridX} Grid Y: ${this.ev.drag.grid.gridY}`);
      // console.log(`Grid helper id: ${this.ev.drag.grid.gridId}`);
      // console.log(`Swapped element ID: ${swappedElementID}`);

      this.ev.drag.grid.lastGridX = this.ev.drag.grid.gridX;
      this.ev.drag.grid.lastGridY = this.ev.drag.grid.gridY;

      // if (this.options.debugLogger) {
      //   logger('gridSwap', 'grid element swapped', {
      //     gridX: gridX,
      //     gridY: gridY,
      //     gridId: eventVars.grid.gridId,
      //     swappedElementID: swappedElementID,
      //   });
      // }
    }
  }
}
