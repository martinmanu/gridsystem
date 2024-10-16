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

  occupiedGridPoints = new Set<string>(); // Store occupied grid cells

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

  // Generate unique grid point key (for easy comparison)
  getGridKey(x: number, y: number): string {
    return `${Math.floor(x / this.gridSize)},${Math.floor(y / this.gridSize)}`;
  }

  // Get all grid points occupied by a rectangle
  getOccupiedPointsForRect(x: number, y: number, width: number, height: number): Set<string> {
    const points = new Set<string>();
    for (let i = x; i < x + width; i += this.gridSize) {
      for (let j = y; j < y + height; j += this.gridSize) {
        points.add(this.getGridKey(i, j));
      }
    }
    return points;
  }

  // Check if a set of grid points is free (i.e., not occupied)
  arePointsFree(points: Set<string>): boolean {
    for (let point of points) {
      if (this.occupiedGridPoints.has(point)) {
        return false;
      }
    }
    return true;
  }

  // Mark grid points as occupied
  occupyPoints(points: Set<string>): void {
    points.forEach(point => this.occupiedGridPoints.add(point));
  }

  // Release grid points (when moving a shape)
  releasePoints(points: Set<string>): void {
    points.forEach(point => this.occupiedGridPoints.delete(point));
  }

  addDraggableRectangle(): void {
    const rectWidth = 200;
    const rectHeight = 160;

    let initialPosition = { x: 100, y: 100 };

    const rect = this.elementsGroup.append('rect')
      .attr('x', initialPosition.x)
      .attr('y', initialPosition.y)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('fill', 'rgba(0, 0, 255, 0.5)')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('rx', 10)
      .attr('ry', 10)
      .style('cursor', 'move');

    // Get initial occupied points
    let occupiedPoints = this.getOccupiedPointsForRect(initialPosition.x, initialPosition.y, rectWidth, rectHeight);
    this.occupyPoints(occupiedPoints);

    const snapToGrid = (x: number, y: number) => {
      const snappedX = Math.round(x / this.gridSize) * this.gridSize;
      const snappedY = Math.round(y / this.gridSize) * this.gridSize;
      return { x: snappedX, y: snappedY };
    };

    const dragBehavior = d3.drag()
      .on('start', () => {
        // Store the initial grid points (for potential revert)
        initialPosition = { x: +rect.attr('x'), y: +rect.attr('y') };
      })
      .on('drag', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        rect.attr('x', snappedPosition.x).attr('y', snappedPosition.y);
      })
      .on('end', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        const newPoints = this.getOccupiedPointsForRect(snappedPosition.x, snappedPosition.y, rectWidth, rectHeight);

        // Check for collision after the drag ends
        if (this.arePointsFree(newPoints)) {
          // Release previous points
          this.releasePoints(occupiedPoints);
          // Occupy new points
          occupiedPoints = newPoints;
          this.occupyPoints(occupiedPoints);
        } else {
          // Revert to initial position if overlap
          rect.attr('x', initialPosition.x).attr('y', initialPosition.y);
        }
      });

    rect.call(dragBehavior);
  }

  addDraggableCircle(): void {
    const circleRadius = 40;

    let initialPosition = { cx: 200, cy: 200 };

    const circle = this.elementsGroup.append('circle')
      .attr('cx', initialPosition.cx)
      .attr('cy', initialPosition.cy)
      .attr('r', circleRadius)
      .attr('fill', 'rgba(255, 0, 0, 0.5)')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .style('cursor', 'move');

    // Get initial occupied points
    let occupiedPoints = this.getOccupiedPointsForRect(initialPosition.cx, initialPosition.cy, circleRadius * 2, circleRadius * 2);
    this.occupyPoints(occupiedPoints);

    const snapToGrid = (x: number, y: number) => {
      const snappedX = Math.round(x / this.gridSize) * this.gridSize;
      const snappedY = Math.round(y / this.gridSize) * this.gridSize;
      return { cx: snappedX, cy: snappedY };
    };

    const dragBehavior = d3.drag()
      .on('start', () => {
        initialPosition = { cx: +circle.attr('cx'), cy: +circle.attr('cy') };
      })
      .on('drag', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        circle.attr('cx', snappedPosition.cx).attr('cy', snappedPosition.cy);
      })
      .on('end', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        const newPoints = this.getOccupiedPointsForRect(snappedPosition.cx, snappedPosition.cy, circleRadius * 2, circleRadius * 2);

        // Check for collision after the drag ends
        if (this.arePointsFree(newPoints)) {
          this.releasePoints(occupiedPoints);
          occupiedPoints = newPoints;
          this.occupyPoints(occupiedPoints);
        } else {
          circle.attr('cx', initialPosition.cx).attr('cy', initialPosition.cy);
        }
      });

    circle.call(dragBehavior);
  }

  // Add draggable rhombus (similar logic as circle/rect)
  addDraggableRhombus(): void {
    const size = 120;
    let initialPosition = { x: 300, y: 300 };

    const rhombus = this.elementsGroup.append('polygon')
      .attr('points', this.calculateRhombusPoints(initialPosition.x, initialPosition.y, size))
      .attr('fill', 'rgba(0, 255, 0, 0.5)')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .style('cursor', 'move');

    const snapToGrid = (x: number, y: number) => {
      const snappedX = Math.round(x / this.gridSize) * this.gridSize;
      const snappedY = Math.round(y / this.gridSize) * this.gridSize;
      return { x: snappedX, y: snappedY };
    };

    let occupiedPoints = this.getOccupiedPointsForRect(initialPosition.x, initialPosition.y, size, size);
    this.occupyPoints(occupiedPoints);

    const dragBehavior = d3.drag()
      .on('start', () => {
        initialPosition = { x: +rhombus.attr('x'), y: +rhombus.attr('y') };
      })
      .on('drag', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        rhombus.attr('points', this.calculateRhombusPoints(snappedPosition.x, snappedPosition.y, size));
      })
      .on('end', (event: any) => {
        const snappedPosition = snapToGrid(event.x, event.y);
        const newPoints = this.getOccupiedPointsForRect(snappedPosition.x, snappedPosition.y, size, size);

        if (this.arePointsFree(newPoints)) {
          this.releasePoints(occupiedPoints);
          occupiedPoints = newPoints;
          this.occupyPoints(occupiedPoints);
        } else {
          rhombus.attr('points', this.calculateRhombusPoints(initialPosition.x, initialPosition.y, size));
        }
      });

    rhombus.call(dragBehavior);
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
