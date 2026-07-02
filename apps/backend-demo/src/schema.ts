import { builder } from './builder';
import './enums';
import './types';
import './queries';

export const schema = builder.toSchema();
