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
  // When body has overflow the client dimensions will be equal to the scroll height, but for a
  // regular element, client dimensions are the rendered part. This normalizes it - the client
  // dimension of body is the viewport dimension.
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

export function getScrollWidth(el: HTMLElement) : number {
  return el.scrollWidth;
}

export function getScrollHeight(el: HTMLElement) : number {
  return el.scrollHeight;
}

export function getScrollLeft(el: HTMLElement) {
  // For the body, it's the document element that is accessed to read scroll position
  if (el === document.body) {
    return document.documentElement.scrollLeft;
  }

  return el.scrollLeft;
}

export function getScrollTop(el: HTMLElement) {
  if (el === document.body) {
    return document.documentElement.scrollTop;
  }

  return el.scrollTop;
}

/**
 * Calculates element's left and top positions relative to the viewport.
 */
export function getAbsOffset(el: HTMLElement): { left: number, top: number } {
  let left = 0;
  let top = 0;
  let currentElement: HTMLElement | null = el;

  while (currentElement !== null) {
    // When body has position relative, its margin will add up to the offset, but it will not be
    // considered by offsetLeft / offsetTop properties. It needs to be added manually.
    if (currentElement === document.body) {
      const cs = getComputedStyle(document.body);

      if (cs.position === 'relative') {
        const marginLeft = parseInt(cs.marginLeft.replace('px', ''), 10);
        const marginTop = parseInt(cs.marginTop.replace('px', ''), 10);
        left += !Number.isNaN(marginLeft) ? marginLeft : 0;
        top += !Number.isNaN(marginTop) ? marginTop : 0;
      }
    }

    left += currentElement.offsetLeft;
    top += currentElement.offsetTop;
    left -= getScrollLeft(currentElement);
    top -= getScrollTop(currentElement);
    currentElement = currentElement.offsetParent as HTMLElement | null;
  }

  return { left, top };
}

export function isAncestor(ancestor: HTMLElement, descendant: HTMLElement): boolean {
  let currentElement: HTMLElement | null = descendant;

  while (currentElement !== null) {
    if (currentElement === ancestor) {
      return true;
    }

    currentElement = currentElement.parentNode as HTMLElement | null;
  }

  return false;
}
