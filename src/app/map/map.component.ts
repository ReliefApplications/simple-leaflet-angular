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
import { GeoJsonObject, Geometry, Point } from 'geojson';
import countriesCenter from '../layers/countries-center';
import * as L from 'leaflet';
import { randomPoint } from '@turf/random';
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
  NUMBER_STRESS_POINTS = 0;
  points = randomPoint(this.NUMBER_STRESS_POINTS);
  manyPointsLayer: L.GeoJSON | null = null;

  private mapOptions: MapOptions = {
    zoomControl: true,
    zoom: 2,
    center: [48.8584065, 2.2946047],
  };

  private shapes: shape[] = []; // tbh I don't know what this is for

  // wait for view to be rendered, this ensures the div we marked as mapElement will not be null/undefined.
  ngAfterViewInit() {
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

    // listen to the moveend event to recalculate the points on the map
    this.mapInstance.on('moveend', (e) => {
      if (!this.manyPointsLayer) {
        return;
      }
      this.mapInstance.removeLayer(this.manyPointsLayer);
      this.addManyRandomPoints();

      console.log(
        'Number of points on the map:',
        this.manyPointsLayer.getLayers().length
      );
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

  addManyRandomPoints() {
    // blue circle marker
    const geojsonMarkerOptions = {
      radius: 4,
      fillColor: '#4169e1',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    };

    // add geojson layer to map
    this.manyPointsLayer = geoJSON(this.points, {
      pointToLayer: function (feature, latlng) {
        return circleMarker(latlng, geojsonMarkerOptions);
      },
      filter: this.filterNonVisiblePoints.bind(this),
    }).addTo(this.mapInstance);
  }

  filterNonVisiblePoints(
    feature: GeoJSON.Feature<Point, GeoJSON.GeoJsonProperties>
  ): boolean {
    // filter out points that are not visible on the map
    const bounds = this.mapInstance.getBounds().pad(0.1); // add some padding to include a few points outside the map
    const point = L.latLng(
      feature.geometry.coordinates[1],
      feature.geometry.coordinates[0]
    ); // don't ask why everything is reversed
    return bounds.contains(point);
  }

  addLayers() {
    this.addCountriesCenterLayer();
    this.addManyRandomPoints();
  }

  ngOnDestroy() {
    // destroy leaflet instance
    this.mapInstance.remove();
    // kill the worker
    this.worker.terminate();
  }
}
