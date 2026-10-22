import { createContext } from 'react';
import { BUILTIN_PLUGINS } from './builtin';
import type { FluidPlugin } from './types';

/** Every known plugin (built-in and installed) with its load state, provided by the app's plugin runtime. */
export const PluginsContext = createContext<FluidPlugin[]>(BUILTIN_PLUGINS);
