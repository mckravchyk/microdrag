import {
  getWidth,
  getHeight,
  getWindowWidth,
  getWindowHeight,
} from '../util/dom';

import { SimpleEventListener } from '../util/SimpleEventListener';
import { MeasureFrequency } from './util/measure_frequency';

// import type { SimpleEventListenerOptions } from '../util/SimpleEventListener';

/**
 * Interface representing grid map for this.options.grid
 * E.g. grid.map[y][x] = elementId
 */
interface GridMap {
  [index: number]: { // y-axis column
    [index: number] : // x-axis column
      number | null // numeric element id in the grid (data-id)
  }
}

/**
 * Interface representing this.options / constructor arguments of Draggable
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
   * Breaking: this.options.helper = 'clone' to this.options.clone = { attachTo: cloneParent };
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
   * Breaking: Old usage: this.options.containment = Array<number>
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
   * Breaking: Olds specs: this.options.snap = true; this.options.snapEdges = [];
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
    // Breaking: this.options.grid.grid => this.options.grid.map
    map: GridMap
    // Breaking: this.options.delegateTarget => this.options.grid.container
    container: HTMLElement
  } | undefined

  // Event callbacks
  // Breaking: Prefixing the this.options with "on"
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

  // Last processed x and y pointer values
  // This is used to prevent unncessary work if the pointer position did not change
  lastProcessedX: number | null
  lastProcessedY: number | null

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
   * Set during dragInit() if this.options.containment is provided
   *
   * Note: Unlike this.options.containment, these are actual calculated lines/edges
   */
  containment: {
    top: number
    right: number
    bottom: number
    left: number
  } | null

  /**
   * Snap edges (calculated lines) - set during dragInit() if this.options.snap is set
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

  // The original element - if this.options.helper is disabled, this is also the dragged element
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

  // Expose the stop method to the this.dragEvent event
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
class Draggable {
  /**
   * Control variable to ignore the event on elements targeted by this.options.cancel
   */
  private cancelled = false;

  /**
   * Event properties
   * This is reset every time the event starts
   */
  private dragEvent: (DraggableEvent|null) = null;

  private options : Options;

  /**
   * Grid map representation (if this.options.grid)
   */
  private gridMap: (GridMap|null) = null;

  /**
   * Container for eventListener references
   */
  private eventListeners : EventListeners = {
    start: null,
    cancelStart: null,
    move: null,
    end: null,
  };

  /**
   * Whether the dragged element should be promoted to its own composite layer
   *
   * It's recommended for performance reasons as this will skip expensive operations such
   * as layout and paint
   * However there might be side effects, such as blurred out fonts.
   *
   */
  private enableCompositing = true;


  // const moveRate = new MeasureFrequency({
  //   requiredDataPoints: 1000,
  //   onCalculated: function(data) {
  //     console.log('move rate calculated');
  //     console.log(`Frequency: ${this.averageFrequency}`);
  //     console.log(`Avg interval: ${this.averageInterval}`);
  //   },
  // });

  constructor(options : Options) {
    // The start event to use, if Pointer API is not available, use touchstart + mousedown
    let startEventName;

    if (typeof options.startEventOverride === 'undefined') {
      startEventName = (typeof window.PointerEvent !== 'undefined') ? 'pointerdown' : 'touchstart mousedown';
    } else {
      startEventName = options.startEventOverride;
    }

// startEventName = 'touchstart mousedown';

    // Attach cancelStart event if cancelStart is defined
    if (options.cancel) {
      // TODO: Implement a "mousestart" event as extension of SimpleEventListener
      this.eventListeners.cancelStart = new SimpleEventListener({
        target: options.element,
        eventName: startEventName,
        delegate: {
          selector: options.cancel,
        },
        callback: (e : MouseEvent | PointerEvent | TouchEvent) => {
          this.cancelStart(e);
        },
      });
    }

    const self = this;

    // Attach the start event on the draggable element
    this.eventListeners.start = new SimpleEventListener({
      target: options.element,
      eventName: startEventName,
      callback(e : MouseEvent | PointerEvent | TouchEvent) {
        self.start(e, this as unknown as HTMLElement);
      },
    });

    if (typeof options.grid !== 'undefined') {
      this.gridMap = options.grid.map;
    }

    this.options = options;
  }

  public destroy() {
    for (const listener of Object.keys(this.eventListeners)) {
      if (this.eventListeners[listener] !== null) {
        // Using "!" operator - not sure why TypeScript fails here
        this.eventListeners[listener]!.off();
        this.eventListeners[listener] = null;
      }
    }
  };

  /**
   * Pointerdown callback when clicked on a cancel element
   * @param e
   *
   */
  private cancelStart(e : MouseEvent | PointerEvent | TouchEvent) {
    // Prevent the start() event from bubbling up
    this.cancelled = true;

    /**
     * Why not e.stopPropagation() ?
     *
     * An alternative to this could be to bind this function directly on a cancel element
     * and use e.stopPropgation().
     * We are not doing that, as it could interfere with broadly scoped event handlers of the app
     */

    if (Draggable.getEventType(e) === 'touch') {
      // Prevent the subsequent mousedown event from firing
      e.preventDefault();
    }
  }

  private start(e : MouseEvent | PointerEvent | TouchEvent, eventThis: HTMLElement) {
    // Exit if previously clicked on an excluded element (this.options.cancel)
    if (this.cancelled) {
      // Reset it for the next pointerdown
      this.cancelled = false;
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
    if (this.dragEvent !== null) {
      console.log('event already active!');
      return;
    }

    if (this.eventListeners.move !== null || this.eventListeners.end !== null) {
      // This should never happen - if it does something is broken
      throw new Error('Event started but listeners are already registered.');
    }

    // Get the event type: mouse, touch or pointer
    const eventType = <'mouse'|'touch'|'pointer'> Draggable.getEventType(e);

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
    this.dragEvent = {
      eventType,
      inputDevice,
      pointerId: Draggable.getPointerId(e),
      ctrlKey: (inputDevice === 'mouse' && e.ctrlKey),
      originalElement: eventThis,
      originalEvent: e,
      pointerX0,
      pointerY0,
      pointerX: pointerX0,
      pointerY: pointerY0,
      drag: null,
    };

    // Execute pointerDown callback if supplied in the this.options
    if (typeof this.options.onPointerDown === 'function') {
      this.options.onPointerDown(this.dragEvent);
    }

    // Attach move and pointerup events
    // $(document).on(`${this.dragEvent.eventType}move.draggable`, move);
    // $(document).on(`${endEvent}.draggable`, end);

    // Register move listener - the event type is deduced based on the start event type
    this.eventListeners.move = new SimpleEventListener({
      target: document,
      eventName: `${this.dragEvent.eventType}move`,
      callback: (eInner : MouseEvent | PointerEvent | TouchEvent) => {
        this.move(eInner);
      },
    });

    // Register end/up listener - the event type is deduced based on the start event type
    const endEvent = <'mouseup'|'touchend'|'pointerup'> ((this.dragEvent.eventType === 'touch') ? `${this.dragEvent.eventType}end` : `${this.dragEvent.eventType}up`);
    this.eventListeners.end = new SimpleEventListener({
      target: document,
      eventName: endEvent,
      callback: (eInner : MouseEvent | PointerEvent | TouchEvent) => {
        this.end(eInner);
      },
    });
  }

  private dragInit() {
    if (this.dragEvent === null) {
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

    let containment: DragProperties['containment'] = null;
    let snap: DragProperties['containment'] = null;

    // Create the draggable helper, if this.options.clone is enabled
    if (typeof this.options.clone !== 'undefined') {
      // @domWrite
    /**
     * Note: There is a possible layout thrashing if using the clone
     * There is no way around it, as the element has  to be cloned and its style has
     * to be calculated
     *
     */
      // TODO: Add validation to check if attachTo exists
      draggedElement = this.dragEvent.originalElement.cloneNode(true) as HTMLElement;
      draggedElement.setAttribute('id', '');
      this.options.clone.attachTo.appendChild(draggedElement);
    } else {
      draggedElement = this.dragEvent.originalElement;
    }

    // @domRead
    const elementWidth = draggedElement.offsetWidth;
    const elementHeight = draggedElement.offsetHeight;

    // Set containment boundaries: minX, maxX, minY, maxY
    if (this.options.containment) {
      let minX;
      let minY;
      let maxX;
      let maxY;

      const c = this.options.containment;
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
    if (this.options.snap) {
      snap = {
        top: this.options.snap.edges.top,
        bottom: getWindowHeight() - elementHeight - this.options.snap.edges.bottom,
        left: this.options.snap.edges.left,
        right: getWindowWidth() - elementWidth - this.options.snap.edges.right,
      };
    }

    // Get the difference between helper position and pointer position
    const style = getComputedStyle(draggedElement); // @domRead

    elementX = parseInt(style.left, 10);
    elementY = parseInt(style.top, 10);

    deltaX = this.dragEvent.pointerX0 - elementX;
    deltaY = this.dragEvent.pointerY0 - elementY;

    elementX0 = elementX;
    elementY0 = elementY;

    /**
     * Call onStart callback if defined
     *
     * Note: This function has to be placed after last dom read and before first dom write
     * So that the callback can both read and write to dom without unnecessary layout
     */
    if (typeof this.options.onStart === 'function') {
      this.options.onStart(this.dragEvent);
    }

    // Add class to the element being dragged
    draggedElement.className += ' draggable-dragging'; // @domWrite

    // Enable drag cursor
    document.body.style.cursor = 'move'; // @domWrite

    // Populate drag properties
    this.dragEvent.drag = {
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
      // Grid will be initialized in dragInitGrid() - below
      grid: null,
    };

    if (typeof this.options.grid !== 'undefined') {
      this.dragInitGrid();
    }
  }

  /**
   * Fires each time the pointer moves
   * @param e
   */
  private move(e : MouseEvent | PointerEvent | TouchEvent) {
    if (this.dragEvent === null) {
      throw new Error('Unexpected call');
    }
    if (!this.checkPointerId(e)) {
      return;
    }

    // Update position
    if (this.dragEvent.eventType === 'touch') {
      this.dragEvent.pointerX = (<TouchEvent>e).changedTouches[0].clientX;
      this.dragEvent.pointerY = (<TouchEvent>e).changedTouches[0].clientY;
    } else {
      this.dragEvent.pointerX = (<PointerEvent|MouseEvent>e).clientX;
      this.dragEvent.pointerY = (<PointerEvent|MouseEvent>e).clientY;
    }

    /**
     * Note: This might be obvious, but don't think about trying to compare previous values
     * of the pointer to see if they changed - the event already does it.
     */

    // Don't initiate if delta distance is too small
    if (this.dragEvent.drag === null
      && Math.sqrt(
        (this.dragEvent.pointerX0 - this.dragEvent.pointerX) * (this.dragEvent.pointerX0 - this.dragEvent.pointerX)
        + (this.dragEvent.pointerY0 - this.dragEvent.pointerY) * (this.dragEvent.pointerY0 - this.dragEvent.pointerY),
      ) > 2
    ) {
      // Initialize the drag
      console.log('dragInit()');
      this.dragInit();
    }

    // console.log(`move(${this.dragEvent.pointerX}, ${this.dragEvent.pointerY})`);

    // Schedule animation frame to process move
    if (this.dragEvent.drag !== null && this.dragEvent.drag.rafFrameId === null) {
      this.dragEvent.drag.rafFrameId = requestAnimationFrame(() => {
        this.rafProcessMove();
      });
      /**
       * Note: In some browsers it would be possible to skip requestAnimationFrame althogether
       * However there is no reliable way to check if the browser schedules
       * one move event per frame or not
       */
    }
  }

  /**
   * Process move - requestAnimationFrame callback
   */
  private rafProcessMove(): void {
    // This must not be allowed as the render loop is expected to be cancelled on stop
    if (this.dragEvent === null || this.dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }

    // This indicates that the frame has been processed and another one will have to be scheduled
    this.dragEvent.drag.rafFrameId = null;

    // Call the process move functions
    this.processMove();
  }

  private processMove() {
    if (this.dragEvent === null || this.dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }

    // Exit if the position didn't change
    if (
      this.dragEvent.drag.lastProcessedX === this.dragEvent.pointerX
      && this.dragEvent.drag.lastProcessedY === this.dragEvent.pointerY
    ) {
      console.log('Pointer position did not change, skipping...');
      return;
    }

    this.dragEvent.drag.lastProcessedX = this.dragEvent.pointerX;
    this.dragEvent.drag.lastProcessedY = this.dragEvent.pointerY;

    // console.log('updating position');

    // Calculate the dragged element position
    let newLeft = this.dragEvent.pointerX - this.dragEvent.drag.deltaX;
    let newTop = this.dragEvent.pointerY - this.dragEvent.drag.deltaY;

    // Sanitize the position by containment boundaries
    if (this.dragEvent.drag.containment !== null) {
      // moveProcessContainment();
      // X-axis
      if (newLeft < this.dragEvent.drag.containment.left) {
        newLeft = this.dragEvent.drag.containment.left;
      } else if (newLeft > this.dragEvent.drag.containment.right) {
        newLeft = this.dragEvent.drag.containment.right;
      }
      // Y-axis
      if (newTop < this.dragEvent.drag.containment.top) {
        newTop = this.dragEvent.drag.containment.top;
      } else if (newTop > this.dragEvent.drag.containment.bottom) {
        newTop = this.dragEvent.drag.containment.bottom;
      }
    }

    // Sanitize the position for the snap feature
    if (this.dragEvent.drag.snap !== null) {
      // moveProcessSnap();
      // X-axis
      // TODO: No magic numbers for sensitivity - add an option
      if (Math.abs(newLeft - this.dragEvent.drag.snap.left) < 10) {
        newLeft = this.dragEvent.drag.snap.left;
      } else if (Math.abs(newLeft - this.dragEvent.drag.snap.right) < 10) {
        newLeft = this.dragEvent.drag.snap.right;
      }
      // Y-axis
      if (Math.abs(newTop - this.dragEvent.drag.snap.top) < 10) {
        newTop = this.dragEvent.drag.snap.top;
      } else if (Math.abs(newTop - this.dragEvent.drag.snap.bottom) < 10) {
        newTop = this.dragEvent.drag.snap.bottom;
      }
    }

    // Update element position representation
    this.dragEvent.drag.elementX = newLeft;
    this.dragEvent.drag.elementY = newTop;

    this.renderMove();
  }

  /**
   * Render the current dragged element position on DOM
   */
  private renderMove() : void {
    if (this.dragEvent === null || this.dragEvent.drag === null) {
      throw new Error('Unexpected call');
    }

    // console.log(`renderMove(${this.dragEvent.pointerX}, ${this.dragEvent.pointerY})`);

    // Update the dragged element position in the DOM
    if (this.enableCompositing) {
      const transformX = this.dragEvent.drag.elementX - this.dragEvent.drag.elementX0;
      const transformY = this.dragEvent.drag.elementY - this.dragEvent.drag.elementY0;
      this.dragEvent.drag.draggedElement.style.transform = `translate3d(${transformX}px,${transformY}px,0)`; // @domWrite
    } else {
      this.dragEvent.drag.draggedElement.style.left = `${this.dragEvent.drag.elementX}px`; // @domWrite
      this.dragEvent.drag.draggedElement.style.top = `${this.dragEvent.drag.elementY}px`; // @domWrite
    }

    // Process grid changes if using grid, this will also update the swapped element position
    if (this.dragEvent.drag.grid !== null) {
      this.processGridUpdate();
    }
  }

  /**
   * Stops the drag event
   */
  private end(e : MouseEvent | TouchEvent | PointerEvent) {
    if (this.dragEvent === null) {
      throw new Error('Unexpected call');
    }

    // Exit if the pointer id does not match
    if (!this.checkPointerId(e)) {
      return;
    }

    this.dragEvent.originalEvent = e;

    this.dragEvent.ctrlKey = (this.dragEvent.inputDevice === 'mouse' && e.ctrlKey);

    // If dragging was initialized
    if (this.dragEvent.drag !== null) {
      // Stop requestAnimationFrame if scheduled
      if (this.dragEvent.drag.rafFrameId !== null) {
        window.cancelAnimationFrame(this.dragEvent.drag.rafFrameId);
        this.dragEvent.drag.rafFrameId = null;
      }

      // Manually call processMove() to render the last frame
      this.processMove();

      // Execute onStop callback if supplied
      if (typeof this.options.onStop === 'function') {
        this.options.onStop(this.dragEvent);
      }

      // Reset the cursor style
      document.body.style.cursor = ''; // @domWrite

      // Remove the draggable-dragging class from the element
      // $(this.dragEvent.draggedElement).removeClass('draggable-dragging');
      this.dragEvent.drag.draggedElement.classList.remove('draggable-dragging'); // @domWrite

      // If using composite layer - clean up the transform, pply the position as left/top position
      if (this.enableCompositing) {
        // FIXME: What if the element has existing transformation applied?
        this.dragEvent.drag.draggedElement.style.left = `${this.dragEvent.drag.elementX}px`;
        this.dragEvent.drag.draggedElement.style.top = `${this.dragEvent.drag.elementY}px`;
        this.dragEvent.drag.draggedElement.style.transform = '';
      }

      // Remove the clone helper if it was enabled
      if (this.options.clone) {
        // $(this.dragEvent.draggedElement).remove();
        // this.dragEvent.draggedElement.remove();
        this.options.clone.attachTo.removeChild(this.dragEvent.drag.draggedElement); // @domWrite
      // FIXME: It seems like relocating the dragged element is not part of the implementation?
      }

      // If grid - update set the final position of the element
      if (this.dragEvent.drag.grid !== null) {
        // @domWrite
        this.dragEvent.originalElement.style.left = `${(this.dragEvent.drag.grid.gridX * this.dragEvent.drag.grid.cellWidth)}px`;
        this.dragEvent.originalElement.style.top = `${(this.dragEvent.drag.grid.gridY * this.dragEvent.drag.grid.cellHeight)}px`;
      }

      // // Null the drag properties object
      // this.dragEvent.drag = null;

      // Else if dragging not in progress
    } else if (typeof this.options.onClick === 'function') {
      // Execute click callback if defined
      this.options.onClick(this.dragEvent);
    }

    // Call the stop method
    this.stop();
  }

  private stop() {
    if (this.dragEvent === null) {
      throw new Error('Unexpected call');
    }

    console.log('Event stopped');

    if (this.eventListeners.move !== null) {
      this.eventListeners.move.off();
      this.eventListeners.move = null;
    }

    if (this.eventListeners.end !== null) {
      this.eventListeners.end.off();
      this.eventListeners.end = null;
    }

    this.dragEvent.drag = null;
    this.dragEvent = null;
  }

  /**
   * Retrieve the pointer id from event object
   * @param
   */
  static getPointerId(e : TouchEvent | PointerEvent | MouseEvent) : number {
    const eventType = Draggable.getEventType(e);
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
  private checkPointerId(e: TouchEvent | PointerEvent | MouseEvent) {
    if (this.dragEvent === null) {
      throw new Error('Unexpected call');
    }
    return (Draggable.getPointerId(e) === this.dragEvent.pointerId);
  }

  /**
   * Calculate the dragged element position to be set on a grid
   */
  private calculateGridHelperPosition() {
    if (
      this.dragEvent === null
      || this.dragEvent.drag === null
      || this.dragEvent.drag.grid === null
    ) {
      throw new Error('Unexpected call');
    }

    if (this.dragEvent.drag.elementX !== this.dragEvent.pointerX - this.dragEvent.drag.deltaX) {
      // console.log('Warning: X difference');
    }

    if (this.dragEvent.drag.elementY !== this.dragEvent.pointerY - this.dragEvent.drag.deltaY) {
      // console.log('Warning: Y difference');
    }

    let x = this.dragEvent.drag.elementX;
    // var x = this.dragEvent.pointerX - deltaX;

    x = Math.round(x / this.dragEvent.drag.grid.cellWidth);

    let y = this.dragEvent.drag.elementY;
    // var y = this.dragEvent.pointerY - deltaY;

    y = Math.round(y / this.dragEvent.drag.grid.cellHeight);

    this.dragEvent.drag.grid.gridX = x;
    this.dragEvent.drag.grid.gridY = y;
  }

  /**
   * Set up grid helper this.options - used by dragInit()
   */
  private dragInitGrid() {
    if (this.dragEvent === null || this.dragEvent.drag === null || typeof this.options.grid === 'undefined') {
      throw new Error('Unexpected call');
    }

    // Set the object with grid properties
    this.dragEvent.drag.grid = {
      // FIXME: Assign grid ids
      gridId: parseInt(this.dragEvent.originalElement.dataset.gridId, 10), // @domRead
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
    this.dragEvent.drag.grid.lastGridX = this.dragEvent.drag.grid.gridX;
    this.dragEvent.drag.grid.lastGridY = this.dragEvent.drag.grid.gridY;

    // gridSwapped = null;
  }

  /**
   * Update the grid representation and update position of the swapped element
   * Used by renderMove()
   */
  private processGridUpdate() : void {
    if (this.dragEvent === null || this.dragEvent.drag === null
      || this.dragEvent.drag.grid === null || this.gridMap === null) {
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

    this.calculateGridHelperPosition();

    // If the position of the helper changes in the grid
    if (
      this.dragEvent.drag.grid.gridX !== this.dragEvent.drag.grid.lastGridX
      || this.dragEvent.drag.grid.gridY !== this.dragEvent.drag.grid.lastGridY
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
        typeof this.gridMap[this.dragEvent.drag.grid.gridY] !== 'undefined'
        && typeof this.gridMap[this.dragEvent.drag.grid.gridY][this.dragEvent.drag.grid.gridX] !== 'undefined'
      ) {
        swappedElementID = this.gridMap[this.dragEvent.drag.grid.gridY][this.dragEvent.drag.grid.gridX];
      }

      // If element exists - swap it with the old position
      if (swappedElementID !== null) {
        const swapped = <HTMLElement> this.dragEvent.drag.grid.container.querySelector(`[data-id="${swappedElementID}"]`); // @domRead

        // Put the swapped element on the previous slot in the grid
        this.gridMap[this.dragEvent.drag.grid.lastGridY][this.dragEvent.drag.grid.lastGridX] = swappedElementID;

        // Update swapped element position in the dom
        swapped.style.left = `${(this.dragEvent.drag.grid.lastGridX * this.dragEvent.drag.grid.cellWidth)}px`; // @domWrite
        swapped.style.top = `${(this.dragEvent.drag.grid.lastGridY * this.dragEvent.drag.grid.cellHeight)}px`; // @domWrite
      } else {
        // Indicate that the previous position on the grid is empty (no element was swapped)
        this.gridMap[this.dragEvent.drag.grid.lastGridY][this.dragEvent.drag.grid.lastGridX] = null;
      }

      // Put the dragged element in the current slot on the grid
      this.gridMap[this.dragEvent.drag.grid.gridY][this.dragEvent.drag.grid.gridX] = this.dragEvent.drag.grid.gridId;

      // Note: The dragged element position has already been updated before this if block

      console.log(`Grid X: ${this.dragEvent.drag.grid.gridX} Grid Y: ${this.dragEvent.drag.grid.gridY}`);
      console.log(`Grid helper id: ${this.dragEvent.drag.grid.gridId}`);
      console.log(`Swapped element ID: ${swappedElementID}`);

      // Cache the previous position to be used in calculations
      this.dragEvent.drag.grid.lastGridX = this.dragEvent.drag.grid.gridX;
      this.dragEvent.drag.grid.lastGridY = this.dragEvent.drag.grid.gridY;

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

  /**
   * Get the event type
   * @param e Event instance
   */
  static getEventType(e: Event) : string {
    // Note: Checking instanceof is much faster than processing contructor name
    if (e instanceof PointerEvent) {
      return 'pointer';
    }
    if (e instanceof MouseEvent) {
      return 'mouse';
    }
    if (e instanceof TouchEvent) {
      return 'touch';
    }
    // We are not expecting any other event types - default to getting the name from constructor
    return e.constructor.name.replace('Event', '').toLocaleLowerCase();
  }

  //TODO: Re-implement it without jQuery
  public setOptions(_options) {
    // $.extend(true, this.options, _this.options);
  };
};

export default Draggable;
