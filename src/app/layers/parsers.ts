import { Country, MultiPolygon, Polygon, RawCountry } from './country-types';

/**
 * Parses the data coming from the database
 * into a list of valid countries
 *
 * If the data is invalid, it will be ignored
 *
 * @param data the string data coming from the database
 * @returns a list of valid countries
 *
 * The function is O(N) with the length of the string, however it goes through the string multiple times,
 * which is bad for performances. A solution would be to use lazy parsing, but we wouldn't be able to use
 * convenient functions like split() or replaceAll() anymore.
 */
export function parseCountries(data: RawCountry[]): Country[] {
  const countries: Country[] = [];
  for (const rawCountry of data) {
    if (!rawCountry.polygons) {
      continue;
    }

    const polygons: Polygon | MultiPolygon | null = parsePolygons(
      rawCountry.polygons
    );

    if (!polygons) {
      continue;
    }
    countries.push({
      id: rawCountry.id,
      polygons: polygons,
    });
  }

  return countries;
}

function parsePolygons(polygons: string): Polygon | MultiPolygon | null {
  const parsedPolygons: Polygon[] = [];

  //    polygons = 'MUTLIPOLYGON (((1 2, 3 4, 5 6), (7 8, 9 10, 11 12)))'
  // or polygons = 'POLYGON ((1 2, 3 4, 5 6))'

  polygons = polygons.replace('MULTIPOLYGON ', ''); // -> '(((1 2, 3 4, 5 6), (7 8, 9 10, 11 12)))'
  polygons = polygons.replace('POLYGON ', ''); // -> '((1 2, 3 4, 5 6))'

  const polygonsArray = polygons.split('), ('); // -> ['((1 2, 3 4, 5 6)', '(7 8, 9 10, 11 12)))']

  for (const polygon of polygonsArray) {
    const parsedPolygon = parsePolygon(polygon);
    if (!parsedPolygon) {
      return null;
    }
    parsedPolygons.push(parsedPolygon);
  }

  if (parsedPolygons.length === 1) {
    return parsedPolygons[0];
  }

  return parsedPolygons;
}

function parsePolygon(polygon: string): Polygon | null {
  const points: [number, number][] = [];

  // polygon = '(1 2, 3 4, 5 6)'
  // it might have a parenthesis at the beginning or at the end, '(((1 2, 3 4, 5 6)' or '(1 2, 3 4))' for example

  const pointsArray = polygon.split(', '); // -> ['(1 2', '3 4', '5 6)']

  for (const point of pointsArray) {
    const parsedPoint = parsePoint(point);
    if (!parsedPoint) {
      return null;
    }
    points.push(parsedPoint);
  }

  return {
    coords: points,
  };
}

function parsePoint(point: string): [number, number] | null {
  // point = '1 2'
  // it might have multiple parenthesis at the beginning or at the end, '(((1 2' or '1 2))' for example

  point = point.replaceAll('(', '');
  point = point.replaceAll(')', '');
  const coordinates = point.split(' ');
  const latitude = parseFloat(coordinates[1]);
  const longitude = parseFloat(coordinates[0]);

  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  return [latitude, longitude];
}
