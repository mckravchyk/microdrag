import type { DragContext } from './drag';
import type { CursorEvent, cursorEventType } from './lib/cursor_events';
import { deepClone } from './lib/deep_clone';
import type { ArraifyObjectValues } from './lib/type_functions';

export const nonDragEventNames = ['PointerDown', 'Click', 'Cancel', 'DragEnd'] as const;

export const dragEventNames = ['DragStart', 'Drag', 'DragStop', 'RefFrameScroll'] as const;

export const filterNames = ['Position'] as const;

export const eventNames = [...nonDragEventNames, ...dragEventNames, ...filterNames] as const;

export type NonDragEventName = typeof nonDragEventNames[number];

export type DragEventName = typeof dragEventNames[number];

export type EventName = NonDragEventName | DragEventName;

interface CommonDragProperties {
  /**
   * The x coordinate of the dragged element relative to the viewport.
   */
  absElementX: number

  /**
   * The y coordinate of the dragged element relative to the viewport.
   */
  absElementY: number

  /**
   * The difference between the dragged element's left edge and the pointer's x coordinate.
   */
  deltaX: number;

  /**
   * The difference between the dragged element's top edge and the pointer's y coordinate.
   */
  deltaY: number;

  /**
   * The element being dragged.
   */
  dragged: HTMLElement;

  /**
   * The x coordinate of the dragged element relative to the applied frame of reference.
   */
  draggedX: number

  /**
   * The y coordinate of the dragged element relative to the applied frame of reference.
   */
  draggedY: number

  draggedWidth: number

  draggedHeight: number

  /**
   * The difference between the scroll top of the ref frame at the current event, if the event is
   * RefFrameScroll or last RefFrameScroll event, otherwise and the RefFrameScroll event preceeding
   * it / initial state. Use for fast recomputation of plugin environment on ref frame scroll.
   */
  refScrollLeftDelta: number

  /**
   * The difference between the scroll top of the ref frame at the current event, if the event is
   * RefFrameScroll or last RefFrameScroll event, otherwise and the RefFrameScroll event preceeding
   * it / initial state. Use for fast recomputation of plugin environment on ref frame scroll.
   */
  refScrollTopDelta: number
}

interface CommonEventProperties {
  /**
   * The x coordinate of the pointer relative to the viewport.
   */
  absPointerX: number

  /**
   * The y coordinate of the pointer relative to the viewport.
   */
  absPointerY: number

  /**
   * The x coordinate of the pointer at the start of the event relative to the viewport.
   */
  absPointerX0: number

  /**
   * The y coordinate of the pointer at the start of the event relative to the viewport.
   */
  absPointerY0: number

  /**
   * Whether the ctrl key is on
   *
   * FIXME: Is it necessary? Perhaps for the callbacks
   * TODO: Instead of exposing this, expose the original event in each callback?
   */
  ctrlKey: boolean

  /**
   * Type of the API being used
   */
  eventType: cursorEventType

  /**
   * The type of the input device
   */
  inputDevice: 'mouse' | 'touch'

  /**
   * The drag target. If clone option is not set, it is also the dragged element.
   */
  target: HTMLElement

  pointerId: number

  /**
   * The x coordinate of the pointer relative to the applied frame of reference.
   */
  pointerX: number

  /**
   * The y coordinate of the pointer relative to the applied frame of reference.
   */
  pointerY: number

  /**
   * The x coordinate of the pointer at the start of the event relative to the applied frame of
   * reference.
   */
  pointerX0: number

  /**
   * The y coordinate of the pointer at the start of the event relative to the applied frame of
   * reference.
   */
  pointerY0: number

  refFrame: HTMLElement | 'viewport'

  refScrollLeft: number

  refScrollTop: number

  /**
   * The x coordinate of the chosen frame of reference relative to the viewport that is used to
   * translate absolute coordinates to relative ones.
   */
  refX: number

  /**
   * The y coordinate of the chosen frame of reference relative to the viewport that is used to
   * translate absolute coordinates to relative ones.
   */
  refY: number
 }

/**
 * Draggable event information exposed to callbacks.
 */
export interface NonDragEvent extends CommonEventProperties {
  /**
   * The name of the event, i.e. pointerdown, click, start, stop
   */
  eventName: string

