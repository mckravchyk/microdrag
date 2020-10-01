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
      string // numeric element id in the grid (data-id)
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
  } | false,

  // Selector string to target elements which will not initialize drag
  cancel?: string | false

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
    container?: HTMLElement | false
  } | false
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
  } | false

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
  } | false

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
  debugLogger?: ((msg: string, data?: any) => void) | false;
}

/**
 * Interface representing the Draggable Event
 *
 * This is exposed in function callbacks
 */
interface DraggableEvent {

  draggingInProgress: boolean

  // Type of the API being used
  eventType: 'mouse' | 'touch' | 'pointer'

  // Type of input device
  inputDevice: 'mouse' | 'touch'

  // Pointer id - use this to prevent multiple touches
  pointerId: number

  // The original element - if options.helper is disabled, this is also the dragged element
  originalElement: HTMLElement

  // The element being dragged
  draggedElement: HTMLElement

  // Reference to the original event - changes over time as different events fire
  // TODO: Set it in each event listener
  originalEvent: Event;

  // Current cursor position
  pointerX: number
  pointerY: number

  // Element position
  elementX: number | false
  elementY: number | false

  // Element's original position
  elementX0: number | false
  elementY0: number | false

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

}

interface EventListeners {
  [key: string]: SimpleEventListener
}

/**
  * Simple, fast draggable library
  * @param options
  */
