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

export function getWidth(el: HTMLElement) : number {
  return el.offsetWidth;
}

export function getHeight(el: HTMLElement) : number {
  return el.offsetHeight;
}
