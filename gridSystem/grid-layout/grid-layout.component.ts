import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-grid-layout',
  templateUrl: './grid-layout.component.html',
  styleUrls: ['./grid-layout.component.css']
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
  selectedShape: string | null = null;
  deleteIcon: any = null;
  selectionOverlay: any = null;

  dragOffset = { x: 0, y: 0 };
  activeElementIds = new Set<string>(); // Store IDs for active elements

  ngOnInit(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.createSvg();
    this.createDottedGrid();

    this.zoomBehavior = d3.zoom()
      .scaleExtent([0.5, 3])
      .translateExtent([[0, 0], [this.width * 5, this.height * 5]])
      .filter((event: any) => event.type !== 'wheel')
      .on('zoom', (event) => this.onZoom(event));

    d3.select(this.svgContainer.nativeElement).call(this.zoomBehavior);

    // Handle clicks on the SVG canvas to add shapes or remove selection
    this.svg.on('mousemove', (event: MouseEvent) => this.onMouseMove(event));
    this.svg.on('click', (event: MouseEvent) => this.onCanvasClick(event));
  }

  createSvg(): void {
    this.svg = d3
      .select(this.svgContainer.nativeElement)
      .attr('width', this.width)
      .attr('height', this.height);

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
        gridData.push({ x: i * this.gridSize, y: j * this.gridSize, id: `grid-${i}-${j}` });
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
      .attr('id', (d: any) => d.id);  // Assign unique ID to each grid point
  }

  // Method to select a shape when a button is clicked
  selectShape(shapeType: string): void {
    this.selectedShape = shapeType; // Set the selected shape
    this.resetPreviewAndSelection(); // Reset any existing previews
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.selectedShape) return;

    const [x, y] = d3.pointer(event);
    const snappedPosition = this.snapToGrid(x, y);

    // Create or update the shape preview
    if (!this.hoverPreview) {
      this.hoverPreview = this.createShapePreview(this.selectedShape, snappedPosition.x, snappedPosition.y);
    } else {
      this.updateShapePreview(snappedPosition.x, snappedPosition.y);
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.selectedShape) return;

    const [x, y] = d3.pointer(event);
    const snappedPosition = this.snapToGrid(x, y);

    // Create the shape and clear the selection and preview
    this.createShape(this.selectedShape, snappedPosition.x, snappedPosition.y);
    this.resetPreviewAndSelection(); // Reset after placing the shape
    this.selectedShape = null; // Deselect the shape after placing
  }

  snapToGrid(x: number, y: number): { x: number, y: number } {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
    const snappedY = Math.round(y / this.gridSize) * this.gridSize;
    return { x: snappedX, y: snappedY };
  }

  // Method to generate unique element IDs
  generateElementId(shapeType: string): string {
    let id;
    let counter = 1;

    do {
      id = `${shapeType}-${counter}`;
      counter++;
    } while (this.activeElementIds.has(id));

    this.activeElementIds.add(id);  // Store the ID in the set of active IDs
    return id;
  }

  createShape(shapeType: string, x: number, y: number): void {
    const shapeGroup = this.elementsGroup.append('g'); // Group to contain the shape and additional elements
    const elementId = this.generateElementId(shapeType);  // Generate unique ID for the shape
    let shape;

    switch (shapeType) {
      case 'rectangle':
        const rectWidth = 220;
        const rectHeight = 160;
        shape = shapeGroup
          .append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', rectWidth)
          .attr('height', rectHeight)
          .attr('fill', 'rgba(0, 0, 255, 0.5)')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('rx', 10)
          .attr('ry', 10)
          .attr('id', elementId);  // Assign unique ID to the shape

        shapeGroup.append('text')
          .attr('x', x + rectWidth / 2)
          .attr('y', y + rectHeight / 2)
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .text('Task 1')
          .attr('fill', '#fff')
          .style('font-size', '16px');
        break;

      case 'circle':
        const radius = 40;
        shape = shapeGroup
          .append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', radius)
          .attr('fill', 'rgba(255, 0, 0, 0.5)')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('id', elementId);  // Assign unique ID to the shape

        shapeGroup.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .text('Start')
          .attr('fill', '#fff')
          .style('font-size', '16px');
        break;

      case 'rhombus':
        const size = 100;
        shape = shapeGroup
          .append('polygon')
          .attr('points', this.calculateRhombusPoints(x, y, size))
          .attr('fill', 'rgba(0, 255, 0, 0.5)')
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .attr('id', elementId);  // Assign unique ID to the shape

        shapeGroup.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .text('?')
          .attr('fill', '#fff')
          .style('font-size', '60px');
        break;
    }

    this.applyDragBehavior(shapeGroup, shapeType);
    this.attachClickEvent(shapeGroup, elementId);  // Pass the element ID to handle deletion and selection
  }

  // Apply drag behavior to each shape
  applyDragBehavior(shapeGroup: any, shapeType: string): void {
    const dragHandler = d3.drag()
      .on('start', (event: any) => {
        const [cursorX, cursorY] = d3.pointer(event.sourceEvent);
        const transform = shapeGroup.attr('transform');
        const currentX = transform ? parseFloat(transform.split(',')[0].split('(')[1]) : 0;
        const currentY = transform ? parseFloat(transform.split(',')[1].split(')')[0]) : 0;
        this.dragOffset.x = cursorX - currentX;
        this.dragOffset.y = cursorY - currentY;

        d3.select(shapeGroup).raise();
      })
      .on('drag', (event: any) => {
        const [cursorX, cursorY] = d3.pointer(event.sourceEvent);
        const snappedPosition = this.snapToGrid(cursorX - this.dragOffset.x, cursorY - this.dragOffset.y);
        shapeGroup.attr('transform', `translate(${snappedPosition.x}, ${snappedPosition.y})`);
      });

    shapeGroup.call(dragHandler);  // Apply drag behavior
  }

  // Attach click event for shape selection and deletion
  attachClickEvent(shapeGroup: any, elementId: string): void {
    shapeGroup.on('click', (event: MouseEvent) => {
      event.stopPropagation();

      this.removeDeleteIcon();
      this.removeSelectionOverlay();  // Remove any previous selection

      this.selectedShape = shapeGroup;

      // Create the selection overlay around the shape
      this.createSelectionOverlay(shapeGroup, elementId);

      // Show the delete icon or options
      this.showOptionBox(event, shapeGroup, elementId);
    });
  }

  // Create a selection overlay around the selected element based on its type
  createSelectionOverlay(shapeGroup: any, elementId: string): void {
    console.log(shapeGroup,elementId)
    const shapeType = elementId.split('-')[0];  // Extract shape type from the ID

    if (this.selectionOverlay) this.selectionOverlay.remove();  // Remove existing overlays

    switch (shapeType) {
      case 'rectangle': {
        const bbox = shapeGroup.node().getBBox();
        const padding = 10;  // Add padding to selection

        // Append the selection overlay to the same group as the shape, so it moves together
        this.selectionOverlay = shapeGroup
          .append('rect')
          .attr('x', bbox.x - padding)
          .attr('y', bbox.y - padding)
          .attr('width', bbox.width + padding * 2)
          .attr('height', bbox.height + padding * 2)
          .attr('fill', 'none')
          .attr('stroke', '#00a1ff')
          .attr('stroke-width', 5)
          .attr('rx', 20)  // Rounded corners for rectangles
          .attr('ry', 20)
          .attr('pointer-events', 'none');
        break;
      }
      case 'circle': {
        const circle = shapeGroup.select('circle');
        const cx = parseFloat(circle.attr('cx'));
        const cy = parseFloat(circle.attr('cy'));
        const r = parseFloat(circle.attr('r')) + 10;  // Add padding to circle radius

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
        const points = polygon.attr('points').split(' ').map((p: any) => p.split(',').map(Number));
        const padding = 10; // Padding around the rhombus
  
        // Calculate the center of the rhombus
        const centerX = (points[0][0] + points[2][0]) / 2;
        const centerY = (points[1][1] + points[3][1]) / 2;
  
        // Adjust each point based on the center to make the rhombus larger
        const newPoints = points.map(([x, y]: [number, number]) => {
          const dx = x - centerX; // Distance from the center on X-axis
          const dy = y - centerY; // Distance from the center on Y-axis
          return [(x + dx * (padding / Math.abs(dx || 1))), (y + dy * (padding / Math.abs(dy || 1)))].join(',');
        }).join(' ');
  
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

  showOptionBox(event: MouseEvent, shapeGroup: any, elementId: string): void {
    const bbox = shapeGroup.node().getBBox();
    const optionBoxX = bbox.x - 30;  // Position to the left of the shape
    const optionBoxY = bbox.y + bbox.height / 2 - 10;  // Vertically center the option box

    this.deleteIcon = this.svg.append('g')
      .attr('transform', `translate(${optionBoxX}, ${optionBoxY})`);

    // Add delete icon (✖ symbol)
    this.deleteIcon.append('text')
      .attr('font-size', '16px')
      .attr('fill', 'red')
      .style('cursor', 'pointer')
      .text('✖')
      .on('click', () => {
        shapeGroup.remove();
        this.removeSelectionOverlay();
        this.deleteIcon.remove();
        this.activeElementIds.delete(elementId);  // Remove the element ID when deleted
        this.selectedShape = null;
      });

    // Add more icons for arrow or drag behavior here
    // E.g., this.deleteIcon.append('text').attr(...).text('🔄'); // Add other option icons
  }

  removeSelectionOverlay(): void {
    if (this.selectionOverlay) {
      this.selectionOverlay.remove();
      this.selectionOverlay = null;
    }
  }

  removeDeleteIcon(): void {
    if (this.deleteIcon) {
      this.deleteIcon.remove();
      this.deleteIcon = null;
    }
  }

  resetPreviewAndSelection(): void {
    if (this.hoverPreview) {
      this.hoverPreview.remove();
      this.hoverPreview = null;
    }
  }

  createShapePreview(shapeType: string, x: number, y: number): any {
    let shape;
    switch (shapeType) {
      case 'rectangle':
        shape = this.elementsGroup
          .append('rect')
          .attr('x', x - 110)  // Adjust to center during preview
          .attr('y', y - 80)   // Adjust to center during preview
          .attr('width', 220)
          .attr('height', 160)
          .attr('fill', 'rgba(0, 0, 255, 0.3)')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
          .attr('rx', 10)
          .attr('ry', 10)
          .attr('pointer-events', 'none');
        break;
      case 'circle':
        shape = this.elementsGroup
          .append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 40)
          .attr('fill', 'rgba(255, 0, 0, 0.3)')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
          .attr('pointer-events', 'none');
        break;
      case 'rhombus':
        const size = 100;
        shape = this.elementsGroup
          .append('polygon')
          .attr('points', this.calculateRhombusPoints(x, y, size))
          .attr('fill', 'rgba(0, 255, 0, 0.3)')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
          .attr('pointer-events', 'none');
        break;
    }
    return shape;
  }

  updateShapePreview(x: number, y: number): void {
    switch (this.selectedShape) {
      case 'rectangle':
        this.hoverPreview.attr('x', x - 110).attr('y', y - 80);  // Adjust to center
        break;
      case 'circle':
        this.hoverPreview.attr('cx', x).attr('cy', y);
        break;
      case 'rhombus':
        const size = 80;
        this.hoverPreview.attr('points', this.calculateRhombusPoints(x, y, size));
        break;
    }
  }

  calculateRhombusPoints(x: number, y: number, size: number): string {
    return `${x},${y - size / 2} ${x + size / 2},${y} ${x},${y + size / 2} ${x - size / 2},${y}`;
  }

  onZoom(event: any): void {
    const transform = event.transform;
    this.gridGroup.attr('transform', transform);
    this.elementsGroup.attr('transform', transform);
  }

  zoomIn(): void {
    this.svg.transition().call(this.zoomBehavior.scaleBy as any, 1.2);
  }

  zoomOut(): void {
    this.svg.transition().call(this.zoomBehavior.scaleBy as any, 0.8);
  }
}
