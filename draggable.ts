import {
  getWidth,
  getHeight,
  getWindowWidth,
  getWindowHeight,
} from '../util/domUtils';

import { SimpleEventListener } from '../util/SimpleEventListener';
// import type { SimpleEventListenerOptions } from '../util/SimpleEventListener';

/**
 * Interface representing grid map for options.grid
 * E.g. grid.map[y][x] = elementId
 */
interface GridMap {
  [index: number]: { // y-axis column
    [index: number] : // x-axis column
      number | null // numeric element id in the grid (data-id)
  }
}

/**
 * Interface representing options / constructor arguments of Draggable
 */
interface Options {
  // The element to make draggable
  element: HTMLElement,
  /**
   * Draggable clone
   *
   * If enabled, the element will be cloned and the clone will be dragged.
   * Then the original element will re-appear where the clone was dropped
   *
   * Breaking: options.helper = 'clone' to options.clone = { attachTo: cloneParent };
   */
  clone?: {
    // Specify the target where the draggable element is to be attached
    attachTo: HTMLElement
  } | undefined,

  // Selector string to target elements which will not initialize drag
  cancel?: string | undefined

  /**
   * Containment - set drag boundaries which element will not cross
   *
   * Breaking: Old usage: options.containment = Array<number>
   */
  containment?: {
    /**
     * Containment edges
     *
     * If the number is non-negative, this is the distance from the window boundary
     * If the number is negative, the dragged element can go past the boundary until
     *  only x pixels of it are visible, x being the absolute value of the boundary edge value
     *  If the right boundary is set to -30px, the element can be dragged all the way right
     *  until only 30px of it are visible on the left side
     *
     * TODO: number | false - allow to specify snap only for certain edges. Low priority.
     */
    edges: {
      top: number
      right: number
      bottom: number
      left: number
    }
    /**
     * Containment container
     * The edges will be calculated relative to container element boundaries
     *
     * Note: Currently this is ignored for negative-value edges.
     *
     * TODO: Make it work with negative edges. Low priority
     */
    container?: HTMLElement | undefined
  } | undefined
  /**
   * Snap. Make the dragged element snap to edges
   *
   * Breaking: Olds specs: options.snap = true; options.snapEdges = [];
   */
  snap?: {
    /**
     * Snap edges relative to the container dimensions or window
     *
     * E.g. if top is set to 30px and window is the container, the element can't
     * be dragged closer than 30px to the edge of the window
     *
     * TODO: number | false - allow to specify snap only for certain edges. Low priority.
     */
    edges: {
      top: number
      right: number
      bottom: number
      left: number
    }
    /**
     * Edge container
     * The edges will be calculated relative to container element boundaries
     * TODO: Not implemented yet. Low priority.
     */
    // container: HTMLElement | false
  } | undefined

  /**
   * Grid-mode - move elements on a defined grid and swap elements when they overlap
   */
  grid?: {
    cellWidth: number
    cellHeight: number
    // Breaking: options.grid.grid => options.grid.map
    map: GridMap
    // Breaking: options.delegateTarget => options.grid.container
    container: HTMLElement
  } | undefined

  // Event callbacks
  // Breaking: Prefixing the options with "on"
  onPointerDown?: Function
  onClick?: Function
  onStart?: Function
  onStop?: Function

  /**
   * Add a callback to listen for log messages
   * @param msg Message
   * @param data Log event data
   */
  debugLogger?: ((id: string, msg: string, data?: any) => void) | false;
}

/**
 * Interface representing eventVars.drag object
 * These are properties which are specific to dragging and initialized in dragInit()
 */
interface DragProperties {
  // The element being dragged
  draggedElement: HTMLElement

  // Dragged element's position
  elementX: number
  elementY: number

  // Previous dragged element position
  lastElementRenderedX: number;
  lastElementRenderedY: number;

  // Dragged element's original position
  elementX0: number
  elementY0: number

  // Difference between the dragged element position (edge) and the pointer position
  deltaX: number;
  deltaY: number;

  /**
   * Current id for window.requestAnimationFrame, part of the render loop
   */
  rafFrameId: number | null

