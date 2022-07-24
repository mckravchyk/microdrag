/**
 * A set of utilities for working with "cursor events" (MouseEvents, PointerEvents, TouchEvents)
 */

/**
 * Either a MouseEvent, PointerEvent or TouchEvent
 */
 type CursorEvent = MouseEvent | PointerEvent | TouchEvent;

 /**
  * Names of possible cursor events: 'mouse', 'pointer' or 'touch'
  */
 type cursorEventType = 'Mouse' | 'Pointer' | 'Touch';
 
 /**
  * Types of possible cursor inputs: mouse or touch
  */
 type cursorType = 'mouse' | 'touch';
 
 /**
   * Get the name of a CursorEvent
   * @param e Event
   */
 function getCursorEventType(e: CursorEvent) : cursorEventType {
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
   // We are not expecting any other event types
   throw new Error('Argument has to be of CursorEvent type');
 }
 
 /**
   * Retrieve the pointer id from event object
   * @param
   */
 function getCursorId(e : CursorEvent) : number {
   const eventType = getCursorEventType(e);
   let pointerId : number;
 
   if (eventType === 'Touch') {
     pointerId = (<TouchEvent>e).changedTouches[0].identifier;
   } else if (eventType === 'Pointer') {
     pointerId = (<PointerEvent>e).pointerId;
   } else {
     pointerId = 1;
   }
   return pointerId;
 }
 
 /**
  * Get the type of cursor input (mouse or touch)
  * @param e
  */
 function getCursorType(e: CursorEvent): cursorType {
   const eventType = getCursorEventType(e);
   return (
     (eventType === 'Pointer' && (e as PointerEvent).pointerType === 'mouse')
     || eventType === 'Mouse'
   ) ? 'mouse' : 'touch';
 }
 
 export type {
   CursorEvent,
   cursorEventType,
   cursorType,
 };
 
 export {
   getCursorEventType,
   getCursorId,
   getCursorType,
 };
 