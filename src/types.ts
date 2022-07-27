/**
 * Interface representing grid map for this.options.grid
 *
 * I.e. grid.map[y][x] = elementId
 */
export interface GridMap {
  [index: number]: { // y-axis column
    [index: number] : // x-axis column
      number | null // numeric element id in the grid (data-id)
  }
}

export const nonDragEventNames = ['PointerDown', 'Click', 'DragEnd'] as const;

export const dragEventNames = ['DragStart', 'Drag', 'DragStop'] as const;

export type NonDragEventName = typeof nonDragEventNames[number];

export type DragEventName = typeof dragEventNames[number];

export type EventListeners = 'start' | 'cancelStart' | 'move' | 'end' | 'contextmenu';

export type GetEventProps<
  T extends DragEventName | NonDragEventName
> =
  T extends DragEventName ? DragEvent : NonDragEvent;

/**
 * Draggable constructor options.
 */
export interface Options {
  // The element to make draggable
  element: HTMLElement,
  /**
   * Draggable clone
   *
   * If enabled, the element will be cloned and the clone will be dragged.
   * Then the original element will re-appear where the clone was dropped
   */
  clone?: {
    // Specify the target where the draggable element is to be attached
    attachTo: HTMLElement
  },

  /**
   * Selector string to target child elements which will not initialize drag.
   */
  cancel?: string

  /**
   * Containment - set boundaries which the dragged element will not cross.
   */
  containment?: {
    /**
     * Containment edges
     *
     * - If the number is non-negative, this is the distance from the window boundary.
     *
     * - If the number is negative, the dragged element can go past the boundary until only x
     * pixels of it are visible, x being the absolute value of the boundary edge value. I.e. - if
     * the right boundary is set to -30px, the element can be dragged all the way right until only
     * 30px of it are visible on the left side.
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
  }

  /**
   * Whether the dragged element should be promoted to its own composite layer
   *
   * It's recommended for performance reasons as this will skip expensive operations such
   * as layout and paint. However there might be side effects, such as blurred out fonts.
   */
  useCompositing?: boolean

  /**
   * Make the dragged element snap to edges.
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
  }

  /**
   * Grid-mode - move elements on a defined grid and swap elements when they overlap
   */
  grid?: {
    cellWidth: number
    cellHeight: number
    map: GridMap
    container: HTMLElement
  }

  /**
   * Called on PointerDown on the draggable element.
   */
  onPointerDown?: (event: NonDragEvent) => void

  /**
   * Called when clicking on the draggable element when dragging has not been initialized.
   */
  onClick?: (event: NonDragEvent) => void

  /**
   * Called when drag has been initialized, after all calculations have been made and changes
   * applied to the DOM (except the element's new position - which is applied onDrag).
   */
  onDragStart?: (event: DragEvent) => void

  /**
   * Called during drag after all calculations have been applied, just before the element's position
   * is updated in DOM.
   */
  onDrag?: (event: DragEvent) => void

  /**
   * Called after dragging stopped, but before any DOM updates are made (such as removing classes or
   * removing the clone helper).
   */
  onDragStop?: (event: DragEvent) => void

  /**
   * Called after dragging stopped and after any DOM changes are applied. It is possible to destroy
   * the draggable instance in this event.
   */
  onDragEnd?: (event: NonDragEvent) => void

  /**
   * Allows to filter dragged element's position before it's rendered. The current position can be
   * accessed in the event props.
   */
  filterPosition?: (event: DragEvent) => [newElementX: number, newElementY: number],

  /**
   * Force not using PointerEvent even if the browser supports it (for debugging).
   *
   * The default start event is "pointerdown" if the browser supports it, with a fallback to
   * "touchstart mousedown" if it does not. Setting this option to true will force the browser
   * to always use "touchstart mousedown" event combination.
   *
   */
  noPointerEvent?: boolean

  /**
   * The amount of distance (pixels) the pointer has to make to initialize dragging. Default value
   * is 2px.
   */
  dragInitDistance?: number

  /**
   * A callback to listen for log messages
   * @param msg Message
   * @param data Log event data
   */
  debugLogger?: ((id: string, msg: string, data?: unknown) => void) | false;
}

export interface SharedDragProperties {
  /**
   * Difference between the dragged element position (edge) and the pointer position
   */
  deltaX: number;
  deltaY: number;

  /**
   * The element being dragged. It will be null in an event where dragging has not been initialized.
   * This will be null on a non-drag event
   */
  draggedElement: HTMLElement;

  /**
   * Dragged element's position. It will be null in an event where dragging has not been
   * initialized.
   */
   elementX: number
   elementY: number
}

/**
 * Interface representing eventVars.drag object. These are properties which are specific to
 * dragging and initialized in dragInit() .
 */
export interface DragProperties extends SharedDragProperties {

  /**
   * Last processed x and y pointer values
   * This is used to prevent unncessary work if the pointer position did not change
   */
  lastProcessedX: number | null
  lastProcessedY: number | null

  /**
   * Dragged element's original position
   */
  elementX0: number
  elementY0: number

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

interface SharedEventProperties {
 /**
  * Type of the API being used
  */
  eventType: 'Mouse' | 'Touch' | 'Pointer'

  /**
   * Type of input device
   */
  inputDevice: 'mouse' | 'touch'

  pointerId: number

  /**
   * The original element - if this.options.helper is disabled, this is also the dragged element.
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
  * TODO: Instead of exposing this, expose the original event in each callback?
  */
  ctrlKey: boolean
}

/**
 * Private event properties.
 * TODO: Rename to PrivateEventProps?
 */
export interface EventProperties extends SharedEventProperties {
  /**
   * Drag properties, initialized at dragInit()
   */
  drag: DragProperties | null
}

/**
 * Draggable event information exposed to callbacks.
 */
export interface NonDragEvent extends SharedEventProperties {
  /**
   * The name of the event, i.e. pointerdown, click, start, stop
   */
  eventName: string

  /**
   * Reference to the original DOM event
   */
  originalEvent: Event;
}

export interface DragEvent extends NonDragEvent, SharedDragProperties { }
