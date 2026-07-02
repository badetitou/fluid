/**
 * Analyzes GraphQL schema to detect potential linkTo candidates
 * Based on:
 * - Field names ending in "Id" or "ID" 
 * - Field types that are ID scalars
 * - Related concept information
 * - Global Object Identification patterns
 */

import type { ConceptSchemaInfo, ConceptFieldInfo } from './types';

export interface LinkCandidate {
  fieldName: string;
  label: string;
  targetConcept: string;
  idField: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Extract target concept name from field name
 * Examples: "customerId" -> "Customer", "supplierId" -> "Supplier", "accountId" -> "Account"
 */
function extractConceptFromFieldName(fieldName: string): string | null {
  // Remove common suffixes
  const cleaned = fieldName.replace(/([Ii]d|[Ii][Dd])$/, '');
  
  if (!cleaned || cleaned === fieldName) return null;
  
  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Check if a field is likely an ID field
 */
function isIdField(field: ConceptFieldInfo): boolean {
  const name = field.name.toLowerCase();
  const type = field.typeName.toLowerCase();
  
  // Check field name patterns
  if (name.endsWith('id') || name.endsWith('_id')) return true;
  
  // Check field type
  if (type === 'id' || type === 'globalid') return true;
  
  // UUID, ULID patterns
  if (type.includes('uuid') || type.includes('ulid')) return true;
  
  return false;
}

/**
 * Detect all potential linkTo candidates from schema
 */
export function detectLinkCandidates(schema: ConceptSchemaInfo): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];
  const relatedConceptMap = new Map(schema.related?.map(r => [r.name.toLowerCase(), r]) ?? []);
  
  for (const field of schema.fields) {
    if (!isIdField(field)) continue;
    if (field.isList) continue; // Skip list fields
    
    // Try to extract target concept from field name
    const extractedConcept = extractConceptFromFieldName(field.name);
    
    if (extractedConcept) {
      // Check if it matches a related concept
      const relatedConcept = relatedConceptMap.get(extractedConcept.toLowerCase());
      
      candidates.push({
        fieldName: field.name,
        label: toTitleCase(field.name),
        targetConcept: extractedConcept,
        idField: field.name,
        confidence: relatedConcept ? 'high' : 'medium',
        reason: relatedConcept 
          ? `Field name "${field.name}" matches related concept "${extractedConcept}"`
          : `Field name "${field.name}" suggests target concept "${extractedConcept}"`,
      });
    }
    
    // Also check related concepts for direct ID fields
    if (field.name === 'id' && schema.name) {
      // The primary key can link to itself
      candidates.push({
        fieldName: field.name,
        label: 'ID',
        targetConcept: schema.name,
        idField: field.name,
        confidence: 'high',
        reason: `Primary ID field for ${schema.name}`,
      });
    }
  }
  
  return candidates;
}

/**
 * Format link candidates as helpful text for LLM prompt
 */
export function formatLinkCandidatesForPrompt(candidates: LinkCandidate[]): string {
  if (candidates.length === 0) {
    return 'No obvious ID fields detected for linking.';
  }

  const grouped = {
    high: candidates.filter(c => c.confidence === 'high'),
    medium: candidates.filter(c => c.confidence === 'medium'),
    low: candidates.filter(c => c.confidence === 'low'),
  };

  const lines: string[] = [
    '🔗 INTERACTIVE TABLE LINKS - linkTo Candidates (for Miller navigation):',
    'Add "linkTo" to the table column definition to make it clickable for navigation.',
    '',
  ];

  if (grouped.high.length > 0) {
    lines.push('  ✅ HIGH CONFIDENCE - STRONGLY INCLUDE THESE IN TABLE COLUMNS:');
    for (const c of grouped.high) {
      lines.push(`    - Column key "${c.fieldName}": { "linkTo": { "concept": "${c.targetConcept}" } }`);
      lines.push(`      Reason: ${c.reason}`);
    }
    lines.push('');
  }

  if (grouped.medium.length > 0) {
    lines.push('  ⚠️  MEDIUM CONFIDENCE - Include if appropriate:');
    for (const c of grouped.medium) {
      lines.push(`    - Column key "${c.fieldName}": { "linkTo": { "concept": "${c.targetConcept}", "idField": "${c.fieldName}" } }`);
      lines.push(`      Reason: ${c.reason}`);
    }
    lines.push('');
  }

  if (grouped.low.length > 0) {
    lines.push('  ℹ️  LOW CONFIDENCE - Only use if you understand the relationship:');
    for (const c of grouped.low) {
      lines.push(`    - Column key "${c.fieldName}": { "linkTo": { "concept": "${c.targetConcept}" } }`);
    }
    lines.push('');
  }

  lines.push('EXAMPLE TABLE COLUMN WITH LINK:');
  lines.push('  { "key": "id", "title": "ID", "linkTo": { "concept": "Account" } }');
  lines.push('');
  lines.push('✨ CRITICAL: Every ID or relationship column should have linkTo to enable Miller navigation!');

  return lines.join('\n');
}

/**
 * Convert field name to title case
 * Examples: "customerId" -> "Customer Id", "account_name" -> "Account Name"
 */
function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate linkTo configuration for a field
 */
export function generateLinkConfig(candidate: LinkCandidate): { concept: string; idField?: string } {
  if (candidate.fieldName === 'id' && candidate.idField === 'id') {
    // Simple case: primary key
    return { concept: candidate.targetConcept };
  }
  
  // Include idField if it differs from default
  return {
    concept: candidate.targetConcept,
    idField: candidate.fieldName !== 'id' ? candidate.fieldName : undefined,
  };
}
