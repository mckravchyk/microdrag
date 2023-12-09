/**
 * CSS classes
 *  draggable-is-dragging - applied on document.body after dragInit()
 *  draggable-element - applied to the draggable element (when idle or dragging)
 *  draggable-element-is-dragging - applied to the element being dragged
 */
let css = '';

// Set touch-action: none css
//
// This is required to make pointermove work with a touch input. Preventing default will not suffice
// https://stackoverflow.com/questions/48124372/pointermove-event-not-working-with-touch-why-not
//
// This is applied on the draggable element, even when it's idle. The ideal would be that the style
// is added on dragInit() - draggable-element-is-dragged class. However, it seems like the browser
// ignores this if it's set on/after pointerdown
css += '.draggable-element { touch-action: none; }';

// Add cursor move style on the body.

// This must be applied on the body rather than the dragged element, because sometimes the cursor
// can outpace the dragged element (and thus the cursor style would no longer apply).
css += 'body.draggable-is-dragging { cursor: move!important;}';

css += `.draggable-element-is-dragging {
   -moz-user-select: none;
   -khtml-user-select: none;
   -webkit-user-select: none;
   -ms-user-select: none;
   user-select: none;
   z-index: 100;
   }`;

export function addCSS(): void {
  const styleEl = document.createElement('style');
  styleEl.id = 'xydrag-css';
  styleEl.innerHTML = css;
  document.getElementsByTagName('head')[0].appendChild(styleEl);
}
