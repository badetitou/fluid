# LLM Reasoning Display Feature

## Overview

This feature allows Fluid to display the **reasoning steps** of the LLM when generating or modifying views. Instead of showing only the final JSON result, users can now see the LLM's thinking process broken down into clear, intermediate steps.

## How It Works

### 1. Backend Changes

#### Modified Prompt (apps/bff/src/llm/prompt.ts)
The system prompt now instructs the LLM to structure responses with two sections:
- **THINKING section**: Optional reasoning steps prefixed with `THINKING:` header, each step on a line starting with `- `
- **JSON section**: The final valid JSON view specification

Example LLM response:
```
THINKING:
- The user wants transaction summaries per account type
- I should include a table of all transactions
- A bar chart showing total by account type would be useful
- The amount field should be formatted as currency

{
  "title": "Account Transactions Overview",
  ...JSON content...
}
```

#### New Extraction Function (apps/bff/src/llm/client.ts)
Added `extractReasoning()` function that:
- Detects `THINKING:` header
- Extracts all bullet-pointed steps (lines starting with `- `)
- Separates reasoning from the remaining content
- Returns both as `{ reasoning: string[], content: string }`

#### Updated Generation Logic (apps/bff/src/llm/generate.ts)
- Calls `extractReasoning()` on both initial and repair responses
- Passes reasoning steps along with the spec in the response
- Maintains backward compatibility (reasoning is optional)

#### API Response (apps/bff/src/routes/llm.ts)
The `/api/llm/generate-view` endpoint now returns:
```json
{
  "spec": { ... },
  "provider": "openai",
  "model": "gpt-4",
  "reasoning": [
    "The user wants transaction summaries per account type",
    "I should include a table of all transactions",
    ...
  ]
}
```

### 2. Frontend Changes

#### Updated Type (apps/frontend/src/bff/client.ts)
`GenerateViewResponse` now includes optional `reasoning: string[]` field.

#### Enhanced UI Component (apps/frontend/src/components/ViewAssistantModal.tsx)
- Added `reasoning` state to track the steps
- Reset reasoning when starting a new generation
- Display reasoning in a **Timeline** component from Ant Design
- Shown as an info Alert when reasoning steps are present
- Each step appears as a timeline item for clarity

The reasoning is displayed **above the preview** and shows each thinking step in sequence.

## User Experience

1. **Generate a View**: User describes what they want in the prompt
2. **See Reasoning**: The LLM's thinking steps appear in a blue info box with timeline
3. **Review Reasoning**: User can understand why the LLM made certain design choices
4. **Preview Result**: The generated view appears below with a live preview
5. **Refine**: User can provide more prompts to refine, reasoning updates each time

## Example

### Input
"Show me a breakdown of transactions by account type with a trend over time"

### Reasoning Output
- The user wants to see transactions grouped by account type
- I need a bar chart showing the count/sum by account type
- A line chart showing transaction trends over time would be useful
- Should include both current month and historical data
- The date field should be formatted as datetime

### Generated View
Table showing all transactions + Bar chart by account type + Line chart over time

## Backward Compatibility

- If an LLM provider doesn't include reasoning (or is the mock provider), `reasoning` is `undefined`
- The frontend gracefully handles missing reasoning: it simply doesn't display the reasoning Alert
- No breaking changes to existing APIs or component contracts

## Technical Notes

- Reasoning extraction is lightweight (simple string parsing)
- Repair attempts also extract reasoning if present
- Mock provider returns `undefined` reasoning (as expected)
- All LLM providers (OpenAI, Ollama) support the new prompt format
- Reasoning steps are comma-separated and cleared when starting a new generation

## Future Enhancements

- **Confidence Scoring**: Include confidence levels with reasoning steps
- **Step Highlighting**: Highlight which parts of the view correspond to which reasoning steps
- **User Feedback**: Let users approve/reject specific reasoning steps
- **Streaming**: Display reasoning steps as they arrive (with streaming support)
- **Analytics**: Track which reasoning types lead to user acceptance/rejection
