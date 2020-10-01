
var Draggable = function(options) {

	var $ = jQuery;


	var self= {};

	var endEvent, dragging, eventActive;

	var deltaX, deltaY;

	var helperX, helperY, prevHelperX, prevHelperY;

//	var gridHelperX, gridHelperY, gridPrevHelperX, gridPrevHelperY, gridSwappedElement;

	var gridHelper = null,
		gridSwapped = null,
		gridHelperPrev = null;

	var gridHelperID = null;


	var minX, minY, maxX, maxY;

	var snapTop, snapBottom, snapLeft, snapRight;

	var canceled=0;

	//array repreentation of draggable grid
	var grid = null;

	//var helper;

	var ui=null;


	var start = function(e) {

		if (canceled === 1) { canceled=0; return; }

		e.preventDefault();

		//there can only be one instance at a time
		if (eventActive) { console.log('event already active!'); return; }

		ui = {};
		ui.stop=stop;

		ui.eventType=e.originalEvent.type.replace('down','').replace('start','').replace('move',''); //event type: mouse, touch or pointer

		//input device
		ui.inputDevice=((ui.eventType === 'pointer' && e.originalEvent.pointerType === 'mouse') || ui.eventType === 'mouse') ? 'mouse' : 'touch';

		//exit if not LMB
		if (ui.inputDevice === 'mouse' && e.which !== 1) return;

		//exit if not single touch - only for touch API, I don't know how to implement it for pointer events
		if (ui.eventType === 'touch' && e.originalEvent.touches.length !== 1) return;

		//get pointer id for this event
		if (ui.eventType === 'touch') ui.pointerId=e.originalEvent.changedTouches[0].identifier;
		else if (ui.eventType === 'pointer') ui.pointerId=e.originalEvent.pointerId;

		ui.ctrlKey=(ui.inputDevice === 'mouse' && e.ctrlKey) ? 1 : 0;


        ui.originalElement=this;

		dragging=0;
		eventActive=1;
		endEvent=(ui.eventType === 'touch') ? ui.eventType+'end' : ui.eventType+'up';

		if (ui.eventType === 'touch') {
			ui.x=ui.startX=e.originalEvent.touches[0].clientX;
			ui.y=ui.startY=e.originalEvent.touches[0].clientY;
		}
		else {
			ui.x=ui.startX=e.clientX;
			ui.y=ui.startY=e.clientY;
		}


		if (typeof options.pointerDown === 'function') options.pointerDown(ui);


		$(document).on(ui.eventType+'move.draggable', move);
		$(document).on(endEvent+'.draggable', end);

		if (options.grid) {

			console.log('grid draggable')
			console.log(options.grid.grid)
		}

	}

	var dragInit = function() {

        if (options.helper === 'clone') ui.helper=$(ui.originalElement).clone().removeAttr('id').appendTo(options.delegateTarget).get(0);
		else ui.helper=ui.originalElement;



        var elementWidth=ui.helper.offsetWidth;
		var elementHeight=ui.helper.offsetHeight;


		//set min x, min y, max x, max y based on coordinates
		//
		if (options.containment) {

			var c=options.containment;

			//top right bottom left
			//if a coordinate starts with -, it means that it will be realtive to the opposite edge of the window

			//console.log('container width:')
			//console.log(options.delegateTarget.width());

			var containerWidth = (options.delegateTarget.width()) ? options.delegateTarget.width() : $(window).width();
			var containerHeight = (options.delegateTarget.height()) ? options.delegateTarget.height() : $(window).height();

			//minY (top boundary)
			if (c[0] >= 0) minY=c[0];
			else minY=-elementHeight-c[0];

			//maxX (right boundary)
			if (c[1] >= 0) maxX = containerWidth - elementWidth - c[1];
			else maxX=$(window).width()+c[1];

			//maxY (bottom boundary)
			if (c[2] >= 0) maxY = containerHeight - elementHeight - c[2];
			else maxY=$(window).height()+c[2]

			//minX (left boundary)
			if (c[3] >= 0) minX=c[3];
			else minX=-elementWidth-c[3];

			//translate these limits to pointer coordinates
			/*
			minY+=deltaY;
			maxX+=deltaX;
			maxY+=deltaY;
			minX+=deltaX*/
		}

		if (options.snap) {

			snapTop=options.snapEdges[0];
			snapBottom=$(window).height()-elementHeight-options.snapEdges[2];
			snapLeft=options.snapEdges[3];
			snapRight=$(window).width()-elementWidth-options.snapEdges[1];


		}

		ui.helper.className+=' draggable-dragging';

		//enable drag cursor
		document.body.style.cursor='move';

		if (typeof options.start === 'function') options.start(ui);

		//get the difference between helper position and pointer position
		var style=getComputedStyle(ui.helper);
		deltaX=ui.startX-parseInt(style.left);
		deltaY=ui.startY-parseInt(style.top);

		helperX = ui.x - deltaX;
		helperY = ui.y - deltaY;

		ui.originalLeft = helperX;
		ui.originalTop = helperY;

		if (options.grid) {

			setGridPosition();

			gridHelperPrev = {

				x: gridHelper.x,
				y: gridHelper.y

			}

			gridSwapped = null;

			gridHelperID = parseInt(ui.originalElement.dataset.id);

		}

	}


	var move = function(e) {

		//console.log('dragging');

		if (ui.eventType === 'touch') {
			ui.x=e.originalEvent.changedTouches[0].clientX;
			ui.y=e.originalEvent.changedTouches[0].clientY;
		}
		else {
			ui.x=e.clientX;
			ui.y=e.clientY;
		}

		//dont initiate if delta distance is too small
		if (dragging === 0 && Math.sqrt((ui.startX-ui.x)*(ui.startX-ui.x)+(ui.startY-ui.y)*(ui.startY-ui.y)) > 2) {

            dragInit();


			requestAnimationFrame(smoothMove);

			console.log('initiating');

			dragging=1;
		}

		if (dragging) {

			var newLeft=ui.x-deltaX;
			var newTop=ui.y-deltaY;

			if (options.containment) {
				if (newLeft < minX) newLeft=minX;
				else if (newLeft > maxX) newLeft=maxX;

				if (newTop < minY) newTop=minY;
				else if (newTop > maxY) newTop=maxY;
			}

			if (options.snap) {
				if (Math.abs(newLeft-snapLeft) < 10) newLeft=snapLeft;
				else if (Math.abs(newLeft-snapRight) < 10) newLeft=snapRight;

				if (Math.abs(newTop-snapTop) < 10) newTop=snapTop;
				else if (Math.abs(newTop-snapBottom) < 10) newTop=snapBottom;
			}

			prevHelperX = helperX;
			prevHelperY = helperY;

			helperX = newLeft;
			helperY = newTop;

			ui.left = newLeft;
			ui.top = newTop;


	//		console.log('move')

//			ui.helper.style.left=newLeft+'px';
//			ui.helper.style.top=newTop+'px';


		}

	}

	var smoothMove = function() {

		if (!dragging)
			return;

		requestAnimationFrame(smoothMove);

		if (!dragging || (prevHelperX === helperX && prevHelperY === helperY))
			return;

		//you must check if the grid position changed and then execute proper actions

		//you must get and store the position of the dragged element
		//if the position changed, find element under that position and if it exists, swap it

		//swappedElementID = -1 or ID

		/*

		on drag init element starts with helperGridX and helperGridY

		get current position, if changed continue

		if there was element swapped previously, restore it to the previous position

		if another element lays on current position, swap it with the old positions (prevHelperGridX, prevHelperGridY)


		*/

	//	console.log('smooth move')

		if (!options.grid) {

			ui.helper.style.left = helperX + 'px';
			ui.helper.style.top = helperY + 'px';

		}


		if (options.grid) {

			ui.helper.style.left = helperX + 'px';
			ui.helper.style.top = helperY + 'px';


			setGridPosition();

			if (gridHelper.x !== gridHelperPrev.x || gridHelper.y !== gridHelperPrev.y) {


				//when the position of the helper changes in the grid

				//id of the element that lays underneath the helper
				var elementID;

				try {

					//this could probably pass as undefined
					elementID = options.grid.grid[gridHelper.y][gridHelper.x];

				} catch(e) {

					elementID = null;

				};

				if (typeof elementID === 'undefined')
					elementID = null;


				//if element exists - swap it with the old position
				if (elementID !== null) {

					var swapped = options.delegateTarget.find('[data-id="'+elementID+'"]').get(0);

					options.grid.grid[gridHelperPrev.y][gridHelperPrev.x] = elementID;

					//loop the array unless null - no you dont have to!
					swapped.style.left = (gridHelperPrev.x * options.grid.cellWidth) + 'px';
					swapped.style.top = (gridHelperPrev.y * options.grid.cellHeight) + 'px';


				}
				else {

					options.grid.grid[gridHelperPrev.y][gridHelperPrev.x] = null;

				}




				options.grid.grid[gridHelper.y][gridHelper.x] = gridHelperID;

				console.log('Grid X: ' + gridHelper.x + ' Grid Y: ' + gridHelper.y);
				console.log('Grid helper id: ' + gridHelperID)
				console.log('Swapped element ID: ' + elementID)


				gridHelperPrev.x = gridHelper.x;
				gridHelperPrev.y = gridHelper.y;




			}

		}

	}


	var end = function(e) {

		if (!pointerIdCheck(e)) return;

		ui.ctrlKey=(ui.inputDevice === 'mouse' && e.ctrlKey) ? 1 : 0;



		if (dragging) {

			dragging = 0;

			if (typeof options.stop === 'function') options.stop(ui);

			//disable drag cursor
			document.body.style.cursor='';

			$(ui.helper).removeClass('draggable-dragging');
			if (options.helper === 'clone') $(ui.helper).remove();

			if (options.grid) {

				ui.originalElement.style.left = (gridHelper.x * options.grid.cellWidth) + 'px';
				ui.originalElement.style.top = (gridHelper.y * options.grid.cellHeight) + 'px';

			}

		}
		else if (typeof options.click === 'function') options.click(ui);


		stop();

	}

	var stop = function() {

		console.log('Event stopped');
		$(document).off(ui.eventType+'move.draggable');
		$(document).off(endEvent+'.draggable');
		eventActive=0;
		ui=null;

	}

	var pointerIdCheck = function(e) {

		var currentPointerId;

		//return if if it's not the pointer that started the event
		if (ui.eventType === 'touch') currentPointerId=e.originalEvent.changedTouches[0].identifier;
		else if (ui.eventType === 'pointer') currentPointerId=e.originalEvent.pointerId;

		if ((ui.eventType === 'touch' || ui.eventType === 'pointer') && ui.pointerId !== currentPointerId) return false;
		else return true;


	}



	var getGridIdFromPosition = function(x, y) {


	}

	var setGridPosition = function() {


		if (helperX !== ui.x - deltaX)
			console.log('Warning: X difference')

		if (helperY !== ui.y - deltaY)
			console.log('Warning: Y difference')

		var x = helperX;
		//var x = ui.x - deltaX;

		x = Math.round(x / options.grid.cellWidth);

		var y = helperY;
		//var y = ui.y - deltaY;

		y = Math.round(y / options.grid.cellHeight);

		if (gridHelper === null)
			gridHelper = {};

		gridHelper.x = x;
		gridHelper.y = y;


	}

	var construct = function() {

		if (options.selector)
			options.delegateTarget.pointerDown(options.selector, start);
		else
			options.delegateTarget.pointerDown(start);

		if (options.cancel)
			options.delegateTarget.pointerDown(options.cancel, function(e) { canceled=1; });


		if (typeof options.helper === 'undefined')
			options.helper='original';

	}

	self._destroy = function() {



	}

	self.setOptions = function(_options) {

		$.extend(true, options, _options);

	}


	construct();

	return self;

};
