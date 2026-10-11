'use client';
import { useEffect } from 'react';
import { LanguageProvider,useLanguage } from '@/app/language';
import { WeddingExperience } from '@/app/wedding-experience';
import type { WebsiteConfig,WebsiteBlocks } from '@/lib/website-content';
import type { ArrivalContent } from '@/lib/arrival-content';
import type { ResolvedContent } from '@/lib/landing-content';
import type { loadHomepageContent } from '@/lib/homepage-content';
function PreviewPosition({section,language}:{section:string;language:'id'|'en'}){
  const {setLanguage}=useLanguage();
  useEffect(()=>{setLanguage(language);},[language,setLanguage]);
  useEffect(()=>{
    const root=document.querySelector('.cms-invitation-preview');if(!root)return;
    const submit=(e:Event)=>{e.preventDefault();e.stopPropagation();};root.addEventListener('submit',submit,true);
    if(section==='hero')return()=>root.removeEventListener('submit',submit,true);
    const target={details:'#details',profil:'#profiles',story:'#our-story',archive:'#archive',rsvp:'#leave-a-mark',gift:'#gifts',keepsake:'.v2-closing',footer:'#beyond',seo:'#the-day',navigation:'#the-day',interface:'#the-day',jukebox:'#the-day'}[section]??'#the-day';
    let positioned=false;
    const place=()=>{if(positioned)return;const world=root.querySelector('.v2-world');if(!world?.classList.contains('has-entered')){(root.querySelector('.v2-opening-skip') as HTMLButtonElement|null)?.click();return;}const element=root.querySelector(target)??root.querySelector('#the-day');if(element){element.scrollIntoView({block:'start'});positioned=true;}};
    const observer=new MutationObserver(place);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});place();
    return()=>{observer.disconnect();root.removeEventListener('submit',submit,true);};
  },[section]);
  return null;
}
export function PreviewInvitation({section,language,title,draft,content,website,blocks,arrival,homepage}:{section:string;language:'id'|'en';title:string;draft:boolean;content:ResolvedContent;website:WebsiteConfig;blocks:WebsiteBlocks;arrival:ArrivalContent;homepage:Awaited<ReturnType<typeof loadHomepageContent>>}){
  return <LanguageProvider content={content.values} overrides={content.overrides} website={{...website,trackingEnabled:false}} blocks={blocks} arrival={arrival} initialLanguage={language} persistLanguage={false}><div className="cms-invitation-preview"><div className="cms-preview-banner">Pratinjau privat · {title} · {draft?'Draf':'Konten live'}<span>Pengiriman jawaban dinonaktifkan.</span></div><WeddingExperience {...homepage} guestName="Tamu pratinjau"/><PreviewPosition section={section} language={language}/></div></LanguageProvider>;
}
