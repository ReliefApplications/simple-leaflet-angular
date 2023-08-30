import { Subject } from 'rxjs';
import { Wkt } from 'wicket';
import { GeoJsonObject } from 'geojson';

export type GeoCountry = {
  id: number;
  geoJSON: GeoJsonObject | GeoJsonObject[];
};

export type RawCountry = {
  id: number;
  polygons: string;
};

export function parseCountries(data: RawCountry[]): Subject<GeoCountry> {
  const obs: Subject<GeoCountry> = new Subject<GeoCountry>();

  setTimeout(() => {
    for (const rawCountry of data) {
      if (!rawCountry.polygons) {
        continue;
      }

      const parser = new Wkt();
      parser.read(rawCountry.polygons);

      obs.next({
        id: rawCountry.id,
        geoJSON: {
          type: 'Feature',
          properties: {},
          geometry: parser.toJson(),
        } as GeoJsonObject,
      });
    }

    obs.complete();
  }, 0);

  return obs;
}
