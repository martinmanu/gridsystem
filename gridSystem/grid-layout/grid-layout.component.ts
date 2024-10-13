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
  zoomBehavior: any;
  width: number = 0;
  height: number = 0;
  gridSize = 20;
  scale: number = 1;
  maxZoom = 3;
  minZoom = 0.5;
  largeGridSize = 5;
  gridWidth: number = 0;
  gridHeight: number = 0;
  elements: any[] = []; // Store all shapes to check for overlaps

  ngOnInit(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.createSvg();
    this.createDottedGrid();

    this.zoomBehavior = d3.zoom()
      .scaleExtent([this.minZoom, this.maxZoom])
      .translateExtent([[0, 0], [this.gridWidth, this.gridHeight]])
      .filter((event: any) => !event.ctrlKey && event.type !== 'wheel')
      .on('zoom', (event) => this.onZoom(event));

    d3.select(this.svgContainer.nativeElement).call(this.zoomBehavior);
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
    this.gridWidth = this.width * this.largeGridSize / 2;
    this.gridHeight = this.height * this.largeGridSize;

    const numCols = Math.ceil(this.gridWidth / this.gridSize);
    const numRows = Math.ceil(this.gridHeight / this.gridSize);

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

  // Function to check if a new shape overlaps any existing ones
  isOverlapping(newShape: any): boolean {
    for (let existingShape of this.elements) {
      if (this.checkCollision(newShape, existingShape)) {
        return true; // Collision detected
      }
    }
    return false;
  }

  // Check for collision between two shapes (circle and rectangle included)
  checkCollision(shape1: any, shape2: any): boolean {
    if (shape1.type === 'rect' && shape2.type === 'rect') {
      return !(
        shape1.x + shape1.width < shape2.x ||
        shape1.x > shape2.x + shape2.width ||
        shape1.y + shape1.height < shape2.y ||
        shape1.y > shape2.y + shape2.height
      );
    } else if (shape1.type === 'circle' && shape2.type === 'circle') {
      const dist = Math.sqrt(Math.pow(shape1.cx - shape2.cx, 2) + Math.pow(shape1.cy - shape2.cy, 2));
      return dist < shape1.r + shape2.r;
    } else {
      // Rect and circle collision
      const rect = shape1.type === 'rect' ? shape1 : shape2;
      const circle = shape1.type === 'circle' ? shape1 : shape2;
      const distX = Math.abs(circle.cx - (rect.x + rect.width / 2));
      const distY = Math.abs(circle.cy - (rect.y + rect.height / 2));

      if (distX > rect.width / 2 + circle.r || distY > rect.height / 2 + circle.r) {
        return false;
      }
      if (distX <= rect.width / 2 || distY <= rect.height / 2) {
        return true;
      }

      const dx = distX - rect.width / 2;
      const dy = distY - rect.height / 2;
      return dx * dx + dy * dy <= circle.r * circle.r;
    }
  }

  addDraggableRectangle(): void {
    const rectWidth = 260;
    const rectHeight = 160;

    const rect = this.elementsGroup.append('rect')
      .attr('x', 100)
      .attr('y', 100)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('fill', 'rgba(0, 0, 255, 0.5)')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('rx', 20)
      .attr('ry', 20)
      .style('cursor', 'move');

    const snapToGrid = (x: number, y: number) => {
      const snappedX = Math.round(x / this.gridSize) * this.gridSize;
      const snappedY = Math.round(y / this.gridSize) * this.gridSize;
      return { x: snappedX, y: snappedY };
    };

    const dragBehavior = d3.drag()
      .on('drag', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        const withinBounds = this.ensureWithinBounds(snappedPosition.x, snappedPosition.y, rectWidth, rectHeight);
        const newRect = { type: 'rect', x: snappedPosition.x, y: snappedPosition.y, width: rectWidth, height: rectHeight };

        // if (withinBounds && !this.isOverlapping(newRect)) {
          rect.attr('x', snappedPosition.x).attr('y', snappedPosition.y);
        // }
      });

    rect.call(dragBehavior);
    this.elements.push({ type: 'rect', x: 100, y: 100, width: rectWidth, height: rectHeight });
  }

  addDraggableCircle(): void {
    const circleRadius = 50;

    const circle = this.elementsGroup.append('circle')
      .attr('cx', 200)
      .attr('cy', 200)
      .attr('r', circleRadius)
      .attr('fill', 'rgba(255, 0, 0, 0.5)')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .style('cursor', 'move');

    const snapToGrid = (x: number, y: number) => {
      const snappedX = Math.round(x / this.gridSize) * this.gridSize;
      const snappedY = Math.round(y / this.gridSize) * this.gridSize;
      return { x: snappedX, y: snappedY };
    };

    const dragBehavior = d3.drag()
      .on('drag', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        const withinBounds = this.ensureWithinBounds(snappedPosition.x - circleRadius, snappedPosition.y - circleRadius, circleRadius * 2, circleRadius * 2);
        const newCircle = { type: 'circle', cx: snappedPosition.x, cy: snappedPosition.y, r: circleRadius };

        // if (withinBounds && !this.isOverlapping(newCircle)) {
          circle.attr('cx', snappedPosition.x).attr('cy', snappedPosition.y);
        // }
      });

    circle.call(dragBehavior);
    this.elements.push({ type: 'circle', cx: 200, cy: 200, r: circleRadius });
  }

  ensureWithinBounds(x: number, y: number, shapeWidth: number, shapeHeight: number): boolean {
    const rightEdge = x + shapeWidth;
    const bottomEdge = y + shapeHeight;

    if (x < 0 || y < 0 || rightEdge > this.gridWidth || bottomEdge > this.gridHeight) {
      return false;
    }
    return true;
  }

  onZoom(event: any): void {
    const transform = event.transform;
    this.gridGroup.attr('transform', transform);
    this.elementsGroup.attr('transform', transform);
  }

  zoomIn(): void {
    this.svg.transition().call(
      this.zoomBehavior.scaleBy as any, 1.2
    );
  }

  zoomOut(): void {
    this.svg.transition().call(
      this.zoomBehavior.scaleBy as any, 0.8
    );
  }
}
