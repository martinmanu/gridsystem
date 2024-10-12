import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
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
  width: number = 0;
  height: number = 0;
  gridSize = 20; // Grid size set to 10
  scale: number = 1; // Current zoom scale
  maxZoom = 3; // Maximum zoom level
  minZoom = 0.5; // Minimum zoom level
  largeGridSize = 10; // Grid size multiplier for large grids (20x screen size)
  offsetX: number = 0; // Horizontal panning offset
  offsetY: number = 0; // Vertical panning offset
  gridWidth: number = 0; // Total grid width
  gridHeight: number = 0; // Total grid height

  ngOnInit(): void {
    this.width = window.innerWidth; // Set full screen width
    this.height = window.innerHeight; // Set full screen height

    this.createSvg();
    this.createLargeGrid(); // Draw large grid (20x the screen size)

    // Handle dragging (panning)
    d3.select(this.svgContainer.nativeElement)
      .call(
        d3.drag()
          .on('drag', (event: any) => {
            this.pan(event.dx, event.dy);
          })
      );

    // Prevent default scroll zoom, use scroll to pan vertically
    d3.select(window).on('wheel', (event: WheelEvent) => {
      event.preventDefault();
      this.pan(0, -event.deltaY); // Pan vertically on scroll
    });
  }

  createSvg(): void {
    this.svg = d3
      .select(this.svgContainer.nativeElement)
      .attr('width', this.width)
      .attr('height', this.height);

    // Create a group to hold the grid
    this.gridGroup = this.svg.append('g').attr('class', 'grid-group');
  }

  createLargeGrid(): void {
    this.gridWidth = this.width * this.largeGridSize; // 20x screen size for grid
    this.gridHeight = this.height * this.largeGridSize;

    const numCols = Math.ceil(this.gridWidth / this.gridSize);
    const numRows = Math.ceil(this.gridHeight / this.gridSize);

    const gridData = [];

    for (let i = 0; i <= numCols; i++) {
      for (let j = 0; j <= numRows; j++) {
        gridData.push({ x: i * this.gridSize, y: j * this.gridSize });
      }
    }

    // Create dots for the grid
    this.gridGroup
      .selectAll('circle')
      .data(gridData)
      .enter()
      .append('circle')
      .attr('cx', (d:any) => d.x)
      .attr('cy', (d:any) => d.y)
      .attr('r', 1.5) // Slightly smaller dots
      .attr('fill', '#ddd');
  }

  // Panning logic with boundary constraints
  pan(dx: number, dy: number): void {
    // Calculate new offsets and constrain them to grid boundaries
    this.offsetX = Math.min(
      Math.max(this.offsetX + dx, -(this.gridWidth * this.scale - this.width)),
      0
    );
    this.offsetY = Math.min(
      Math.max(this.offsetY + dy, -(this.gridHeight * this.scale - this.height)),
      0
    );
    this.updateGridPosition();
  }

  updateGridPosition(): void {
    // Update grid translation and scaling
    this.gridGroup.attr('transform', `translate(${this.offsetX}, ${this.offsetY}) scale(${this.scale})`);
  }

  // Zoom in function with boundary checks
  zoomIn(): void {
    this.scale = Math.min(this.maxZoom, this.scale + 0.1);
    this.ensureGridWithinBounds();
  }

  // Zoom out function with boundary checks
  zoomOut(): void {
    this.scale = Math.max(this.minZoom, this.scale - 0.1);
    this.ensureGridWithinBounds();
  }

  // Ensure grid doesn't zoom out beyond visible space (no white space)
  ensureGridWithinBounds(): void {
    // Recalculate panning offsets based on new scale and grid boundaries
    this.offsetX = Math.min(
      Math.max(this.offsetX, -(this.gridWidth * this.scale - this.width)),
      0
    );
    this.offsetY = Math.min(
      Math.max(this.offsetY, -(this.gridHeight * this.scale - this.height)),
      0
    );
    this.updateGridPosition();
  }
}