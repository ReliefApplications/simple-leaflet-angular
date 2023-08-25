/// <reference lib="webworker" />

import { parseCountries } from '../layers/parsers';

addEventListener('message', ({ data }) => {
  const countries = parseCountries(data);
  postMessage(countries);
});
