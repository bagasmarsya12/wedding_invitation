import { richTextDocument } from '@/lib/rich-text';

/** Render closed-schema React nodes, never content-supplied HTML. Spans also fit inside existing paragraphs. */
export function FormattedText({value}:{value:string}) {
  return <span className="cms-prose">{richTextDocument(value).content.map((paragraph,index)=><span className="cms-prose-block" data-space={paragraph.attrs?.spaceAfter??'normal'} key={index}>
    {paragraph.content?.length ? paragraph.content.map((node,i)=>{
      if (node.type==='hardBreak') return <br key={i}/>;
      let text = <>{node.text}</>;
      if (node.marks?.some(mark=>mark.type==='bold')) text=<strong>{text}</strong>;
      if (node.marks?.some(mark=>mark.type==='italic')) text=<em>{text}</em>;
      return <span key={i}>{text}</span>;
    }) : <br/>}
  </span>)}</span>;
}
