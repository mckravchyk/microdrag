## MicroDrag

MicroDrag is a fast and lightweight draggable implementation with a plugin system.

> NOTE: MicroDrag is work in progress. The API may change any time and bugs are expected.

Features:
- Lightweight core with a plugin system ensures no unnecessary processing while dragging
- Custom frame of reference (i.e. viewport, document.body or any container can be the frame of reference)
- Dragging in a scrollable container (mousewheel while dragging and scrolling the container when dragging the element towards a boundary)
- Multi-touch drag of multiple items at once
- Allows to filter dragged element position to modify or restrict its movement

Built-in plugins:
- Containment plugin allows to restrict the movement of the dragged item
- Snap plugin makes the dragged item snap to edges
- Sortable plugin handles basic sorting (1 dimensional containers only)

That's right, there is no drag and drop plugin at this point.
