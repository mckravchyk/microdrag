const win = window;
const doc = document;
const docElem = doc.documentElement;
// FIXME: This incorrectly assumes body is already there - what if the script gets loaded in <head>?
const body = doc.getElementsByTagName('body')[0];

/**
 * Get browser window width
 */
export function getWindowWidth() : number {
  return win.innerWidth || docElem.clientWidth || body.clientWidth;
}

/**
 * Get browser window height
 */
export function getWindowHeight() : number {
  return win.innerHeight || docElem.clientHeight || body.clientHeight;
}

/**
 * Get element's width
 * @param el
 */
export function getWidth(el: HTMLElement) : number {
  return el.offsetWidth;
}

/**
 * Get element's height
 * @param el
 */
export function getHeight(el: HTMLElement) : number {
  return el.offsetHeight;
}

