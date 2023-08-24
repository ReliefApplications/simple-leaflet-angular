import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  TileLayer,
  Map,
  MapOptions,
  Polygon,
  Marker,
  Rectangle,
  Circle,
  Polyline,
  LatLngExpression,
} from 'leaflet';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map') el!: ElementRef;

  mapInstance!: Map;
  tileLayer!: TileLayer;

  mapOptions: MapOptions = {
    zoomControl: true,
    zoom: 18,
    center: this.getGeoloc(),
  };
  shapes: any[] = [];
  // shapes: <Polygon | Marker | Polygon | Rectangle | Circle | Polyline>[] = [];

  // wait for view to be rendered, this ensures the div we marked as mapElement will not be null/undefined.
  ngAfterViewInit() {
    this.setupLeaflet();
    this.setupEventListeners();
  }

  getGeoloc(): LatLngExpression {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        return [position.coords.latitude, position.coords.longitude];
      });
    }
    return [48.8584065, 2.2946047];
  }

  setupLeaflet() {
    // create leaflet map instance
    this.mapInstance = new Map(this.el.nativeElement, this.mapOptions);

    // create + add tile layer to map
    this.tileLayer = new TileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(this.mapInstance);
  }

  setupEventListeners() {
    // if a type is missing from the library, you can typecast as any
    // if you find a missing definition, please add and open a PR
    this.mapInstance.on('pm:create', (e) => {
      const shape = e.layer as
        | Polygon
        | Marker
        | Polygon
        | Rectangle
        | Circle
        | Polyline;
      const geoShape = shape.toGeoJSON();
      this.shapes.push(geoShape.geometry);
    });
  }

  ngOnDestroy() {
    // destroy leaflet instance
    this.mapInstance.remove();
  }
}
