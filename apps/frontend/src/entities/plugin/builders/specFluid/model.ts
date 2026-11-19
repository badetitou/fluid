import { parseEndpoints } from '../openViews/model';

/** The setting holding the Spec-Fluid endpoint, e.g. `http://localhost:8081/spec-fluid`. */
export const ENDPOINT_SETTING = 'endpoint';

/** Id of the Spec-Fluid builder and of its data source, named by the `source` of its views' queries. */
export const SPEC_FLUID_SOURCE = 'spec-fluid';

/** The endpoint of the settings, as a list of one (none when unset or not an http(s) URL). */
export const specFluidEndpoints = (settings: Readonly<Record<string, string>>): string[] =>
  parseEndpoints(settings[ENDPOINT_SETTING]).slice(0, 1);
