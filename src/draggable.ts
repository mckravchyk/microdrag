import { addListener } from 'event-listener-extended';

import { deepClone } from './lib/deep_clone';

import { getCursorType, type CursorEvent, getCursorId } from './lib/cursor_events';

import {
  createDragContext,
  type DragContext,
  stop,
  processInputMove,
  processInputEnd,
  processContextmenuEvent,
  processRefFrameScroll,
} from './drag';

import { addCSS } from './style';

import {
  createCallbackHandlersCollection,
  fireEvent,
  createInputEndEvent,
  type CallbackHandlers,
  type DraggablePluginAny,
  type CallbackHandlersCollection,
  toHandlerName,
  type CallbackName,
  handlerNames,
  type CallbackHandlerName,
  type NonDragPropertiesPriv,
} from './events';

export interface DraggableTarget {
  /**
   * The dragged element or the container to which the start event is bound if `delegateSelector` is
   * used.
   */
  element: HTMLElement

  /**
   * Make the descendants of `target` automatically draggable rather than `target` itself.
   */
  delegateSelector?: string

  /**
   * Selector string to target descendants of `target` which will not initialize drag.
   */
  cancel?: string
}

export interface Options extends Partial<CallbackHandlers> {
  target: HTMLElement | DraggableTarget | Array<HTMLElement | DraggableTarget>

  /**
   * The frame of reference - a positioned element that is the reference for dragged element
   * positions (dragged elements use `absolute` positioning relative to that element). If not set,
   * the frame of reference is the window and draggables must use `fixed` positioning.
   */
  refFrame?: HTMLElement

  /**
   * If set, the element will be cloned and the clone will be dragged instead. The original element
   * will be moved when dragging has finished.
   */
  clone?: {
    /**
     * Target to attach the clone to.
     * FIXME: It should be optional and default to document.body
     */
    attachTo: HTMLElement

    // TODO: A function that takes the original element as the parameter and outputs the cloned
    // element.
  },

  /**
   * Whether the dragged element should be promoted to its own composite layer
   *
   * It's recommended for performance reasons as this will skip expensive operations such
   * as layout and paint. However there might be side effects, such as blurred out fonts.
   */
  useCompositing?: boolean

  /**
   * Add plugins to extend draggable capabilities.
   */
  plugins?: DraggablePluginAny[]

  /**
   * Force not using PointerEvent even if the browser supports it (for testing).
   *
   * The default start event is "pointerdown" if the browser supports it, with a fallback to
   * "touchstart mousedown" if it does not. Setting this option to true will force the browser
   * to always use "touchstart mousedown" event combination.
   *
   */
  noPointerEvent?: boolean

  /**
   * If set, dynamic styles for delegated draggables will not be added. Note that each draggable
   * must have a `touch-action: none;` style rule applied or the draggable will not work on mobile
   * devices correctly.
   *
   * Direct (non-delegate) draggables have the style rule applied when CSS is added with
   * `Draggable.addGlobalStyles()`
   */
  noDelegateStyles?: boolean

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

export class Draggable {
  private options : Options;

  /**
   * Array of remove listener function to remove start events bound persistently for the lifetime of
   * the instance.
   */
  private startListeners: Array<() => void> = [];

  /**
   * Control variable to ignore the event on elements targeted by this.options.cancel
   */
  private cancelled = false;

  private dragInstances: Map<number /* PointerId */, DragContext> = new Map();

  private draggedElements: HTMLElement[] = [];

  /**
   * Drag listeners are global listeners that handle input for all draggables of the instance mid
   * drag - the listeners are to be bound as long as at least 1 element is dragging. The property
   * is points to a function that removes the listeners, if they are active.
   */
  private dragListenerUnsubscriber: (() => void) | null = null;

  private callbacks: CallbackHandlersCollection;

  private static cssAdded = false;

  private instanceId: number;

  private static instanceCounter = 0;

  /**
   * Adds global styles which are needed for draggable to function properly. It is recommended to
   * call this method before initializing draggables.
   */
  public static addGlobalStyles() {
    if (Draggable.cssAdded) {
      throw new Error('Styles already added');
    }

    addCSS();
  }

