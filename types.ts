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

interface EventListeners {
  [key: string]: SimpleEventListener | null
}

/**
 * Either a MouseEvent, PointerEvent or TouchEvent.
 * Not to be confused with PointerEvent
 */
type PointerEvents = MouseEvent | PointerEvent | TouchEvent;

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

  /**
   * Selector string to target elements which will not initialize drag
   */
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
  /**
   * The element being dragged
   */
  draggedElement: HTMLElement

  /**
   * Dragged element's position
   */
  elementX: number
  elementY: number

  /**
   * Last processed x and y pointer values
   * This is used to prevent unncessary work if the pointer position did not change
   */
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
 * Shared properties for both DraggableEvent and DraggableEventPriv
 */
interface SharedEventProperties {
 /**
  * Type of the API being used
  */
  eventType: 'mouse' | 'touch' | 'pointer'

  /**
   * Type of input device
   */
  inputDevice: 'mouse' | 'touch'

  /**
   * Pointer id - use this to prevent multiple touches
   */
  pointerId: number

  /**
   * The original element - if this.options.helper is disabled, this is also the dragged element
   */
  originalElement: HTMLElement

  /**
   * Current cursor position
   */
  pointerX: number
  pointerY: number

  /**
   * Cursor position at init
   */
  pointerX0: number
  pointerY0: number

 /**
  * Whether the ctrl key is on
  *
  * FIXME: Is it necessary? Perhaps for the callbacks
  * TODO: Instead of exposing this, expose the original event in each callback
  */
  ctrlKey: boolean

}

/**
 * Private event properties
 */
interface EventProperties extends SharedEventProperties {
  /**
   * Drag properties, initialized at dragInit()
   */
  drag: DragProperties | null
}

/**
 * Public draggable event properties exposed to callbacks
 */
interface DraggableEvent extends SharedEventProperties {
  /**
   * The name of the event, e.g. pointerdown, click, start, stop
   */
  eventName: string

  /**
   * Reference to the original DOM event
   */
  originalEvent: Event;

  /**
   * Dragged element position.
   * This will be null on non-dragging event
   */
  elementX: number | null
  elementY: number | null

  /**
   * The element being dragged.
   * This will be null on a non-drag event
   */
  draggedElement: HTMLElement | null;

}

export type {
  GridMap,
  DragProperties,
  Options,
  DraggableEvent,
  EventProperties,
  EventListeners,
  PointerEvents,
};
