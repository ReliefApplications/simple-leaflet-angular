import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { GeoJsonObject, Geometry } from 'geojson';
import countriesCenter from '../layers/countries-center';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { GeoCountry } from '../layers/async-parsers';

type shape = L.Polygon | L.Marker | L.Rectangle | L.Circle | L.Polyline;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map') el!: ElementRef;

  private mapInstance!: L.Map;

  private countryWorker!: Worker;

  // stress test
  private NUMBER_STRESS_POINTS = 100_000;
  private clusterGroup: L.MarkerClusterGroup;
  private stressPoints: L.Marker[] = [];

  private mapOptions: L.MapOptions = {
    zoomControl: true,
    zoom: 15,
    center: [48.8584065, 2.2946047],
  };

  private shapes: shape[] = []; // tbh I don't know what this is for

  // wait for view to be rendered, this ensures the div we marked as mapElement will not be null/undefined.
  ngAfterViewInit() {
    // create a new worker
    if (typeof Worker !== 'undefined') {
      // Country worker
      this.countryWorker = new Worker(new URL('./map.worker', import.meta.url));
      this.countryWorker.onmessage = ({ data }) => {
        this.addCountryPolygonsLayer(data);
      };
    } else {
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
    }

    // stress test
    for (let i = 0; i < this.NUMBER_STRESS_POINTS; i++) {
      this.stressPoints.push(L.marker(this.randomLatLng()));
    }

    this.setupLeaflet();
    this.setupEventListeners();
    this.addLayers();
  }

  randomLatLng(): L.LatLngExpression {
    return new L.LatLng(Math.random() * 180 - 90, Math.random() * 360 - 180);
  }

  setupLeaflet() {
    // create leaflet map instance
    this.mapInstance = new L.Map(this.el.nativeElement, this.mapOptions);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.mapInstance.setView([
          position.coords.latitude,
          position.coords.longitude,
        ]);
      });
    }

    // create + add tile layer to map
    new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.mapInstance);
  }

  setupEventListeners() {
    // if a type is missing from the library, you can typecast as any
    // if you find a missing definition, please add and open a PR
    this.mapInstance.on('pm:create', (e) => {
      const shape = e.layer as
        | L.Polygon
        | L.Marker
        | L.Polygon
        | L.Rectangle
        | L.Circle
        | L.Polyline;
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
    L.geoJSON(countriesCenterGeoJSON, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, geojsonMarkerOptions);
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
    L.geoJSON(country.geoJSON, options).addTo(this.mapInstance);
  }

  addManyRandomPoints() {
    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 200, // Distance between clusters
      removeOutsideVisibleBounds: true, // Remove markers that are outside the bounds of the map
      chunkedLoading: true, // Load markers in chunks
      chunkInterval: 250, // Time interval (in ms) during which addLayers works before pausing to let the rest of the page process
      chunkDelay: 50, // Time delay (in ms) between consecutive periods of processing for addLayers
    });

    this.mapInstance.addLayer(this.clusterGroup);

    // stress test
    // it would be great if this could be done in a worker, but it's not possible since the worker can't access the DOM
    this.clusterGroup.addLayers(this.stressPoints);
  }

  addLayers() {
    // Ideally you would want the worker to fetch the data to prevent
    // unnecessary copies of the 17Mb of data.
    this.countryWorker.postMessage(null); // This will trigger the worker to start parsing the data

    this.addCountriesCenterLayer();
    this.addManyRandomPoints();
  }

  ngOnDestroy() {
    // destroy leaflet instance
    this.mapInstance.remove();
    // kill the worker
    this.countryWorker.terminate();
  }
}
