"use client";
import { Fragment, type ReactNode, useState } from "react";
import { LandingPhoto } from "./landing-photo";
import { T, useLanguage } from "./language";
import { PhotoViewer } from './photo-viewer';
import { PhotoCommentCard, usePhotoCommentCards } from './photo-comment-card';

export function SelectedMoments({ photos, children }: { photos: (string | null)[]; children?: ReactNode }) {
  const { t, tField, blocks, language } = useLanguage();
  const caption=(index:number)=>blocks.photos[index]?.caption[language] ?? tField(`gallery.caption${index+1}`);
  const [selected, setSelected] = useState<number | null>(null);
  const comments=usePhotoCommentCards(photos.flatMap((src,index)=>src&&blocks.photos[index]?['gallery:'+blocks.photos[index].id]:[]));
  const available = photos.map((src, index) => src ? index : -1).filter(index => index >= 0);
  function step(offset: number) {
    if (selected === null) return;
    setSelected(available[(available.indexOf(selected) + offset + available.length) % available.length]);
  }
  return <div className="v2-selected-moments memory-photographs" id="gallery" tabIndex={-1} role="group" aria-label={t("The Archive")}>
    <div className="moments-album">{photos.map((src, index) => <Fragment key={blocks.photos[index]?.id??index}><figure className={`moment moment-${index + 1}`}>
      {src ? <button className="moment-open" type="button" aria-label={`${t("Open photograph")} ${index + 1}`} onClick={() => setSelected(index)}><LandingPhoto key={src} src={src} alt={caption(index)} /><span><T>Take a closer look</T></span></button>
        : <LandingPhoto src={null} alt="" />}
      <figcaption>{caption(index)}</figcaption>
      {src&&blocks.photos[index]&&<PhotoCommentCard photoKey={'gallery:'+blocks.photos[index].id} overview={comments.data} error={comments.error} onRead={()=>setSelected(index)}/>}
    </figure>{index === Math.min(2, photos.length - 1) ? children : null}</Fragment>)}{photos.length === 0 ? children : null}</div>
    <PhotoViewer photo={selected!==null&&photos[selected]&&blocks.photos[selected]?{key:'gallery:'+blocks.photos[selected].id,src:photos[selected]!,caption:caption(selected)}:null} onClose={()=>setSelected(null)} onPrevious={available.length>1?()=>step(-1):undefined} onNext={available.length>1?()=>step(1):undefined}/>
  </div>;
}
