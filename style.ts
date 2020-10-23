/**
 * CSS classes
 *  draggable-is-dragging - applied on document.body after dragInit()
 *  draggable-element - applied to the draggable element (when idle or dragging)
 *  draggable-element-is-dragging - applied to the element being dragged
 *
 */
 let css = '';

 /**
  * Set touch-action: none css
  *
  *
  * This is required to make pointermove work with a touch input
  * Preventing default will not suffice
  * https://stackoverflow.com/questions/48124372/pointermove-event-not-working-with-touch-why-not
  *
  * This is applied on the draggable element, even when its idle
  * The ideal would be that the style is added on dragInit() - draggable-element-is-dragged class
  * However it seems like the browser ignores this if it's set on/after pointerdown
  *
  */
 css += '.draggable-element { touch-action: none; }';
 
 css += 'body.draggable-is-dragging { cursor: move!important;}';
 
 function addCSS() {
   const styleEl = document.createElement('style');
   styleEl.id = 'Draggable-css';
   styleEl.innerHTML = css;
   document.getElementsByTagName('head')[0].appendChild(styleEl);
 }
 
 export default addCSS;
 