  /**
   * Reference to the original DOM event
   */
  originalEvent: Event;
}

export interface DragEvent extends NonDragEvent, CommonDragProperties { }

export interface NonDragPropertiesPriv extends CommonEventProperties {

}

/**
 * All drag properties.
 */
export interface DragProperties extends CommonDragProperties {
  /**
   * The x coordinate of the dragged element at the start of the drag relative to the chosen frame
   * of reference. Note that this is not neccessarily the equivalent of the position at the start
   * of the event if clone is used.
   */
  draggedX0: number

  /**
   * The y coordinate of the dragged element at the start of the drag relative to the chosen frame
   * of reference. Note that this is not neccessarily the equivalent of the position at the start
   * of the event if clone is used.
   */
  draggedY0: number

  /**
   * Last processed x and y pointer values
   * This is used to prevent unncessary work if the pointer position did not change
   */
  lastProcessedX: number | null
  lastProcessedY: number | null

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
   * Fires when the event is cancelled before dragging starts for reasons other than `Click` and
   * `Contextmenu`, i.e. when the page starts scrolling before drag was initialized.
   */
  onCancel: (this: HTMLElement, event: NonDragEvent) => void

  // TODO: Add a onContextmenu event

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
   * Called when the frame of reference scrolls (only while dragging - drag is cancelled
   * if scrolling occurs before drag has been initialized).
   */
  onRefFrameScroll: (this: HTMLElement, event: DragEvent) => void

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
    absPointerX: ctx.event.absPointerX,
    absPointerY: ctx.event.absPointerY,
    absPointerX0: ctx.event.absPointerX0,
    absPointerY0: ctx.event.absPointerY0,
    eventType: ctx.event.eventType,
    inputDevice: ctx.event.inputDevice,
    target: ctx.event.target,
    pointerId: ctx.event.pointerId,
    pointerX: ctx.event.pointerX,
    pointerY: ctx.event.pointerY,
    pointerX0: ctx.event.pointerX0,
    pointerY0: ctx.event.pointerY0,
    ctrlKey: ctx.event.ctrlKey,
    eventName,
    originalEvent,
    refFrame: ctx.options.refFrame || 'viewport',
    refScrollLeft: ctx.event.refScrollLeft,
    refScrollTop: ctx.event.refScrollTop,
    refX: ctx.event.refX,
    refY: ctx.event.refY,
  };

  if (isDragEventName(eventName)) {
    const dragProps: DragEvent = {
      ...nonDragProps,
      absElementX: ctx.drag!.absElementX,
      absElementY: ctx.drag!.absElementY,
      draggedX: ctx.drag!.draggedX,
      draggedY: ctx.drag!.draggedY,
      dragged: ctx.drag!.dragged,
      deltaX: ctx.drag!.deltaX,
      deltaY: ctx.drag!.deltaY,
      draggedWidth: ctx.drag!.draggedWidth,
      draggedHeight: ctx.drag!.draggedHeight,
      refScrollLeftDelta: ctx.drag!.refScrollLeftDelta,
      refScrollTopDelta: ctx.drag!.refScrollTopDelta,
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
  onCancel: [],
  onDragStart: [],
  onDrag: [],
  onDragStop: [],
  onDragEnd: [],
  onRefFrameScroll: [],
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
    // The type casting is a hack - supplying the type that extends all possible event data types.
    // The solution is probably to cast the callback to a generic value that depends on T and
    // then cast props to GetCallbackEvent<T>
    callback.call(ctx.event.target, props as DragEvent);
  }
}

export function applyPositionFilters(ctx: DragContext, event: DragEvent): void {
  for (const callback of ctx.callbacks.filterPosition) {
    const result = callback.call(ctx.drag!.dragged, event);

    if (result) {
      event.draggedX = result[0];
      event.draggedY = result[1];
    }
  }

  ctx.drag!.draggedX = event.draggedX;
  ctx.drag!.draggedY = event.draggedY;
}

/**
 * Fires the drag event, exclusively. Unlike other events, DragEvent properties are never cloned for
 * each callback, the event is also passed rather than created to re-use it with the filter.
 */
export function fireDragEvent(ctx: DragContext, event: DragEvent): void {
  for (const callback of ctx.callbacks.onDrag) {
    callback.call(ctx.event.target, event);
  }
}
