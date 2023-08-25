// ========================= COUNTRY TYPES =========================

/**
 * A country is a collection of polygons
 *
 * Raw data coming from the database, can
 * contain null values
 */
export type RawCountry = {
  id: number;
  polygons: string | null;
};

/**
 * A country is a collection of polygons,
 * used to create a leaflet layer
 */
export type Country = {
  id: number;
  polygons: Polygon | MultiPolygon;
};

/**
 * A polygon is a collection of points
 */
export type Polygon = {
  coords: [number, number][];
};

/**
 * A multipolygon is a collection of polygons
 */
export type MultiPolygon = Polygon[];
