const win = window;
const doc = document;
const docElem = doc.documentElement;
// FIXME: This incorrectly assumes body is already there - what if the script gets loaded in <head>?
const body = doc.getElementsByTagName('body')[0];

/**
 * Gets browser window width
 */
export function getWindowWidth() : number {
  return win.innerWidth || docElem.clientWidth || body.clientWidth;
}

/**
 * Gets browser window height
 */
export function getWindowHeight() : number {
  return win.innerHeight || docElem.clientHeight || body.clientHeight;
}

// FIXME: Remove it, it's too basic to be a function call.
export function getWidth(el: HTMLElement) : number {
  return el.offsetWidth;
}

export function getHeight(el: HTMLElement) : number {
  return el.offsetHeight;
}

/**
 * Gets element's x position relative to the viewport.
 */
export function getClientX(el: HTMLElement): number {
  let offset = 0;
  let currentElement: HTMLElement | null = el;

  while (currentElement !== null) {
    offset += currentElement.offsetLeft;
    offset -= currentElement.scrollLeft;
    currentElement = currentElement.offsetParent as HTMLElement | null;
  }

  return offset;
}

/**
 * Gets element's y position relative to the viewport.
 */
export function getClientY(el: HTMLElement): number {
  let offset = 0;
  let currentElement: HTMLElement | null = el;

  while (currentElement !== null) {
    offset += currentElement.offsetTop;
    offset -= currentElement.scrollTop;
    currentElement = currentElement.offsetParent as HTMLElement | null;
  }

  return offset;
}