  /**
   * Containment boundaries
   * Set during dragInit() if options.containment is provided
   *
   * Note: Unlike options.containment, these are actual calculated lines/edges
   */
  containment: {
    top: number
    right: number
    bottom: number
    left: number
  } | null

  /**
   * Snap edges (calculated lines) - set during dragInit() if options.snap is set
   */
  snap: {
    top: number
    right: number
    bottom: number
    left: number
  } | null

    /**
   * Grid properties - set at dragInit() if optionns.grid is set
   */
  grid: {
    /**
     * Id of the dragged element in the grid
     * This is a special grid id, not to be confused with actual element's id
     * Each element in the grid has an id, stored in dataset.gridId
     * FIXME: This id should be automatically assigned.
     */
    gridId: number
    /**
     * Grid cell width (in px)
     * This is used to translate raw px positions to grid positions and vice versa
     */
    cellWidth: number
    cellHeight: number
    /**
     * Reference to the HTMLElement which is the container for the grid
     */
    container: HTMLElement
    /**
     * Current position of dragged element in the grid
     * The position is an integer representing the column in the grid
     */
    gridX: number
    gridY: number
    /**
     * Previous grid positions which are used for comparison
     */
    lastGridX: number
    lastGridY: number
  } | null

}

/**
 * Interface representing the Draggable Event
 *
 * This is exposed in function callbacks
 */
interface DraggableEvent {

  // Type of the API being used
  eventType: 'mouse' | 'touch' | 'pointer'

  // Type of input device
  inputDevice: 'mouse' | 'touch'

  // Pointer id - use this to prevent multiple touches
  pointerId: number

  // The original element - if options.helper is disabled, this is also the dragged element
  originalElement: HTMLElement

  // Reference to the original event - changes over time as different events fire
  // TODO: Set it in each event listener
  originalEvent: Event;

  // Current cursor position
  pointerX: number
  pointerY: number

  // Cursor position at init
  pointerX0: number
  pointerY0: number

  // FIXME: Is it necessary? Perhaps for the callbacks
  // TODO: Instead of exposing this, expose the original event in each callback
  // Whether the ctrl key is on
  ctrlKey: boolean

  // Expose the stop method to the dragEvent event
  // Breaking: Disabled on 2020-09-28
  // stop: Function

  drag: DragProperties | null

}

/**
 * Interface representing event vars
 * In contrast to DraggableEvent, the additional properties here are private
 */
interface DraggableEventVars extends DraggableEvent {

    // Current calculated dragged element position
    // elementX: number | null;
    // elementY: number | null;
}

interface EventListeners {
  [key: string]: SimpleEventListener | null
}

/**
  * Simple, fast draggable library
  * @param options
  */
