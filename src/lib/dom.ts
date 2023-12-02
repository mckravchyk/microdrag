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

export function getClientWidth(el: HTMLElement) : number {
  // clientWidth for overflowing body will be the width of the body, not the visible one. The
  // window is the visible width of the body that has overflow.
  if (el === document.body) {
    return getWindowWidth();
  }

  return el.clientWidth;
}

export function getClientHeight(el: HTMLElement) : number {
  if (el === document.body) {
    return getWindowHeight();
  }

  return el.clientHeight;
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
