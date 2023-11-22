// A set of utilities for working with "cursor events" (MouseEvents, PointerEvents, TouchEvents)

// TODO: Rename to input events? Input is more broad than pointer, but in the case of draggable
// only pointers are considered. Cursor does not feel right, touch events do not have a cursor.

/**
 * Either a MouseEvent, PointerEvent or TouchEvent
 */
export type CursorEvent = MouseEvent | PointerEvent | TouchEvent;

// FIXME: Those types below should be PascalCase

/**
 * Names of possible cursor events: 'mouse', 'pointer' or 'touch'
 */
export type cursorEventType = 'Mouse' | 'Pointer' | 'Touch';

/**
 * Types of possible cursor inputs: mouse or touch
 */
export type cursorType = 'mouse' | 'touch';

/**
 * Gets the name of a CursorEvent.
 */
export function getCursorEventType(e: CursorEvent) : cursorEventType {
  // Note: Checking instanceof is much faster than processing contructor name
  if (e instanceof PointerEvent) {
    return 'Pointer';
  }
  if (e instanceof MouseEvent) {
    return 'Mouse';
  }
  if (e instanceof TouchEvent) {
    return 'Touch';
  }
  // Not expecting any other event types
  throw new Error('Argument has to be of CursorEvent type');
}

/**
 * Retrieves the pointer id from event object.
 */
export function getCursorId(e : CursorEvent) : number {
  const eventType = getCursorEventType(e);
  let pointerId : number;

  if (eventType === 'Touch') {
    pointerId = (<TouchEvent>e).changedTouches[0].identifier;
  }
  else if (eventType === 'Pointer') {
    pointerId = (<PointerEvent>e).pointerId;
  }
  else {
    pointerId = 1;
  }
  return pointerId;
}

/**
 * Gets the type of cursor input (mouse or touch).
 */
export function getCursorType(e: CursorEvent): cursorType {
  const eventType = getCursorEventType(e);
  return (
    (eventType === 'Pointer' && (e as PointerEvent).pointerType === 'mouse')
    || eventType === 'Mouse'
  ) ? 'mouse' : 'touch';
}
