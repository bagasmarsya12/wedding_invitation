'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { richTextDocument, richTextPlain, serializeRichText, validRichText } from '@/lib/rich-text';

export type RichTextEditorProps = {value:string;onChange:(value:string)=>void;label:string;limit?:number;placeholder?:string;disabled?:boolean;serif?:boolean};
const paragraphs=Extension.create({name:'paragraphSpace',addGlobalAttributes(){return [{types:['paragraph'],attributes:{spaceAfter:{default:null,parseHTML:element=>['tight','normal','airy'].includes(element.dataset.space??'')?element.dataset.space:null,renderHTML:attributes=>({'data-space':attributes.spaceAfter??'normal'})}}}];}});
export default function RichTextEditor({value,onChange,label,limit=2000,placeholder='',disabled=false,serif=false}:RichTextEditorProps) {
  const [error,setError]=useState('');
  const lastValue=useRef(value);
  const guard=useMemo(()=>Extension.create({name:'proseLimit',addProseMirrorPlugins(){return [new Plugin({filterTransaction(transaction){
    if (!transaction.docChanged) return true;
    try { if (validRichText(serializeRichText(transaction.doc.toJSON()),limit)) return true; } catch { /* Reject oversized or unsupported pasted documents. */ }
    setError(`Teks maksimal ${limit} karakter. Perubahan terakhir belum diterapkan.`); return false;
  }})];}}),[limit]);
  const editor=useEditor({
    immediatelyRender:false, shouldRerenderOnTransaction:false,
    extensions:[StarterKit.configure({blockquote:false,bulletList:false,orderedList:false,listItem:false,listKeymap:false,heading:false,code:false,codeBlock:false,horizontalRule:false,strike:false,underline:false,link:false,dropcursor:false,gapcursor:false,trailingNode:false}),paragraphs,guard],
    content:richTextDocument(value),editable:!disabled,
    editorProps:{attributes:{class:`cms-prose${serif?' is-serif':''}`,role:'textbox','aria-label':label,'aria-multiline':'true'}},
    onUpdate:({editor})=>{const next=serializeRichText(editor.getJSON());lastValue.current=next;setError('');onChange(next);},
  });
  const state=useEditorState({editor,selector:({editor})=>({bold:editor?.isActive('bold')??false,italic:editor?.isActive('italic')??false,space:editor?.getAttributes('paragraph').spaceAfter??'normal',undo:editor?.can().undo()??false,redo:editor?.can().redo()??false,empty:editor?.isEmpty??true})});
  useEffect(()=>{if(editor&&value!==lastValue.current){lastValue.current=value;editor.commands.setContent(richTextDocument(value),{emitUpdate:false});}},[editor,value]);
  useEffect(()=>{editor?.setEditable(!disabled,false);},[editor,disabled]);
  return <>
    <div className="cms-rich-editor">
      <div className="cms-rich-toolbar" role="toolbar" aria-label={`Format ${label}`}>
        <button type="button" aria-label="Tebal" aria-pressed={state?.bold??false} title="Tebal · Ctrl/⌘ B" disabled={disabled||!editor} onClick={()=>editor?.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" aria-label="Miring" aria-pressed={state?.italic??false} title="Miring · Ctrl/⌘ I" disabled={disabled||!editor} onClick={()=>editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" aria-label="Urungkan format" title="Urungkan · Ctrl/⌘ Z" disabled={disabled||!state?.undo} onClick={()=>editor?.chain().focus().undo().run()}>↶</button>
        <button type="button" aria-label="Ulangi format" title="Ulangi" disabled={disabled||!state?.redo} onClick={()=>editor?.chain().focus().redo().run()}>↷</button>
        <label>Jarak setelah paragraf<select aria-label={`Jarak paragraf · ${label}`} disabled={disabled||!editor} value={state?.space??'normal'} onChange={event=>editor?.chain().focus().updateAttributes('paragraph',{spaceAfter:event.target.value}).run()}><option value="tight">Rapat</option><option value="normal">Normal</option><option value="airy">Lapang</option></select></label>
      </div>
      <EditorContent editor={editor}/>
    </div>
    <small className="cms-rich-help">Enter: paragraf baru · Shift+Enter: baris baru. Bold, italic, dan jarak mengikuti website; font tetap.</small>
    {!richTextPlain(value).trim()&&placeholder&&<p className="cms-rich-placeholder">Teks bawaan: {placeholder}</p>}
    {error&&<span className="cms-rich-error" role="alert">{error}</span>}
  </>;
}
