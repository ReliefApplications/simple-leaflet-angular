/// <reference lib="webworker" />

import { parseCountries } from '../layers/async-parsers';
import countries from '../layers/countries';

addEventListener('message', ({ data }) => {
  const subscription = parseCountries(countries).subscribe((country) => {
    postMessage(country);
  });

  // check memory leaks
  // subscription.unsubscribe();
});
