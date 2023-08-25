import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
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
import { GeoJsonObject } from 'geojson';
import { parseCountries } from '../layers/async-parsers';
import countriesCenter from '../layers/countries-center';
import countriesPolygon from '../layers/countries';
import * as L from 'leaflet';
import { Subscription, delay, interval, map, zip } from 'rxjs';
import countries from '../layers/countries';

type shape = Polygon | Marker | Rectangle | Circle | Polyline;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map') el!: ElementRef;

  mapInstance!: Map;
  tileLayer!: TileLayer;

  countrySubscription!: Subscription;

  mapOptions: MapOptions = {
    zoomControl: true,
    zoom: 2,
    center: [48.8584065, 2.2946047],
  };

  shapes: shape[] = [];

  // wait for view to be rendered, this ensures the div we marked as mapElement will not be null/undefined.
  ngAfterViewInit() {
    this.setupLeaflet();
    this.setupEventListeners();
    this.addLayers();
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

  addCountriesPolygonsLayer() {
    // parse the countries polygons, get a stream of valid countries
    this.countrySubscription = parseCountries(countries).subscribe(
      (country) => {
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
        };

        let layer: L.Layer;

        if (country.polygons instanceof Array) {
          // multipolygon
          layer = L.polygon(
            country.polygons.map((polygon) => polygon.coords),
            options
          );
        } else {
          // polygon
          layer = L.polygon(country.polygons.coords, options);
        }

        // add layers to map
        layer.addTo(this.mapInstance);
      }
    );
  }

  addLayers() {
    // this.addCountriesCenterLayer();
    this.addCountriesPolygonsLayer();
  }

  ngOnDestroy() {
    // destroy leaflet instance
    this.mapInstance.remove();
    // unsubscribe from country subscription
    this.countrySubscription.unsubscribe();
  }
}