  // TODO: Validate options with ts-interface-builder/ts-interface-checker?
  constructor(options : Options) {
    this.options = deepClone(options);
    this.instanceId = Draggable.instanceCounter;
    Draggable.instanceCounter += 1;

    const usePointerEvents = (
      typeof window.PointerEvent !== 'undefined'
      && options.noPointerEvent !== true
    );

    const startEventName = usePointerEvents ? 'pointerdown' : 'touchstart mousedown';
    const targets = Draggable.processTargets(this.options.target);
    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias

    let dynamicCss = '';

    for (const target of targets) {
      if (target.cancel) {
      // Must be added before the start listener
        this.startListeners.push(
          addListener({
            target: target.element,
            eventName: startEventName,
            delegateSelector: target.cancel,
            callback: this.onCancelPointerdown,
          }),
        );
      }

      if (!target.delegateSelector) {
        target.element.classList.add('draggable-element');
      }
      else {
        // `touch-action: none` style is critical, dragging will not work properly on mobile devices
        // without it
        // https://stackoverflow.com/questions/48124372/pointermove-event-not-working-with-touch-why-not
        target.element.classList.add('draggable-delegate-target');
        dynamicCss += `.draggable-delegate-target ${target.delegateSelector} { touch-action: none};\n`;
      }

      this.startListeners.push(
        addListener({
          target: target.element,
          eventName: startEventName,
          delegateSelector: target.delegateSelector || false,
          callback(e: CursorEvent) {
            self.onInputStart(e, this as unknown as HTMLElement);
          },
        }),
      );
    }

    if (typeof options.refFrame !== 'undefined') {
      this.startListeners.push(
        addListener({
          target: options.refFrame === document.body ? document : options.refFrame,
          eventName: 'scroll',
          callback: this.onRefFrameScroll,
        }),
      );
    }

    if (dynamicCss !== '') {
      const style = document.createElement('STYLE');
      style.innerHTML = dynamicCss;
      style.id = `draggable-${this.instanceId}-style`;
      document.head.appendChild(style);
    }

    this.callbacks = createCallbackHandlersCollection();

    // TODO: Consider implementing the plugin system in a way where the draggable options can be
    // passed to the plugin's constructor, so instead of passing instances of plugins, classes
    // would be passed and plugin options separately, so the draggable options can be injected. It
    // may also make sense in the future for the plugin to be able to access the draggable instance.

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
  }

  public destroy(): void {
    this.removeDragListeners();

    const targets = Draggable.processTargets(this.options.target);

    for (const target of targets) {
      if (!target.delegateSelector) {
        target.element.classList.remove('draggable-element');
      }
      else {
        target.element.classList.remove('draggable-delegate-target');

        const style = document.getElementById(`draggable-${this.instanceId}-style`);

        if (style) {
          document.head.removeChild(style);
        }
      }
    }

    // FIXME: The below will result in infinite recursion if a DragEnd callback calls destroy() -
    // the DragEnd callback is called on stop, but since stop has not executed fully, it is still
    // in the dragInstances property, so stop will be called again and destroy will be called again.
    // Also consider a scenario where multiple DragEnd callbacks call destroy().
    // The easy solution would be to wrap this in a timeout and disallow synchronous destroy. Or
    // disallow synchronous destroy only if there are any active DragContext This may be better than
    // some control variables because each dragInstance stop() receives the original event rather
    // than the synthetic one from forced destroy.
    // Update: Yes, the drag listeners are removed immediately, but this does not prevent infinite
    // recursion of stop() -> destroy() -> stop() ...
    // What if a move event calls destroy and a stop callback also calls destroy? All instances will
    // be force-stopped synchronously, ensure that no matter how many times destroy() gets called,
    // only one timeout is registered.

    // Force stop any active events
    for (const pointerId of Array.from(this.dragInstances.keys())) {
      const ctx = this.dragInstances.get(pointerId)!;
      stop(ctx, createInputEndEvent(ctx.event.eventType));
      this.dragInstances.delete(pointerId);
    }

    // It's better to re-initialize it as empty than worry about null in the types
    this.callbacks = createCallbackHandlersCollection();

    this.startListeners.forEach((removeListener) => removeListener());
    this.startListeners = [];
  }

  /**
   * Delegated pointerdown callback when the event target matches options.cancel selector.
   */
  private onCancelPointerdown = () => {
    this.cancelled = true;
  };

  private onInputStart = (e: CursorEvent, eventThis: HTMLElement) => {
    if (this.cancelled) {
      this.cancelled = false;
      return;
    }

    // Get the input device: mouse or touch
    const inputDevice = getCursorType(e);

    // Exit if not Left Mouse Button
    if (inputDevice === 'mouse' && (e as MouseEvent | PointerEvent).button !== 0) {
      return;
    }

    // Note: Not preventing default on input start.
    //
    // The only reason for using e.preventDefault() here is if it's a TouchEvent, to prevent
    // firing of MouseEvent sequence.
    //
    // Adding this here however, would also prevent contextmenu event - which might not be
    // desirable. Hence e.preventDefault is added onInputEnd() which also successfully stops
    // MouseEvent sequence.

    const pointerId = getCursorId(e);
    let ctx = this.dragInstances.get(pointerId);

    if (
      // If the context for this pointer somehow already exists - quite unexpected but some touch
      // devices that do not support multi-touch will fire another start event for the same pointer
      // that's already in use.
      typeof ctx !== 'undefined'
      // Or if the element is being held by another pointer (w/o this check the element would
      // teleport as its being dragged by multiple pointers at the same time)
      || this.draggedElements.indexOf(eventThis) !== -1
    ) {
      // In that case we are making an exception and preventing default since it's not expected to
      // be a standard action like tap-hold for the contextmenu.
      e.preventDefault();
      return;
    }

    ctx = createDragContext({
      target: eventThis,
      event: e,
      options: this.options,
      callbacks: this.callbacks,
    });

    this.dragInstances.set(pointerId, ctx);
    this.draggedElements.push(eventThis);

    if (this.dragListenerUnsubscriber === null) {
      this.bindDragListeners(ctx.event);
    }

    fireEvent(ctx, 'PointerDown', e);
  };

