const win = window;
const doc = document;
const docElem = doc.documentElement;
// FIXME: This incorrectly assumes body is already there - what if the script gets loaded in <head>?
const body = doc.getElementsByTagName('body')[0];

/**
 * Gets a computed CSS property as a number. If the property is not numeric, 0 will be returned.
 */
function getComputedPropNum(el: HTMLElement, cssProperty: keyof CSSStyleDeclaration): number {
  const styleRule = getComputedStyle(el)[cssProperty];

  if (typeof styleRule !== 'string') {
    return 0;
  }

  const numeric = parseInt(styleRule.replace('px', ''), 10);

  return Number.isNaN(numeric) ? 0 : numeric;
}

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
 * Gets element's left position relative to the viewport.
 */
export function getAbsLeft(el: HTMLElement): number {
  let offset = 0;
  let currentElement: HTMLElement | null = el;

  while (currentElement !== null) {
    offset += currentElement.offsetLeft;
    offset -= getScrollLeft(currentElement);
    currentElement = currentElement.offsetParent as HTMLElement | null;
  }

  // Another odd thing about the body element is that for a regular element, margin is part of the
  // offset / positioning, but .offsetLeft considers margin as part of the body.
  if (el === document.body) {
    offset += getComputedPropNum(el, 'marginLeft');
  }

  return offset;
}

/**
 * Gets element's top position relative to the viewport.
 */
export function getAbsTop(el: HTMLElement): number {
  let offset = 0;
  let currentElement: HTMLElement | null = el;

  while (currentElement !== null) {
    offset += currentElement.offsetTop;
    offset -= getScrollTop(currentElement);
    currentElement = currentElement.offsetParent as HTMLElement | null;
  }

  if (el === document.body) {
    offset += getComputedPropNum(el, 'marginTop');
  }

  return offset;
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
