import { createOpenViewsBuilder } from '../openViews';
import type { ViewBuilder } from '../../viewBuilder';
import { SPEC_FLUID_SOURCE, specFluidEndpoints } from './model';

export { ENDPOINT_SETTING } from './model';
export { pharoScriptAction } from './script/ScriptCommand';

/**
 * The inspector tabs Pharo defines for an entity, served by the Spec-Fluid
 * project of the image, as perspectives of its detail column: an Open Views
 * builder on the one endpoint of its settings, reading the old Spec-Fluid
 * routes when the image does not speak Open Views yet. Its Smalltalk scripts
 * are a page action (`pharoScriptAction`).
 */
export const specFluidViewBuilder: ViewBuilder = createOpenViewsBuilder({
  id: SPEC_FLUID_SOURCE,
  label: 'Pharo inspector tabs',
  endpoints: specFluidEndpoints,
  legacy: true,
});
