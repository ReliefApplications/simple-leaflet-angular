import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  geoJSON,
  TileLayer,
  Map,
  MapOptions,
  Polygon,
  Marker,
  Rectangle,
  Circle,
  Polyline,
  circleMarker,
} from 'leaflet';
import { FeatureCollection, GeoJsonObject, Geometry, Point } from 'geojson';
import countriesCenter from '../layers/countries-center';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { GeoCountry } from '../layers/async-parsers';

type shape = Polygon | Marker | Rectangle | Circle | Polyline;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('map') el!: ElementRef;

  private mapInstance!: Map;
  private tileLayer!: TileLayer;

  private worker!: Worker;

  // stress test
  NUMBER_STRESS_POINTS = 100_000;
  private clusterGroup: L.MarkerClusterGroup;
  private stressPoints: L.Marker[] = [];

  private mapOptions: MapOptions = {
    zoomControl: true,
    zoom: 4,
    center: [48.8584065, 2.2946047],
  };

  private shapes: shape[] = []; // tbh I don't know what this is for

  // wait for view to be rendered, this ensures the div we marked as mapElement will not be null/undefined.
  ngAfterViewInit() {
    // stress test
    for (let i = 0; i < this.NUMBER_STRESS_POINTS; i++) {
      this.stressPoints.push(L.marker(this.randomLatLng()));
    }

    this.setupLeaflet();
    this.setupEventListeners();
    this.addLayers();
  }

  ngOnInit() {
    // create a new worker
    if (typeof Worker !== 'undefined') {
      // Create a new
      this.worker = new Worker(new URL('./map.worker', import.meta.url));
      this.worker.onmessage = ({ data }) => {
        this.addCountryPolygonsLayer(data);
      };
      // Ideally you would want the worker to fetch the data to prevent
      // unnecessary copies of the 17Mb of data.
      // But I don't know if the worker could access the data, so I'm sending it to the worker.
      this.worker.postMessage(null);
    } else {
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
    }
  }

  setPosition(positionCallback: (position: GeolocationPosition) => void) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(positionCallback);
    }
  }

  setupLeaflet() {
    // create leaflet map instance
    this.mapInstance = new Map(this.el.nativeElement, this.mapOptions);
    this.setPosition((position) => {
      this.mapInstance.setView([
        position.coords.latitude,
        position.coords.longitude,
      ]);
    });

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

  addCountriesCenterLayer() {
    // map the countries center to a geojson feature collection
    const features: GeoJsonObject[] = countriesCenter
      .filter((country) => country.centerlatitude && country.centerlongitude) // filter out countries without a center
      .map(
        (country) =>
          ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [
                country.centerlongitude,
                country.centerlatitude,
              ] as [string, string],
            },
          } as GeoJsonObject)
      );

    // Feature collection of countries center
    const countriesCenterGeoJSON: GeoJsonObject[] = [
      {
        type: 'FeatureCollection',
        features: features,
      } as GeoJsonObject,
    ];

    // orange circle marker
    const geojsonMarkerOptions = {
      radius: 8,
      fillColor: '#ff7800',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    };

    // add geojson layer to map
    geoJSON(countriesCenterGeoJSON, {
      pointToLayer: function (feature, latlng) {
        return circleMarker(latlng, geojsonMarkerOptions);
      },
    }).addTo(this.mapInstance);
  }

  addCountryPolygonsLayer(country: GeoCountry) {
    const options = {
      fillColor: [
        '#2660A4',
        '#65E7B6',
        '#F19953',
        '#E13B88',
        '#6ADC23',
        '#EB1717',
        '#8476E1',
        '#158C3F',
      ][country.id % 8],
      fillOpacity: 0.3,
    } as L.GeoJSONOptions<any, Geometry>;

    // add layers to map
    geoJSON(country.geoJSON, options).addTo(this.mapInstance);
  }

  randomLatLng(): L.LatLngExpression {
    return new L.LatLng(Math.random() * 180 - 90, Math.random() * 360 - 180);
  }

  addManyRandomPoints() {
    this.clusterGroup = L.markerClusterGroup();

    this.mapInstance.addLayer(this.clusterGroup);
  }

  filterNonVisiblePoints(point: L.LatLngExpression): boolean {
    // filter out points that are not visible on the map
    const bounds = this.mapInstance.getBounds();
    return bounds.contains(point);
  }

  addLayers() {
    this.addCountriesCenterLayer();
    this.addManyRandomPoints();

    // stress test
    this.clusterGroup.addLayers(this.stressPoints);
  }

  ngOnDestroy() {
    // destroy leaflet instance
    this.mapInstance.remove();
    // kill the worker
    this.worker.terminate();
  }
}
