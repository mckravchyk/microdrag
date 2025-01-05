import {
  getAbsOffset,
  getClientHeight,
  getClientWidth,
  getScrollHeight,
  getScrollWidth,
  getWindowHeight,
  getWindowWidth,
} from 'src/lib/dom';

/**
 * Computes the area (coordinates and dimensions) of the `box` relative to the frame of reference,
 * including the possibility that the box can also be the frame of reference at the same time.
 *
 * Note that the coordinates of the reference frame must be passed for performance reasons, they are
 * available in the event data.
 */
export function computeRelativeBoxArea(
  box: HTMLElement | 'viewport',
  refFrame: HTMLElement | 'viewport',
  refX: number,
  refY: number,
): { x: number, y: number, width: number, height: number } {
  const windowWidth = getWindowWidth(); // @domRead
  const windowHeight = getWindowHeight();// @domRead

  let containerWidth: number;
  let containerHeight: number;

  // The default is 0, 0 if it's the frame of reference
  let containerX = 0;
  let containerY = 0;

  if (box === 'viewport') {
    containerWidth = windowWidth;
    containerHeight = windowHeight;
  }
  // If the container is the ref frame, only the scroll dimensions matter, the dragging occurs
  // within the entire scroll dimension of the ref frame
  else if (box === refFrame) {
    containerWidth = getScrollWidth(box); // @domRead
    containerHeight = getScrollHeight(box); // @domRead
  }
  else {
    containerWidth = getClientWidth(box); // @domRead
    containerHeight = getClientHeight(box); // @domRead
  }

  if (box !== refFrame) {
    let absContainerX = 0;
    let absContainerY = 0;

    if (box !== 'viewport') {
      const boxOffset = getAbsOffset(box);
      absContainerX = boxOffset.left;
      absContainerY = boxOffset.top;
    }

    containerX = absContainerX - refX;
    containerY = absContainerY - refY;
  }

  return {
    x: containerX,
    y: containerY,
    width: containerWidth,
    height: containerHeight,
  };
}
