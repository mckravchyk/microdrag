## Microdrag

Microdrag is a base library for creating draggable interactions. 

> NOTE: Microdrag is work in progress. The API will change and bugs are expected.

Features:
- Lightweight core with a plugin system ensures no unnecessary processing while dragging
- Custom frame of reference (i.e. viewport, document.body or any container can be the frame of reference)
- Dragging in a scrollable container (mousewheel while dragging and scrolling the container when dragging the element towards a boundary)
- Multi-touch drag of multiple items at once
- Allows to filter dragged element position to modify or restrict its movement

Built-in plugins:
- Containment plugin allows to restrict the movement of the dragged item
- Snap plugin makes the dragged item snap to edges
- Ref Frame Scroll plugin enables scrolling of the reference frame container when the dragged item approaches its boundary

This is not a drag and drop library, although a drag and drop plugin will be implemented at some point.
