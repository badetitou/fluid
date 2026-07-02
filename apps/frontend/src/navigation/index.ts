/**
 * Navigation module exports
 * Provides utilities for Miller List navigation based on GraphQL linkTo configurations
 */

export {
  extractTableLinks,
  extractDescriptionLinks,
  getNestedValue,
  buildMillerNavigationUrl,
  buildConceptNavigationUrl,
  getNavigationId,
  type NavigationLink,
} from './linkExtractor';

export {
  useMillerNavigation,
  type UseMillerNavigationResult,
} from './useMillerNavigation';