  private onRefFrameScroll = (e: MouseEvent): void => {
    for (const ctx of Array.from(this.dragInstances.values())) {
      processRefFrameScroll(ctx, e);

      // If dragging has not been initialized ref frame scroll cancels the instance
      if (ctx.drag === null) {
        this.removeDragged(ctx.event.pointerId);
      }
    }
  };

  private bindDragListeners(event: NonDragPropertiesPriv): void {
    if (this.dragListenerUnsubscriber !== null) {
      return;
    }

    const eventNamePrefix = event.eventType.toLocaleLowerCase();

    // Note that the events are bound for a certain API type. It's not expected that multiple API
    // types are used at the same time. Perhaps it's possible to have touchstart and mousedown at
    // the same time, but it's only an issue if there are many Touch API only browsers on
    // touch-enabled laptops or on tablets with the mouse connected - so it's very low priority to
    // consider.

    const endEvent = <'mouseup'|'touchend'|'pointerup'> ((event.eventType === 'Touch')
      ? `${eventNamePrefix}end` : `${eventNamePrefix}up`);

    // eslint-disable-next-line
    // TODO: Implement a getEventName(eventType: cursorEventType, subEvent: 'start' | 'move' | 'end'); in  cursor_events.ts

    const addCtxToCallback = (
      callback: (ctx: DragContext, e: CursorEvent) => void,
    ) => (e: CursorEvent) => {
      const pointerId = getCursorId(e);
      const ctx = this.dragInstances.get(pointerId);

      if (ctx) {
        callback(ctx, e);
      }
    };

    const listeners = [
      addListener({
        target: window,
        eventName: `${eventNamePrefix}move`,
        // Passive events must be explicitly disabled, some browser default it to true in
        // pointermove event. If passive events are enabled, default cannot be prevented.
        passive: false,
        capture: true,
        callback: addCtxToCallback(processInputMove),
      }),
      addListener({
        target: window,
        capture: true,
        eventName: endEvent,
        callback: addCtxToCallback((ctx, e) => {
          processInputEnd(ctx, e);
          this.removeDragged(ctx.event.pointerId);
        }),
      }),
      addListener({
        target: document,
        eventName: 'contextmenu',
        callback: addCtxToCallback((ctx, e) => {
          processContextmenuEvent(ctx, e);
          this.removeDragged(ctx.event.pointerId);
        }),
      }),
    ];

    this.dragListenerUnsubscriber = () => listeners.forEach((removeListener) => removeListener());
  }

  private removeDragged(pointerId: number): void {
    const ctx = this.dragInstances.get(pointerId);

    this.dragInstances.delete(pointerId);

    const index = ctx ? this.draggedElements.indexOf(ctx.event.target) : -1;

    if (index !== -1) {
      this.draggedElements.splice(index, 1);
    }

    if (this.dragInstances.size === 0) {
      this.removeDragListeners();
    }
  }

  private removeDragListeners() {
    if (this.dragListenerUnsubscriber !== null) {
      this.dragListenerUnsubscriber();
      this.dragListenerUnsubscriber = null;
    }
  }

  private addCallback<T extends CallbackHandlerName>(
    handlerName: T,
    callback: CallbackHandlers[T],
    // FIXME: Priority is not implemented. The callbacks in the array should be arranged in order
    // of priority.
    priority: number, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): void {
    this.callbacks[handlerName].push(callback as CallbackHandlers[T]);
  }

  private static processTargets(unprocessed: Options['target']): DraggableTarget[] {
    const unprocessedArr = Array.isArray(unprocessed) ? unprocessed : [unprocessed];

    const targets: DraggableTarget[] = [];

    for (const target of unprocessedArr) {
      if (target instanceof Element) {
        targets.push({ element: target });
      }
      else {
        targets.push(target);
      }
    }

    return targets;
  }
}
