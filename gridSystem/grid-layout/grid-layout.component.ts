import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';

interface ElementData {
  id: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-grid-layout',
  templateUrl: './grid-layout.component.html',
  styleUrls: ['./grid-layout.component.css'],
})
export class GridLayoutComponent implements OnInit {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef;
  svg: any;
  gridGroup: any;
  elementsGroup: any;
  hoverPreview: any;
  zoomBehavior: any;
  width: number = 0;
  height: number = 0;
  gridSize = 20;
  rectangleWidth: number = 320;
  rectangleHeight: number = 120;
  circleRadi: number = 40;
  rhombusWidth: number = 100;
  selectedShape: string = '';
  optionBox: any = null;
  selectionOverlay: any = null;
  deleteIcon: any = null;
  dragOffset = { x: 0, y: 0 };
  activeElementIds = new Set<string>(); // Store IDs for active elements
  startElement: any = null;
  connectingMode: boolean = false;
  elementMap = new Map<string, ElementData>();
  gridIdMap: Map<string, string> = new Map<string, string>();
  private previousSnappedGridIds: Map<string, string> = new Map();
  alignmentLinesGroup: any;

  ngOnInit(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.createSvg();
    this.createDottedGrid();
    this.alignmentLinesGroup = this.svg
      .append('g')
      .attr('class', 'alignment-lines');
    this.zoomBehavior = d3
      .zoom()
      .scaleExtent([0.5, 3])
      .translateExtent([
        [0, 0],
        [this.width * 5, this.height * 5],
      ])
      .filter((event: any) => {
        return !event.button && event.type !== 'wheel' && event.type !== 'dblclick';
      })
      .on('zoom', (event) => this.onZoom(event));
    d3.select(this.svgContainer.nativeElement).call(this.zoomBehavior);
    this.svg.on('mousemove', (event: MouseEvent) => this.onMouseMove(event));
    this.svg.on('click', (event: MouseEvent) => this.onCanvasClick(event));
  }

