export type EventListeners = 'start' | 'cancelStart' | 'move' | 'end' | 'contextmenu';

export const nonDragEventNames = ['PointerDown', 'Click', 'DragEnd'] as const;

export const dragEventNames = ['DragStart', 'Drag', 'DragStop'] as const;

export const filterNames = ['Position'] as const;

export const eventNames = [...nonDragEventNames, ...dragEventNames, ...filterNames] as const;

export type NonDragEventName = typeof nonDragEventNames[number];

export type DragEventName = typeof dragEventNames[number];

export type EventName = NonDragEventName | DragEventName;

export type FilterName = typeof filterNames[number];

export type CallbackName = EventName | FilterName;

export type ToHandlerName<T extends CallbackName> = T extends FilterName ? `filter${T}` : `on${T}`

export function toHandlerName<T extends CallbackName>(eventName: T): ToHandlerName<T> {
  return (
    (filterNames as unknown as string[]).includes(eventName) ? `filter${eventName}` : `on${eventName}`) as ToHandlerName<T>;
}

export const handlerNames = eventNames.map((eventName) => toHandlerName(eventName));

export type CallbackHandlerName = ToHandlerName<CallbackName>;

export type GetCallbackEvent<
  T extends CallbackName
> =
  T extends DragEventName | FilterName ? DragEvent : NonDragEvent;

export interface CallbackHandlers {
  /**
   * Called on PointerDown on the draggable element.
   */
  onPointerDown: (this: HTMLElement, event: NonDragEvent) => void

  /**
   * Called when clicking on the draggable element when dragging has not been initialized.
   */
  onClick: (this: HTMLElement, event: NonDragEvent) => void

  /**
   * Called when drag has been initialized, after all calculations have been made and changes
   * applied to the DOM (except the element's new position - which is applied onDrag).
   */
  onDragStart: (this: HTMLElement, event: DragEvent) => void

  /**
   * Called during drag after all calculations have been applied, just before the element's position
   * is updated in DOM.
   */
  onDrag: (this: HTMLElement, event: DragEvent) => void

  /**
   * Called after dragging stopped, but before any DOM updates are made (such as removing classes or
   * removing the clone helper).
   */
  onDragStop: (this: HTMLElement, event: DragEvent) => void

  /**
   * Called after dragging stopped and after any DOM changes are applied. It is possible to destroy
   * the draggable instance in this event.
   */
  onDragEnd: (this: HTMLElement, event: NonDragEvent) => void

  /**
   * Allows to filter dragged element's position before it's rendered. The current position can be
   * accessed in the event props.
   */
  filterPosition: (
    this: HTMLElement,
    event: DragEvent
  ) => [newElementX: number, newElementY: number] | false,
}

/**
 * Constructs a record of event listeners that match the CallbackName.
 */
type PickCallbackHandlers<
  T extends CallbackName
> = Pick<CallbackHandlers, ToHandlerName<T>>

/**
 * Represents any Draggable Plugin.
 */
export type DraggablePluginAny = Partial<CallbackHandlers> & {
  priority: Partial<Record<CallbackName, number>>
}
// FIXME: Use an optional generic argument to cover both cases in a single type.
/**
 * Draggable Plugin interface for plugins to implement.
 */
export type DraggablePlugin<T extends CallbackName> = PickCallbackHandlers<T> & {
  priority: Record<T, number>
}

/**
 * Draggable constructor options.
 */
export interface Options extends Partial<CallbackHandlers> {
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

  plugins?: DraggablePluginAny[]

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

  // FIXME: That should be removed. Debug logging is most useful when moving and there should not be
  // any code and if statements that could drag performance down, if only by little.
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
   * Snap edges (calculated lines) - set during dragInit() if this.options.snap is set
   */
  snap: {
    top: number
    right: number
    bottom: number
    left: number
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
