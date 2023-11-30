import type { DragContext } from './drag';
import type { CursorEvent, cursorEventType } from './lib/cursor_events';
import { deepClone } from './lib/deep_clone';
import type { ArraifyObjectValues } from './lib/type_functions';

export const nonDragEventNames = ['PointerDown', 'Click', 'DragEnd'] as const;

export const dragEventNames = ['DragStart', 'Drag', 'DragStop'] as const;

export const filterNames = ['Position'] as const;

export const eventNames = [...nonDragEventNames, ...dragEventNames, ...filterNames] as const;

export type NonDragEventName = typeof nonDragEventNames[number];

export type DragEventName = typeof dragEventNames[number];

export type EventName = NonDragEventName | DragEventName;

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

export interface SharedEventProperties {
  /**
   * Type of the API being used
   */
   eventType: cursorEventType

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

/**
 * All drag properties.
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
}

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
 * An object that maps callback type to an array of registered callbacks for the callback type.
 */
export type CallbackHandlersCollection = ArraifyObjectValues<CallbackHandlers>;

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

// TODO: Consider moving all event util functions here, as well as the event type definitions.
// Then move Options to options.ts and dissolve types.ts completely
// But that may be for another commit

function isDragEventName(
  eventName: DragEventName | NonDragEventName,
): eventName is DragEventName {
  return dragEventNames.includes(eventName as DragEventName);
}

export function getPublicEventProps<T extends NonDragEventName | DragEventName>(
  ctx: DragContext,
  eventName: T,
  originalEvent: CursorEvent,
) : GetCallbackEvent<T> {
  // Do not use deep clone here (for performance reasons) and mind to not add deeply-nested
  // objects to event properties.
  const nonDragProps: NonDragEvent = {
    eventType: ctx.event.eventType,
    inputDevice: ctx.event.inputDevice,
    pointerId: ctx.event.pointerId,
    originalElement: ctx.event.originalElement,
    pointerX: ctx.event.pointerX,
    pointerY: ctx.event.pointerY,
    pointerX0: ctx.event.pointerX0,
    pointerY0: ctx.event.pointerY0,
    ctrlKey: ctx.event.ctrlKey,
    eventName,
    originalEvent,
  };

  if (isDragEventName(eventName)) {
    const dragProps: DragEvent = {
      ...nonDragProps,
      elementX: ctx.drag!.elementX,
      elementY: ctx.drag!.elementY,
      draggedElement: ctx.drag!.draggedElement,
      deltaX: ctx.drag!.deltaX,
      deltaY: ctx.drag!.deltaY,
    };

    return dragProps as GetCallbackEvent<T>;
  }

  return nonDragProps as GetCallbackEvent<T>;
}

export function createInputEndEvent(eventType: cursorEventType): CursorEvent {
  if (eventType === 'Pointer') {
    return new PointerEvent('pointerup');
  }

  if (eventType === 'Mouse') {
    return new MouseEvent('mouseup');
  }

  return new TouchEvent('touchend');
}

export const createCallbackHandlersCollection = (): CallbackHandlersCollection => ({
  onPointerDown: [],
  onClick: [],
  onDragStart: [],
  onDrag: [],
  onDragStop: [],
  onDragEnd: [],
  filterPosition: [],
});

export function fireEvent<T extends EventName>(
  ctx: DragContext,
  eventName: T,
  initiatingEvent: CursorEvent,
  // TODO: Consider making it a user-controlled option. Also there's a big distinction between
  // move and other events, so it could be an option like, noClone: 'always' | 'move'
  options: { noCloneProps?: boolean } = { },
): void {
  const eventProps = getPublicEventProps(ctx, eventName, initiatingEvent);

  const handlerName = toHandlerName(eventName);

  for (const callback of ctx.callbacks[handlerName]) {
    const props = options.noCloneProps ? eventProps : deepClone(eventProps);
    // The type casting is a hack, it's not a DragEvent. For whatever reasons TS expects a
    // DragEvent in .call() argument, it could be that it sees DragEvent as the lowest common
    // denominator since it's compatible with both types.
    callback.call(ctx.event.originalElement, props as DragEvent);
  }
}

export function applyPositionFilters(ctx: DragContext, event: DragEvent): void {
  for (const callback of ctx.callbacks.filterPosition) {
    const result = callback.call(ctx.drag!.draggedElement, event);

    if (result) {
      event.elementX = result[0];
      event.elementY = result[1];
    }
  }

  ctx.drag!.elementX = event.elementX;
  ctx.drag!.elementY = event.elementY;
}

/**
 * Fires the drag event, exclusively. Unlike other events, DragEvent properties are never cloned for
 * each callback, the event is also passed rather than created to re-use it with the filter.
 */
export function fireDragEvent(ctx: DragContext, event: DragEvent): void {
  for (const callback of ctx.callbacks.onDrag) {
    callback.call(ctx.event.originalElement, event);
  }
}
