import { lazy } from 'react';

// react-markdown and prism are only loaded when a view shows Markdown or code.
const load = () => import('./RichTextWidget');
const loadMarkdown = () => import('./Markdown');
const loadCode = () => import('./CodeBlock');

export const LazyRichTextWidget = lazy(() => load().then((m) => ({ default: m.RichTextWidget })));
export const LazyMarkdown = lazy(() => loadMarkdown().then((m) => ({ default: m.Markdown })));
export const LazyCodeBlock = lazy(() => loadCode().then((m) => ({ default: m.CodeBlock })));