const Draggable = function DraggableClass(options : Options) {
  // Container for public methods
  const self = {};

  /**
   * Private event variables used internally for computation
   */
  let eventVars : EventVars = {

  };

  /**
   * Runtime variables
   */
  // Name of the end event Enum: touchend, pointerup, mouseup
  let endEvent : 'mouseup' | 'pointerup' | 'touchend';

  // Whether dragging is in progress.
  // TODO: Convert to boolean
  let draggingInProgress : boolean = false;

  // Whether the event is active. The goal is to prevent duplicate mousedown
  let eventActive = false;

  // Difference between the dragged element position (edge) and the pointer position
  let deltaX : number;
  let deltaY : number;

  // Current calculated dragged element position
  let elementX : number;
  let elementY : number;

  // Previous dragged element position
  let prevElementX : number;
  let prevElementY : number;

  // var gridHelperX, gridHelperY, gridPrevHelperX, gridPrevHelperY, gridSwappedElement;

  // Dragged element position rounded to the grid edges (if using options.grid)
  // { x: number, y: number}
  let gridHelper = null;
  let gridHelperPrev = null;

  // Unused variable?
  // let gridSwapped = null;

  // Id of the grid helper? This is very weird.
  // Also, this is assigned as a dataset-id of the original dragged element.
  let gridHelperID = null;

  // If options.containment is in use, these will be calculated as the dragged element's boundaries
  let minX : number;
  let maxX : number;
  let minY : number;
  let maxY : number;

  // Containment for options.snap
  let snapTop : number;
  let snapRight : number;
  let snapBottom : number;
  let snapLeft : number;

  // For options.cancel
  // if the pointer is initialized on excluded element, this will prevent the bubbling up
  let cancelled = false;

  /**
   * Public event properties
   */
  let dragEvent : DraggableEvent = null;

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
      delegate: false,
      callback: start,
    });
  }

  self.destroy = function() {
    for (const listener of Object.keys(eventListeners)) {
      if (eventListeners[listener] !== null) {
        eventListeners[listener].off();
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
    if (eventActive) {
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

    // Indicate that dragging is not yet in progress
    draggingInProgress = false;

    // Initialize event args. See DraggableEvent interface for definitions
    dragEvent = {
      draggingInProgress,
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
      elementX0: false,
      elementY0: false,
      elementX: false,
      elementY: false,
      // The helper is assigned in dragInit
      draggedElement: null,
    };

    // Indicate that the event is active (to prevent multiple initializations of it)
    eventActive = true;

    // Define the end event to set up event listeners. Its value depends on the event type
    endEvent = <'mouseup'|'touchend'|'pointerup'> ((dragEvent.eventType === 'touch') ? `${dragEvent.eventType}end` : `${dragEvent.eventType}up`);

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
    eventListeners.end = new SimpleEventListener({
      target: document,
      eventName: endEvent,
      callback: end,
    });
  }

  function dragInit() {
    // Create the draggable helper, if options.clone is enabled
    if (options.clone) {
      // dragEvent.draggedElement = $(dragEvent.originalElement).clone().removeAttr('id').appendTo(options.clone.attachTo).get(0);
      dragEvent.draggedElement = <HTMLElement> dragEvent.originalElement.cloneNode(true);
      dragEvent.draggedElement.setAttribute('id', '');
      options.clone.attachTo.appendChild(dragEvent.draggedElement);
    } else {
      dragEvent.draggedElement = dragEvent.originalElement;
    }

    const elementWidth = dragEvent.draggedElement.offsetWidth;
    const elementHeight = dragEvent.draggedElement.offsetHeight;

    // Set containment boundaries: minX, maxX, minY, maxY
    if (options.containment) {
      const c = options.containment;
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

      //
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
    }

    // Calculate snap edges
    if (options.snap) {
      snapTop = options.snap.edges.top;
      snapBottom = getWindowHeight() - elementHeight - options.snap.edges.bottom;
      snapLeft = options.snap.edges.left;
      snapRight = getWindowWidth() - elementWidth - options.snap.edges.right;
    }

    // Add class to the element being dragged
    dragEvent.draggedElement.className += ' draggable-dragging';

    // Enable drag cursor
    document.body.style.cursor = 'move';

    if (typeof options.onStart === 'function') {
      options.onStart(dragEvent);
    }

    // Get the difference between helper position and pointer position
    const style = getComputedStyle(dragEvent.draggedElement);
    deltaX = dragEvent.pointerX0 - parseInt(style.left, 10);
    deltaY = dragEvent.pointerY0 - parseInt(style.top, 10);

    elementX = dragEvent.pointerX - deltaX;
    elementY = dragEvent.pointerY - deltaY;

    dragEvent.elementX0 = elementX;
    dragEvent.elementY0 = elementY;
    dragEvent.elementX = elementX;
    dragEvent.elementY = elementY;

    if (options.grid) {
      dragInitGrid();
    }
  }

  /**
   * Fires each time the pointer moves
   * @param e
   */
  function move(e : MouseEvent | PointerEvent | TouchEvent) {
    let draggingJustInitialized = false;

    // Update position
    if (dragEvent.eventType === 'touch') {
      dragEvent.pointerX = (<TouchEvent>e).changedTouches[0].clientX;
      dragEvent.pointerY = (<TouchEvent>e).changedTouches[0].clientY;
    } else {
      dragEvent.pointerX = (<PointerEvent|MouseEvent>e).clientX;
      dragEvent.pointerY = (<PointerEvent|MouseEvent>e).clientY;
    }

    // Don't initiate if delta distance is too small
    if (!draggingInProgress
      && Math.sqrt(
        (dragEvent.pointerX0 - dragEvent.pointerX) * (dragEvent.pointerX0 - dragEvent.pointerX) + (dragEvent.pointerY0 - dragEvent.pointerY) * (dragEvent.pointerY0 - dragEvent.pointerY)
      ) > 2
    ) {
      // Initialize the drag
      dragInit();

      draggingJustInitialized = true;
      console.log('initiating');
      draggingInProgress = true;
    }

    if (draggingInProgress) {
      // Calculate the dragged element position
      let newLeft = dragEvent.pointerX - deltaX;
      let newTop = dragEvent.pointerY - deltaY;

      // Sanitize the position by containment boundaries
      if (options.containment) {
        // moveProcessContainment();
        // X-axis
        if (newLeft < minX) {
          newLeft = minX;
        } else if (newLeft > maxX) {
          newLeft = maxX;
        }
        // Y-axis
        if (newTop < minY) {
          newTop = minY;
        } else if (newTop > maxY) {
          newTop = maxY;
        }
      }

      // Sanitize the position for the snap feature
      if (options.snap) {
        // moveProcessSnap();
        // X-axis
        if (Math.abs(newLeft - snapLeft) < 10) {
          newLeft = snapLeft;
        } else if (Math.abs(newLeft - snapRight) < 10) {
          newLeft = snapRight;
        }
        // Y-axis
        if (Math.abs(newTop - snapTop) < 10) {
          newTop = snapTop;
        } else if (Math.abs(newTop - snapBottom) < 10) {
          newTop = snapBottom;
        }
      }

      prevElementX = elementX;
      prevElementY = elementY;

      elementX = newLeft;
      elementY = newTop;

      dragEvent.elementX = newLeft;
      dragEvent.elementY = newTop;
    }

    if (draggingJustInitialized) {
      // Start the render loop
      requestAnimationFrame(renderMove);
    }
  }

  /**
   * Render the results of move on DOM. Callback of requestAnimationFrame
   */
  function renderMove() {
    if (!draggingInProgress) {
      return;
    }

    // Schedule the next frame
    requestAnimationFrame(renderMove);

    // Exit if the position hasn't changed
    if (!draggingInProgress || (prevElementX === elementX && prevElementY === elementY)) {
      return;
    }

    // Update the dragged element position in the DOM
    dragEvent.draggedElement.style.left = `${elementX}px`;
    dragEvent.draggedElement.style.top = `${elementY}px`;

    // Process grid changes if using grid, this will also update the swapped element position
    if (options.grid) {
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

    dragEvent.originalEvent = e;

    dragEvent.ctrlKey = (dragEvent.inputDevice === 'mouse' && e.ctrlKey);

    if (draggingInProgress) {
      draggingInProgress = false;

      if (typeof options.onStop === 'function') {
        options.onStop(dragEvent);
      }

      // Reset the cursor style
      document.body.style.cursor = '';

      // Remove the draggable-dragging class from the element
      // $(dragEvent.draggedElement).removeClass('draggable-dragging');
      dragEvent.draggedElement.classList.remove('draggable-dragging');

      // Remove the clone helper if it was enabled
      if (options.clone) {
        // $(dragEvent.draggedElement).remove();
        // dragEvent.draggedElement.remove();
        options.clone.attachTo.removeChild(dragEvent.draggedElement);
      }

      // If grid - update set the final position of the element
      if (options.grid) {
        dragEvent.originalElement.style.left = `${(gridHelper.x * options.grid.cellWidth)}px`;
        dragEvent.originalElement.style.top = `${(gridHelper.y * options.grid.cellHeight)}px`;
      }
      // Else if dragging not in progress
    } else if (typeof options.onClick === 'function') {
      // Execute click callback if defined
      options.onClick(dragEvent);
    }

    // Call the stop method
    stop();
  }

  function stop() {
    console.log('Event stopped');
    // $(document).off(dragEvent.eventType+'move.draggable');
    // $(document).off(endEvent+'.draggable');
    eventListeners.move.off();
    eventListeners.end.off();
    eventListeners.move = null;
    eventListeners.end = null;
    eventActive = false;
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
    return (getPointerId(e) === dragEvent.pointerId);
  }

  /**
   * Calculate the dragged element position to be set on a grid
   */
  function calculateGridHelperPosition() {
    if (!options.grid) {
      return;
    }

    if (elementX !== dragEvent.pointerX - deltaX) {
      // console.log('Warning: X difference');
    }

    if (elementY !== dragEvent.pointerY - deltaY) {
      // console.log('Warning: Y difference');
    }

    let x = elementX;
    // var x = dragEvent.pointerX - deltaX;

    x = Math.round(x / options.grid.cellWidth);

    let y = elementY;
    // var y = dragEvent.pointerY - deltaY;

    y = Math.round(y / options.grid.cellHeight);

    if (gridHelper === null) {
      gridHelper = {};
    }

    gridHelper.x = x;
    gridHelper.y = y;
  }

  /**
   * Set up grid helper options - used by dragInit()
   */
  function dragInitGrid() {
    calculateGridHelperPosition();

    gridHelperPrev = {
      x: gridHelper.x,
      y: gridHelper.y,
    };

    // gridSwapped = null;
    gridHelperID = parseInt(dragEvent.originalElement.dataset.id, 10);
  }

  /**
   * Update the grid representation and update position of the swapped element
   * Used by renderMove()
   */
  function processGridUpdate() : void {
    if (!options.grid) {
      return;
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
    if (gridHelper.x !== gridHelperPrev.x || gridHelper.y !== gridHelperPrev.y) {
      // Id of the element that lays underneath the helper
      let elementID : string;

      try {
        // This could probably pass as undefined
        elementID = options.grid.map[gridHelper.y][gridHelper.x];
      } catch (e) {
        elementID = null;
      }

      if (typeof elementID === 'undefined') {
        elementID = null;
      }

      // If element exists - swap it with the old position
      if (elementID !== null) {
        const swapped = <HTMLElement> options.grid.container.querySelector(`[data-id="${elementID}"]`);

        // Put the swapped element on the previous slot in the grid
        options.grid.map[gridHelperPrev.y][gridHelperPrev.x] = elementID;

        // Update swapped element position in the dom
        swapped.style.left = `${(gridHelperPrev.x * options.grid.cellWidth)}px`;
        swapped.style.top = `${(gridHelperPrev.y * options.grid.cellHeight)}px`;
      } else {
        // Indicate that the previous position on the grid is empty (no element was swapped)
        options.grid.map[gridHelperPrev.y][gridHelperPrev.x] = null;
      }

      // Put the dragged element in the current slot on the grid
      options.grid.map[gridHelper.y][gridHelper.x] = gridHelperID;

      // Note: The dragged element position has already been updated before this if block

      console.log('Grid X: ' + gridHelper.x + ' Grid Y: ' + gridHelper.y);
      console.log('Grid helper id: ' + gridHelperID);
      console.log('Swapped element ID: ' + elementID);

      // Cache the previous position to be used in calculations
      gridHelperPrev.x = gridHelper.x;
      gridHelperPrev.y = gridHelper.y;
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