const Draggable = function DraggableClass(options : Options) {
  // Container for public methods
  const self = {};

  // For options.cancel
  // if the pointer is initialized on excluded element, this will prevent the bubbling up
  // @member
  let cancelled = false;

  /**
   * Public event properties
   */
  let dragEvent: (DraggableEvent|null) = null;

  /**
   * Grid map representation (if options.grid)
   */
  let gridMap: (GridMap|null) = null;

  /**
   * Runtime variables
   */

  // Unused variable?
  // let gridSwapped = null;

  const eventListeners : EventListeners = {
    start: null,
    cancelStart: null,
    move: null,
    end: null,
  };

  function construct() {
    // The start event to use, if Pointer API is not available, use touchstart + mousedown
    const startEventName = (typeof window.PointerEvent !== 'undefined') ? 'pointerdown' : 'touchstart mousedown';

    // Attach cancelStart event if cancelStart is defined
    if (options.cancel) {
      // TODO: Implement a "mousestart" event as extension of SimpleEventListener
      eventListeners.cancelStart = new SimpleEventListener({
        target: options.element,
        eventName: startEventName,
        delegate: {
          selector: options.cancel,
        },
        callback: cancelStart,
      });
    }

    // Attach the start event on the draggable element
    eventListeners.start = new SimpleEventListener({
      target: options.element,
      eventName: startEventName,
      callback: start,
    });

    if (typeof options.grid !== 'undefined') {
      gridMap = options.grid.map;
    }
  }

  self.destroy = function() {
    for (const listener of Object.keys(eventListeners)) {
      if (eventListeners[listener] !== null) {
        // Using "!" operator - not sure why TypeScript fails here
        eventListeners[listener]!.off();
        eventListeners[listener] = null;
      }
    }
  };

  /**
   * Pointerdown callback when clicked on a cancel element
   * @param e
   *
   */
  function cancelStart(e : MouseEvent | PointerEvent | TouchEvent) {
    // Prevent the start() event from blubbling up
    cancelled = true;

    /**
     * Why not e.stopPropagation() ?
     *
     * An alternative to this could be to bind this function directly on a cancel element
     * and use e.stopPropgation().
     * We are not doing that, as it could interfere with broadly scoped event handlers of the app
     */

    if (getEventType(e) === 'touch') {
      // Prevent the subsequent mousedown event from firing
      e.preventDefault();
    }
  }

  function start(e : MouseEvent | PointerEvent | TouchEvent) {
    // Exit if previously clicked on an excluded element (options.cancel)
    if (cancelled) {
      // Reset it for the next pointerdown
      cancelled = false;
      return;
    }

    // Prevent default actions and bubbling up
    e.preventDefault();

    /**
     * Exit if the event is already active
     *
     * Prevents double firing of the event in "touchstart mousedown" setup
     * Prevents any other edge cases such as multiple-pointers
     */
    if (dragEvent !== null) {
      console.log('event already active!');
      return;
    }

    if (eventListeners.move !== null || eventListeners.end !== null) {
      // This should never happen - if it does something is broken
      throw new Error('Event started but listeners are already registered.');
    }

    // Get the event type: mouse, touch or pointer
    const eventType = <'mouse'|'touch'|'pointer'> getEventType(e);

    // Get the input device: mouse or touch
    const inputDevice = ((eventType === 'pointer' && (e as PointerEvent).pointerType === 'mouse') || eventType === 'mouse') ? 'mouse' : 'touch';

    // Exit if not Left Mouse Button
    if (inputDevice === 'mouse' && (e as MouseEvent | PointerEvent).button !== 0) {
      return;
    }

    // Exit if not single touch.
    // FIXME: This only considers the Touch API. Implementation is missing for Pointer API
    if (eventType === 'touch' && (e as TouchEvent).touches.length !== 1) {
      return;
    }

    // Get the initial pointer position
    let pointerX0 : number;
    let pointerY0 : number;

    if (eventType === 'touch') {
      pointerX0 = (e as TouchEvent).touches[0].clientX;
      pointerY0 = (e as TouchEvent).touches[0].clientY;
    } else {
      pointerX0 = (e as MouseEvent | PointerEvent).clientX;
      pointerY0 = (e as MouseEvent | PointerEvent).clientY;
    }

    // Initialize event args. See DraggableEvent interface for definitions
    dragEvent = {
      eventType,
      inputDevice,
      pointerId: getPointerId(e),
      ctrlKey: (inputDevice === 'mouse' && e.ctrlKey),
      originalElement: this,
      originalEvent: e,
      pointerX0,
      pointerY0,
      pointerX: pointerX0,
      pointerY: pointerY0,
      drag: null,
    };

    // Execute pointerDown callback if supplied in the options
    if (typeof options.onPointerDown === 'function') {
      options.onPointerDown(dragEvent);
    }

    // Attach move and pointerup events
    // $(document).on(`${dragEvent.eventType}move.draggable`, move);
    // $(document).on(`${endEvent}.draggable`, end);

    // Register move listener - the event type is deduced based on the start event type
    eventListeners.move = new SimpleEventListener({
      target: document,
      eventName: `${dragEvent.eventType}move`,
      callback: move,
    });

    // Register end/up listener - the event type is deduced based on the start event type
    const endEvent = <'mouseup'|'touchend'|'pointerup'> ((dragEvent.eventType === 'touch') ? `${dragEvent.eventType}end` : `${dragEvent.eventType}up`);
    eventListeners.end = new SimpleEventListener({
      target: document,
      eventName: endEvent,
      callback: end,
    });
  }

  function dragInit() {
    if (dragEvent === null) {
      throw new Error('Unexpected call');
    }

    // Prepare dragging vars
    let draggedElement : HTMLElement;

    let deltaX: number = 0;
    let deltaY: number = 0;
    let elementX: number = 0;
    let elementY: number = 0;
    let elementX0: number = 0;
    let elementY0: number = 0;
    let lastElementRenderedX: number = 0;
    let lastElementRenderedY: number = 0;

    let containment: DragProperties['containment'] = null;
    let snap: DragProperties['containment'] = null;

    // Create the draggable helper, if options.clone is enabled
    if (typeof options.clone !== 'undefined') {
      // TODO: Add validation to check if attachTo exists
      // dragEvent.draggedElement = $(dragEvent.originalElement).clone().removeAttr('id').appendTo(options.clone.attachTo).get(0);
      // @domWrite
      draggedElement = <HTMLElement> dragEvent.originalElement.cloneNode(true);
      draggedElement.setAttribute('id', '');
      options.clone.attachTo.appendChild(draggedElement);
    } else {
      draggedElement = dragEvent.originalElement;
    }

    // @domRead
    const elementWidth = draggedElement.offsetWidth;
    const elementHeight = draggedElement.offsetHeight;

    // Set containment boundaries: minX, maxX, minY, maxY
    if (options.containment) {
      let minX;
      let minY;
      let maxX;
      let maxY;

      const c = options.containment;
      // domRead:
      const windowWidth = getWindowWidth();
      const windowHeight = getWindowHeight();

      // Get the container dimensions, from container if exists, browser window otherwise
      const containerWidth = (c.container) ? getWidth(c.container) : windowWidth;
      const containerHeight = (c.container) ? getHeight(c.container) : windowHeight;

      /**
       * A note about negative boundaries c < 0
       *
       * If a boundary is negative, it allows the element to go past the boundary edge
       * The element can go as deep as x pxs from the opposite side of the element
       *
       * For example, if the right boundary is set to -100px, the element
       * can be dragged past the right edge all the way until 100px of the element's
       * left side are still visible
       */

      // minY (top boundary)
      if (c.edges.top >= 0) minY = c.edges.top;
      else minY = -elementHeight - c.edges.top;

      // maxX (right boundary)
      if (c.edges.right >= 0) maxX = containerWidth - elementWidth - c.edges.right;
      else maxX = windowWidth + c.edges.right;

      // maxY (bottom boundary)
      if (c.edges.bottom >= 0) maxY = containerHeight - elementHeight - c.edges.bottom;
      else maxY = windowHeight + c.edges.bottom;

      // minX (left boundary)
      if (c.edges.left >= 0) minX = c.edges.left;
      else minX = -elementWidth - c.edges.left;

      /**
       * This was left commented out with the following note:
       *  "translate these limits to pointer coordinates"
       */
      /*
      minY+=deltaY;
      maxX+=deltaX;
      maxY+=deltaY;
      minX+=deltaX
      */

      containment = {
        top: minY,
        right: maxX,
        bottom: maxY,
        left: minX,
      };
    }

    // Calculate snap edges
    // domRead:
    if (options.snap) {
      snap = {
        top: options.snap.edges.top,
        bottom: getWindowHeight() - elementHeight - options.snap.edges.bottom,
        left: options.snap.edges.left,
        right: getWindowWidth() - elementWidth - options.snap.edges.right,
      };
    }

    // Add class to the element being dragged
    draggedElement.className += ' draggable-dragging'; // @domWrite

    // Enable drag cursor
    document.body.style.cursor = 'move'; // @domWrite

    if (typeof options.onStart === 'function') {
      options.onStart(dragEvent);
    }

    // Get the difference between helper position and pointer position
    const style = getComputedStyle(draggedElement); // @domRead
    deltaX = dragEvent.pointerX0 - parseInt(style.left, 10);
    deltaY = dragEvent.pointerY0 - parseInt(style.top, 10);

    elementX = dragEvent.pointerX - deltaX;
    elementY = dragEvent.pointerY - deltaY;

    elementX0 = elementX;
    elementY0 = elementY;
    lastElementRenderedX = elementX;
    lastElementRenderedY = elementY;

    // Populate drag properties
    dragEvent.drag = {
      draggedElement,
      deltaX,
      deltaY,
      elementX,
      elementY,
      elementX0,
      elementY0,
      lastElementRenderedX,
      lastElementRenderedY,
      rafFrameId: null,
      containment,
      snap,
      // Grid will be initialized in dragInitGrid() - below
      grid: null,
    };

    if (typeof options.grid !== 'undefined') {
      dragInitGrid();
    }
  }

  /**
   * Fires each time the pointer moves
   * @param e
   */
  function move(e : MouseEvent | PointerEvent | TouchEvent) {
    if (dragEvent === null) {
      throw new Error('Unexpected call');
    }
    let draggingJustInitialized = false;

    // Update position
    if (dragEvent.eventType === 'touch') {
      dragEvent.pointerX = (<TouchEvent>e).changedTouches[0].clientX;
      dragEvent.pointerY = (<TouchEvent>e).changedTouches[0].clientY;
    } else {
      dragEvent.pointerX = (<PointerEvent|MouseEvent>e).clientX;
      dragEvent.pointerY = (<PointerEvent|MouseEvent>e).clientY;
    }

    /**
     * Note: This might be obvious, but don't think about trying to compare previous values
     * of the pointer to see if they changed - the event already does it.
     */

    // Don't initiate if delta distance is too small
    if (dragEvent.drag === null
      && Math.sqrt(
        (dragEvent.pointerX0 - dragEvent.pointerX) * (dragEvent.pointerX0 - dragEvent.pointerX)
        + (dragEvent.pointerY0 - dragEvent.pointerY) * (dragEvent.pointerY0 - dragEvent.pointerY),
      ) > 2
    ) {
      // Initialize the drag
      dragInit();

      draggingJustInitialized = true;
      console.log('initiating');
    }

    console.log(`move(${dragEvent.pointerX}, ${dragEvent.pointerY})`);

    // If dragging is active
    if (dragEvent.drag !== null) {
      console.log('updating position');

      // Calculate the dragged element position
      let newLeft = dragEvent.pointerX - dragEvent.drag.deltaX;
      let newTop = dragEvent.pointerY - dragEvent.drag.deltaY;

      // Sanitize the position by containment boundaries
      if (dragEvent.drag.containment !== null) {
        // moveProcessContainment();
        // X-axis
        if (newLeft < dragEvent.drag.containment.left) {
          newLeft = dragEvent.drag.containment.left;
        } else if (newLeft > dragEvent.drag.containment.right) {
          newLeft = dragEvent.drag.containment.right;
        }
        // Y-axis
        if (newTop < dragEvent.drag.containment.top) {
          newTop = dragEvent.drag.containment.top;
        } else if (newTop > dragEvent.drag.containment.bottom) {
          newTop = dragEvent.drag.containment.bottom;
        }
      }

      // Sanitize the position for the snap feature
      if (dragEvent.drag.snap !== null) {
        // moveProcessSnap();
        // X-axis
        if (Math.abs(newLeft - dragEvent.drag.snap.left) < 10) {
          newLeft = dragEvent.drag.snap.left;
        } else if (Math.abs(newLeft - dragEvent.drag.snap.right) < 10) {
          newLeft = dragEvent.drag.snap.right;
        }
        // Y-axis
        if (Math.abs(newTop - dragEvent.drag.snap.top) < 10) {
          newTop = dragEvent.drag.snap.top;
        } else if (Math.abs(newTop - dragEvent.drag.snap.bottom) < 10) {
          newTop = dragEvent.drag.snap.bottom;
        }
      }

      // Cache the previous element poistion value for comparison
      // dragEvent.drag.lastElementRenderedX = dragEvent.drag.elementX;
      // dragEvent.drag.lastElementRenderedY = dragEvent.drag.elementY;

      // Update element position representation
      dragEvent.drag.elementX = newLeft;
      dragEvent.drag.elementY = newTop;
    }

    if (draggingJustInitialized) {
      // Start the render loop
      // rafFrameId = requestAnimationFrame(renderMove);
      startRenderLoop();
    }
  }

  /**
   * Render the current dragged element position on DOM
   *
   * This function is called by the render loop to update dom position during dragging
   */
  function renderMove() : void {
    if (dragEvent === null || dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }

    // Exit if the position didn't change
    if (
      dragEvent.drag.lastElementRenderedX === dragEvent.drag.elementX
      && dragEvent.drag.lastElementRenderedY === dragEvent.drag.elementY
    ) {
      return;
    }

    // Cache the rendered position to compare in next call
    dragEvent.drag.lastElementRenderedX = dragEvent.drag.elementX;
    dragEvent.drag.lastElementRenderedY = dragEvent.drag.elementY;

    console.log(`renderMove(${dragEvent.pointerX}, ${dragEvent.pointerY})`);

// console.log(`Just thrashing: ${dragEvent.drag.draggedElement.style.left}`);

    // Update the dragged element position in the DOM
    // @domWrite
    dragEvent.drag.draggedElement.style.left = `${dragEvent.drag.elementX}px`;
    dragEvent.drag.draggedElement.style.top = `${dragEvent.drag.elementY}px`;

// console.log(`Just thrashing: ${dragEvent.drag.draggedElement.style.left}`);

    // Process grid changes if using grid, this will also update the swapped element position
    if (dragEvent.drag.grid !== null) {
      processGridUpdate();
    }
  }

  /**
   * Stops the drag event
   */
  function end(e : MouseEvent | TouchEvent | PointerEvent) {
    if (!checkPointerId(e)) {
      return;
    }

    if (dragEvent === null) {
      // The event must be active
      throw new Error('Unexpected call');
    }

    dragEvent.originalEvent = e;

    dragEvent.ctrlKey = (dragEvent.inputDevice === 'mouse' && e.ctrlKey);

    // If dragging was initialized
    if (dragEvent.drag !== null) {
      // Stop the render loop
      stopRenderLoop();

      // Manually render the last frame
      renderMove();

      if (typeof options.onStop === 'function') {
        options.onStop(dragEvent);
      }

      // Reset the cursor style
      document.body.style.cursor = ''; // @domWrite

      // Remove the draggable-dragging class from the element
      // $(dragEvent.draggedElement).removeClass('draggable-dragging');
      dragEvent.drag.draggedElement.classList.remove('draggable-dragging'); // @domWrite

      // Remove the clone helper if it was enabled
      if (options.clone) {
        // $(dragEvent.draggedElement).remove();
        // dragEvent.draggedElement.remove();
        options.clone.attachTo.removeChild(dragEvent.drag.draggedElement); // @domWrite
      }

      // If grid - update set the final position of the element
      if (dragEvent.drag.grid !== null) {
        // @domWrite
        dragEvent.originalElement.style.left = `${(dragEvent.drag.grid.gridX * dragEvent.drag.grid.cellWidth)}px`;
        dragEvent.originalElement.style.top = `${(dragEvent.drag.grid.gridY * dragEvent.drag.grid.cellHeight)}px`;
      }

      // // Null the drag properties object
      // dragEvent.drag = null;

      // Else if dragging not in progress
    } else if (typeof options.onClick === 'function') {
      // Execute click callback if defined
      options.onClick(dragEvent);
    }

    // Call the stop method
    stop();
  }

  function stop() {
    if (dragEvent === null) {
      throw new Error('Unexpected call');
    }
    console.log('Event stopped');
    // $(document).off(dragEvent.eventType+'move.draggable');
    // $(document).off(endEvent+'.draggable');

    // Ensure the render loop is stopped
    stopRenderLoop();

    if (eventListeners.move !== null) {
      eventListeners.move.off();
      eventListeners.move = null;
    }

    if (eventListeners.end !== null) {
      eventListeners.end.off();
      eventListeners.end = null;
    }

    dragEvent.drag = null;
    dragEvent = null;
  }

  /**
   * Retrieve the pointer id from event object
   * @param
   */
  function getPointerId(e : TouchEvent | PointerEvent | MouseEvent) : number {
    const eventType = getEventType(e);
    let pointerId : number;

    if (eventType === 'touch') {
      pointerId = (<TouchEvent>e).changedTouches[0].identifier;
    } else if (eventType === 'pointer') {
      pointerId = (<PointerEvent>e).pointerId;
    } else {
      pointerId = 1;
    }
    return pointerId;
  }

  /**
   * Check if the DOM Event pointer id matches the pointer which initiated drag
   * @param e DOM Event to check
   */
  function checkPointerId(e: TouchEvent | PointerEvent | MouseEvent) {
    if (dragEvent === null) {
      throw new Error('Unexpected call');
    }
    return (getPointerId(e) === dragEvent.pointerId);
  }

  /**
   * Start the render loop
   *
   * The render loop brings a performance benefit
   * Instead of updating the dom everytime a mousemove event fires
   * The render loop will update dom only when a new frame is requested
   */
  function startRenderLoop(): void {
    if (dragEvent === null || dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }
    if (dragEvent.drag.rafFrameId !== null) {
      throw new Error('Loop is already active');
    }
    dragEvent.drag.rafFrameId = window.requestAnimationFrame(renderLoopCallback);
  }

  /**
   * Stop the render loop
   */
  function stopRenderLoop(): void {
    if (dragEvent === null || dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }
    if (dragEvent.drag.rafFrameId !== null) {
      window.cancelAnimationFrame(dragEvent.drag.rafFrameId);
      dragEvent.drag.rafFrameId = null;
    }
  }

  /**
   * Process render loop tick (callback to window.requestAnimationFrame)
   * @param timestamp DOMHighResTimeStamp
   */
  function renderLoopCallback(timestamp: number): void {
    // This must not be allowed as the render loop is expected to be cancelled on stop
    if (dragEvent === null || dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }

    console.log('rafCallback');

    // Schedule the next frame
    dragEvent.drag.rafFrameId = window.requestAnimationFrame(renderLoopCallback);

    // Render current frame
    renderMove();
  }

  /**
   * Calculate the dragged element position to be set on a grid
   */
  function calculateGridHelperPosition() {
    if (dragEvent === null || dragEvent.drag === null || dragEvent.drag.grid === null) {
      throw new Error('Unexpected call');
    }

    if (dragEvent.drag.elementX !== dragEvent.pointerX - dragEvent.drag.deltaX) {
      // console.log('Warning: X difference');
    }

    if (dragEvent.drag.elementY !== dragEvent.pointerY - dragEvent.drag.deltaY) {
      // console.log('Warning: Y difference');
    }

    let x = dragEvent.drag.elementX;
    // var x = dragEvent.pointerX - deltaX;

    x = Math.round(x / dragEvent.drag.grid.cellWidth);

    let y = dragEvent.drag.elementY;
    // var y = dragEvent.pointerY - deltaY;

    y = Math.round(y / dragEvent.drag.grid.cellHeight);

    dragEvent.drag.grid.gridX = x;
    dragEvent.drag.grid.gridY = y;
  }

  /**
   * Set up grid helper options - used by dragInit()
   */
  function dragInitGrid() {
    if (dragEvent === null || dragEvent.drag === null || typeof options.grid === 'undefined') {
      throw new Error('Unexpected call');
    }

    // Set the object with grid properties
    dragEvent.drag.grid = {
      // FIXME: Assign grid ids
      gridId: parseInt(dragEvent.originalElement.dataset.gridId, 10), // @domRead
      container: options.grid.container,
      cellWidth: options.grid.cellWidth,
      cellHeight: options.grid.cellHeight,
      gridX: 0,
      gridY: 0,
      lastGridX: 0,
      lastGridY: 0,
    };

    // This will populate gridX and gridY properties of eventVars.grid
    calculateGridHelperPosition();

    // Populate the last position variables
    dragEvent.drag.grid.lastGridX = dragEvent.drag.grid.gridX;
    dragEvent.drag.grid.lastGridY = dragEvent.drag.grid.gridY;

    // gridSwapped = null;
  }

  /**
   * Update the grid representation and update position of the swapped element
   * Used by renderMove()
   */
  function processGridUpdate() : void {
    if (dragEvent === null || dragEvent.drag === null || dragEvent.drag.grid === null || gridMap === null) {
      throw new Error('Unexpected call');
    }

    /*
    An old note:
    *
    on drag init element starts with helperGridX and helperGridY
    get current position, if changed continue
    if there was element swapped previously, restore it to the previous position
    if another element lays on current position, 
      swap it with the old positions (prevHelperGridX, prevHelperGridY)
    *
   //you must check if the grid position changed and then execute proper actions
    //you must get and store the position of the dragged element
    //if the position changed, find element under that position and if it exists, swap it
    //swappedElementID = -1 or ID
    */

    calculateGridHelperPosition();

    // If the position of the helper changes in the grid
    if (
      dragEvent.drag.grid.gridX !== dragEvent.drag.grid.lastGridX
      || dragEvent.drag.grid.gridY !== dragEvent.drag.grid.lastGridY
    ) {
      /**
       * Swap grid elements
       *
       * When the dragged element enters the place on the grid of another element,
       * the element which is there has to be swapped to the previous grid position
       * of the dragged element
       */

      // Id of the element which is to be swapped/replaced by the dragged element
      let swappedElementID : number | null = null;

      if (
        typeof gridMap[dragEvent.drag.grid.gridY] !== 'undefined'
        && typeof gridMap[dragEvent.drag.grid.gridY][dragEvent.drag.grid.gridX] !== 'undefined'
      ) {
        swappedElementID = gridMap[dragEvent.drag.grid.gridY][dragEvent.drag.grid.gridX];
      }

      // If element exists - swap it with the old position
      if (swappedElementID !== null) {
        const swapped = <HTMLElement> dragEvent.drag.grid.container.querySelector(`[data-id="${swappedElementID}"]`); // @domRead

        // Put the swapped element on the previous slot in the grid
        gridMap[dragEvent.drag.grid.lastGridY][dragEvent.drag.grid.lastGridX] = swappedElementID;

        // Update swapped element position in the dom
        swapped.style.left = `${(dragEvent.drag.grid.lastGridX * dragEvent.drag.grid.cellWidth)}px`; // @domWrite
        swapped.style.top = `${(dragEvent.drag.grid.lastGridY * dragEvent.drag.grid.cellHeight)}px`; // @domWrite
      } else {
        // Indicate that the previous position on the grid is empty (no element was swapped)
        gridMap[dragEvent.drag.grid.lastGridY][dragEvent.drag.grid.lastGridX] = null;
      }

      // Put the dragged element in the current slot on the grid
      gridMap[dragEvent.drag.grid.gridY][dragEvent.drag.grid.gridX] = dragEvent.drag.grid.gridId;

      // Note: The dragged element position has already been updated before this if block

      console.log(`Grid X: ${dragEvent.drag.grid.gridX} Grid Y: ${dragEvent.drag.grid.gridY}`);
      console.log(`Grid helper id: ${dragEvent.drag.grid.gridId}`);
      console.log(`Swapped element ID: ${swappedElementID}`);

      // Cache the previous position to be used in calculations
      dragEvent.drag.grid.lastGridX = dragEvent.drag.grid.gridX;
      dragEvent.drag.grid.lastGridY = dragEvent.drag.grid.gridY;

      // if (options.debugLogger) {
      //   logger('gridSwap', 'grid element swapped', {
      //     gridX: gridX,
      //     gridY: gridY,
      //     gridId: eventVars.grid.gridId,
      //     swappedElementID: swappedElementID,
      //   });
      // }
    }
  }

  /**
   * Get the event type
   * @param e Event instance
   * @public static
   */
  function getEventType(e: Event) : string {
    return e.constructor.name.replace('Event', '').toLocaleLowerCase();
  }

  //TODO: Re-implement it without jQuery
  self.setOptions = function(_options) {
    // $.extend(true, options, _options);
  };

  construct();
  return self;
};

export default Draggable;
