'use client';
import { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from './rich-text-editor';
const RichTextEditor = lazy(()=>import('./rich-text-editor'));
// Load ProseMirror only in the CMS, never in a guest's invitation bundle.
export function RichTextField(props:RichTextEditorProps) {
  return <Suspense fallback={<p role="status">Menyiapkan editor teks…</p>}><RichTextEditor key={props.label} {...props}/></Suspense>;
}