  createSvg(): void {
    this.svg = d3
      .select(this.svgContainer.nativeElement)
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`); // Set viewBox to start from (0, 0)

    this.gridGroup = this.svg.append('g').attr('class', 'grid-group');
    this.elementsGroup = this.svg.append('g').attr('class', 'elements-group');
  }

  createDottedGrid(): void {
    const gridWidth = this.width * 5;
    const gridHeight = this.height * 5;
    const numCols = Math.ceil(gridWidth / this.gridSize);
    const numRows = Math.ceil(gridHeight / this.gridSize);
    const gridData = [];

    for (let i = 0; i <= numCols; i++) {
      for (let j = 0; j <= numRows; j++) {
        // Calculate the grid point coordinates directly from (0, 0)
        const x = i * this.gridSize; // No need for offsets
        const y = j * this.gridSize; // No need for offsets

        gridData.push({
          x: x,
          y: y,
          id: `grid-${i}-${j}`, // Keep the ID format consistent
        });
      }
    }

    this.gridGroup
      .selectAll('circle')
      .data(gridData)
      .enter()
      .append('circle')
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y)
      .attr('r', 2)
      .attr('fill', '#cacaca')
      .attr('id', (d: any) => d.id); // Assign unique ID to each grid point
  }

  selectShape(shapeType: string): void {
    this.selectedShape = shapeType || ''; // Set the selected shape
    this.resetPreviewAndSelection(); // Reset any existing previews
  }

  adjustCoordinates(
    x: number,
    y: number
  ): { adjustedX: number; adjustedY: number } {
    const adjustedX = Math.max(x, 0);
    const adjustedY = Math.max(y, 0);
    return { adjustedX, adjustedY };
  }

  onMouseMove(event: MouseEvent): void {
    if (this.selectedShape == '') return;
    const [x, y] = d3.pointer(event);
    const snappedPosition = this.snapToGrid(x, y);
    const newSnappedGridId = this.getGridId(x,y);
    console.log(newSnappedGridId);
    const elementId = this.generateElementId(this.selectedShape); // Generate unique ID for the shape
    if (!this.hoverPreview) {
      this.hoverPreview = this.createShapePreview(
        this.selectedShape,
        snappedPosition.x,
        snappedPosition.y,
        elementId
      );
    } else {
      this.updateShapePreview(snappedPosition.x, snappedPosition.y);
    }
  }

  onCanvasClick(event: MouseEvent): void {
    console.log(this.selectedShape)
    console.log('clicked');
    if (this.selectionOverlay) this.selectionOverlay.remove();
    const [x, y] = d3.pointer(event);
    const snappedPosition = this.snapToGrid(x, y);
    if(this.selectedShape != ''){
      this.createShape(this.selectedShape, snappedPosition.x, snappedPosition.y);
    }
    this.resetPreviewAndSelection();
    this.selectedShape = '';
    this.removeAllLines();
    this.optionBox?.remove();
  }

  snapToGrid(x: number, y: number): { x: number; y: number } {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
    const snappedY = Math.round(y / this.gridSize) * this.gridSize;
    return { x: snappedX, y: snappedY };
  }

  generateElementId(shapeType: string): string {
    let id;
    let counter = 1;
    do {
      id = `${shapeType}-${counter}`;
      counter++;
    } while (this.activeElementIds.has(id));
    this.activeElementIds.add(id);
    return id;
  }

  createShape(shapeType: string, x: number, y: number): void {
    const shapeGroup = this.elementsGroup.append('g'); // Group to contain the shape and additional elements
    const elementId = this.generateElementId(shapeType); // Generate unique ID for the shape
    let shape;

    switch (shapeType) {
      case 'rectangle':
        shape = shapeGroup
          .append('rect')
          .attr('cursor', 'move')
          .attr('x', x)
          .attr('y', y)
          .attr('width', this.rectangleWidth)
          .attr('height', this.rectangleHeight)
          .attr('fill', 'whitesmoke')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('rx', 10)
          .attr('ry', 10)
          .attr('id', elementId); // Assign unique ID to the shape
        shapeGroup
          .append('text')
          .attr('cursor', 'move')
          .attr('x', x + this.rectangleWidth / 2)
          .attr('y', y + this.rectangleHeight / 2)
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .text('Create Mail')
          .attr('font-family', 'Roboto')
          .attr('fill', 'black')
          .style('font-size', '24px');
        shapeGroup
          .append('g') // Group element to contain the path
          .attr(
            'transform',
            `translate(${x + this.rectangleWidth / 2 - 145}, ${y + 30})`
          ) // Adjust translation
          .append('svg')
          .attr('xmlns', 'http://www.w3.org/2000/svg')
          .attr('width', '4em')
          .attr('height', '4em')
          .attr('viewBox', '0 0 26 26')
          .append('path')
          .attr('fill', 'currentColor')
          .attr(
            'd',
            'M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm8-7L4 8v10h16V8zm0-2l8-5H4zM4 8V6v12z'
          );
        break;

      case 'circle':
        shape = shapeGroup
          .append('circle')
          .attr('cursor', 'move')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', this.circleRadi)
          .attr('fill', '#b4ff90d4')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('id', elementId); // Assign unique ID to the shape

        const iconWidth = 26;
        const iconHeight = 26;

        shapeGroup
          .append('g') // Group element to contain the icon
          .attr(
            'transform',
            `translate(${x - iconWidth - 4}, ${y - iconHeight - 4})` // Adjust to center the icon
          )
          .append('svg')
          .attr('xmlns', 'http://www.w3.org/2000/svg')
          .attr('width', '4em') // Set the desired size
          .attr('height', '4em') // Set the desired size
          .attr('viewBox', '0 0 26 26') // Ensure correct scaling of the icon
          .append('path')
          .attr('fill', 'currentColor')
          .attr(
            'd',
            'M8 5.14v14l11-7z' // Example path for play button icon
          );
        break;

      case 'rhombus':
        shape = shapeGroup
          .append('polygon')
          .attr('cursor', 'move')
          .attr('points', this.calculateRhombusPoints(x, y, this.rhombusWidth))
          .attr('fill', 'rgba(0, 255, 0, 0.5)')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('id', elementId); // Assign unique ID to the shape
        shapeGroup
          .append('text')
          .attr('cursor', 'move')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .text('?')
          .attr('fill', '#fff')
          .style('font-size', '60px');
        break;
    }
    this.addTheElementInMap(elementId, x, y);
    this.addTheMidPointElement(elementId, x, y, shapeType, shapeGroup);
    this.applyDragBehavior(shapeGroup, shapeType, elementId);
    this.attachClickEvent(shapeGroup,shapeType, elementId);
  }

  extractTranslation(transform: string): { x: number; y: number } {
    const translate = transform.match(/translate\(([^)]+)\)/);
    if (translate && translate[1]) {
      const [x, y] = translate[1].split(',').map(Number);
      return { x, y };
    }
    return { x: 0, y: 0 };
  }

  addTheMidPointElement(
    elementId: any,
    x: number,
    y: number,
    shapeType: any,
    shapeGroup: any
  ) {
    let centerX: number = x;
    let centerY: number = y;

    if (shapeType === 'rectangle') {
      const rect = shapeGroup.select('rect').node().getBBox();
      centerX = x + rect.width / 2;
      centerY = y + rect.height / 2;
    } else if (shapeType === 'circle') {
      const circle = shapeGroup.select('circle');
      centerX = x;
      centerY = y;
    } else if (shapeType === 'rhombus') {
      const rhombus = shapeGroup.select('polygon');
      const points = rhombus
        .attr('points')
        .split(' ')
        .map((p: string) => {
          const [px, py] = p.split(',').map(Number);
          return { px, py };
        });

      // Calculate the center of the rhombus as the average of all vertices
      const sum = points.reduce(
        (acc: any, point: any) => {
          acc.x += point.px;
          acc.y += point.py;
          return acc;
        },
        { x: 0, y: 0 }
      );
      centerX = x + sum.x / points.length;
      centerY = y + sum.y / points.length;
    }

    // Snap the midpoint to the grid
    const snappedMidpoint = this.snapToGrid(centerX, centerY);

    // Store the updated midpoint in the gridIdMap
    this.storeMidpointGridId(elementId, snappedMidpoint.x, snappedMidpoint.y);
  }

  storeMidpointGridId(elementId: any, centerX: number, centerY: number) {
    const gridId = this.getGridId(centerX, centerY);
    this.gridIdMap.set(elementId, gridId);
  }

  getGridId(x: number, y: number): string {
    const gridX = Math.round(x / this.gridSize);
    const gridY = Math.round(y / this.gridSize);
    return `grid-${gridX}-${gridY}`;
  }

  highlightAlignedGridPoints(shapeGroup: any, shapeType: string): void {
    const gridPoints = this.gridGroup.selectAll('circle');

    let criticalPoints: { x: number; y: number }[] = [];

    if (shapeType === 'rectangle') {
      const rect = shapeGroup.select('rect').node().getBBox();
      const leftX = rect.x;
      const rightX = rect.x + rect.width;
      const topY = rect.y;
      const bottomY = rect.y + rect.height;

      for (let x = leftX; x <= rightX; x += this.gridSize) {
        criticalPoints.push({ x, y: topY }); // Top edge points
      }

      for (let x = leftX; x <= rightX; x += this.gridSize) {
        criticalPoints.push({ x, y: bottomY }); // Bottom edge points
      }

      for (let y = topY; y <= bottomY; y += this.gridSize) {
        criticalPoints.push({ x: leftX, y }); // Left edge points
      }

      for (let y = topY; y <= bottomY; y += this.gridSize) {
        criticalPoints.push({ x: rightX, y }); // Right edge points
      }
    }

    if (shapeType === 'circle') {
      const circle = shapeGroup.select('circle');
      const cx = +circle.attr('cx');
      const cy = +circle.attr('cy');
      const r = +circle.attr('r');
      criticalPoints = [
        { x: cx, y: cy - r }, // Top
        { x: cx, y: cy + r }, // Bottom
        { x: cx - r, y: cy }, // Left
        { x: cx + r, y: cy }, // Right
      ];
    }

    if (shapeType === 'rhombus') {
      const rhombus = shapeGroup.select('polygon');
      const points = rhombus
        .attr('points')
        .split(' ')
        .map((p: string) => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });
      criticalPoints = points;
    }

    criticalPoints.forEach(({ x, y }) => {
      const nearestGridPoint = this.findNearestGridPoint(x, y, gridPoints);
      if (nearestGridPoint) {
        d3.select(`#${nearestGridPoint.id}`).attr('fill', 'red'); // Highlight the grid point
      }
    });
  }

  addTheElementInMap(id: string, x: number, y: number) {
    let element: ElementData = { id, x, y };
    this.elementMap.set(id, element);
  }

  enableConnectionMode(startElement: any): void {
    this.connectingMode = true;
    this.startElement = startElement;
    this.startConnectionPreview(startElement);
  }

  startConnectionPreview(elementId: any) {
    const element1 = d3.select(`#${elementId}`);
  }

  findNearestGridPoint(x: number, y: number, gridPoints: any): any {
    let nearest: any = null;
    let minDistance = Infinity;

    gridPoints.each((d: any) => {
      const distance = Math.sqrt(Math.pow(d.x - x, 2) + Math.pow(d.y - y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        nearest = d; // `this` refers to the DOM element for each grid point
      }
    });

    return nearest;
  }

  createConnection(
    svg: any,
    startElement: any,
    endElement: any,
    gridSize: number
  ): void {
    const startBox = startElement.node().getBBox();
    const endBox = endElement.node().getBBox();

    const startPoint = this.getSnappedGridPoint(startBox, gridSize);
    const endPoint = this.getSnappedGridPoint(endBox, gridSize);

    const path = this.calculateSnappedPath(startPoint, endPoint, gridSize);

    svg
      .append('polyline')
      .attr('points', path)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');
  }

  getSnappedGridPoint(bbox: any, gridSize: number): { x: number; y: number } {
    const x = Math.round((bbox.x + bbox.width / 2) / gridSize) * gridSize;
    const y = Math.round((bbox.y + bbox.height / 2) / gridSize) * gridSize;
    return { x, y };
  }

  calculateSnappedPath(start: any, end: any, gridSize: number): string {
    const path = [];

    path.push(`${start.x},${start.y}`);

    if (start.x !== end.x && start.y !== end.y) {
      const midX = start.x; // Horizontal alignment
      const midY = end.y; // Vertical alignment
      path.push(`${midX},${start.y}`); // Horizontal line
      path.push(`${midX},${midY}`); // Vertical line
    }

    path.push(`${end.x},${end.y}`);

    return path.join(' ');
  }

  applyDragBehavior(
    shapeGroup: any,
    shapeType: string,
    elementId: string
  ): void {
    // Initialize the grid ID for the element if it doesn't already exist
    if (!this.previousSnappedGridIds.has(elementId)) {
      this.previousSnappedGridIds.set(
        elementId,
        this.gridIdMap.get(elementId) || 'grid-0-0'
      );
    }

    const dragHandler = d3
      .drag()
      .on('start', (event: any) => {
        // Get the zoom transformation
        if (this.optionBox) {
          this.optionBox.remove();
        }
        this.removeSelectionOverlay();
        const zoomTransform: any = d3.zoomTransform(
          d3.select('svg').node() as Element
        );

        // Get the cursor position relative to the SVG
        const [cursorX, cursorY] = d3.pointer(event.sourceEvent);

        // Adjust the cursor position based on the zoom transform
        this.dragOffset.x = (cursorX - zoomTransform.x) / zoomTransform.k;
        this.dragOffset.y = (cursorY - zoomTransform.y) / zoomTransform.k;

        // Get the current transform values for the element
        const transform = shapeGroup.attr('transform');
        const currentX = transform
          ? parseFloat(transform.split(',')[0].split('(')[1])
          : 0;
        const currentY = transform
          ? parseFloat(transform.split(',')[1].split(')')[0])
          : 0;

        // Adjust the drag offsets relative to the element's current position
        this.dragOffset.x -= currentX;
        this.dragOffset.y -= currentY;
      })
      .on('drag', (event: any) => {
        const zoomTransform: any = d3.zoomTransform(
          d3.select('svg').node() as Element
        );

        // Get the cursor position relative to the SVG
        const [cursorX, cursorY] = d3.pointer(event.sourceEvent);

        // Adjust cursor position based on zoom transform
        const adjustedX = (cursorX - zoomTransform.x) / zoomTransform.k;
        const adjustedY = (cursorY - zoomTransform.y) / zoomTransform.k;

        // Calculate the new position
        const newX = adjustedX - this.dragOffset.x;
        const newY = adjustedY - this.dragOffset.y;

        // Snap to grid
        const snappedPosition = this.snapToGrid(newX, newY);
        const newSnappedGridId = this.getGridId(
          snappedPosition.x,
          snappedPosition.y
        );
        const currentGridId = this.gridIdMap.get(elementId) || 'grid-0-0';
        const updateGridId = this.addGrids(currentGridId, newSnappedGridId);
        this.previousSnappedGridIds.set(elementId, updateGridId);
        shapeGroup.attr(
          'transform',
          `translate(${snappedPosition.x}, ${snappedPosition.y})`
        );
        this.createAlignmentLines();
      })
      .on('end', (event: any) => {
        // Reset the drag offsets
        this.dragOffset.x = 0;
        this.dragOffset.y = 0;
        this.removeAllLines();
        this.createSelectionOverlay(shapeGroup, elementId);
        this.showOptionBox(shapeGroup,shapeType, elementId);
      });

    // Apply the drag behavior to the shapeGroup
    shapeGroup.call(dragHandler);
  }

  removeAllLines(): void {
    this.alignmentLinesGroup.selectAll('.alignment-line').remove();
  }

  createAlignmentLines(): void {
    const elementGridData = Array.from(this.previousSnappedGridIds.entries());

    // Iterate through all combinations of element pairs to find alignments
    for (let i = 0; i < elementGridData.length; i++) {
      const [elementId1, gridId1] = elementGridData[i];
      const [_, x1, y1] = gridId1.match(/grid-(-?\d+)-(-?\d+)/)!.map(Number); // Extract x1, y1 from gridId1

      for (let j = i + 1; j < elementGridData.length; j++) {
        const [elementId2, gridId2] = elementGridData[j];
        const [__, x2, y2] = gridId2.match(/grid-(-?\d+)-(-?\d+)/)!.map(Number); // Extract x2, y2 from gridId2

        // Remove the line if the grid alignment no longer matches
        this.removeAlignmentLine(elementId1, elementId2);
        // Check if the x or y coordinates align
        if (x1 === x2 || y1 === y2) {
          // Draw a line between the two aligned elements
          this.drawAlignmentLine(
            x1,
            y1,
            x2,
            y2,
            x1 === x2 ? 'vertical' : 'horizontal',
            elementId1,
            elementId2
          );
        }
      }
    }
  }
  removeAlignmentLine(elementId1: any, elementId2: any): void {
    // Ensure both IDs are strings and valid
    const safeId1 = this.getSafeId(elementId1);
    const safeId2 = this.getSafeId(elementId2);

    if (!safeId1 || !safeId2) {
      return;
    }
    const lineSelection = this.alignmentLinesGroup.select(
      `#line-${safeId1}-${safeId2}`
    );

    if (!lineSelection.empty()) {
      lineSelection.remove();
    } else {
      // Check if the line exists with reversed IDs
      const reversedLineSelection = this.alignmentLinesGroup.select(
        `#line-${safeId2}-${safeId1}`
      );
      if (!reversedLineSelection.empty()) {
        reversedLineSelection.remove();
      }
    }
  }

  // Helper function to ensure we have a valid ID string
  private getSafeId(id: any): string | null {
    if (typeof id === 'string') {
      return id;
    } else if (typeof id === 'number') {
      return id.toString();
    } else if (id && typeof id === 'object' && 'id' in id) {
      return this.getSafeId(id.id);
    } else {
      console.error('Invalid ID:', id);
      return null;
    }
  }
  // Draws a line either horizontally or vertically based on the alignment
  drawAlignmentLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    orientation: 'horizontal' | 'vertical',
    elementId1: string,
    elementId2: string
  ): void {
    const svgNode = this.svg.node() as SVGSVGElement;
    const svgRect = svgNode.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    let lineCoords;

    if (orientation === 'vertical') {
      lineCoords = {
        x1: this.gridSize * x1,
        y1: 0,
        x2: this.gridSize * x1,
        y2: svgHeight * 100,
      };
    } else {
      lineCoords = {
        x1: 0, // Start from the left of the SVG
        y1: this.gridSize * y1,
        x2: svgWidth * 100, // Extend to the right of the SVG
        y2: this.gridSize * y1,
      };
    }

    // Draw the line with a unique ID based on element IDs
    this.alignmentLinesGroup
      .append('line')
      .attr('id', `line-${elementId1}-${elementId2}`) // Unique ID for each line
      .attr('x1', lineCoords.x1)
      .attr('y1', lineCoords.y1)
      .attr('x2', lineCoords.x2)
      .attr('y2', lineCoords.y2)
      .attr('stroke', '#859bff')
      .classed('alignment-line', true)
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '10,6');
  }

  addGrids(grid1: string, grid2: string): string {
    // Extract x and y from grid1 using regular expressions, accounting for negative values
    const [_, x1, y1] = grid1.match(/grid-(-?\d+)-(-?\d+)/)!.map(Number);
    // Extract x and y from grid2 using regular expressions, accounting for negative values
    const [__, x2, y2] = grid2.match(/grid-(-?\d+)-(-?\d+)/)!.map(Number);

    // Add the x and y values
    const resultX = x1 + x2;
    const resultY = y1 + y2;

    // Return the new grid string
    return `grid-${resultX}-${resultY}`;
  }

  attachClickEvent(shapeGroup: any,shapeType:any, elementId: string): void {
    shapeGroup.on('click', (event: MouseEvent) => {
      this.optionBox?.remove(); // Remove any existing option box
      event.stopPropagation();
      this.removeSelectionOverlay();
      this.selectedShape = shapeGroup;
      this.createSelectionOverlay(shapeGroup, elementId);
      this.showOptionBox(shapeGroup,shapeType, elementId);
      this.highlightAlignedGridPoints(shapeGroup, shapeType);
    });
  }

  createSelectionOverlay(shapeGroup: any, elementId: string): void {
    const shapeType = elementId.split('-')[0]; // Extract shape type from the ID
    if (this.selectionOverlay) this.selectionOverlay.remove(); // Remove existing overlays
    switch (shapeType) {
      case 'rectangle': {
        const bbox = shapeGroup.node().getBBox();
        const padding = 10;
        this.selectionOverlay = shapeGroup
          .append('rect')
          .attr('x', bbox.x - padding)
          .attr('y', bbox.y - padding)
          .attr('width', bbox.width + padding * 2)
          .attr('height', bbox.height + padding * 2)
          .attr('fill', 'none')
          .attr('stroke', '#00a1ff')
          .attr('stroke-width', 5)
          .attr('rx', 20) // Rounded corners for rectangles
          .attr('ry', 20)
          .attr('pointer-events', 'none');
        break;
      }

      case 'circle': {
        const circle = shapeGroup.select('circle');
        const cx = parseFloat(circle.attr('cx'));
        const cy = parseFloat(circle.attr('cy'));
        const r = parseFloat(circle.attr('r')) + 10; // Add padding to circle radius
        this.selectionOverlay = shapeGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', '#00a1ff')
          .attr('stroke-width', 5)
          .attr('pointer-events', 'none');
        break;
      }

      case 'rhombus': {
        const polygon = shapeGroup.select('polygon');

        const points = polygon
          .attr('points')
          .split(' ')
          .map((p: any) => p.split(',').map(Number));

        const padding = 10; // Padding around the rhombus // Calculate the center of the rhombus
        const centerX = (points[0][0] + points[2][0]) / 2;
        const centerY = (points[1][1] + points[3][1]) / 2; // Adjust each point based on the center to make the rhombus larger
        const newPoints = points
          .map(([x, y]: [number, number]) => {
            const dx = x - centerX; // Distance from the center on X-axis
            const dy = y - centerY; // Distance from the center on Y-axis
            return [
              x + dx * (padding / Math.abs(dx || 1)),
              y + dy * (padding / Math.abs(dy || 1)),
            ].join(',');
          })
          .join(' ');

        this.selectionOverlay = shapeGroup
          .append('polygon')
          .attr('points', newPoints)
          .attr('fill', 'none')
          .attr('stroke', '#00a1ff')
          .attr('stroke-width', 5)
          .attr('pointer-events', 'none');
        break;
      }
    }
  }

  showOptionBox(shapeGroup: any,shapeType:any, elementId: string): void {
    console.log(elementId);
    const gridId:any = this.previousSnappedGridIds.get(elementId);
    if (!gridId) {
      console.error('Grid ID not found for elementId:', elementId);
      return;
    }
  console.log(this.previousSnappedGridIds)
    // Parse the grid coordinates
    const [_, gridX, gridY]:any = gridId.match(/grid-(\d+)-(\d+)/).map(Number);
  
    // Calculate the position based on grid coordinates
    // Assuming the grid starts at (0,0) and each cell is 20x20
    const gridSize = 20;
    const x = gridX * gridSize;
    const y = gridY * gridSize;
    let optionBoxX = 0;
    let optionBoxY = 0;
    console.log(x,y)
    console.log(shapeType); 
    // Calculate the position for the option box
    if(shapeType == 'rectangle'){
       optionBoxX = x + this.rectangleWidth -140; // 10 pixels to the right of the rectangle
       optionBoxY = y + (this.rectangleHeight / 2) - 120; // Centered vertically with the rectangle, adjusted by 60 pixels
    }else if(shapeType == 'circle'){
      optionBoxX = x + (this.circleRadi*2) - 20;
      optionBoxY = y + (this.circleRadi*2) - 120;
    }
   
    console.log(optionBoxX, optionBoxY);
    this.optionBox = this.elementsGroup
      .append('g')
      .attr('class', 'option-box')
      .attr('transform', `translate(${optionBoxX}, ${optionBoxY})`)
      .style('pointer-events', 'all');

    this.optionBox
      .append('rect')
      .attr('width', 80)
      .attr('height', 100)
      .attr('fill', 'white')
      .attr('stroke', 'white')
      .attr('opacity', 0.8)
      .attr('rx', 5) // Rounded corners
      .attr('ry', 5) // Add delete icon (SVG)
    const deleteIcon = this.optionBox
      .append('g')
      .attr('transform', 'translate(0, 0)') // Position the delete icon
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('click', (event: any) => {
        event.stopPropagation();
        event.preventDefault();
        console.log('Delete clicked');
        shapeGroup.remove();
        this.removeSelectionOverlay();
        this.optionBox.remove();
        this.activeElementIds.delete(elementId);
        this.previousSnappedGridIds.delete(elementId);
        this.elementMap.delete(elementId);
        this.gridIdMap.delete(elementId);
        this.selectedShape = '';
      });

    deleteIcon
      .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', '2em')
      .attr('height', '2em')
      .attr('viewBox', '0 0 26 26')
      .append('path')
      .attr('fill', 'currentColor')
      .attr(
        'd',
        'M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z'
      )
      .raise()

    const moveArrow = this.optionBox
      .append('g')
      .attr('transform', 'translate(40, 0)')
      .on('click', () => {
        this.enableConnectionMode(elementId); // Enable connection mode
      });

    moveArrow
      .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', '2em')
      .attr('height', '2em')
      .attr('viewBox', '0 0 256 256')
      .append('path')
      .attr('fill', 'currentColor')
      .attr(
        'd',
        'm248.49 71.51l-32-32a12 12 0 0 0-17 17L211 68h-3c-52 0-64.8 30.71-75.08 55.38c-8.82 21.17-15.45 37.05-42.75 40.09a44 44 0 1 0 .28 24.08c43.34-3.87 55.07-32 64.63-54.93C164.9 109 172 92 208 92h3l-11.52 11.51a12 12 0 0 0 17 17l32-32a12 12 0 0 0 .01-17M48 196a20 20 0 1 1 20-20a20 20 0 0 1-20 20'
      ); // Updated path data

    const info = this.optionBox
      .append('g')
      .attr('transform', 'translate(0, 40)')
      .on('click', () => {});

    info
      .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', '2em')
      .attr('height', '2em')
      .attr('viewBox', '0 0 24 24')
      .append('path')
      .attr('fill', 'currentColor')
      .attr(
        'd',
        'M11 17h2v-6h-2zm1-8q.425 0 .713-.288T13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9m0 13q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22'
      ); // Updated path data
  }

  removeSelectionOverlay(): void {
    console.log(this.selectionOverlay);
    if (this.selectionOverlay) {
      this.selectionOverlay.remove();
      this.selectionOverlay = null;
    }
  }

  resetPreviewAndSelection(): void {
    if (this.hoverPreview) {
      this.hoverPreview.remove();
      this.hoverPreview = null;
    }
  }

  createShapePreview(shapeType: string, x: number, y: number,elementId:string): any {
    let shape;
    switch (shapeType) {
      case 'rectangle':
        shape = this.elementsGroup
          .append('rect')
          .attr('x', x - 110) // Adjust to center during preview
          .attr('y', y - 80) // Adjust to center during preview
          .attr('width', this.rectangleWidth)
          .attr('height', this.rectangleHeight)
          .attr('fill', 'whitesmoke')
          .attr('stroke', 'black')
          .attr('opacity', 0.5)
          .attr('stroke-width', 1)
          .attr('rx', 10)
          .attr('ry', 10)
          .attr('id', elementId)
          .attr('pointer-events', 'none');
        break;

      case 'circle':
        shape = this.elementsGroup
          .append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', this.circleRadi)
          .attr('fill', '#b4ff90d1')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('id', elementId)
          .attr('pointer-events', 'none');
        break;

      case 'rhombus':
        shape = this.elementsGroup
          .append('polygon')
          .attr('points', this.calculateRhombusPoints(x, y, this.rhombusWidth))
          .attr('fill', 'rgba(0, 255, 0, 0.3)')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
          .attr('id', elementId)
          .attr('pointer-events', 'none');
        break;
    }
    return shape;
  }

  updateShapePreview(x: number, y: number): void {
    switch (this.selectedShape) {
      case 'rectangle':
        this.hoverPreview.attr('x', x).attr('y', y); // Adjust to center
        break;
      case 'circle':
        this.hoverPreview.attr('cx', x).attr('cy', y);
        break;
      case 'rhombus':
        const size = 80;
        this.hoverPreview.attr(
          'points',
          this.calculateRhombusPoints(x, y, size)
        );
        break;
    }
  }
  calculateRhombusPoints(x: number, y: number, size: number): string {
    return `${x},${y - size / 2} ${x + size / 2},${y} ${x},${y + size / 2} ${
      x - size / 2
    },${y}`;
  }

  onZoom(event: any): void {
    const transform = event.transform;
    this.gridGroup.attr('transform', transform);
    this.alignmentLinesGroup.attr('transform', transform);
    this.elementsGroup.attr('transform', transform);

  }

  zoomIn(): void {
    this.svg.transition().call(this.zoomBehavior.scaleBy as any, 1.2);
  }
  zoomOut(): void {
    this.svg.transition().call(this.zoomBehavior.scaleBy as any, 0.8);
  }
}
