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

  dragOffset = { x: 0, y: 0 };  // Store drag offset for elements

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
        gridData.push({ x: i * this.gridSize, y: j * this.gridSize });
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
      .attr('fill', '#cacaca');
  }

  snapToGrid(x: number, y: number): { x: number, y: number } {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
    const snappedY = Math.round(y / this.gridSize) * this.gridSize;
    return { x: snappedX, y: snappedY };
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.selectedShape) return;

    const [x, y] = d3.pointer(event);
    const snappedPosition = this.snapToGrid(x, y);

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
    this.createShape(this.selectedShape, snappedPosition.x, snappedPosition.y);
    this.resetPreviewAndSelection();
    this.selectedShape = null;
  }

  createShape(shapeType: string, x: number, y: number): void {
    const shapeGroup = this.elementsGroup.append('g'); // Group to contain the shape and additional elements
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
          .attr('ry', 10);

        // Center the text inside the rectangle
        shapeGroup.append('text')
          .attr('x', x + rectWidth / 2)  // Center X
          .attr('y', y + rectHeight / 2)  // Center Y
          .attr('dy', '.35em')  // Align text vertically
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
          .attr('stroke-width', 2);

        // Center the text inside the circle
        shapeGroup.append('text')
          .attr('x', x)  // Center X
          .attr('y', y)  // Center Y
          .attr('dy', '.35em')  // Align text vertically
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
          .attr('stroke-width', 2);

        // Center the text inside the rhombus
        shapeGroup.append('text')
          .attr('x', x)  // Center X (for rhombus we assume center is at x)
          .attr('y', y)  // Center Y (for rhombus)
          .attr('dy', '.35em')  // Align text vertically
          .attr('text-anchor', 'middle')
          .text('?')
          .attr('fill', '#fff')
          .style('font-size', '60px');
        break;
    }

    this.applyDragBehavior(shapeGroup, shapeType);  // Attach drag behavior
    this.attachClickEvent(shapeGroup);  // Attach click event for delete icon and selection border
  }

  applyDragBehavior(shapeGroup: any, shapeType: string): void {
    const dragHandler = d3.drag()
      .on('start', (event: any) => {
        // Calculate the offset between cursor and shape position on drag start
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

  resetPreviewAndSelection(): void {
    if (this.hoverPreview) {
      this.hoverPreview.remove();
      this.hoverPreview = null;
    }
  }

  calculateRhombusPoints(x: number, y: number, size: number): string {
    return `${x},${y - size / 2} ${x + size / 2},${y} ${x},${y + size / 2} ${x - size / 2},${y}`;
  }

  attachClickEvent(shape: any): void {
    shape.on('click', (event: MouseEvent) => {
      event.stopPropagation();

      this.removeDeleteIcon();
      if (this.selectedShape) {
        d3.select(this.selectedShape).attr('stroke-width', 2);
      }

      this.selectedShape = shape;
      d3.select(shape).attr('stroke-width', 5);

      this.showDeleteIcon(event, shape);
    });
  }

  showDeleteIcon(event: MouseEvent, shape: any): void {
    const [x, y] = d3.pointer(event);

    this.deleteIcon = this.svg.append('text')
      .attr('x', x + 10)
      .attr('y', y - 10)
      .attr('font-size', '14px')
      .attr('fill', 'red')
      .style('cursor', 'pointer')
      .text('✖')
      .on('click', () => {
        shape.remove();
        this.deleteIcon.remove();
        this.selectedShape = null;
      });
  }

  removeDeleteIcon(): void {
    if (this.deleteIcon) {
      this.deleteIcon.remove();
      this.deleteIcon = null;
    }
  }

  selectShape(shapeType: string): void {
    this.selectedShape = shapeType;
    this.resetPreviewAndSelection();
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
